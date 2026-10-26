# Loja e páginas de produto

O catálogo mantém a identidade Madeireira Progresso, com navegação, vitrines e organização das informações inspiradas no site informado da Essential Nutrition. Os textos, fotos, produtos e condições comerciais são os da madeireira.

## Cadastro no painel

Em `/admin`, abra **Produtos → Novo produto** ou edite um cadastro existente. O formulário oferece descrição curta (até 600 caracteres), descrição completa (até 20.000), foto de capa, galeria com até 12 fotos adicionais, especificações, SKU, categoria, unidade de cobrança, preço, promoção, estoque, disponibilidade e destaque. É possível escolher a capa na biblioteca ou usar uma foto da galeria como capa. As fotos são verificadas pelo conteúdo, convertidas e otimizadas no servidor. Fotos vinculadas a uma galeria não podem ser excluídas da biblioteca.

Descrição curta aparece na vitrine e no resumo do produto. A descrição completa aparece abaixo da galeria e da compra, em texto simples com quebras de linha; HTML não é executado. A exportação WooCommerce inclui as duas descrições e todas as imagens.

Os links dos produtos seguem `/produto/ID/nome-do-produto` e abrem na mesma aba. São acessíveis diretamente, inclusive ao recarregar a página. Produtos retirados do catálogo respondem com página 404.

## Cálculo de metragem

O preço cadastrado acompanha a **unidade de cobrança** escolhida:

| Unidade | Cálculo |
| --- | --- |
| Unidade ou pacote | Quantidade × preço |
| Metro linear | Comprimento em metros × número de peças × preço por metro |
| Metro quadrado | Comprimento × largura × número de peças × preço por m² |
| Metro cúbico | Comprimento × largura × espessura × número de peças × preço por m³ |

As medidas são informadas em metros: 30 cm = 0,30 m; 2 cm = 0,02 m. A metragem é arredondada para cima até o próximo milésimo. O preço total é arredondado para centavos. Por exemplo: 2,5 × 0,30 × 4 = 3 m²; a R$ 45,50/m², o total é R$ 136,50. A calculadora informa limites de quantidade e estoque antes do envio.

O servidor recalcula as medidas, rejeita quantidades divergentes e consulta o preço real do banco. A solicitação guarda as medidas, a fórmula, a unidade e o preço como estavam no envio. Itens calculados mantêm a quantidade vinculada às medidas; o cliente pode abrir o produto para calcular outra medida. Itens sem preço permanecem **Sob consulta**.

## Pedidos e relatórios

O painel possui clientes, orçamentos com protocolo, responsáveis e histórico, estágios de atendimento, valor acordado, relatórios por período e exportação CSV de pedidos. O valor acordado soma somente solicitações aprovadas ou concluídas e não significa recebimento financeiro. O fluxo comercial continua sendo de orçamento: a equipe confirma o negócio e atualiza o estoque no cadastro; não há cobrança on-line, confirmação de pagamento ou baixa automática de estoque.

## Segurança e validação

Mantidas autenticação com senha protegida por scrypt, sessão HttpOnly/SameSite, CSRF, permissões por perfil, revogação de sessões, limitação de tentativas e requisições, auditoria e bloqueio de acesso a arquivos internos. A política de conteúdo permite a base de URLs somente na mesma origem, para servir as páginas de produto com seus arquivos públicos. Em produção, o servidor exige origem HTTPS e configura cookie Secure.

As verificações automatizadas cobrem cadastro, rotas públicas, cálculo linear/área/volume, arredondamento, adulteração de quantidade, galeria, login, permissões, pedidos, relatórios, exportações, imagens e navegação em navegador. Configuração de HTTPS, armazenamento externo dos backups e dados comerciais oficiais devem ser concluídos no ambiente de produção, conforme `OPERACAO.md`.

O catálogo existente conserva preços e unidades ainda não confirmados. Defina a unidade e o status de cada produto no painel antes de disponibilizar orçamentos; cadastre os preços reais para ativar os totais automáticos.
