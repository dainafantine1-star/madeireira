const origin=process.env.PUBLIC_ORIGIN||'http://localhost:3000';
const paths=['/api/health','/api/catalog','/','/admin/','/admin/analytics.js','/css/accessibility.css'];
try{
  for(const path of paths){const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);if(!r.headers.get('content-security-policy'))throw Error('CSP ausente.');if(process.env.NODE_ENV==='production'&&(!origin.startsWith('https://')||!r.headers.get('strict-transport-security')))throw Error('HTTPS/HSTS ausentes.');console.log('OK',path);}
  for(const path of ['/server/db.js','/.env','/storage/store.sqlite','/api/admin/metrics','/api/admin/orders','/assets/..%2fserver/auth.js','/css/..%2ftest/store.test.js','/js/%2e%2e%2fserver/backup.js']){const r=await fetch(origin+path,{signal:AbortSignal.timeout(15000)});if(r.status!==404&&r.status!==401)throw Error(`Exposição indevida: ${path}`);console.log('PROTEGIDO',path);}
  const malformed=await fetch(origin+'/assets/%E0%A4%A',{signal:AbortSignal.timeout(15000)});if(malformed.status!==400)throw Error(`URL inválida: esperado HTTP 400, recebido ${malformed.status}`);console.log('OK','URL inválida rejeitada');
}catch(error){console.error(error.message);process.exitCode=1;}
