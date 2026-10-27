# Revisão de segurança e orçamento — 26/10/2026

## Escopo

Revisão local do código, rotas, configuração de publicação e fluxo de orçamento. Alterações que já estavam no diretório foram preservadas. Não houve publicação, envio de mensagens reais nem alteração de clientes, produtos ou pedidos reais. O banco real foi aberto somente para leitura das configurações de atendimento e verificações de integridade.

| Pasta / área | Verificação |
| --- | --- |
| `server/` e `server/migrations/` | Autenticação, permissões, cookies, CSRF, consultas parametrizadas, validação, orçamentos, clientes, auditoria, uploads e backups. |
| `js/` e `index.html` | Escape de conteúdo, recuperação do carrinho, validação das quantidades, cálculo de medidas e encaminhamento para WhatsApp. Dados de contato não são persistidos pelo fluxo de orçamento em localStorage. |
| `admin/` | Sessão por cookie HttpOnly, token CSRF em memória, permissões aplicadas também pelo servidor, separação do cadastro interno e do formulário público. |
| `css/`, `assets/`, `LOGO/`, `catalogo_madeireira/` | Separação entre recursos públicos e arquivos de origem/importação; somente extensões e caminhos permitidos são servidos. Imagens de catálogo são públicas por natureza. |
| `storage/` | Banco e backups fora das rotas públicas e do controle de versão. Integridade do banco local verificada sem escrita. |
| `scripts/` | Importação, exportação, operação, publicação e execução de testes; comandos operacionais não são endpoints públicos. |
| `deploy/`, Docker, Render e `.github/` | HTTPS/HSTS, execução do contêiner sem root, volume persistente, exclusão de dados e segredos da imagem, exigência de chave para backups de produção e verificações no CI. |
| `test/` e `e2e/` | Regressões de acesso indevido, CSV, sessão, medidas, orçamento completo, popups e listas extensas. |
| `.cache/`, `.git/` e arquivos de ambiente | Fora das rotas públicas; caches e dados locais ignorados pelo Git. Nenhum `.env`, SQLite ou backup apareceu na consulta de arquivos rastreados. |

## Ajustes desta revisão

- Configurações públicas passam a usar uma lista explícita de campos. Chaves internas eventualmente presentes no JSON não aparecem em `/api/settings` ou `/api/catalog`.
- A solicitação pública aceita somente nome, telefone e e-mail dentro do contato. Documentos, notas internas e endereço cadastral arbitrário não são incorporados ao CRM nem ao resumo público. O endereço de entrega continua sendo informado no campo próprio. Dados privados de clientes existentes permanecem preservados.
- A rota de orçamento limita solicitações a 10 por minuto por IP, além do limite geral da API. O controle atual funciona por processo; múltiplas instâncias exigem limite compartilhado na infraestrutura.
- O corpo da solicitação aceita até 768 KiB, permitindo os 100 itens previstos com medidas e especificações extensas. A quantidade de itens, os limites de cada campo e os cálculos continuam validados no servidor.
- Cabeçalho `Permissions-Policy` desativa câmera, microfone e geolocalização.
- Foram encontrados e criptografados os 12 arquivos `.mpbackup` de `storage/backups`, usando AES-256-GCM e o formato MPB1 já suportado pela restauração. Antes da substituição de cada arquivo, foram conferidos o manifesto, os hashes e a igualdade integral do conteúdo após descriptografia. Uma chave aleatória de 32 bytes foi criada no `.env` local, ignorado pelo Git e pelo Docker; ela não foi impressa em logs. Uma cópia segura e separada desse arquivo é necessária para recuperação. O banco ativo não foi modificado. Novos comandos `npm start` e `npm run backup:create` carregam essa chave; processos que já estiverem rodando precisam ser reiniciados para usá-la.
- Listas cujo link ultrapassa 16.000 caracteres oferecem texto integral e botão de cópia; o WhatsApp abre na conversa configurada, para colar e confirmar o envio. Nenhum item é truncado. Esse valor é uma escolha conservadora da aplicação, não um limite universal publicado pelo WhatsApp.

## Atendimento e conteúdo da mensagem

O banco local já contém `5575992222895`, com `whatsappConfirmed=true`. Os outros dados institucionais permanecem pendentes de confirmação (`confirmed=false`); a confirmação do WhatsApp é independente.

A mensagem contém protocolo, nome e contato do cliente, e-mail opcional, cada produto com nome, SKU, referência, especificações cadastradas, dimensões, comprimento, unidade de cobrança, quantidade, medidas/cortes solicitados, demais detalhes, valores estimados ou “sob consulta”, subtotais, retirada/entrega, observações e condições comerciais. Os dados dos produtos são recuperados e calculados no servidor e preservados no pedido, sem confiar em nomes, SKUs ou preços enviados pelo navegador.

O site registra a solicitação e prepara a conversa; o cliente confirma o envio no aplicativo. O clique não comprova entrega ou leitura da mensagem. Referência: [WhatsApp — Click to chat](https://faq.whatsapp.com/5913398998672934).

## Validação

- Testes específicos de proteção de dados e mensagem: 6 passaram, nenhuma falha, incluindo solicitação HTTP com 100 itens e texto superior ao antigo limite de 64 KiB.
- Auditoria oficial do npm, com dependências de produção e desenvolvimento: nenhuma vulnerabilidade conhecida reportada nesta execução.
- Banco local: `PRAGMA quick_check = ok`; nenhuma violação de chave estrangeira.
- A primeira execução geral no sandbox teve falha de inicialização do Edge e cancelamento por tempo no teste de vitrine. A execução final `npm test -- --test-concurrency=1`, com autorização para iniciar navegadores, passou: 34 testes, nenhuma falha, cancelamento ou teste ignorado. Inclui navegação real no Edge para loja e painel, autenticação, CSRF, permissões, arquivos internos, CSV, cálculos, importação, snapshots de produtos e restauração de backup criptografado.
- Após criptografia, a inspeção independente dos cabeçalhos confirmou 12 backups MPB1 e nenhum backup MPB0 em `storage/backups`. O banco ativo continuou íntegro e sem violações de chave estrangeira.
- Testes específicos de WhatsApp: os três cenários passaram em Chromium desktop, WebKit desktop, iPhone/WebKit emulado e Android/Chromium emulado, totalizando 12 aprovações. Verificam mensagem integral, abertura da conversa, isolamento de `window.opener`, erro de API, bloqueio de popup e cópia de lista extensa. A comunicação com `wa.me` foi interceptada no teste; nenhuma mensagem real foi enviada.
- Firefox: a tentativa inicial excedeu o tempo ao preencher `deliveryAddress`, antes do envio, e as repetições também travaram, inclusive sem trace/screenshot. As execuções sem progresso foram interrompidas. Não foi determinada a causa; a compatibilidade desse fluxo no Firefox permanece sem homologação. Nenhuma asserção foi removida nem alteração no produto foi feita para mascarar esse resultado.
- `git diff --check` passou; `.env`, `storage/backups` e `.cache` foram confirmados como ignorados pelo Git.

## Limites e operação

Esta revisão não equivale a um teste de invasão da hospedagem. Domínio, TLS real, ambiente de produção, permissões do provedor e entrega no aparelho do funcionário não foram homologados aqui. O banco SQLite ativo não possui criptografia própria; a proteção em repouso depende da criptografia e das permissões do disco/volume e do acesso à conta e ao OneDrive. Backups de produção já exigem `BACKUP_KEY`; a chave deve ficar fora do repositório e ser guardada separadamente das cópias. Referência: [OWASP — REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).

A criptografia local não remove versões antigas eventualmente retidas pelo OneDrive ou por outras cópias externas. A chave do `.env` não deve ser enviada junto com backups a terceiros. O `.env` local não configura automaticamente os segredos do provedor de hospedagem.

Não foi feita exclusão de dados históricos ou alteração de política de retenção. Deve-se definir a retenção dos contatos, orçamentos, auditoria e backups conforme a operação da empresa.
