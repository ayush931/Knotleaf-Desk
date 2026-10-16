import { spawn } from 'node:child_process';
const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev'], { stdio: 'inherit' });
const collab = spawn(process.execPath, ['server/collaboration.mjs'], { stdio: 'inherit' });
let stopping = false;
const stop = code => { if (stopping) return; stopping = true; web.kill(); collab.kill(); process.exitCode = code || 0; };
web.on('exit', stop); collab.on('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
