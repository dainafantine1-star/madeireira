-- As chaves estrangeiras perderam o ON DELETE CASCADE que existia no SQLite,
-- porque o gerador do schema só copiou a referência. Sem isso, excluir uma
-- mídia falha por causa das variantes, e excluir um pedido falha pelas filhas.

ALTER TABLE loja.media_variants DROP CONSTRAINT IF EXISTS fk_media_variants_media_id;
ALTER TABLE loja.media_variants ADD CONSTRAINT fk_media_variants_media_id
  FOREIGN KEY (media_id) REFERENCES loja.media(id) ON DELETE CASCADE;

ALTER TABLE loja.admin_sessions DROP CONSTRAINT IF EXISTS fk_admin_sessions_user_id;
ALTER TABLE loja.admin_sessions ADD CONSTRAINT fk_admin_sessions_user_id
  FOREIGN KEY (user_id) REFERENCES loja.admin_users(id) ON DELETE CASCADE;

ALTER TABLE loja.order_items DROP CONSTRAINT IF EXISTS fk_order_items_order_id;
ALTER TABLE loja.order_items ADD CONSTRAINT fk_order_items_order_id
  FOREIGN KEY (order_id) REFERENCES loja.orders(id) ON DELETE CASCADE;

ALTER TABLE loja.order_history DROP CONSTRAINT IF EXISTS fk_order_history_order_id;
ALTER TABLE loja.order_history ADD CONSTRAINT fk_order_history_order_id
  FOREIGN KEY (order_id) REFERENCES loja.orders(id) ON DELETE CASCADE;
