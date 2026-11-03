# Banners da loja

## Revisão de 01/11/2026

O editor oferece **Remover imagem**, aplicada somente ao salvar, e **Excluir banner**, com confirmação. A API DELETE exige a versão atual; edição concorrente retorna 409. Promoções são excluídas; o principal fica vazio/desativado para permitir a próxima arte. Imagens continuam na biblioteca e referências compartilhadas são preservadas. Para excluir o arquivo da biblioteca, retirar primeiro todos os vínculos.

O WebKit deste Windows informa MIME vazio para WebP. O cliente usa a extensão somente nesse caso, mantendo a validação real dos bytes no servidor. A proporção móvel pertence ao contêiner do carrossel; a faixa de slides absoluta evita que a altura intrínseca imponha 300 px no WebKit.

Regressão completa: `node scripts/run-browsers.js e2e/banners.spec.js --project=chromium-desktop --project=iphone-webkit --trace=off`. O teste usa uploads temporários e cobre substituição, remoção, cancelamento/confirmação de exclusão, reload, arte compartilhada e medidas em 1920/1440/390. Resultados atuais em [REVISAO-INTEGRAL-2026-11-01.md](REVISAO-INTEGRAL-2026-11-01.md); as seções abaixo são históricas.

O painel **Banners e campanhas** controla `banners.placement`: `home` para o banner principal único e `promotion` para as imagens do carrossel. A API pública entrega a posição e o estado; a home desativada permanece na resposta para a vitrine ocultar essa área. Promoções desativadas não são publicadas.

- Principal: arte de 1920 × 600 px, proporção 16:5, largura total da tela. A exibição escala com a largura e tem teto de 600 px.
- Banner secundário de promoções: recomendado 1320 × 300 px, proporção 22:5; altura de 300 px no desktop, conteúdo limitado à largura da vitrine e padding lateral de 24 px. No celular, padding de 16 px e altura proporcional. Cantos de 8 px. Sem limite de quantidade cadastrado; ordenação por ordem e ID.
- JPEG, PNG ou WebP de até 3 MB. Upload com uso `banner` preserva até 2560 px; outras proporções são aceitas, mas o enquadramento pode cortar partes da arte. Usar as proporções indicadas.
- Setas, indicadores, ciclo de seis segundos e gesto lateral com duas ou mais imagens. Movimento reduzido desabilita a rotação automática. Sem artes ativas, a seção de promoções fica oculta.

## Migração e diagnóstico

`008_banner_placements.sql` aproveita a primeira campanha com imagem na ordenação atual como home, mantendo o ID e o caminho da arte. Se não houver arte em campanhas, usa a imagem institucional já salva; bancos novos mantêm a composição inicial até o primeiro upload. Não são criadas artes de promoção.

Para investigar divergências, comparar a imagem/posição/estado de `/api/admin/banners` com `/api/catalog`; depois conferir o `src` em `.home-image-banner img` e `.campaign-slide-img`, e o HTTP da mídia. O painel de empresa direciona a gestão dessas imagens para Banners e campanhas.

Executar `node --test test/banner-placements.test.js test/commerce.test.js` e `node scripts/run-browsers.js e2e/banners.spec.js --project=chromium-desktop`. O teste de navegador usa banco isolado, faz upload real e verifica 12 promoções, setas e largura em 1440/390 px. Regenerar `public/` com `npm.cmd run build:vercel` após mudanças nas fontes.

## Publicação

Implementação local: a migração só alcança a base publicada quando essa versão for implantada. A imagem vista na captura não está no banco local consultado; o reaproveitamento é feito pela migração sobre os registros da base que receber a atualização. Não registrar isso como imagem já publicada antes de conferir o ambiente remoto.

## Evidências locais — 29/10/2026

35 testes existentes de dados/API e dois novos testes de banners passaram. Migração com arte prévia, unicidade da home, 125 promoções, ordenação, concorrência e estado desativado conferidos. Chromium passou no fluxo de upload real e 12 promoções, navegação circular, largura da home em 1440/390 px e ocultação da home desativada, sem erros de JavaScript. Captura local: `.cache/banners-mobile.png`. Testes CDP antigos não passaram (inicialização/timeout do navegador); não compõem a evidência de sucesso. A publicação remota permanece pendente.

O fluxo geral de loja/painel em `experience.spec.js` também passou no Chromium. Inspeção visual levou as etapas do orçamento para uma faixa abaixo da arte; teste geométrico e nova execução do fluxo de banners aprovados. Build final e `git diff --check` aprovados.

## Refinamento de dimensões e painel

O usuário revisou o principal para 1920 × 600 e as promoções para 300 px de altura; confirmou manter a imagem atual para trocar posteriormente. `css/storefront-original.css` controla os enquadramentos e as margens. `css/admin-original.css` aplica padding de 24 px nos painéis (18 no celular), distância de 20 px antes do botão e 24 px até a grade, além de prévias que mostram a arte completa. Textos de ajuda na listagem e no editor acompanham os novos tamanhos.

O teste de banners aprovou proporção da home em 1920/1440/390 px, altura e margens das promoções, raio, ausência de overflow e distância entre botão e grade no painel, além de upload e navegação circular. Capturas inspecionadas em `.cache/banners-layout-1440.png` e `.cache/banners-admin-spacing.png`. O cenário manual usa movimento reduzido para que a rotação automática não altere o índice durante as capturas. Build e `git diff --check` aprovados. Sem publicação nesta revisão.
