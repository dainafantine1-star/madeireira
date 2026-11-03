import { test,expect } from '@playwright/test';
import { once } from 'node:events';
import { openDatabase,settings } from '../server/db.js';
import { createApp } from '../server/index.js';
import { createOwner } from '../server/auth.js';
import { saveProduct } from '../server/products.js';

test('cart edits persist and WhatsApp reflects only the latest items and totals',async({page,context})=>{
  const db=openDatabase(':memory:');
  const owner=createOwner(db,{email:'review@example.test',password:'ReviewTemporary12345'});
  db.prepare('UPDATE company_settings SET public_json=?').run(JSON.stringify({...settings(db),whatsapp:'5571999998888',whatsappConfirmed:true}));
  const first=saveProduct(db,owner,{name:'Revisão São José & Cia',sku:'REV-001',reference:'REF-001',category:'tabuas',unit:'un',price:12.35});
  const second=saveProduct(db,owner,{name:'Revisão item removido',sku:'REV-002',category:'tabuas',unit:'un',price:20});
  const app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');
  const base=`http://127.0.0.1:${app.address().port}`,errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://wa.me/**',route=>route.fulfill({contentType:'text/html',body:'Teste sem envio'}));
  try{
    await page.goto(base);await expect(page.locator('#productsGrid .product')).toHaveCount(2);
    const add=id=>page.locator(`.product[data-id="${id}"] [data-add]`).click();
    await add(first.id);await add(first.id);await page.locator('#cartToggle').click();
    await expect(page.locator('#cartItems article')).toHaveCount(1);
    await expect(page.locator('[data-qty]')).toHaveValue('2');
    await expect(page.locator('.cart-item-subtotal')).toContainText('24,70');
    await page.locator('[data-qty-inc]').click();await expect(page.locator('#cartTotal')).toContainText('37,05');
    await page.locator('[data-qty-dec]').click();
    for(const invalid of ['0','-1','1.5','10001']){
      await page.locator('[data-qty]').fill(invalid);await page.locator('[data-qty]').dispatchEvent('change');
      await expect(page.locator('[data-qty]')).toHaveValue('2');
    }
    await page.locator('#cartClose').click();await add(second.id);await page.locator('#cartToggle').click();
    await expect(page.locator('#cartTotal')).toContainText('44,70');
    await page.locator(`[aria-label="Remover ${second.name}"]`).click();
    await page.reload();await page.locator('#cartToggle').click();
    await expect(page.locator('#cartItems article')).toHaveCount(1);await expect(page.locator('#cartTotal')).toContainText('24,70');
    const popupPromise=page.waitForEvent('popup');await page.locator('#checkoutBtn').click();const popup=await popupPromise;
    await expect(popup).toHaveURL(url=>url.origin==='https://wa.me');
    const url=new URL(popup.url()),message=url.searchParams.get('text');
    expect(url.pathname).toBe('/5571999998888');
    for(const text of [first.name,'SKU: REV-001','Referência: REF-001','Quantidade: 2 un','12,35','24,70','\n'])expect(message).toContain(text);
    expect(message).not.toContain(second.name);expect(message).not.toContain('REV-002');await popup.close();
    await page.locator('#cartToggle').click();await page.locator('[data-remove]').click();
    await expect(page.locator('#cartItems')).toContainText('Sua lista está vazia');await expect(page.locator('#checkoutBtn')).toBeDisabled();
    db.prepare("UPDATE products SET price_cents=29,unit='m' WHERE id=?").run(first.id);
    await page.evaluate(id=>localStorage.setItem('mp_cart_v1',JSON.stringify([{id,qty:0.5}])),first.id);
    await page.reload();await page.locator('#cartToggle').click();
    await expect(page.locator('.cart-item-subtotal')).toContainText('0,15');
    await expect(page.locator('#cartTotal')).toContainText('0,15');
    const roundedPopup=page.waitForEvent('popup');await page.locator('#checkoutBtn').click();const rounded=await roundedPopup;
    await expect(rounded).toHaveURL(url=>url.origin==='https://wa.me');
    expect(new URL(rounded.url()).searchParams.get('text')).toContain('0,15');await rounded.close();
    expect(errors).toEqual([]);
  }finally{app.closeAllConnections();await new Promise(r=>app.close(r));db.close();}
});
