import sharp from 'sharp';
import { resolve } from 'node:path';
import { root } from '../server/db.js';
for(const width of [640,960,1280])await sharp(resolve(root,'assets/hero-madeira.webp')).resize({width,withoutEnlargement:true}).webp({quality:80}).toFile(resolve(root,`assets/hero-madeira-${width}.webp`));
console.log('Variantes institucionais geradas.');
