/* ================================================================
   ui.js — Helpers de UI (formatação, modal, drawer, toast)
   ================================================================ */

const UI = {
    /* Formatadores */
    formatPrice(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2
        }).format(value);
    },

    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    },

    /* Toast */
    toast(message) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = message;
        el.classList.add('is-visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
    },

    /* Drawer (carrinho) */
    openDrawer() {
        document.getElementById('cartDrawer').classList.add('is-open');
        document.getElementById('overlay').classList.add('is-visible');
        document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    },
    closeDrawer() {
        document.getElementById('cartDrawer').classList.remove('is-open');
        document.getElementById('overlay').classList.remove('is-visible');
        document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    },

    /* Modal de produto */
    openProductModal(product) {
        const modal = document.getElementById('productModal');
        const dialog = document.getElementById('modalDialog');

        const specsHtml = Object.entries(product.specs || {}).map(([k, v]) =>
            `<div class="modal__spec"><span>${this.sanitize(k)}</span><span>${this.sanitize(v)}</span></div>`
        ).join('');

        const priceHtml = product.oldPrice
            ? `<div class="modal__price-row">
                 <span class="modal__price">${this.formatPrice(product.price)}</span>
                 <span class="modal__price-old">${this.formatPrice(product.oldPrice)}</span>
               </div>`
            : `<div class="modal__price-row"><span class="modal__price">${this.formatPrice(product.price)}</span></div>`;

        dialog.innerHTML = `
            <button class="modal__close" id="modalClose" aria-label="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>
            <div class="modal__grid">
                <div class="modal__media">
                    <img src="${this.sanitize(product.image)}" alt="${this.sanitize(product.name)}" loading="lazy">
                </div>
                <div class="modal__body">
                    <span class="modal__category">${this.sanitize(product.categoryLabel)}</span>
                    <h2 class="modal__name">${this.sanitize(product.name)}</h2>
                    ${priceHtml}
                    <p class="modal__desc">${this.sanitize(product.description)}</p>
                    <div class="modal__specs">${specsHtml}</div>
                    <div class="modal__qty">
                        <span class="modal__qty-label">Quantidade</span>
                        <div class="qty-control" data-pid="${product.id}">
                            <button class="qty-dec" aria-label="Diminuir">−</button>
                            <span class="qty-val">1</span>
                            <button class="qty-inc" aria-label="Aumentar">+</button>
                        </div>
                    </div>
                    <button class="btn btn--primary btn--lg btn--block" id="modalAdd">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.5l2.7 12.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 8H6"/></svg>
                        Adicionar ao carrinho
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Bind handlers
        const closeBtn = document.getElementById('modalClose');
        closeBtn.addEventListener('click', () => this.closeProductModal());

        let qty = 1;
        const qtyEl = dialog.querySelector('.qty-val');
        dialog.querySelector('.qty-dec').addEventListener('click', () => {
            if (qty > 1) { qty--; qtyEl.textContent = qty; }
        });
        dialog.querySelector('.qty-inc').addEventListener('click', () => {
            if (qty < 99) { qty++; qtyEl.textContent = qty; }
        });

        document.getElementById('modalAdd').addEventListener('click', () => {
            App.addToCart(product.id, qty);
            this.toast(`${product.name} adicionado`);
            this.closeProductModal();
        });
    },

    closeProductModal() {
        const modal = document.getElementById('productModal');
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    },

    /* Render do carrinho */
    renderCart(cart) {
        const wrap = document.getElementById('cartItems');
        const totalEl = document.getElementById('cartTotal');

        if (cart.length === 0) {
            wrap.innerHTML = `
                <div class="cart-empty">
                    <p>Seu carrinho está vazio.</p>
                    <small>Adicione produtos do catálogo para começar.</small>
                </div>
            `;
            totalEl.textContent = this.formatPrice(0);
            return;
        }

        let total = 0;
        wrap.innerHTML = cart.map(item => {
            const p = item.product;
            const subtotal = p.price * item.qty;
            total += subtotal;
            return `
                <div class="cart-item">
                    <img class="cart-item__img" src="${this.sanitize(p.image)}" alt="${this.sanitize(p.name)}" loading="lazy">
                    <div class="cart-item__info">
                        <div class="cart-item__name">${this.sanitize(p.name)}</div>
                        <div class="cart-item__price">${this.formatPrice(p.price)}</div>
                        <div class="cart-item__qty">
                            <button class="qty-cart-dec" data-pid="${p.id}" aria-label="Diminuir">−</button>
                            <span>${item.qty}</span>
                            <button class="qty-cart-inc" data-pid="${p.id}" aria-label="Aumentar">+</button>
                        </div>
                    </div>
                    <button class="cart-item__remove" data-pid="${p.id}" aria-label="Remover">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                </div>
            `;
        }).join('');

        totalEl.textContent = this.formatPrice(total);

        // Bindings
        wrap.querySelectorAll('.qty-cart-inc').forEach(b =>
            b.addEventListener('click', () => App.incCart(+b.dataset.pid))
        );
        wrap.querySelectorAll('.qty-cart-dec').forEach(b =>
            b.addEventListener('click', () => App.decCart(+b.dataset.pid))
        );
        wrap.querySelectorAll('.cart-item__remove').forEach(b =>
            b.addEventListener('click', () => {
                App.removeFromCart(+b.dataset.pid);
                UI.toast('Produto removido');
            })
        );
    },

    /* Badge do carrinho no header */
    updateBadge(qty) {
        const badge = document.getElementById('cartBadge');
        badge.textContent = qty;
        badge.classList.toggle('is-visible', qty > 0);
    }
};
