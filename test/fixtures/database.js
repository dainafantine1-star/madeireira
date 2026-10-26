import { openDatabase as openRealDatabase, transaction } from '../../server/db.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Explicit test fixtures: never loaded by the application or production seed.
export function openDatabase(path) {
  const db = openRealDatabase(path);
  if (!db.prepare('SELECT 1 FROM products').get()) {
    const products = runInNewContext(readFileSync(new URL('./demo-catalog.js', import.meta.url), 'utf8')+';PRODUCTS');
    transaction(db, () => {
      for (const p of products) db.prepare('INSERT INTO products(id,reference,sku,name,category_id,price_cents,description,specs_json,image,unit) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run(p.id,`MP-${String(p.id).padStart(4,'0')}`,`MP-${String(p.id).padStart(4,'0')}`,p.name,p.category,Math.round(p.price*100),p.description,JSON.stringify(p.specs),p.image,'un');
    });
  }
  return db;
}
