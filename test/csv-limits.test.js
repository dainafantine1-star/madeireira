import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { parseCSV, previewImport } from '../server/csv.js';
import { saveProduct } from '../server/products.js';

// The catalogue the client actually has is ~980 products. The old 500-row cap
// forced them to split the file, and the split import silently created
// duplicates instead of updating. These tests pin the raised limit and the
// warning that surfaces a SKU mismatch.

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const owner = createOwner(db, { email: `csv-${crypto.randomUUID()}@example.test`, password: 'CsvLimitTest1234' });
  return { db, owner };
}

function csvDe(produtos) {
  const linhas = ['sku,name,category,price'];
  for (let i = 1; i <= produtos; i++) linhas.push(`SKU-${i},Produto ${i},tabuas,10`);
  return linhas.join('\n');
}

test('a single file with 980 products is accepted', t => {
  const rows = parseCSV(csvDe(980));
  assert.equal(rows.length, 980);
});

test('a file above 5.000 products is refused', t => {
  assert.throws(() => parseCSV(csvDe(5001)), /5\.000 produtos/);
});

test('the limit is 5.000, not 500: 501 products pass', t => {
  assert.equal(parseCSV(csvDe(501)).length, 501);
});

test('the preview reports only errors and stays small', t => {
  const { db, owner } = fixture(t);
  const preview = previewImport(db, owner, { mode: 'upsert', csv: csvDe(490) });
  assert.equal(preview.summary.total, 490);
  assert.equal(preview.summary.errors, 0);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.rows, undefined, 'a resposta não devolve todas as linhas');
  const bytes = Buffer.byteLength(JSON.stringify(preview));
  assert.ok(bytes < 20000, `resposta deve ser pequena, veio com ${bytes} bytes`);
});

test('a preview with errors lists only the failing lines', t => {
  const { db, owner } = fixture(t);
  const csv = 'sku,name,category,price\nOK-1,Válido,tabuas,10\nBAD-1,Sem categoria,,10\nBAD-2,Preço ruim,tabuas,abc';
  const preview = previewImport(db, owner, { mode: 'upsert', csv });
  assert.equal(preview.summary.total, 3);
  assert.equal(preview.summary.errors, 2);
  assert.equal(preview.errors.length, 2);
  assert.deepEqual(preview.errors.map(e => e.line), [3, 4]);
  assert.match(preview.errors[0].errors.join(';'), /Informe a categoria/);
  assert.equal(preview.valid, false);
});

test('a file whose SKUs match nothing in the catalogue warns about duplicates', t => {
  const { db, owner } = fixture(t);
  // Catálogo com produtos de SKU diferente do arquivo
  const category = db.prepare('SELECT id FROM categories LIMIT 1').get();
  for (let i = 1; i <= 3; i++) {
    saveProduct(db, owner, {
      name: `Existente ${i}`, reference: `EX-${i}`, sku: `EX-${i}`, category: category.id,
      price: 10, status: 'active', active: true, unit: 'un', stock: 5,
    }, undefined);
  }
  const preview = previewImport(db, owner, { mode: 'upsert', csv: csvDe(5) });
  assert.equal(preview.summary.create, 5);
  assert.equal(preview.summary.update, 0);
  assert.ok(preview.warning, 'deve avisar que nada corresponde ao catálogo');
  assert.match(preview.warning, /Nenhum SKU da planilha corresponde/);
});

test('a file that matches existing SKUs updates them and does not warn', t => {
  const { db, owner } = fixture(t);
  const category = db.prepare('SELECT id FROM categories LIMIT 1').get();
  const criado = saveProduct(db, owner, {
    name: 'Existente', reference: 'EX-1', sku: 'EX-1', category: category.id,
    price: 10, status: 'active', active: true, unit: 'un', stock: 5,
  }, undefined);
  const csv = `sku,name,category,price\n${criado.sku},Existente atualizado,tabuas,99`;
  const preview = previewImport(db, owner, { mode: 'upsert', csv });
  assert.equal(preview.summary.update, 1);
  assert.equal(preview.summary.create, 0);
  assert.equal(preview.warning, null);
});
