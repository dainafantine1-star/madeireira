import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { createIsolatedDatabase } from '../../server/db.js';

// Cada teste recebe um schema descartável próprio, criado ao abrir e removido
// ao fechar. Assim os testes nunca escrevem no schema de produção e podem rodar
// em paralelo sem colidir.

const certPath = new URL('../../server/certs/supabase-ca.pem', import.meta.url);

// O driver SQLite devolvia count() e inteiros grandes como `number`; o pg devolve
// int8 (bigint) como string. Restaurar o tipo mantém as asserções exatamente como
// foram escritas para o driver antigo, sem alterar nenhuma delas.
pg.types.setTypeParser(20, value => (value === null ? null : Number(value)));

function cliente() {
  const url = process.env.DATABASE_URL;
  if (!url) throw Error('Configure DATABASE_URL para rodar os testes.');
  let ca;
  try { ca = readFileSync(certPath, 'utf8'); } catch { /* Postgres local não usa CA */ }
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new pg.Client({
    connectionString: url,
    ssl: local ? false : (ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true }),
  });
}

// Aplica as migrações de produção num schema alternativo, renomeando o prefixo.
async function migrar(connection, schema) {
  const { readdirSync } = await import('node:fs');
  const directory = new URL('../../server/migrations/postgres/', import.meta.url);
  await connection.query(`CREATE SCHEMA ${schema}`);
  await connection.query(`CREATE TABLE ${schema}.migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for (const name of readdirSync(directory).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(name, directory), 'utf8')
      .replaceAll('loja.', `${schema}.`)
      .replace('CREATE SCHEMA IF NOT EXISTS loja', `CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await connection.query(sql);
    await connection.query(`INSERT INTO ${schema}.migrations(name) VALUES($1)`, [name]);
  }
}

// Semeia a configuração inicial e, por opção, o catálogo de demonstração.
async function semear(banco, schema, { demo = true } = {}) {
  // `seed` abre a própria transação no pool global de db.js, que lê
  // DATABASE_SCHEMA. O schema já está apontado para este teste em openDatabase().
  const { seed } = await import('../../server/db.js');
  await seed(banco);
  if (!demo) return;
  const products = runInNewContext(readFileSync(new URL('./demo-catalog.js', import.meta.url), 'utf8') + ';PRODUCTS');
  for (const p of products) {
    await banco.run(
      'INSERT INTO products(id,reference,sku,name,category_id,price_cents,description,specs_json,image,unit) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING',
      p.id, `MP-${String(p.id).padStart(4, '0')}`, `MP-${String(p.id).padStart(4, '0')}`,
      p.name, p.category, Math.round(p.price * 100), p.description, JSON.stringify(p.specs), p.image, 'un');
  }
  // O seed usa IDs explícitos nos produtos, o que deixa a sequência da identidade
  // para trás; sem reposicioná-la o primeiro INSERT da aplicação colide com id=1.
  await banco.exec(`SELECT setval(pg_get_serial_sequence('${schema}.products','id'), coalesce((SELECT max(id) FROM ${schema}.products),1))`);
}

// Devolve um `db` isolado, já migrado e semeado. O teste chama fechar() no after.
export async function openDatabase(_ignorado, opcoes = {}) {
  const schema = 'loja_t_' + randomBytes(4).toString('hex');
  const connection = cliente();
  await connection.connect();
  try {
    await migrar(connection, schema);
  } catch (error) {
    await connection.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await connection.end();
    throw error;
  }

  const isolado = await createIsolatedDatabase(schema);
  // Alguns caminhos do servidor (seed, transaction) usam o pool global de db.js,
  // que resolve o schema por DATABASE_SCHEMA. Apontá-lo para este schema garante
  // que nenhum caminho de teste alcance o schema `loja` de produção.
  const anterior = process.env.DATABASE_SCHEMA;
  process.env.DATABASE_SCHEMA = schema;
  const { closeDatabase } = await import('../../server/db.js');
  // O pool global nasce uma vez por processo: fechá-lo força a recriação já com
  // o search_path deste teste, em vez de herdar o do primeiro que abriu.
  await closeDatabase();
  try {
    await semear(isolado.db, schema, opcoes);
  } catch (error) {
    await closeDatabase();
    await isolado.close();
    await connection.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await connection.end();
    throw error;
  }

  const fechar = async () => {
    await closeDatabase();
    await isolado.close();
    await connection.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await connection.end();
    // Sem a variável, db.js volta ao padrão (`loja`); não deixar a string
    // "undefined" nem o schema já removido apontados no ambiente.
    if (anterior === undefined) delete process.env.DATABASE_SCHEMA;
    else process.env.DATABASE_SCHEMA = anterior;
  };
  // Compatível com o padrão anterior: t.after(() => db.close()) e db.fechar().
  isolado.db.close = fechar;
  // Nome do schema descartável, para quem precisa consultá-lo por fora do pool.
  isolado.db.schema = schema;
  return isolado.db;
}
