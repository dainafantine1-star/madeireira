import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { check, email, text } from './validation.js';
import { transaction } from './db.js';
import { audit } from './audit.js';
export const digest = value => createHash('sha256').update(value).digest('hex');
export function hashPassword(password) {
  text(password,200); check(password.length>=12, 'A senha deve ter pelo menos 12 caracteres.');
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
}
export async function createAdmin(db, input) {
  check(['admin','editor'].includes(input.role || 'admin'),'Perfil inválido.');
  // RETURNING id replaces SQLite's lastInsertRowid.
  const row = await db.get('INSERT INTO admin_users(email,password_hash,role) VALUES(?,?,?) RETURNING id', email(input.email), hashPassword(input.password), input.role || 'admin');
  return { id:Number(row.id), email:input.email };
}
export async function login(db, input) {
  const user = await db.get('SELECT * FROM admin_users WHERE email=? AND active=1', email(input.email));
  text(input.password,200); const password = input.password;
  const [salt,expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const actual = scryptSync(password,salt,64);
  check(timingSafeEqual(actual,Buffer.from(expected,'hex')) && !!user, 'Credenciais inválidas.',401);
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now()+8*60*60*1000;
  await db.run('DELETE FROM admin_sessions WHERE expires_at<=?', Date.now());
  await db.run('INSERT INTO admin_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', digest(token),user.id,expiresAt);
  return { token, expiresAt, role:user.role };
}
export async function authorize(db, req, adminOnly = false) {
  const token = sessionToken(req);
  const user = await db.get('SELECT u.id,u.email,u.role,u.is_owner AS "isOwner",s.expires_at AS "expiresAt" FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1', digest(token),Date.now());
  check(user, 'Autenticação necessária.',401); check(!adminOnly || user.isOwner || user.role === 'admin', 'Acesso restrito.',403);
  if (!req.headers.authorization && !['GET','HEAD'].includes(req.method)) check(req.headers['x-csrf-token']===csrfToken(token),'Requisição não autorizada. Atualize a página.',403);
  return user;
}
export function sessionToken(req) {
  if(req.headers.authorization) return /^Bearer [a-f0-9]{64}$/.test(req.headers.authorization) ? req.headers.authorization.slice(7) : '';
  return (req.headers.cookie || '').split(';').map(c=>c.trim()).find(c=>c.startsWith('mp_session='))?.slice(11) || '';
}
export const csrfToken = token => digest(`csrf:${token}`);
export function sessionCookie(token, expiresAt, secure) {
  return `mp_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expiresAt-Date.now())/1000))}${secure?'; Secure':''}`;
}
export async function createOwner(db, input) {
  return await transaction(db,async()=>{
    check(!(await db.get('SELECT 1 FROM admin_users WHERE is_owner=1')),'O proprietário já foi cadastrado.',409);
    const address=email(input.email);const hash=hashPassword(input.password);
    check(!(await db.get('SELECT 1 FROM admin_users WHERE email=?', address)),'Este e-mail já existe. Use outro e-mail para o proprietário.',409);
    const r=await db.get("INSERT INTO admin_users(email,password_hash,role,is_owner) VALUES(?,?,'admin',1) RETURNING id", address,hash);
    const user={id:Number(r.id),email:address};await audit(db,user,'owner_created','user',user.id,null,{email:address,isOwner:true});return user;
  });
}
export async function loginThrottle(db,address,ip) {
  const now=Date.now();await db.run('DELETE FROM login_attempts WHERE reset_at<=?', now);
  for(const key of [digest(`email:${String(address).trim().toLowerCase()}`),digest(`ip:${ip}`)]) {
    const found=await db.get('SELECT attempts FROM login_attempts WHERE key=?', key);
    check(!found || found.attempts<10,'Muitas tentativas. Aguarde 15 minutos.',429);
  }
  for(const key of [digest(`email:${String(address).trim().toLowerCase()}`),digest(`ip:${ip}`)]) await db.run('INSERT INTO login_attempts(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=login_attempts.attempts+1', key,now+900000);
}
