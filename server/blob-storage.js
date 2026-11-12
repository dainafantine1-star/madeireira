// Armazenamento das imagens no Supabase Storage.
// O banco vive no Postgres; aqui só trafegam arquivos de mídia.
//
// Os buckets já existentes no projeto são separados por finalidade, e o
// upload escolhe o destino pelo uso declarado:
//   photo  -> produtos    (público)
//   banner -> banners     (público)
//   logo   -> categorias  (público)
//   avatar -> avatars     (privado)
// O nome do bucket fica gravado na tabela media, para que leituras saibam onde
// procurar mesmo depois de o uso mudar.
import { createClient } from '@supabase/supabase-js';

export const mediaName = /^[a-f0-9-]{36}(?:-(?:320|640|960))?\.(?:webp|png)$/;

export const BUCKETS = Object.freeze({ photo: 'produtos', banner: 'banners', logo: 'categorias', avatar: 'avatars' });
export const bucketFor = usage => BUCKETS[usage] || BUCKETS.photo;

export class StorageConflict extends Error {}

let cliente = null;
function supabase() {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY para o armazenamento de imagens.');
  cliente = createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

const backupBucket = () => process.env.SUPABASE_BACKUP_BUCKET || 'avatars';

// Os arquivos entram numa pasta `uploads/` dentro de cada bucket para separar
// mídia da loja de qualquer outro conteúdo do projeto.
const caminho = filename => 'uploads/' + filename;

export class SupabaseStorage {
  // Lê do bucket informado; sem ele, procura nos quatro, já que registros
  // antigos podem não ter a coluna preenchida.
  async readMedia(filename, bucket) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    const tentativas = bucket ? [bucket] : [...new Set(Object.values(BUCKETS))];
    for (const nome of tentativas) {
      const { data, error } = await supabase().storage.from(nome).download(caminho(filename));
      if (!error && data) return Buffer.from(await data.arrayBuffer());
      if (error && !/not found|does not exist|Object not found/i.test(error.message)) throw error;
    }
    return null;
  }

  async saveMedia(filename, bytes, bucket = BUCKETS.photo) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    const { error } = await supabase().storage.from(bucket).upload(caminho(filename), bytes, {
      contentType: filename.endsWith('.png') ? 'image/png' : 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw error;
  }

  async removeMedia(filename, bucket = BUCKETS.photo) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    const { error } = await supabase().storage.from(bucket).remove([caminho(filename)]);
    if (error && !/not found/i.test(error.message)) throw error;
  }

  async saveBackup(filename, bytes) {
    if (!/^backup-[a-zA-Z0-9.-]+\.mpbackup$/.test(filename) || bytes.subarray(0, 4).toString() !== 'MPB1') {
      throw Error('Encrypted backup required.');
    }
    const { error } = await supabase().storage.from(backupBucket()).upload('backups/' + filename, bytes, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  }
}

export { SupabaseStorage as BlobStorage };
