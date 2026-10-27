import { get,put,BlobPreconditionFailedError } from '@vercel/blob';
import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';

export const databasePath='database/store.mpdb';
export const mediaName=/^[a-f0-9-]{36}(?:-(?:320|640|960))?\.(?:webp|png)$/;
const magic=Buffer.from('MPDB1');
const maximumDatabaseBytes=64*1024*1024;

export class StorageConflict extends Error {}

export function encryptionKey(encoded=process.env.BACKUP_KEY){
  const key=Buffer.from(encoded||'','base64');
  if(key.length!==32||key.toString('base64')!==encoded)throw Error('Valid BACKUP_KEY required.');
  return key;
}

export function encryptDatabase(bytes,key=encryptionKey()){
  if(bytes.length>maximumDatabaseBytes)throw Error('Database exceeds supported snapshot size.');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(magic);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return Buffer.concat([magic,iv,cipher.getAuthTag(),encrypted]);
}

export function decryptDatabase(bytes,key=encryptionKey()){
  if(bytes.length<33||bytes.length>maximumDatabaseBytes+33||!bytes.subarray(0,5).equals(magic))throw Error('Invalid encrypted database.');
  const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(5,17));
  decipher.setAAD(magic);decipher.setAuthTag(bytes.subarray(17,33));
  return Buffer.concat([decipher.update(bytes.subarray(33)),decipher.final()]);
}

export class BlobStorage {
  constructor({sdk={get,put},key=encryptionKey(),token=process.env.BLOB_READ_WRITE_TOKEN}={}){
    this.sdk=sdk;this.key=key;this.token=token;
  }
  options(){return {access:'private',token:this.token,abortSignal:AbortSignal.timeout(20000)};}
  async read(path,{fresh=false}={}){
    // Compression changes a strong ETag into W/"...", which cannot authorize If-Match.
    // Read the exact stored representation for atomic database updates.
    const result=await this.sdk.get(path,{...this.options(),useCache:!fresh,...fresh?{headers:{'accept-encoding':'identity'}}:{}});
    if(!result)return null;
    if(result.statusCode!==200)throw Error('Unexpected storage response.');
    return {bytes:Buffer.from(await new Response(result.stream).arrayBuffer()),etag:result.blob.etag};
  }
  async loadDatabase(){
    const saved=await this.read(databasePath,{fresh:true});
    if(!saved)throw Error('Database has not been migrated.');
    if(!saved.etag||saved.etag.startsWith('W/'))throw Error('Strong database ETag required.');
    return {bytes:decryptDatabase(saved.bytes,this.key),etag:saved.etag};
  }
  async saveDatabase(bytes,etag){
    if(!etag||etag.startsWith('W/'))throw Error('A strong ETag is required to update the database.');
    try{
      return await this.sdk.put(databasePath,encryptDatabase(bytes,this.key),{
        ...this.options(),contentType:'application/octet-stream',addRandomSuffix:false,
        allowOverwrite:true,ifMatch:etag,cacheControlMaxAge:0
      });
    }catch(error){
      if(error instanceof BlobPreconditionFailedError||error.name==='BlobPreconditionFailedError')throw new StorageConflict('Concurrent database update.');
      throw error;
    }
  }
  async initializeDatabase(bytes){
    return this.sdk.put(databasePath,encryptDatabase(bytes,this.key),{...this.options(),contentType:'application/octet-stream',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:0});
  }
  async readMedia(filename){
    if(!mediaName.test(filename))throw Error('Invalid media name.');
    const saved=await this.read('uploads/'+filename);
    if(!saved)throw Error('Media file not found.');
    return saved.bytes;
  }
  async saveMedia(filename,bytes){
    if(!mediaName.test(filename))throw Error('Invalid media name.');
    return this.sdk.put('uploads/'+filename,bytes,{...this.options(),contentType:filename.endsWith('.png')?'image/png':'image/webp',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:31536000});
  }
  async saveBackup(filename,bytes){
    if(!/^backup-[a-zA-Z0-9.-]+\.mpbackup$/.test(filename)||bytes.subarray(0,4).toString()!=='MPB1')throw Error('Encrypted backup required.');
    return this.sdk.put('backups/'+filename,bytes,{...this.options(),contentType:'application/octet-stream',addRandomSuffix:false,allowOverwrite:false});
  }
}
