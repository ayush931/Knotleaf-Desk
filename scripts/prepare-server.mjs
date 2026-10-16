import { cp, mkdir, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = process.cwd();
await access(path.join(root, '.next/standalone/server.js'));
const target = path.join(root, 'server-dist');
await mkdir(target, { recursive: true });
await cp(path.join(root, '.next/standalone'), target, { recursive: true, force: true });
await cp(path.join(root, '.next/static'), path.join(target, '.next/static'), { recursive: true, force: true });
await cp(path.join(root, 'public'), path.join(target, 'public'), { recursive: true, force: true });
// Trace the room server separately: Next's browser bundle does not trace server-only packages.
const { nodeFileTrace } = createRequire(import.meta.url)('next/dist/compiled/@vercel/nft');
const traced = await nodeFileTrace(['server/web.mjs', 'server/collaboration.mjs'], { base: root });
for (const relative of traced.fileList) {
  if (relative === ".env" || relative.startsWith(".env.") || relative.startsWith(".collab-data/")) continue;
  const destination = path.join(target, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relative), destination, { force: true });
}
for (const filename of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) await rm(path.join(target, filename), { force: true });
console.log('Website and collaboration servers staged in server-dist/');
