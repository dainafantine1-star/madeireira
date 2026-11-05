import { randomUUID } from 'node:crypto';
import * as v from './validation.js';
import { transaction, productDTO,settings } from './db.js';
import { productSelect, validateProduct, writeProduct } from './products.js';
import { audit } from './audit.js';
import { encodeCSV, importedCSVText } from './csv-output.js';

const columns=['sku','name','reference','category','price','oldPrice','stock','lowStock','status','active','featured','dimensions','lengthMm','unit','description','image','commercialTerms'];
export const csv=rows=>encodeCSV(rows);
export function templateCSV(){return csv([columns,['MP-EXEMPLO','Produto exemplo','REF-EXEMPLO','tabuas','','','10','3','active','1','0','30 x 2 cm','3000','un','Descrição do produto','','Preço e entrega sujeitos à confirmação.']]);}
export function parseCSV(source) {
  v.check(typeof source==='string' && Buffer.byteLength(source)<=2*1024*1024,'CSV deve ter até 2 MB.');
  const input=source.replace(/^\uFEFF/,''),delimiter=input.split(/\r?\n/,1)[0].includes(';')?';':',';
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c==='"'){v.check(field===''&&!closed,'Aspas inválidas no CSV.');quoted=true;}
    else if(c===delimiter){row.push(field);field='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';closed=false;v.check(rows.length<=2001,'Importe até 2000 produtos por arquivo.');}
    else{v.check(!closed || /\s/.test(c),'Texto inválido após aspas no CSV.');if(!closed)field+=c;}
  }
  v.check(!quoted,'Aspas não fechadas no CSV.');row.push(field);if(row.some(x=>x!==''))rows.push(row);
  v.check(rows.length>=2&&rows.length<=2001,'CSV deve conter cabeçalho e de 1 a 2000 produtos.');
  const headers=rows.shift().map(h=>h.trim());v.check(new Set(headers).size===headers.length,'Cabeçalhos duplicados.');
  v.check(['sku','name','category','price'].every(c=>headers.includes(c)),'Use o modelo: sku, name, category e price são obrigatórios.');
  v.check(headers.every(h=>columns.includes(h)),'Coluna desconhecida. Use o modelo do painel.');
  return rows.map((r,i)=>({line:i+2,values:r.length===headers.length?Object.fromEntries(headers.map((h,j)=>[h,importedCSVText(r[j])])):null}));
}
function numeric(value,nullable=false,column='Número') {
  if(!value && nullable)return null;
  v.check(typeof value==='string',column+' inválido.');
  // pt-BR spreadsheet notation: "R$ 2.170,50" and "1.234" (thousands) are
  // accepted; "2.17" stays a decimal because it has no thousands group.
  let raw=value.trim().replace(/^R\$\s?/i,'').trim();
  if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw))raw=raw.replace(/\./g,'').replace(',','.');
  else if(/^\d+,\d{1,2}$/.test(raw))raw=raw.replace(',','.');
  v.check(/^\d+(?:[.,]\d{1,3})?$/.test(raw),`${column} inválido: "${value.trim()}". Use ponto ou vírgula como decimal, sem símbolo (ex.: 2170 ou 2170.50).`);
  return Number(raw.replace(',','.'));
}
function boolean(value,fallback){if(value==null||value==='')return fallback;v.check(['0','1','true','false'].includes(value),'Booleano deve ser 0 ou 1.');return ['1','true'].includes(value);}
function slugifyCategory(label) {
  return label.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');
}
// Resolves the CSV category cell against existing categories; a new name is
// reported as pending so the apply step can create it inside the same transaction.
function resolveCategory(db, raw) {
  const label=String(raw ?? '').trim();
  v.check(label,'Informe a categoria.');v.check(label.length<=100,'Categoria muito longa. Use até 100 caracteres.');
  const slug=slugifyCategory(label);
  v.check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug),'Categoria inválida. Use letras, números ou espaços.');
  const candidates=[];
  if(/^[a-z0-9][a-z0-9-]{0,79}$/.test(label))candidates.push(label);
  if(!candidates.includes(slug))candidates.push(slug);
  for(const candidate of candidates) {
    const byId=db.prepare('SELECT id,slug FROM categories WHERE id=?').get(candidate);
    if(byId)return {id:byId.id,slug:byId.slug,label,create:false};
    const bySlug=db.prepare('SELECT id,slug FROM categories WHERE slug=?').get(candidate);
    if(bySlug)return {id:bySlug.id,slug:bySlug.slug,label,create:false};
  }
  return {id:slug,slug,label,create:true};
}
function convert(row,old,defaultLowStock=5) {
  return {...old,sku:row.sku,reference:row.reference || old?.reference || row.sku,name:row.name,category:row.category,
    price:numeric(row.price,true,'Preço'),oldPrice:numeric(row.oldPrice,true,'Preço anterior'),stock:numeric(row.stock,true,'Estoque'),lowStock:row.lowStock?numeric(row.lowStock,false,'Alerta de estoque'):old?.lowStock ?? defaultLowStock,
    status:row.status || 'active',active:boolean(row.active,true),featured:boolean(row.featured,false),dimensions:row.dimensions || '',lengthMm:numeric(row.lengthMm,true,'Comprimento em milímetros'),
    unit:row.unit || 'un',description:row.description || '',image:row.image || old?.image || '',specs:old?.specs || {},
    commercialTerms:row.commercialTerms || old?.commercialTerms || 'Preço, disponibilidade, entrega e pagamento sujeitos à confirmação.'};
}
export function previewImport(db,user,input) {
  v.check(['create','update','upsert','skip'].includes(input.mode),'Modo de importação inválido.');
  const seen=new Set(),rows=[];
  for(const entry of parseCSV(input.csv)) {
    const result={line:entry.line,sku:entry.values?.sku || '',name:entry.values?.name || '',errors:[]};
    try {
      v.check(entry.values,'Quantidade de colunas incorreta.');const key=entry.values.sku.toLowerCase();
      v.check(!seen.has(key),'SKU repetido no arquivo.');seen.add(key);
      const found=db.prepare(`${productSelect} WHERE p.sku=? COLLATE NOCASE`).get(entry.values.sku);
      v.check(!found?.deleted_at,'SKU pertence a produto excluído. Use um novo SKU.');
      if(found&&input.mode==='skip') {
        result.operation='skip';result.id=found.id;result.version=found.version;result.product=productDTO(found);
        rows.push(result);continue;
      }
      v.check(input.mode!=='create'||!found,'SKU já existe; selecione Atualizar, Ignorar ou Criar e atualizar.');
      v.check(input.mode!=='update'||found,'SKU não encontrado para atualização.');
      const category=resolveCategory(db,entry.values.category);
      const product=convert(entry.values,found?productDTO(found):null,settings(db).defaultLowStock);
      product.category=category.id;
      validateProduct(db,product,{allowNewCategory:category.create});
      result.product=product;
      if(category.create)result.pendingCategory={id:category.id,slug:category.slug,label:category.label};
      result.id=found?.id || null;result.version=found?.version || null;result.operation=found?'update':'create';
    }catch(error){result.errors.push(error.status?error.message:'Não foi possível validar esta linha.');}
    rows.push(result);
  }
  db.prepare('DELETE FROM import_previews WHERE expires_at<? AND applied_at IS NULL').run(Date.now());
  const id=randomUUID(),expiresAt=Date.now()+15*60*1000;
  db.prepare('INSERT INTO import_previews(id,actor_id,payload_json,expires_at) VALUES(?,?,?,?)').run(id,user.id,JSON.stringify(rows),expiresAt);
  return {id,expiresAt,rows,valid:rows.every(r=>!r.errors.length),summary:{total:rows.length,errors:rows.filter(r=>r.errors.length).length,create:rows.filter(r=>r.operation==='create').length,update:rows.filter(r=>r.operation==='update').length,ignored:rows.filter(r=>r.operation==='skip').length,newCategories:new Set(rows.filter(r=>r.pendingCategory).map(r=>r.pendingCategory.id)).size}};
}
export function applyImport(db,user,input) {
  let images=input.images;
  if(images!==undefined) {
    v.check(images&&typeof images==='object'&&!Array.isArray(images),'Mapa de imagens inválido.');
    v.check(Object.keys(images).length<=2000,'Mapa de imagens inválido.');
    for(const list of Object.values(images)) {
      v.check(Array.isArray(list)&&list.length>=1&&list.length<=13,'Use até 13 imagens por produto (1 capa + 12 da galeria).');
      for(const url of list)v.image(url);
    }
  }
  return transaction(db,()=>{
    const found=db.prepare('SELECT * FROM import_previews WHERE id=? AND actor_id=?').get(v.text(input.previewId,100),user.id);
    v.check(found,'Prévia inexistente.',404);if(found.applied_at)return JSON.parse(found.result_json);
    v.check(found.expires_at>Date.now(),'Prévia expirada. Gere novamente.',409);
    const rows=JSON.parse(found.payload_json);v.check(rows.every(r=>!r.errors.length),'Corrija as linhas com erro antes de importar.');
    const newCategories=[];
    for(const row of rows) {
      const pending=row.pendingCategory;if(!pending)continue;
      const existing=db.prepare('SELECT id FROM categories WHERE id=?').get(pending.id)||db.prepare('SELECT id FROM categories WHERE slug=?').get(pending.slug);
      if(existing){if(existing.id!==pending.id)row.product.category=existing.id;continue;}
      db.prepare('INSERT INTO categories(id,label,slug) VALUES(?,?,?)').run(pending.id,pending.label,pending.slug);
      audit(db,user,'category_created','category',pending.id,null,{label:pending.label,slug:pending.slug,source:'import'});
      newCategories.push(pending.id);
    }
    for(const row of rows) {
      if(row.operation==='skip')continue;
      if(row.id){const current=db.prepare('SELECT version,deleted_at FROM products WHERE id=?').get(row.id);v.check(current&&!current.deleted_at&&current.version===row.version,'O catálogo mudou após a prévia. Gere outra prévia.',409);}
      else v.check(!db.prepare('SELECT 1 FROM products WHERE sku=? COLLATE NOCASE').get(row.product.sku),'Um SKU foi cadastrado após a prévia. Gere outra prévia.',409);
      const product={...row.product};
      const urls=images&&images[product.sku];
      if(Array.isArray(urls)&&urls.length){product.image=urls[0];product.images=urls.slice(1,13);}
      writeProduct(db,user,{...product,version:row.version ?? undefined},row.id,'product_imported');
    }
    const result={created:rows.filter(r=>!r.id&&r.operation!=='skip').length,updated:rows.filter(r=>r.id&&r.operation!=='skip').length,skipped:rows.filter(r=>r.operation==='skip').length,total:rows.length,newCategories:newCategories.length};
    db.prepare('UPDATE import_previews SET applied_at=CURRENT_TIMESTAMP,result_json=? WHERE id=?').run(JSON.stringify(result),found.id);
    audit(db,user,'import_applied','import',found.id,null,result);return result;
  });
}
export function exportWooCSV(db,base) {
  const headers=['Type','SKU','Name','Published','Is featured?','Visibility in catalog','Short description','Description','In stock?','Stock','Low stock amount','Backorders allowed?','Regular price','Sale price','Categories','Images','Length (cm)','Attribute 1 name','Attribute 1 value(s)','Attribute 1 visible','Attribute 1 global','Attribute 2 name','Attribute 2 value(s)','Attribute 2 visible','Attribute 2 global','Meta: mp_reference','Meta: mp_dimensions','Meta: mp_commercial_terms','Meta: mp_price_on_request'];
  const rows=db.prepare(`${productSelect} WHERE p.deleted_at IS NULL ORDER BY p.id`).all().map(row=>{
    const p=productDTO(row);return ['simple',p.sku,p.name,p.active&&p.categoryActive?1:-1,p.featured?1:0,'visible',p.shortDescription,p.description,p.available?1:0,p.stock??'',p.lowStock,0,
      p.offer?p.oldPrice:p.price??'',p.offer?p.price:'',row.category_label.replace(/,/g,'\\,'),[...new Set([p.image,...p.images])].filter(Boolean).map(image=>new URL(image,base+'/').href).join(', '),p.lengthMm==null?'':p.lengthMm/10,
      'Unidade de cobrança',p.unit,1,0,'Dimensões',p.dimensions,1,0,p.reference,p.dimensions,p.commercialTerms,p.price==null?'yes':'no'];
  });
  return csv([headers,...rows]);
}
