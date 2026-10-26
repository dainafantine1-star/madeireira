# Refinamento da loja pública — 23/10/2026

Plano aprovado pelo responsável após a auditoria visual. Escopo: abertura, catálogo, categorias, detalhes do produto, lista de orçamento, formulário e contato. O painel administrativo não foi redesenhado.

## O que mudou, por arquivo

| Arquivo | Mudança | Motivo |
| --- | --- | --- |
| `index.html` | Abertura estática, catálogo mais próximo, categorias integradas ao catálogo, roteiro de orçamento na seção institucional, textos diretos, skip link e ícones acessíveis. | Facilitar encontrar produtos e compreender a solicitação. |
| `css/storefront-refined.css` | Camada exclusiva da loja com tokens, fontes locais, escala h1–h6, corpo de 16 px, terracota sólida, neutros quentes, cantos de até 8 px e separadores de 1 px. | Evoluir a identidade existente sem afetar os estilos do painel. |
| `js/app.js` | Remove a rotação automática; simplifica cards; torna foto e nome botões de detalhes; preserva campanhas personalizadas como conteúdo estático e categorias com contagens reais. | Reduzir distração e competição entre ações. |
| `js/storefront-policy.js` | Apresenta contatos não confirmados como provisórios, oculta os dez URLs de demonstração e a textura ilustrativa quando usada como foto de produto, atualiza apenas copy padrão e preserva conteúdo personalizado. | Evitar apresentar exemplos como informações verificadas, sem alterar os dados salvos. |
| `js/ui.js` | Ícones de uma mesma família visual, fallback “Foto indisponível”, títulos e controles legíveis nos painéis; “Solicitar orçamento deste produto” substitui “Comprar no WhatsApp”. | Alinhar o texto ao fluxo real e tornar os estados claros. |
| `assets/fonts/` | Bitter e Source Sans 3 em WOFF2, com licenças OFL. Total de 62.944 bytes para as fontes. | Títulos com caráter e interface legível, servidos pela própria aplicação. |
| `server/index.js` | Acrescenta MIME `font/woff2` à lista de extensões públicas; mantém a restrição de diretórios e caminhos reais. | Permitir as fontes locais sem reabrir a exposição de arquivos internos. |
| `scripts/performance.js` | Inclui a nova folha de estilo, o módulo de apresentação e um limite de 100 KB para fontes. | Não deixar os novos assets fora da verificação de tamanho. |
| `test/storefront-policy.test.js` | Três cenários cobrem contatos não confirmados, preservação de dados personalizados e distinção entre fotos demonstrativas e fotos novas. | Proteger regras de confiança e evitar supressão de conteúdo real. |
| `test/browser.test.js` | Fixture de contato explicitamente confirmada e fluxo de orçamento pelo botão correto dos detalhes. | Continuar verificando o comportamento real após a mudança de UI. |
| `e2e/experience.spec.js` | Verifica abertura estática, fontes locais, contato provisório, categorias, campanhas editadas, oito contrastes, teclado, orçamento e painel. | Trocar expectativas do carrossel removido por critérios do design aprovado, mantendo as verificações funcionais. |

Não foram instalados pacotes npm nem alterados preços, cadastros, URLs de imagens ou configurações persistidas. A marca continua textual até o envio do logotipo oficial. As regras de apresentação são reversíveis.

## Decisões de apresentação

- Bitter nos títulos e Source Sans 3 no corpo; ambas carregam localmente com `font-display: swap`. A inspeção do navegador confirmou o uso efetivo dos arquivos personalizados.
- Destaque sólido `#B94B17`, fundo `#FFFDF8` e texto/estrutura `#293228`. O verde escuro da identidade anterior permanece na estrutura.
- Título principal de 56 px no desktop e 36 px no celular, seções de 40/28 px, corpo de 16 px. Dados secundários e rótulos têm escala própria para não competir com os títulos.
- Os três tipos de micro-interação são estados de hover, foco visível e confirmação de inclusão no orçamento. Não há rotação automática, zoom decorativo de imagens ou animação de entrada. Movimento reduzido continua respeitado.
- Campanhas que ainda correspondem integralmente aos três exemplos da importação inicial não ocupam a página. Alterações de tag, texto, imagem, CTA ou destino tornam a campanha visível; nenhum registro é apagado.
- Benefícios personalizados continuam visíveis quando os dados comerciais estão confirmados. Enquanto isso, a abertura explica o fluxo de orçamento que a aplicação realmente oferece.
- Com `confirmed: false`, telefone, endereço e horários são substituídos por avisos de atualização; não há convite a um WhatsApp não confirmado. A solicitação pelo formulário continua disponível e gera protocolo.
- Valores numéricos não confirmados recebem “Valor de referência · a confirmar”. Produtos sem preço continuam como “Sob consulta”.

## Evidências verificadas

| Componente | Contraste anterior | Contraste após o ajuste |
| --- | --- | --- |
| Adicionar ao orçamento | 4,25:1 | 5,14:1 |
| Texto de contato/horários | 2,50:1 | 6,27:1 |
| Rodapé inferior | 4,12:1 | 9,45:1 |

As razões usam cores computadas no navegador. A referência de texto normal é [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Isso não constitui certificação completa de acessibilidade.

- `npm.cmd test`: 22 testes passaram, sem falhas, cancelamentos ou testes ignorados; inclui os fluxos Edge e os testes de segurança anteriores.
- Inspeção visual em 320, 390, 768 e 1440 px: sem rolagem horizontal ou erros JavaScript; duas fontes locais carregadas. O tablet recebeu grade de duas colunas após essa inspeção.
- Limites de tamanho de JavaScript, CSS, imagens e fontes: aprovados.
- `npm.cmd run test:browsers`: os cinco cenários passaram, sem falhas, com a configuração final do projeto.

| Navegador/cenário | Resultado |
| --- | --- |
| Chromium desktop | Passou |
| Firefox desktop | Passou |
| WebKit desktop | Passou |
| iPhone/WebKit emulado | Passou |
| Android/Chromium emulado | Passou |

Os cenários verificam a política de contato provisório antes da confirmação, a preservação de campanha editada, categorias, abertura e fechamento de detalhes pelo teclado, retorno de foco, lista, envio do orçamento com protocolo, deduplicação, login, dashboard e CSV. Oito pares de contraste são verificados em cada cenário, além de carregamento efetivo e MIME das duas fontes locais.

## O que ainda depende da empresa

- [ ] Fotografar cada produto, mostrando peça, acabamento e medidas. Os exemplos antigos ficam ocultos; fotos novas enviadas pelo painel ou novas URLs continuam aceitas.
- [ ] Enviar fotografia real da loja/equipe para substituir a única fotografia sintética da abertura, já rotulada como ilustrativa.
- [ ] Fornecer logotipo e manual oficial. As novas fontes são a evolução aprovada da apresentação textual, não um novo logotipo oficial.
- [ ] Confirmar telefone, WhatsApp, endereço, horários e região atendida pelo painel.
- [ ] Revisar preços, unidades, medidas, material, garantias e condições de entrega/pagamento dos produtos antes de confirmar o catálogo.
- [ ] Obter depoimento verdadeiro com nome, foto e autorização, se desejar prova social. Nenhuma avaliação ou estatística foi inventada.
- [ ] Homologar em celulares físicos, leitor de tela e hospedagem real; os testes móveis são emulados. LCP, INP e CLS em produção não foram medidos nesta etapa.

Não há scripts de build ou lint neste projeto. A validação usa checagem de sintaxe JavaScript, testes Node/Edge, Playwright e os limites de tamanho existentes. Hospedagem, backups externos e publicação continuam fora deste refinamento visual.
