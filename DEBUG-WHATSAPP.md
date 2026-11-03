# Lista de compras → WhatsApp direto

Em 29/10/2026 o usuário substituiu a decisão anterior de formulário mínimo: nenhum campo de nome, telefone, e-mail, entrega ou retirada deve aparecer antes da conversa.

`openRequest` em `js/app.js` usa `StoreCore.shoppingMessage` para montar a mensagem a partir do catálogo carregado, incluindo produtos, SKU/referência, especificações, dimensões, medidas/cortes, quantidades, preços e subtotais estimados, itens sob consulta e condições comerciais. O carrinho e a solicitação na página do produto usam o mesmo caminho.

O clique abre `wa.me` diretamente. Se a nova aba estiver bloqueada, a página atual navega para o mesmo link. A lista permanece no carrinho. Não há chamada a `POST /api/quotes`, cadastro de contato, pedido registrado ou protocolo nesse fluxo. A API de orçamentos registrados permanece disponível para seus outros consumidores e conserva a validação de contato.

Para links acima de 16.000 caracteres, preserva-se o texto integral em uma área somente de leitura com cópia e abre-se a conversa configurada. Essa é uma exceção técnica para listas extensas; não há formulário de dados pessoais. A tentativa de copiar automaticamente pode depender das permissões do navegador; o botão permite repetir a cópia.

## Conferência

Executar `node --test test/shopping-message.test.js test/commerce.test.js test/quote-message.test.js` e `node scripts/run-browsers.js e2e/quote-message.spec.js e2e/product-page.spec.js e2e/experience.spec.js --project=chromium-desktop`. Conferir ausência de `quoteForm`, destino e mensagem decodificada, não envio à API de cadastro, zero clientes/pedidos novos, popup bloqueado e último item em listas extensas. Interceptar `wa.me` nos testes para não enviar mensagens reais.

Regenerar `public/` com `npm.cmd run build:vercel`. Publicação e envio real no aparelho não são comprovados por testes locais.

## Resultado local — 29/10/2026

Nove testes de dados/mensagem aprovados. Oito cenários de produto, envio direto, popup bloqueado e lista extensa passaram em Chromium desktop e iPhone/WebKit. Fluxo geral de loja/painel aprovado no Chromium. Repetição específica confirmou gravação da métrica de clique sem criar cliente/pedido. Nenhuma mensagem real enviada; publicação permanece pendente.
