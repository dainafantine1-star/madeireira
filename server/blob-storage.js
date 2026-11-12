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
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Sem SUPABASE_URL e chave, os arquivos ficam em disco. É o modo dos testes e do
// desenvolvimento local: nenhum upload de teste chega ao Supabase real.
const usarDisco = () => !process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const raizDisco = () => process.env.UPLOAD_DIR || resolve(fileURLToPath(new URL('../storage/uploads', import.meta.url)));
const arquivoLocal = (filename, bucket) => resolve(raizDisco(), bucket, filename);

// Os arquivos entram numa pasta `uploads/` dentro de cada bucket para separar
// mídia da loja de qualquer outro conteúdo do projeto.
const caminho = filename => 'uploads/' + filename;

export class SupabaseStorage {
  // Lê do bucket informado; sem ele, procura nos quatro, já que registros
  // antigos podem não ter a coluna preenchida.
  async readMedia(filename, bucket) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    if (usarDisco()) {
      const tentativas = bucket ? [bucket] : [...new Set(Object.values(BUCKETS))];
      for (const nome of tentativas) {
        try { return await readFile(arquivoLocal(filename, nome)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      return null;
    }
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
    if (usarDisco()) {
      const destino = arquivoLocal(filename, bucket);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, bytes);
      return;
    }
    const { error } = await supabase().storage.from(bucket).upload(caminho(filename), bytes, {
      contentType: filename.endsWith('.png') ? 'image/png' : 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (error) throw error;
  }

  async removeMedia(filename, bucket = BUCKETS.photo) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    if (usarDisco()) {
      await unlink(arquivoLocal(filename, bucket)).catch(() => {});
      return;
    }
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
