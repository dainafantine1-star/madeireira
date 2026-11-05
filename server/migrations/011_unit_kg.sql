-- Rebuild products to allow unit 'kg' (SQLite cannot alter a CHECK constraint).
CREATE TABLE products_new (
 id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 price_cents INTEGER CHECK(price_cents IS NULL OR (typeof(price_cents)='integer' AND price_cents>0)),
 old_price_cents INTEGER CHECK(old_price_cents IS NULL OR (price_cents IS NOT NULL AND typeof(old_price_cents)='integer' AND old_price_cents>price_cents)),
 description TEXT NOT NULL DEFAULT '', specs_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(specs_json)),
 image TEXT NOT NULL DEFAULT '', commercial_terms TEXT NOT NULL DEFAULT 'Preço, disponibilidade, entrega e pagamento sujeitos à confirmação.',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, sku TEXT COLLATE NOCASE, dimensions TEXT NOT NULL DEFAULT '', length_mm INTEGER CHECK(length_mm IS NULL OR (typeof(length_mm)='integer' AND length_mm>0)), unit TEXT DEFAULT NULL CHECK(unit IN ('un','m','m2','m3','pacote','kg')), status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','promotion','unavailable')), featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)), stock INTEGER CHECK(stock IS NULL OR (typeof(stock)='integer' AND stock>=0)), low_stock INTEGER NOT NULL DEFAULT 5 CHECK(typeof(low_stock)='integer' AND low_stock>=0), deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1, stock_milli INTEGER CHECK(stock_milli IS NULL OR (typeof(stock_milli)='integer' AND stock_milli>=0)), short_description TEXT NOT NULL DEFAULT '', images_json TEXT NOT NULL DEFAULT '[]');
INSERT INTO products_new (id,reference,name,category_id,price_cents,old_price_cents,description,specs_json,image,commercial_terms,active,updated_at,sku,dimensions,length_mm,unit,status,featured,stock,low_stock,deleted_at,version,stock_milli,short_description,images_json)
SELECT id,reference,name,category_id,price_cents,old_price_cents,description,specs_json,image,commercial_terms,active,updated_at,sku,dimensions,length_mm,unit,status,featured,stock,low_stock,deleted_at,version,stock_milli,short_description,images_json FROM products;
DROP TABLE products;
ALTER TABLE products_new RENAME TO products;
CREATE INDEX products_category ON products(category_id, active);
CREATE UNIQUE INDEX products_sku ON products(sku COLLATE NOCASE);
CREATE INDEX products_management ON products(deleted_at,status,featured,category_id);
CREATE INDEX products_stock ON products(stock);
