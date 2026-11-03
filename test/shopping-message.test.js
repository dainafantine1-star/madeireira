import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/measurement.js';
import '../js/core.js';

const product={id:1,name:'Tábua São José',sku:'SKU-1',reference:'REF-1',unit:'m2',price:45.5,available:true,stock:10,specs:{Madeira:'Cedro'},dimensions:'2 × 3 cm',lengthMm:2500};
test('direct WhatsApp message preserves calculations, cuts, consultation and cents without contact data',()=>{
  const message=StoreCore.shoppingMessage([
    {id:1,qty:3,measurement:{length:2.5,width:0.3,pieces:4},specifications:'Corte liso'},
    {id:1,qty:0.125,measures:'Corte menor'},
    {id:2,qty:2}
  ],[product,{...product,id:2,name:'Porta',unit:'un',price:null}],{whatsappMessage:'Olá!',commercialTerms:'Valores a confirmar.'});
  for(const text of ['LISTA DE PRODUTOS (3 itens)','SKU-1','REF-1','Cedro','2,5 m × 0,3 m × 4','Corte liso','Corte menor','Quantidade: 0,125 m2','Subtotal estimado do item: Sob consulta','142,19','Valores a confirmar.'])assert.ok(message.includes(text),text);
  assert.doesNotMatch(message,/Protocolo:|Nome:|Contato:|Retirada na loja|Entrega:/);
});
test('direct list rejects unavailable products, stock aggregation and inconsistent calculations',()=>{
  assert.throws(()=>StoreCore.shoppingMessage([{id:3,qty:1}],[product],{}),/indisponível/);
  assert.throws(()=>StoreCore.shoppingMessage([{id:1,qty:6},{id:1,qty:5}],[product],{}),/estoque/);
  assert.throws(()=>StoreCore.shoppingMessage([{id:1,qty:2,measurement:{length:2.5,width:0.3,pieces:4}}],[product],{}),/medidas/);
});
test('extensive direct lists retain the last item',()=>{
  const message=StoreCore.shoppingMessage(Array.from({length:100},(_,i)=>({id:1,qty:0.001,specifications:'Corte '.repeat(150)+(i===99?'ÚLTIMO ITEM':'')})),[product],{});
  assert.ok(message.includes('Item 100:'));assert.ok(message.includes('ÚLTIMO ITEM'));
});
