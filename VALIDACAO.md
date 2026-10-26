# Validação local

## Refinamento visual aprovado — 23/10/2026

- `npm.cmd test`: **22 passaram**, sem falhas, cancelamentos ou testes ignorados; inclui Edge, segurança e três cenários novos de apresentação pública.
- `npm.cmd run test:browsers`: **5 passaram** — Chromium, Firefox, WebKit, iPhone/WebKit e Android/Chromium emulados. Os cenários agora verificam a abertura estática, contato provisório, campanhas editadas, fontes locais, oito contrastes e os fluxos de teclado, orçamento e administração.
- `npm.cmd run check:performance`: os oito limites passaram, incluindo 62.944 bytes de fontes WOFF2 locais.
- JavaScript modificado validado com `node --check`; não existem scripts de build/lint no projeto.

Mudanças por arquivo, decisões e checklist de conteúdo real: [REFINAMENTO-VISUAL.md](REFINAMENTO-VISUAL.md). As fontes locais carregam na prévia em `http://localhost:3000`; a apresentação pública preserva os dados comerciais no banco. A identidade oficial, fotografias reais, confirmação comercial e homologação física continuam pendentes conforme o checklist.

## Atualização de segurança — 23/10/2026

`npm.cmd test`: **19 testes passaram**, incluindo os dois fluxos Edge, sem falhas, cancelamentos ou testes ignorados. Quatro novos cenários cobrem URLs codificadas, links de diretório, URL malformada, ordenação inválida e CSV com prefixos ASCII/Unicode/controle, incluindo persistência e exportação WooCommerce. O verificador pós-publicação também rejeita as URLs maliciosas; sua execução contra um servidor local isolado passou. Os sete limites de tamanho continuam aprovados.

Os testes Edge exigiram execução com permissão para iniciar navegadores neste ambiente. No Firefox/Windows, o trace causou timeouts em diferentes ações; o cenário completo passou sem trace. A configuração desativa o trace apenas desse projeto no Windows, mantendo as verificações, screenshots de falha e contextos de erro. O CI Linux mantém o trace. Os resultados finais dos cinco cenários e os limites desta validação estão em [REVISAO-SEGURANCA.md](REVISAO-SEGURANCA.md).

## Registro anterior — 22/10/2026

## Executado

| Verificação | Resultado |
| --- | --- |
| `npm test` | 15 testes passaram, sem falhas ou testes ignorados neste Windows com Edge instalado |
| Métricas/operação após os últimos ajustes | 4 testes passaram: deduplicação e reenvio; snapshots e intervalos; restauração; permissões/cache; proxy |
| `npm run test:browsers` | 5 cenários passaram: Chromium desktop, Firefox desktop, WebKit desktop, iPhone/WebKit e Android/Chromium emulados |
| `npm run check:performance` | Limites de tamanho aprovados; detalhes em performance-results.json |
| `docker compose config --quiet` | Configuração válida com variáveis de validação, sem iniciar containers |
| `npm run check:deployment` local | Saúde, catálogo, páginas e assets acessíveis; fontes, credenciais, banco e operações administrativas protegidos |
| Banco local após reinício | 5 migrations; integrity_check = ok; nenhuma violação de chave estrangeira |
| Backup antes das migrations novas | Arquivo privado em storage/backups, preservando o banco anterior |
| Agendamento de backup no servidor local | Primeira execução concluída; intervalo padrão de 24 horas enquanto o processo estiver ativo |

Os testes de backend cobrem login, proprietário, cookie/CSRF, expiração, revogação, usuário desativado, permissões, validação de produto/imagem, estoque, ações em lote com rollback, importação com prévia e idempotência, CSV WooCommerce, orçamento com protocolo, quantidades fracionadas por unidade, transições comerciais, snapshots e histórico. Os testes Edge acrescentam os fluxos completos pelo painel. A matriz Playwright verifica teclado, painéis inertes, retorno de foco, carrossel pausável, contraste do CTA, orçamento, deduplicação, login, dashboard/CSV, formulário administrativo e ausência de rolagem horizontal.

A restauração testada usa dados isolados: proprietário, cliente, orçamento com medidas e histórico, produto, imagem e três variantes, além da auditoria. O teste rejeita chave incorreta, arquivo alterado e destino já existente; confere dados, hashes e integridade, revoga sessões e inicia o servidor com o banco e a mídia restaurados para testar login, saúde e entrega de imagem. Não altera os dados da loja.

O ambiente local não tem `.env` com uma chave de backup, portanto os backups locais de desenvolvimento são abertos e permanecem fora do Git/servidor público. A criptografia AES-256-GCM foi validada nos testes e é obrigatória ao iniciar em produção. Configure a chave e o destino externo conforme OPERACAO.md.

## Necessário antes de homologar produção

- Ligar o motor Docker e executar construção/execução da imagem: a CLI está instalada, mas o daemon Linux não estava disponível neste ambiente. O workflow CI foi preparado; sua execução no GitHub ainda não ocorreu.
- Configurar hospedagem, domínio/DNS, HTTPS real, PUBLIC_ORIGIN, segredos e montagem externa de backup com permissão para o usuário da aplicação.
- Repetir as verificações pós-publicação na origem HTTPS e testar restauração usando uma cópia do armazenamento externo efetivo.
- Medir LCP, INP e CLS na hospedagem e, quando houver tráfego, no percentil 75 das visitas. Os testes locais de tamanho não comprovam estes indicadores em campo.
- Homologar iPhone e Android físicos, incluindo teclado virtual, leitor de tela, zoom e rede lenta. Emulação de navegador não comprova estas condições.
- Aplicar o manual e o logo oficiais quando o PDF for enviado e substituir os dados comerciais provisórios pelo painel, conforme a decisão do responsável.

Guia de operação e recuperação: [OPERACAO.md](OPERACAO.md). Fórmulas e limites das métricas: [METRICAS.md](METRICAS.md).
# Reformulação da loja — 26/10/2026

- Backend: 24/24 testes aprovados em execução sequencial, cobrindo segurança, autenticação, permissões, catálogo, importação, imagens, clientes, pedidos, relatórios, backups e cálculos de metragem.
- Navegador: quatro fluxos aprovados (loja e página de produto, cada um em Chromium desktop e Android), incluindo teclado, contraste, ausência de rolagem horizontal, galeria, cálculo, persistência do carrinho e envio de orçamento com protocolo.
- Painel em navegador: cadastro e imagem, preço, estoque/disponibilidade, ações em lote, CSV, equipe, clientes, atendimento até conclusão, campanhas, configurações e relatórios aprovados.
- Loja em navegador: conteúdo hostil, falha de imagem, armazenamento bloqueado, recuperação de carrinho, protocolo, WhatsApp e indisponibilidade/recuperação da API aprovados.
- Limites de desempenho aprovados incluindo os novos arquivos: JavaScript público aproximadamente 19 KB gzip, CSS público aproximadamente 19 KB gzip e JavaScript administrativo aproximadamente 30 KB gzip.
- Prévia local com os 32 produtos reais: início, página individual e API respondendo HTTP 200, sem erros JavaScript ou rolagem horizontal nas capturas de computador e celular.
- Os 32 produtos reais continuam sem preço e unidade confirmados. A calculadora foi validada com dados isolados; preencher unidade/status e preço real no painel habilita o fluxo nos produtos da empresa. Nenhum preço ou unidade foi inventado.
- Não foi realizada nova homologação em Firefox/WebKit nesta reformulação. A revisão é funcional e de código; HTTPS, destino externo de backups, segredos e controles de infraestrutura dependem do ambiente de publicação.

