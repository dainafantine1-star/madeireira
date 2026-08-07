/* ================================================================
   data.js — Catálogo de produtos da Madeireira Progresso
   Edite esse arquivo para adicionar/remover produtos ou mudar
   preços, descrições, categorias e fotos.
   ================================================================ */

const PRODUCTS = [
    {
        id: 1,
        name: "Porta de Madeira Maciça",
        category: "portas",
        categoryLabel: "Portas",
        price: 890,
        oldPrice: 1050,
        offer: true,
        description: "Porta lisa em madeira maciça de angelim, acabamento envernizado. Ideal para entradas residenciais. Medida padrão 80x210cm.",
        specs: {
            "Material": "Angelim",
            "Medida": "80x210cm",
            "Acabamento": "Verniz",
            "Garantia": "12 meses"
        },
        image: "https://images.unsplash.com/photo-1558959356-2f3f6c0d62fa?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 2,
        name: "Cancela Rústica 3m",
        category: "cancelas",
        categoryLabel: "Cancelas",
        price: 1450,
        oldPrice: null,
        offer: false,
        description: "Cancela em madeira de eucalipto tratado, ideal para chácaras e sítios. Pintura e ferragens inclusas.",
        specs: {
            "Material": "Eucalipto tratado",
            "Largura": "3 metros",
            "Inclui": "Ferragens",
            "Garantia": "6 meses"
        },
        image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 3,
        name: "Ripa de Pinus 5cm (Pacote 10un)",
        category: "ripas",
        categoryLabel: "Ripas",
        price: 89,
        oldPrice: null,
        offer: false,
        description: "Pacote com 10 ripas de pinus 5x2cm, 3 metros de comprimento. Excelente para acabamento e forro.",
        specs: {
            "Material": "Pinus",
            "Medida": "5x2cm x 3m",
            "Pacote": "10 unidades",
            "Uso": "Acabamento"
        },
        image: "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 4,
        name: "Tábua de Eucalipto 30cm",
        category: "tabuas",
        categoryLabel: "Tábuas",
        price: 145,
        oldPrice: 175,
        offer: true,
        description: "Tábua de eucalipto tratada, 30cm de largura, vendido por metro linear. Resistente e durável.",
        specs: {
            "Material": "Eucalipto tratado",
            "Largura": "30cm",
            "Espessura": "2.5cm",
            "Venda": "Por metro"
        },
        image: "https://images.unsplash.com/photo-1601142888860-b60d29f12ce0?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 5,
        name: "Deck de Cumaru 2m²",
        category: "decks",
        categoryLabel: "Decks",
        price: 380,
        oldPrice: null,
        offer: false,
        description: "Deck de cumaru premium para áreas externas. Resistente ao sol e chuva. Peças de 1m x 10cm.",
        specs: {
            "Material": "Cumaru",
            "Área": "2m²",
            "Peça": "100x10cm",
            "Resistência": "Alta"
        },
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 6,
        name: "Forro de Cedro 5m²",
        category: "forros",
        categoryLabel: "Forros",
        price: 520,
        oldPrice: 620,
        offer: true,
        description: "Forro de cedro rosa com encaixe macho-fêmea. Pacote cobre 5m². Acabamento nobre.",
        specs: {
            "Material": "Cedro Rosa",
            "Área": "5m²",
            "Encaixe": "Macho-fêmea",
            "Espessura": "12mm"
        },
        image: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 7,
        name: "Porta Lisa Mogno",
        category: "portas",
        categoryLabel: "Portas",
        price: 1290,
        oldPrice: null,
        offer: false,
        description: "Porta lisa em mogno com acabamento acetinado. Sofisticação e resistência para projetos premium.",
        specs: {
            "Material": "Mogno",
            "Medida": "90x210cm",
            "Acabamento": "Acetinado",
            "Garantia": "24 meses"
        },
        image: "https://images.unsplash.com/photo-1597918216049-1f1a36d9f4d4?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 8,
        name: "Cancela de Garagem 4m",
        category: "cancelas",
        categoryLabel: "Cancelas",
        price: 2180,
        oldPrice: null,
        offer: false,
        description: "Cancela reforçada para garagem, 4 metros de largura. Madeira maciça e dobradiças industriais.",
        specs: {
            "Material": "Madeira maciça",
            "Largura": "4 metros",
            "Reforço": "Dobradiça industrial",
            "Uso": "Garagem"
        },
        image: "https://images.unsplash.com/photo-1597007030739-6d2e7172ee6e?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 9,
        name: "Ripa de Cedro Rosa (Pacote 20un)",
        category: "ripas",
        categoryLabel: "Ripas",
        price: 175,
        oldPrice: null,
        offer: false,
        description: "Pacote com 20 ripas de cedro rosa, 5x2cm x 3m. Perfeito para forro e detalhes finos.",
        specs: {
            "Material": "Cedro Rosa",
            "Medida": "5x2cm x 3m",
            "Pacote": "20 unidades",
            "Uso": "Forro/Detalhes"
        },
        image: "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=600&q=70&auto=format&fit=crop"
    },
    {
        id: 10,
        name: "Viga de Eucalipto Tratado 6m",
        category: "estrutural",
        categoryLabel: "Estrutural",
        price: 320,
        oldPrice: 390,
        offer: true,
        description: "Viga de eucalipto autoclavado, 6 metros, ideal para estruturas de telhado e pergolados.",
        specs: {
            "Material": "Eucalipto tratado",
            "Comprimento": "6 metros",
            "Seção": "10x10cm",
            "Tratamento": "Autoclave"
        },
        image: "https://images.unsplash.com/photo-1601054831128-9c4a76b1c1d8?w=600&q=70&auto=format&fit=crop"
    }
];

/* Categorias disponíveis (para renderizar filtros dinamicamente se quiser) */
const CATEGORIES = [
    { id: "todas", label: "Todas" },
    { id: "portas", label: "Portas" },
    { id: "cancelas", label: "Cancelas" },
    { id: "ripas", label: "Ripas" },
    { id: "tabuas", label: "Tábuas" },
    { id: "decks", label: "Decks" },
    { id: "forros", label: "Forros" },
    { id: "estrutural", label: "Estrutural" }
];
