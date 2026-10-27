# Publicação na Vercel — loja e administração

## Destino

Projeto: `vercel-madeireira`, equipe `imobiliaria7`. O vínculo local está em `.vercel/project.json`, ignorado pelo Git. A aplicação usa Node.js 24, função em `api/index.js` e recursos públicos gerados por `npm run build:vercel` em `public/`.

A conta foi consultada e está no plano Hobby. O proprietário esclareceu que esta publicação é exclusivamente para teste interno, sem uso comercial, e autorizou conectar `crmchapada.com.br`. A conexão desse teste não aguarda ativação do Pro. Para uso comercial futuro, verificar o plano adequado. Referência: [Vercel — uso comercial](https://vercel.com/docs/limits/fair-use-guidelines).

## Persistência e segurança

O banco principal da versão web é um snapshot SQLite criptografado com AES-256-GCM, guardado em Vercel Blob **privado**, em `database/store.mpdb`. Cada chamada dinâmica baixa a versão atual diretamente da origem e usa um diretório temporário exclusivo. O disco temporário não é o armazenamento definitivo.

Uma gravação usa `If-Match` com o ETag da versão lida. Em caso de conflito, a chamada recomeça a partir da versão mais recente, até cinco tentativas. A resposta de sucesso, o cookie de login e o protocolo de orçamento só são enviados depois de persistir a atualização. Falhas de persistência retornam 503. O banco continua validando preços, quantidades, estoque, medidas, sessões e permissões no servidor.

Para preservar um ETag forte, a leitura usada por atualizações pede `Accept-Encoding: identity`. Na verificação real do Blob, arquivos binários maiores recebiam ETags fracos (`W/`) quando comprimidos; esses identificadores não podem autorizar `If-Match`. A correção foi validada no armazenamento real com arquivos temporários, incluindo recusa de ETags fracos nos testes.

As imagens são objetos imutáveis no mesmo armazenamento privado. Uma imagem nova é gravada antes do banco que a referencia. `/uploads/` só entrega arquivos registrados no banco; banco e backups não possuem rotas públicas. A exclusão retira o registro do banco, preservando objetos antigos para não quebrar leituras concorrentes. A remoção definitiva de objetos órfãos exige uma rotina de retenção que considere os backups.

O login continua usando scrypt e cookies HttpOnly/Secure/SameSite, proteção CSRF, revogação de sessões e permissões aplicadas no servidor. Os limites de solicitações da versão web ficam no banco compartilhado, e não apenas na memória de uma função. Os endereços IP são usados como hashes nesses contadores.

## Variáveis protegidas

| Variável | Uso |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Criada e conectada pela própria Vercel ao armazenamento privado do projeto. |
| `BACKUP_KEY` | Chave exclusiva da nuvem para criptografar banco e backups. |
| `CRON_SECRET` | Autenticação do backup agendado. |
| `PUBLIC_ORIGIN` | Configurada em produção como `https://crmchapada.com.br`. As URLs da implantação e do projeto são reconhecidas pelas variáveis de sistema da Vercel. |

A chave exclusiva da nuvem e o segredo do cron estão em `.env.vercel.local`, ignorado pelo Git e pelo upload. Guardar uma cópia segura e separada desse arquivo é indispensável para recuperar os dados da nuvem. A chave dos backups locais anteriores permanece no `.env` original. O token administrativo da API Vercel não foi incluído nas variáveis da aplicação.

Houve autorização explícita do proprietário para configurar os dois segredos e migrar o conteúdo para esse destino. A revisão automática inicialmente exigiu essas autorizações; ambas foram obtidas antes da transferência.

## Migração

`scripts/migrate-vercel.js` faz backup criptografado, confere integridade e chaves estrangeiras, copia imagens e grava o banco criptografado. As sessões antigas são removidas somente da cópia exportada. A importação recusa sobrescrever um banco que já exista na nuvem. Não executar esse script para substituir dados da publicação em funcionamento.

Conteúdo migrado: 42 produtos, 32 imagens, uma conta administrativa, nenhum cliente e nenhum orçamento. A configuração de publicação dos produtos foi preservada: nem todos os 42 registros do admin estavam ativos na vitrine. O WhatsApp permanece `5575992222895`. Não houve envio de mensagens reais.

Depois da migração, as alterações feitas pelo admin da publicação são salvas na nuvem; a prévia local e o banco local não recebem sincronização automática.

## Uploads e backups

Uploads no painel aceitam JPEG, PNG e WebP de até **3 MB**, verificados e otimizados pelo servidor. O limite considera a expansão em base64 e o limite de corpo das funções da Vercel. Referência: [Vercel — limites de funções](https://vercel.com/docs/functions/limitations).

O cron de `vercel.json` chama `/api/cron/backup` diariamente às 06h UTC, **03h na Bahia**. A rota exige o segredo do cron e gera um arquivo MPB1 criptografado com banco e mídias, compatível com a restauração já existente. A função também registra o snapshot diário de métricas. Cron não depende de um processo Node continuamente ativo.

Para restaurar um arquivo da nuvem localmente, usar a chave exclusiva da nuvem e o comando `backup:restore`, com um diretório de destino novo. Nunca sobrescrever uma instalação em uso. Definir retenção e monitorar falhas do cron e espaço/uso do Blob no painel Vercel.

## Limites da arquitetura

Esta implantação preserva o modelo transacional do sistema existente usando snapshots privados e gravações condicionais do Blob. Ela foi dimensionada para o catálogo atual e baixa concorrência de escrita. Cada atualização regrava o snapshot completo; há limite de 64 MiB para o banco. Ao crescer o volume de dados, operações ou concorrência, migrar para um serviço de banco gerenciado com transações remotas. Consumo de Blob e funções deve ser acompanhado no painel.

Referências: [Vercel Blob — gravações condicionais](https://vercel.com/docs/vercel-blob), [armazenamento privado](https://vercel.com/docs/vercel-blob/private-storage).

## Validação

- Rodada completa: 39 testes passaram, sem falhas, cancelamentos ou testes ignorados. Inclui loja e admin em navegador real.
- Testes específicos de nuvem: criptografia autenticada, conflito entre gravações simultâneas, idempotência, falha de armazenamento sem falso sucesso, login entre invocações, CSRF, persistência de produtos e imagens, proteção de órfãos e restauração de backup.
- Após a correção de ETag, os cinco testes de nuvem passaram novamente, incluindo regressões para leitura sem compressão e recusa de ETag fraco.
- Auditoria npm após correção transitiva: nenhuma vulnerabilidade conhecida. O SDK oficial `@vercel/blob` está fixado; a dependência transitiva Zod foi atualizada por override compatível para a versão corrigida 4.6.7.
- Build remoto e implantação principal da versão corrigida concluídos. A versão para revisão está em `https://vercel-madeireira-8x0kcp9fm-imobiliaria7.vercel.app`, protegida pela autenticação da Vercel.
- Os 28 testes HTTP remotos passaram também no alias principal antes de ele ser retirado: saúde, CSP/HSTS, bloqueio de fontes e dados internos, login do proprietário, cookies seguros, CSRF, gravação/leitura/exclusão de produto e imagem temporários e encerramento de sessão. Os testes não criaram clientes nem orçamentos.
- Verificação visual remota em Chromium: vitrine com 32 produtos ativos, login real do proprietário, painel e logout passaram; nenhuma exceção JavaScript. Capturas: `previa-vercel-loja.png` e `previa-vercel-admin.png`.
- Backup executado na função remota e restaurado em diretório temporário isolado: integridade OK, nenhuma violação de chave estrangeira, 42 produtos, 32 imagens e sessões revogadas. O diretório temporário foi removido após a verificação.

## Domínio do teste — DNS pendente

`crmchapada.com.br` e `www.crmchapada.com.br` foram adicionados e verificados no projeto. O endereço `www` redireciona para o domínio principal com HTTP 308. `PUBLIC_ORIGIN` foi configurada e uma nova implantação de produção foi concluída: `https://vercel-madeireira-es79lijrm-imobiliaria7.vercel.app`. Loja, admin, saúde da API e catálogo responderam 200 na implantação protegida; a vitrine mantém 32 produtos publicados. Nenhum domínio de outro projeto foi alterado.

O proprietário escolheu usar somente o domínio próprio; não reativar `vercel-madeireira.vercel.app`. O endereço longo de implantação permanece protegido pelo login Vercel, além do login próprio do admin.

O DNS ainda impede o acesso pelo domínio. Consultas independentes via Google e Cloudflare retornaram SERVFAIL. O Google detalhou que os servidores autoritativos recusam as consultas (REFUSED); o Cloudflare informou Not Authoritative / No Reachable Authority. Isso também ocorre com validação DNSSEC desativada na consulta. A API Vercel identifica os servidores `aisha.ns.cloudflare.com` e `terin.ns.cloudflare.com`, mas considera o domínio mal configurado. Verificar se a zona existe e está ativa na conta Cloudflare correta e comparar os servidores atribuídos com os configurados no registrador. Apenas aguardar propagação não resolve uma zona ausente ou uma delegação incorreta.

Registros recomendados pela API Vercel para este projeto:

| Tipo | Nome | Destino | Proxy Cloudflare |
| --- | --- | --- | --- |
| A | @ | 216.198.79.1 | Somente DNS |
| A | @ | 64.29.17.1 | Somente DNS |
| CNAME | www | 596ae90d2ef96671.vercel-dns-017.com | Somente DNS |

Não alterar MX, TXT de e-mail ou subdomínios de outros sistemas. Não há acesso autorizado ao painel/API Cloudflare nesta sessão; esses registros não foram editados. Evidências da conexão e do diagnóstico estão em `.cache/vercel-domain-setup.json` e `.cache/vercel-domain-verification.json`. Após corrigir a zona e os registros, verificar a configuração e o certificado na Vercel e testar loja e login em `https://crmchapada.com.br/admin/` antes de considerar o domínio operacional.

Guardar `.env.vercel.local` também para o backup de recuperação criado durante esta migração, pois a migração usou a chave exclusiva da nuvem. Os backups locais anteriores continuam usando a chave original do `.env`.
