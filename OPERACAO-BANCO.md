# Operação — banco no Supabase

Este projeto **não usa mais SQLite nem o Vercel Blob**. O banco é Postgres (Supabase) e as imagens ficam no Supabase Storage.

## Onde está cada coisa

| Recurso | Onde | Observação |
|---|---|---|
| Banco | Supabase, schema **`loja`** | O schema `public` pertence a outro projeto e não deve ser tocado |
| Imagens | Supabase Storage | Buckets `produtos`, `banners`, `categorias`, `avatars` |
| Backup | Bucket `avatars`, pasta `backups/` | Criptografado com `BACKUP_KEY` |

## Migrações

**Quem aplica:** o próprio app, na primeira requisição de cada instância de função (`server/db.js` → `migrate()`).

- Os arquivos ficam em `server/migrations/postgres/`, em ordem alfabética.
- O controle fica em `loja.migrations`.
- Um advisory lock do Postgres impede que duas instâncias apliquem ao mesmo tempo.
- O schema de produção é `loja`; o nome pode ser trocado por `DATABASE_SCHEMA` (usado pelos testes).

**Não use `supabase db push` neste projeto.** Três motivos:

1. A CLI rastreia migrações em `supabase_migrations.schema_migrations`, um histórico separado do `loja.migrations` — os dois podem divergir.
2. As migrações nomeiam o schema `loja`, e a CLI trabalha no `public`.
3. A pasta `supabase/` existe apenas no projeto Next.js legado, com migrações de outro sistema.

## Variáveis de ambiente

| Variável | Para quê | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Conexão do Postgres (porta 5432) | sim |
| `SUPABASE_URL` | Endereço do projeto | sim |
| `SUPABASE_SECRET_KEY` | Upload de imagens e backup | sim |
| `PUBLIC_ORIGIN` | Origem da loja (mutações) | sim |
| `ADMIN_ORIGIN` | Origem do painel | em produção |
| `BACKUP_KEY` | Criptografia dos backups, 32 bytes em base64 | em produção |
| `DATABASE_SCHEMA` | Schema alvo | não (padrão `loja`) |
| `DATABASE_POOL_SIZE` | Conexões por instância | não (padrão 4) |

## TLS

O Supabase usa uma CA própria. O certificado está versionado em `server/certs/supabase-ca.pem` e a verificação **permanece ativa** (`rejectUnauthorized: true`). Não desative a verificação: troque o arquivo por outra CA, se o provedor mudar.

## Testes

`npm test` roda contra o mesmo Supabase, mas **cada teste usa um schema temporário próprio**, criado e removido dentro do teste. Nada é escrito em `loja`.

Se um teste falhar no meio, pode restar um schema `loja_t_*` órfão. Para limpar:

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'loja_t_%';
DROP SCHEMA loja_t_xxxxxxxx CASCADE;
```

## Primeiro acesso

```powershell
npm run owner:create
```

Não existe senha padrão nem endpoint público de cadastro. O comando exige terminal interativo.

## Backup e restauração

- Agendado: o cron da Vercel chama `/api/cron/backup` às 6h.
- Manual: `npm run backup:create`.
- Restaurar: `npm run backup:restore -- arquivo.mpbackup destino-novo`.
- O backup é um **dump SQL** (formato 2). Backups antigos no formato 1 continham um arquivo SQLite e exigem importação manual.
