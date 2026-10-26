import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { once } from 'node:events';
import { openDatabase } from './fixtures/database.js';
import { openDatabase as openRealDatabase, root } from '../server/db.js';
import { createOwner } from '../server/auth.js';
import { importCatalog } from '../scripts/import-catalog.js';
import { createApp } from '../server/index.js';
import { restoreBackup } from '../server/backup.js';
import { saveProduct, getProduct } from '../server/products.js';
import { productDTO } from '../server/db.js';

const python=process.env.CATALOG_PYTHON||resolve(root,'.cache/catalog-python/runtime/python.exe');
test('catalog import: intact PNG routes, 32 codes, blocked conflicts, history, null fields, rollback and repeat', {skip:!existsSync(python),timeout:60000}, async()=>{
  const directory=mkdtempSync(join(tmpdir(),'mp-catalog-')),database=join(directory,'store.sqlite');
  let db=openDatabase(database);const owner=createOwner(db,{email:'catalog@example.test',password:'CatalogTestPassword123'});
  db.prepare("INSERT INTO events(name,product_id) VALUES('product_view',1)").run();
  const options={directory:resolve(root,'catalogo_madeireira/catalogo_madeireira'),python,database,reportDirectory:join(directory,'reports')};
  const dry=await importCatalog(options);assert.equal(dry.report.plan.records.length,32);assert.equal(dry.report.plan.demos.length,10);
  db.close();
  const first=await importCatalog({...options,apply:true});assert.equal(first.report.created.length,32);assert.equal(first.report.inactivated.length,10);
  const second=await importCatalog({...options,apply:true});assert.equal(second.report.created.length,0);assert.equal(second.report.updated.length,0);assert.equal(second.report.unchanged.length,32);
  db=openRealDatabase(database);assert.equal(db.prepare('SELECT count(*) n FROM products').get().n,42);assert.equal(db.prepare('SELECT count(*) n FROM media').get().n,32);
  assert.equal(db.prepare('SELECT product_id FROM events').get().product_id,1);assert.equal(db.prepare('SELECT active FROM products WHERE id=1').get().active,0);
  const source=JSON.parse(readFileSync(resolve(options.directory,'produtos.json'),'utf8')).produtos;
  for(const p of source.filter(p=>p.importacao_automatica_permitida)) {
    const row=db.prepare('SELECT * FROM products WHERE reference=?').get(p.codigo);
    assert.equal(row.description,p.descricao);assert.equal(row.name,p.nome);assert.equal(row.sku,p.codigo);
    for(const key of ['price_cents','stock','stock_milli','unit','length_mm'])assert.equal(row[key],null);
    assert.equal(productDTO(row).available,false);
  }
  for(const code of ['000391','000744','000740','000742'])assert.equal(db.prepare('SELECT 1 FROM products WHERE reference=?').get(code),undefined);
  const p=productDTO(db.prepare('SELECT * FROM products WHERE reference=\'000051\'').get());
  assert.throws(()=>saveProduct(db,owner,{...p,status:'active'},p.id),/unidade/);
  // Existing real commercial fields are retained during reconciliation.
  db.prepare('UPDATE products SET price_cents=12345,stock=7,stock_milli=7000,unit=\'m\' WHERE id=?').run(p.id);
  db.close();await importCatalog({...options,apply:true});db=openRealDatabase(database);
  assert.equal(getProduct(db,p.id).price_cents,12345);assert.equal(getProduct(db,p.id).unit,'m');
  const previous=process.env.UPLOAD_DIR;process.env.UPLOAD_DIR=join(directory,'uploads');
  const app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');
  try {
    const origin=`http://127.0.0.1:${app.address().port}`,catalog=await (await fetch(origin+'/api/catalog')).json();assert.equal(catalog.products.length,32);
    for(const p of catalog.products) {
      const response=await fetch(origin+'/'+p.image);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
      const original=source.find(s=>s.codigo===p.reference);assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync(resolve(options.directory,original.imagem)));
    }
    const response=await fetch(origin+'/api/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestKey:'catalog-blocked-12345',items:[{id:p.id,qty:1}],customer:{name:'Cliente teste',phone:'71999998888'}})});assert.equal(response.status,409);
  } finally {app.closeAllConnections();await new Promise(r=>app.close(r));db.close();if(previous===undefined)delete process.env.UPLOAD_DIR;else process.env.UPLOAD_DIR=previous;}
  const restored=await restoreBackup(second.report.backup.file,join(directory,'restored'));assert.equal(restored.files,33);
  const restoredDb=openRealDatabase(join(restored.directory,'store.sqlite'));assert.equal(restoredDb.prepare('SELECT count(*) n FROM media').get().n,32);restoredDb.close();
  const fresh=openRealDatabase(':memory:');assert.equal(fresh.prepare('SELECT count(*) n FROM products').get().n,0);fresh.close();
});
