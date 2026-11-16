import * as v from './validation.js';
import { productDTO, transaction,settings } from './db.js';
import { quantity } from './validation.js';
import { audit } from './audit.js';

export const productSelect='SELECT p.*,c.label AS category_label,c.active AS category_active FROM products p JOIN categories c ON c.id=p.category_id';
export async function getProduct(db,id) {const p=await db.get(`${productSelect} WHERE p.id=? AND p.deleted_at IS NULL`, v.integer(id));v.check(p,'Produto inexistente.',404);return p;}
export async function validateProduct(db,p,options={}) {
  const category=v.slug(p.category);
  // A importação em lote passa os dados já carregados: consultar categoria e
  // configuração a cada linha custava uma ida ao banco por produto.
  if(options.categories) v.check(options.categories.has(category),'Categoria inexistente.');
  else if(!options.allowNewCategory)v.check(await db.get('SELECT 1 FROM categories WHERE id=?', category),'Categoria inexistente.');
  const price=v.money(p.price),old=v.money(p.oldPrice ?? null);
  v.check(old===null || (price!==null && old>price),'O preço anterior deve ser maior que o atual.');
  const status=p.status || (old!==null?'promotion':'active');v.check(['active','promotion','unavailable'].includes(status),'Status inválido.');
  v.check(status!=='promotion' || (price!==null && old!==null),'Promoção exige preço atual e preço anterior.');
  const sku=v.text(p.sku ?? p.reference,80);v.check(/^[a-z0-9](?:[a-z0-9._\- ]*[a-z0-9])?$/i.test(sku),'SKU aceita letras, números, ponto, hífen, sublinhado e espaços entre caracteres.');
  const unit=p.unit===null||p.unit===''?null:(p.unit || 'un');
  v.check(unit===null||['un','m','m2','m3','pacote','kg','none'].includes(unit),'Unidade inválida.');
  v.check(unit!==null||status==='unavailable','Confirme a unidade de venda antes de disponibilizar o produto.');
  const image=v.image(p.image || '');
  v.check(p.images===undefined || (Array.isArray(p.images)&&p.images.length<=12),'Use até 12 fotos na galeria.');
  const images=[...new Set((p.images || []).map(value=>v.image(value)))].filter(Boolean);
  const stock=p.stock==null?null:p.stock===0?0:quantity(p.stock,unit,100000000);
  if(image.startsWith('uploads/')) v.check(await db.get('SELECT 1 FROM media WHERE filename=?', image.slice(8)),'Imagem não encontrada.');
  for(const photo of images) if(photo.startsWith('uploads/')) v.check(await db.get('SELECT 1 FROM media WHERE filename=?', photo.slice(8)),'Foto da galeria não encontrada.');
  const defaultLowStock=options.defaultLowStock ?? (await settings(db)).defaultLowStock;
  return {
    reference:v.text(p.reference || sku,80),name:v.text(p.name),category_id:category,price_cents:price,
    old_price_cents:status==='promotion'?old:null,description:v.text(p.description ?? '',20000,false),
    short_description:v.text(p.shortDescription ?? '',600,false),images_json:JSON.stringify(images),
    specs_json:v.specs(p.specs || {}),image,commercial_terms:v.text(p.commercialTerms || 'Preço, disponibilidade, entrega e pagamento sujeitos à confirmação.',2000),
    active:v.flag(p.active ?? true),sku,dimensions:v.text(p.dimensions ?? '',200,false),length_mm:p.lengthMm==null?null:v.integer(p.lengthMm,1,1000000),
    unit,status,featured:v.flag(p.featured ?? false),stock:stock===null?null:Math.ceil(stock),stock_milli:stock===null?null:Math.round(stock*1000),low_stock:v.integer(p.lowStock ?? defaultLowStock,0,100000000)
  };
}
export async function saveProduct(db,user,input,id,action='product_updated') {
  return await transaction(db,async()=>await writeProduct(db,user,input,id,action));
}
// Grava um produto já validado. A importação em lote usa este caminho para não
// repetir, linha a linha, a leitura do registro e do DTO antes/depois.
export async function writeProductValidated(db,user,data,id,action,before=null) {
  const chaves=Object.keys(data);
  let productId=id;
  if(id) await db.run(`UPDATE products SET ${chaves.map(k=>`${k}=?`).join(',')},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...Object.values(data),id);
  else {const r=await db.get(`INSERT INTO products(${chaves.join(',')}) VALUES(${chaves.map(()=>'?').join(',')}) RETURNING id`, ...Object.values(data));productId=Number(r.id);}
  await audit(db,user,before?action:'product_created','product',productId,before,{...data,id:productId});
  return productId;
}
export async function writeProduct(db,user,input,id,action='product_updated') {
  const before=id?await getProduct(db,id):null;
  if(before && input.version!==undefined) v.check(input.version===before.version,'Este produto mudou em outra operação. Atualize a lista.',409);
  const data=await validateProduct(db,input),keys=Object.keys(data);
  let productId=id;
  if(id) await db.run(`UPDATE products SET ${keys.map(k=>`${k}=?`).join(',')},version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...Object.values(data),id);
  else {const r=await db.get(`INSERT INTO products(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')}) RETURNING id`, ...Object.values(data));productId=Number(r.id);}
  const after=await getProduct(db,productId);await audit(db,user,before?action:'product_created','product',productId,before,after);return productDTO(after);
}
export async function deleteProduct(db,user,id,version) {
  const before=await getProduct(db,id);if(version!==undefined)v.check(version===before.version,'Produto alterado. Atualize a lista.',409);
  await db.run('UPDATE products SET active=0,deleted_at=CURRENT_TIMESTAMP,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?', id);
  await audit(db,user,'product_deleted','product',id,before,{...before,active:0,deleted:true});
}
export async function productList(db,url) {
  const q=url.searchParams;
  // Deleted products are kept for history; the archive view restores them.
  const archived=q.get('archived')==='1';
  const where=[archived?'p.deleted_at IS NOT NULL':'p.deleted_at IS NULL'],args=[];
  const term=(q.get('q') || '').trim();v.check(term.length<=200,'Busca muito longa.');
  if(term) {where.push("(p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\')");const pattern=`%${term.replace(/[\\%_]/g,'\\$&')}%`;args.push(pattern,pattern,pattern);}
  if(q.get('category')) {where.push('p.category_id=?');args.push(v.slug(q.get('category')));}
  if(q.get('status')) {const s=q.get('status');v.check(['active','promotion','unavailable','inactive'].includes(s),'Status inválido.');
    where.push(s==='inactive'?'p.active=0':s==='unavailable'?"p.active=1 AND (p.status='unavailable' OR p.stock_milli=0)":`p.active=1 AND p.status=? AND (p.stock_milli IS NULL OR p.stock_milli>0)`);if(['active','promotion'].includes(s))args.push(s);}
  if(q.has('featured') && q.get('featured')!=='') {v.check(['0','1'].includes(q.get('featured')));where.push('p.featured=?');args.push(Number(q.get('featured')));}
  if(q.get('stock')) {v.check(['low','zero','unmanaged'].includes(q.get('stock')));where.push({low:'p.stock_milli>0 AND p.stock_milli<=p.low_stock*1000',zero:'p.stock_milli=0',unmanaged:'p.stock_milli IS NULL'}[q.get('stock')]);}
  if(q.get('price')) {v.check(['defined','consultation'].includes(q.get('price')));where.push(q.get('price')==='defined'?'p.price_cents IS NOT NULL':'p.price_cents IS NULL');}
  let page=v.integer(Number(q.get('page') || 1),1,1000000);const size=v.integer(Number(q.get('size') || 20),1,100);
  const orders={name:'lower(p.name),p.id',newest:'p.id DESC',stock:'p.stock_milli ASC,p.id',price:'p.price_cents ASC,p.id'},sort=q.get('sort') || 'newest';
  v.check(Object.hasOwn(orders,sort),'Ordenação inválida.');const order=orders[sort];
  const clause=where.join(' AND '),total=(await db.get(`SELECT count(*) AS n FROM products p WHERE ${clause}`, ...args)).n;
  // Clamp an out-of-range page so a stale link lands on the last page instead of empty.
  const lastPage=Math.max(1,Math.ceil(total/size));if(page>lastPage)page=lastPage;
  return {items:(await db.all(`${productSelect} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args,size,(page-1)*size)).map(productDTO),total,page,size,archived,
    alerts:await db.get('SELECT sum(CASE WHEN stock_milli=0 THEN 1 ELSE 0 END) AS zero,sum(CASE WHEN stock_milli>0 AND stock_milli<=low_stock*1000 THEN 1 ELSE 0 END) AS low FROM products WHERE deleted_at IS NULL'),
    archivedTotal:(await db.get('SELECT count(*) AS n FROM products WHERE deleted_at IS NOT NULL')).n};
}
// Restoring clears the soft-delete flag. A product still without a billing unit
// cannot go back to an available status, so it returns archived-but-visible.
export async function restoreProduct(db,user,id) {
  return await transaction(db,async()=>{
    const row=await db.get(`${productSelect} WHERE p.id=? AND p.deleted_at IS NOT NULL`, v.integer(id));
    v.check(row,'Produto não está excluído.',404);
    await db.run("UPDATE products SET deleted_at=NULL,active=0,status='unavailable',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?", row.id);
    const after=await getProduct(db,row.id);
    await audit(db,user,'product_restored','product',row.id,row,after);
    return productDTO(after);
  });
}
export async function restoreAllProducts(db,user) {
  return await transaction(db,async()=>{
    const rows=await db.all(`${productSelect} WHERE p.deleted_at IS NOT NULL`);
    for(const row of rows) {
      await db.run("UPDATE products SET deleted_at=NULL,active=0,status='unavailable',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?", row.id);
      await audit(db,user,'product_restored','product',row.id,row,{...row,deleted_at:null,active:0,status:'unavailable'});
    }
    return {restored:rows.length};
  });
}
export async function bulkProducts(db,user,input) {
  v.check(Array.isArray(input.items)&&input.items.length>=1&&input.items.length<=100,'Selecione de 1 a 100 produtos.');
  v.check(['delete','activate','deactivate','available','unavailable','feature','unfeature','price'].includes(input.action),'Ação inválida.');
  v.check(new Set(input.items.map(i=>i.id)).size===input.items.length,'Seleção duplicada.');
  return await transaction(db,async()=>{
    for(const item of input.items) {
      const row=await getProduct(db,item.id);v.integer(item.version);v.check(row.version===item.version,'Um produto da seleção mudou. Atualize a lista.',409);
      if(input.action==='delete') await deleteProduct(db,user,row.id,item.version);
      else {
        const p=productDTO(row);
        if(input.action==='activate') p.active=true;if(input.action==='deactivate')p.active=false;
        if(input.action==='available')p.status=p.oldPrice?'promotion':'active';if(input.action==='unavailable')p.status='unavailable';
        if(input.action==='feature')p.featured=true;if(input.action==='unfeature')p.featured=false;
        if(input.action==='price'){p.price=input.price;p.oldPrice=null;if(p.status==='promotion')p.status='active';}
        await writeProduct(db,user,p,row.id,`bulk_${input.action}`);
      }
    }
    return {updated:input.items.length};
  });
}
