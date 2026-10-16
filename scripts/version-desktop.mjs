import { readFile, writeFile } from 'node:fs/promises';
const filename = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(filename, 'utf8'));
const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
if (tag) {
  const version = tag.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Release tag must be a semantic version, e.g. v1.0.0.');
  manifest.version = version;
} else if (process.env.GITHUB_RUN_NUMBER) {
  manifest.version = `${manifest.version.split('-')[0]}-dev.${process.env.GITHUB_RUN_NUMBER}`;
}
await writeFile(filename, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Building Whiteboard ${manifest.version}`);
