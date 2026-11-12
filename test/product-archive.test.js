import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { productList, restoreProduct, restoreAllProducts, deleteProduct, saveProduct } from '../server/products.js';

// Soft-deleted products stay in the database. The archive view lists them and
// restores them, which is how a mistaken bulk delete is undone.
// The shared fixture ships 10 demo products, so every count is relative.

const visible = async db => (await productList(db, new URL('http://localhost/api/admin/products'))).total;
const archived = async db => (await productList(db, new URL('http://localhost/api/admin/products?archived=1'))).total;

async function fixture(t) {
  const db = await openDatabase();
  t.after(() => db.close());
  const owner = await createOwner(db, { email: `archive-${crypto.randomUUID()}@example.test`, password: 'ArchiveTestPassword123' });
  const category = await db.get('SELECT id FROM categories LIMIT 1');
  const products = [];
  for (let i = 0; i < 3; i++) {
    products.push(await saveProduct(db, owner, {
      name: `Produto Arquivado ${i}`, reference: `ARC-${i}`, sku: `ARC-${i}`, category: category.id,
      price: 10, status: 'active', active: true, unit: 'un', stock: 5,
    }, undefined));
  }
  return { db, owner, products, base: await visible(db), baseArchived: await archived(db) };
}

test('deleted products leave the catalogue but stay recoverable', async t => {
  const { db, owner, products, base } = await fixture(t);
  for (const p of products) await deleteProduct(db, owner, p.id);

  assert.equal(await visible(db), base - 3, 'os três saem da listagem ativa');
  assert.equal(await archived(db), 3, 'os três aparecem no arquivo');
  const list = await productList(db, new URL('http://localhost/api/admin/products?archived=1'));
  assert.equal(list.archived, true);
  assert.equal(list.archivedTotal, 3);
});

test('restoring a product clears the delete flag and keeps it unpublished', async t => {
  const { db, owner, products, base } = await fixture(t);
  const target = products[0];
  await deleteProduct(db, owner, target.id);
  assert.equal(await visible(db), base - 1);

  const restored = await restoreProduct(db, owner, target.id);
  assert.equal(restored.id, target.id);
  assert.equal(await visible(db), base);
  assert.equal(await archived(db), 0);

  const row = await db.get('SELECT active,status,deleted_at FROM products WHERE id=?', target.id);
  assert.equal(row.deleted_at, null);
  assert.equal(row.active, 0, 'restaura como não publicado, exigindo revisão');
  assert.equal(row.status, 'unavailable', 'não volta a vendável sem unidade confirmada');
});

test('restoring a product that is not deleted is refused', async t => {
  const { db, owner, products } = await fixture(t);
  await assert.rejects(() => restoreProduct(db, owner, products[0].id), /não está excluído/i);
});

test('restore-all recovers every archived product', async t => {
  const { db, owner, products, base } = await fixture(t);
  for (const p of products) await deleteProduct(db, owner, p.id);
  assert.equal(await archived(db), 3);

  const result = await restoreAllProducts(db, owner);
  assert.equal(result.restored, 3);
  assert.equal(await visible(db), base);
  assert.equal(await archived(db), 0);
});

test('restoring records who did it in the audit log', async t => {
  const { db, owner, products } = await fixture(t);
  await deleteProduct(db, owner, products[0].id);
  await restoreProduct(db, owner, products[0].id);
  const entry = await db.get("SELECT * FROM audit_log WHERE action='product_restored' AND entity_id=?", String(products[0].id));
  assert.ok(entry, 'a restauração deve aparecer no histórico');
  assert.equal(entry.actor_email, owner.email);
});
