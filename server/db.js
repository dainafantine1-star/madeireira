import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defaults } from './settings-defaults.js';

export const root = fileURLToPath(new URL('../', import.meta.url));

// Postgres has no synchronous driver, so every database call returns a promise
// and the whole application awaits. The helpers keep call sites short:
// `db.get(sql, params)`, `db.all(sql, params)`, `db.run(sql, params)`.

const connectionString = () => process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

// O schema é configurável para que os testes usem um schema descartável em vez
// de escrever no banco de produção.
export const schema = () => process.env.DATABASE_SCHEMA || 'loja';
// Nome seguro para interpolar em SQL de DDL (não é parâmetro vinculável).
export function schemaName(value = schema()) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw Error('Nome de schema inválido.');
  return value;
}

let poolPromise = null;

function criarPool(nomeSchema = schemaName()) {
  const { default: pg } = requirePg();
  const url = connectionString();
  if (!url) throw Error('Configure DATABASE_URL com a conexão do Postgres.');
  const local = /localhost|127\.0\.0\.1/.test(url);
  // O Supabase usa uma CA própria. O certificado está versionado em
  // server/certs; TLS segue verificado (rejectUnauthorized: true).
  const caPath = process.env.DATABASE_CA_PATH || fileURLToPath(new URL('./certs/supabase-ca.pem', import.meta.url));
  const ca = process.env.DATABASE_CA_CERT || (existsSync(caPath) ? readFileSync(caPath, 'utf8') : undefined);
  // Em serverless cada instância atende uma requisição por vez: um pool grande
  // só multiplicaria conexões sem uso. O Supabase aceita 60 no total, então
  // uma conexão por instância deixa margem para dezenas delas em paralelo.
  const serverless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const padrao = serverless ? 1 : 4;
  return new pg.Pool({
    connectionString: url,
    ssl: local ? false : (ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true }),
    max: Number(process.env.DATABASE_POOL_SIZE || padrao),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 20_000,
    // A loja vive no schema `loja`, isolada das tabelas do projeto legado.
    options: `-c search_path=${nomeSchema},public`,
  });
}

let pgModule = null;
function requirePg() {
  if (!pgModule) throw Error('Driver pg não carregado. Use loadDriver().');
  return pgModule;
}
export async function loadDriver() {
  if (!pgModule) pgModule = await import('pg');
  return pgModule;
}
await loadDriver();

async function pool() {
  if (!poolPromise) poolPromise = criarPool();
  return poolPromise;
}

// Banco isolado, com pool e schema próprios. Usado pelos testes para que cada
// um trabalhe num schema descartável sem compartilhar conexão com os demais.
export async function createIsolatedDatabase(nomeSchema) {
  const schemaAlvo = schemaName(nomeSchema);
  const p = criarPool(schemaAlvo);
  const exec = (sql, params = []) => p.query(positional(sql), params);
  // `banco` é dono de si mesmo, para que transaction(banco, fn) redirecione
  // as chamadas feitas nele para a conexão da transação.
  const banco = criarBancoComDono(exec);
  let fechado = false;
  return {
    db: banco,
    schema: schemaAlvo,
    transaction: (work) => transacaoEm(p, banco, work),
    async close() {
      if (fechado) return;
      fechado = true;
      await p.end();
    },
  };
}

// Conexão transacional ativa, por objeto de banco. Declarada antes de
// createDatabase, que a consulta.
const pilhaTransacional = new WeakMap();

// Normalises `?` placeholders to `$1, $2, …` so existing queries stay readable.
function positional(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// As chamadas herdadas passam os parâmetros soltos (db.get(sql, a, b)), como no
// driver SQLite. Aqui eles são reunidos num array; um array já pronto também é
// aceito, para as chamadas novas.
function params(...args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

// Cria um banco que é dono de si mesmo: dentro de transacaoEm(pool, banco, fn),
// as chamadas feitas nele passam a usar a conexão da transação.
export function criarBancoComDono(executor) {
  const banco = createDatabase(executor);
  for (const metodo of ['get', 'all', 'run', 'exec']) {
    const original = banco[metodo].bind(banco);
    banco[metodo] = (sql, ...args) => {
      const ativa = pilhaTransacional.get(banco);
      if (!ativa) return original(sql, ...args);
      return createDatabase(ativa)[metodo](sql, ...args);
    };
  }
  return banco;
}

// Executa `work` numa transação do `p` informado, redirecionando o `banco`.
export async function transacaoEm(p, banco, work) {
  const conn = await p.connect();
  const executor = (sql, params) => conn.query(positional(sql), params);
  try {
    await conn.query('BEGIN');
    const anterior = pilhaTransacional.get(banco);
    pilhaTransacional.set(banco, executor);
    try {
      const resultado = await work(createDatabase(executor));
      await conn.query('COMMIT');
      return resultado;
    } finally {
      if (anterior) pilhaTransacional.set(banco, anterior);
      else pilhaTransacional.delete(banco);
    }
  } catch (error) {
    try { await conn.query('ROLLBACK'); } catch { /* conexão perdida */ }
    throw error;
  } finally {
    conn.release();
  }
}

// Banco de fora de transação. Se este objeto estiver marcado como transacional
// (dentro de um callback de `transaction`), as chamadas vão para a conexão da
// transação, em vez do pool.
export function createDatabase(executor, dono = null) {
  const executar = (sql, params) =>
    (dono && pilhaTransacional.get(dono)) ? pilhaTransacional.get(dono)(sql, params) : executor(sql, params);
  return {
    async get(sql, ...args) { return (await executar(sql, params(...args))).rows[0]; },
    async all(sql, ...args) { return (await executar(sql, params(...args))).rows; },
    async run(sql, ...args) { return executar(sql, params(...args)); },
    async exec(sql) { return executar(sql, []); },
  };
}

async function query(sql, params) {
  const client = await pool();
  return client.query(positional(sql), params);
}

// `db` é o dono de si mesmo: dentro de transaction(db, fn), as chamadas nele
// passam a usar a conexão da transação, em vez do pool.
const db = criarBancoComDono(query);
export { db };
export default db;

// SQLite serialised writes with BEGIN IMMEDIATE; here each transaction holds
// its own client so concurrent requests never share a connection.
// Aceita as duas formas usadas no código:
//   transaction(work)        — forma nova, recebe o cliente transacional
//   transaction(db, work)    — forma herdada do SQLite, onde o db era o 1º argumento
// Na forma herdada o `db` recebido é ignorado: a transação sempre usa o cliente
// dedicado, para que escritas concorrentes não compartilhem conexão.
// Aceita as duas formas usadas no código:
//   transaction(work)       — recebe o cliente transacional
//   transaction(db, work)   — forma herdada do SQLite
//
// Na forma herdada, o `db` recebido é reaproveitado: durante o callback, as
// chamadas feitas nele passam a usar a conexão da transação. Sem isso, as
// funções internas (writeProduct, getProduct) escreveriam fora da transação e
// um erro no meio do lote deixaria alterações aplicadas.
export async function transaction(primeiro, segundo) {
  const usarHerdado = typeof primeiro !== 'function';
  const work = usarHerdado ? segundo : primeiro;
  if (typeof work !== 'function') throw TypeError('transaction exige uma função.');
  const p = await pool();
  // Rede redireciona o db recebido; sem ela, o db global, que é dono de si.
  const alvo = (usarHerdado && primeiro && typeof primeiro === 'object') ? primeiro : db;
  return transacaoEm(p, alvo, work);
}

const MIGRATION_LOCK = 8274531;

// A migração roda na primeira requisição de cada instância. Consultar a tabela
// de migrações é barato, então a maioria das chamadas não faz nada. Quando há
// trabalho, um advisory lock evita que duas instâncias apliquem ao mesmo tempo;
// ele é liberado no finally, e o Postgres também o solta se a conexão cair.
export async function migrate(database = db) {
  const schema = schemaName();
  // O schema precisa existir antes de qualquer conexão que o use no search_path.
  await database.exec(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await database.exec(`CREATE TABLE IF NOT EXISTS ${schema}.migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);

  const directory = new URL('./migrations/postgres/', import.meta.url);
  let files = [];
  try { files = readdirSync(directory).filter(n => n.endsWith('.sql')).sort(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!files.length) return;

  const aplicadas = new Set((await database.all(`SELECT name FROM ${schema}.migrations`)).map(r => r.name));
  if (files.every(n => aplicadas.has(n))) return;

  // Só as instâncias que realmente têm algo a aplicar disputam o lock.
  await database.exec(`SELECT pg_advisory_lock(${MIGRATION_LOCK})`);
  try {
    for (const name of files) {
      if (await database.get(`SELECT 1 AS applied FROM ${schema}.migrations WHERE name=?`, [name])) continue;
      // O schema já pode ter sido aplicado pelo painel do Supabase: nesse caso
      // apenas registra a migração, sem recriar as tabelas.
      const existente = await database.get('SELECT 1 AS found FROM information_schema.tables WHERE table_schema=? AND table_name=?', [schema, 'products']);
      if (name === '001-schema.sql' && existente) {
        await database.run(`INSERT INTO ${schema}.migrations(name) VALUES(?) ON CONFLICT (name) DO NOTHING`, [name]);
        continue;
      }
      // O arquivo de migração nomeia o schema de produção; para um schema
      // descartável (testes) o nome é reescrito antes da execução.
      const sql = readFileSync(new URL(name, directory), 'utf8')
        .replaceAll('loja.', `${schema}.`)
        .replace('CREATE SCHEMA IF NOT EXISTS loja', `CREATE SCHEMA IF NOT EXISTS ${schema}`);
      await database.exec(sql);
      await database.run(`INSERT INTO ${schema}.migrations(name) VALUES(?)`, [name]);
    }
  } finally {
    await database.exec(`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`);
  }
}

export async function seed(database = db) {
  if (await database.get('SELECT 1 AS found FROM company_settings WHERE id=1')) return false;
  // Company setup seeds categories only; catalog data is imported explicitly.
  const categories = JSON.parse(readFileSync(new URL('./seed-categories.json', import.meta.url), 'utf8'));
  await transaction(async tx => {
    for (const c of categories.filter(c => c.id !== 'todas')) {
      await tx.run('INSERT INTO categories(id,label,slug) VALUES(?,?,?) ON CONFLICT (id) DO NOTHING', [c.id, c.label, c.id]);
    }
    await tx.run('INSERT INTO company_settings(id,public_json) VALUES(1,?)', [JSON.stringify({
      name: 'Madeireira Progresso', whatsapp: '5500000000000', phone: '(XX) XXXXX-XXXX', address: 'Av. Exemplo, 1234 — Centro',
      hours: 'Seg a Sex — 7h30 às 18h\nSáb — 7h30 às 12h', confirmed: false,
      delivery: 'Prazo, região atendida e frete sob consulta.', payment: 'Formas de pagamento e parcelamento sob consulta.',
      commercialTerms: 'Preços provisórios. Descontos, disponibilidade, frete, prazo e pagamento sujeitos à confirmação.',
    })]);
    const banners = [
      ['CATÁLOGO', 'Madeira para sua obra', 'Conheça os produtos e solicite seu orçamento.'],
      ['ENTREGA', 'Consulte a entrega', 'Informe seu endereço para confirmar prazo e valor do frete.'],
      ['ORÇAMENTO', 'Converse com a equipe', 'Confirme preços e condições de pagamento antes de fechar seu pedido.'],
    ];
    for (const [i, banner] of banners.entries()) {
      await tx.run('INSERT INTO banners(tag,title,body,sort_order) VALUES(?,?,?,?)', [...banner, i]);
    }
    await tx.run("INSERT INTO banners(tag,title,body,image,placement) VALUES('HOME','Banner principal da home','','','home')");
  });
  return true;
}

// A inicialização roda a cada requisição em serverless. Uma vez concluída com
// sucesso nesta instância, não precisa repetir as consultas de verificação.
let inicializado = null;
export async function openDatabase({ runMigrations = true } = {}) {
  if (!inicializado) {
    inicializado = (async () => {
      if (runMigrations) await migrate();
      await seed();
      return db;
    })().catch(error => {
      // Falha não fica memorizada: a próxima requisição tenta de novo.
      inicializado = null;
      throw error;
    });
  }
  return inicializado;
}

export async function closeDatabase() {
  inicializado = null;
  if (!poolPromise) return;
  const current = await poolPromise;
  await current.end();
  poolPromise = null;
}

export async function settings(database = db) {
  const row = await database.get('SELECT public_json,version FROM company_settings WHERE id=1');
  if (!row) throw Error('Configuração da empresa ausente.');
  const stored = JSON.parse(row.public_json);
  // Explicit public fields: future internal keys must never leak through public APIs.
  const keys = [...Object.keys(defaults), 'name', 'whatsapp', 'phone', 'address', 'hours', 'confirmed', 'delivery', 'payment', 'commercialTerms'];
  return { ...defaults, ...Object.fromEntries(keys.filter(k => Object.hasOwn(stored, k)).map(k => [k, stored[k]])), version: row.version };
}

export function productDTO(row) {
  return {
    id: row.id, reference: row.reference, name: row.name, category: row.category_id, categoryLabel: row.category_label,
    price: row.price_cents === null ? null : row.price_cents / 100,
    oldPrice: row.old_price_cents === null ? null : row.old_price_cents / 100,
    offer: row.status === 'promotion' && row.old_price_cents !== null && row.price_cents !== null,
    description: row.description, specs: JSON.parse(row.specs_json),
    image: row.image, images: JSON.parse(row.images_json || '[]'), shortDescription: row.short_description || '',
    commercialTerms: row.commercial_terms, active: !!row.active, sku: row.sku, dimensions: row.dimensions,
    lengthMm: row.length_mm, unit: row.unit, status: row.status, featured: !!row.featured,
    stock: row.stock_milli == null ? null : row.stock_milli / 1000, lowStock: row.low_stock, version: row.version,
    categoryActive: row.category_active !== 0,
    available: !!row.active && row.category_active !== 0 && row.status !== 'unavailable' && row.stock_milli !== 0 && row.unit != null,
  };
}

export async function catalog(database = db) {
  const company = await settings(database);
  const products = await database.all(
    'SELECT p.*, c.label AS category_label FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=1 AND p.deleted_at IS NULL AND c.active=1 ORDER BY p.featured DESC,p.id');
  return {
    products: products.filter(p => company.stockZeroBehavior !== 'hide' || p.stock_milli !== 0).map(productDTO),
    categories: await database.all('SELECT id,label,slug,image,icon,sort_order FROM categories WHERE active=1 ORDER BY sort_order,id'),
    media: await database.all('SELECT m.filename,m.width AS original_width,v.width FROM media m LEFT JOIN media_variants v ON v.media_id=m.id ORDER BY m.filename,v.width'),
    banners: await database.all("SELECT id,tag,title,body,image,image_mobile,cta,destination,placement,active,expires_at FROM banners WHERE (active=1 OR placement='home') AND (expires_at IS NULL OR expires_at='' OR expires_at>?) ORDER BY sort_order,id", [new Date().toISOString()]),
    settings: company,
  };
}
