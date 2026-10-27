import { DatabaseSync,backup } from 'node:sqlite';
import { mkdir,readFile,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BlobStorage,databasePath } from '../server/blob-storage.js';
import { createBackup } from '../server/backup.js';

// One-time, local, authenticated migration. Secrets come from environment files, never arguments.
const storage=new BlobStorage();
if(await storage.read(databasePath,{fresh:true}))throw Error('A cloud database already exists. Migration stopped to avoid replacing live data.');
const source=new DatabaseSync(process.env.DATABASE_PATH||'storage/store.sqlite',{readOnly:true});
const directory=resolve('.cache/vercel-migration');await mkdir(directory,{recursive:true});
const file=resolve(directory,`snapshot-${randomUUID()}.sqlite`);
let exported;
try{
  const recovery=await createBackup(source,{uploads:resolve(process.env.UPLOAD_DIR||'storage/uploads')});
  if(!recovery.encrypted)throw Error('Encrypted recovery backup required.');
  await backup(source,file);exported=new DatabaseSync(file);
  exported.exec('PRAGMA foreign_keys=ON; DELETE FROM admin_sessions; DELETE FROM login_attempts;');
  if(exported.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||exported.prepare('PRAGMA foreign_key_check').all().length)throw Error('Source database failed integrity checks.');
  const names=exported.prepare('SELECT filename FROM media UNION SELECT filename FROM media_variants').all();
  for(const {filename}of names){
    if(!await storage.read('uploads/'+filename))await storage.saveMedia(filename,await readFile(resolve(process.env.UPLOAD_DIR||'storage/uploads',filename)));
  }
  const counts={products:exported.prepare('SELECT count(*) AS n FROM products WHERE deleted_at IS NULL').get().n,customers:exported.prepare('SELECT count(*) AS n FROM customers').get().n,quotes:exported.prepare('SELECT count(*) AS n FROM orders').get().n,media:names.length};
  exported.exec('PRAGMA wal_checkpoint(TRUNCATE)');exported.close();exported=null;
  await storage.initializeDatabase(await readFile(file));
  console.log(JSON.stringify({migrated:true,encrypted:true,counts}));
}finally{
  exported?.close();source.close();
  for(const suffix of ['','-wal','-shm'])await unlink(file+suffix).catch(error=>{if(error.code!=='ENOENT')throw error;});
}
