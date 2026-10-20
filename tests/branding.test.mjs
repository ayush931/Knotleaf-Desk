import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import config from '../next.config.ts';
import manifest from '../app/manifest.ts';
import { brandAsset } from '../lib/brandAssets.ts';

test('installed app identity stays stable while changed icon bytes produce fresh URLs',()=>{
 const hash=createHash('sha256');for(const name of ['mark.svg','logo.svg','icon-192.png','icon-512.png'])hash.update(readFileSync(`public/icons/${name}`));
 const expected=hash.digest('hex').slice(0,16);expect(config.env.NEXT_PUBLIC_BRAND_ICON_VERSION).toBe(expected);
 const old=process.env.NEXT_PUBLIC_BRAND_ICON_VERSION;
 try{process.env.NEXT_PUBLIC_BRAND_ICON_VERSION=expected;const app=manifest();expect(app.id).toBe('/');expect(app.start_url).toBe('/');expect(app.scope).toBe('/');expect(app.icons.every(icon=>icon.src.endsWith(`?v=${expected}`))).toBe(true);expect(brandAsset('/icons/mark.svg')).toBe(`/icons/mark.svg?v=${expected}`);
 process.env.NEXT_PUBLIC_BRAND_ICON_VERSION='changed';expect(manifest().icons[0].src).not.toBe(app.icons[0].src);expect(manifest().id).toBe(app.id);
 }finally{if(old===undefined)delete process.env.NEXT_PUBLIC_BRAND_ICON_VERSION;else process.env.NEXT_PUBLIC_BRAND_ICON_VERSION=old;}
});
test('manifest revalidation allows existing installations to discover new icons',async()=>{
 expect(await config.headers()).toContainEqual({source:'/manifest.webmanifest',headers:[{key:'Cache-Control',value:'no-cache, max-age=0, must-revalidate'}]});
});
