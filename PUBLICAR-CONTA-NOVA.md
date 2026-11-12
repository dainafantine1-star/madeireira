# Publicar na conta nova da Vercel

O projeto roda hoje só em localhost. A conta antiga está bloqueada por cota até 10/12/2026, então a publicação é numa conta nova.

## Antes de começar

| Item | Como obter |
|---|---|
| Conta Vercel nova | A mesma pessoa deve ser dona do domínio e do projeto |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI, porta 5432) |
| `SUPABASE_URL` | `https://xjtvclijmyxqtvliowzk.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key |
| `BACKUP_KEY` | Gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

A senha do banco também é obtida em Project Settings → Database, caso precise resetá-la.

## Variáveis de ambiente no projeto novo

| Nome | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:SENHA@db.xjtvclijmyxqtvliowzk.supabase.co:5432/postgres` |
| `DATABASE_POOL_SIZE` | `1` (serverless; o Supabase aceita 60 no total) |
| `SUPABASE_URL` | `https://xjtvclijmyxqtvliowzk.supabase.co` |
| `SUPABASE_SECRET_KEY` | a chave secreta do Supabase |
| `BACKUP_KEY` | os 32 bytes em base64 |
| `PUBLIC_ORIGIN` | `https://SEU-DOMINIO` (sem barra final) |
| `ADMIN_ORIGIN` | `https://admin.SEU-DOMINIO`, se usar subdomínio |
| `NODE_ENV` | `production` |

**Não** defina `DATABASE_SCHEMA`: o padrão `loja` é o correto.

## Passos

1. `vercel link` na pasta do projeto, criando um projeto novo na conta nova.
2. Cadastrar as variáveis acima em **Settings → Environment Variables**, no ambiente **Production**.
3. `vercel --prod`.
4. Conferir: `GET /api/health` deve responder 200 e `GET /api/catalog` deve listar as categorias.
5. Cadastrar o domínio em **Settings → Domains** e ajustar o DNS.

## Domínio

O `madeireiraprogresso.com` está apontado para a conta antiga no DNS da Hostinger. Para mover:

| Tipo | Nome | Valor |
|---|---|---|
| A | @ | o IP que a Vercel indicar para o projeto novo |
| CNAME | admin | o destino que a Vercel indicar |

O `madeireiraprogresso.com.br` **não** deve ser tocado: pertence a outra empresa (Joitech).

## Depois de publicar

```powershell
# criar o proprietário (exige terminal interativo)
npm run owner:create
```

Os 1.014 produtos já estão importados, todos como **não publicados**. Para a loja mostrar algo, publique no painel os que estiverem com preço e unidade conferidos.

## Se algo falhar

| Sintoma | Causa provável |
|---|---|
| 503 em tudo | `DATABASE_URL` ausente ou senha errada |
| `self signed certificate` | faltou `server/certs/supabase-ca.pem` no bundle (está em `includeFiles` do `vercel.json`) |
| `too many connections` | `DATABASE_POOL_SIZE` maior que 1 |
| Imagem não sobe | `SUPABASE_SECRET_KEY` ausente ou bucket sem permissão |
