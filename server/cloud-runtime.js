import { Readable } from 'node:stream';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { resolve,dirname,basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash,timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { openDatabase } from './db.js';
import { createApp } from './index.js';
import { BlobStorage,StorageConflict } from './blob-storage.js';
import { requestContext } from './request-context.js';
import { createBackup } from './backup.js';
import { snapshot } from './analytics.js';

const maximumRequestBytes=4400000;
export function requestPath(req){
  const url=new URL(req.url,'http://localhost');
  const route=url.searchParams.get('__route')||req.query?.__route||url.pathname;
  if(typeof route!=='string'||!/^\/(api(?:\/|$)|uploads\/|produto\/)/.test(route)||route.includes('?')||route.includes('#'))throw Error('Invalid request path.');
  url.searchParams.delete('__route');
  return route+url.search;
}

export function requestOrigin(req,env=process.env){
  const candidates=[env.PUBLIC_ORIGIN,env.ADMIN_ORIGIN,env.VERCEL_PROJECT_PRODUCTION_URL&&`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,env.VERCEL_URL&&`https://${env.VERCEL_URL}`].filter(Boolean);
  const host=req.headers.host;
  const match=candidates.find(origin=>new URL(origin).host===host);
  if(!match)throw Error('Unrecognized deployment host.');
  return new URL(match).origin;
}

function cloudIp(req){
  const forwarded=req.headers['x-forwarded-for'];
  if(process.env.VERCEL==='1'&&typeof forwarded==='string'){
    const ip=forwarded.split(',')[0].trim();if(isIP(ip))return ip;
  }
  return req.socket?.remoteAddress||'unknown';
}

function persistLimit(db,req){
  db.exec('CREATE TABLE IF NOT EXISTS cloud_request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
  const now=Date.now(),ip=cloudIp(req);
  db.prepare('DELETE FROM cloud_request_limits WHERE expires_at<=?').run(now);
  const buckets=[['api',180]];
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(req.method==='POST'&&pathname==='/api/quotes')buckets.push(['quotes',10]);
  if(req.method==='POST'&&pathname==='/api/admin/login')buckets.push(['login',5]);
  if(!['GET','HEAD'].includes(req.method)&&pathname.startsWith('/api/admin/'))buckets.push(['sensitive',50]);
  for(const [bucket,maximum] of buckets){
    const key=createHash('sha256').update(`${bucket}:${ip}`).digest('hex');
    const row=db.prepare('SELECT count FROM cloud_request_limits WHERE key=?').get(key);
    if(!row&&db.prepare('SELECT count(*) AS n FROM cloud_request_limits').get().n>=30000)return false;
    db.prepare('INSERT INTO cloud_request_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+60000);
    if((row?.count||0)+1>maximum)return false;
  }
  return true;
}

export class BufferedResponse {
  constructor(){this.headers=new Map();this.statusCode=200;this.headersSent=false;this.chunks=[];this.ended=false;}
  setHeader(name,value){this.headers.set(name.toLowerCase(),value);return this;}
  getHeader(name){return this.headers.get(name.toLowerCase());}
  writeHead(status,headers={}){this.statusCode=status;for(const [name,value]of Object.entries(headers))this.setHeader(name,value);this.headersSent=true;return this;}
  write(chunk){if(chunk!==undefined)this.chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return true;}
  end(chunk){this.write(chunk);this.ended=true;return this;}
  send(res){for(const [name,value]of this.headers)res.setHeader(name,value);res.statusCode=this.statusCode;res.end(Buffer.concat(this.chunks));}
}

function json(status,data,headers={}){
  const response=new BufferedResponse();response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});response.end(JSON.stringify(data));return response;
}

function authorizedCron(req,secret){
  const expected=Buffer.from(`Bearer ${secret||''}`),actual=Buffer.from(req.headers.authorization||'');
  return !!secret&&expected.length===actual.length&&timingSafeEqual(expected,actual);
}

export function createCloudHandler({storageFactory=()=>new BlobStorage(),getOrigin=requestOrigin,retries=5}={}){
  return async function handler(req,res){
    let bytes,path,origin;
    try{
      path=requestPath(req);origin=getOrigin(req);
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>maximumRequestBytes){json(413,{error:'Solicitação muito grande. Imagens devem ter até 3 MB.'}).send(res);return;}chunks.push(chunk);}
      bytes=Buffer.concat(chunks);
    }catch{json(400,{error:'Solicitação inválida.'}).send(res);return;}
    const cron=new URL(path,origin).pathname==='/api/cron/backup';
    if(cron&&(req.method!=='GET'||!authorizedCron(req,process.env.CRON_SECRET))){json(401,{error:'Autenticação necessária.'}).send(res);return;}
    let storage;
    try{storage=storageFactory();}catch{json(503,{error:'Armazenamento temporariamente indisponível.'}).send(res);return;}
    for(let attempt=0;attempt<retries;attempt++){
      let directory,db,app;
      try{
        const loaded=await storage.loadDatabase();
        directory=await mkdtemp(resolve(tmpdir(),'madeireira-cloud-'));
        const uploads=resolve(directory,'uploads');await mkdir(uploads);
        const file=resolve(directory,'store.sqlite');await writeFile(file,loaded.bytes,{mode:0o600});
        db=openDatabase(file);
        const before=new Set(db.prepare('SELECT filename FROM media UNION SELECT filename FROM media_variants').all().map(row=>row.filename));
        const copy=Readable.from(bytes.length?[bytes]:[]);copy.method=req.method;copy.url=path;copy.headers={...req.headers};copy.socket={remoteAddress:cloudIp(req)};
        let response;
        await requestContext.run({uploads},async()=>{
          if(cron){
            for(const filename of before)await writeFile(resolve(uploads,filename),await storage.readMedia(filename));
            snapshot(db);
            const result=await createBackup(db,{directory:resolve(directory,'backups'),uploads});
            await storage.saveBackup(basename(result.file),await readFile(result.file));
            response=json(200,{ok:true,encrypted:true,files:result.files});
          }else{
            response=new BufferedResponse();
            if(path.startsWith('/api/')&&!persistLimit(db,copy)){response=json(429,{error:'Muitas solicitações. Aguarde um minuto.'},{'Retry-After':'60'});}
            else{
              app=createApp({db,origin,backgroundTasks:false,readMedia:filename=>storage.readMedia(filename)});
              await app.listeners('request')[0](copy,response);
              if(!response.ended)throw Error('Handler did not finish its response.');
            }
          }
          // Upload immutable images before publishing the DB that references them.
          const after=db.prepare('SELECT filename FROM media UNION SELECT filename FROM media_variants').all();
          for(const {filename}of after)if(!before.has(filename))await storage.saveMedia(filename,await readFile(resolve(uploads,filename)));
          if(db.prepare('SELECT total_changes() AS n').get().n>0){
            db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
            await storage.saveDatabase(await readFile(file),loaded.etag);
          }
        });
        // No cookie, protocol or success response is released until persistence succeeds.
        response.send(res);return;
      }catch(error){
        if(error instanceof StorageConflict&&attempt+1<retries){await new Promise(resolve=>setTimeout(resolve,20+Math.random()*80));continue;}
        console.error(JSON.stringify({event:'cloud_request_failed',code:error instanceof StorageConflict?'storage_conflict':error.code||error.name}));
        json(503,{error:'Serviço temporariamente indisponível. Tente novamente.'},{'Retry-After':'2'}).send(res);return;
      }finally{
        app?.removeAllListeners();db?.close();
        if(directory&&dirname(directory)===resolve(tmpdir()))await rm(directory,{recursive:true,force:true});
      }
    }
  };
}
