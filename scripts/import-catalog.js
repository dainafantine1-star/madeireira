import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { openDatabase, root, transaction } from '../server/db.js';
import { createBackup } from '../server/backup.js';
import { audit } from '../server/audit.js';

const hash = data => createHash('sha256').update(data).digest('hex');
export const categoryMapping = { Aduelas:'aduelas', Alisares:'alisares', Arames:'arames', Adesivos:'adesivos', Acabamentos:'acabamentos' };

export function readCatalog(directory, python) {
  const validation = spawnSync(python, [resolve(directory,'validar_catalogo.py')], {cwd:directory, encoding:'utf8', windowsHide:true, env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  if (validation.error || validation.status !== 0) throw Error('Validador obrigatório falhou: '+(validation.error?.message || validation.stderr));
  const data=JSON.parse(readFileSync(resolve(directory,'produtos.json'),'utf8'));
  const inventory=JSON.parse(readFileSync(resolve(directory,'inventario_fontes.json'),'utf8'));
  const permitted=data.produtos.filter(p=>p.importacao_automatica_permitida===true);
  if(permitted.length!==32 || data.produtos.length!==35) throw Error('Contagem inesperada.');
  for(const p of permitted) {
    if(!categoryMapping[p.categoria_sugerida]) throw Error('Categoria sem mapeamento: '+p.categoria_sugerida);
    const bytes=readFileSync(resolve(directory,p.imagem));
    if(hash(bytes)!==inventory.find(s=>s.arquivo_pacote===p.imagem)?.sha256) throw Error('Imagem divergente: '+p.codigo);
  }
  return {permitted, pending:data.produtos.filter(p=>!p.importacao_automatica_permitida), validation:JSON.parse(validation.stdout), inventory};
}

export function planImport(db, source) {
  const signatures=JSON.parse(readFileSync(new URL('./catalog-demo-signatures.json',import.meta.url),'utf8'));
  const all=db.prepare('SELECT * FROM products').all();
  const demos=all.filter(p=>signatures.some(s=>Object.entries(s).every(([key,value])=>p[key]===value)));
  const records=source.permitted.map(p=>{
    const matches=all.filter(row=>row.reference===p.codigo || row.sku===p.codigo);
    if(matches.length>1 || matches.some(r=>r.reference!==p.codigo || r.sku!==p.codigo || r.deleted_at)) throw Error('Reconciliação exige revisão: '+p.codigo);
    return {code:p.codigo, action:matches.length?'update':'create', id:matches[0]?.id??null};
  });
  return {expected:35,permitted:32,blocked:3,records,demos:demos.filter(p=>p.active||p.status!=='unavailable').map(p=>({id:p.id,code:p.reference,name:p.name,reason:'Correspondência integral com os campos originais do seed; inativação preserva histórico e métricas.'})),preserved:all.filter(p=>!demos.includes(p)&&!records.some(r=>r.id===p.id)).map(p=>({id:p.id,code:p.reference})),categoryMapping};
}

export async function importCatalog({directory, python, apply=false, database=process.env.DATABASE_PATH||resolve(root,'storage/store.sqlite'), reportDirectory=resolve(root,'storage/catalog-import')}) {
  directory=resolve(directory);const source=readCatalog(directory,python);
  const uploads=process.env.UPLOAD_DIR||resolve(dirname(database),'uploads');
  let db=new DatabaseSync(database);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  const plan=planImport(db,source);
  mkdirSync(reportDirectory,{recursive:true});
  const stamp=new Date().toISOString().replaceAll(/[:.]/g,'-');
  const reportFile=resolve(reportDirectory,stamp+(apply?'-import':'-simulation')+'.json');
  const report={createdAt:new Date().toISOString(),database,source:directory,validation:source.validation,plan,pending:source.pending,backup:null,created:[],updated:[],unchanged:[],inactivated:[],preserved:plan.preserved,verification:null};
  if(!apply){db.close();writeFileSync(reportFile,JSON.stringify(report,null,2));return {reportFile,report};}
  // Snapshot before schema migration, as well as before data changes.
  report.backup=await createBackup(db,{directory:resolve(reportDirectory,'backups'),uploads});db.close();
  db=openDatabase(database);
  try {
    const actor=db.prepare('SELECT id,email FROM admin_users WHERE is_owner=1 AND active=1').get()||db.prepare("SELECT id,email FROM admin_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1").get();
    if(!actor) throw Error('Um administrador existente é necessário para a auditoria; nenhum usuário será criado.');
    const prepared=[];
    // Copy intact originals before changing any products; content-addressed lookup makes retries safe.
    mkdirSync(uploads,{recursive:true});
    for(const p of source.permitted) {
      const bytes=readFileSync(resolve(directory,p.imagem)),originalName=`catalogo:${p.codigo}:${hash(bytes)}`;
      const existing=db.prepare('SELECT * FROM media WHERE original_name=?').get(originalName);
      const id=existing?.id||randomUUID(),filename=existing?.filename||id+'.png',target=resolve(uploads,filename);
      if(existsSync(target)) {if(hash(readFileSync(target))!==hash(bytes))throw Error('Arquivo de destino divergente: '+p.codigo);}
      else copyFileSync(resolve(directory,p.imagem),target,1);
      if(bytes.toString('hex',0,8)!=='89504e470d0a1a0a')throw Error('Original não é PNG: '+p.codigo);
      prepared.push({p,id,filename,originalName,existing,bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
    }
    transaction(db,()=>{
      // Reconcile again under the write lock, avoiding a stale simulation.
      const current=planImport(db,source);
      if(JSON.stringify(current)!==JSON.stringify(plan))throw Error('Catálogo alterado durante a preparação; execute novamente.');
      for(const [label,id] of Object.entries(categoryMapping)) {
        const equivalent=db.prepare('SELECT id FROM categories WHERE label=? COLLATE NOCASE').get(label);
        if(!equivalent&&!db.prepare('SELECT 1 FROM categories WHERE id=? OR slug=?').get(id,id)) {
          db.prepare('INSERT INTO categories(id,label,slug) VALUES(?,?,?)').run(id,label,id);
          audit(db,actor,'category_created','category',id,null,{label,source:'catalogo'});
        }
      }
      for(const image of prepared) {
        const {p,id,filename,originalName,existing,bytes,width,height}=image;
        if(!existing)db.prepare('INSERT INTO media(id,filename,original_name,mime,bytes,width,height,created_by) VALUES(?,?,?,?,?,?,?,?)').run(id,filename,originalName,'image/png',bytes,width,height,actor.id);
        const category=db.prepare('SELECT id FROM categories WHERE label=? COLLATE NOCASE').get(p.categoria_sugerida)?.id||categoryMapping[p.categoria_sugerida];
        const fields={name:p.nome,description:p.descricao,category_id:category,image:'uploads/'+filename};
        const before=db.prepare('SELECT * FROM products WHERE reference=?').get(p.codigo);
        let productId=before?.id;
        if(before) {
          if(Object.entries(fields).every(([k,v])=>before[k]===v)){report.unchanged.push(p.codigo);continue;}
          db.prepare('UPDATE products SET name=?,description=?,category_id=?,image=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(...Object.values(fields),before.id);
          report.updated.push(p.codigo);
        } else {
          productId=Number(db.prepare("INSERT INTO products(reference,sku,name,description,category_id,image,price_cents,old_price_cents,stock,stock_milli,unit,status,active) VALUES(?,?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,'unavailable',1)").run(p.codigo,p.codigo,fields.name,fields.description,category,fields.image).lastInsertRowid);
          report.created.push(p.codigo);
        }
        audit(db,actor,'product_imported','product',productId,before,db.prepare('SELECT * FROM products WHERE id=?').get(productId));
      }
      // All permitted products and files are persisted/prepared before retiring demonstrations.
      for(const demo of plan.demos) {
        const before=db.prepare('SELECT * FROM products WHERE id=?').get(demo.id);
        db.prepare("UPDATE products SET active=0,status='unavailable',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(demo.id);
        audit(db,actor,'product_updated','product',demo.id,before,db.prepare('SELECT * FROM products WHERE id=?').get(demo.id));report.inactivated.push(demo);
      }
      if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Vínculos inválidos.');
    });
    writeFileSync(reportFile,JSON.stringify(report,null,2));return {reportFile,report};
  } finally {db.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const directory=process.argv.find(x=>x.startsWith('--catalog='))?.slice(10)||resolve(root,'catalogo_madeireira/catalogo_madeireira');
  const portable=resolve(root,'.cache/catalog-python/runtime/python.exe');
  const python=process.env.CATALOG_PYTHON||(existsSync(portable)?portable:'python');
  try {const result=await importCatalog({directory,python,apply:process.argv.includes('--apply')});console.log(JSON.stringify({reportFile:result.reportFile,plan:result.report.plan,created:result.report.created,updated:result.report.updated,unchanged:result.report.unchanged,inactivated:result.report.inactivated.length,backup:result.report.backup}));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
