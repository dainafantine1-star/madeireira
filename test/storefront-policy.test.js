import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/core.js';
import '../js/storefront-policy.js';

test('unconfirmed company contacts never appear as verified public contact details',()=>{
  const input={name:'Loja',confirmed:false,phone:'(XX) XXXXX-XXXX',address:'Av. Exemplo, 1234',hours:'Horário provisório',whatsapp:'5571999998888',heroTitle:'Título cadastrado'};
  const original=JSON.stringify(input),view=StorefrontPolicy.company(input);
  assert.equal(view.canWhatsapp,false);assert.equal(view.whatsapp,'');
  assert.match(view.phone,/atualização/);assert.match(view.address,/confirmação/);assert.doesNotMatch(view.hours,/Horário provisório/);
  assert.equal(view.heroTitle,input.heroTitle);assert.equal(JSON.stringify(input),original);
  const confirmed=StorefrontPolicy.company({...input,confirmed:true});
  assert.equal(confirmed.canWhatsapp,true);assert.equal(confirmed.phone,input.phone);assert.equal(confirmed.address,input.address);
  assert.equal(StorefrontPolicy.company({...input,confirmed:true,whatsapp:'5500000000000'}).canWhatsapp,false);
  const whatsappOnly=StorefrontPolicy.company({...input,whatsappConfirmed:true});
  assert.equal(whatsappOnly.canWhatsapp,true);assert.equal(whatsappOnly.whatsapp,input.whatsapp);
  assert.match(whatsappOnly.address,/confirmação/);assert.match(whatsappOnly.hours,/confirmação/);
  assert.equal(StorefrontPolicy.company({...input,whatsappConfirmed:true,whatsapp:'5500000000000'}).canWhatsapp,false);
});

test('demonstration photos are suppressed without blocking uploaded or new external product photos',()=>{
  for(const image of ['assets/hero-madeira.webp','https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=70','javascript:alert(1)','']) assert.equal(StorefrontPolicy.productImage(image),'');
  for(const image of ['uploads/12345678-1234-1234-1234-123456789012.webp','https://images.unsplash.com/photo-real-product?w=600','assets/produtos/tabua.webp']) assert.equal(StorefrontPolicy.productImage(image),image);
});

test('custom campaign edits and company copy remain visible while unchanged seed copy is refined',()=>{
  assert.equal(StorefrontPolicy.company({heroTitle:'A madeira certa para cada projeto.'}).heroTitle,'Portas, tábuas e madeira para sua obra.');
  assert.equal(StorefrontPolicy.company({heroTitle:'Texto da empresa'}).heroTitle,'Texto da empresa');
  const banner={tag:'CATÁLOGO',title:'Madeira para sua obra',body:'Conheça os produtos e solicite seu orçamento.',destination:'#catalogo',cta:'Ver catálogo',image:''};
  assert.equal(StorefrontPolicy.isSeedBanner(banner),true);
  for(const edit of [{body:'Texto revisado'},{cta:'Consultar estoque'},{destination:'https://example.com'},{image:'uploads/photo.webp'},{tag:'NOVIDADE'}]) assert.equal(StorefrontPolicy.isSeedBanner({...banner,...edit}),false);
});
