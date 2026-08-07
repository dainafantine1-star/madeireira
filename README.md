# Madeireira Progresso — Site

Site institucional e e-commerce simples para a Madeireira Progresso. Mobile-first, com identidade visual laranja/preto, busca, carrinho e checkout via WhatsApp.

## 🌐 URL pública

Acesse em: **`https://luizrickston.github.io/madeireira-progresso/`** *(atualizar após o primeiro deploy)*

## 📁 Estrutura

```
madeireira-progresso/
├── index.html        # Página principal (única)
├── css/style.css     # Estilos (cores, responsividade)
├── js/
│   ├── data.js       # Lista de produtos
│   ├── ui.js         # Componentes (modal, drawer, toast)
│   └── app.js        # Lógica principal (carrinho, busca, filtros)
└── README.md         # Este arquivo
```

## ⚙️ Como editar

### 1. Trocar o número de WhatsApp (PRIORITÁRIO)

Abra `js/app.js` e edite a primeira linha dentro do `App`:

```js
const WHATSAPP_NUMBER = '5500000000000'; // TROCAR PARA O NÚMERO REAL
```

Formato: `55` (Brasil) + DDD (2 dígitos) + número (9 dígitos). Sem espaços, sem `+`.

Exemplo: um número `(64) 99999-8888` vira `5564999998888`.

### 2. Adicionar / editar / remover produtos

Abra `js/data.js`. Cada produto segue este formato:

```js
{
    id: 1,
    name: "Porta de Madeira Maciça",
    category: "portas",          // usado para filtro
    categoryLabel: "Portas",     // texto exibido
    price: 890,
    oldPrice: 1050,              // null se não tiver oferta
    offer: true,                 // mostra badge "OFERTA"
    description: "Texto curto...",
    specs: {                     // tabela no modal
        "Material": "Angelim",
        "Medida": "80x210cm"
    },
    image: "URL da foto"         // JPG/PNG/WebP
}
```

Categorias disponíveis: `portas`, `cancelas`, `ripas`, `tabuas`, `decks`, `forros`, `estrutural`.

### 3. Trocar as fotos dos produtos

As fotos atuais vêm do Unsplash via URL. Para usar fotos reais do cliente:

1. Coloque as imagens em uma pasta `images/` (crie se precisar)
2. Troque a URL em `data.js` por `images/nome-do-arquivo.jpg`
3. As imagens serão commitadas junto com o site

Tamanho recomendado: **800x600px**, JPEG ou WebP, máximo 200KB cada.

### 4. Editar os banners do carrossel (hero)

Abra `index.html` e procure por `<!-- ===== HERO CARROSSEL ===== -->`. Cada `article.hero__slide` é um banner. Edite o `tag`, `title` e `text` de cada um.

### 5. Mudar cores

Abra `css/style.css` e procure por `:root` no topo. As variáveis são:

```css
--orange: #FF6B1A;        /* cor principal */
--orange-light: #FF8A3D;  /* hover */
--orange-soft: #FFB347;   /* tons suaves */
--black: #0A0A0A;         /* fundo principal */
--ink: #1a1410;           /* fundo secundário */
```

## 🚀 Como atualizar o site no ar

Toda vez que você editar algo:

```bash
cd madeireira-progresso
git add .
git commit -m "Mudei o produto X"
git push
```

O GitHub Pages atualiza em 30-60 segundos automaticamente.

## 🛒 Como funciona o carrinho

- O cliente adiciona produtos, ajusta quantidade
- Ao clicar em **"Finalizar pelo WhatsApp"**, abre uma conversa pré-preenchida com a lista de itens e o total
- **Não há pagamento no site** — o fechamento do pedido é todo pelo WhatsApp
- O carrinho fica salvo no navegador (localStorage), então sobrevive a um F5

## 💡 Próximos passos (futuro)

- Integrar gateway de pagamento (Mercado Pago, PagSeguro)
- Painel admin para editar produtos sem mexer em código
- Sistema de login para clientes
- Controle de estoque
- Cupons de desconto

---

**Feito com 🪵 pela Chapada Digital**
