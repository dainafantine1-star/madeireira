import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { previewImport, applyImport } from '../server/csv.js';

// A bulk load should not go live unreviewed. Draft import keeps every row
// unpublished regardless of what the spreadsheet says.

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  return { db, owner: createOwner(db, { email: `draft-${crypto.randomUUID()}@example.test`, password: 'DraftTestPassword123' }) };
}

const csv = ['sku,name,category,price,status,active',
  'DRAFT-1,Produto publicado,tabuas,10,active,1',
  'DRAFT-2,Produto vazio,tabuas,20,,',
  'DRAFT-3,Outro ativo,tabuas,30,active,1'].join('\n');

test('a normal import publishes the rows the file marks as active', t => {
  const { db, owner } = fixture(t);
  const preview = previewImport(db, owner, { mode: 'upsert', csv, draft: false });
  assert.equal(preview.summary.errors, 0);
  applyImport(db, owner, { previewId: preview.id });
  const ativos = db.prepare("SELECT count(*) AS n FROM products WHERE active=1 AND sku LIKE 'DRAFT-%'").get().n;
  assert.equal(ativos, 3);
});

test('a draft import keeps every row unpublished', t => {
  const { db, owner } = fixture(t);
  const preview = previewImport(db, owner, { mode: 'upsert', csv, draft: true });
  assert.equal(preview.summary.errors, 0);
  applyImport(db, owner, { previewId: preview.id });
  const ativos = db.prepare("SELECT count(*) AS n FROM products WHERE active=1 AND sku LIKE 'DRAFT-%'").get().n;
  const total = db.prepare("SELECT count(*) AS n FROM products WHERE sku LIKE 'DRAFT-%'").get().n;
  assert.equal(total, 3, 'os três foram gravados');
  assert.equal(ativos, 0, 'nenhum publicado');
});

test('draft import keeps price and unit so the row is ready to publish later', t => {
  const { db, owner } = fixture(t);
  const preview = previewImport(db, owner, { mode: 'upsert', csv, draft: true });
  applyImport(db, owner, { previewId: preview.id });
  const row = db.prepare("SELECT price_cents,unit,status,active FROM products WHERE sku='DRAFT-1'").get();
  assert.equal(row.price_cents, 1000);
  assert.equal(row.unit, 'un');
  assert.equal(row.active, 0);
});

test('draft import keeps an existing published product online', t => {
  const { db, owner } = fixture(t);
  const first = previewImport(db, owner, { mode: 'upsert', csv, draft: false });
  applyImport(db, owner, { previewId: first.id });
  const update = ['sku,name,category,price', 'DRAFT-1,Produto publicado,tabuas,99'].join('\n');
  const second = previewImport(db, owner, { mode: 'upsert', csv: update, draft: true });
  assert.equal(second.summary.update, 1);
  applyImport(db, owner, { previewId: second.id });
  const row = db.prepare("SELECT price_cents,active FROM products WHERE sku='DRAFT-1'").get();
  assert.equal(row.price_cents, 9900, 'o preço novo é gravado');
  assert.equal(row.active, 1, 'produto já publicado continua no ar');
});
