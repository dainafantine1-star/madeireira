import { transaction } from './db.js';
import * as v from './validation.js';
import { audit } from './audit.js';

export function phoneKey(value){const raw=v.text(value,40).replace(/\D/g,'');const phone=/^\d{10,11}$/.test(raw)?'55'+raw:raw;v.check(/^55[1-9]{2}[1-9]\d{7,8}$/.test(phone),'Informe telefone com DDD válido.');return phone;}
export function customerInput(input){return {name:v.text(input.name),phone:phoneKey(input.phone),email:input.email?v.email(input.email):null,address:v.text(input.address || '',1000,false),notes:v.text(input.notes || '',2000,false),document:v.text(input.document || '',30,false)};}
export async function findContact(db,input,exclude=0){
  let matches=await db.all('SELECT * FROM customers WHERE id!=? AND (phone_key=? OR (email IS NOT NULL AND lower(email)=lower(?))) ORDER BY id', exclude,input.phone,input.email);
  // Existing customer records predate normalized phones. Match them without rewriting their history.
  const legacy=(await db.all('SELECT * FROM customers WHERE id!=? AND phone_key IS NULL AND phone IS NOT NULL', exclude)).filter(c=>{try{return phoneKey(c.phone)===input.phone;}catch{return false;}});
  return [...new Map([...matches,...legacy].map(c=>[c.id,c])).values()];
}
export async function attachPublicCustomer(db,input){
  const data=customerInput(input),matches=await findContact(db,data);
  v.check(matches.length<=1,'Há divergência entre os contatos informados. Confira telefone e e-mail.',409);
  if(matches.length)return {id:matches[0].id,snapshot:data}; // Unverified public input never overwrites an existing profile.
  const result=await db.get("INSERT INTO customers(name,phone,phone_key,email,address,notes,document,updated_at) VALUES(?,?,?,?,?,?,?,to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) RETURNING id", data.name,data.phone,data.phone,data.email,data.address,'',data.document);
  return {id:Number(result.id),snapshot:data};
}
export async function saveCustomer(db,user,input,id){return await transaction(db,async()=>{
  const before=id?await db.get('SELECT * FROM customers WHERE id=?', v.integer(id)):null;if(id){v.check(before,'Cliente inexistente.',404);if(input.version!==undefined)v.check(input.version===before.version,'Cliente alterado. Atualize o cadastro.',409);}
  const data=customerInput(input),matches=await findContact(db,data,id);v.check(!matches.length,'Já existe cliente com esse telefone ou e-mail. Localize o cadastro antes de continuar.',409);
  if(id)await db.run('UPDATE customers SET name=?,phone=?,phone_key=?,email=?,address=?,notes=?,document=?,version=version+1,contact_verified=1,updated_at=CURRENT_TIMESTAMP WHERE id=?', data.name,data.phone,data.phone,data.email,data.address,data.notes,data.document,id);
  else id=Number((await db.get("INSERT INTO customers(name,phone,phone_key,email,address,notes,document,contact_verified,updated_at) VALUES(?,?,?,?,?,?,?,1,to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')) RETURNING id", data.name,data.phone,data.phone,data.email,data.address,data.notes,data.document)).id);
  const after=await db.get('SELECT * FROM customers WHERE id=?', id);await audit(db,user,before?'customer_updated':'customer_created','customer',id,before,after);return after;
});}
export async function customerList(db,url){const q=v.text(url.searchParams.get('q') || '',200,false),page=v.integer(Number(url.searchParams.get('page') || 1),1,100000),pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  const clause="WHERE name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR document LIKE ? ESCAPE '\\'";const args=[pattern,pattern,pattern,pattern];
  return {items:await db.all(`SELECT * FROM customers ${clause} ORDER BY updated_at DESC,id DESC LIMIT 20 OFFSET ?`, ...args,(page-1)*20),total:(await db.get(`SELECT count(*) AS n FROM customers ${clause}`, ...args)).n,page};}
export async function customerDetail(db,id){const customer=await db.get('SELECT * FROM customers WHERE id=?', v.integer(id));v.check(customer,'Cliente inexistente.',404);return {...customer,orders:await db.all('SELECT id,protocol,stage,kind,known_total_cents,has_consultation,final_total_cents,created_at,updated_at FROM orders WHERE customer_id=? ORDER BY created_at DESC', id)};}
