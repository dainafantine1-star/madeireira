import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {openDatabase} from './fixtures/database.js';
import {createApp} from '../server/index.js';
import {createOwner} from '../server/auth.js';

test('direct administrative mutations require authentication and oversized uploads are rejected',async t=>{
  const db=openDatabase(':memory:');createOwner(db,{email:'review-security@example.test',password:'TemporaryReview12345'});
  const app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));db.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  for(const [method,path] of [['POST','products'],['PUT','products/1'],['DELETE','products/1'],['POST','banners'],['PUT','banners/1'],['DELETE','banners/1?version=1'],['POST','media'],['DELETE','media/temporary'],['PUT','settings']]){
    const response=await fetch(`${base}/api/admin/${path}`,{method,headers:{'Content-Type':'application/json'},body:method==='DELETE'?undefined:'{}'});
    assert.equal(response.status,401,`${method} ${path}`);await response.arrayBuffer();
  }
  const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'review-security@example.test',password:'TemporaryReview12345'})});
  const {token}=await login.json();assert.equal(login.status,200);
  for(const data of ['',Buffer.alloc(3*1024*1024+1).toString('base64')]){
    const response=await fetch(base+'/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:'REVISAO-upload.png',type:'image/png',data})});
    assert.equal(response.status,400);assert.match((await response.json()).error,/3 MB/);
  }
  assert.equal(db.prepare('SELECT count(*) n FROM media').get().n,0);
  const request=async(path,method,data)=>{
    const response=await fetch(base+'/api/admin/'+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:data?JSON.stringify(data):undefined});
    return {status:response.status,data:await response.json()};
  };
  const created=await request('banners','POST',{title:'REVISAO - excluir',image:'assets/hero-madeira.webp',active:true});
  assert.equal(created.status,201);const banner=created.data;
  assert.equal((await request(`banners/${banner.id}?version=${banner.version+1}`,'DELETE')).status,409);
  assert.equal((await request(`banners/${banner.id}?version=${banner.version}`,'DELETE')).status,200);
  assert.equal(db.prepare('SELECT 1 FROM banners WHERE id=?').get(banner.id),undefined);
  const home=db.prepare("SELECT * FROM banners WHERE placement='home'").get();
  assert.equal((await request(`banners/${home.id}?version=${home.version}`,'DELETE')).status,200);
  const cleared=db.prepare('SELECT * FROM banners WHERE id=?').get(home.id);
  assert.equal(cleared.active,0);assert.equal(cleared.image,'');assert.equal(cleared.version,home.version+1);
  assert.equal((await request(`banners/${home.id}`,'PUT',{...cleared,title:'REVISAO - nova arte',image:'assets/hero-madeira.webp',active:true})).status,200);
  assert.equal(db.prepare("SELECT count(*) n FROM audit_log WHERE action='banner_deleted'").get().n,2);
});

test('HTTP login rate limit rejects further attempts without creating sessions',async t=>{
  const db=openDatabase(':memory:'),app=createApp({db});app.listen(0,'127.0.0.1');await once(app,'listening');
  t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));db.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  for(let i=0;i<6;i++){
    const response=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':`192.0.2.${i+1}`},body:JSON.stringify({email:'missing@example.test',password:'InvalidTemporary12345'})});
    assert.equal(response.status,i<5?401:429);if(i===5)assert.ok(Number(response.headers.get('retry-after'))>0);await response.arrayBuffer();
  }
  assert.equal(db.prepare('SELECT count(*) n FROM admin_sessions').get().n,0);
});
