import { orderDetail,orderList,updateOrder,createQuote } from './orders.js';
import { customerList,customerDetail,saveCustomer } from './customers.js';
import { publicSettings,saveSettings,saveBanner,deleteBanner } from './company.js';
import * as v from './validation.js';

export async function commerce({db,user,req,url,p}){
  const path=url.pathname,method=req.method,ok=data=>({status:200,data});
  if(path==='/api/admin/assignees'&&method==='GET')return ok(await db.all('SELECT id,email FROM admin_users WHERE active=1 ORDER BY is_owner DESC,email'));
  if(path==='/api/admin/orders'&&method==='GET')return ok(await orderList(db,url));
  if(path==='/api/admin/orders'&&method==='POST')return {status:201,data:await createQuote(db,p,{actor:user})};
  const order=path.match(/^\/api\/admin\/orders\/([a-f0-9-]{36})$/);
  if(order&&method==='GET')return ok(await orderDetail(db,order[1]));
  if(order&&method==='PUT')return ok(await updateOrder(db,user,order[1],p));
  if(path==='/api/admin/customers'&&method==='GET')return ok(await customerList(db,url));
  if(path==='/api/admin/customers'&&method==='POST')return {status:201,data:await saveCustomer(db,user,p)};
  const customer=path.match(/^\/api\/admin\/customers\/(\d+)$/);
  if(customer&&method==='GET')return ok(await customerDetail(db,Number(customer[1])));
  if(customer&&method==='PUT')return ok(await saveCustomer(db,user,p,Number(customer[1])));
  if(path==='/api/admin/settings'&&method==='GET'){v.check(user.isOwner||user.role==='admin','Acesso restrito.',403);return ok(await publicSettings(db));}
  if(path==='/api/admin/settings'&&method==='PUT')return ok(await saveSettings(db,user,p));
  if(path==='/api/admin/banners'&&method==='GET')return ok(await db.all('SELECT * FROM banners ORDER BY sort_order,id'));
  if(path==='/api/admin/banners'&&method==='POST')return {status:201,data:await saveBanner(db,user,p)};
  const banner=path.match(/^\/api\/admin\/banners\/(\d+)$/);
  if(banner&&method==='PUT')return ok(await saveBanner(db,user,p,Number(banner[1])));
  if(banner&&method==='DELETE')return ok(await deleteBanner(db,user,Number(banner[1]),Number(url.searchParams.get('version'))));
  return null;
}
