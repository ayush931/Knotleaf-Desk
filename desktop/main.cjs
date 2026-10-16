const { app, BrowserWindow, Menu, dialog, shell, utilityProcess, session } = require('electron');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');

// A stable loopback origin keeps local boards in the same Chromium storage partition.
const PORT = 47831;
const ORIGIN = `http://127.0.0.1:${PORT}`;
let server;
let quitting = false;
const dev = process.argv.includes('--dev');
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.setName('Whiteboard');

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(PORT, '127.0.0.1', () => probe.close(resolve));
  });
}
async function startServer() {
  if (dev) return;
  await availablePort();
  const root = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'desktop-dist');
  server = utilityProcess.fork(path.join(root, 'server/web.mjs'), [], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', WEB_HOST: '127.0.0.1', PORT: String(PORT), WHITEBOARD_STANDALONE: '1', COLLAB_DATA_DIR: path.join(app.getPath('userData'), 'rooms') },
    stdio: 'pipe', serviceName: 'Whiteboard local server',
  });
  await new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => finish(new Error('The local app server did not start within 30 seconds.')), 30000);
    const finish = error => { if (done) return; done = true; clearTimeout(timeout); if (error) reject(error); else resolve(); };
    server.once('exit', code => { if (!quitting) { if (!done) finish(new Error(`Local app server exited (${code}).`)); else { dialog.showErrorBox('Whiteboard stopped', 'The local app server stopped. Restart Whiteboard to continue. Your saved boards remain on this device.'); app.quit(); } } });
    server.stderr?.on('data', data => process.stderr.write(data));
    const poll = () => {
      if (done) return;
      const request = http.get(ORIGIN, response => { response.resume(); if (response.statusCode === 200) finish(); else setTimeout(poll, 200); });
      request.setTimeout(1500, () => request.destroy());
      request.on('error', () => { if (!done) setTimeout(poll, 200); });
    };
    poll();
  });
}
function createWindow() {
  const origin = dev ? 'http://localhost:3000' : ORIGIN;
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 720, minHeight: 480,
    backgroundColor: '#121212', title: 'Whiteboard',
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true },
  });
  const external = url => { try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch { /* Invalid URL: leave it closed. */ } };
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) { event.preventDefault(); external(url); } });
  window.loadURL(origin);
  return window;
}
if (hasLock) {
  app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, ...(dev ? [{ role: 'toggleDevTools' }] : [])] },
      { role: 'windowMenu' },
    ]));
    try { await startServer(); createWindow(); }
    catch (error) { dialog.showErrorBox('Could not open Whiteboard', `${error.message}\n\nClose another app using port ${PORT}, then try again.`); app.quit(); }
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { quitting = true; server?.kill(); });
}
