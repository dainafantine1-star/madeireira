# Revisão de funcionamento e segurança — 23/10/2026

## Resultado

Os quatro achados de código abaixo foram corrigidos. Os testes de regressão confirmam bloqueio dos acessos internos, proteção dos textos em CSV, rejeição de ordenações inválidas e resposta 400 a URLs malformadas. Os dados comerciais reais não foram alterados. As reproduções abaixo preservam o diagnóstico anterior às correções.

## Correções aplicadas

| Problema | Correção e evidência |
| --- | --- |
| Exposição de arquivos internos | Rejeição de segmentos de navegação; resolução do caminho real e restrição à pasta pública específica, incluindo alvos de links simbólicos/junctions. URLs do diagnóstico retornam 404; páginas e assets legítimos continuam acessíveis. |
| Fórmulas em CSV | Codificador compartilhado detecta prefixos ASCII, Unicode compatível e caracteres de controle/invisíveis. Relatórios recebem tabulação de proteção; arquivos de importação mantêm apóstrofo. Testados cadastro persistido, métricas, exportação WooCommerce e leitura do modelo do painel, sem modificar o texto no banco. |
| Ordenação com propriedades herdadas | `Object.hasOwn` limita a ordenação às quatro opções declaradas. `constructor`, `toString`, `__proto__` e outras entradas inválidas retornam 400; ordenações válidas retornam 200. |
| Codificação inválida de URL | Erros de decodificação retornam 400 com mensagem de URL inválida, sem erro interno 500. |

O teste `test/security.test.js` contém quatro cenários de regressão, com múltiplas entradas adversariais. O verificador `scripts/verify-deployment.js` também testa as URLs de exposição e a codificação inválida para impedir que a verificação pós-publicação ignore esses casos novamente.

### Navegadores e instrumentação

Os dois testes Edge passaram ao executar com permissão para iniciar os navegadores fora da restrição de processos. Não foi necessário alterar o fluxo da aplicação ou aumentar os tempos desses testes.

No Firefox, as execuções com trace falharam em ações diferentes, inclusive com screenshots/snapshots desativados. A mesma sequência completa passou sem trace, com as mesmas verificações. A configuração agora desativa o trace do Firefox no Windows; screenshots de falha e contextos de erro permanecem habilitados, e o CI Linux mantém o trace. Não foram removidas verificações de foco, teclado, orçamento, login ou painel.

### Validação após as correções

- `npm.cmd test`: 19 testes passaram, incluindo Edge, backend e as quatro novas regressões de segurança; nenhum cancelamento, falha ou teste ignorado.
- `node --test test/security.test.js`: os quatro cenários passaram novamente depois de incluir a regressão com junction/link de diretório.
- `scripts/verify-deployment.js`, executado contra servidor local com banco isolado: todas as verificações passaram, incluindo as URLs maliciosas acrescentadas.
- Fluxo Firefox sem trace: passou; a validação final da configuração permanente está registrada na tabela de conclusão abaixo.
- Banco local consultado com conexão somente leitura: `PRAGMA quick_check = ok`, nenhuma violação de chave estrangeira, `confirmed = false` e formato de WhatsApp inválido. Nenhum cadastro foi alterado. Não há arquivo `.env` local; configurações do futuro provedor não foram consultadas.

Os testes de CSV verificam os arquivos gerados e a importação do painel. Não foi executado teste nativo de abertura/regravação em Excel ou LibreOffice, nem importação em uma instalação real do WooCommerce.

### Conclusão da validação final — 23/10/2026

| Verificação | Resultado final |
| --- | --- |
| `npm.cmd test` | 19 passaram; 0 falhas, cancelamentos ou testes ignorados |
| `npm.cmd run test:browsers`, configuração final permanente | 5 passaram, comando concluído com código 0 |
| Chromium desktop | Passou |
| Firefox desktop | Passou, com trace desativado no Windows; mesmas verificações de teclado, foco e fluxo completo |
| WebKit desktop | Passou |
| iPhone/WebKit emulado | Passou |
| Android/Chromium emulado | Passou |
| `npm.cmd run check:performance` | Todos os 7 limites passaram; código 0 |
| Verificador pós-publicação contra servidor local isolado | Passou, incluindo bloqueios de exposição e URL malformada |
| Banco local em modo somente leitura | `quick_check = ok`; 0 violações de chave estrangeira |

Nenhum dos quatro achados de código ficou sem correção. As pendências são a configuração e homologação externas descritas ao final deste documento. Não houve publicação nem alteração dos dados reais da empresa.

## Diagnóstico original, antes das correções

### 1. Alta: acesso público a arquivos internos por URL codificada

Local: `server/index.js:91–100`.

A lista de caminhos públicos permite segmentos `..`. Depois de decodificar a URL, o servidor resolve o caminho e verifica somente se o arquivo está dentro da raiz do projeto. Isso permite sair das pastas públicas e entrar em `server` e `test`.

Reprodução em servidor local com banco isolado, sem autenticação:

| Requisição | Resultado observado |
| --- | --- |
| `/server/auth.js` | 404 |
| `/assets/..%2fserver/auth.js` | 200, conteúdo de `server/auth.js` |
| `/css/..%2ftest/store.test.js` | 200, conteúdo do teste |
| `/js/%2e%2e%2fserver/backup.js` | 200, conteúdo de `server/backup.js` |

Impacto comprovado: divulgação de código do backend e de testes. Não foi comprovado download de `.env`, banco SQLite, senhas reais ou arquivos fora da raiz do projeto; o filtro de extensões ainda restringe os arquivos servidos.

Correção indicada: rejeitar segmentos de navegação depois de decodificar e verificar o destino resolvido contra a pasta pública específica autorizada. Adicionar regressões para barras codificadas e variações de segmentos; manter bloqueadas fontes internas e arquivos privados.

Referência: [OWASP — Path Traversal](https://community.owasp.org/attacks/Path_Traversal).

### 2. Média, condicionada à planilha utilizada: proteção incompleta contra fórmulas em CSV

Local: `server/analytics.js:89`. O exportador em `server/csv.js` também deve ser considerado na correção.

A neutralização dos relatórios cobre os prefixos ASCII `=`, `+`, `-`, `@`, tabulação e retorno de carro, mas não cobre variantes Unicode de largura completa. A OWASP documenta que essas variantes podem ser interpretadas como fórmulas em determinadas configurações regionais de planilhas.

Reprodução isolada: um editor cadastra um produto cujo nome é `\uFF1D1+1` (igual de largura completa seguido de `1+1`); registra-se uma visualização do produto e exporta-se o relatório de produtos. O nome é aceito e a célula é exportada sem neutralização. O teste confirmou o caractere inicial U+FF1D e a presença da célula original no CSV.

Impacto: possível interpretação de conteúdo cadastrado como fórmula ao abrir o relatório. A execução em Excel/LibreOffice não foi testada; o risco depende da aplicação e da configuração regional. Não foi demonstrada execução de código no computador.

Correção indicada: definir uma política de exportação para as planilhas suportadas, cobrir variantes Unicode e caracteres de controle, e validar o arquivo nessas aplicações. Diferenciar relatórios para leitura humana de arquivos destinados à importação WooCommerce, para preservar a compatibilidade de dados.

Referência: [OWASP — CSV Injection](https://community.owasp.org/attacks/CSV_Injection), incluindo as limitações das estratégias de escape.

### 3. Baixa: parâmetros de ordenação inválidos produzem erro interno

Local: `server/products.js:55`.

O mapa de ordenações é um objeto JavaScript comum. A consulta por chave também encontra propriedades herdadas, que passam na verificação de valor verdadeiro e são interpoladas na cláusula `ORDER BY`.

Reprodução com sessão administrativa de teste:

| Requisição | Resultado observado |
| --- | --- |
| `/api/admin/products?sort=constructor` | 500 |
| `/api/admin/products?sort=toString` | 500 |

Impacto: quebra da listagem nessa requisição e geração de erro interno. Não foi demonstrada injeção SQL nem acesso sem autenticação.

Correção indicada: validar a chave com `Object.hasOwn` ou usar `Map`; parâmetros desconhecidos devem retornar 400.

### 4. Baixa: URL com codificação inválida produz erro 500

Local: `server/index.js:91` e tratamento de erros em `server/index.js:104`.

Reprodução pública: `/assets/%E0%A4%A` retorna 500 porque `decodeURIComponent` lança `URIError`. O cliente recebe uma mensagem genérica e o servidor registra o erro; não houve queda do processo.

Correção indicada: tratar erro de decodificação como requisição inválida (400) e adicionar regressão.

## Verificações executadas no diagnóstico original

Os testes de backend utilizaram bancos temporários/em memória, sem alterar o cadastro real. Os testes de navegador podem atualizar screenshots e relatórios locais. O verificador de tamanho atualiza `performance-results.json`.

| Verificação | Resultado nesta revisão |
| --- | --- |
| `npm.cmd test` | 13 passaram; 2 testes de navegador Edge foram cancelados por timeout (90 s e 60 s); comando terminou com código 1 |
| Backend isolado: `node --test --test-force-exit test/store.test.js test/commerce.test.js test/management.test.js test/analytics-operations.test.js` | 13 passaram, sem falhas ou cancelamentos |
| Playwright Chromium desktop | 1 cenário completo passou |
| Playwright WebKit desktop | 1 cenário completo passou |
| Playwright iPhone/WebKit emulado | 1 cenário completo passou |
| Playwright Android/Chromium emulado | 1 cenário completo passou |
| Playwright Firefox desktop, execução inicial | Navegador caiu em `browserContext.newPage: Target crashed`, antes de carregar a aplicação |
| Playwright Firefox desktop, repetição com execução ampliada | Abriu a loja, mas falhou por timeout ao tentar reabrir os detalhes pelo teclado depois de Escape (`e2e/experience.spec.js:25`) |
| `npm.cmd run check:performance` | Todos os 7 limites de tamanho passaram; não mede desempenho real da hospedagem |
| `npm.cmd audit --json --cache .cache/npm-audit` | 0 vulnerabilidades conhecidas informadas pelo registro npm |
| Testes adversariais adicionais em memória | Confirmaram os quatro achados acima, com a ressalva de interpretação de CSV descrita no achado 2 |

Backend: autenticação, cookies/CSRF, permissões, revogação e expiração de sessões, produtos, estoque, importação/exportação, migrações, orçamentos, clientes, transições de atendimento, métricas e backup/restauração.

O cenário Chromium verificou navegação por teclado, foco e painéis, orçamento com protocolo, deduplicação, login, métricas, CSV, abertura de formulário administrativo e ausência de erros JavaScript no fluxo coberto.

No diagnóstico inicial, a repetição no Firefox conseguiu abrir a página e verificar a primeira abertura/fechamento dos detalhes, mas a tentativa seguinte de Enter expirou. A investigação posterior da instrumentação e o ajuste estão descritos em “Correções aplicadas”. Evidências do diagnóstico inicial: `.cache/review-firefox-results/experience-storefront-keyb-e2f4a-on-admin-and-real-dashboard-firefox-desktop/error-context.md` e `trace.zip` na mesma pasta.

## Condições operacionais que continuam pendentes

- Validar a hospedagem real, HTTPS, domínio, origem pública e restrição do acesso direto ao servidor. Esta revisão foi local.
- Configurar e testar o proxy confiável na infraestrutura escolhida. Sem isso, os limites usam o IP da conexão TCP e usuários atrás do mesmo proxy podem compartilhar os limites. O Compose define o proxy; `render.yaml` não define `TRUST_PROXY_IP`.
- Configurar chave de backup e armazenamento externo; testar restauração a partir desse armazenamento. Os testes criptográficos locais passaram.
- Aplicar retenção e alertas de disco/backups. A ausência de limpeza automática é documentada em `OPERACAO.md`; backups completos acumulados exigem operação contínua.
- Substituir e confirmar os contatos e dados comerciais com informações oficiais da empresa. A conferência somente leitura do banco local confirmou `confirmed = false` e WhatsApp com formato inválido.
- Homologar Excel/LibreOffice e a importação WooCommerce nas versões usadas pela empresa. A proteção e os formatos foram verificados no código e em testes automatizados; essas aplicações externas não foram exercitadas.

Os resultados desta revisão não substituem a validação do ambiente publicado ou um teste de intrusão completo.
