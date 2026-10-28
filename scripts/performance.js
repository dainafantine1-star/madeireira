import { readFile,stat,readdir,writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { root } from '../server/db.js';
const results=[];
async function budget(label,files,limit){let size=0;for(const file of files)size+=gzipSync(await readFile(resolve(root,file))).length;const ok=size<=limit;results.push({label,bytes:size,limit,ok});if(!ok)process.exitCode=1;}
await budget('JavaScript público gzip',['js/measurement.js','js/core.js','js/storefront-policy.js','js/ui.js','js/product-page.js','js/app.js','js/accessibility.js'],45000);
await budget('CSS público gzip',['css/storefront.css','css/storefront-base.css','css/accessibility.css','css/storefront-refined.css','css/storefront-essential.css','css/branding.css','css/storefront-original.css'],30000);
const fonts=(await readdir(resolve(root,'assets/fonts'))).filter(name=>name.endsWith('.woff2'));let fontBytes=0;for(const font of fonts)fontBytes+=(await stat(resolve(root,'assets/fonts',font))).size;
results.push({label:'Fontes WOFF2 locais',bytes:fontBytes,limit:100000,ok:fontBytes<=100000});if(fontBytes>100000)process.exitCode=1;
await budget('JavaScript admin gzip',['js/core.js','admin/admin.js','admin/commerce.js','admin/analytics.js','js/accessibility.js'],65000);
await budget('CSS admin gzip',['admin/admin.css','admin/commerce.css','css/admin-original.css','css/accessibility.css','css/branding.css'],35000);
for(const name of (await readdir(resolve(root,'assets'))).filter(n=>n.endsWith('.webp'))){const size=(await stat(resolve(root,'assets',name))).size,limit=name.includes('-640')?150000:350000;results.push({label:name,bytes:size,limit,ok:size<=limit});if(size>limit)process.exitCode=1;}
console.table(results);if(process.argv.includes('--save'))await writeFile(resolve(root,'performance-results.json'),JSON.stringify({measuredAt:new Date().toISOString(),results},null,2));
