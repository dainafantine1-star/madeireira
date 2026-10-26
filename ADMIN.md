# Painel administrativo · Blocos 3 e 4

## Primeiro acesso

1. Instale as dependências com `npm.cmd ci` e inicie com `npm.cmd start`.
2. Em outro terminal, na mesma pasta e com o mesmo `DATABASE_PATH`, execute `npm.cmd run owner:create`.
3. Informe e-mail, senha de pelo menos 12 caracteres e confirmação. A senha não aparece no terminal.
4. Abra `http://localhost:3000/admin`. Não existe conta/senha padrão. O procedimento só cria um proprietário.

O banco existente recebe a migration `002-management.sql` sem apagar produtos, categorias, clientes ou negociações. Contas administrativas anteriores continuam administrativas; nenhuma vira proprietária automaticamente. Caso já exista conta com o e-mail escolhido, use outro e-mail para o primeiro proprietário.

## Operação no painel

Desktop: menu lateral, indicadores de produtos/estoque, abas de categorias com contagens reais e tabela. Celular: navegação inferior, novo produto rápido, cards, atalhos de editar/preço/duplicar/excluir e switch de disponibilidade. Equipe, histórico, empresa e importação ficam em **Mais** no celular.

Colunas da tabela: seleção, produto/SKU/código, categoria, preço/unidade, estoque, status, destaque e ações. A busca considera nome, SKU e referência. Filtros: categoria, status, destaque, estoque baixo/zerado/sem controle e preço definido/sob consulta. Ordenação por recente, nome, estoque ou preço. Paginação de 10, 20, 50 ou 100 registros. A seleção funciona entre páginas; mudanças de filtros limpam a seleção para evitar ações em itens ocultos inadvertidamente.

**Mais ações:** exportar todos para WooCommerce, importar CSV, baixar modelo e atualizar lista. Atalhos por produto: editar, alterar preço, duplicar (cria rascunho com novo SKU obrigatório) e excluir. A alteração rápida de preço encerra promoção anterior, conforme informado no formulário.

Produtos possuem SKU único sem diferenciar maiúsculas/minúsculas, referência, descrição, categoria, dimensões livres, comprimento inteiro em milímetros, unidade (`un`, `m`, `m2`, `m3`, `pacote`), especificações, preço ou sob consulta, preço anterior, condição comercial, estoque, limiar de alerta, publicação, status e destaque. Campos de unidades antigos recebem `un` e precisam ser revisados junto aos dados comerciais reais.

O cadastro completo mostra produto e imagem atuais. O formulário impede salvar com campos obrigatórios ausentes e exibe erros do servidor sem perder o preenchimento. Conflitos de versão retornam 409; recarregue o produto e reaplique a alteração para não sobrescrever trabalho de outra pessoa.

## Disponibilidade, estoque e histórico

- **Publicado:** define se o produto pode aparecer na loja. Categoria desativada também oculta seus produtos.
- **Status:** disponível, promoção ou indisponível. Promoção exige preço anterior maior que o atual. Destaque é independente de promoção.
- **Sem controle de estoque:** quantidade `null`; não presume uma quantidade fictícia. Estoque controlado parte de zero; unidades/pacotes s?o inteiros e metros, m? e m? aceitam at? tr?s casas decimais.
- **Estoque zero:** produto publicado permanece visível como indisponível; botões ficam desabilitados. Servidor rejeita o envio de novos orçamentos e quantidades maiores que o estoque. O switch não repõe estoque: ajuste a quantidade no cadastro.
- **Estoque baixo:** quantidade positiva até o limiar do produto. Indicadores e filtros permitem localizar os itens.
- **Orçamentos não reservam nem baixam estoque automaticamente.** A equipe atualiza as quantidades no cadastro conforme sua operação; baixa automática de venda/integração logística não integra estes blocos.
- Exclusão exige confirmação e é lógica: retira o cadastro das listagens e da loja, preservando vínculos e snapshots de negociações. O SKU não é reutilizado indevidamente.
- Alterações são lidas diretamente do banco. A loja consulta novamente a cada 30 segundos enquanto visível e ao recuperar foco; envio de orçamento sempre revalida disponibilidade/preço no servidor. Não é necessário editar arquivos ou republicar.

Auditoria registra responsável (ID e e-mail), data UTC, operação, entidade, valores anteriores e novos, inclusive preço, estoque, exclusão, categoria, importação, usuários e imagens. **Histórico de alterações → Ver valores** mostra os detalhes. Não registra senhas ou tokens. A API não oferece exclusão/edição da auditoria e o banco bloqueia essas operações por triggers.

## Ações em lote

Selecione até 100 produtos e escolha destacar, retirar destaque, publicar, retirar publicação, disponibilizar, indisponibilizar, definir preço ou excluir. O painel pede confirmação. A alteração de preço em lote aceita valor ou sob consulta e encerra promoções anteriores. Operações são transacionais: produto inválido ou versão divergente impede toda a gravação. Cada produto alterado gera registro de auditoria.

## Imagens

Upload de JPEG, PNG ou WebP, até 5 MB e 24 milhões de pixels. O servidor verifica o formato decodificado, rejeita divergência de MIME/conteúdo e arquivos inválidos/animados, decodifica, remove metadados e grava WebP de até 1800 × 1800. SVG e arquivos executáveis não são aceitos. O nome físico é aleatório; arquivos não usam o nome enviado como caminho.

O diretório padrão é `storage/uploads`. Em produção, configure `UPLOAD_DIR=/var/data/uploads`, já previsto em `render.yaml`, e inclua-o no backup. A biblioteca permite reutilizar imagens e excluir as sem vínculo; substituir a imagem não apaga automaticamente a anterior. Imagens associadas a produtos/categorias (inclusive registros históricos excluídos logicamente) não podem ser apagadas da biblioteca até remover o vínculo. O servidor só serve uploads cadastrados como mídia.

## Importar CSV do painel

Em **Mais ações → Importar planilha CSV**, baixe o modelo. Formato UTF-8 com cabeçalho, separado por vírgula ou ponto e vírgula; aspas delimitam campos contendo separador ou quebras de linha. Até 500 produtos e 1 MB por arquivo. A prévia numera os registros do arquivo (campos com quebras de linha contam como um registro).

Colunas do modelo:

```text
sku,name,reference,category,price,oldPrice,stock,lowStock,status,active,featured,dimensions,lengthMm,unit,description,image,commercialTerms
```

Obrigatórias no cabeçalho: `sku`, `name`, `category`, `price`. Use o identificador da categoria existente (por exemplo, `tabuas`), não um nome inventado. Valores monetários aceitam ponto ou vírgula decimal, sem separador de milhar ou símbolo R$. `price` vazio = sob consulta; `stock` vazio = sem controle. Quantidades e comprimento são inteiros. Booleanos: `0`/`1` (também `false`/`true`). `status`: `active`, `promotion`, `unavailable`. Promoção requer `oldPrice` maior que `price`.

Modos: somente criar, somente atualizar por SKU, ou criar e atualizar. Não há sobrescrita silenciosa: os SKUs existentes são identificados na prévia e o modo escolhido define se podem ser atualizados. Para atualizar, preencha todos os campos comerciais desejados usando o modelo; células vazias não significam genericamente “manter valor”. Imagem e especificações existentes são preservadas quando não fornecidas.

A prévia lista criação/atualização e erros por registro: SKU repetido, categoria inexistente, preço/quantidade inválidos, status incoerente e duplicidade com banco. Nada é gravado em produtos até confirmar. Todos os erros impedem aplicação. A prévia pertence ao usuário, expira em 15 minutos, é revalidada no servidor e não pode ser aplicada por outro acesso. Mudanças concorrentes exigem nova prévia. Repetir a aplicação da mesma prévia retorna o resumo anterior, sem duplicar produtos. A gravação inteira e a auditoria ocorrem na mesma transação.

## Exportar todos para WooCommerce

**Mais ações → Exportar todos · WooCommerce CSV** baixa `produtos-woocommerce.csv` com todos os produtos não excluídos, independentemente da busca, filtro ou página. Produtos não publicados e categorias desativadas saem como rascunho (`Published=-1`). O arquivo usa UTF-8 com BOM, aspas e cabeçalhos do importador padrão do WooCommerce: `Type`, `SKU`, `Name`, `Published`, `Is featured?`, `Visibility in catalog`, `Description`, `In stock?`, `Stock`, `Low stock amount`, `Backorders allowed?`, `Regular price`, `Sale price`, `Categories`, `Images` e `Length (cm)`.

Não são exportados IDs locais como IDs do WordPress, evitando colisões no destino. Use SKU para identificar produtos. Promoção: preço anterior em `Regular price` e preço atual em `Sale price`. Sob consulta: preços vazios, nunca zero. Unidade e dimensões seguem como atributos visíveis; código, condições e indicador de preço sob consulta seguem como `Meta: mp_*`. Comprimento é convertido de milímetros para centímetros. Valores de texto que poderiam virar fórmulas em Excel recebem apóstrofo de proteção.

O CSV é preparado para o importador **padrão** do WooCommerce; extensões comerciais podem exigir mapeamento próprio. WooCommerce não implementa automaticamente a experiência de “Sob consulta” ou cobrança por metro apenas por receber atributos/metadados: configure essas regras no destino. Imagens locais viram URLs absolutas da loja; precisam estar publicamente acessíveis ao WooCommerce durante a importação. Não use URLs localhost para migração real. A importação do próprio painel usa o modelo próprio e não faz reimportação do formato WooCommerce.

Referência do formato: [importador e exportador oficial WooCommerce](https://woocommerce.com/document/product-csv-importer-exporter/).

## Sessões e endpoints adicionais

Login do painel: `POST /api/admin/login` com `email`, `password`, `session: "cookie"`. `GET /api/admin/me` retorna perfil, expiração e token CSRF; mutações de sessão cookie devem enviar `X-CSRF-Token`. `POST /api/admin/logout` revoga a sessão e remove cookie. `PUT /api/admin/password` com `currentPassword` e `password` troca a senha e revoga todas as sessões. `POST /api/admin/revoke-sessions` encerra todos os acessos do usuário atual.

Há limite por conexão/IP de 180 requisições por minuto, cinco logins por minuto e 50 mutações administrativas por minuto. Há também contadores persistentes de dez tentativas de login por e-mail/IP em 15 minutos. Os limites não expõem existência de contas e não substituem proteção na borda da hospedagem.

| Endpoint | Comportamento |
|---|---|
| `GET /api/admin/products?q=&category=&status=&featured=&stock=&price=&sort=&page=&size=` | Lista paginada, total e alertas |
| `GET /api/admin/products/:id` | Cadastro completo e versão |
| `POST, PUT /api/admin/products` / `/:id` | Criar / substituir cadastro |
| `PATCH /api/admin/products/:id` | Preço, estoque, publicação, status ou destaque; envie `version` |
| `DELETE /api/admin/products/:id?version=N` | Exclusão lógica com auditoria |
| `POST /api/admin/products/bulk` | `{action, items:[{id,version}], price?}` |
| `GET /api/admin/products/export` | Todos os produtos em CSV WooCommerce |
| `GET /api/admin/import/template` | Modelo CSV do painel |
| `POST /api/admin/import/preview` | `{csv,mode}` → prévia persistente |
| `POST /api/admin/import/apply` | `{previewId}` → resumo idempotente |
| `GET, POST /api/admin/media` | Biblioteca / upload `{name,type,data}` (base64 sem prefixo data:) |
| `DELETE /api/admin/media/:id` | Remove mídia sem vínculo |
| `GET /api/admin/audit?page=N` | Últimos registros, 50 por página |
| `PUT /api/admin/users/:id` | Papel, ativação e senha opcional; revoga sessões |

Categorias: GET inclui contagens; POST/PUT recebem `label`, `slug`, `icon`, `image`, `sortOrder`, `active` e `version` na edição. Identidade interna da categoria é preservada ao alterar o slug. SKUs e slugs duplicados retornam 409. Produtos atualizados pelo painel enviam `version` para impedir sobrescrita concorrente. A validação do servidor independe do formulário utilizado.

Referências de implementação: [sessões OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [limites e validação do Sharp](https://sharp.pixelplumbing.com/api-constructor/).
