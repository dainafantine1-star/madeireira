ALTER TABLE banners ADD COLUMN placement TEXT NOT NULL DEFAULT 'promotion' CHECK(placement IN ('home','promotion'));
UPDATE banners SET placement='home' WHERE id=(SELECT id FROM banners WHERE image<>'' ORDER BY sort_order,id LIMIT 1);
INSERT INTO banners(tag,title,body,image,placement,active)
SELECT 'HOME','Banner principal da home','',COALESCE(json_extract(public_json,'$.heroImage'),''),'home',1 FROM company_settings
WHERE NOT EXISTS(SELECT 1 FROM banners WHERE placement='home');
CREATE UNIQUE INDEX banners_single_home ON banners(placement) WHERE placement='home';
