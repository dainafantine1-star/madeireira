import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './fixtures/database.js';
import { settings,catalog } from '../server/db.js';
import { createApp } from '../server/index.js';
import { createQuote } from '../server/orders.js';

const request=()=>({requestKey:randomUUID(),customer:{name:'Cliente',phone:'75988887777'},items:[{id:1,qty:1}]});

test('public settings explicitly exclude internal fields from persisted configuration',async t=>{
  const db=await openDatabase();t.after(()=>db.close());
  await db.run('UPDATE company_settings SET public_json=?', JSON.stringify({...await settings(db),internalSecret:'PRIVATE-SECRET',backupKey:'PRIVATE-BACKUP',smtpPassword:'PRIVATE-PASSWORD'}));
  for(const data of [await settings(db),await catalog(db)])assert.doesNotMatch(JSON.stringify(data),/PRIVATE-/);
});

test('public quote never accepts CRM notes or identity documents or returns existing private data',async t=>{
  const db=await openDatabase();t.after(()=>db.close());
  const input=request();Object.assign(input.customer,{document:'PRIVATE-DOCUMENT',notes:'PRIVATE-NOTE',address:'PRIVATE-ADDRESS'});
  const result=await createQuote(db,input);
  assert.doesNotMatch(result.message,/PRIVATE-/);
  const customer=await db.get('SELECT * FROM customers');
  assert.equal(customer.document,'');assert.equal(customer.notes,'');assert.equal(customer.address,'');
  await db.run("UPDATE customers SET document='EXISTING-DOCUMENT',notes='EXISTING-NOTE',address='EXISTING-ADDRESS'");
  const retry=await createQuote(db,{...input,requestKey:randomUUID()});
  assert.doesNotMatch(JSON.stringify(retry),/EXISTING-|PRIVATE-/);
});

test('HTTP quote preserves large carts, rejects invalid shapes, protects private routes and limits submissions',async t=>{
  const db=await openDatabase(),app=await createApp({db});
  app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  for(const path of ['/api/admin/customers','/api/admin/orders','/api/admin/audit','/api/admin/users']) {
    const response=await fetch(base+path);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');await response.text();
  }
  await db.run('UPDATE products SET stock_milli=NULL WHERE id=1');
  const input=request();input.items=Array.from({length:100},(_,i)=>({id:1,qty:1,lineKey:`L${i}`,measures:'á'.repeat(500),specifications:'ç'.repeat(1000)}));
  const post=data=>fetch(base+'/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const large=await post(input);assert.equal(large.status,201);assert.match((await large.json()).message,/Item 100:/);
  const malformed=await post({...request(),customer:[]});assert.equal(malformed.status,400);await malformed.text();
  for(let i=0;i<8;i++){const response=await post(request());assert.equal(response.status,201);await response.text();}
  const limited=await post(request());assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');await limited.text();
});
