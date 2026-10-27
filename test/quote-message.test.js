import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createQuote } from '../server/orders.js';
import { createOwner } from '../server/auth.js';
import { publicSettings,saveSettings } from '../server/company.js';
import '../js/core.js';
import '../js/storefront-policy.js';

test('confirmed WhatsApp can be saved independently of provisional business details',t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  const owner={...createOwner(db,{email:'settings-quote@example.test',password:'SettingsQuoteTest123'}),isOwner:true};
  const settings=saveSettings(db,owner,{...publicSettings(db),confirmed:false,whatsappConfirmed:true,whatsapp:'5575992222895'});
  assert.equal(settings.whatsappConfirmed,true);assert.equal(settings.confirmed,false);
  const view=StorefrontPolicy.company(publicSettings(db));assert.equal(view.canWhatsapp,true);assert.equal(view.whatsapp,'5575992222895');assert.match(view.address,/confirmação/);
  assert.throws(()=>saveSettings(db,owner,{...settings,whatsapp:'5500000000000'}),/WhatsApp válido/);
  const disabled=saveSettings(db,owner,{...settings,whatsappConfirmed:false});assert.equal(StorefrontPolicy.company(disabled).canWhatsapp,false);
});

test('complete quote message preserves every line, SKU, cuts, totals and customer snapshot',t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  db.prepare("UPDATE products SET sku='SKU-AREA',reference='REF-AREA',unit='m2',price_cents=4550,old_price_cents=NULL,stock_milli=NULL WHERE id=1").run();
  db.prepare("UPDATE products SET sku='SKU-CONSULTA',price_cents=NULL,old_price_cents=NULL,stock_milli=NULL WHERE id=2").run();
  const input={requestKey:'complete-message-test-0001',customer:{name:'João & Maria',phone:'71988887777',email:'cliente@example.test'},fulfillment:'delivery',deliveryAddress:'Rua São José, 10',notes:'Entregar à tarde & avisar antes.',items:[
    {id:1,lineKey:'A',qty:3,measurement:{length:2.5,width:0.3,pieces:4},specifications:'Corte liso'},
    {id:1,lineKey:'B',qty:0.125,measures:'Corte especial'},
    {id:2,lineKey:'C',qty:2}
  ]};
  const quote=createQuote(db,input),message=quote.message;
  for(const text of ['LISTA DE PRODUTOS (3 itens)','Item 1:','Item 2:','Item 3:','SKU: SKU-AREA','Referência: REF-AREA','SKU: SKU-CONSULTA','2,5 m × 0,3 m × 4','Corte liso','Corte especial','Quantidade: 0,125 m2','Subtotal estimado do item: Sob consulta','Subtotal dos itens com preço:','142,19','E-mail: cliente@example.test','Entrega: Rua São José, 10','Observações: Entregar à tarde & avisar antes.'])assert.ok(message.includes(text),text);
  assert.equal((message.match(/SKU: SKU-AREA/g)||[]).length,2);
  assert.match(message,/Subtotal estimado do item: R\$\s*136,50/);
  assert.equal(quote.total,null);assert.equal(quote.knownSubtotal,142.19);
  db.prepare("UPDATE products SET name='Nome alterado',sku='OUTRO',price_cents=99999 WHERE id=1").run();
  assert.equal(createQuote(db,input).message,message);
});

test('message includes all 100 allowed quote lines without truncating the last item',t=>{
  const db=openDatabase(':memory:');t.after(()=>db.close());
  db.prepare('UPDATE products SET stock_milli=NULL WHERE id=1').run();
  const quote=createQuote(db,{requestKey:'complete-100-lines-0001',customer:{name:'Cliente teste',phone:'71988887777'},items:Array.from({length:100},(_,i)=>({id:1,qty:1,lineKey:`L${String(i).padStart(3,'0')}`,specifications:`Corte número ${i+1}`}))});
  assert.equal((quote.message.match(/Item \d+:/g)||[]).length,100);
  assert.match(quote.message,/Item 100:/);assert.match(quote.message,/Corte número 100/);assert.match(quote.message,/Retirada na loja/);
});
