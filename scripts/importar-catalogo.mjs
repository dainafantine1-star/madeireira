// Importa o catálogo local para o Supabase: os 979 produtos da planilha
// (sem imagens) e os 32 antigos com as 35 fotos. Todos entram NÃO PUBLICADOS,
// para revisão no painel antes de aparecerem na loja.
//
// Uso:
//   node --env-file-if-exists=.env scripts/importar-catalogo.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { openDatabase, closeDatabase, db } from '../server/db.js';
import { previewImport, applyImport } from '../server/csv.js';
import { uploadImage } from '../server/media.js';

const raiz = resolve('.');
const planilhas = ['PRODUTOS/Produtos_Painel_Corrigido_Parte_1_pronto.csv',
                   'PRODUTOS/Produtos_Painel_Corrigido_Parte_2_pronto.csv'];
const catalogoAntigo = 'catalogo_madeireira/catalogo_madeireira';

const log = (...a) => console.log(...a);

const slug = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);


async function dono() {
  const row = await db.get('SELECT * FROM admin_users WHERE is_owner=1');
  if (!row) throw Error('Crie o proprietário antes: npm run owner:create');
  return row;
}

// --- 1. Planilha de 979, como rascunho ---
async function importarPlanilhas(usuario) {
  let total = { created: 0, updated: 0 };
  for (const arquivo of planilhas) {
    const csv = readFileSync(resolve(raiz, arquivo), 'utf8');
    const previa = await previewImport(db, usuario, { mode: 'upsert', csv, draft: true });
    log(`${arquivo}: ${previa.summary.total} linhas | ${previa.summary.errors} erros | ` +
        `${previa.summary.create} criar | ${previa.summary.update} atualizar`);
    if (!previa.valid) {
      for (const e of previa.errors.slice(0, 5)) log(`  linha ${e.line} (${e.sku}): ${e.errors.join('; ')}`);
      throw Error('A prévia tem erros; corrija a planilha antes de importar.');
    }
    const resultado = await applyImport(db, usuario, { previewId: previa.id });
    log(`  aplicado: ${resultado.created} criados, ${resultado.updated} atualizados, ${resultado.newCategories} categorias novas`);
    total.created += resultado.created;
    total.updated += resultado.updated;
  }
  return total;
}

// --- 2. Catálogo antigo com fotos ---
async function importarAntigo(usuario) {
  const fonte = JSON.parse(readFileSync(resolve(raiz, catalogoAntigo, 'produtos.json'), 'utf8'));
  const produtos = fonte.produtos || fonte.products || [];
  const { saveProduct } = await import('../server/products.js');

  // Garante as categorias do catálogo antigo.
  const necessarias = [...new Set(produtos.map(p => slug(p.categoria_sugerida)))];
  for (const id of necessarias) {
    const existe = await db.get('SELECT 1 AS ok FROM categories WHERE id=?', id);
    if (!existe) {
      const label = produtos.find(p => slug(p.categoria_sugerida) === id).categoria_sugerida;
      await db.run('INSERT INTO categories(id,label,slug,sort_order) VALUES(?,?,?,0)', id, label, id);
    }
  }

  let criados = 0, comFoto = 0;
  for (const p of produtos) {
    const sku = String(p.codigo);
    if (await db.get('SELECT 1 AS ok FROM products WHERE lower(sku)=lower(?)', sku)) continue;

    let imagem = '';
    const arquivo = p.imagem ? resolve(raiz, catalogoAntigo, p.imagem) : null;
    if (arquivo && readdirSync(resolve(raiz, catalogoAntigo, 'fotos')).includes(p.imagem.split('/').pop())) {
      try {
        const bytes = readFileSync(arquivo);
        const png = await sharp(bytes).png().toBuffer();
        const enviado = await uploadImage(db, usuario, {
          name: p.imagem.split('/').pop(), type: 'image/png', data: png.toString('base64'), usage: 'photo',
        });
        imagem = enviado.url;
        comFoto++;
      } catch (erro) {
        log(`  foto ${p.imagem} falhou: ${erro.message.slice(0, 80)}`);
      }
    }

    await saveProduct(db, usuario, {
      name: p.nome, reference: sku, sku, category: slug(p.categoria_sugerida),
      price: p.preco ?? null, status: 'unavailable', active: false,
      unit: p.unidade_venda || null, description: p.descricao || '', image: imagem,
    }, undefined);
    criados++;
  }
  return { criados, comFoto, categorias: necessarias };
}

try {
  await openDatabase();
  const usuario = await dono();
  log(`importando como ${usuario.email}\n`);

  log('— planilha de 979 (rascunho) —');
  const planilha = await importarPlanilhas(usuario);
  log(`\ntotal da planilha: ${planilha.created} criados, ${planilha.updated} atualizados\n`);

  log('— catálogo antigo com fotos (rascunho) —');
  const antigo = await importarAntigo(usuario);
  log(`total do antigo: ${antigo.criados} criados, ${antigo.comFoto} com foto\n`);

  const resumo = await db.get(`SELECT
    (SELECT count(*) FROM products) AS total,
    (SELECT count(*) FROM products WHERE active=1) AS publicados,
    (SELECT count(*) FROM products WHERE image<>'') AS com_imagem,
    (SELECT count(*) FROM categories) AS categorias`);
  log('estado final:', JSON.stringify(resumo));
} catch (erro) {
  console.error('FALHOU:', erro.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
