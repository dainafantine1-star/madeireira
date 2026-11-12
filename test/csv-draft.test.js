import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { previewImport, applyImport } from '../server/csv.js';

// A bulk load should not go live unreviewed. Draft import keeps every row
// unpublished regardless of what the spreadsheet says.

async function fixture(t) {
  const db = await openDatabase();
  t.after(() => db.close());
  return { db, owner: await createOwner(db, { email: `draft-${crypto.randomUUID()}@example.test`, password: 'DraftTestPassword123' }) };
}

const csv = ['sku,name,category,price,status,active',
  'DRAFT-1,Produto publicado,tabuas,10,active,1',
  'DRAFT-2,Produto vazio,tabuas,20,,',
  'DRAFT-3,Outro ativo,tabuas,30,active,1'].join('\n');

test('a normal import publishes the rows the file marks as active', async t => {
  const { db, owner } = await fixture(t);
  const preview = await previewImport(db, owner, { mode: 'upsert', csv, draft: false });
  assert.equal(preview.summary.errors, 0);
  await applyImport(db, owner, { previewId: preview.id });
  const ativos = (await db.get("SELECT count(*) AS n FROM products WHERE active=1 AND sku LIKE 'DRAFT-%'")).n;
  assert.equal(ativos, 3);
});

test('a draft import keeps every row unpublished', async t => {
  const { db, owner } = await fixture(t);
  const preview = await previewImport(db, owner, { mode: 'upsert', csv, draft: true });
  assert.equal(preview.summary.errors, 0);
  await applyImport(db, owner, { previewId: preview.id });
  const ativos = (await db.get("SELECT count(*) AS n FROM products WHERE active=1 AND sku LIKE 'DRAFT-%'")).n;
  const total = (await db.get("SELECT count(*) AS n FROM products WHERE sku LIKE 'DRAFT-%'")).n;
  assert.equal(total, 3, 'os três foram gravados');
  assert.equal(ativos, 0, 'nenhum publicado');
});

test('draft import keeps price and unit so the row is ready to publish later', async t => {
  const { db, owner } = await fixture(t);
  const preview = await previewImport(db, owner, { mode: 'upsert', csv, draft: true });
  await applyImport(db, owner, { previewId: preview.id });
  const row = await db.get("SELECT price_cents,unit,status,active FROM products WHERE sku='DRAFT-1'");
  assert.equal(row.price_cents, 1000);
  assert.equal(row.unit, 'un');
  assert.equal(row.active, 0);
});

test('draft import also unpublishes rows that update an existing product', async t => {
  const { db, owner } = await fixture(t);
  const first = await previewImport(db, owner, { mode: 'upsert', csv, draft: false });
  await applyImport(db, owner, { previewId: first.id });
  const update = ['sku,name,category,price', 'DRAFT-1,Produto publicado,tabuas,99'].join('\n');
  const second = await previewImport(db, owner, { mode: 'upsert', csv: update, draft: true });
  assert.equal(second.summary.update, 1);
  await applyImport(db, owner, { previewId: second.id });
  const row = await db.get("SELECT price_cents,active FROM products WHERE sku='DRAFT-1'");
  assert.equal(row.price_cents, 9900, 'o preço novo é gravado');
  assert.equal(row.active, 0, 'rascunho vale para toda a carga, inclusive atualizações');
});
