import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase, settings } from '../server/db.js';
import { createOwner,login } from '../server/auth.js';
import { saveProduct } from '../server/products.js';
import { createQuote, orderDetail } from '../server/orders.js';
import { createApp } from '../server/index.js';
import { exportWooCSV } from '../server/csv.js';
import '../js/measurement.js';

test('metres, area and volume: precise calculation, invalid inputs and rounding',()=>{
  assert.equal(WoodMeasure.calculate('m',{length:2.5,pieces:3}).qty,7.5);
  assert.equal(WoodMeasure.calculate('m2',{length:2.5,width:0.3,pieces:4}).qty,3);
  assert.equal(WoodMeasure.calculate('m3',{length:3,width:0.15,thickness:0.05,pieces:4}).qty,0.09);
  assert.equal(WoodMeasure.calculate('m3',{length:1,width:0.1,thickness:0.005,pieces:1}).qty,0.001);
  for(const dimensions of [{length:NaN,pieces:1},{length:-1,pieces:1},{length:1,pieces:1.5},{length:0.0001,pieces:1},{length:Infinity,pieces:1}]) assert.throws(()=>WoodMeasure.calculate('m',dimensions));
  assert.throws(()=>WoodMeasure.calculate('un',{length:1,pieces:1}));
});

test('full product registration, server-calculated quote, tamper rejection and public product routes',async t=>{
  const db=openDatabase(':memory:');const owner=createOwner(db,{email:'product@example.test',password:'ProductTestPassword123'});
  t.after(()=>db.close());
  const p=saveProduct(db,owner,{name:'Tábua para teste',sku:'TEST-M2',category:'tabuas',price:45.5,unit:'m2',shortDescription:'Resumo para vitrine',description:'Descrição completa\nAplicações e cuidados.',images:['assets/hero-madeira-640.webp','assets/hero-madeira-960.webp'],image:'assets/hero-madeira-640.webp',specs:{Madeira:'Teste'},stock:20});
  assert.equal(p.shortDescription,'Resumo para vitrine');assert.equal(p.images.length,2);
  const exported=exportWooCSV(db,'https://store.example');assert.match(exported,/Short description/);assert.match(exported,/Resumo para vitrine/);assert.match(exported,/https:\/\/store.example\/assets\/hero-madeira-640.webp, https:\/\/store.example\/assets\/hero-madeira-960.webp/);
  const measurement={length:2.5,width:0.3,pieces:4};
  const input={requestKey:'test-measurement-quote-0001',items:[{id:p.id,qty:3,measurement,price:0.01,measures:'Texto adulterado'}],customer:{name:'Cliente teste',phone:'71988887777'}};
  const q=createQuote(db,input);assert.equal(q.total,136.5);
  const detail=orderDetail(db,q.id),line=detail.items[0];
  assert.deepEqual(JSON.parse(line.calculation_json),measurement);assert.equal(line.quantity,3);assert.match(line.custom_measures,/2,5 m × 0,3 m × 4/);assert.equal(line.unit_price_cents,4550);
  assert.equal(createQuote(db,input).id,q.id);
  assert.throws(()=>createQuote(db,{...input,requestKey:'test-measurement-tampered-01',items:[{id:p.id,qty:1,measurement}]}),/metragem mudou/);
  assert.throws(()=>saveProduct(db,owner,{...p,images:Array(13).fill('assets/photo.webp')},p.id),/12 fotos/);
  assert.throws(()=>saveProduct(db,owner,{...p,images:['javascript:alert(1)']},p.id),/imagem inválida/);
  const app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));});
  const base=`http://127.0.0.1:${app.address().port}`;
  const auth=login(db,{email:'product@example.test',password:'ProductTestPassword123'});
  const longInput={...p,name:'Descrição completa no limite',sku:'LONG-HTTP',reference:'LONG-HTTP',description:'木'.repeat(20000),specs:Object.fromEntries(Array.from({length:12},(_,i)=>[`Detalhe ${i}`,'材'.repeat(500)]))};
  const created=await fetch(base+'/api/admin/products',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth.token}`},body:JSON.stringify(longInput)});assert.equal(created.status,201);assert.equal((await created.json()).description.length,20000);
  const response=await fetch(`${base}/produto/${p.id}/tabua-para-teste`);assert.equal(response.status,200);assert.match(await response.text(),/js\/product-page.js/);
  assert.equal((await fetch(`${base}/produto/999999/ausente`)).status,404);
  saveProduct(db,owner,{...p,active:false},p.id);assert.equal((await fetch(`${base}/produto/${p.id}`)).status,404);
});
