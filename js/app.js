/* ================================================================
   app.js — Lógica principal da Madeireira Progresso
   - Renderização de produtos
   - Filtros e busca
   - Carrinho (localStorage)
   - Carrossel do hero
   - Checkout via WhatsApp
   ================================================================ */

const App = (() => {

    /* === CONFIGURAÇÃO PRINCIPAL === */
    // TROCAR PARA O NÚMERO REAL DO CLIENTE (apenas dígitos, com DDD e país)
    // Ex: 5564999998888 (55 = Brasil, 64 = DDD, 999999888 = número)
    const WHATSAPP_NUMBER = '5500000000000';
    const CART_STORAGE_KEY = 'mp_cart_v1';

    /* === Estado === */
    let currentCategory = 'todas';
    let currentSearch = '';
    let cart = loadCart();
    let heroIndex = 0;
    let heroTimer = null;

    /* === Helpers === */
    function loadCart() {
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveCart() {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        UI.updateBadge(cart.reduce((s, i) => s + i.qty, 0));
        UI.renderCart(cart.map(i => ({
            product: PRODUCTS.find(p => p.id === i.id),
            qty: i.qty
        })).filter(i => i.product));
    }

    /* === Renderização dos produtos === */
    function renderProducts() {
        const grid = document.getElementById('productsGrid');
        const empty = document.getElementById('emptyState');

        const filtered = PRODUCTS.filter(p => {
            const matchCat = currentCategory === 'todas' || p.category === currentCategory;
            const term = currentSearch.toLowerCase().trim();
            const matchSearch = !term ||
                p.name.toLowerCase().includes(term) ||
                p.description.toLowerCase().includes(term) ||
                p.categoryLabel.toLowerCase().includes(term);
            return matchCat && matchSearch;
        });

        if (filtered.length === 0) {
            grid.innerHTML = '';
            empty.hidden = false;
            return;
        }
        empty.hidden = true;

        grid.innerHTML = filtered.map(p => {
            const priceHtml = p.oldPrice
                ? `<div class="product__price-row">
                     <span class="product__price">${UI.formatPrice(p.price)}</span>
                     <span class="product__price-old">${UI.formatPrice(p.oldPrice)}</span>
                   </div>`
                : `<div class="product__price-row">
                     <span class="product__price">${UI.formatPrice(p.price)}</span>
                   </div>`;

            const badgeHtml = p.offer ? `<span class="product__badge">Oferta</span>` : '';

            return `
                <article class="product" data-id="${p.id}">
                    <div class="product__media">
                        <img class="product__img" src="${UI.sanitize(p.image)}" alt="${UI.sanitize(p.name)}" loading="lazy">
                        ${badgeHtml}
                    </div>
                    <div class="product__body">
                        <span class="product__category">${UI.sanitize(p.categoryLabel)}</span>
                        <h3 class="product__name">${UI.sanitize(p.name)}</h3>
                        <p class="product__desc">${UI.sanitize(p.description)}</p>
                        ${priceHtml}
                        <button class="product__btn" data-buy="${p.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.5l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6"/></svg>
                            Comprar
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        // Bindings
        grid.querySelectorAll('.product').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-buy]')) return; // o botão Comprar tem handler próprio
                const id = +card.dataset.id;
                const product = PRODUCTS.find(p => p.id === id);
                if (product) UI.openProductModal(product);
            });
        });
        grid.querySelectorAll('[data-buy]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = +btn.dataset.buy;
                App.addToCart(id, 1);
                const p = PRODUCTS.find(x => x.id === id);
                if (p) UI.toast(`${p.name} adicionado`);
            });
        });
    }

    /* === Filtros === */
    function bindFilters() {
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.chip').forEach(c => {
                    c.classList.remove('chip--active');
                    c.setAttribute('aria-selected', 'false');
                });
                chip.classList.add('chip--active');
                chip.setAttribute('aria-selected', 'true');
                currentCategory = chip.dataset.cat;
                renderProducts();
            });
        });
        document.getElementById('clearFilters')?.addEventListener('click', () => {
            currentCategory = 'todas';
            currentSearch = '';
            document.querySelectorAll('.chip').forEach(c => {
                c.classList.toggle('chip--active', c.dataset.cat === 'todas');
            });
            document.getElementById('searchInput').value = '';
            renderProducts();
        });
    }

    /* === Busca === */
    function bindSearch() {
        const overlay = document.getElementById('searchOverlay');
        const input = document.getElementById('searchInput');
        const toggle = document.getElementById('searchToggle');
        const close = document.getElementById('searchClose');

        const open = () => {
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            setTimeout(() => input.focus(), 50);
        };
        const closeFn = () => {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            input.value = '';
            currentSearch = '';
            renderProducts();
        };

        toggle.addEventListener('click', open);
        close.addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });

        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                currentSearch = input.value;
                renderProducts();
                // também rola até o catálogo pra dar feedback visual
                document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeFn();
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                open();
            }
        });
    }

    /* === Menu mobile === */
    function bindMenu() {
        const toggle = document.getElementById('menuToggle');
        const header = document.getElementById('header');
        toggle.addEventListener('click', () => {
            const open = header.classList.toggle('menu-open');
            toggle.setAttribute('aria-expanded', open);
        });
        document.querySelectorAll('.nav__link').forEach(link =>
            link.addEventListener('click', () => {
                header.classList.remove('menu-open');
                toggle.setAttribute('aria-expanded', 'false');
            })
        );
    }

    /* === Carrinho === */
    function bindCart() {
        document.getElementById('cartToggle').addEventListener('click', UI.openDrawer.bind(UI));
        document.getElementById('cartClose').addEventListener('click', UI.closeDrawer.bind(UI));
        document.getElementById('overlay').addEventListener('click', () => {
            UI.closeDrawer();
            UI.closeProductModal();
        });
        document.getElementById('clearCart').addEventListener('click', () => {
            cart = [];
            saveCart();
            UI.toast('Carrinho limpo');
        });
        document.getElementById('checkoutBtn').addEventListener('click', checkout);
    }

    function addToCart(id, qty = 1) {
        const item = cart.find(i => i.id === id);
        if (item) item.qty = Math.min(item.qty + qty, 99);
        else cart.push({ id, qty: Math.min(qty, 99) });
        saveCart();
    }

    function incCart(id) {
        const item = cart.find(i => i.id === id);
        if (item && item.qty < 99) {
            item.qty++;
            saveCart();
        }
    }

    function decCart(id) {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        item.qty--;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
        saveCart();
    }

    function removeFromCart(id) {
        cart = cart.filter(i => i.id !== id);
        saveCart();
    }

    function checkout() {
        if (cart.length === 0) {
            UI.toast('Seu carrinho está vazio');
            return;
        }
        let msg = '*Olá! Vim pelo site e gostaria de fazer um pedido:*\n\n';
        let total = 0;
        cart.forEach(i => {
            const p = PRODUCTS.find(x => x.id === i.id);
            if (!p) return;
            const sub = p.price * i.qty;
            total += sub;
            msg += `• ${p.name} (${i.qty}x) — ${UI.formatPrice(sub)}\n`;
        });
        msg += `\n*Total: ${UI.formatPrice(total)}*`;
        msg += `\n\nPoderia me passar mais informações sobre disponibilidade e entrega?`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener');
    }

    /* === Hero carrossel === */
    function bindHero() {
        const track = document.getElementById('heroTrack');
        const slides = track.children.length;
        const dots = document.getElementById('heroDots');
        const prev = document.getElementById('heroPrev');
        const next = document.getElementById('heroNext');

        // Criar dots
        for (let i = 0; i < slides; i++) {
            const btn = document.createElement('button');
            btn.setAttribute('aria-label', `Ir para slide ${i + 1}`);
            btn.dataset.idx = i;
            btn.addEventListener('click', () => goTo(i, true));
            dots.appendChild(btn);
        }

        function goTo(i, resetTimer = false) {
            heroIndex = (i + slides) % slides;
            track.style.transform = `translateX(-${heroIndex * 100}%)`;
            dots.querySelectorAll('button').forEach((b, idx) =>
                b.classList.toggle('is-active', idx === heroIndex)
            );
            if (resetTimer) startAuto();
        }

        function startAuto() {
            clearInterval(heroTimer);
            heroTimer = setInterval(() => goTo(heroIndex + 1), 5000);
        }

        prev.addEventListener('click', () => goTo(heroIndex - 1, true));
        next.addEventListener('click', () => goTo(heroIndex + 1, true));

        // Touch swipe
        let startX = 0, dx = 0;
        track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dx = 0; }, { passive: true });
        track.addEventListener('touchmove', e => { dx = e.touches[0].clientX - startX; }, { passive: true });
        track.addEventListener('touchend', () => {
            if (Math.abs(dx) > 50) goTo(heroIndex + (dx < 0 ? 1 : -1), true);
        });

        goTo(0);
        startAuto();

        // Pausar no hover
        document.querySelector('.hero').addEventListener('mouseenter', () => clearInterval(heroTimer));
        document.querySelector('.hero').addEventListener('mouseleave', startAuto);
    }

    /* === WhatsApp flutuante + contato === */
    function bindWhatsapp() {
        const float = document.getElementById('waFloat');
        const contact = document.getElementById('contactWhats');
        const msg = encodeURIComponent('Olá! Vim pelo site da Madeireira Progresso e gostaria de mais informações.');
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
        float.href = url;
        contact.href = url;
    }

    /* === Modal: fechar no overlay e Esc === */
    function bindModal() {
        document.getElementById('productModal').addEventListener('click', (e) => {
            if (e.target.id === 'productModal') UI.closeProductModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                UI.closeProductModal();
                UI.closeDrawer();
            }
        });
    }

    /* === Init === */
    function init() {
        document.getElementById('year').textContent = new Date().getFullYear();
        renderProducts();
        bindFilters();
        bindSearch();
        bindMenu();
        bindCart();
        bindHero();
        bindWhatsapp();
        bindModal();
        saveCart(); // render inicial do carrinho
        console.log('🪵 Madeireira Progresso — site carregado.');
        console.log('📦', PRODUCTS.length, 'produtos no catálogo.');
        if (WHATSAPP_NUMBER === '5500000000000') {
            console.warn('⚠️  WhatsApp ainda é placeholder. Troque WHATSAPP_NUMBER em js/app.js para o número real.');
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    /* API pública */
    return { addToCart, incCart, decCart, removeFromCart };
})();
