ALTER TABLE products ADD COLUMN short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE order_items ADD COLUMN calculation_json TEXT;
