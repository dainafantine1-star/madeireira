import { createHash,randomBytes,randomUUID,createCipheriv,createDecipheriv } from 'node:crypto';
import { mkdir,readFile,writeFile,rename,unlink,copyFile,stat } from 'node:fs/promises';
import { resolve,dirname,basename,join } from 'node:path';
import { withMediaLock } from './media-lock.js';
import { mediaDirectory } from './media.js';
import { root } from './db.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Ordem de restauração respeita as chaves estrangeiras.
const TABELAS=['categories','admin_users','company_settings','banners','products','customers','orders','order_items','order_history','events','event_products','event_receipts','event_dedup','catalog_daily','media','media_variants','audit_log','import_previews','login_attempts','admin_sessions'];

export async function dumpDatabase(db){
  const partes=[];
  for(const tabela of TABELAS){
    const linhas=await db.all(`SELECT * FROM ${tabela}`);
    for(const linha of linhas){
      const cols=Object.keys(linha);
      const vals=cols.map(c=>{
        const v=linha[c];
        if(v===null||v===undefined)return 'NULL';
        if(typeof v==='number')return String(v);
        if(typeof v==='boolean')return v?'1':'0';
        return `'${String(v).replaceAll("'","''")}'`;
      });
      partes.push(`INSERT INTO ${tabela}(${cols.join(',')}) VALUES(${vals.join(',')});`);
    }
  }
  return partes.join(String.fromCharCode(10));
}

// Importa um dump num banco vazio. As tabelas são limpas antes, porque um banco
// recém-criado já vem com o seed (categorias e configuração) e os INSERTs do
// dump colidiriam com essas linhas.
export async function importDatabase(db,sql){
  const instrucoes=sql.split(';'+String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean);
  await db.exec(`TRUNCATE ${TABELAS.join(',')} RESTART IDENTITY CASCADE`);
  for(const instrucao of instrucoes) await db.run(instrucao);
}
const keyBytes=key=>{if(!key)return null;const bytes=Buffer.from(key,'base64');if(bytes.length!==32||bytes.toString('base64')!==key)throw Error('BACKUP_KEY deve conter 32 bytes em base64.');return bytes;};
export function validateBackupConfig(){keyBytes(process.env.BACKUP_KEY);if(process.env.NODE_ENV==='production'&&!process.env.BACKUP_KEY)throw Error('Configure BACKUP_KEY para backups criptografados em produção.');}
export async function createBackup(db,{directory=process.env.BACKUP_DIR||resolve(root,'storage/backups'),uploads=mediaDirectory(),key=process.env.BACKUP_KEY,mirror=process.env.BACKUP_MIRROR_DIR}={}) {
  const secret=keyBytes(key);
  if(process.env.NODE_ENV==='production'&&!secret)throw Error('Backup de produção exige criptografia.');
  return withMediaLock(async()=>{
    await mkdir(directory,{recursive:true,mode:0o700});
    const id='backup-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'-'+randomUUID();
    try {
      // O banco vive no Postgres: o backup é um dump SQL em texto, não um arquivo
      // SQLite. A integridade é conferida na restauração, dentro de transação.
      const rows=await db.all('SELECT filename FROM media UNION SELECT filename FROM media_variants');
      const names=rows.map(r=>r.filename);
      const files=[{path:'store.sql',bytes:Buffer.from(await dumpDatabase(db),'utf8')}];
      for(const filename of names){if(!/^[a-f0-9-]{36}(?:-\d+)?\.(?:webp|png)$/.test(filename))throw Error('Nome de mídia inválido.');files.push({path:'uploads/'+filename,bytes:await readFile(resolve(uploads,filename))});}
      const manifest={format:2,createdAt:new Date().toISOString(),node:process.version,migrations:(await db.all('SELECT name FROM migrations ORDER BY name')).map(r=>r.name),files:files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:hash(f.bytes)}))};
      const plain=Buffer.from(JSON.stringify({manifest,files:files.map(f=>({path:f.path,data:f.bytes.toString('base64')}))}));
      let payload;
      if(secret){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);payload=Buffer.concat([Buffer.from('MPB1'),iv,cipher.getAuthTag(),encrypted]);}
      else payload=Buffer.concat([Buffer.from('MPB0'),plain]);
      const file=resolve(directory,id+'.mpbackup');
      await writeFile(file+'.tmp',payload,{flag:'wx',mode:0o600});await rename(file+'.tmp',file);
      if(mirror){await mkdir(mirror,{recursive:true,mode:0o700});const destination=resolve(mirror,basename(file));await copyFile(file,destination+'.tmp');if(hash(await readFile(destination+'.tmp'))!==hash(payload))throw Error('Cópia externa inválida.');await rename(destination+'.tmp',destination);}
      return {file,encrypted:!!secret,files:files.length,bytes:payload.length,createdAt:manifest.createdAt};
    }finally{ /* nada a limpar: o dump já está em memória */ }
  });
}

export async function restoreBackup(file,target,{key=process.env.BACKUP_KEY}={}) {
  const destination=resolve(target);
  try{await stat(destination);throw Error('A restauração exige um diretório de destino inexistente.');}catch(error){if(error.code!=='ENOENT')throw error;}
  const data=await readFile(file);let plain;
  if(data.subarray(0,4).toString()==='MPB1'){const secret=keyBytes(key);if(!secret)throw Error('Informe BACKUP_KEY para restaurar.');const decipher=createDecipheriv('aes-256-gcm',secret,data.subarray(4,16));decipher.setAuthTag(data.subarray(16,32));plain=Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]);}
  else if(data.subarray(0,4).toString()==='MPB0')plain=data.subarray(4);
  else throw Error('Formato de backup desconhecido.');
  const {manifest,files}=JSON.parse(plain.toString());
  // Formato 2: dump SQL do Postgres. O 1 continha um arquivo SQLite.
  if(![1,2].includes(manifest?.format)||!Array.isArray(files)||files.length!==manifest.files?.length||!files.length)throw Error('Manifesto inválido.');
  const checked=[],names=new Set();
  for(const [i,entry]of files.entries()){
    if(entry.path!=='store.sqlite'&&entry.path!=='store.sql'&&!/^uploads\/[a-f0-9-]{36}(?:-\d+)?\.(?:webp|png)$/.test(entry.path))throw Error('Caminho inválido no backup.');
    if(names.has(entry.path))throw Error('Arquivo duplicado no backup.');names.add(entry.path);
    const bytes=Buffer.from(entry.data,'base64'),expected=manifest.files[i];
    if(expected.path!==entry.path||expected.bytes!==bytes.length||expected.sha256!==hash(bytes))throw Error('Arquivo corrompido no backup.');
    checked.push({...entry,bytes});
  }
  // Formatos: 2 = dump SQL do Postgres (novo), 1 = SQLite (backups antigos).
  const dumpEntry=checked.find(e=>e.path==='store.sql');
  if(!dumpEntry)throw Error('Backup sem dump do banco (store.sql). Backups no formato 1 (SQLite) exigem importação manual.');
  // Exclusive mkdir: never replace an existing tree, including a concurrent restore.
  await mkdir(dirname(destination),{recursive:true,mode:0o700});await mkdir(destination,{mode:0o700});await mkdir(join(destination,'uploads'),{mode:0o700});
  for(const entry of checked)if(entry.path!=='store.sql')await writeFile(resolve(destination,entry.path),entry.bytes,{flag:'wx',mode:0o600});
  // O dump já foi gravado pelo laço acima; a importação no Postgres é feita à
  // parte, por importDatabase(). As sessões do dump são removidas do arquivo
  // antes de gravar, para uma restauração nunca reativar logins antigos.
  await writeFile(resolve(destination,'store.sql'),
    dumpEntry.bytes.toString('utf8').split(String.fromCharCode(10))
      .filter(linha => !/^INSERT INTO admin_sessions\(/.test(linha))
      .join(String.fromCharCode(10)),
    {flag:'wx',mode:0o600});
  return {directory:destination,files:checked.length,createdAt:manifest.createdAt,sessionsRevoked:true};
}

export function scheduleBackups(db){
  validateBackupConfig();const hours=Number(process.env.BACKUP_INTERVAL_HOURS||24);
  if(!Number.isFinite(hours)||hours<1||hours>168)throw Error('BACKUP_INTERVAL_HOURS deve estar entre 1 e 168.');
  let running=false,last=Promise.resolve();
  const run=()=>{if(running)return last;running=true;last=(async()=>{try{const result=await createBackup(db);console.log(JSON.stringify({event:'backup_completed',encrypted:result.encrypted,files:result.files,bytes:result.bytes}));}catch(error){console.error(JSON.stringify({event:'backup_failed',code:error.code||error.name}));}finally{running=false;}})();return last;};
  const timer=setInterval(run,hours*3600000);timer.unref();void run();return async()=>{clearInterval(timer);await last;};
}
