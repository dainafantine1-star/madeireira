# Madeireira Progresso

Nova vitrine, páginas de produto na mesma aba, cálculo de metragem e cadastro com galeria: [REFORMULACAO-LOJA.md](REFORMULACAO-LOJA.md).

Refinamento aprovado da loja pública, alterações por arquivo e checklist de conteúdo real: [REFINAMENTO-VISUAL.md](REFINAMENTO-VISUAL.md).

Revisão de segurança, correções aplicadas e pendências de produção: [REVISAO-SEGURANCA.md](REVISAO-SEGURANCA.md).

Métricas e relatórios com períodos em America/Bahia, exportação CSV e dados persistidos: [METRICAS.md](METRICAS.md). Publicação, backups criptografados, restauração, rollback, cache e metas de desempenho: [OPERACAO.md](OPERACAO.md).

Resultados executados e pendências de homologação: [VALIDACAO.md](VALIDACAO.md).

Validação: `npm test`, `npm run browsers:install`, `npm run test:browsers`, `npm run check:performance`. Os testes usam dados isolados. Backups manuais: `npm run backup:create`; recuperação em diretório novo: `npm run backup:restore -- arquivo.mpbackup destino-novo`. A execução normal agenda backup na inicialização e a cada 24 horas; configure a chave e armazenamento externo antes da produção.

Experiência pública, clientes, atendimento com protocolo, campanhas e configurações: consulte [COMERCIAL.md](COMERCIAL.md). O ajuste final ao manual visual aguarda o PDF informado pelo usuário.

Loja com orçamento pelo WhatsApp, painel administrativo em `/admin`, servidor Node.js 24 e banco SQLite persistente. O servidor entrega a página, o painel e a API na mesma origem. O Sharp valida e otimiza as imagens enviadas.

## Executar localmente

Com Node.js 24 instalado:

```powershell
Copy-Item .env.example .env
npm ci
npm start
```

Abra `http://localhost:3000`. As migrations e a importação inicial do catálogo são automáticas. O banco fica em `storage/store.sqlite`. O catálogo antigo em `js/data.js` serve apenas como semente inicial; a loja lê produtos, categorias, banners e configurações do banco pela API. Alterar a semente depois da primeira execução não altera o banco existente.

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd start`, `npm.cmd test` e `npm.cmd run admin:create`, ou inicie diretamente com `node --env-file-if-exists=.env server/index.js`.

```powershell
npm test
```

Os testes usam bancos temporários e não alteram o catálogo da loja. O teste de navegador usa o Microsoft Edge quando disponível, podendo definir seu caminho em `EDGE_PATH`.

## Situação dos dados comerciais

Conforme solicitado, telefone, endereço, horários e preços originais foram preservados como provisórios. O WhatsApp `5500000000000` é inválido e não abre conversa até ser substituído. Os banners com desconto de 15%, frete grátis, entrega em 24h e 12x sem juros foram substituídos por condições sob consulta. Descontos antigos não são ativados na importação.

Antes de divulgar, substituir e confirmar todos os dados em `PUT /api/admin/settings`, revisar preços e especificações (inclusive garantias) dos produtos e definir `confirmed: true`. Esse campo registra a confirmação da empresa; o formato válido do número, sozinho, não comprova que ele pertence à loja.

Produtos com preço desconhecido usam `price: null` e aparecem como **Sob consulta**. Zero e preços negativos são rejeitados. Um orçamento com itens sem preço tem `total: null` e subtotal separado, sem somar itens desconhecidos como gratuitos.

## Administrador e autenticação

Para criar o primeiro **proprietário**, execute em um terminal interativo no servidor:

```powershell
npm.cmd run owner:create
```

O comando solicita e-mail e senha oculta, confirma a senha, aceita uma única conta de proprietário e registra a criação na auditoria. Não existe senha padrão, segredo gravado em arquivo pelo procedimento ou endpoint público de cadastro inicial. Não foi criada uma conta real automaticamente. Depois, entre em `http://localhost:3000/admin` e gerencie os demais acessos em **Equipe e acessos**. O comando legado `admin:create` cria administradores comuns, não proprietários.

O painel usa cookie HttpOnly, SameSite=Strict e Secure em produção, com sessão de oito horas. O identificador da sessão fica apenas em hash no banco. Requisições que alteram dados exigem token CSRF e origem compatível. Tokens e senhas não são persistidos em localStorage/sessionStorage. Logout, alteração de senha e revogação encerram sessões; contas desativadas são bloqueadas imediatamente. Senhas são armazenadas com scrypt e sal aleatório. Para clientes de API já existentes, o login sem `session: "cookie"` mantém a autenticação Bearer; o painel usa `session: "cookie"` e não recebe o token da sessão no JSON.

O proprietário tem acesso completo e não pode ser desativado/rebaixado pelo painel. Somente ele gerencia acessos. Administradores gerenciam catálogo, configurações e auditoria; editores gerenciam catálogo, imagens e negociações. As permissões são conferidas no servidor para desktop e celular. Consulte o [guia do painel](ADMIN.md) para estoque, importação, exportação WooCommerce, imagens e endpoints adicionais.

## API

Todas as mutações recebem `Content-Type: application/json`. Erros retornam `{ "error": "mensagem" }` e status HTTP adequado. POSTs do navegador só aceitam a mesma origem. O backend limita requisições e tentativas de login; não confia em cabeçalhos arbitrários de IP.

| Endpoint | Operação |
|---|---|
| `GET /api/health` | Saúde do servidor e banco |
| `GET /api/catalog` | Produtos ativos, categorias, banners e dados públicos |
| `GET /api/settings` | Configurações públicas da empresa |
| `POST /api/quotes` | Criar orçamento e mensagem de WhatsApp |
| `POST /api/events` | Registrar `catalog_view`, `product_view` ou `whatsapp_click` |
| `GET /api/admin/catalog` | Catálogo administrativo incluindo inativos |
| `GET, POST /api/admin/products` | Listar e cadastrar produtos |
| `GET, PUT, PATCH, DELETE /api/admin/products/:id` | Consultar, editar, atalhos ou excluir preservando histórico |
| `GET, POST /api/admin/categories` | Listar e cadastrar categorias |
| `PUT /api/admin/categories/:id` | Atualizar ou desativar categoria |
| `GET, POST /api/admin/banners` | Listar e cadastrar banners |
| `PUT /api/admin/banners/:id` | Atualizar ou desativar banner |
| `PUT /api/admin/settings` | Atualizar dados públicos da empresa |
| `GET, POST /api/admin/customers` | Listar últimos 200 clientes e cadastrar |
| `GET /api/admin/orders` | Listar últimas 200 negociações |
| `GET, PUT /api/admin/orders/:id` | Consultar itens ou alterar status, tipo e cliente |
| `GET, POST /api/admin/users` | Listar e cadastrar acessos (somente proprietário) |
| `GET /api/admin/metrics` | Contagem diária de eventos dos últimos 30 dias |

Produto (`POST` e `PUT` recebem o objeto completo):

```json
{
  "reference": "MP-0011", "sku": "MP-0011", "name": "Tábua sob medida",
  "category": "tabuas", "price": null, "oldPrice": null,
  "description": "Consulte as medidas disponíveis.",
  "specs": { "Medida": "Sob consulta" }, "image": "",
  "commercialTerms": "Preço e entrega sujeitos à confirmação.", "active": true,
  "dimensions": "30 × 2 cm", "lengthMm": 3000, "unit": "un",
  "status": "active", "featured": false, "stock": null, "lowStock": 5
}
```

Categoria: `{ "id": "tabuas", "label": "Tábuas", "active": true }`. Banner: `{ "tag": "CATÁLOGO", "title": "Título", "body": "Texto", "sortOrder": 0, "active": true }`.

Configurações (`PUT` completo): `name`, `whatsapp` (país + DDD + número, somente dígitos), `phone`, `address`, `hours`, `delivery`, `payment`, `commercialTerms` e `confirmed` (booleano). Campos desconhecidos são descartados; credenciais ficam exclusivamente no ambiente e nas tabelas privadas de autenticação.

Orçamento público:

```json
{
  "requestKey": "UUID-ALEATORIO-POR-TENTATIVA",
  "customer": { "name": "Nome do cliente", "phone": "71999998888" },
  "items": [{ "id": 1, "qty": 2 }]
}
```

A mesma chave e o mesmo conteúdo normalizado retornam o protocolo existente; reutilizar a chave com outros dados retorna 409. Unidade e pacote exigem quantidades inteiras; m, m² e m³ aceitam até três casas decimais. O limite por item é configurável (padrão 99). Preços e estoque são revalidados no servidor. Produtos, medidas, condições e contato informado são preservados em snapshots. A solicitação aparece no painel antes da opção de continuar no WhatsApp, sem depender da abertura da conversa.

Atualização de negociação: `{ "version": 1, "stage": "in_progress", "assignedTo": null, "finalTotal": null, "note": "Atendimento iniciado" }`. Estágios e regras em COMERCIAL.md. Aprovação transforma o registro em pedido sem duplicá-lo. O cliente é associado no registro da solicitação; não existe consulta pública de histórico ou login público de cliente.

## Hospedagem e operação

**Definida:** serviço Node.js 24 com SQLite em disco persistente, uma instância. `render.yaml` prepara um Web Service Render com disco em `/var/data` e health check. A criação do serviço e a contratação do plano/disco ainda precisam ser feitas na conta da empresa. Não houve publicação ou contratação automática.

No Render, configure `PUBLIC_ORIGIN=https://seu-dominio` sem barra final antes de iniciar, e mantenha o arquivo do banco em `/var/data/store.sqlite`. O template usa `HOST=0.0.0.0` e `DATABASE_PATH` persistente. Em VPS, use essas mesmas variáveis, TLS em proxy reverso e diretório persistente com acesso restrito. Não execute o banco em pasta sincronizada do OneDrive em produção nem em sistema de arquivos efêmero.

O GitHub Pages atual não executa a API. A versão nova deve ser servida pelo Node, com a página e `/api` no mesmo domínio. Abrir `index.html` diretamente ou publicar somente os arquivos estáticos não disponibiliza o catálogo. Não faça push para a publicação atual sem preparar a nova hospedagem.

Faça backups consistentes com a API `backup` do SQLite/Node ou com o servidor parado, incluindo o estado WAL quando aplicável, e inclua o diretório de uploads. Guarde as cópias fora do disco principal e teste a restauração. Não copie apenas o arquivo principal enquanto houver gravações. Para múltiplas instâncias, migrar para PostgreSQL e armazenamento compartilhado de imagens antes de escalar horizontalmente. Planejar retenção dos eventos conforme o volume da loja. Limites por IP usam a conexão direta; caso exista proxy reverso, configure limites na borda de acordo com a infraestrutura e o volume, sem confiar em cabeçalhos arbitrários do cliente.

Referências: [SQLite no Node 24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [discos persistentes no Render](https://render.com/docs/disks).
