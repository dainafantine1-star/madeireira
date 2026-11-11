import { settings,transaction } from './db.js';
import * as v from './validation.js';
import { audit } from './audit.js';

import { defaults } from './settings-defaults.js';
export async function publicSettings(db){return {...defaults,...await settings(db),version:(await db.get('SELECT version FROM company_settings WHERE id=1')).version};}
export function destination(value){const result=v.text(value,2000);v.check(/^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(result)||(/^\/(?!\/)[a-zA-Z0-9/_?=&%#.-]*$/.test(result)&&!result.startsWith('/api/'))||/^https:\/\/[^\s]+$/.test(result),'Destino deve ser uma seção, caminho da loja ou endereço HTTPS.');if(result.startsWith('https://')){v.check(URL.canParse(result),'Destino inválido.');const u=new URL(result);v.check(!u.username&&!u.password,'Destino inválido.');}return result;}
export async function verifyImage(db,image){v.image(image);if(image.startsWith('uploads/'))v.check(await db.get('SELECT 1 FROM media WHERE filename=?', image.slice(8)),'Imagem inexistente.');return image;}
export async function saveSettings(db,user,input){
  v.check(user.isOwner||user.role==='admin','Acesso restrito.',403);
  return await transaction(db,async()=>{
    const before=await publicSettings(db);if(input.version!==undefined)v.check(before.version===input.version,'As configurações mudaram. Atualize a tela.',409);
    const merged={...before,...input},base=v.company(merged);
    const data={...base};
    for(const key of ['whatsappMessage','region','heroTitle','heroText','aboutTitle','aboutText','footerText'])data[key]=v.text(merged[key],key==='aboutText'?5000:2000,false);
    data.logo=await verifyImage(db,merged.logo);data.heroImage=await verifyImage(db,merged.heroImage);
    v.check(['unavailable','hide'].includes(merged.stockZeroBehavior),'Comportamento de estoque inválido.');data.stockZeroBehavior=merged.stockZeroBehavior;
    data.defaultLowStock=v.integer(merged.defaultLowStock,0,100000000);data.maxQuoteQuantity=v.integer(merged.maxQuoteQuantity,1,10000);data.productColumns=v.integer(merged.productColumns||4,4,8);
    v.check(Array.isArray(merged.benefits)&&merged.benefits.length<=6,'Informe até seis benefícios.');data.benefits=merged.benefits.map(b=>({title:v.text(b.title,100),text:v.text(b.text,300)}));
    await db.run('UPDATE company_settings SET public_json=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=1', JSON.stringify(data));
    await audit(db,user,'company_updated','company',1,before,data);return await publicSettings(db);
  });
}
export async function saveBanner(db,user,input,id){return await transaction(db,async()=>{
  const before=id?await db.get('SELECT * FROM banners WHERE id=?', id):null;if(id){v.check(before,'Banner inexistente.',404);if(input.version!==undefined)v.check(before.version===input.version,'O banner mudou. Atualize a tela.',409);}
  const placement=input.placement??before?.placement??'promotion';
  v.check(['home','promotion'].includes(placement),'Posição de banner inválida.');
  v.check(!before||before.placement===placement,'A posição deste banner não pode ser alterada.');
  const expiresRaw=String(input.expiresAt ?? input.expires_at ?? '').trim();let expiresAt='';if(expiresRaw){const em=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(expiresRaw);v.check(!!em&&Number(em[2])>=1&&Number(em[2])<=12&&Number(em[3])>=1&&Number(em[3])<=31,'Data de expiração inválida.');expiresAt=new Date(expiresRaw).toISOString();}
  const data={placement,tag:v.text(input.tag || '',100,false),title:v.text(input.title),body:v.text(input.body || '',2000,false),image:await verifyImage(db,input.image || ''),image_mobile:await verifyImage(db,input.imageMobile ?? input.image_mobile ?? ''),cta:v.text(input.cta || 'Ver catálogo',100),destination:destination(input.destination || '#catalogo'),sort_order:v.integer(input.sortOrder ?? input.sort_order ?? 0,0,2147483647),active:v.flag(input.active),expires_at:expiresAt};
  const keys=Object.keys(data);if(id)await db.run(`UPDATE banners SET ${keys.map(k=>`${k}=?`).join(',')},version=version+1 WHERE id=?`, ...Object.values(data),id);
  else id=Number((await db.get(`INSERT INTO banners(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')}) RETURNING id`, ...Object.values(data))).id);
  const after=await db.get('SELECT * FROM banners WHERE id=?', id);await audit(db,user,before?'banner_updated':'banner_created','banner',id,before,after);return after;
});}
export async function deleteBanner(db,user,id,version){return await transaction(db,async()=>{
  const before=await db.get('SELECT * FROM banners WHERE id=?', v.integer(id));
  v.check(before,'Banner inexistente.',404);
  v.check(before.version===v.integer(version),'O banner mudou. Atualize a tela.',409);
  // Never delete shared image files here; multiple home banners may be removed freely.
  await db.run('DELETE FROM banners WHERE id=?', id);
  await audit(db,user,'banner_deleted','banner',id,before,{placement:before.placement});
  return {ok:true};
});}
