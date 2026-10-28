# Layout baseado na referência do cliente — 28/10/2026

A loja pública foi ajustada a partir da fotografia enviada pelo responsável. A composição utiliza o logotipo e a fotografia de madeira já disponíveis no projeto; a fotografia do banner original não foi fornecida separadamente.

## Composição

- Cabeçalho grafite com marca à esquerda, busca central, atendimento, WhatsApp e lista de orçamento.
- Navegação compacta com as categorias que possuem produtos no catálogo.
- Banner horizontal de 260 px no desktop: madeira à esquerda, título branco e laranja no centro, chamada para produtos à direita e recorte diagonal de madeira. Os indicadores do orçamento ficam na base do banner.
- Categorias com fotos, sem molduras circulares, imediatamente abaixo do banner.
- Vitrine com seis colunas no desktop, quatro em telas intermediárias e duas no celular.
- Botões com laranja mais escuro para manter contraste legível sobre o fundo.
- Textos personalizados do painel continuam disponíveis no banner. Os textos padrão recebem a chamada da referência, sem modificar as configurações salvas.
- Espaço de rolagem no celular evita que a barra inferior cubra os links dos produtos.

## Arquivos

`css/storefront-original.css` concentra o ajuste visual e é carregado após os estilos anteriores. `index.html` já contém o banner atualizado antes do carregamento do catálogo. `js/app.js` aplica a mesma composição aos dados recebidos. O teste de contraste acompanha a nova posição do botão do banner. A verificação de desempenho inclui a nova folha de estilo e os estilos da marca.

## Verificação

- Catálogo real com 32 produtos: telas de 1440, 768, 390 e 360 px, sem transbordamento horizontal ou erros de JavaScript observados.
- Cinco testes do servidor aprovados, cobrindo apresentação, conteúdo personalizado, produtos e cálculo de orçamento.
- Fluxo de produto, galeria, cálculo, lista persistente e registro de orçamento aprovado em Chromium desktop, Android/Chromium, WebKit desktop e iPhone/WebKit.
- Navegação, teclado, categorias, oito verificações de contraste, orçamento e painel aprovados em Chromium desktop, Android/Chromium e iPhone/WebKit.
- O Firefox encerrou a aba em `browserContext.newPage`, antes de carregar o site, inclusive na repetição isolada sem trace. A validação nesse navegador permanece limitada pelo ambiente.
- Oito limites de tamanho aprovados. Build local atualizado em `public/`; arquivos principais conferidos contra as fontes e `git diff --check` aprovado.

Prévias finais: `.cache/layout-original-1440.png` e `.cache/layout-original-390.png`.

As alterações estão no projeto local. Não foi feita publicação nesta revisão.

## Painel administrativo — referência original

O administrativo também recebeu o visual grafite e laranja da fotografia: menu lateral com ícones de traço, seleção laranja, quatro indicadores com dados reais, categorias compactas, filtros escuros e tabela com linhas menores. Login, cadastros, mídia, campanhas, atendimentos, clientes, relatórios, histórico, equipe e conta seguem o mesmo tema. No celular, os indicadores formam duas colunas e a navegação permanece na barra inferior.

`css/admin-original.css` contém o tema, carregado por `admin/index.html`. O arquivo fica no diretório público de CSS aceito pelo servidor. `admin/admin.js` acrescenta os ícones e o indicador de quantidade de categorias. O build copia os estilos automaticamente; a verificação de desempenho inclui os arquivos do painel.

Verificações desta revisão:

- Dez telas acessadas em uma sessão de teste; conferência em 1440, 1024, 768, 390 e 360 px, sem transbordamento horizontal ou erros de JavaScript.
- Oito contrastes verificados, todos superiores a 4,5:1.
- Edição de produto, alteração de preço, operação em lote, exportação CSV e encerramento de sessão aprovados via Playwright/Chromium. A verificação usa uma cópia do catálogo em memória; não altera os produtos ou as credenciais do banco real.
- Cenário completo de loja e painel aprovado em Chromium desktop, Android/Chromium e iPhone/WebKit após o carregamento do tema escuro.
- O teste adicional legado `test/admin-browser.test.js`, baseado em CDP, excedeu seu limite de 90 segundos nas tentativas com Edge e Chromium, sem apontar uma etapa específica. Esse teste não foi considerado aprovado; os fluxos acima foram conferidos separadamente.
- Nove limites de tamanho aprovados, sintaxe de JavaScript e `git diff --check` aprovados. Os arquivos do build foram comparados com as fontes.
- `http://localhost:3000/admin` e a folha de estilo retornaram HTTP 200.

Prévias do painel: `.cache/admin-original-desktop.png`, `.cache/admin-original-mobile.png`, `.cache/admin-original-form.png` e `.cache/admin-original-metrics.png`.
