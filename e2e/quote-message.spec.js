import { test,expect } from '@playwright/test';
import { once } from 'node:events';
import { openDatabase,settings } from '../server/db.js';
import { createApp } from '../server/index.js';
import { createOwner } from '../server/auth.js';
import { saveProduct } from '../server/products.js';
let db,app,base,product,consultation;
test.beforeAll(async()=>{
  db=openDatabase(':memory:');const owner=createOwner(db,{email:'quote@example.test',password:'QuoteBrowserTest123'});
  db.prepare('UPDATE company_settings SET public_json=?').run(JSON.stringify({...settings(db),confirmed:false,whatsappConfirmed:true,whatsapp:'5571999998888'}));
  product=saveProduct(db,owner,{name:'Tábua São José & Cia',sku:'SKU-M2',reference:'REF-M2',category:'tabuas',unit:'m2',price:45.5,specs:{Madeira:'Cedro'}});
  consultation=saveProduct(db,owner,{name:'Porta sob consulta',sku:'SKU-PORTA',category:'portas',unit:'un',price:null,specs:{Acabamento:'Natural'}});
  app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');base=`http://127.0.0.1:${app.address().port}`;
});
test.afterAll(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));db.close();});
async function prepare(page){
  await page.goto(base);await expect(page.locator('#productsGrid .product')).toHaveCount(2);
  await page.evaluate(({product,consultation})=>localStorage.setItem('mp_cart_v1',JSON.stringify([
    {id:product,qty:3,lineKey:'A',measurement:{length:2.5,width:0.3,pieces:4},measures:'2,5 m × 0,3 m × 4',specifications:'Corte liso'},
    {id:product,qty:0.125,lineKey:'B',measures:'Corte menor'},
    {id:consultation,qty:2,lineKey:'C'}
  ])),{product:product.id,consultation:consultation.id});
  await page.reload();await page.locator('#cartToggle').click();await page.locator('#checkoutBtn').click();
  await page.locator('#quoteForm [name=name]').fill('João & Maria');await page.locator('#quoteForm [name=phone]').fill('71988887777');
  await page.locator('#quoteForm [name=email]').fill('cliente@example.test');await page.locator('#quoteForm [name=fulfillment]').selectOption('delivery');
  await page.locator('#quoteForm [name=deliveryAddress]').fill('Rua São José, 10');await page.locator('#quoteForm [name=notes]').fill('Avisar antes & entregar à tarde.');
}
function checkMessage(url){
  const parsed=new URL(url);expect(parsed.origin+parsed.pathname).toBe('https://wa.me/5571999998888');
  const message=parsed.searchParams.get('text');
  for(const text of ['LISTA DE PRODUTOS (3 itens)','SKU: SKU-M2','Referência: REF-M2','SKU: SKU-PORTA','Tábua São José & Cia','2,5 m × 0,3 m × 4','Corte liso','Corte menor','Quantidade: 0,125 m2','Subtotal estimado do item: Sob consulta','142,19','João & Maria','cliente@example.test','Rua São José, 10','Avisar antes & entregar à tarde.'])expect(message).toContain(text);
}
test('submit opens WhatsApp with the entire multi-product report',async({page,context})=>{
  await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'<p>Mensagem pronta para envio</p>'}));
  await prepare(page);const popupPromise=page.waitForEvent('popup');await page.locator('#quoteSubmit').click();const popup=await popupPromise;
  await expect(popup).toHaveURL(/^https:\/\/wa.me\//);checkMessage(popup.url());
  expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
  await expect(page.locator('#quoteProtocol')).toContainText('MP-');checkMessage(await page.locator('#quoteWhats').getAttribute('href'));
  await popup.close();
});
test('API errors close reserved tab; retry and popup blocking retain full WhatsApp link',async({page})=>{
  await page.addInitScript(()=>{window.quoteTabs=[];window.open=()=>{const tab={closed:false,close(){this.closed=true;},location:{replace(url){window.quoteDestination=url;}}};window.quoteTabs.push(tab);return tab;};});
  await prepare(page);await page.route('**/api/quotes',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Falha temporária. Tente novamente.'})}));
  await page.locator('#quoteSubmit').click();await expect(page.locator('#quoteError')).toContainText('Falha temporária');
  expect(await page.evaluate(()=>window.quoteTabs[0].closed)).toBe(true);await expect(page.locator('#quoteSubmit')).toBeEnabled();
  await page.unroute('**/api/quotes');await page.evaluate(()=>{window.open=()=>null;});
  await page.locator('#quoteSubmit').click();await expect(page.locator('#quoteWhats')).toBeVisible();checkMessage(await page.locator('#quoteWhats').getAttribute('href'));
  await expect(page.locator('#quoteWhatsappStatus')).toContainText('use o botão abaixo');
});

test('long reports retain the entire message for copying and open the configured conversation',async({page})=>{
  await page.addInitScript(()=>{window.open=()=>null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedQuote=text;}}});});
  await prepare(page);
  const message='Orçamento completo\nSKU: MADEIRA-001\n'+'Corte de madeira com medidas: 2,5 × 0,3 m\n'.repeat(1000)+'ÚLTIMO ITEM';
  await page.route('**/api/quotes',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({protocol:'MP-LISTA-LONGA',whatsapp:'5575992222895',message})}));
  await page.locator('#quoteSubmit').click();
  await expect(page.locator('#quoteFullMessage textarea')).toHaveValue(message);
  await expect(page.locator('#quoteWhats')).toHaveAttribute('href','https://wa.me/5575992222895');
  await expect(page.locator('#quoteWhatsappStatus')).toContainText('Copie a lista completa');
  await page.getByRole('button',{name:'Copiar lista completa'}).click();
  expect(await page.evaluate(()=>window.copiedQuote)).toBe(message);
});
