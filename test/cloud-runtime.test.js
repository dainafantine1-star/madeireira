import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { backup,DatabaseSync } from 'node:sqlite';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes,randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { BlobStorage,StorageConflict,encryptDatabase,decryptDatabase } from '../server/blob-storage.js';
import { createCloudHandler,requestPath,requestOrigin } from '../server/cloud-runtime.js';
import { restoreBackup } from '../server/backup.js';

class MemoryStorage {
  constructor(bytes){this.bytes=bytes;this.version=1;this.media=new Map();this.backups=new Map();this.conflicts=0;this.failWrites=false;}
  async loadDatabase(){return {bytes:Buffer.from(this.bytes),etag:String(this.version)};}
  async saveDatabase(bytes,etag){
    await new Promise(resolve=>setTimeout(resolve,5));
    if(this.failWrites)throw Error('Storage unavailable');
    if(etag!==String(this.version)){this.conflicts++;throw new StorageConflict();}
    this.bytes=Buffer.from(bytes);this.version++;return {etag:String(this.version)};
  }
  async readMedia(name){assert.ok(this.media.has(name),'Missing persisted media');return this.media.get(name);}
  async saveMedia(name,bytes){this.media.set(name,Buffer.from(bytes));}
  async saveBackup(name,bytes){this.backups.set(name,Buffer.from(bytes));}
}

async function fixture(t){
  const directory=await mkdtemp(resolve(tmpdir(),'mp-cloud-test-'));
  t.after(async()=>{assert.equal(dirname(directory),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const db=openDatabase(':memory:');
  createOwner(db,{email:'cloud@example.test',password:'CloudPasswordTest123!'});
  const file=resolve(directory,'initial.sqlite');await backup(db,file);db.close();
  const storage=new MemoryStorage(await readFile(file));
  let base;
  const app=createServer(createCloudHandler({storageFactory:()=>storage,getOrigin:()=>base}));
  app.listen(0,'127.0.0.1');await once(app,'listening');base=`http://127.0.0.1:${app.address().port}`;
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));});
  const request=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{...body?{'Content-Type':'application/json'}:{},...headers},body:body?JSON.stringify(body):undefined});
  const inspect=async fn=>{
    const file=resolve(directory,`inspect-${randomUUID()}.sqlite`);await writeFile(file,storage.bytes);
    const db=new DatabaseSync(file,{readOnly:true});try{return fn(db);}finally{db.close();}
  };
  return {storage,request,inspect,directory};
}

test('encrypted cloud database validates integrity and uses conditional writes with fresh reads',async()=>{
  const key=randomBytes(32),bytes=Buffer.from('private customer database');
  const encrypted=encryptDatabase(bytes,key);
  assert.deepEqual(decryptDatabase(encrypted,key),bytes);assert.equal(encrypted.includes(bytes),false);
  const tampered=Buffer.from(encrypted);tampered[tampered.length-1]^=1;
  assert.throws(()=>decryptDatabase(tampered,key));assert.throws(()=>decryptDatabase(encrypted,randomBytes(32)));
  let options;
  const storage=new BlobStorage({key,sdk:{
    get:async(path,opts)=>{options=opts;return {statusCode:200,stream:new Response(encrypted).body,blob:{etag:'current'}};},
    put:async(path,payload,opts)=>{assert.equal(opts.ifMatch,'current');assert.equal(opts.access,'private');assert.deepEqual(decryptDatabase(payload,key),bytes);throw new BlobPreconditionFailedError();}
  }});
  assert.deepEqual((await storage.loadDatabase()).bytes,bytes);assert.equal(options.useCache,false);
  assert.equal(options.headers['accept-encoding'],'identity');
  await assert.rejects(storage.saveDatabase(bytes,'current'),StorageConflict);
  await assert.rejects(storage.saveDatabase(bytes,'W/"weak"'),/strong ETag/);
  const weak=new BlobStorage({key,sdk:{get:async()=>({statusCode:200,stream:new Response(encrypted).body,blob:{etag:'W/"weak"'}})}});
  await assert.rejects(weak.loadDatabase(),/Strong database ETag/);
});

test('rewritten routes preserve queries and accept only configured deployment hosts',()=>{
  assert.equal(requestPath({url:'/api/index?__route=/api/admin/products&sort=name'}),'/api/admin/products?sort=name');
  assert.throws(()=>requestPath({url:'/api/index?__route=https://example.com'}));
  assert.equal(requestOrigin({headers:{host:'madeira.vercel.app'}},{VERCEL_PROJECT_PRODUCTION_URL:'madeira.vercel.app'}),'https://madeira.vercel.app');
  const origins={PUBLIC_ORIGIN:'https://madeireiraprogresso.com',ADMIN_ORIGIN:'https://admin.madeireiraprogresso.com'};
  assert.equal(requestOrigin({headers:{host:'madeireiraprogresso.com'}},origins),origins.PUBLIC_ORIGIN);
  assert.equal(requestOrigin({headers:{host:'admin.madeireiraprogresso.com'}},origins),origins.ADMIN_ORIGIN);
  assert.throws(()=>requestOrigin({headers:{host:'attacker.madeireiraprogresso.com'}},origins));
  assert.throws(()=>requestOrigin({headers:{host:'attacker.example'}},{PUBLIC_ORIGIN:'https://madeira.example'}));
});

test('separate invocations persist admin login, CSRF, products, private media and logout',async t=>{
  const {storage,request,inspect}=await fixture(t);
  const login=await request('/api/admin/login','POST',{email:'cloud@example.test',password:'CloudPasswordTest123!',session:'cookie'});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],auth=await login.json();
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.equal(auth.token,undefined);
  const headers={Cookie:cookie,'X-CSRF-Token':auth.csrfToken};
  const me=await request('/api/admin/me','GET',null,headers);assert.equal(me.status,200);assert.equal((await me.json()).isOwner,true);
  const denied=await request('/api/admin/products','POST',{},{Cookie:cookie});assert.equal(denied.status,403);await denied.text();
  const png=await sharp({create:{width:400,height:100,channels:3,background:'#986432'}}).png().toBuffer();
  const uploaded=await request('/api/admin/media','POST',{name:'wood.png',type:'image/png',data:png.toString('base64')},headers);
  assert.equal(uploaded.status,201);const image=await uploaded.json();assert.ok(storage.media.size>=2);
  const product=await request('/api/admin/products','POST',{name:'Madeira persistida',sku:'CLOUD-SKU',category:'tabuas',unit:'un',price:null,specs:{Madeira:'Cedro'},image:image.url},headers);
  assert.equal(product.status,201);await product.text();
  const catalog=await request('/api/catalog');assert.ok((await catalog.json()).products.some(p=>p.sku==='CLOUD-SKU'));
  const photo=await request('/'+image.url);assert.equal(photo.status,200);assert.match(photo.headers.get('content-type'),/image\/webp/);assert.ok((await photo.arrayBuffer()).byteLength>0);
  const orphan=randomUUID()+'.webp';storage.media.set(orphan,Buffer.from('orphan'));
  const hidden=await request('/uploads/'+orphan);assert.equal(hidden.status,404);await hidden.text();
  assert.equal(await inspect(db=>db.prepare("SELECT count(*) AS n FROM products WHERE sku='CLOUD-SKU'").get().n),1);
  const logout=await request('/api/admin/logout','POST',{},headers);assert.equal(logout.status,200);await logout.text();
  const expired=await request('/api/admin/me','GET',null,headers);assert.equal(expired.status,401);await expired.text();
});

test('simultaneous quote requests retry conflicts without losing orders or issuing false protocols',async t=>{
  const {storage,request,inspect}=await fixture(t);
  const input=index=>({requestKey:`cloud-request-00000${index}`,customer:{name:`Cliente ${index}`,phone:`7598888777${index}`},items:[{id:1,qty:1,lineKey:'A'}]});
  const responses=await Promise.all([request('/api/quotes','POST',input(1)),request('/api/quotes','POST',input(2))]);
  const quotes=[];for(const response of responses){assert.equal(response.status,201);quotes.push(await response.json());}
  assert.notEqual(quotes[0].protocol,quotes[1].protocol);assert.ok(storage.conflicts>=1);
  assert.equal(await inspect(db=>db.prepare('SELECT count(*) AS n FROM orders').get().n),2);
  const retry=await request('/api/quotes','POST',input(1));assert.equal(retry.status,201);assert.equal((await retry.json()).protocol,quotes[0].protocol);
  storage.failWrites=true;
  const failed=await request('/api/quotes','POST',input(3));assert.equal(failed.status,503);assert.equal((await failed.json()).protocol,undefined);
  assert.equal(await inspect(db=>db.prepare('SELECT count(*) AS n FROM orders').get().n),2);
});

test('cron requires authentication and writes an encrypted archive that can be restored',async t=>{
  const previous={key:process.env.BACKUP_KEY,cron:process.env.CRON_SECRET};
  process.env.BACKUP_KEY=randomBytes(32).toString('base64');process.env.CRON_SECRET=randomUUID();
  t.after(()=>{for(const [key,value]of [['BACKUP_KEY',previous.key],['CRON_SECRET',previous.cron]])if(value===undefined)delete process.env[key];else process.env[key]=value;});
  const {storage,request,directory}=await fixture(t);
  const denied=await request('/api/cron/backup');assert.equal(denied.status,401);await denied.text();assert.equal(storage.backups.size,0);
  const result=await request('/api/cron/backup','GET',null,{Authorization:`Bearer ${process.env.CRON_SECRET}`});
  assert.equal(result.status,200);assert.equal((await result.json()).encrypted,true);assert.equal(storage.backups.size,1);
  const archive=resolve(directory,'archive.mpbackup');await writeFile(archive,[...storage.backups.values()][0]);
  const restored=await restoreBackup(archive,resolve(directory,'recovered'));
  assert.equal(restored.sessionsRevoked,true);
  const db=new DatabaseSync(resolve(directory,'recovered/store.sqlite'),{readOnly:true});
  try{assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n,10);assert.equal(db.prepare('SELECT count(*) AS n FROM admin_users WHERE is_owner=1').get().n,1);}finally{db.close();}
});
