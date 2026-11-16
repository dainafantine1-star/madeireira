import { randomUUID,createHash } from 'node:crypto';
import { transaction,settings } from './db.js';
import * as v from './validation.js';
import { attachPublicCustomer,customerInput } from './customers.js';
import { audit } from './audit.js';
import '../shared/measurement.js';
const money=cents=>cents===null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const stages={received:'Recebido',in_progress:'Em atendimento',awaiting_approval:'Aguardando aprovação',approved:'Aprovado',completed:'Concluído',cancelled:'Cancelado'};
const transitions={received:['in_progress','cancelled'],in_progress:['awaiting_approval','cancelled'],awaiting_approval:['in_progress','approved','cancelled'],approved:['in_progress','completed','cancelled'],completed:[],cancelled:[]};
export async function createQuote(db,input,{actor=null}={}) {
  const requestKey=v.text(input.requestKey,100);v.check(/^[a-zA-Z0-9-]{16,100}$/.test(requestKey),'Chave de solicitação inválida.');
  v.check(Array.isArray(input.items)&&input.items.length>=1&&input.items.length<=100,'Informe de 1 a 100 itens.');
  const seen=new Set();const items=[];
  for(const i of input.items){
    v.check(i&&typeof i==='object','Item inválido.');v.integer(i.id);v.check(typeof i.qty==='number'&&Number.isFinite(i.qty)&&i.qty>0&&i.qty<=10000&&Math.abs(i.qty*1000-Math.round(i.qty*1000))<0.000001,'Quantidade inválida.');
    const lineKey=v.text(i.lineKey || `p${i.id}`,80);v.check(/^[a-zA-Z0-9-]+$/.test(lineKey),'Identificador de item inválido.');v.check(!seen.has(lineKey),'Item duplicado.');seen.add(lineKey);
    let measurement=null;
    if(i.measurement!==undefined&&i.measurement!==null){
      const row=await db.get('SELECT unit FROM products WHERE id=?', i.id);v.check(row,'Produto indisponível.',409);
      try{const result=WoodMeasure.calculate(row.unit,i.measurement);measurement=result.dimensions;v.check(result.qty===Math.round(i.qty*1000)/1000,'A metragem mudou. Refaça o cálculo antes de enviar.');}catch(error){throw new v.HttpError(400,error.message);}
    }
    items.push({id:i.id,qty:Math.round(i.qty*1000)/1000,lineKey,measurement,measures:v.text(i.measures || '',500,false),specifications:v.text(i.specifications || '',1000,false)});
  }
  items.sort((a,b)=>a.lineKey.localeCompare(b.lineKey));
  let contact;
  if(actor&&input.customerId){const c=await db.get('SELECT * FROM customers WHERE id=?', v.integer(input.customerId));v.check(c,'Cliente inexistente.',404);contact=customerInput(c);}
  else {
    v.check(input.customer&&typeof input.customer==='object'&&!Array.isArray(input.customer),'Informe seu nome e contato para receber atendimento.');
    // The public form needs contact only; documents and internal CRM notes are never accepted here.
    contact=customerInput(actor?input.customer:{name:input.customer.name,phone:input.customer.phone,email:input.customer.email});
  }
  const fulfillment=input.fulfillment || 'pickup';v.check(['pickup','delivery'].includes(fulfillment),'Escolha retirada ou entrega.');
  const address=v.text(input.deliveryAddress || '',1000,false);v.check(fulfillment!=='delivery'||address,'Informe o endereço para entrega.');const notes=v.text(input.notes || '',2000,false);
  if(fulfillment==='delivery'&&!contact.address)contact.address=address;
  const fingerprint=createHash('sha256').update(JSON.stringify({items,contact,fulfillment,address,notes})).digest('hex');
  return await transaction(db,async()=>{
    const previous=await db.get('SELECT * FROM orders WHERE request_key=?', requestKey);
    if(previous){v.check(previous.fingerprint===fingerprint,'A chave já foi usada em outra solicitação.',409);return await quoteResponse(db,previous.id);}
    const company=await settings(db),totals=new Map();
    const lines=[];
    for(const i of items){
      const p=await db.get("SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.active=1 AND p.deleted_at IS NULL AND p.unit IS NOT NULL AND p.status!='unavailable' AND (p.stock_milli IS NULL OR p.stock_milli>0) AND c.active=1", i.id);
      v.check(p,'Produto indisponível. Atualize o catálogo.',409);v.quantity(i.qty,p.unit,company.maxQuoteQuantity);
      if(i.measurement){const calculated=WoodMeasure.calculate(p.unit,i.measurement);v.check(calculated.qty===i.qty,'Unidade ou medidas alteradas. Refaça o cálculo.',409);i.measures=calculated.formula;}
      totals.set(p.id,(totals.get(p.id)||0)+Math.round(i.qty*1000));v.check(p.stock_milli===null||p.stock_milli>=totals.get(p.id),'Quantidade maior que o estoque disponível. Atualize seu orçamento.',409);
      lines.push({...p,...i,productId:p.id});
    }
    const customer=actor&&input.customerId?{id:input.customerId,snapshot:contact}:await attachPublicCustomer(db,contact);
    const id=randomUUID(),date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bahia'}).format(new Date()).replaceAll('-','');
    const protocol=`MP-${date}-${id.replaceAll('-','').slice(0,12).toUpperCase()}`;
    const total=lines.reduce((n,p)=>n+(p.price_cents===null?0:Math.round(p.price_cents*p.qty)),0),hasConsultation=lines.some(p=>p.price_cents===null);
    const terms=`${company.commercialTerms}\nEntrega: ${company.delivery}\nRegião: ${company.region}\nPagamento: ${company.payment}`;
    await db.run("INSERT INTO orders(id,request_key,customer_id,kind,known_total_cents,has_consultation,terms_snapshot,protocol,source,customer_snapshot,fulfillment,delivery_address,notes,fingerprint) VALUES(?,?,?,'quote',?,?,?,?,?,?,?,?,?,?)", id,requestKey,customer.id,total,Number(hasConsultation),terms,protocol,actor?'admin':'storefront',JSON.stringify(customer.snapshot),fulfillment,address,notes,fingerprint);
    for(const p of lines) await db.run('INSERT INTO order_items(order_id,product_id,line_key,reference_snapshot,name_snapshot,specs_snapshot,terms_snapshot,unit_price_cents,quantity,unit_snapshot,custom_measures,custom_specs,calculation_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', id,p.productId,p.lineKey,p.reference,p.name,JSON.stringify({...JSON.parse(p.specs_json),SKU:p.sku,Dimensões:p.dimensions || 'Sob consulta',Comprimento:p.length_mm==null?'Sob consulta':`${p.length_mm} mm`,...(p.unit==='none'?{}:{'Unidade de cobrança':p.unit})}),p.commercial_terms,p.price_cents,p.qty,p.unit,p.measures,p.specifications,p.measurement?JSON.stringify(p.measurement):null);
    await db.run("INSERT INTO order_history(order_id,actor_id,action,to_stage,note) VALUES(?,?,'created','received',?)", id,actor?.id || null,actor?'Cadastro pela equipe.':'Solicitação registrada pela loja.');
    await db.run("INSERT INTO events(name,order_id) VALUES('quote_created',?)", id);
    if(actor)await audit(db,actor,'quote_created','order',id,null,{protocol,customerId:customer.id,total});
    return await quoteResponse(db,id);
  });
}
export async function quoteResponse(db,id){
  const order=await db.get('SELECT * FROM orders WHERE id=?', id),items=await db.all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', id),contact=JSON.parse(order.customer_snapshot);
  let message=`${await settings(db).whatsappMessage}\nSolicitação de orçamento registrada.\nProtocolo: ${order.protocol}\nNome: ${contact.name || ''}\nContato: ${contact.phone || ''}${contact.email?'\nE-mail: '+contact.email:''}\n\nLISTA DE PRODUTOS (${items.length} itens)\n\n`;
  for(const [index,i] of items.entries()){
    const specs=JSON.parse(i.specs_snapshot);
    message+=`Item ${index+1}: ${i.name_snapshot}\nSKU: ${specs.SKU || 'Não informado'}\nReferência: ${i.reference_snapshot}\nMedidas/especificações: ${Object.entries(specs).filter(([key])=>key!=='SKU').map(([k,v])=>`${k}: ${v}`).join('; ')}\nMedidas solicitadas: ${i.custom_measures || 'Conforme catálogo'}\nEspecificações solicitadas: ${i.custom_specs || 'Conforme catálogo'}\nQuantidade: ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(i.quantity)}${i.unit_snapshot==='none'?'':' '+i.unit_snapshot}\nPreço unitário estimado: ${money(i.unit_price_cents)}\nSubtotal estimado do item: ${money(i.unit_price_cents===null?null:Math.round(i.unit_price_cents*i.quantity))}\nCondição comercial: ${i.terms_snapshot}\n\n`;
  }
  message+=order.has_consultation&&order.known_total_cents===0?'Total: Sob consulta':`${order.has_consultation?'Subtotal dos itens com preço':'Total estimado'}: ${money(order.known_total_cents)}`;
  message+=`${order.has_consultation?'\nHá itens sob consulta; total final a confirmar.':''}\n${order.fulfillment==='delivery'?'Entrega: '+order.delivery_address:'Retirada na loja'}${order.notes?'\nObservações: '+order.notes:''}\n${order.terms_snapshot}\nAguardando confirmação da equipe.`;
  const company=await settings(db);return {id,protocol:order.protocol,message,total:order.has_consultation?null:order.known_total_cents/100,knownSubtotal:order.known_total_cents/100,hasConsultation:!!order.has_consultation,whatsapp:company.whatsapp,registered:true};
}
export async function orderDetail(db,id){const order=await db.get('SELECT o.*,u.email AS assignee_email FROM orders o LEFT JOIN admin_users u ON u.id=o.assigned_to WHERE o.id=?', id);v.check(order,'Solicitação inexistente.',404);return {...order,customer:JSON.parse(order.customer_snapshot),items:await db.all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', id),history:await db.all('SELECT h.*,u.email AS actor_email FROM order_history h LEFT JOIN admin_users u ON u.id=h.actor_id WHERE order_id=? ORDER BY h.id', id),allowedTransitions:transitions[order.stage]};}
export async function orderList(db,url){
  const q=url.searchParams,page=v.integer(Number(q.get('page')||1),1,100000),where=['1=1'],args=[];
  if(q.get('q')){const term='%'+v.text(q.get('q'),200).replace(/[\\%_]/g,'\\$&')+'%';where.push("(o.protocol LIKE ? ESCAPE '\\' OR o.customer_snapshot LIKE ? ESCAPE '\\')");args.push(term,term);}
  if(q.get('stage')){v.check(Object.hasOwn(stages,q.get('stage')),'Estágio inválido.');where.push('o.stage=?');args.push(q.get('stage'));}
  if(q.get('assigned')){if(q.get('assigned')==='none')where.push('o.assigned_to IS NULL');else{where.push('o.assigned_to=?');args.push(v.integer(Number(q.get('assigned'))));}}
  const clause=where.join(' AND ');return {items:await db.all(`SELECT o.*,u.email AS assignee_email FROM orders o LEFT JOIN admin_users u ON u.id=o.assigned_to WHERE ${clause} ORDER BY o.created_at DESC,o.id LIMIT 20 OFFSET ?`, ...args,(page-1)*20),total:(await db.get(`SELECT count(*) AS n FROM orders o WHERE ${clause}`, ...args)).n,page,stages};
}
export async function updateOrder(db,user,id,input){return await transaction(db,async()=>{
  const before=await orderDetail(db,id);v.check(input.version===before.version,'O atendimento mudou. Atualize a tela.',409);
  v.check(!['completed','cancelled'].includes(before.stage),'Atendimento encerrado não pode ser alterado.',409);
  const stage=input.stage || before.stage;v.check(Object.hasOwn(stages,stage),'Estágio inválido.');if(stage!==before.stage)v.check(transitions[before.stage].includes(stage),'Transição de estágio não permitida.',409);
  const assigned=input.assignedTo===undefined?before.assigned_to:input.assignedTo;
  if(assigned!==null)v.check(await db.get('SELECT 1 FROM admin_users WHERE id=? AND active=1', v.integer(assigned)),'Responsável indisponível.');
  const final=input.finalTotal===undefined?before.final_total_cents:v.money(input.finalTotal);
  if(before.stage==='approved'&&final!==before.final_total_cents)v.check(stage==='in_progress','Retorne a Em atendimento para renegociar um valor já aprovado.',409);
  v.check(!['approved','completed'].includes(stage)||final!==null,'Informe o valor fechado antes de aprovar.');
  v.check(stage!=='completed'||assigned!==null,'Atribua um responsável antes de concluir.');
  const note=v.text(input.note || '',2000,false);v.check(stage!=='cancelled'||note,'Informe o motivo do cancelamento.');
  if(input.customerId!==undefined){v.integer(input.customerId);v.check(await db.get('SELECT 1 FROM customers WHERE id=?', input.customerId),'Cliente inexistente.');}
  const status={received:'pending',in_progress:'negotiating',awaiting_approval:'negotiating',approved:'confirmed',completed:'completed',cancelled:'cancelled'}[stage];
  await db.run("UPDATE orders SET stage=?,status=?,kind=?,assigned_to=?,final_total_cents=?,customer_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP,completed_at=CASE WHEN ?='completed' THEN to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') ELSE completed_at END,cancelled_at=CASE WHEN ?='cancelled' THEN to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') ELSE cancelled_at END WHERE id=?", stage,status,['approved','completed'].includes(stage)?'order':'quote',assigned,final,input.customerId ?? before.customer_id,stage,stage,id);
  await db.run('INSERT INTO order_history(order_id,actor_id,action,from_stage,to_stage,note,data_json) VALUES(?,?,?,?,?,?,?)', id,user.id,stage===before.stage?'updated':'stage_changed',before.stage,stage,note,JSON.stringify({assignedTo:assigned,finalTotalCents:final,previousFinalTotalCents:before.final_total_cents}));
  await audit(db,user,'order_updated','order',id,{stage:before.stage,assignedTo:before.assigned_to,finalTotalCents:before.final_total_cents},{stage,assignedTo:assigned,finalTotalCents:final,note});return await orderDetail(db,id);
});}
