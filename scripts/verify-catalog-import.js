import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { openDatabase, root } from '../server/db.js';
import { createApp } from '../server/index.js';
import { digest } from '../server/auth.js';

const directory=resolve(root,'storage/catalog-verification');mkdirSync(directory,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceDirectory=resolve(root,'catalogo_madeireira/catalogo_madeireira');
const source=JSON.parse(readFileSync(resolve(sourceDirectory,'produtos.json'),'utf8')).produtos;
const permitted=source.filter(p=>p.importacao_automatica_permitida);
const baselineInfo=JSON.parse(readFileSync(resolve(root,'storage/catalog-import-before/backup.json'),'utf8'));
const payload=readFileSync(baselineInfo.file);assert.equal(payload.subarray(0,4).toString(),'MPB0');
const baselineFile=resolve(directory,'before.sqlite');
writeFileSync(baselineFile,Buffer.from(JSON.parse(payload.subarray(4).toString()).files.find(f=>f.path==='store.sqlite').data,'base64'));
const before=new DatabaseSync(baselineFile,{readOnly:true}),live=new DatabaseSync(resolve(root,'storage/store.sqlite'),{readOnly:true});
const report={date:new Date().toISOString(),preservedTables:[],catalog:[],httpImages:[],browser:null};
for(const {name} of before.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
  if(['products','categories','media','audit_log','migrations'].includes(name))continue;
  const old=before.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all(),current=live.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all();
  assert.deepEqual(current,old,`Tabela alterada: ${name}`);report.preservedTables.push({table:name,rows:old.length});
}
for(const row of before.prepare('SELECT * FROM categories').all())assert.deepEqual(live.prepare('SELECT * FROM categories WHERE id=?').get(row.id),row);
const oldAudit=before.prepare('SELECT * FROM audit_log ORDER BY id').all();assert.deepEqual(live.prepare('SELECT * FROM audit_log ORDER BY id LIMIT ?').all(oldAudit.length),oldAudit);
for(const original of before.prepare('SELECT * FROM products').all()) {
  const current=live.prepare('SELECT * FROM products WHERE id=?').get(original.id);
  assert.equal(current.active,0);assert.equal(current.status,'unavailable');
  for(const [key,value] of Object.entries(original))if(!['active','status','updated_at','version'].includes(key))assert.equal(current[key],value);
}
const imported=live.prepare('SELECT * FROM products WHERE active=1 ORDER BY reference').all();
assert.deepEqual(imported.map(p=>p.reference),permitted.map(p=>p.codigo).sort());
for(const p of permitted) {
  const row=imported.find(r=>r.reference===p.codigo);assert.equal(row.sku,p.codigo);assert.equal(row.name,p.nome);assert.equal(row.description,p.descricao);
  for(const key of ['price_cents','old_price_cents','stock','stock_milli','unit','length_mm'])assert.equal(row[key],null);
  assert.equal(row.specs_json,'{}');assert.equal(row.dimensions,'');assert.equal(row.status,'unavailable');
  report.catalog.push({code:p.codigo,id:row.id,image:row.image,description:row.description,observations:p.observacoes});
}
assert.equal(live.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(live.prepare('PRAGMA foreign_key_check').all(),[]);
const qaFile=resolve(directory,'runtime.sqlite');await backup(live,qaFile);before.close();live.close();
// Browser interactions and telemetry run against an exact snapshot to preserve live non-catalog data.
process.env.UPLOAD_DIR=resolve(root,'storage/uploads');
const db=openDatabase(qaFile),app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');
const origin=`http://127.0.0.1:${app.address().port}`;
let browser;
try {
  const catalog=await(await fetch(origin+'/api/catalog')).json();assert.equal(catalog.products.length,32);
  for(const p of catalog.products) {
    assert.equal(p.available,false);const response=await fetch(origin+'/'+p.image);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    const bytes=Buffer.from(await response.arrayBuffer()),original=permitted.find(x=>x.codigo===p.reference);
    assert.equal(hash(bytes),hash(readFileSync(resolve(sourceDirectory,original.imagem))));
    report.httpImages.push({code:p.reference,status:200,sha256:hash(bytes)});
  }
  const token=randomBytes(32).toString('hex'),user=db.prepare('SELECT id FROM admin_users WHERE active=1 ORDER BY is_owner DESC,id LIMIT 1').get();
  db.prepare('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),user.id,Date.now()+3600000);
  const adminResponse=await fetch(origin+'/api/admin/products?size=100',{headers:{cookie:'mp_session='+token}});assert.equal(adminResponse.status,200);
  const adminCatalog=await adminResponse.json();assert.equal(adminCatalog.total,42);
  for(const p of permitted)assert.ok(adminCatalog.items.some(x=>x.reference===p.codigo));
  process.env.PLAYWRIGHT_BROWSERS_PATH=resolve(root,'.cache/playwright');
  const {chromium}=await import('@playwright/test');
  browser=await chromium.launch({headless:true,timeout:30000});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#productsGrid .product').nth(31).waitFor();
  assert.equal(await page.locator('#productsGrid .product').count(),32);
  for(const p of catalog.products) {
    await page.locator('#searchInput').fill(p.reference);await page.locator('#productsGrid .product').nth(0).waitFor();
    assert.equal(await page.locator('#productsGrid .product').count(),1);
    assert.equal(await page.locator('#productsGrid .product').getAttribute('data-id'),String(p.id));
    const photo=page.locator('#productsGrid img');await photo.evaluate(img=>img.decode());
    assert.equal(await photo.getAttribute('src'),p.image);assert.equal(await photo.evaluate(img=>getComputedStyle(img).objectFit),'contain');
    await page.locator(`#productsGrid [data-details="${p.id}"]`).first().click();
    assert.equal(await page.locator('.modal__name').textContent(),p.name);assert.equal(await page.locator('.modal__desc').first().textContent(),p.description);
    assert.equal(await page.locator('#modalAdd').isDisabled(),true);assert.equal(await page.locator('#modalBuy').isDisabled(),true);
    await page.locator('#modalClose').click();
  }
  await page.locator('#searchInput').fill('');
  for(const category of ['aduelas','alisares','arames','adesivos','acabamentos']) {
    await page.locator(`#categoryTiles [data-cat="${category}"]`).click();assert.equal(await page.locator('#productsGrid .product').count(),catalog.products.filter(p=>p.category===category).length);
  }
  await page.locator('#categoryTiles [data-cat="todas"]').click();
  await page.screenshot({path:resolve(directory,'storefront-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(directory,'storefront-mobile.png'),fullPage:true});
  await context.addCookies([{name:'mp_session',value:token,url:origin,httpOnly:true,sameSite:'Strict'}]);
  await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/admin',{waitUntil:'domcontentloaded'});await page.locator('#productSearch').waitFor();
  await page.locator('#productSearch').fill('000051');
  await page.waitForFunction(()=>document.querySelectorAll('.desktop-table tbody tr').length===1&&document.querySelector('.desktop-table tbody').textContent.includes('000051'));
  const p=catalog.products.find(p=>p.reference==='000051');await page.locator(`[data-action="edit"][data-id="${p.id}"]`).first().click();await page.locator('#editor[open]').waitFor();
  assert.equal(await page.locator('#editorForm [name="unit"]').inputValue(),'');assert.equal(await page.locator('#editorForm [name="description"]').inputValue(),p.description);
  await page.locator('#imagePreview').evaluate(img=>img.decode());
  await page.screenshot({path:resolve(directory,'admin-product.png'),fullPage:true});
  assert.deepEqual(errors,[]);report.browser={status:'passed',products:32,checks:['listing','search by all codes','32 detail dialogs','five category filters','original images loaded','unavailable actions disabled','admin listing and editor','desktop and mobile'],errors};
} catch(error) {report.error=error.stack;throw error;}
finally {await browser?.close();app.closeAllConnections();await new Promise(r=>app.close(r));db.close();writeFileSync(resolve(directory,'verification.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({report:resolve(directory,'verification.json'),preservedTables:report.preservedTables.length,images:report.httpImages.length,browser:report.browser}));
