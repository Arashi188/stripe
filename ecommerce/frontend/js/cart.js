const cartManager = {
    getCart: () => {
        return JSON.parse(localStorage.getItem('cart') || '[]');
    },

    saveCart: (cart) => {
        localStorage.setItem('cart', JSON.stringify(cart));
        cartManager.updateCartCount();
        cartManager.updateCartDisplay();
    },

    addItem: (product, quantity = 1) => {
        let cart = cartManager.getCart();
        const existing = cart.find(item => item.productId === product.id);

        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.imageUrl,
                quantity: quantity,
            });
        }

        cartManager.saveCart(cart);
        cartManager.showToast(`${product.name} added to cart!`, 'success');
    },

    removeItem: (productId) => {
        let cart = cartManager.getCart();
        const item = cart.find(i => i.productId === productId);
        cart = cart.filter(item => item.productId !== productId);
        cartManager.saveCart(cart);
        if (item) cartManager.showToast(`${item.name} removed from cart`, 'error');
    },

    updateQuantity: (productId, quantity) => {
        let cart = cartManager.getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) {
            if (quantity <= 0) {
                cartManager.removeItem(productId);
                return;
            }
            item.quantity = quantity;
            cartManager.saveCart(cart);
        }
    },

    getTotal: () => {
        const cart = cartManager.getCart();
        return cart.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
    },

    getCount: () => {
        return cartManager.getCart().reduce((sum, item) => sum + item.quantity, 0);
    },

    clearCart: () => {
        cartManager.saveCart([]);
    },

    updateCartCount: () => {
        const count = cartManager.getCount();
        document.querySelectorAll('.cart-count').forEach(el => {
            var oldCount = el.textContent;
            el.textContent = count;
            if (oldCount !== count.toString()) {
                el.classList.remove('pulse');
                void el.offsetWidth;
                el.classList.add('pulse');
            }
        });
        document.querySelectorAll('.cart-badge').forEach(el => {
            var oldCount = el.textContent;
            el.textContent = count;
            if (oldCount !== count.toString()) {
                el.classList.remove('pulse');
                void el.offsetWidth;
                el.classList.add('pulse');
            }
        });
    },

    updateCartDisplay: () => {
        const container = document.getElementById('cartItems');
        const summary = document.getElementById('cartSummary');
        const emptyCart = document.getElementById('emptyCart');

        if (!container) return;

        const cart = cartManager.getCart();

        if (cart.length === 0) {
            container.innerHTML = '';
            if (summary) summary.style.display = 'none';
            if (emptyCart) emptyCart.style.display = 'block';
            return;
        }

        if (emptyCart) emptyCart.style.display = 'none';
        if (summary) summary.style.display = 'block';

        container.innerHTML = cart.map(item => `
            <div class="cart-item d-flex align-items-center">
                <img src="${resolveImageUrl(item.image) || 'https://via.placeholder.com/100'}" alt="${item.name}">
                <div class="ms-3 flex-grow-1">
                    <h6 class="fw-bold mb-1">${item.name}</h6>
                    <p class="text-muted mb-0">₦${(item.price || 0).toFixed(2)}</p>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-outline-secondary" onclick="cartManager.updateQuantity(${item.productId}, ${item.quantity - 1})">-</button>
                    <span class="fw-bold mx-2">${item.quantity}</span>
                    <button class="btn btn-sm btn-outline-secondary" onclick="cartManager.updateQuantity(${item.productId}, ${item.quantity + 1})">+</button>
                </div>
                <div class="ms-3 fw-bold text-primary">₦${((item.price || 0) * item.quantity).toFixed(2)}</div>
                <button class="btn btn-sm text-danger ms-3" onclick="cartManager.removeItem(${item.productId})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');

        if (summary) {
            const subtotal = cartManager.getTotal();
            const shipping = subtotal > 100 ? 0 : 10;
            const tax = subtotal * 0.08;
            const total = subtotal + shipping + tax;

            summary.innerHTML = `
                <h5>Order Summary</h5>
                <div class="summary-row"><span>Subtotal</span><span>₦${subtotal.toFixed(2)}</span></div>
                <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? 'Free' : '₦' + shipping.toFixed(2)}</span></div>
                <div class="summary-row"><span>Tax (8%)</span><span>₦${tax.toFixed(2)}</span></div>
                <div class="summary-total d-flex justify-content-between">
                    <span>Total</span>
                    <span>₦${total.toFixed(2)}</span>
                </div>
                <button class="btn btn-primary w-100 mt-3" onclick="window.location.href='checkout.html'">
                    Proceed to Checkout
                </button>
            `;
        }
    },

    showToast: (message, type = 'success') => {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-custom ${type}`;
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} me-2"></i>
                <span>${message}</span>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
};

document.addEventListener('DOMContentLoaded', () => {
    cartManager.updateCartCount();
    cartManager.updateCartDisplay();
});
