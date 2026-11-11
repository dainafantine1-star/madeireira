import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { openDatabase } from './fixtures/database.js';
import { createApp } from '../server/index.js';
import { createOwner } from '../server/auth.js';
import { parseCSV } from '../server/csv.js';
import '../admin/bulk-import.js';

const BulkImport = globalThis.BulkImport;

function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data ?? '');
    const method = f.method ?? 8;
    const crc = f.crc ?? BulkImport.crc32(new Uint8Array(data));
    const comp = method === 0 ? data : deflateRawSync(data);
    const compSize = f.compSize ?? comp.length;
    const uncompSize = f.uncompSize ?? data.length;
    const flags = f.encrypted ? 1 : 0;
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(20, 4); lfh.writeUInt16LE(flags, 6); lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(crc, 14); lfh.writeUInt32LE(compSize, 18); lfh.writeUInt32LE(uncompSize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lfh, nameBuf, comp);
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); cdh.writeUInt16LE(20, 4); cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(flags, 8); cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(crc, 16); cdh.writeUInt32LE(compSize, 20); cdh.writeUInt32LE(uncompSize, 24);
    cdh.writeUInt16LE(nameBuf.length, 28); cdh.writeUInt32LE(offset, 42);
    centrals.push(cdh, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  const out = Buffer.concat([...locals, cd, eocd]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}
const pngBytes = (r = 200, g = 10, b = 10) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r, g, b } } }).png().toBuffer();

test('leitor de ZIP valida estrutura, caminhos e conteúdo', async () => {
  const image = await pngBytes();
  const buffer = makeZip([
    { name: 'CAD001.jpg', data: image },
    { name: 'pasta/CAD001_1.png', data: image, method: 0 },
    { name: 'leia-me.txt', data: 'texto' },
  ]);
  const { entries, ignored } = BulkImport.listEntries(buffer);
  assert.equal(entries.length, 2);
  assert.deepEqual(ignored, ['leia-me.txt']);
  assert.equal(Buffer.from(await BulkImport.extractEntry(buffer, entries[0])).equals(image), true);
  assert.equal(Buffer.from(await BulkImport.extractEntry(buffer, entries[1])).equals(image), true);

  for (const name of ['../escape.png', '/absoluto.png', 'a\\b.png', 'C:/win.png', 'x/../../y.png']) {
    assert.throws(() => BulkImport.listEntries(makeZip([{ name, data: image }])), /Caminho inseguro|pastas profundas/i, name);
  }
  assert.throws(() => BulkImport.listEntries(makeZip([{ name: 'só-texto.txt', data: 'x' }])), /não contém imagens/);
  assert.throws(() => BulkImport.listEntries(makeZip([{ name: 'x.png', data: image, encrypted: true }])), /senha/);
  assert.throws(() => BulkImport.listEntries(makeZip([{ name: 'x.png', data: image, compSize: 1000, uncompSize: 2 * 1024 * 1024 }])), /bomba/);
  assert.throws(() => BulkImport.listEntries(makeZip([{ name: 'x.png', data: image, uncompSize: 3 * 1024 * 1024 + 1 }])), /excede 3 MB/);
  const wrongCrc = makeZip([{ name: 'x.png', data: image, crc: 0x12345678 }]);
  const entry = BulkImport.listEntries(wrongCrc).entries[0];
  await assert.rejects(() => BulkImport.extractEntry(wrongCrc, entry), /CRC/);
  assert.throws(() => BulkImport.listEntries(Buffer.alloc(10).buffer.slice(0)), /incompleto|índice/);
});

test('ZIP completo: lista CSV e imagens separadamente', async () => {
  const image = await pngBytes();
  const csv = 'sku,name,category,price\nCAD001,Produto A,tabuas,10.00\nCAD002,Produto B,portas,20.00';
  const buffer = makeZip([
    { name: 'produtos.csv', data: csv },
    { name: 'CAD001.jpg', data: image },
    { name: 'CAD001_1.png', data: image },
    { name: 'CAD002.jpg', data: image },
    { name: 'leia-me.txt', data: 'texto' },
  ]);
  const { entries, csvEntries, ignored } = BulkImport.listEntries(buffer);
  assert.equal(entries.length, 3);
  assert.equal(csvEntries.length, 1);
  assert.equal(csvEntries[0].name, 'produtos.csv');
  assert.deepEqual(ignored, ['leia-me.txt']);
  const csvBytes = await BulkImport.extractEntry(buffer, csvEntries[0]);
  assert.equal(new TextDecoder().decode(csvBytes), csv);
  const imgBytes = await BulkImport.extractEntry(buffer, entries[0]);
  assert.equal(Buffer.from(imgBytes).equals(image), true);
  const twoCsv = BulkImport.listEntries(makeZip([{ name: 'a.csv', data: 'x' }, { name: 'b.csv', data: 'y' }, { name: 'img.png', data: image }]));
  assert.equal(twoCsv.csvEntries.length, 2);
});

test('matchImages associa imagens ao SKU com capa, galeria e limites', () => {
  const skus = ['CAD001', 'OUTRO', 'A', 'A_B'];
  const names = [
    'CAD001.jpg', 'CAD001_2.png', 'CAD001_10.webp', 'CAD001_1.jpg',
    'fotos/CAD001_3.jpg', 'CAD0011.jpg', 'sem-produto.jpg', 'OUTRO.jpeg',
    'A_B_1.jpg', 'A_1.jpg',
  ];
  const { bySku, unmatched, overflow } = BulkImport.matchImages(names, skus);
  assert.deepEqual(bySku.get('CAD001').map(x => x.name), ['CAD001.jpg', 'CAD001_1.jpg', 'CAD001_2.png', 'fotos/CAD001_3.jpg', 'CAD001_10.webp']);
  assert.equal(bySku.get('CAD001')[0].exact, true);
  assert.deepEqual(bySku.get('OUTRO').map(x => x.name), ['OUTRO.jpeg']);
  assert.deepEqual(bySku.get('A_B').map(x => x.name), ['A_B_1.jpg']);
  assert.deepEqual(bySku.get('A').map(x => x.name), ['A_1.jpg']);
  assert.ok(unmatched.includes('CAD0011.jpg'));
  assert.ok(unmatched.includes('sem-produto.jpg'));
  const many = Array.from({ length: 15 }, (_, i) => `SKU9_${i + 1}.jpg`);
  const capped = BulkImport.matchImages(many, ['SKU9']);
  assert.equal(capped.bySku.get('SKU9').length, BulkImport.limits.maxPerSku);
  assert.equal(capped.overflow.length, 15 - BulkImport.limits.maxPerSku);
  assert.equal(BulkImport.sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  assert.equal(BulkImport.sniffType(new Uint8Array([1, 2, 3, 4])), null);
});

test('ZIP com muitas imagens: processa 300 imagens em tempo hábil', async () => {
  const image = await pngBytes(50, 100, 150);
  const files = [];
  const skus = [];
  for (let i = 0; i < 100; i++) {
    const sku = `STRESS-${String(i).padStart(3, '0')}`;
    skus.push(sku);
    files.push({ name: `${sku}.png`, data: image });
    files.push({ name: `${sku}_1.png`, data: image });
    files.push({ name: `${sku}_2.png`, data: image });
  }
  const csv = 'sku,name,category,price\n' + skus.map(s => `${s},Produto ${s},tabuas,10.00`).join('\n');
  files.push({ name: 'produtos.csv', data: csv });
  const buffer = makeZip(files);
  const start = Date.now();
  const { entries, csvEntries } = BulkImport.listEntries(buffer);
  assert.equal(entries.length, 300);
  assert.equal(csvEntries.length, 1);
  const matched = BulkImport.matchImages(entries.map(e => e.name), skus);
  let extracted = 0;
  for (const list of matched.bySku.values()) {
    for (const item of list) {
      const bytes = await BulkImport.extractEntry(buffer, entries.find(e => e.name === item.name));
      assert.ok(BulkImport.sniffType(bytes), item.name);
      extracted++;
    }
  }
  assert.equal(extracted, 300);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 30000, `300 imagens levaram ${elapsed}ms (limite 30s)`);
});

test('parseCSV aceita até 2000 produtos e mantém o modelo antigo', () => {
  const header = 'sku,name,category,price';
  const row = i => `SKU-${i},Produto ${i},tabuas,10.50`;
  assert.equal(parseCSV([header, ...Array.from({ length: 600 }, (_, i) => row(i))].join('\n')).length, 600);
  assert.equal(parseCSV([header, ...Array.from({ length: 2000 }, (_, i) => row(i))].join('\n')).length, 2000);
  assert.throws(() => parseCSV([header, ...Array.from({ length: 2001 }, (_, i) => row(i))].join('\n')), /2000 produtos/);
  assert.throws(() => parseCSV(`${header}\nA,B,C,${'x'.repeat(2 * 1024 * 1024)}`), /2 MB/);
  const legacy = parseCSV('sku,name,category,price\nMP-1,Tábua,tabuas,"10,50"');
  assert.equal(legacy[0].values.price, '10,50');
});

async function harness(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mp-bulk-'));
  const previousUpload = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = join(dir, 'uploads');
  const db = openDatabase(':memory:');
  createOwner(db, { email: 'owner@example.com', password: 'StrongPassword123' });
  const server = createApp({ db });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(r => server.close(r));
    db.close();
    if (previousUpload === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUpload;
    rmSync(dir, { recursive: true, force: true });
  });
  const auth = await (await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'StrongPassword123' }) })).json();
  const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
  async function req(path, method = 'GET', data) {
    const response = await fetch(base + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json() };
  }
  return { base, req, headers, db };
}

test('importação em massa: lote de imagens, aplicação com galeria e modo ignorar', async t => {
  const { req } = await harness(t);
  const png = await pngBytes(10, 200, 30);
  const jpg = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 200, b: 30 } } }).jpeg().toBuffer();
  const batch = await req('/api/admin/import/images', 'POST', { items: [
    { name: 'capa.png', type: 'image/png', data: png.toString('base64') },
    { name: 'galeria.jpg', type: 'image/jpeg', data: jpg.toString('base64') },
  ] });
  assert.equal(batch.status, 200);
  assert.equal(batch.data.items.length, 2);
  const [cover, gallery] = batch.data.items.map(x => x.url);
  assert.match(cover, /^uploads\/[a-f0-9-]{36}\.webp$/);

  assert.equal((await req('/api/admin/import/images', 'POST', { items: [] })).status, 400);
  assert.equal((await req('/api/admin/import/images', 'POST', { items: Array.from({ length: 7 }, () => ({ name: 'x.png', type: 'image/png', data: png.toString('base64') })) })).status, 400);
  assert.equal((await req('/api/admin/import/images', 'POST', { items: [{ name: 'x.png', type: 'text/plain', data: 'aGk=' }] })).status, 400);

  const csv = 'sku,name,category,price\nNOVO-IMG,Produto com fotos,tabuas,12.50';
  const preview = await req('/api/admin/import/preview', 'POST', { csv, mode: 'create' });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.valid, true);
  const applied = await req('/api/admin/import/apply', 'POST', { previewId: preview.data.id, images: { 'NOVO-IMG': [cover, gallery] } });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.created, 1);
  const list = await req('/api/admin/products?q=NOVO-IMG');
  const product = list.data.items[0];
  assert.equal(product.image, cover);
  assert.deepEqual(product.images, [gallery]);

  const bad = await req('/api/admin/import/preview', 'POST', { csv: 'sku,name,category,price\nNOVO-2,X,tabuas,9', mode: 'create' });
  const failed = await req('/api/admin/import/apply', 'POST', { previewId: bad.data.id, images: { 'NOVO-2': ['uploads/deadbeef-0000-0000-0000-000000000000.webp'] } });
  assert.equal(failed.status, 400);
  assert.match(failed.data.error, /Imagem não encontrada/);

  const before = await req('/api/admin/products?q=MP-0001');
  const existing = before.data.items[0];
  const mix = await req('/api/admin/import/preview', 'POST', { csv: 'sku,name,category,price\nMP-0001,Nome Que Não Pode Mudar,tabuas,1.50\nNOVO-3,Outro,tabuas,7', mode: 'skip' });
  assert.equal(mix.data.summary.ignored, 1);
  assert.equal(mix.data.summary.create, 1);
  assert.equal(mix.data.rows.find(r => r.sku === 'MP-0001').operation, 'skip');
  const appliedMix = await req('/api/admin/import/apply', 'POST', { previewId: mix.data.id });
  assert.equal(appliedMix.data.skipped, 1);
  assert.equal(appliedMix.data.created, 1);
  const after = await req('/api/admin/products?q=MP-0001');
  assert.equal(after.data.items[0].name, existing.name);
  assert.equal(after.data.items[0].version, existing.version);
});

test('exclusão de categorias: vazia direto, com produtos exige destino', async t => {
  const { req } = await harness(t);
  const created = await req('/api/admin/categories', 'POST', { id: 'vazia-teste', label: 'Vazia Teste', active: true });
  assert.equal(created.status, 201);
  assert.equal((await req('/api/admin/categories/vazia-teste', 'DELETE')).status, 200);
  assert.equal((await req('/api/admin/categories')).data.some(c => c.id === 'vazia-teste'), false);

  const products = await req('/api/admin/products?category=tabuas&size=100');
  assert.ok(products.data.total > 0);
  const withoutTarget = await req('/api/admin/categories/'+'tabuas', 'DELETE');
  assert.equal(withoutTarget.status, 400);
  assert.match(withoutTarget.data.error, /destino/);

  const wrongVersion = await req('/api/admin/categories/'+'tabuas'+'?version=999', 'DELETE');
  assert.equal(wrongVersion.status, 409);

  const moved = await req('/api/admin/categories/'+'tabuas' + '?target=portas', 'DELETE');
  assert.equal(moved.status, 200);
  assert.equal(moved.data.moved, products.data.total);
  assert.equal((await req('/api/admin/products?category=tabuas&size=100')).data.total, 0);
  const inPortas = await req('/api/admin/products?category=portas&size=100');
  assert.ok(inPortas.data.total >= products.data.total);

  const audit = await req('/api/admin/audit');
  assert.ok(audit.data.items.some(a => a.action === 'category_deleted'));
});

test('mídia: produto excluído deixa de bloquear a exclusão da imagem', async t => {
  const { req } = await harness(t);
  const png = await pngBytes(90, 90, 90);
  const upload = await req('/api/admin/media', 'POST', { name: 'capa-teste.png', type: 'image/png', data: png.toString('base64') });
  assert.equal(upload.status, 201);
  const url = upload.data.url;

  const product = (await req('/api/admin/products/1')).data;
  const linked = await req('/api/admin/products/1', 'PUT', { ...product, image: url });
  assert.equal(linked.status, 200);
  let media = await req('/api/admin/media');
  assert.equal(media.data.find(m => m.url === url || `uploads/${m.filename}` === url).links, 1);
  assert.equal((await req(`/api/admin/media/${upload.data.id}`, 'DELETE')).status, 409);

  assert.equal((await req(`/api/admin/products/1?version=${linked.data.version}`, 'DELETE')).status, 200);
  media = await req('/api/admin/media');
  assert.equal(media.data.find(m => `uploads/${m.filename}` === url).links, 0);
  assert.equal((await req(`/api/admin/media/${upload.data.id}`, 'DELETE')).status, 200);
  assert.equal((await req('/api/admin/media')).data.some(m => `uploads/${m.filename}` === url), false);
});

test('mídia: exclusão em massa remove livres e mantém vinculadas', async t => {
  const { req } = await harness(t);
  const png = await pngBytes(60, 60, 60);
  const up1 = await req('/api/admin/media', 'POST', { name: 'livre1.png', type: 'image/png', data: png.toString('base64') });
  const up2 = await req('/api/admin/media', 'POST', { name: 'livre2.png', type: 'image/png', data: png.toString('base64') });
  const up3 = await req('/api/admin/media', 'POST', { name: 'em-uso.png', type: 'image/png', data: png.toString('base64') });
  assert.equal(up1.status, 201);
  const product = (await req('/api/admin/products/1')).data;
  const linked = await req('/api/admin/products/1', 'PUT', { ...product, image: up3.data.url });
  assert.equal(linked.status, 200);

  const result = await req('/api/admin/media/bulk-delete', 'POST', { ids: [up1.data.id, up2.data.id, up3.data.id] });
  assert.equal(result.status, 200);
  assert.equal(result.data.deleted, 2);
  assert.equal(result.data.skipped.length, 1);
  assert.equal(result.data.skipped[0].id, up3.data.id);
  assert.match(result.data.skipped[0].reason, /uso/);

  const remaining = await req('/api/admin/media');
  const filenames = remaining.data.map(m => m.filename);
  assert.ok(!filenames.includes(up1.data.url.replace('uploads/', '')));
  assert.ok(!filenames.includes(up2.data.url.replace('uploads/', '')));
  assert.ok(filenames.includes(up3.data.url.replace('uploads/', '')));

  assert.equal((await req('/api/admin/media/bulk-delete', 'POST', { ids: [] })).status, 400);
  assert.equal((await req('/api/admin/media/bulk-delete', 'POST', { ids: ['nao-existe'] })).data.deleted, 0);
});

test('paginação de produtos clampa página fora do intervalo', async t => {
  const { req } = await harness(t);
  const all = await req('/api/admin/products?size=100');
  const lastPage = Math.max(1, Math.ceil(all.data.total / 20));
  const beyond = await req('/api/admin/products?page=9999&size=20');
  assert.equal(beyond.status, 200);
  assert.equal(beyond.data.page, lastPage);
  assert.ok(beyond.data.items.length > 0);
  assert.equal(beyond.data.page * beyond.data.size >= beyond.data.total, true);
});

test('importação em lote: 100 produtos via preview+apply', async t => {
  const { req } = await harness(t);
  const rows = Array.from({ length: 100 }, (_, i) => `BULK-${String(i).padStart(3, '0')},Produto Lote ${i},tabuas,${(10 + i).toFixed(2)}`);
  const csv = 'sku,name,category,price\n' + rows.join('\n');
  const preview = await req('/api/admin/import/preview', 'POST', { csv, mode: 'create' });
  assert.equal(preview.status, 200);
  assert.equal(preview.data.valid, true);
  assert.equal(preview.data.summary.create, 100);
  const start = Date.now();
  const applied = await req('/api/admin/import/apply', 'POST', { previewId: preview.data.id });
  const elapsed = Date.now() - start;
  assert.equal(applied.status, 200);
  assert.equal(applied.data.created, 100);
  assert.ok(elapsed < 15000, `100 produtos levaram ${elapsed}ms (limite 15s)`);
  const list = await req('/api/admin/products?size=100&category=tabuas');
  assert.ok(list.data.total >= 100);
  const second = await req('/api/admin/import/preview', 'POST', { csv, mode: 'create' });
  assert.equal(second.data.summary.errors, 100, 'SKUs repetidos devem dar erro no modo create');
});
