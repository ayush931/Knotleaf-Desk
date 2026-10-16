import { cp, mkdir, access, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd();
await access(path.join(root, '.next/standalone/server.js'));
const target = path.join(root, 'desktop-dist');
await mkdir(target, { recursive: true });
await cp(path.join(root, '.next/standalone'), target, { recursive: true, force: true });
await cp(path.join(root, '.next/static'), path.join(target, '.next/static'), { recursive: true, force: true });
await cp(path.join(root, 'public'), path.join(target, 'public'), { recursive: true, force: true });
// Trace the room server separately: Next's browser bundle does not trace server-only packages.
const { nodeFileTrace } = createRequire(import.meta.url)('next/dist/compiled/@vercel/nft');
const traced = await nodeFileTrace(['server/web.mjs', 'server/collaboration.mjs'], { base: root });
for (const relative of traced.fileList) {
  const destination = path.join(target, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relative), destination, { force: true });
}
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(root, 'desktop/package.json'), JSON.stringify({ name: 'whiteboard-desktop', version: manifest.version, main: 'main.cjs', description: manifest.description, author: manifest.author, license: 'MIT' }, null, 2) + '\n');
console.log('Desktop web and collaboration servers staged in desktop-dist/');
