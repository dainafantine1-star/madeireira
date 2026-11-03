# Revisão integral — 01/11/2026, America/Bahia

**Situação: concluído parcialmente.** Correções locais implementadas; domínio e homologação física permanecem pendentes. Os resultados abaixo pertencem a esta execução, não aos relatórios históricos.

## Escopo e preservação

Revisado `Madeireira Progresso - Site`, projeto principal com AGENTS.md, código mais recente e vínculo de publicação. A pasta `Madeireira Progresso - Site - Copia` e os ZIPs foram preservados. As alterações preexistentes foram mantidas; não foi criado commit, feito deploy, alterado DNS nem enviada mensagem real.

Lidos AGENTS.md, README, memória, índice e guias de debug de WhatsApp, banners e terminal, documentação de segurança/publicação e testes. Stack: Node.js 24.21.0, JavaScript nativo, SQLite, Sharp e Playwright. Não há scripts de lint ou verificação TypeScript; verificações sintáticas e testes são os controles aplicáveis. Skills Codex acessíveis e utilizadas: `vercel:verification` e `vercel:env-vars`. Não foi necessário instalar ou copiar skills; esta execução ocorre no Codex, não no Claude.

Testes utilizaram SQLite em memória ou diretórios temporários, contas `example.test` e fixtures existentes. Uploads temporários ficam em diretórios próprios com limpeza nos testes. Nenhum produto, foto ou banner da base real foi removido.

## Correções desta revisão

1. **Subtotal de cada item:** passou a aparecer no carrinho, inclusive `Sob consulta`.
2. **Arredondamento consistente:** preço convertido para centavos antes de multiplicar a quantidade; total soma os subtotais arredondados. Corrige o caso R$ 0,29 × 0,5, que deve resultar em R$ 0,15, igual à mensagem do WhatsApp.
3. **Atualização recursiva do carrinho:** a remoção de um input focado podia emitir `change` durante a renderização e disparar nova troca de `innerHTML`. A regressão reproduziu erros de DOM ao informar quantidades inválidas; a renderização agora tem proteção contra reentrada, liberada em `finally`.
4. **Remoção de imagem de banner:** botão no editor limpa a referência e a prévia; só aplica após salvar.
5. **Exclusão de banner:** interface e `DELETE /api/admin/banners/:id?version=N`, com autenticação, CSRF, confirmação, versão e auditoria. Promoções são removidas; a posição única da home é preservada sem imagem e desativada para permitir cadastrar a próxima arte. Não apaga arquivos compartilhados da biblioteca.
6. **Orientação pública coerente:** removida a promessa de formulário/protocolo no passo “Envie sua lista”; o texto explica a abertura direta do WhatsApp e a confirmação do envio na conversa.
7. **Upload WebP no WebKit:** diagnóstico real confirmou `File.type=''` para a imagem WebP. O cliente passou a deduzir JPEG/PNG/WebP pela extensão somente quando o MIME está vazio. O servidor continua validando tamanho, assinatura, formato declarado e pixels; renomear conteúdo inválido não permite upload.
8. **Proporção dos banners no WebKit móvel:** após liberar o upload, o teste revelou altura de 300 px onde a campanha de 358 px de largura deveria ter aproximadamente 81 px. A proporção passa a pertencer ao contêiner do carrossel; a faixa de slides o preenche sem impor altura intrínseca. Regressão mantém os mesmos valores geométricos em Chromium e WebKit.

Arquivos de implementação: `js/app.js`, `js/ui.js`, `admin/admin.js`, `admin/commerce.js`, `server/company.js`, `server/commerce.js`, `css/storefront-original.css`, `index.html`. Testes: `e2e/cart-review.spec.js`, ampliação de `e2e/banners.spec.js` e `test/review-security.test.js`. `public/` é artefato gerado e ignorado pelo Git.

## Evidências executadas

| ID | Comando / evidência | Resultado |
| --- | --- | --- |
| E1 | `npm.cmd test`, primeira execução; `.cache/review-npm-test.log` | 42 passaram; dois cancelados por timeout no Edge. Não considerado aprovação integral. |
| E2 | `npm.cmd test`, repetição com permissão de processos; `.cache/review-npm-final.log` | **44 passaram, zero falhas/cancelamentos/ignorados.** Inclui os dois fluxos Edge. Executado antes da última inclusão dos dois testes novos e da exclusão de banners; E3 cobre essas alterações posteriores. |
| E3 | `node --test test/review-security.test.js test/banner-placements.test.js test/commerce.test.js`; `.cache/review-banners-api.log` | **7 passaram.** Inclui exclusão com versão incorreta/correta, limpeza e reutilização da home, auditoria, mutações sem autenticação, upload vazio/acima de 3 MB e rate limit HTTP com IP forjado. |
| E4 | `node scripts/run-browsers.js`; `.cache/review-browsers.log` | **20 passaram, 10 falharam.** Chromium 6/6 e Android 6/6; WebKit desktop 4/6 e iPhone 4/6; Firefox 0/6. Falhas não foram ocultadas. Firefox registrou `browserContext.newPage: Target crashed`; WebKit teve falhas/timeouts sob instrumentação. Repetições específicas abaixo. |
| E5 | `node scripts/run-browsers.js e2e/cart-review.spec.js --project=chromium-desktop --project=iphone-webkit`; `.cache/review-cart-final.log` | Chromium passou após a correção da reentrada; iPhone teve timeout de reload com trace. |
| E6 | `node scripts/run-browsers.js e2e/cart-review.spec.js --project=iphone-webkit --trace=off`; `.cache/review-iphone.log` | **1 passou.** Mesmas asserções, incluindo arredondamento, persistência, remoção, mensagem e ausência de exceções JS. |
| E7 | `node scripts/run-browsers.js e2e/banners.spec.js --project=chromium-desktop --project=iphone-webkit --trace=off`; `.cache/review-banners-final.log` | Chromium passou no fluxo completo; iPhone falhou no upload por MIME vazio do WebP. Correção e repetição registradas no complemento. Inclui substituição, remoção da imagem, cancelamento/confirmação de exclusão, persistência, referência compartilhada e home limpa. |
| E8 | `npm.cmd audit --json --cache .cache/npm-audit`, repetição com rede autorizada; `.cache/review-audit-retry.json` | **0 vulnerabilidades conhecidas** informadas pelo npm. Primeira consulta falhou por rede; `.cache/review-audit.json`. Não é garantia de ausência de vulnerabilidades. |
| E9 | `npm.cmd run build:vercel`, `npm.cmd run check:performance`, `node --check` nos módulos alterados e `git diff --check` | Build, sintaxe, diff e **9 limites de tamanho** aprovados na rodada inicial. Build final regenerado após as correções; complemento abaixo. Os limites não medem latência real da hospedagem. |
| E10 | `node .cache/review-integrity.mjs`; `.cache/review-integrity.json` | 179 arquivos rastreados e 37 arquivos públicos na primeira execução: zero assinaturas conhecidas de credenciais no código, bundle e diffs do histórico disponível; nenhum `.env`, banco, backup ou fonte de servidor no bundle. Verificação limitada às assinaturas descritas no script. Apenas nomes/presença de variáveis registrados, sem valores. |
| E11 | `node .cache/review-domain.mjs`, rede autorizada; `.cache/review-domain.json` | Domínio principal: A/CNAME `ENODATA`; admin: `ENOTFOUND`. GET HTTPS `/`, `/api/health` e `/api/catalog` falhou com `ENOTFOUND` nos dois hosts. Consulta web também não conseguiu acessar ambos. Não houve teste remoto funcional aprovado. |
| E12 | `node .cache/review-local.mjs`, que executa `scripts/verify-deployment.js` contra servidor efêmero em memória; `.cache/review-local.log` | **15 verificações aprovadas:** seis rotas públicas, oito caminhos internos/administrativos protegidos e URL malformada rejeitada. |
| E13 | `node .cache/review-store.mjs`; `.cache/review-store.json` | Banco real aberto **somente para leitura**: `quick_check=ok`, zero violações de FK, 42 produtos não excluídos e 32 sem preço. WhatsApp igual ao número documentado e confirmado no banco; demais dados comerciais ainda não confirmados. Não comprova configuração da base remota. |

As saídas PowerShell podem registrar `NativeCommandError` ao redirecionar avisos `NO_COLOR`/`FORCE_COLOR` do stderr. Esses avisos não substituem a contagem e as falhas finais do executor. Capturas de vitrine desktop e banner a 390 px foram abertas e inspecionadas; são fixtures, não catálogo real. As imagens demonstrativas são deliberadamente suprimidas nos produtos desses testes.

## Checklist de requisitos

“Aprovado” significa executado localmente dentro da cobertura indicada. “Pendente” identifica o que não foi demonstrado; não significa aprovação presumida.

| Requisito | Situação | Evidência / limite |
| --- | --- | --- |
| Ler instruções, memória, README e guias aplicáveis | Aprovado | Leituras iniciais e inventário de arquivos. Não encontrado CLAUDE.md no inventário. |
| Identificar framework, comandos e testes | Aprovado | Node 24, SQLite/Sharp, package.json, testes Node/Edge/Playwright. |
| Conferir e usar skills acessíveis | Aprovado | Duas skills lidas; nenhuma instalação de fonte externa. |
| Preservar mudanças e dados reais | Aprovado | Bases isoladas; pasta Copia preservada; ausência de deploy/mutação remota. |
| Cadastrar/editar/excluir produtos | Aprovado | E2, management e Edge administrativo; exclusão preserva histórico de pedidos. |
| Código, descrição e preço persistidos | Aprovado | E2: store, management, product-experience; Edge administrativo. |
| Inserir/substituir/apagar fotos | Aprovado | E2: API de mídia, vínculo, remoção, galeria e Edge. Arquivo vinculado é protegido com 409 até retirar o vínculo. |
| Inserir/substituir/apagar banners | Aprovado | API E3; fluxo completo atualizado aprovado em Chromium e iPhone, incluindo cancelamento e confirmação, conforme complemento de E7. |
| Fotos/banners no computador e celular | Aprovado | E2, E4 e E6; geometria em 1920/1440/390 e imagens servidas por HTTP. Não equivale a dispositivo físico. |
| Persistência após atualizar e reabrir banco | Aprovado | E2, E5, E6 e testes de banco/nuvem; E7 amplia banners. |
| Preços e dados comerciais reais completos | Pendente | E13: 32 produtos sem preço e empresa não confirmada. Mantidos sob consulta; faltam valores/dados oficiais da empresa, sem inventá-los. |
| Adicionar produto correto pelo botão | Aprovado | E5/E6: cliques reais em dois produtos identificados por ID. |
| Abrir/visualizar carrinho | Aprovado | E2/E4/E5/E6, inclusive foco e teclado. |
| Produtos diferentes e repetição do mesmo produto | Aprovado | E5/E6: duas unidades em uma linha e segundo produto separado. |
| Aumentar/diminuir quantidades | Aprovado | E5/E6: botões +/− e valor atualizado. Itens calculados por medidas pedem novo cálculo, sem editar quantidade isolada. |
| Impedir quantidades inválidas | Aprovado | E2 e E5/E6: zero, negativo, fração em unidade e acima do limite; erros não persistem. |
| Remover produto e apresentar carrinho vazio | Aprovado | E5/E6: linha removida, estado vazio e checkout desabilitado. |
| Unitários/subtotais/total corretos | Aprovado | E5/E6: 12,35 × 2 = 24,70; +20 = 44,70; retorno a 24,70; regressão de 0,15. |
| WhatsApp com todos os itens, códigos, quantidades e valores | Aprovado | E2/E4/E5/E6: URL interceptada e texto decodificado; SKU, referência, nome, medidas, unitário, subtotal e total. |
| Excluir removidos e usar última quantidade | Aprovado | E5/E6: produto REV-002 ausente da mensagem após remoção/reload. |
| Acentos, caracteres especiais e quebras de linha | Aprovado | E4/E5/E6: São José & Cia, ×, texto com linhas e URL codificada. |
| Número real pertence à empresa e app recebe a mensagem | Pendente | Documento histórico informa o número da loja; testes usam número controlado de fixture e interceptam navegação. Falta homologação no aplicativo e domínio acessível, sem enviar a terceiros. |
| WhatsApp em computador/celular emulado | Aprovado | E4/E5/E6; popup bloqueado e lista extensa também testados. |
| WhatsApp em aparelhos físicos | Pendente | Sem acesso a aparelho/app real nesta execução. |
| Login válido e rejeição do inválido | Aprovado | E2 e E3, contas temporárias. |
| Painel e APIs administrativas protegidos | Aprovado | E2/E3: shell de login público, dados/operações exigem sessão e permissões. |
| Mutações diretas bloqueadas sem login | Aprovado | E3: POST/PUT/DELETE de produtos, banners, mídia e configurações retornam 401. |
| Logout encerra sessão | Aprovado | E2: management, cloud-runtime e Edge. |
| Rate limit e resistência a IP forjado | Aprovado | E2/E3: contadores persistidos de login, limite HTTP e política de proxy. Infraestrutura real ainda depende das variáveis da hospedagem. |
| Variáveis locais e configuração esperada | Aprovado | E10: presença sem valores; .env.example e caminhos cloud/local revisados. |
| Variáveis efetivas da hospedagem | Pendente | Não consultadas nesta execução; domínio indisponível impede teste público. |
| Segredos em fontes, bundle e histórico disponível | Aprovado | E2/E10: filtros públicos, no-store, exclusão de campos privados e scan por assinaturas. Escopo limitado, sem alegação de ausência absoluta. |
| Logs sem credenciais | Aprovado | Saídas de testes revisadas; mensagens de erro contêm códigos/IDs, sem valores reais de credenciais. Logs de produção não foram acessados. |
| Tipos, conteúdo e tamanho de upload | Aprovado | E2/E3: JPEG/PNG/WebP, assinatura divergente/SVG rejeitados, vazio e >3 MB rejeitados; Sharp limita pixels e reencoda. |
| Entradas e erros sem detalhes internos | Aprovado | E2/E3: validação, CSRF/origem, traversal, URL malformada, CSV e duplicidade/concorrência. |
| Preços e totais de pedidos conferidos no servidor | Aprovado | E2: API registrada recalcula preços, estoque e medidas e rejeita adulteração. Fluxo direto de WhatsApp não grava pedido nem garante preço comercial; equipe confirma a estimativa. |
| Testes existentes | Aprovado | E2: 44/44 após repetição; E3 valida alterações posteriores de banners e dois testes novos. |
| Testes de regressão novos | Aprovado | E3, E5 e E6, sem remover asserções dos cenários funcionais. |
| Build, sintaxe e limites | Aprovado | E9; sem ferramentas de lint/TypeScript configuradas. |
| Todos os navegadores da suíte | Pendente | E4 contém 10 falhas; repetição sem trace registrada no complemento. |
| Console, requisições e persistência dos fluxos | Aprovado | E2/E4/E5/E6 e E3; a regressão exige zero pageerror e confere o estado final. Não é monitoramento integral de todas as rotas em produção. |
| Hospedagem e domínio preparados no código | Aprovado | vercel.json/api/cloud-runtime; origens separadas, cookie seguro e rotas testadas em E2. Render/VPS são alternativas documentadas, não destino remoto comprovado hoje. |
| DNS, certificado HTTPS e fluxos no domínio atual | Pendente | E11; falha de resolução observada no ambiente. Não comprova o estado de todos os resolvedores públicos. |
| Revisão final e documentação | Aprovado | Diff revisado, memória/DEBUG/README/VALIDACAO atualizados; resultados e limites neste arquivo. |

## Como resolver as pendências externas

1. Na conta que mantém a zona de `madeireiraprogresso.com`, conferir nameservers/delegação e os registros efetivamente publicados. Na hospedagem escolhida, abrir a configuração atual dos domínios e obter os destinos A/CNAME exigidos; os valores antigos dos documentos são históricos. Não houve autorização nesta tarefa para aplicar DNS ou publicar.
2. Se mantida a Vercel, conferir `PUBLIC_ORIGIN=https://madeireiraprogresso.com`, `ADMIN_ORIGIN=https://admin.madeireiraprogresso.com` e a presença protegida de `BLOB_READ_WRITE_TOKEN`, `BACKUP_KEY` e `CRON_SECRET`. Não colocar esses segredos no bundle ou relatório. Confirmar certificado válido e que `/api/health` e `/api/catalog` respondem JSON, não página estática/login da hospedagem.
3. Com DNS/HTTPS funcionando, executar `PUBLIC_ORIGIN` apontando para o domínio e `npm.cmd run check:deployment`; repetir login/logout, CRUD e mídia com dados `REVISAO-*`, removendo apenas esses dados. No subdomínio admin, testar cookie e CSRF na própria origem. Não usar a base local para sobrescrever a remota.
4. No WhatsApp real da empresa, conferir o número no painel e abrir uma mensagem com dois itens, acentos e quantidade alterada em computador e aparelho físico. Verificar o texto preparado e cancelar sem enviar a terceiros.

## Complemento da rodada final

- Fluxo geral `e2e/experience.spec.js`, repetido com `--trace=off` em Firefox desktop, WebKit desktop e iPhone: **3/3 passaram**, com as mesmas asserções. Log `.cache/review-cross-final.log`. A rodada inicial completa continua registrada como 20/30; a repetição não comprova retroativamente os outros cinco cenários Firefox.
- Build final, sintaxe, `git diff --check` e nove limites de tamanho aprovados; scan repetido manteve zero assinaturas encontradas. Nova regeneração ocorre após a correção de MIME.
- E12 passou integralmente; E11 permanece bloqueado por resolução de nomes. Nenhuma mudança DNS/publicação realizada.
- **E7 final:** `node scripts/run-browsers.js e2e/banners.spec.js --project=iphone-webkit --project=chromium-desktop --trace=off --output=.cache/review-banners-complete-results --reporter=list`: **2/2 passaram** (Chromium 24,8 s; iPhone 56,9 s), após corrigir MIME e proporção. Log `.cache/review-banners-complete.log`. As falhas intermediárias estão preservadas em `.cache/review-banners-final.log` e `.cache/review-banner-webkit-fixed.log`; não foram mascaradas removendo asserções.
- `node --test test/review-security.test.js test/management.test.js`: **5/5 passaram** após a correção de MIME, mantendo rejeição de conteúdo/declaração incompatíveis, upload vazio/excessivo, autenticação, CSRF, rate limit e permissões. Log `.cache/review-final-security.log`.
- Build regenerado após a última alteração CSS: JavaScript público gzip 21.511 bytes, CSS público 24.919 bytes e JavaScript administrativo 32.459 bytes; **9/9 limites aprovados**. Sintaxe dos seis módulos alterados aprovada e `git diff --check` sem erros de whitespace; avisos CRLF são do Git.
- **Pendências finais:** DNS/HTTPS e validação na publicação; variáveis reais da hospedagem; confirmação comercial dos 32 produtos sem preço e dos demais dados da empresa; homologação do número/aplicativo em aparelhos físicos. A execução completa de todos os cenários Firefox após as correções não foi repetida: só o fluxo geral foi aprovado na repetição. Portanto, a suíte inicial de 30 cenários não foi reclassificada como totalmente aprovada.
