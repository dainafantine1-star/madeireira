import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createOwner } from '../server/auth.js';
import { productList, restoreProduct, restoreAllProducts, deleteProduct, saveProduct } from '../server/products.js';

// Soft-deleted products stay in the database. The archive view lists them and
// restores them, which is how a mistaken bulk delete is undone.
// The shared fixture ships 10 demo products, so every count is relative.

const visible = db => productList(db, new URL('http://localhost/api/admin/products')).total;
const archived = db => productList(db, new URL('http://localhost/api/admin/products?archived=1')).total;

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const owner = createOwner(db, { email: `archive-${crypto.randomUUID()}@example.test`, password: 'ArchiveTestPassword123' });
  const category = db.prepare('SELECT id FROM categories LIMIT 1').get();
  const products = [];
  for (let i = 0; i < 3; i++) {
    products.push(saveProduct(db, owner, {
      name: `Produto Arquivado ${i}`, reference: `ARC-${i}`, sku: `ARC-${i}`, category: category.id,
      price: 10, status: 'active', active: true, unit: 'un', stock: 5,
    }, undefined));
  }
  return { db, owner, products, base: visible(db), baseArchived: archived(db) };
}

test('deleted products leave the catalogue but stay recoverable', t => {
  const { db, owner, products, base } = fixture(t);
  for (const p of products) deleteProduct(db, owner, p.id);

  assert.equal(visible(db), base - 3, 'os três saem da listagem ativa');
  assert.equal(archived(db), 3, 'os três aparecem no arquivo');
  const list = productList(db, new URL('http://localhost/api/admin/products?archived=1'));
  assert.equal(list.archived, true);
  assert.equal(list.archivedTotal, 3);
});

test('restoring a product clears the delete flag and keeps it unpublished', t => {
  const { db, owner, products, base } = fixture(t);
  const target = products[0];
  deleteProduct(db, owner, target.id);
  assert.equal(visible(db), base - 1);

  const restored = restoreProduct(db, owner, target.id);
  assert.equal(restored.id, target.id);
  assert.equal(visible(db), base);
  assert.equal(archived(db), 0);

  const row = db.prepare('SELECT active,status,deleted_at FROM products WHERE id=?').get(target.id);
  assert.equal(row.deleted_at, null);
  assert.equal(row.active, 0, 'restaura como não publicado, exigindo revisão');
  assert.equal(row.status, 'unavailable', 'não volta a vendável sem unidade confirmada');
});

test('restoring a product that is not deleted is refused', t => {
  const { db, owner, products } = fixture(t);
  assert.throws(() => restoreProduct(db, owner, products[0].id), /não está excluído/i);
});

test('restore-all recovers every archived product', t => {
  const { db, owner, products, base } = fixture(t);
  for (const p of products) deleteProduct(db, owner, p.id);
  assert.equal(archived(db), 3);

  const result = restoreAllProducts(db, owner);
  assert.equal(result.restored, 3);
  assert.equal(visible(db), base);
  assert.equal(archived(db), 0);
});

test('restoring records who did it in the audit log', t => {
  const { db, owner, products } = fixture(t);
  deleteProduct(db, owner, products[0].id);
  restoreProduct(db, owner, products[0].id);
  const entry = db.prepare("SELECT * FROM audit_log WHERE action='product_restored' AND entity_id=?").get(String(products[0].id));
  assert.ok(entry, 'a restauração deve aparecer no histórico');
  assert.equal(entry.actor_email, owner.email);
});
