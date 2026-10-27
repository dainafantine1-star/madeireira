import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaults } from './settings-defaults.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function openDatabase(path = process.env.DATABASE_PATH || resolve(root, 'storage/store.sqlite')) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for (const name of readdirSync(new URL('./migrations/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) {
    if (!db.prepare('SELECT 1 FROM migrations WHERE name=?').get(name)) {
      // SQLite table rebuilds must keep referencing tables pointed at the original name.
      const rebuild = name === '006_catalog_incomplete.sql';
      if (rebuild) db.exec('PRAGMA foreign_keys=OFF');
      try { transaction(db, () => {
        db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8'));
        if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Migration violates historical references.');
        db.prepare('INSERT INTO migrations(name) VALUES(?)').run(name);
      }); } finally { if (rebuild) db.exec('PRAGMA foreign_keys=ON'); }
    }
  }
  if (!db.prepare('SELECT 1 FROM company_settings').get()) seed(db);
  return db;
}
function seed(db) {
  // Company setup seeds categories only; catalog data is imported explicitly.
  const categories = JSON.parse(readFileSync(new URL('./seed-categories.json', import.meta.url), 'utf8'));
  transaction(db, () => {
    for (const c of categories.filter(c => c.id !== 'todas')) db.prepare('INSERT INTO categories(id,label,slug) VALUES(?,?,?)').run(c.id, c.label,c.id);
    db.prepare('INSERT INTO company_settings(id,public_json) VALUES(1,?)').run(JSON.stringify({
      name:'Madeireira Progresso', whatsapp:'5500000000000', phone:'(XX) XXXXX-XXXX', address:'Av. Exemplo, 1234 — Centro',
      hours:'Seg a Sex — 7h30 às 18h\nSáb — 7h30 às 12h', confirmed:false,
      delivery:'Prazo, região atendida e frete sob consulta.', payment:'Formas de pagamento e parcelamento sob consulta.',
      commercialTerms:'Preços provisórios. Descontos, disponibilidade, frete, prazo e pagamento sujeitos à confirmação.'
    }));
    const banners = [
      ['CATÁLOGO','Madeira para sua obra','Conheça os produtos e solicite seu orçamento.'],
      ['ENTREGA','Consulte a entrega','Informe seu endereço para confirmar prazo e valor do frete.'],
      ['ORÇAMENTO','Converse com a equipe','Confirme preços e condições de pagamento antes de fechar seu pedido.']
    ];
    banners.forEach((b,i) => db.prepare('INSERT INTO banners(tag,title,body,sort_order) VALUES(?,?,?,?)').run(...b,i));
  });
}
export function settings(db) {
  const row=db.prepare('SELECT public_json,version FROM company_settings WHERE id=1').get();
  const stored=JSON.parse(row.public_json);
  // Explicit public fields: future internal keys must never leak through catalog/settings APIs.
  const keys=[...Object.keys(defaults),'name','whatsapp','phone','address','hours','confirmed','delivery','payment','commercialTerms'];
  return {...defaults,...Object.fromEntries(keys.filter(key=>Object.hasOwn(stored,key)).map(key=>[key,stored[key]])),version:row.version};
}
export function productDTO(row) {
  return { id:row.id, reference:row.reference, name:row.name, category:row.category_id, categoryLabel:row.category_label,
    price:row.price_cents === null ? null : row.price_cents/100, oldPrice:row.old_price_cents === null ? null : row.old_price_cents/100,
    offer:row.status==='promotion' && row.old_price_cents !== null && row.price_cents !== null, description:row.description, specs:JSON.parse(row.specs_json),
    image:row.image, images:JSON.parse(row.images_json || '[]'),shortDescription:row.short_description || '',commercialTerms:row.commercial_terms, active:!!row.active,sku:row.sku,dimensions:row.dimensions,lengthMm:row.length_mm,
    unit:row.unit,status:row.status,featured:!!row.featured,stock:row.stock_milli==null?null:row.stock_milli/1000,lowStock:row.low_stock,version:row.version,
    categoryActive:row.category_active!==0,available:!!row.active && row.category_active!==0 && row.status!=='unavailable' && row.stock_milli!==0 && row.unit!=null };
}
export function catalog(db) {
  const company=settings(db);
  return { products:db.prepare('SELECT p.*, c.label AS category_label FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.deleted_at IS NULL AND c.active=1 ORDER BY p.featured DESC,p.id').all().filter(p=>company.stockZeroBehavior!=='hide'||p.stock_milli!==0).map(productDTO),
    categories:db.prepare('SELECT id,label,slug,image,icon,sort_order FROM categories WHERE active=1 ORDER BY sort_order,id').all(),
    media:db.prepare('SELECT m.filename,m.width AS original_width,v.width FROM media m LEFT JOIN media_variants v ON v.media_id=m.id ORDER BY m.filename,v.width').all(),
    banners:db.prepare('SELECT id,tag,title,body,image,cta,destination FROM banners WHERE active=1 ORDER BY sort_order,id').all(), settings:company };
}
