import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './fixtures/database.js';
import { createQuote } from '../server/orders.js';
import { createOwner } from '../server/auth.js';
import { saveProduct } from '../server/products.js';

// These scenarios were verified by hand in the 03/11/2026 audit and are kept
// here so the guarantees cannot regress silently.

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const owner = createOwner(db, { email: `quote-${crypto.randomUUID()}@example.test`, password: 'QuoteGuardTest123' });
  const category = db.prepare('SELECT id FROM categories LIMIT 1').get();
  const product = saveProduct(db, owner, {
    name: 'Produto Guarda', reference: 'GUARD-1', sku: 'GUARD-1', category: category.id,
    price: 10, status: 'active', active: true, unit: 'un', stock: 10,
  }, undefined);
  const customer = { name: 'Cliente Guarda', phone: '75999998888' };
  const item = (qty = 1, extra = {}) => ({ id: product.id, qty, ...extra });
  return { db, owner, product, customer, item };
}

test('client-supplied price fields are discarded and the server total prevails', t => {
  const { db, customer, item } = fixture(t);
  const quote = createQuote(db, {
    requestKey: 'mass-assignment-price-001',
    customer,
    items: [item(2, { price: 0.01, price_cents: 1, unitPrice: 0.01, total: 0.01, subtotal: 1, known_total_cents: 1 })],
  });
  const stored = db.prepare('SELECT known_total_cents FROM orders WHERE protocol=?').get(quote.protocol);
  assert.equal(stored.known_total_cents, 2000, 'dois itens de R$ 10,00 devem somar R$ 20,00');
  assert.equal(quote.total, 20);
});

test('the current database price prevails over the value the browser saw', t => {
  const { db, product, customer, item } = fixture(t);
  db.prepare('UPDATE products SET price_cents=2500 WHERE id=?').run(product.id);
  const quote = createQuote(db, {
    requestKey: 'stale-price-precedence-001',
    customer,
    items: [item(1, { price: 10, price_cents: 1000 })],
  });
  const stored = db.prepare('SELECT known_total_cents FROM orders WHERE protocol=?').get(quote.protocol);
  assert.equal(stored.known_total_cents, 2500);
});

test('a forged measurement that disagrees with the quantity is rejected', t => {
  const { db, product, customer, item } = fixture(t);
  db.prepare("UPDATE products SET unit='m' WHERE id=?").run(product.id);
  assert.throws(
    () => createQuote(db, {
      requestKey: 'forged-measurement-001',
      customer,
      items: [item(999, { measurement: { length: 1, pieces: 1 } })],
    }),
    /metragem|Medidas/i,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
});

test('products without a billing unit never enter a quote', t => {
  const { db, product, customer, item } = fixture(t);
  db.prepare("UPDATE products SET unit=NULL, status='unavailable' WHERE id=?").run(product.id);
  assert.throws(
    () => createQuote(db, { requestKey: 'unavailable-product-001', customer, items: [item(1)] }),
    /indisponível/i,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
});

test('invalid quantities are rejected before any write', t => {
  const { db, customer, item } = fixture(t);
  for (const qty of [-1, 0, 1e9, '1', null]) {
    assert.throws(
      () => createQuote(db, { requestKey: `invalid-qty-${String(qty)}-0001`, customer, items: [item(qty)] }),
      /Quantidade|inválid/i,
      `quantidade ${JSON.stringify(qty)} deveria ser recusada`,
    );
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
});

test('replaying the same request key returns the same protocol and creates one order', t => {
  const { db, customer, item } = fixture(t);
  const body = { requestKey: 'replay-same-content-001', customer, items: [item(1)] };
  const first = createQuote(db, body);
  const second = createQuote(db, body);
  assert.equal(second.protocol, first.protocol);
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders WHERE request_key=?').get(body.requestKey).n, 1);
});

test('reusing a request key with different content is refused', t => {
  const { db, customer, item } = fixture(t);
  const requestKey = 'replay-different-content-001';
  createQuote(db, { requestKey, customer, items: [item(1)] });
  assert.throws(
    () => createQuote(db, { requestKey, customer, items: [item(2)] }),
    /já foi usada/i,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders WHERE request_key=?').get(requestKey).n, 1);
});

test('a burst of simultaneous submissions with one key produces a single order', t => {
  const { db, customer, item } = fixture(t);
  const requestKey = 'burst-same-key-0001';
  const protocols = new Set();
  // createQuote is synchronous: a burst here means repeated calls before any response is released.
  for (let i = 0; i < 8; i++) protocols.add(createQuote(db, { requestKey, customer, items: [item(1)] }).protocol);
  assert.equal(protocols.size, 1, 'todas as tentativas devem devolver o mesmo protocolo');
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders WHERE request_key=?').get(requestKey).n, 1);
});

test('two products edited with the same version: one wins and one is refused', t => {
  const { db, owner, product } = fixture(t);
  const current = db.prepare('SELECT * FROM products WHERE id=?').get(product.id);
  const base = {
    name: current.name, reference: current.reference, sku: current.sku, category: current.category_id,
    status: 'active', active: true, unit: 'un', stock: 10, version: current.version,
  };
  saveProduct(db, owner, { ...base, price: 11 }, product.id);
  assert.throws(
    () => saveProduct(db, owner, { ...base, price: 12 }, product.id),
    /mudou em outra operação/i,
  );
  assert.equal(db.prepare('SELECT price_cents FROM products WHERE id=?').get(product.id).price_cents, 1100);
});
