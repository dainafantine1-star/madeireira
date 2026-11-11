// Armazenamento das imagens no Supabase Storage.
// O banco saiu do Blob: aqui só trafegam arquivos de mídia, servidos por
// uploads/<nome> e resolvidos pela API antes de chegar ao disco local.
import { createClient } from '@supabase/supabase-js';

export const mediaName = /^[a-f0-9-]{36}(?:-(?:320|640|960))?\.(?:webp|png)$/;

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

const bucket = () => process.env.SUPABASE_BUCKET || 'media';

export class SupabaseStorage {
  async readMedia(filename) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    const { data, error } = await supabase().storage.from(bucket()).download('uploads/' + filename);
    if (error) {
      if (/not found|does not exist/i.test(error.message)) return null;
      throw error;
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async saveMedia(filename, bytes) {
    if (!mediaName.test(filename)) throw Error('Invalid media name.');
    const { error } = await supabase().storage.from(bucket()).upload('uploads/' + filename, bytes, {
      contentType: filename.endsWith('.png') ? 'image/png' : 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });
    // Um novo envio do mesmo nome é substituição legítima; não falha.
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  }

  async saveBackup(filename, bytes) {
    if (!/^backup-[a-zA-Z0-9.-]+\.mpbackup$/.test(filename) || bytes.subarray(0, 4).toString() !== 'MPB1') {
      throw Error('Encrypted backup required.');
    }
    const { error } = await supabase().storage.from(bucket()).upload('backups/' + filename, bytes, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  }
}

export { SupabaseStorage as BlobStorage };
