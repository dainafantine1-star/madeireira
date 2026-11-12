import { randomUUID } from 'node:crypto';
import * as v from './validation.js';
import { transaction, productDTO,settings } from './db.js';
import { productSelect, validateProduct, writeProduct, writeProductValidated } from './products.js';
import { audit, auditBulk } from './audit.js';
import { encodeCSV, importedCSVText } from './csv-output.js';

const columns=['sku','name','reference','category','price','oldPrice','stock','lowStock','status','active','featured','dimensions','lengthMm','unit','description','image','commercialTerms'];
export const csv=rows=>encodeCSV(rows);
export function templateCSV(){return csv([columns,['MP-EXEMPLO','Produto exemplo','REF-EXEMPLO','tabuas','','','10','3','active','1','0','30 x 2 cm','3000','un','Descrição do produto','','Preço e entrega sujeitos à confirmação.']]);}
export function parseCSV(source) {
  v.check(typeof source==='string' && Buffer.byteLength(source)<=8*1024*1024,'CSV deve ter até 8 MB.');
  const input=source.replace(/^\uFEFF/,''),delimiter=input.split(/\r?\n/,1)[0].includes(';')?';':',';
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
    else if(c==='"'){v.check(field===''&&!closed,'Aspas inválidas no CSV.');quoted=true;}
    else if(c===delimiter){row.push(field);field='';closed=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field='';closed=false;v.check(rows.length<=5001,'Importe até 5.000 produtos por arquivo.');}
    else{v.check(!closed || /\s/.test(c),'Texto inválido após aspas no CSV.');if(!closed)field+=c;}
  }
  v.check(!quoted,'Aspas não fechadas no CSV.');row.push(field);if(row.some(x=>x!==''))rows.push(row);
  v.check(rows.length>=2&&rows.length<=5001,'CSV deve conter cabeçalho e de 1 a 5.000 produtos.');
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
async function resolveCategory(db, raw, cache) {
  const label=String(raw ?? '').trim();
  v.check(label,'Informe a categoria.');v.check(label.length<=100,'Categoria muito longa. Use até 100 caracteres.');
  const slug=slugifyCategory(label);
  v.check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug),'Categoria inválida. Use letras, números ou espaços.');
  const candidates=[];
  if(/^[a-z0-9][a-z0-9-]{0,79}$/.test(label))candidates.push(label);
  if(!candidates.includes(slug))candidates.push(slug);
  // O cache é montado uma vez por importação: sem ele, cada linha custava duas
  // consultas e uma planilha de 490 linhas levava minutos.
  for(const candidate of candidates) {
    if(cache) {
      const achado=cache.byId.get(candidate) || cache.bySlug.get(candidate);
      if(achado)return {id:achado.id,slug:achado.slug,label,create:false};
      continue;
    }
    const byId=await db.get('SELECT id,slug FROM categories WHERE id=?', candidate);
    if(byId)return {id:byId.id,slug:byId.slug,label,create:false};
    const bySlug=await db.get('SELECT id,slug FROM categories WHERE slug=?', candidate);
    if(bySlug)return {id:bySlug.id,slug:bySlug.slug,label,create:false};
  }
  // Com cache, o que não está nele é categoria nova: registra para a próxima.
  if(cache) {
    const novo={id:slug,slug};
    cache.byId.set(slug,novo);cache.bySlug.set(slug,novo);
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
export async function previewImport(db,user,input) {
  v.check(['create','update','upsert','skip'].includes(input.mode),'Modo de importação inválido.');
  const seen=new Set(),rows=[];
  // Dados que não mudam durante a prévia são carregados uma única vez.
  const categorias=await db.all('SELECT id,slug FROM categories');
  const cacheCategorias={byId:new Map(categorias.map(c=>[c.id,c])),bySlug:new Map(categorias.map(c=>[c.slug,c]))};
  const idsCategorias=new Set(categorias.map(c=>c.id));
  const defaultLowStock=(await settings(db)).defaultLowStock;
  const skusExistentes=new Map((await db.all(`${productSelect} WHERE p.deleted_at IS NULL`)).map(p=>[p.sku.toLowerCase(),p]));
  for(const entry of parseCSV(input.csv)) {
    const result={line:entry.line,sku:entry.values?.sku || '',name:entry.values?.name || '',errors:[]};
    try {
      v.check(entry.values,'Quantidade de colunas incorreta.');const key=entry.values.sku.toLowerCase();
      v.check(!seen.has(key),'SKU repetido no arquivo.');seen.add(key);
      const found=skusExistentes.get(String(entry.values.sku).toLowerCase()) ?? null;
      v.check(!found?.deleted_at,'SKU pertence a produto excluído. Use um novo SKU.');
      if(found&&input.mode==='skip') {
        result.operation='skip';result.id=found.id;result.version=found.version;result.product=productDTO(found);
        rows.push(result);continue;
      }
      v.check(input.mode!=='create'||!found,'SKU já existe; selecione Atualizar, Ignorar ou Criar e atualizar.');
      v.check(input.mode!=='update'||found,'SKU não encontrado para atualização.');
      const category=await resolveCategory(db,entry.values.category,cacheCategorias);
      const product=convert(entry.values,found?productDTO(found):null,defaultLowStock);
      product.category=category.id;
      // "Importar como não publicado" vale para toda a carga, inclusive as
      // linhas que atualizam um produto já existente: é o que o operador pediu
      // ao marcar a opção, e a revisão no painel acontece depois. Uma edição
      // avulsa no painel não passa por aqui, então continua sem derrubar nada.
      if(input.draft){product.active=false;}
      // A categoria nova é válida porque será criada no apply.
      if(category.create) idsCategorias.add(category.id);
      await validateProduct(db,product,{allowNewCategory:category.create,categories:idsCategorias,defaultLowStock});
      result.product=product;
      if(category.create)result.pendingCategory={id:category.id,slug:category.slug,label:category.label};
      result.id=found?.id || null;result.version=found?.version || null;result.operation=found?'update':'create';
    }catch(error){result.errors.push(error.status?error.message:'Não foi possível validar esta linha.');}
    rows.push(result);
  }
  await db.run('DELETE FROM import_previews WHERE expires_at<? AND applied_at IS NULL', Date.now());
  const id=randomUUID(),expiresAt=Date.now()+15*60*1000;
  // Rows go back to the browser because the ZIP importer pairs each SKU with its
  // images before confirming. The stored payload keeps only what applyImport needs.
  const payload=rows.map(r=>({id:r.id,version:r.version,operation:r.operation,product:r.product,pendingCategory:r.pendingCategory,errors:r.errors}));
  await db.run('INSERT INTO import_previews(id,actor_id,payload_json,expires_at) VALUES(?,?,?,?)', id,user.id,JSON.stringify(payload),expiresAt);
  const errors=rows.filter(r=>r.errors.length).map(r=>({line:r.line,sku:r.sku,name:r.name,errors:r.errors}));
  // A file whose SKUs match nothing in the catalogue creates duplicates instead of
  // updating. Surface that before the operator confirms.
  const active=(await db.get('SELECT count(*) AS n FROM products WHERE deleted_at IS NULL')).n;
  const create=rows.filter(r=>r.operation==='create').length,update=rows.filter(r=>r.operation==='update').length;
  const warning=active>0&&update===0&&create>0
    ? `Nenhum SKU da planilha corresponde aos ${active} produto(s) do catálogo. A importação vai criar ${create} produto(s) novos e manter os existentes. Para atualizar os atuais, os SKUs precisam ser os mesmos.`
    : null;
  return {id,expiresAt,rows,valid:errors.length===0,errors:errors.slice(0,200),truncated:errors.length>200,warning,
    summary:{total:rows.length,errors:errors.length,create,update,ignored:rows.filter(r=>r.operation==='skip').length,newCategories:new Set(rows.filter(r=>r.pendingCategory).map(r=>r.pendingCategory.id)).size}};
}
export async function applyImport(db,user,input) {
  let images=input.images;
  if(images!==undefined) {
    v.check(images&&typeof images==='object'&&!Array.isArray(images),'Mapa de imagens inválido.');
    v.check(Object.keys(images).length<=2000,'Mapa de imagens inválido.');
    for(const list of Object.values(images)) {
      v.check(Array.isArray(list)&&list.length>=1&&list.length<=13,'Use até 13 imagens por produto (1 capa + 12 da galeria).');
      for(const url of list)v.image(url);
    }
  }
  return await transaction(db,async()=>{
    const found=await db.get('SELECT * FROM import_previews WHERE id=? AND actor_id=?', v.text(input.previewId,100),user.id);
    v.check(found,'Prévia inexistente.',404);if(found.applied_at)return JSON.parse(found.result_json);
    v.check(found.expires_at>Date.now(),'Prévia expirada. Gere novamente.',409);
    const rows=JSON.parse(found.payload_json);v.check(rows.every(r=>!r.errors.length),'Corrija as linhas com erro antes de importar.');
    // Uma leitura de cada coisa que a prévia já conhecia, em vez de consultar
    // por linha: 490 linhas com três consultas cada custavam minutos.
    const categorias=await db.all('SELECT id,slug FROM categories');
    const porId=new Map(categorias.map(c=>[c.id,c]));
    const porSlug=new Map(categorias.map(c=>[c.slug,c]));
    const newCategories=[];
    for(const row of rows) {
      const pending=row.pendingCategory;if(!pending)continue;
      const existing=porId.get(pending.id)||porSlug.get(pending.slug);
      if(existing){if(existing.id!==pending.id)row.product.category=existing.id;continue;}
      await db.run('INSERT INTO categories(id,label,slug) VALUES(?,?,?) ON CONFLICT (id) DO NOTHING', pending.id,pending.label,pending.slug);
      porId.set(pending.id,{id:pending.id,slug:pending.slug});porSlug.set(pending.slug,{id:pending.id,slug:pending.slug});
      await audit(db,user,'category_created','category',pending.id,null,{label:pending.label,slug:pending.slug,source:'import'});
      newCategories.push(pending.id);
    }
    const atuais=new Map((await db.all('SELECT id,sku,version,deleted_at FROM products')).map(p=>[p.id,p]));
    const skusUsados=new Set([...atuais.values()].filter(p=>!p.deleted_at).map(p=>String(p.sku).toLowerCase()));
    const defaultLowStock=(await settings(db)).defaultLowStock;
    const idsCategorias=new Set(porId.keys());
    const preparados=[];
    for(const row of rows) {
      if(row.operation==='skip')continue;
      if(row.id){const current=atuais.get(row.id);v.check(current&&!current.deleted_at&&current.version===row.version,'O catálogo mudou após a prévia. Gere outra prévia.',409);}
      else v.check(!skusUsados.has(String(row.product.sku).toLowerCase()),'Um SKU foi cadastrado após a prévia. Gere outra prévia.',409);
      const product={...row.product};
      const urls=images&&images[product.sku];
      if(Array.isArray(urls)&&urls.length){product.image=urls[0];product.images=urls.slice(1,13);}
      const data=await validateProduct(db,{...product,version:row.version ?? undefined},{categories:idsCategorias,defaultLowStock});
      preparados.push({data,id:row.id});
      if(!row.id) skusUsados.add(String(product.sku).toLowerCase());
    }
    // Cada ida ao banco custa ~125 ms neste host. Agrupar em lotes reduz
    // centenas de idas a poucas dezenas. Produtos novos entram num INSERT
    // multi-linha; os existentes precisam de UPDATE individual, porque cada um
    // tem colunas e valores próprios. A transação garante tudo ou nada.
    const TAMANHO_LOTE=50;
    const novos=preparados.filter(x=>!x.id);
    const existentes=preparados.filter(x=>x.id);
    for(let i=0;i<novos.length;i+=TAMANHO_LOTE) {
      const lote=novos.slice(i,i+TAMANHO_LOTE);
      const colunas=Object.keys(lote[0].data);
      const valores=[],marcadores=[];
      for(const item of lote) {
        marcadores.push('('+colunas.map(()=>'?').join(',')+')');
        valores.push(...Object.values(item.data));
      }
      await db.run(`INSERT INTO products(${colunas.join(',')}) VALUES ${marcadores.join(',')}`, ...valores);
      await auditBulk(db,user,'product_imported','product', lote.map(x=>({id:x.data.sku,after:{sku:x.data.sku,name:x.data.name}})));
    }
    for(const item of existentes) {
      const colunas=Object.keys(item.data);
      await db.run(`UPDATE products SET ${colunas.map(k=>`${k}=?`).join(',')},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...Object.values(item.data),item.id);
      await auditBulk(db,user,'product_imported','product', [{id:item.id,after:{sku:item.data.sku,name:item.data.name}}]);
    }
    const result={created:rows.filter(r=>!r.id&&r.operation!=='skip').length,updated:rows.filter(r=>r.id&&r.operation!=='skip').length,skipped:rows.filter(r=>r.operation==='skip').length,total:rows.length,newCategories:newCategories.length};
    await db.run('UPDATE import_previews SET applied_at=CURRENT_TIMESTAMP,result_json=? WHERE id=?', JSON.stringify(result),found.id);
    await audit(db,user,'import_applied','import',found.id,null,result);return result;
  });
}
export async function exportWooCSV(db,base) {
  const headers=['Type','SKU','Name','Published','Is featured?','Visibility in catalog','Short description','Description','In stock?','Stock','Low stock amount','Backorders allowed?','Regular price','Sale price','Categories','Images','Length (cm)','Attribute 1 name','Attribute 1 value(s)','Attribute 1 visible','Attribute 1 global','Attribute 2 name','Attribute 2 value(s)','Attribute 2 visible','Attribute 2 global','Meta: mp_reference','Meta: mp_dimensions','Meta: mp_commercial_terms','Meta: mp_price_on_request'];
  const rows=(await db.all(`${productSelect} WHERE p.deleted_at IS NULL ORDER BY p.id`)).map(row=>{
    const p=productDTO(row);return ['simple',p.sku,p.name,p.active&&p.categoryActive?1:-1,p.featured?1:0,'visible',p.shortDescription,p.description,p.available?1:0,p.stock??'',p.lowStock,0,
      p.offer?p.oldPrice:p.price??'',p.offer?p.price:'',row.category_label.replace(/,/g,'\\,'),[...new Set([p.image,...p.images])].filter(Boolean).map(image=>new URL(image,base+'/').href).join(', '),p.lengthMm==null?'':p.lengthMm/10,
      'Unidade de cobrança',p.unit,1,0,'Dimensões',p.dimensions,1,0,p.reference,p.dimensions,p.commercialTerms,p.price==null?'yes':'no'];
  });
  return csv([headers,...rows]);
}
