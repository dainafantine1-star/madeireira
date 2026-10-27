import { cp,mkdir,rm } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';

const workspace=resolve('.'),output=resolve(workspace,'public');
if(dirname(output)!==workspace)throw Error('Invalid public output directory.');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const name of ['index.html','css','js','assets'])await cp(resolve(name),resolve(output,name),{recursive:true});
await mkdir(resolve(output,'admin'),{recursive:true});
for(const name of ['index.html','admin.js','admin.css','commerce.js','commerce.css','analytics.js'])await cp(resolve('admin',name),resolve(output,'admin',name));
console.log('Public storefront and admin assets prepared.');
