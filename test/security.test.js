import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, symlink, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { productDTO, root } from '../server/db.js';
import { openDatabase } from '../test/fixtures/database.js';
import { createApp } from '../server/index.js';
import { createAdmin, login } from '../server/auth.js';
import { saveProduct } from '../server/products.js';
import { csv, parseCSV, exportWooCSV } from '../server/csv.js';
import { recordEvent, metrics, reportCSV } from '../server/analytics.js';

test('public files reject encoded traversal and malformed URLs while preserving legitimate assets',async t=>{
  const db=openDatabase(':memory:'),app=createApp({db});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));db.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  for(const path of [
    '/assets/..%2fserver/auth.js','/css/..%2ftest/store.test.js','/js/%2e%2e%2fserver/backup.js',
    '/assets/subdir/..%2f..%2fserver/auth.js','/assets/%252e%252e%252fserver/auth.js',
    '/assets/..%5cserver/auth.js','/assets/..%2fadmin/index.html','/server/auth.js',
    '/assets/..%2f.env','/assets/..%2fstorage/store.sqlite','/.git/config'
  ]) {
    const response=await fetch(base+path);assert.equal(response.status,404,path);
    assert.equal((await response.text()).includes("from 'node:crypto'"),false,path);
  }
  for(const path of ['/assets/%E0%A4%A','/assets/%FF','/assets/%']) {
    const response=await fetch(base+path);assert.equal(response.status,400,path);
    assert.deepEqual(await response.json(),{error:'URL inválida.'});
  }
  for(const path of ['/','/index.html','/admin','/admin/','/admin/admin.js','/admin/commerce.css','/js/app.js','/css/style.css','/assets/hero-madeira.webp','/api/health']) {
    const response=await fetch(base+path);assert.equal(response.status,200,path);await response.arrayBuffer();
  }
  const directory=await mkdtemp(join(root,'assets','security-test-')),link=join(directory,'internal');
  t.after(async()=>{await unlink(link).catch(error=>{if(error.code!=='ENOENT')throw error;});await rmdir(directory);});
  await symlink(join(root,'server'),link,'junction');
  const response=await fetch(base+'/assets/'+directory.split(/[\\/]/).at(-1)+'/internal/auth.js');
  assert.equal(response.status,404,'A symlink inside public assets must not expose server files');
  await response.arrayBuffer();
});

test('product sorting accepts only declared keys and rejects inherited object properties',async t=>{
  const db=openDatabase(':memory:');createAdmin(db,{email:'security@example.test',password:'SecurityTestPassword123'});
  const auth=login(db,{email:'security@example.test',password:'SecurityTestPassword123'}),app=createApp({db});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));db.close();});
  const base=`http://127.0.0.1:${app.address().port}`,headers={Authorization:`Bearer ${auth.token}`};
  for(const sort of ['constructor','toString','__proto__','hasOwnProperty','unknown','name; SELECT 1']) {
    const response=await fetch(base+'/api/admin/products?sort='+encodeURIComponent(sort),{headers});
    assert.equal(response.status,400,sort);assert.equal((await response.json()).error,'Ordenação inválida.');
  }
  for(const sort of ['name','newest','stock','price']) {
    const response=await fetch(base+'/api/admin/products?sort='+sort,{headers});
    assert.equal(response.status,200,sort);assert.equal((await response.json()).total,10);
  }
});

test('CSV output neutralizes ASCII, Unicode and control prefixes without losing importable product text',()=>{
  const payloads=['=1+1','+1+1','-1+1','@SUM(1)','\uff1d1+1','\uff0b1+1','\uff0d1+1','\uff20SUM(1)','\ufe661+1',' \n=1+1','\u0000=1+1','\u200b=1+1','\ttext','\ntext','\rtext'];
  for(const name of payloads) {
    const report=reportCSV({products:[{id:1,name,views:2}]},'products');
    assert.ok(report.includes('"\t'+name+'"'),JSON.stringify(name));
    const products=csv([['sku','name','category','price'],['SEC-1',name,'tabuas','1']]);
    assert.ok(products.includes('"\''+name+'"'),JSON.stringify(name));
    assert.equal(parseCSV(products)[0].values.name,name);
  }
  const name='Madeira "especial", 30 x 2\nsegunda linha';
  assert.equal(parseCSV(csv([['sku','name','category','price'],['SEC-1',name,'tabuas','1']]))[0].values.name,name);
  assert.ok(reportCSV({products:[{id:1,name:'Madeira normal',views:-2}]},'products').includes('"Madeira normal"'));
  assert.ok(reportCSV({products:[{id:1,name:'Normal',views:-2}]},'products').includes('"-2"'));
});

test('persisted Unicode product names are protected in analytics and WooCommerce exports',t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const user=createAdmin(db,{email:'csv-security@example.test',password:'SecurityTestPassword123',role:'editor'});
  const name='\uff1d1+1';
  saveProduct(db,user,{...productDTO(db.prepare('SELECT * FROM products WHERE id=1').get()),name},1);
  recordEvent(db,{name:'product_view',productId:1,eventKey:randomUUID(),sessionKey:randomUUID(),origin:'storefront'},new Date(Date.now()-2000));
  assert.ok(reportCSV(metrics(db),'products').includes('"\t'+name+'"'));
  assert.ok(exportWooCSV(db,'https://store.example').includes('"\''+name+'"'));
  assert.equal(db.prepare('SELECT name FROM products WHERE id=1').get().name,name);
});
