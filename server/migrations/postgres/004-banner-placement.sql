-- A migração 008 do SQLite adicionou `placement` em banners (home/promotion).
-- O gerador do schema Postgres partiu do estado anterior a ela, então a coluna
-- e o índice ficaram de fora e /api/catalog falhava com "column placement does
-- not exist".
ALTER TABLE loja.banners ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'promotion'
  CHECK (placement IN ('home','promotion'));
CREATE INDEX IF NOT EXISTS banners_placement ON loja.banners(placement, sort_order);
