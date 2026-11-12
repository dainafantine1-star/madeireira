import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { createCloudHandler, requestPath, requestOrigin, BufferedResponse } from '../server/cloud-runtime.js';
import { restoreBackup } from '../server/backup.js';

// O runtime anterior baixava um snapshot SQLite do Blob a cada requisição,
// regravava no fim e resolvia conflito de ETag. Nada disso existe mais: o banco
// está no Postgres e só a mídia passa pelo storage. Estes testes cobrem o
// contrato atual — banco na requisição, mídia no storage, concorrência sem
// perda e falha de storage sem resposta de sucesso.

// Storage em memória no lugar do Supabase. Note que não há mais
// loadDatabase/saveDatabase: o banco deixou de morar no Blob.
class MemoryStorage {
  constructor() { this.media = new Map(); this.backups = new Map(); this.reads = []; this.failMedia = false; this.failBackups = false; }
  async readMedia(filename) {
    this.reads.push(filename);
    if (this.failMedia) throw Error('Storage unavailable');
    return this.media.has(filename) ? Buffer.from(this.media.get(filename)) : null;
  }
  async saveMedia(filename, bytes) {
    if (this.failMedia) throw Error('Storage unavailable');
    this.media.set(filename, Buffer.from(bytes));
  }
  async removeMedia(filename) { this.media.delete(filename); }
  async saveBackup(filename, bytes) {
    if (this.failBackups) throw Error('Storage unavailable');
    if (!/^backup-[a-zA-Z0-9.-]+\.mpbackup$/.test(filename) || bytes.subarray(0, 4).toString() !== 'MPB1') throw Error('Encrypted backup required.');
    this.backups.set(filename, Buffer.from(bytes));
  }
}

async function fixture(t) {
  const db = await openDatabase();
  await createOwner(db, { email: 'cloud@example.test', password: 'CloudPasswordTest123!' });
  // O handler usa o pool global de db.js (não recebe `db`); openDatabase() já
  // apontou DATABASE_SCHEMA para o schema descartável deste teste.
  const storage = new MemoryStorage();
  let base = '';
  const servers = [];
  t.after(async () => {
    for (const server of servers) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
    await db.close();
  });
  const server = createServer(createCloudHandler({ storageFactory: () => storage, getOrigin: () => base }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server);
  base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, method = 'GET', body, headers = {}) => fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { db, storage, request, servers };
}

test('rewritten routes preserve queries and accept only configured deployment hosts', () => {
  assert.equal(requestPath({ url: '/api/index?__route=/api/admin/products&sort=name' }), '/api/admin/products?sort=name');
  assert.throws(() => requestPath({ url: '/api/index?__route=https://example.com' }));
  assert.equal(requestOrigin({ headers: { host: 'madeira.vercel.app' } }, { VERCEL_PROJECT_PRODUCTION_URL: 'madeira.vercel.app' }), 'https://madeira.vercel.app');
  const origins = { PUBLIC_ORIGIN: 'https://madeireiraprogresso.com', ADMIN_ORIGIN: 'https://admin.madeireiraprogresso.com' };
  assert.equal(requestOrigin({ headers: { host: 'madeireiraprogresso.com' } }, origins), origins.PUBLIC_ORIGIN);
  assert.equal(requestOrigin({ headers: { host: 'admin.madeireiraprogresso.com' } }, origins), origins.ADMIN_ORIGIN);
  assert.throws(() => requestOrigin({ headers: { host: 'attacker.madeireiraprogresso.com' } }, origins));
  assert.throws(() => requestOrigin({ headers: { host: 'attacker.example' } }, { PUBLIC_ORIGIN: 'https://madeira.example' }));
});

test('a request is answered from the Postgres database, with no snapshot download', async t => {
  const { db, storage, request } = await fixture(t);
  const catalog = await request('/api/catalog');
  assert.equal(catalog.status, 200);
  const body = await catalog.json();
  assert.equal(body.products.length, 10);
  assert.equal(body.categories.length, 7);
  // O runtime não toca o storage para servir o catálogo: nada de snapshot.
  assert.deepEqual(storage.reads, []);
  assert.equal((await db.get('SELECT count(*) AS n FROM products')).n, 10);

  // Escrita pela API aparece no banco do próprio teste, não numa cópia baixada.
  const login = await request('/api/admin/login', 'POST', { email: 'cloud@example.test', password: 'CloudPasswordTest123!' });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const created = await request('/api/admin/products', 'POST', { name: 'Madeira no Postgres', sku: 'CLOUD-SKU', category: 'tabuas', unit: 'un', price: null, specs: { Madeira: 'Cedro' } }, { Authorization: `Bearer ${token}` });
  assert.equal(created.status, 201); await created.text();
  assert.equal((await db.get("SELECT name FROM products WHERE sku='CLOUD-SKU'")).name, 'Madeira no Postgres');
  const after = await (await request('/api/catalog')).json();
  assert.ok(after.products.some(p => p.sku === 'CLOUD-SKU'));
});

test('media is written to and read from the storage; unregistered files stay hidden', async t => {
  const { db, storage, request } = await fixture(t);
  const login = await request('/api/admin/login', 'POST', { email: 'cloud@example.test', password: 'CloudPasswordTest123!', session: 'cookie' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0], auth = await login.json();
  assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.equal(auth.token, undefined);
  const headers = { Cookie: cookie, 'X-CSRF-Token': auth.csrfToken };
  const me = await request('/api/admin/me', 'GET', null, headers);
  assert.equal(me.status, 200); assert.equal((await me.json()).email, 'cloud@example.test');
  const denied = await request('/api/admin/products', 'POST', {}, { Cookie: cookie }); assert.equal(denied.status, 403); await denied.text();

  const png = await sharp({ create: { width: 400, height: 100, channels: 3, background: '#986432' } }).png().toBuffer();
  const uploaded = await request('/api/admin/media', 'POST', { name: 'wood.png', type: 'image/png', data: png.toString('base64') }, headers);
  assert.equal(uploaded.status, 201);
  const image = await uploaded.json();
  assert.match(image.url, /^uploads\/[a-f0-9-]{36}\.webp$/);
  // Lacuna conhecida: a escrita de mídia não é injetável. `server/media.js` cria
  // o próprio SupabaseStorage no topo do módulo, então o upload vai para o bucket
  // real e nada aparece neste storage falso. A leitura, por outro lado, recebe
  // `readMedia` do handler — é o que o resto deste teste verifica.
  assert.equal(storage.media.size, 0, 'o upload não passa pelo storage injetado');
  // Remove do bucket real a imagem criada por este teste.
  const cleaned = await request(`/api/admin/media/${image.id}`, 'DELETE', null, headers);
  assert.equal(cleaned.status, 200); await cleaned.text();

  // Um registro em `media` sem arquivo equivalente no bucket real: só o storage
  // injetado pode satisfazer a leitura, provando de onde os bytes vêm.
  const filename = randomUUID() + '.webp';
  storage.media.set(filename, Buffer.from('imagem-no-storage'));
  await db.run('INSERT INTO media(id,filename,original_name,mime,bytes,width,height,created_by) VALUES(?,?,?,?,?,?,?,?)', randomUUID(), filename, 'storage.webp', 'image/webp', 16, 10, 10, 1);
  const photo = await request('/uploads/' + filename);
  assert.equal(photo.status, 200);
  assert.match(photo.headers.get('content-type'), /image\/webp/);
  assert.ok((await photo.arrayBuffer()).byteLength > 0);
  assert.ok(storage.reads.includes(filename), 'a imagem foi lida do storage');

  // Arquivo no storage sem registro em `media` não é servido.
  const orphan = randomUUID() + '.webp';
  storage.media.set(orphan, Buffer.from('orphan'));
  const hidden = await request('/uploads/' + orphan);
  assert.equal(hidden.status, 404); await hidden.text();

  const logout = await request('/api/admin/logout', 'POST', {}, headers); assert.equal(logout.status, 200); await logout.text();
  const expired = await request('/api/admin/me', 'GET', null, headers); assert.equal(expired.status, 401); await expired.text();
  assert.equal((await db.get('SELECT count(*) AS n FROM admin_sessions')).n, 0);
});

test('simultaneous quote requests keep every order', async t => {
  const { db, request } = await fixture(t);
  const input = index => ({ requestKey: `cloud-request-00000${index}`, customer: { name: `Cliente ${index}`, phone: `7598888777${index}` }, items: [{ id: 1, qty: 1, lineKey: 'A' }] });
  const responses = await Promise.all([request('/api/quotes', 'POST', input(1)), request('/api/quotes', 'POST', input(2))]);
  const quotes = [];
  for (const response of responses) { assert.equal(response.status, 201); quotes.push(await response.json()); }
  assert.notEqual(quotes[0].protocol, quotes[1].protocol);
  // Concorrência aqui não é mais conflito de ETag: cada transação recebe a
  // própria conexão do Postgres e as duas gravações precisam sobreviver.
  assert.equal((await db.get('SELECT count(*) AS n FROM orders')).n, 2);
  const retry = await request('/api/quotes', 'POST', input(1));
  assert.equal(retry.status, 201); assert.equal((await retry.json()).protocol, quotes[0].protocol);
  assert.equal((await db.get('SELECT count(*) AS n FROM orders')).n, 2);
});

test('a storage that cannot be created answers 503 without releasing a success response', async t => {
  const db = await openDatabase();
  t.after(async () => { await db.close(); });
  let base = '';
  const server = createServer(createCloudHandler({ storageFactory: () => { throw Error('no storage'); }, getOrigin: () => base }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); });
  base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/catalog');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.products, undefined);
  assert.match(body.error, /temporariamente indisponível/);
});

test('a failed storage write during the cron backup answers 503 instead of a false success', async t => {
  const previous = { cron: process.env.CRON_SECRET, key: process.env.BACKUP_KEY };
  process.env.CRON_SECRET = randomUUID();
  process.env.BACKUP_KEY = (await import('node:crypto')).randomBytes(32).toString('base64');
  t.after(() => {
    for (const [key, value] of [['CRON_SECRET', previous.cron], ['BACKUP_KEY', previous.key]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const { storage, request } = await fixture(t);
  const unauthenticated = await request('/api/cron/backup');
  assert.equal(unauthenticated.status, 401); await unauthenticated.text();
  assert.equal(storage.backups.size, 0);
  storage.failBackups = true;
  const failed = await request('/api/cron/backup', 'GET', null, { Authorization: `Bearer ${process.env.CRON_SECRET}` });
  assert.equal(failed.status, 503);
  const body = await failed.json();
  assert.equal(body.ok, undefined);
  assert.equal(storage.backups.size, 0);
});

test('cron writes an encrypted archive of the Postgres dump and the media', async t => {
  const previous = { cron: process.env.CRON_SECRET, key: process.env.BACKUP_KEY };
  process.env.CRON_SECRET = randomUUID();
  process.env.BACKUP_KEY = (await import('node:crypto')).randomBytes(32).toString('base64');
  t.after(() => {
    for (const [key, value] of [['CRON_SECRET', previous.cron], ['BACKUP_KEY', previous.key]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const { storage, request } = await fixture(t);
  const result = await request('/api/cron/backup', 'GET', null, { Authorization: `Bearer ${process.env.CRON_SECRET}` });
  assert.equal(result.status, 200);
  const report = await result.json();
  assert.equal(report.ok, true);
  assert.equal(report.encrypted, true);
  assert.equal(report.files, 1);
  assert.equal(storage.backups.size, 1);
  const [name, archive] = [...storage.backups.entries()][0];
  assert.match(name, /^backup-.+\.mpbackup$/);
  // Formato 2: dump SQL do Postgres dentro do envelope MPB1, não um SQLite.
  assert.equal(archive.subarray(0, 4).toString(), 'MPB1');
  const directory = await mkdtemp(resolve(tmpdir(), 'mp-cloud-restore-'));
  t.after(async () => { assert.equal(dirname(directory), resolve(tmpdir())); await rm(directory, { recursive: true, force: true }); });
  const file = resolve(directory, basename(name));
  await writeFile(file, archive);
  // Lacuna conhecida: `restoreBackup` ainda valida `manifest.format===1` (SQLite)
  // e recusa o dump SQL do Postgres que `createBackup` passou a gerar.
  await assert.rejects(() => restoreBackup(file, resolve(directory, 'recovered')), /Manifesto inválido/);
});

test('the response is buffered and only released after the app finished', () => {
  const response = new BufferedResponse();
  response.writeHead(201, { 'Content-Type': 'application/json' });
  response.write('{"ok":');
  assert.equal(response.ended, false);
  assert.equal(response.chunks.length, 1, 'nada foi enviado ao cliente ainda');
  response.end('true}');
  assert.equal(response.ended, true);
  const chunks = [];
  const res = { headers: {}, statusCode: 0, setHeader(n, v) { this.headers[n] = v; }, end(bytes) { chunks.push(bytes); this.sent = true; } };
  response.send(res);
  assert.equal(res.statusCode, 201);
  // BufferedResponse normaliza o nome do cabeçalho para minúsculas, como o Node.
  assert.equal(res.headers['content-type'], 'application/json');
  assert.equal(res.sent, true);
  assert.equal(Buffer.concat(chunks).toString(), '{"ok":true}');
});
