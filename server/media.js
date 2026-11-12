import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { root, transaction } from './db.js';
import { audit } from './audit.js';
import * as v from './validation.js';
import { withMediaLock } from './media-lock.js';
import { requestContext } from './request-context.js';
import { bucketFor, SupabaseStorage } from './blob-storage.js';

const storage = new SupabaseStorage();

export function mediaDirectory() {return requestContext.getStore()?.uploads || process.env.UPLOAD_DIR || resolve(dirname(process.env.DATABASE_PATH || resolve(root,'storage/store.sqlite')),'uploads');}
export async function uploadImage(db,user,input){return withMediaLock(async()=>await upload(db,user,input));}
async function upload(db,user,input) {
  v.check(input.usage===undefined||['photo','logo','banner'].includes(input.usage),'Uso de imagem inválido.');
  v.text(input.name,200);v.check(['image/jpeg','image/png','image/webp'].includes(input.type),'Use JPEG, PNG ou WebP.');
  v.check(typeof input.data==='string' && input.data.length<=4200000 && /^[a-z0-9+/]*={0,2}$/i.test(input.data),'Arquivo inválido ou maior que 3 MB.');
  const bytes=Buffer.from(input.data,'base64');v.check(bytes.length>0&&bytes.length<=3*1024*1024,'A imagem deve ter até 3 MB.');
  let output,info;
  try {
    const pipeline=sharp(bytes,{limitInputPixels:24000000,failOn:'warning',animated:false});const meta=await pipeline.metadata();
    v.check(['jpeg','png','webp'].includes(meta.format)&&(!meta.pages||meta.pages===1),'Formato de imagem não permitido.');
    v.check({'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'}[input.type]===meta.format,'O conteúdo não corresponde ao formato declarado.');
    ({data:output,info}=await pipeline.rotate().resize({width:input.usage==='banner'?2560:1800,height:input.usage==='banner'?2560:1800,fit:'inside',withoutEnlargement:true}).webp(input.usage==='logo'?{lossless:true}:{quality:85}).toBuffer({resolveWithObject:true}));
  }catch(error){if(error.status)throw error;throw new v.HttpError(400,'Imagem inválida, incompleta ou com dimensões excessivas.');}
  const id=randomUUID(),filename=`${id}.webp`;await mkdir(mediaDirectory(),{recursive:true});const path=resolve(mediaDirectory(),filename);
  await writeFile(path,output,{flag:'wx'});
  const variants=[];
  try{for(const width of [320,640,960]){if(width>=info.width)continue;const data=await sharp(output).resize({width}).webp(input.usage==='logo'?{lossless:true}:{quality:80}).toBuffer();const filename=`${id}-${width}.webp`;await writeFile(resolve(mediaDirectory(),filename),data,{flag:'wx'});variants.push({width,filename,bytes:data.length,data});}}catch(error){await Promise.all([path,...variants.map(x=>resolve(mediaDirectory(),x.filename))].map(p=>unlink(p).catch(()=>{})));throw error;}
  // O arquivo é enviado ao Supabase Storage antes de ser registrado no banco,
  // para nunca existir registro apontando para um objeto ausente.
  const bucket=bucketFor(input.usage);
  try {
    await storage.saveMedia(filename,output,bucket);
    for(const x of variants) await storage.saveMedia(x.filename,x.data,bucket);
    await transaction(db,async()=>{await db.run('INSERT INTO media(id,filename,original_name,mime,bytes,width,height,created_by,bucket) VALUES(?,?,?,?,?,?,?,?,?)', id,filename,input.name,'image/webp',output.length,info.width,info.height,user.id,bucket);for(const x of variants)await db.run('INSERT INTO media_variants VALUES(?,?,?,?)', id,x.width,x.filename,x.bytes);await audit(db,user,'image_uploaded','media',id,null,{filename,bytes:output.length,bucket});});
  } catch(error) {
    await Promise.all([filename,...variants.map(x=>x.filename)].map(f=>storage.removeMedia(f,bucket).catch(()=>{})));
    await Promise.all([path,...variants.map(x=>resolve(mediaDirectory(),x.filename))].map(p=>unlink(p).catch(()=>{})));
    throw error;
  }
  return {id,url:`uploads/${filename}`,width:info.width,height:info.height};
}
export async function deleteImage(db,user,id){return withMediaLock(async()=>await remove(db,user,id));}
export async function bulkDeleteImages(db,user,ids){return withMediaLock(async()=>await bulkRemove(db,user,ids));}
async function linkReason(db,url) {
  if(await db.get('SELECT 1 FROM products p, jsonb_array_elements_text(p.images_json::jsonb) AS j(value) WHERE p.deleted_at IS NULL AND j.value=?', url))return 'galeria de produto';
  if(await db.get('SELECT 1 FROM products WHERE deleted_at IS NULL AND image=? UNION SELECT 1 FROM categories WHERE image=?', url,url))return 'produto ou categoria';
  if(await db.get("SELECT 1 FROM banners WHERE image=? OR image_mobile=? UNION SELECT 1 FROM company_settings WHERE (public_json::jsonb->>'logo')=? OR (public_json::jsonb->>'heroImage')=?", url,url,url,url))return 'empresa ou campanha';
  return null;
}
async function bulkRemove(db,user,ids) {
  v.check(Array.isArray(ids)&&ids.length>=1&&ids.length<=500,'Selecione de 1 a 500 imagens.');
  const deleted=[],skipped=[];
  for(const id of ids) {
    v.text(id,100);
    const media=await db.get('SELECT * FROM media WHERE id=?', id);
    if(!media){skipped.push({id,reason:'Imagem inexistente.'});continue;}
    const url=`uploads/${media.filename}`;
    const reason=await linkReason(db,url);
    if(reason){skipped.push({id,name:media.original_name,reason:`Em uso por ${reason}.`});continue;}
    const variants=await db.all('SELECT filename FROM media_variants WHERE media_id=?', id);
    await transaction(db,async()=>{await db.run('DELETE FROM media WHERE id=?', id);await audit(db,user,'image_deleted','media',id,{filename:media.filename},null);});
  await Promise.all([media.filename,...variants.map(x=>x.filename)].map(filename=>storage.removeMedia(filename,media.bucket).catch(()=>{})));
    await Promise.all([media.filename,...variants.map(x=>x.filename)].map(filename=>storage.removeMedia(filename,media.bucket).catch(()=>{})));
    await Promise.all([media.filename,...variants.map(x=>x.filename)].map(filename=>unlink(resolve(mediaDirectory(),filename)).catch(()=>{})));
    deleted.push(id);
  }
  return {deleted:deleted.length,skipped};
}
async function remove(db,user,id) {
  const media=await db.get('SELECT * FROM media WHERE id=?', v.text(id,100));v.check(media,'Imagem inexistente.',404);
  const url=`uploads/${media.filename}`;
  const reason=await linkReason(db,url);
  v.check(!reason,reason==='galeria de produto'?'Foto vinculada à galeria de um produto. Retire-a da galeria antes de excluir.':reason==='produto ou categoria'?'Imagem vinculada a um produto ou categoria. Substitua-a antes de excluir.':'Imagem vinculada à empresa ou campanha. Substitua-a antes de excluir.',409);
  const variants=await db.all('SELECT filename FROM media_variants WHERE media_id=?', id);
  // Remove access first; a failed filesystem cleanup leaves an inaccessible orphan.
  await transaction(db,async()=>{await db.run('DELETE FROM media WHERE id=?', id);await audit(db,user,'image_deleted','media',id,{filename:media.filename},null);});
  await Promise.all([media.filename,...variants.map(x=>x.filename)].map(filename=>storage.removeMedia(filename,media.bucket).catch(()=>{})));
  await Promise.all([media.filename,...variants.map(x=>x.filename)].map(filename=>unlink(resolve(mediaDirectory(),filename)).catch(()=>{})));return {ok:true};
}
