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
  await page.reload();await page.locator('#cartToggle').click();
}

function checkMessage(url){
  const parsed=new URL(url);expect(parsed.origin+parsed.pathname).toBe('https://wa.me/5571999998888');
  const message=parsed.searchParams.get('text');
  for(const text of ['LISTA DE PRODUTOS (3 itens)','SKU: SKU-M2','Referência: REF-M2','SKU: SKU-PORTA','Tábua São José & Cia','2,5 m × 0,3 m × 4','Corte liso','Corte menor','Quantidade: 0,125 m2','Subtotal estimado do item: Sob consulta','142,19'])expect(message).toContain(text);
}
test('one click opens the complete WhatsApp list without form or registration',async({page,context})=>{
  let submissions=0;page.on('request',r=>{if(r.url().endsWith('/api/quotes'))submissions++;});
  await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'<p>Mensagem pronta</p>'}));
  await prepare(page);const popupPromise=page.waitForEvent('popup');await page.locator('#checkoutBtn').click();const popup=await popupPromise;
  await expect(popup).toHaveURL(url=>url.origin==='https://wa.me');checkMessage(popup.url());
  expect(await popup.evaluate(()=>window.opener===null)).toBe(true);
  await expect(page.locator('#quoteDialog')).not.toBeVisible();await expect(page.locator('#quoteForm')).toHaveCount(0);
  const message=new URL(popup.url()).searchParams.get('text');expect(message).not.toMatch(/Protocolo:|Retirada na loja|Nome:|Contato:/);
  expect(submissions).toBe(0);expect(db.prepare('SELECT count(*) n FROM orders').get().n).toBe(0);expect(db.prepare('SELECT count(*) n FROM customers').get().n).toBe(0);await popup.close();
  await expect.poll(()=>db.prepare("SELECT count(*) n FROM events WHERE name='whatsapp_click' AND origin='quote_continue'").get().n).toBeGreaterThan(0);
});
test('blocked popup redirects the current page directly to WhatsApp',async({page,context})=>{
  await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'Mensagem pronta'}));
  await prepare(page);await page.evaluate(()=>{window.open=()=>null;});await page.locator('#checkoutBtn').click();
  await expect(page).toHaveURL(url=>url.origin==='https://wa.me');checkMessage(page.url());
});
test('extensive lists keep every item available to copy without collecting personal data',async({page})=>{
  await page.addInitScript(()=>{window.open=url=>{window.openedUrl=url;return {opener:null};};Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedQuote=text;}}});});
  await prepare(page);
  await page.evaluate(id=>localStorage.setItem('mp_cart_v1',JSON.stringify(Array.from({length:40},(_,i)=>({id,qty:1,lineKey:'L'+i,specifications:'Detalhes do corte '.repeat(50)+(i===39?'ÚLTIMO ITEM':'')})))),consultation.id);
  await page.reload();await page.locator('#cartToggle').click();await page.locator('#checkoutBtn').click();
  await expect(page.locator('#quoteDialog')).toBeVisible();await expect(page.locator('#quoteFullMessage')).toHaveValue(/ÚLTIMO ITEM/);
  expect(await page.evaluate(()=>window.openedUrl)).toBe('https://wa.me/5571999998888');
  await expect(page.locator('#quoteDialog input,#quoteDialog select')).toHaveCount(0);
  await page.getByRole('button',{name:'Copiar lista completa'}).click();expect(await page.evaluate(()=>window.copiedQuote)).toContain('ÚLTIMO ITEM');
});
