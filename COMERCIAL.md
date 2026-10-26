# Loja, atendimento e campanhas · Blocos 5, 6 e 7

## Experiência pública

Busca visível no desktop e ampla no celular, contato, WhatsApp e orçamento no cabeçalho. Categorias têm imagem ou ícone; promoções possuem acesso próprio; destaques são controlados pelo painel. A busca considera nome, SKU, código, descrição, dimensões, comprimento e especificações, normalizando acentos, espaços, `x`/`×`, vírgula decimal e medidas. Ex.: `80 x 210 cm`, `80×210cm`, `TB 001` e `tabua`.

Cards claros exibem dimensões, comprimento e unidade. A barra inferior mobile tem Início, Categorias, Promoções e Orçamentos, com espaço reservado para conteúdo e WhatsApp.

**Identidade visual pendente:** o usuário informou que enviará o manual em PDF. A marca textual e os textos/cores atuais são provisórios. Não foi inventado um logotipo oficial. O painel permite aplicar logo, foto e conteúdo quando os materiais chegarem. O logo usa `object-fit: contain`, sem recorte ou mudança de proporção; upload de logo é gravado em WebP sem perdas. A fotografia gerada em `assets/hero-madeira.webp` é ilustrativa; origem e prompt em [VISUAL.md](VISUAL.md).

## Solicitação pública

1. Adicione produtos ou clique em Comprar no WhatsApp.
2. Ajuste quantidade, medidas e especificações por item. Um produto pode ocupar vários itens com medidas diferentes.
3. Informe nome, telefone com DDD, e-mail opcional, retirada ou consulta de entrega, endereço quando houver entrega e observações.
4. Envie: o servidor revalida produtos, quantidades, disponibilidade e preços, associa/cria o cliente e salva tudo em transação.
5. A confirmação mostra um protocolo `MP-data-identificador`. Continuar no WhatsApp é opcional; a solicitação já está no painel, mesmo se o número da empresa ainda não estiver configurado.

Unidade e pacote: quantidades inteiras. Metro, m² e m³: até três casas decimais, mínimo 0,001. Limite por item configurado na empresa (padrão 99, máximo configurável 10.000). Estoque controlado segue a precisão da unidade; todos os itens do mesmo produto são somados na validação de disponibilidade.

O valor mostrado é **estimado**, com arredondamento por item em centavos. Preço desconhecido permanece `null`/Sob consulta. O valor fechado é separado e informado pela equipe após negociação.

Cada tentativa possui UUID e impressão do conteúdo normalizado. Reenvio idêntico devolve o mesmo protocolo; outros dados com a mesma chave são rejeitados. A chave de tentativa e um hash ficam na sessão do navegador quando permitido, sem persistir nome, telefone ou senha. O carrinho conserva apenas itens/especificações. Armazenamento bloqueado mantém a operação em memória e mostra aviso.

## Atendimento e pedidos

Desktop: **Orçamentos e pedidos**. Celular: **Mais → Atendimentos**. Busca por protocolo/nome/contato, filtros por estágio e responsável e paginação. Detalhes incluem origem, contato da solicitação, itens, medidas, especificações, unidades, estimativa, valor fechado, entrega, condições e datas. É possível criar orçamento manual para cliente existente com múltiplos itens.

Estágios aceitos pelo usuário:

| Estágio | Transições |
|---|---|
| Recebido | Em atendimento ou Cancelado |
| Em atendimento | Aguardando aprovação ou Cancelado |
| Aguardando aprovação | Aprovado, Em atendimento ou Cancelado |
| Aprovado | Concluído, Em atendimento ou Cancelado |
| Concluído / Cancelado | Encerrado, sem edição retroativa |

Aprovação exige valor fechado positivo; conclusão exige responsável ativo; cancelamento exige motivo. Para mudar um valor aprovado, volte a Em atendimento e faça nova aprovação. Aprovação/conclusão/cancelamento têm confirmação na interface. A aprovação é registrada pela equipe após o combinado com o cliente; não é assinatura digital do cliente.

Ao aprovar/concluir, o mesmo registro passa a pedido (`kind=order`), preservando ID e protocolo. Versões impedem sobrescrita concorrente. Histórico e auditoria registram usuário, data, estágio, andamento e valores. O histórico não pode ser reescrito. Contato recebido e cadastro do cliente são distintos para preservar o contexto original.

**Estoque:** orçamento e mudança de estágio não reservam nem baixam estoque automaticamente. A equipe ajusta as quantidades no cadastro do produto. Toda nova solicitação revalida o estoque; os textos do painel informam essa regra.

## Clientes

Cadastro, edição, busca e paginação com nome, telefone, e-mail, endereço, observações internas e documento opcional. O cadastro mostra histórico comercial e permite abrir atendimentos ou criar orçamento vinculado.

Telefone brasileiro é normalizado com país e DDD; e-mail não diferencia maiúsculas/minúsculas. O cadastro administrativo recusa telefone/e-mail já associados a outro cliente. Na solicitação pública, um contato correspondente reutiliza o cliente, mas nunca sobrescreve perfil ou observações internas. Telefone e e-mail que apontam a clientes diferentes exigem correção, sem fusão automática. Registros antigos são preservados e comparados por telefone normalizado. Documento é opcional, sem validação fiscal ou deduplicação automática.

## Banners e empresa

**Banners e campanhas:** imagem, chamada, título, texto, CTA, destino, ordem e ativação, com prévia ao digitar. Banners ativos seguem a ordem no carrossel após o hero institucional. Destinos aceitos: seção da página, caminho interno ou HTTPS; JavaScript e URLs com credenciais são rejeitados. Caminhos internos precisam existir na loja. Desativar retira do público sem apagar o registro.

**Dados da empresa:** nome, logo, endereço, telefone, WhatsApp, mensagem padrão, horários, entrega, região, pagamento, condições, hero, texto institucional, benefícios e rodapé. A configuração alimenta cabeçalho, contato, mensagens, banners e rodapé. A mensagem padrão inicia também o texto do orçamento com itens e protocolo.

Estoque configurável: produto zerado como indisponível ou oculto; limiar de alerta para novos produtos; limite de quantidade por item. Alterar o limiar padrão não reescreve limites já personalizados. Credenciais não entram nas configurações públicas. A loja atualiza ao recarregar, recuperar foco ou consultar o servidor a cada 30 segundos; não exige republicação. Mídias ligadas a empresa ou campanhas não podem ser removidas antes de substituir o vínculo.

## Persistência e API

Migration `003-commerce.sql` preserva banco anterior, clientes, pedidos, itens, preços e snapshots. `stock_milli` guarda estoque em milésimos; a coluna `stock` permanece apenas por compatibilidade e não deve ser editada diretamente. Quantidades dos itens aceitam frações. Registros antigos recebem protocolo e entrada identificada de migração no histórico. Há teste com banco v2 preenchido e checagem de chaves estrangeiras.

Solicitação pública (`POST /api/quotes`):

```json
{
  "requestKey": "UUID-ALEATORIO-POR-TENTATIVA",
  "customer": { "name": "Nome do cliente", "phone": "71999998888", "email": "" },
  "fulfillment": "delivery", "deliveryAddress": "Endereço para consultar entrega", "notes": "Prazo desejado",
  "items": [{ "id": 1, "qty": 1, "lineKey": "UUID-DO-ITEM", "measures": "80 x 210 cm", "specifications": "Acabamento desejado" }]
}
```

| Endpoint | Operação |
|---|---|
| `GET /api/admin/orders?q=&stage=&assigned=&page=` | Atendimentos paginados |
| `POST /api/admin/orders` | Solicitação manual com `customerId`, itens e UUID |
| `GET /api/admin/orders/:id` | Detalhes, itens, histórico e transições |
| `PUT /api/admin/orders/:id` | `{version,stage,assignedTo,finalTotal,note}` |
| `GET /api/admin/assignees` | Responsáveis ativos |
| `GET /api/admin/customers?q=&page=` | Busca e paginação |
| `POST /api/admin/customers` | Cadastro com controle de duplicidade |
| `GET, PUT /api/admin/customers/:id` | Cadastro/histórico ou edição com versão |
| `GET, POST /api/admin/banners` | Listagem e cadastro de campanhas |
| `PUT /api/admin/banners/:id` | Edição, ordem e ativação com versão |
| `GET, PUT /api/admin/settings` | Configurações completas com versão |

Autenticação, CSRF, expiração, revogação e limites continuam aplicados. Configurações são restritas a administrador/proprietário; equipe autorizada administra atendimentos, clientes e campanhas. Não existem endpoints públicos de listagem ou consulta de clientes/negociações por protocolo.
