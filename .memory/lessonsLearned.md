### [VALIDADO LOCALMENTE] - Unidade kg e normalização das planilhas de 979 produtos (04/11/2026)
- **Causa/Contexto:** Os dois CSVs do cliente (979 produtos) reprovavam 90 linhas por unidade fora do padrão (`ct`, `p?` corrompido, `mt`, `kg`); `kg` não existia no sistema e o usuário optou por criá-lo em vez de aproximá-lo de "unidade".
- **Solução Aplicada:** Migração `011_unit_kg.sql` (rebuild da tabela products com CHECK ampliado, precedente da 006, `rebuild` também na 011 em `db.js`); enum de unidade em `server/products.js`; `quantity()` e `validQuantity`/`step` aceitam decimal para kg; rótulo "quilograma" em `core.js`, select do painel e input de quantidade do PDP com `StoreCore.step`; migrações contadas = 11; docs ADMIN/COMERCIAL/README. Planilhas: geradas cópias `*_pronto.csv` com `mt→m`, `p?→un`, `ct→pacote` (originais preservados) — 979/979 linhas válidas, 12 categorias novas. Suíte 46/46.
- **Regra de Prevenção:** Antes de importar dados reais, validar TODOS os arquivos com `previewImport` local e normalizar na cópia, nunca no original; mudanças de enum com CHECK no SQLite exigem rebuild de tabela e atualizar contadores de migração em testes.

### [VALIDADO LOCALMENTE] - Planilha com preço em formato brasileiro reprovava nas 11 linhas (04/11/2026)
- **Causa/Contexto:** Depois de liberar SKU e categoria, a prévia da planilha de 262 linhas do usuário ainda reprovava 11 linhas com "Número inválido. Não use separador de milhar." — os preços vinham no formato da planilha brasileira (`2.170,50` e possivelmente `R$ …`), que a regra estrita rejeitava; a mensagem não dizia qual coluna nem qual valor.
- **Solução Aplicada:** `numeric()` em `server/csv.js` agora normaliza `R$`, aceita milhar brasileiro (`1.234,56` → 1234.56; `1.234` → 1234) e mantém `2.17` como decimal; erro passa a nomear coluna e valor ("Preço inválido: …"). Colunas rotuladas (Preço, Estoque, Comprimento). `ADMIN.md` atualizado (formatos aceitos e categoria criada automaticamente). Testes: `R$ 2.170,50` → 2170.5 e erro apontando "abc". Suíte em execução; `public/` regenerado após.
- **Regra de Prevenção:** Ao validar números vindos de planilhas, aceitar a notação local (milhar e símbolo) e sempre incluir coluna + valor na mensagem de erro; ambiguidade como "1.234" deve ser resolvida pela convenção do usuário (pt-BR), documentada em ADMIN.md.

### [VALIDADO LOCALMENTE] - Importação rejeitava categorias novas e SKUs com espaços (04/11/2026)
- **Causa/Contexto:** Usuário não conseguia subir planilha de 262 linhas no painel: `validateProduct` exigia categoria já cadastrada ("Categoria inexistente."/"Identificador inválido.") e o regex de SKU não aceitava espaços, comum em códigos como "VIGA DE MADEIRA 5X10" — todas as linhas reprovavam com o mesmo erro.
- **Solução Aplicada:** `server/csv.js` resolve a célula de categoria da planilha (label com acento/maiúsculas vira slug, casa com existente ou fica pendente) e a cria na aplicação com auditoria `category_created`; `validateProduct` ganhou `allowNewCategory` só na prévia; SKU passou a aceitar espaços internos em `server/products.js` e no `pattern` do formulário (`admin/admin.js`), que também mostra "Categorias novas" na prévia e no resultado. Testes cobrem categoria nova duplicada em duas linhas (cria uma só), mapeamento por acento e SKU com espaço. Suíte 46/46; `public/` regenerado.
- **Regra de Prevenção:** Regras de formato de código (SKU/referência/slug) precisam ser alinhadas entre servidor, formulário e o formato real das planilhas do usuário; validar importações com dados reais do cliente (acentos, espaços, maiúsculas) antes de considerar o fluxo pronto.

### [VALIDADO LOCALMENTE] - Colunas do grid, banners avançados e promoções no rodapé (03/11/2026)
- **Causa/Contexto:** Pedido do cliente: colunas do catálogo configuráveis (mín 4) com cards maiores; excluir banner no card; banner temporário opcional; home 450px sem setas só bolinhas; imagem mobile+desktop por banner; imagem do admin prevalece sem flash; promoções abaixo dos produtos com bordas arredondadas e respiro; permissões dono/funcionário.
- **Solução Aplicada:** Migração 010 (expires_at, image_mobile); productColumns 4–8 nas configurações e CSS var --product-cols; delete no card + editor com expiração e imagem mobile; renderHero sem setas, 450px, picture mobile; hero hardcoded vazio no index.html; campaigns movida entre destaques e sobre; CSS com raio 16/12px e respiro 24/16px; painel de banners com padding 28/32. 46/46 unit; banners/cart Chromium e iPhone; experience/quote/admin-browser; 9/9 limites. Testes de altura e raio do banner atualizados.
- **Regra de Prevenção:** Ao mudar geometria (altura/raio/margem) de seções cobertas por e2e, atualizar asserções de boundingBox no mesmo commit; colunas configuráveis só em min-width para não quebrar o mobile de 2 colunas.

### [VALIDADO LOCALMENTE] - Banner home multiplas fotos e UI da lista do cliente (03/11/2026)
- **Causa/Contexto:** Pedido: Cópia como base (sem arquivos exclusivos — Site já é a fusão), banner home estilo ML com várias fotos no admin, productCount removido do título, botão Conhecer→Adicionar, fotos maiores, espaçamento do filtro de métricas, testes e push.
- **Solução Aplicada:** Migração 009 remove índice único de home; saveBanner/deleteBanner permitem vários home; admin ganha botão Adicionar banner principal; renderHero monta carrossel home (setas/dots/5s); productCount vazio; botão sempre Adicionar ao carrinho; aspect-ratio 1.15; metrics-range margin 36px. Testes ajustados (múltiplo home, delete hard, migrations=9). 46/46 unit; cart+banners Chromium e iPhone; experience+quote Chromium; 9/9 limites; 0 segredos no bundle. Deploy produção ainda com /admin/analytics.js 404 (deploy antigo).
- **Regra de Prevenção:** Ao permitir múltiplos registros que antes eram únicos, atualizar migração, validação do servidor, testes de contagem e comportamento de delete juntos; regenerar public/ e push para o deploy da Vercel aplicar vercel.json.

### [VALIDADO] - Ajustes de UI do painel e vitrine com suíte completa verde (29/10/2026)
- **Causa/Contexto:** Pedido do usuário: login sem logo/frases, métricas sem valor fechado/estágio/click por período, menu sem Orçamentos/Clientes, selos de promoção e "mais vendido", banner rotativo estilo ML, botões "Adicionar ao carrinho"/"Comprar no WhatsApp".
- **Solução Aplicada:** Alterações em `admin/index.html`, `admin/admin.js`, `admin/analytics.js`, `js/app.js`, `js/ui.js`, `js/product-page.js`, `index.html` e CSS. Remoção de itens de menu exigeu atualizar `test/admin-browser.test.js` (navegação por `data-page` injetado) e `assert /VALOR FECHADO/` → `/DETALHES VISUALIZADOS/`. `public/` é artefato gerado por `npm run build:vercel` (regenerar após editar fontes). Validação: `npm test` 39/39 e Playwright 25/25.
- **Regra de Prevenção:** Após editar fontes de `css/`, `js/`, `index.html` ou `admin/`, rodar `npm run build:vercel` para sincronizar `public/`. Ao remover itens de menu/relatórios, grep por `data-page=` e por textos de asserção nos testes antes de editar.

### [SUPERADA] - Fluxo de compra mantinha formulário com nome+WhatsApp (29/10/2026)
- **Causa/Contexto:** Usuário pediu "comprar no WhatsApp sem captar dados"; ofereci opções (a) formulário mínimo, (b) sem dados e sem protocolo, (c) só lista. Ele escolheu a opção (a).
- **Solução Aplicada:** Mantido `POST /api/quotes` com nome+telefone obrigatórios (`server/orders.js` exige `input.customer`), protocolo MP- e mensagem completa no WhatsApp. Apenas rótulos trocados: botão do carrinho → "Comprar no WhatsApp"; cards → "Adicionar ao carrinho" (redireciona produtos medidos ao PDP, comportamento original preservado).
- **Regra de Prevenção:** Decisão superada pelo pedido explícito posterior de abrir o WhatsApp sem qualquer formulário. A API de orçamentos registrados mantém suas validações para os demais consumidores; a vitrine passa a preparar a lista diretamente, sem cadastro nem protocolo.

### [DECISÃO] - WhatsApp direto sem formulário (29/10/2026)
- **Causa/Contexto:** Usuário determinou remover todos os campos de contato e retirada/entrega antes de abrir a conversa.
- **Solução Aplicada:** Vitrine prepara a mensagem com o catálogo carregado e abre o WhatsApp no clique, com produtos, medidas, quantidades e estimativas. Não registra cliente/pedido nem inventa protocolo. Apenas listas extensas oferecem cópia integral sem campos de cadastro. Nove testes de dados/mensagem aprovados, oito cenários Chromium/iPhone aprovados e fluxo geral da loja/painel aprovado no Chromium.
- **Regra de Prevenção:** Não reintroduzir formulário ou dados fictícios para satisfazer testes antigos; adaptar testes ao fluxo autorizado, preservando validações da API de orçamentos registrados.

### [CORRIGIDO] - Fixtures e textarea no fluxo direto (29/10/2026)
- **Causa/Contexto:** O teste de produto ainda usava empresa sem WhatsApp confirmado, impedindo a abertura da conversa; o teste de lista extensa consultava textContent em vez do value do textarea. Uma leitura por wildcard de relatório e uma busca em server/events.js inexistente também falharam.
- **Solução Aplicada:** Fixture confirma um número de teste; asserção da lista usa toHaveValue. O resultado detalhado foi lido na saída do executor, dispensando o caminho presumido do relatório. Repetição aprovada em Chromium e iPhone/WebKit.
- **Regra de Prevenção:** Preparar configuração de atendimento compatível com o fluxo testado, usar value em campos e consultar os caminhos reais dos relatórios.

### [CORRIGIDO] - Origem de métrica do clique direto (29/10/2026)
- **Causa/Contexto:** A revisão do contrato de analytics identificou que shopping_list não pertence à lista de origens aceitas pela API.
- **Solução Aplicada:** Mantida a origem existente quote_continue para cliques de envio da lista; asserção de persistência aprovada em nova execução Chromium.
- **Regra de Prevenção:** Conferir enums de origem no servidor ao alterar eventos; validar resposta e persistência, pois falhas silenciosas de métricas não impedem o fluxo visual.

### [CORRIGIDO] - Regra CSS `:last-child` órfã após remover link do topo (29/10/2026)
- **Causa/Contexto:** Ao remover "Fale com a Progresso" do `categoryNav`, as regras `.category-nav a:last-child` passariam a empurrar/esconder a última categoria.
- **Solução Aplicada:** Removidas as duas regras de `.category-nav a:last-child` de `css/storefront-original.css` (margin-left:auto e display:none no mobile).
- **Regra de Prevenção:** Ao remover o último elemento de uma lista com estilo `:last-child`, procurar e remover as regras correspondentes no CSS.

### [EM INVESTIGAÇÃO] - Hostinger rejeita conteúdo CNAME (28/10/2026)
- **Causa/Contexto:** Usuário relatou “CNAME record content is not valid! (and 1 more error)” e confirmou que os apontamentos estão exatamente como os valores fornecidos. A captura mostra somente o aviso de múltiplos A @; o segundo erro e o registro cuja gravação falha ainda não foram identificados. A causa exata permanece sem confirmação.
- **Solução Aplicada:** Separar o aviso de A da rejeição de CNAME; fornecer o destino ASCII puro `596ae90d2ef96671.vercel-dns-017.com`, um registro por nome (`admin` ou `www`), sem protocolo, caminho, aspas ou espaços. Solicitar os campos preenchidos e o segundo erro para confirmar a causa.
- **Regra de Prevenção:** Ler esta memória no início das tarefas e atualizá-la antes de concluir. Não tratar hipótese como diagnóstico, nem cadastro na Vercel como alteração da zona Hostinger. Quando o usuário confirmar os valores, avançar para isolar o salvamento de cada registro e identificar a segunda mensagem, em vez de repetir instruções de cópia ou presumir erro de digitação. Entregar valores copiáveis e manter DEBUG-DNS.md atualizado.

### [CONTORNADO] - Consulta DNS pública sem resposta no ambiente (28/10/2026)
- **Causa/Contexto:** As três consultas HTTPS a `dns.google/resolve` via Node retornaram `fetch failed`; isso não comprova falha na zona DNS do domínio.
- **Solução Aplicada:** A repetição com rede autorizada obteve respostas do Google: A principal NOERROR sem respostas e CNAME admin/www NXDOMAIN. Registrar esses resultados como observação de um resolvedor; salvamento e propagação completa permanecem pendentes de confirmação.
- **Regra de Prevenção:** Nunca interpretar erro de rede local como NXDOMAIN, ausência de registro ou propagação concluída; registrar o código DNS somente quando uma resposta válida for recebida.

### [IMPLEMENTADO] - Memória e índice de debug do projeto (28/10/2026)
- **Causa/Contexto:** O usuário solicitou memória contínua e documentação de debug para o projeto.
- **Solução Aplicada:** Criados `AGENTS.md`, `DEBUG.md`, `DEBUG-DNS.md` e `.memory/lessonsLearned.md`, com leitura inicial, atualização antes da conclusão e distinção entre hipóteses e evidências.
- **Regra de Prevenção:** Manter as regras no escopo deste projeto; não alegar ativação global em outros projetos nem inserir credenciais nos documentos.

### [VALIDADO] - Word de DNS com procedimento de debug (28/10/2026)
- **Causa/Contexto:** Complementar a entrega Word com o erro de CNAME relatado e valores em texto simples para preenchimento na Hostinger.
- **Solução Aplicada:** Gerados `DNS-Madeireira-Progresso-Debug.docx` e `DNS-Registros-para-copiar.txt`; verificados pacote ZIP, seis partes XML, IPs, destino CNAME e seção de investigação. O erro de preenchimento permanece pendente dos campos exatos do formulário.
- **Regra de Prevenção:** Validar a integridade do DOCX e distinguir documento entregue de problema externo resolvido; disponibilizar valores DNS sem formatação para cópia.

### [VALIDADO] - Handoff técnico para continuidade (28/10/2026)
- **Causa/Contexto:** Solicitada continuidade em outra conversa com histórico, erros, acertos e ponto de retomada.
- **Solução Aplicada:** Markdown e Word atualizados para 18 seções, incluindo migração Hostinger, backup Madeireira, NAC pendente e Claude no onboarding. HEAD e arquivos locais conferidos. DOCX com seis partes XML e conteúdo validado; backup conferido por tamanho e SHA-256. Evidências remotas anteriores identificadas como históricas; nenhum deploy ou instalação nesta revisão.
- **Regra de Prevenção:** Revisar também sequência de retomada e texto para nova conversa quando o objetivo mudar; separar validação local atual de evidência histórica e informar artefatos fora do Git, sem credenciais.

### [EM INVESTIGAÇÃO] - Acesso à Hostinger para backup do NAC (28/10/2026)
- **Causa/Contexto:** O usuário autorizou fazer backup do NAC antes de hospedar a Madeireira na Hostinger. Não há conexão de hospedagem disponível nos plugins; a tentativa de verificar metadados de `.ssh/config` no ambiente restrito retornou acesso negado.
- **Solução Aplicada:** Solicitados domínio NAC, tipo de hospedagem e nome de conexão SSH/SFTP existente. Separar ausência de permissão local da existência real da configuração; consultar somente metadados de conexão com acesso autorizado.
- **Regra de Prevenção:** Não substituir arquivos do NAC nem alterar DNS antes de identificar o alvo, obter backup consistente e conferir recuperação. Não ler ou imprimir chaves privadas; não presumir que hospedagem estática/PHP executa o backend Node/SQLite.

### [DECISÃO] - Migração usa snapshot remoto atual (28/10/2026)
- **Causa/Contexto:** O banco local e a versão Vercel são independentes; migrar somente os arquivos do Git perderia o catálogo e a persistência da produção.
- **Solução Aplicada:** Preparar exportação criptografada do snapshot atual do Blob com mídias imutáveis, restauração isolada e conferência de integridade/contagens. Não realizar gravações no armazenamento remoto nem alterar o NAC antes do backup.
- **Regra de Prevenção:** Confirmar o estado atual da fonte e adaptar origens/rotas do admin para o runtime Hostinger escolhido; configuração de subdomínios de vercel.json não se aplica automaticamente ao Node independente.

### [CONTORNADO] - Timeout ao exportar mídias do Blob (28/10/2026)
- **Causa/Contexto:** A exportação leu o banco remoto, mas uma leitura de mídia excedeu o limite de 20 segundos; a primeira tentativa terminou sem backup verificado.
- **Solução Aplicada:** Aumentado somente o timeout do leitor de exportação para 60 segundos e adicionadas até três tentativas para falhas transitórias. A segunda exportação concluiu e a restauração isolada passou; runtime e origem permaneceram inalterados e estágios temporários foram removidos.
- **Regra de Prevenção:** Não declarar backup pronto antes da restauração e conferência; registrar timeouts de transferência separadamente de corrupção ou falta de mídia na origem.

### [VALIDADO] - Backup de origem da Madeireira para migração (28/10/2026)
- **Causa/Contexto:** Preparar a migração da publicação Vercel para Hostinger sem usar o banco local desatualizado.
- **Solução Aplicada:** Exportação MPB1 criptografada de 52.707.949 bytes, hash SHA-256 registrado, restauração isolada com integridade/contagens e catálogo conferidos: 44 linhas brutas de produtos, 32 publicados e 32 mídias. Sessões revogadas só na restauração de teste; nenhuma gravação remota. Resultado em `.cache/hostinger-migration/madeireira-export-verification.json`.
- **Regra de Prevenção:** Distinguir backup da Madeireira de backup do NAC; este último e o deploy Hostinger seguem pendentes do acesso correto. Revalidar gravações na fonte antes da virada final; guardar a chave da nuvem separada do arquivo criptografado.

### [CORRIGIDO] - Auxiliares SQLite temporários na exportação (28/10/2026)
- **Causa/Contexto:** A conferência final encontrou `.sqlite.tmp-shm` e `.sqlite.tmp-wal` da cópia usada pelo backup, mesmo após o fechamento do banco e remoção dos diretórios de teste.
- **Solução Aplicada:** Remover somente os dois arquivos temporários associados ao nome exato do backup já validado e incluir essa limpeza no auxiliar de exportação, verificando que o diretório pai é o cache privado esperado.
- **Regra de Prevenção:** Conferir também arquivos WAL/SHM após exportar/restaurar SQLite; nunca aplicar limpeza genérica em bancos em uso ou remover o arquivo MPB1 criptografado como parte dessa etapa.
### [VALIDADO PARCIALMENTE] - npm.ps1 bloqueado no PowerShell (28/10/2026)
- **Causa/Contexto:** O erro relatado informa bloqueio do wrapper `npm.ps1` pela política de execução. A resolução local confirmou os wrappers `npm.ps1` e `npm.cmd`; consulta online falhou com HTTP 503.
- **Solução Aplicada:** Verificado `npm.cmd --version`, com código 0 e versão 11.19.0. Após receber o bloco completo, indicar `npm.cmd` tanto em `Get-Command` quanto na chamada de desinstalação; identificar exclusões de dados desnecessárias à correção e orientar substituição da credencial exposta, sem reproduzi-la. Nenhuma instalação, desinstalação ou alteração de política executada; instalação, provedor e modelos seguem sem validação.
- **Regra de Prevenção:** Preferir o wrapper `.cmd` para esse bloqueio e conferir o bloco completo antes de recomendar alterações gerais de política. Distinguir execução do npm validada de instalação concluída; falha de consulta online não invalida evidência local.

### [SINTAXE VALIDADA] - Script completo de configuração do Claude (28/10/2026)
- **Causa/Contexto:** Solicitado script completo após o bloqueio de npm.ps1; o original apagava dados locais e usava modelos de provedor externo ainda sem confirmação.
- **Solução Aplicada:** Criado `instalar-claude.ps1` com instalação nativa sem npm, entrada oculta para nova chave, teste prévio do modelo escolhido, backup e atualização das configurações preservando outras propriedades. Parser PowerShell validou a sintaxe; instalação, teste remoto e execução interativa não foram realizados. Consulta oficial online repetida retornou HTTP 503.
- **Regra de Prevenção:** Não confundir validação sintática com execução concluída; testar identificadores no provedor antes de gravar e explicar quando todas as seleções usam um único modelo. Não registrar credenciais nem executar limpeza destrutiva para corrigir seleção de wrapper.

### [VALIDADO PELO USUÁRIO] - Limite de tokens no teste do provedor (28/10/2026)
- **Causa/Contexto:** Diagnóstico do usuário confirmou TemId=True, Tipo=message, QuantidadeConteudo=0, MotivoParada=max_tokens e TokensSaida=8. O teste gerado com limite de oito tokens terminou sem conteúdo e acionou a validação local.
- **Solução Aplicada:** Aumentado `max_tokens` em `instalar-claude.ps1` para 1024. Nova execução relatada pelo usuário passou pelo teste remoto e instalou Claude Code 2.1.312. Configuração ainda pendente de erro posterior ao backup por campo env ausente; instalação não equivale a configuração concluída.
- **Regra de Prevenção:** Não atribuir falha de formato aos asteriscos da entrada oculta nem afirmar autenticação aprovada por ausência de erro HTTP. Não remover validação ou imprimir credenciais para avançar; coletar evidência mínima antes de adaptar o parser.

### [VALIDADO LOCALMENTE] - Campo env ausente sob StrictMode (28/10/2026)
- **Causa/Contexto:** Após teste remoto e instalação bem-sucedidos, a leitura direta de `$settings.env` inexistente gerou PropertyNotFoundStrict na sessão do usuário. O teste anterior de sintaxe não exercitou esse caso em runtime.
- **Solução Aplicada:** Alterada a leitura inicial para `$settings.PSObject.Properties['env']`, verificando ausência ou valor nulo antes de criar o objeto. O bloco real do arquivo passou em quatro cenários sob StrictMode Latest: ausente, nulo, objeto com propriedade preservada e tipo inválido rejeitado. Sintaxe também validada. Captura posterior confirma abertura do Claude na seleção inicial de tema; onboarding e conversa dentro do programa seguem sem confirmação. Nenhuma configuração pessoal alterada durante o teste local.
- **Regra de Prevenção:** Acessar campos JSON opcionais pela coleção de propriedades e testar configurações sem campo, com nulo, com objeto existente e com tipo inválido sob Set-StrictMode Latest; preservar propriedades existentes.

### [CORRIGIDO] - Regeneração de DOCX com destino existente (28/10/2026)
- **Causa/Contexto:** ZipFile.Open em modo Create recusou o Word já existente; erros subsequentes ocorreram porque a sessão PowerShell continuou após a exceção. O Word anterior não foi atualizado nessa tentativa.
- **Solução Aplicada:** Novo pacote criado em arquivo separado com ErrorActionPreference Stop; seis partes XML e conteúdo técnico validados antes de substituir o Word anterior. Regeneração concluída.
- **Regra de Prevenção:** Ao regenerar entregas ZIP/DOCX, criar arquivo temporário separado e interromper no primeiro erro; substituir o artefato anterior somente depois da validação.


### [CORRIGIDO] - Patch de memória sem correspondência exata (28/10/2026)
- **Causa/Contexto:** Atualização do registro de handoff via apply_patch falhou por ausência de correspondência do trecho; a chamada não aplicou as mudanças. Outra ocorrência nesta revisão tentou procurar o título de DEBUG.md dentro da memória; o patch foi reaplicado com os arquivos e contextos corretos.
- **Solução Aplicada:** Relido o arquivo em UTF-8 e atualizado o registro por limite de seção, preservando os demais incidentes.
- **Regra de Prevenção:** Relê o trecho atual antes de aplicar substituições; após falha de patch, conferir o conteúdo e não presumir alteração parcial.
### [CONTORNADO LOCALMENTE] - Links do handoff não abrem no chat (28/10/2026)
- **Causa/Contexto:** Usuário relatou não conseguir abrir nem baixar os links locais do handoff. A causa na interface não foi confirmada.
- **Solução Aplicada:** Copiados Word e texto completo para Handoff.docx e Handoff.txt na raiz do projeto, com hashes iguais às fontes. Abertura pelo usuário ainda não confirmada; fornecido caminho para acesso pelo Explorador.
- **Regra de Prevenção:** Não apresentar link local como download garantido; disponibilizar caminho Windows copiável e arquivo de texto acessível fora de pastas ocultas.


### [DECISÃO] - Controle único dos banners (29/10/2026)
- **Causa/Contexto:** A home lia company.heroImage enquanto as campanhas usavam banners; isso impedia o controle do banner principal pela seção indicada. A investigação confirmou fontes distintas.
- **Solução Aplicada:** Implementada posição home/promotion na tabela banners, com home único; migração reutiliza a primeira arte cadastrada e preserva demais campanhas. Artes são exibidas inteiras e campanhas sem imagem não aparecem na loja. Migração validada em banco isolado; upload, 12 promoções e largura total validados em Chromium. Publicação remota pendente.
- **Regra de Prevenção:** Centralizar imagens de banner na mesma API e testar migração com dados existentes, upload, ordenação e renderização antes de considerar concluído.

### [CORRIGIDO] - Nome presumido de teste inexistente (29/10/2026)
- **Causa/Contexto:** A leitura de e2e/storefront.spec.js falhou porque o arquivo não existe.
- **Solução Aplicada:** Listados os arquivos reais com rg --files e identificada a suíte experience.spec.js.
- **Regra de Prevenção:** Consultar a lista de testes antes de ler caminhos presumidos.

### [CORRIGIDO] - Glob e leitura de teste no PowerShell (29/10/2026)
- **Causa/Contexto:** rg test/*.js recebeu o glob literal no Windows e leituras adicionais presumiram production.test.js e css/responsive.css inexistentes.
- **Solução Aplicada:** Usada busca rg em diretório com -g '*.js'; identificados testes reais sem depender de expansão do shell.
- **Regra de Prevenção:** Usar rg --files e glob em -g nas buscas Windows, sem presumir nomes de suítes.

### [CORRIGIDO] - Aspas SQL em consulta de banner principal (29/10/2026)
- **Causa/Contexto:** Inclusão de placement='home' dentro de string JS com aspas simples causou SyntaxError no import de server/db.js durante a verificação.
- **Solução Aplicada:** Consulta externa alterada para aspas duplas; validação sintática aprovada antes da repetição dos testes de dados.
- **Regra de Prevenção:** Rodar node --check após editar strings SQL e concluir as edições antes de iniciar suítes que carregam módulos sob demanda.

### [CORRIGIDO] - Codificação e substituição abrangente no PowerShell (29/10/2026)
- **Causa/Contexto:** O pipeline PowerShell para Node perdeu caracteres Unicode; uma substituição ampla de texto também alterou operadores ternários length?, impedindo o script do painel de carregar e mantendo o login desabilitado.
- **Solução Aplicada:** Configurado OutputEncoding UTF-8, restaurados os operadores e corrigidos textos. Verificação de sintaxe obrigatória antes de repetir o navegador.
- **Regra de Prevenção:** Preferir apply_patch para textos acentuados; em stdin PowerShell definir UTF-8 e restringir substituições a trechos completos, validando todos os módulos editados.

### [CORRIGIDO] - Seletores e versões nos testes de banners (29/10/2026)
- **Causa/Contexto:** O teste de navegador encontrou duas headings com mesmo nome; o teste de mudança de posição usava versão antiga e acionava antes a proteção de concorrência.
- **Solução Aplicada:** Seletor restringido ao heading de nível 2 e cenário de posição isolado da validação de versão. Repetição aprovada para os cenários de dados e para o navegador.
- **Regra de Prevenção:** Selecionar o papel e nível exatos e preparar cada cenário negativo para atingir a validação que ele pretende testar.

### [CORRIGIDO] - Campanha apenas com imagem (29/10/2026)
- **Causa/Contexto:** A validação de banner rejeitava body ausente, apesar de o texto ser opcional. O teste de cadastro de várias artes revelou Texto inválido.
- **Solução Aplicada:** Normalizado body ausente para string vazia na API; preservada validação de texto quando informado.
- **Regra de Prevenção:** Testar payload mínimo de imagem com nome e destino, incluindo campos opcionais omitidos.

### [VALIDADO LOCALMENTE] - Upload, migração e carrossel de banners (29/10/2026)
- **Causa/Contexto:** Solicitação de controle dos banners da home e das promoções em uma única seção, aproveitando a arte cadastrada e sem limite de quantidade.
- **Solução Aplicada:** Posições home/promotion, imagem inteira com largura total, recomendações 1920 × 800 (12:5) e 1920 × 600 (16:5), upload de banner até 2560 px e 3 MB. Testes: 35 testes existentes de dados/API aprovados, dois novos de migração/125 promoções aprovados e Chromium aprovou upload real, 12 promoções, setas circulares, largura em 1440/390 e home desativada. Testes CDP antigos falharam na inicialização/timeout do navegador e não foram considerados aprovados. Imagem da captura ausente no banco local; migração reutilizará a arte existente na base publicada quando implantada.
- **Regra de Prevenção:** Regenerar public após fontes; usar upload isolado nos testes, conferir API e src das imagens e distinguir resultado local de publicação. Nunca substituir a base publicada pelo banco local para aproveitar uma arte remota.

### [CORRIGIDO] - Etapas sobrepostas à arte principal (29/10/2026)
- **Causa/Contexto:** Inspeção da captura confirmou que as etapas de orçamento, posicionadas fora de heroTrack, ainda se sobrepunham à imagem enviada.
- **Solução Aplicada:** Etapas passam para uma faixa abaixo da arte quando existe banner principal com imagem; verificação geométrica aprovada no Chromium. Fluxo geral de loja/painel também aprovado, build regenerado e git diff --check sem erros.
- **Regra de Prevenção:** Inspecionar a captura além das asserções de largura e verificar também elementos irmãos do componente substituído.

### [DECISÃO] - Dimensões e espaçamento dos banners revisados (29/10/2026)
- **Causa/Contexto:** Usuário reduziu a arte principal para 1920 × 600 e solicitou promoções com 300 px de altura, margens e cantos discretos; confirmou manter a imagem atual para trocar depois. O painel apresentava botão e cards sem respiro.
- **Solução Aplicada:** Principal passa à proporção 16:5 com teto de 600 px, promoções a 300 px no desktop e escala proporcional no celular, margens de 24/16 px e raio de 8 px. Orientação de arte promocional 1320 × 300; painel com padding e intervalos próprios. Chromium aprovou medidas em 1920/1440/390, espaçamento administrativo, upload, setas e ausência de erros JS; capturas inspecionadas. Build e git diff --check aprovados. Sem publicação nesta revisão.
- **Regra de Prevenção:** Conferir dimensões reais, espaçamento do painel e instruções de upload juntos; manter a imagem existente quando a troca for adiada pelo usuário.

### [CORRIGIDO] - Rotação automática durante teste geométrico (29/10/2026)
- **Causa/Contexto:** As medidas e capturas em várias larguras levaram mais que o intervalo de rotação; a asserção de seta pressupunha que o primeiro slide continuava ativo e falhou.
- **Solução Aplicada:** O teste de navegação manual usa prefers-reduced-motion para desativar a rotação automática de modo determinístico, mantendo o comportamento do produto. Repetição aprovada no Chromium.
- **Regra de Prevenção:** Isolar temporizadores ao testar posições de slides após capturas e mudanças de viewport; não presumir índice inicial após esperas.
### [VALIDADO LOCALMENTE] - Revisão integral e subtotais do carrinho (01/11/2026)
- **Causa/Contexto:** O carrinho não exibia subtotal por linha e multiplicava preços em ponto flutuante antes de converter para centavos, divergindo do cálculo da mensagem em casos como R$ 0,29 × 0,5. A primeira suíte teve 42 aprovações e dois cancelamentos por timeout nos testes Edge; Firefox também apresentou falhas. A consulta de processos via CIM foi negada e um glob de skills inexistente não produziu leitura válida.
- **Solução Aplicada:** Adicionada apresentação de subtotal e cálculo em centavos inteiros, alinhado ao WhatsApp. A regressão também encontrou reentrada ao substituir input focado; saveCart recebeu proteção com finally. Fluxo completo aprovado no Chromium e iPhone sem trace, incluindo zero erros JS e R$ 0,29 × 0,5 = R$ 0,15. Suíte principal repetida com permissão de processos: 44/44; segurança/banners posteriores: 7/7. Nenhuma alteração de produção ou dados reais. Resultados detalhados em REVISAO-INTEGRAL-2026-11-01.md.
- **Regra de Prevenção:** Converter preço para centavos antes de multiplicar quantidades; somar subtotais arredondados. Registrar cancelamentos como pendências, verificar arquivos existentes antes de ler e não atribuir falha de processo ao produto sem diagnóstico.

### [CORRIGIDO] - Raiz do admin na Vercel servia a vitrine (02/11/2026)
- **Causa/Contexto:** Usuário relatou que `admin.madeireiraprogresso.com` puxava a página pública. O `rewrite` com `has: host` em `/` perde para `public/index.html` no roteamento da Vercel (filesystem antes de rewrites). O redirect `/admin/:path*` também descartava o prefixo, gerando 404 em assets.
- **Solução Aplicada:** Em `vercel.json`, `/` e `/index.html` no host admin viraram `redirect` para `/admin`; destino do redirect do domínio principal passou a `https://admin.madeireiraprogresso.com/admin/:path*`. Validado em produção o defeito (título da raiz = vitrine) antes da correção; deploy da correção pendente.
- **Regra de Prevenção:** Em Vercel com `outputDirectory` estático, não servir rota por host via `rewrite` em `/` quando existe `index.html`; usar `redirect`. Ao redirecionar `/admin/:path*` para outro host, manter o prefixo `/admin` no destino. Verificar título e assets após publicar.

### [VALIDADO LOCALMENTE] - Exclusão de banners e WebP no WebKit (01/11/2026)
- **Causa/Contexto:** O painel só desativava banners e não removia sua imagem. A regressão passou no Chromium; no iPhone/WebKit, WebP foi rejeitado pelo cliente. Diagnóstico mínimo confirmou File.type vazio para hero-madeira.webp. O primeiro diagnóstico procurou o cache global porque import estático avaliou Playwright antes de configurar PLAYWRIGHT_BROWSERS_PATH.
- **Solução Aplicada:** Adicionados remoção da referência, DELETE autenticado com versão e auditoria; home permanece como posição vazia/desativada. Cliente usa extensão JPEG/PNG/WebP somente quando MIME vem vazio; servidor mantém verificação dos bytes. Diagnóstico usa import dinâmico após configurar o cache. Repetição revelou altura móvel de 300 px em vez de aproximadamente 81 px: proporção movida ao contêiner com track absoluto. Fluxo completo final aprovado em Chromium e iPhone, incluindo upload/substituição/remoção/exclusão/reload; cinco testes finais de segurança aprovados. Fluxos gerais Firefox/WebKit/iPhone passaram sem trace. Build e nove limites aprovados. DNS/HTTPS e WhatsApp físico seguem pendentes; banco real somente leitura íntegro, com 32 produtos sem preço.
- **Regra de Prevenção:** Testar MIME informado por cada navegador e validar os bytes no servidor; preservar imagens compartilhadas ao excluir banners e manter a home editável.

