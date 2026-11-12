-- Cada imagem passa a registrar o bucket em que foi gravada.
-- Os quatro buckets do Supabase (produtos, banners, categorias, avatars) já
-- existem; a coluna guarda qual deles contém o arquivo.
ALTER TABLE loja.media ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'produtos';
CREATE INDEX IF NOT EXISTS media_bucket ON loja.media(bucket);
