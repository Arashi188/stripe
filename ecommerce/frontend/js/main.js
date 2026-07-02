// =============================================
// Main Application Script
// =============================================

function togglePassword(inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

function updateAvatar() {
    var user = auth.getUser();
    var avatarEl = document.getElementById('userAvatar');
    var nameEl = document.getElementById('userName');
    if (avatarEl) {
        var storedIcon = localStorage.getItem('userIcon');
        if (storedIcon) {
            avatarEl.innerHTML = '<i class="fas ' + storedIcon + '"></i>';
        } else {
            avatarEl.textContent = user ? getInitials(user.fullName) : '?';
        }
    }
    if (nameEl && user) {
        nameEl.textContent = user.fullName;
    }
}

// Page transition overlay
(function() {
    var overlay = document.createElement('div');
    overlay.className = 'page-transition';
    overlay.id = 'pageTransition';
    document.body.appendChild(overlay);
})();

function navigateWithTransition(url) {
    var overlay = document.getElementById('pageTransition');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(function() { window.location.href = url; }, 200);
    } else {
        window.location.href = url;
    }
}

// ── Animation helpers ──
var ANIM_OBSERVER = null;

function initScrollReveal() {
    if (ANIM_OBSERVER) { ANIM_OBSERVER.disconnect(); }
    ANIM_OBSERVER = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                ANIM_OBSERVER.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal, .fade-in, .section-stagger, .product-card-3d').forEach(function(el) {
        ANIM_OBSERVER.observe(el);
    });
}

function triggerShake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(function() { el.classList.remove('shake'); }, 500);
}

function addRipple(e) {
    var btn = e.currentTarget;
    if (btn.classList.contains('btn-loading')) return;
    var rect = btn.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    var size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 600);
}

function addRippleToButtons() {
    document.querySelectorAll('.btn-primary, .btn-checkout, .add-to-cart-btn, [onclick*="addItem"], [onclick*="checkout"]').forEach(function(btn) {
        btn.classList.add('ripple-container');
        btn.addEventListener('click', addRipple);
    });
}

function staggerReveal(cards, baseDelay) {
    if (!cards || !cards.length) return;
    cards.forEach(function(el, i) {
        el.style.transitionDelay = (baseDelay || 0.05) * i + 's';
        ANIM_OBSERVER.observe(el);
    });
}

// Toast notification system (enhanced)
function showToast(message, type) {
    if (typeof cartManager !== 'undefined' && cartManager.showToast) {
        cartManager.showToast(message, type);
        return;
    }
    // Fallback if cartManager not available
    var container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast-custom ' + (type || 'success');
    var icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = '<div class="d-flex align-items-center"><i class="fas ' + icon + ' me-2"></i><span>' + message + '</span></div>';
    container.appendChild(toast);
    setTimeout(function() {
        toast.classList.add('removing');
        setTimeout(function() { toast.remove(); }, 250);
    }, 2500);
}

// ── Button loading state ──
function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        btn._originalHTML = btn.innerHTML;
        btn.classList.add('btn-loading');
        btn.innerHTML = '<span class="btn-text">' + btn._originalHTML + '</span><span class="btn-spinner"><i class="fas fa-spinner fa-spin"></i></span>';
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        if (btn._originalHTML) {
            btn.innerHTML = btn._originalHTML;
        }
        btn.disabled = false;
    }
}

// ── Welcome overlay ──
function showWelcomeOverlay(message, iconClass, redirectUrl, delay) {
    var existing = document.getElementById('welcomeOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'welcomeOverlay';
    overlay.className = 'welcome-overlay';
    overlay.innerHTML =
        '<div class="welcome-card">' +
            '<div class="welcome-icon"><i class="fas ' + iconClass + '"></i></div>' +
            '<div class="welcome-text">' + message + '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    requestAnimationFrame(function() {
        overlay.classList.add('show');
    });

    var stay = delay || 1800;
    setTimeout(function() {
        overlay.classList.remove('show');
        setTimeout(function() {
            window.location.href = redirectUrl;
        }, 350);
    }, stay);
}

// ── Get first name from full name ──
function getFirstName(fullName) {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
}

document.addEventListener('DOMContentLoaded', () => {

    // Keep the mobile navigation accessible and visually in sync.
    document.querySelectorAll('.navbar-toggler').forEach(function(toggler) {
        toggler.setAttribute('aria-label', 'Open navigation menu');
        toggler.addEventListener('click', function() {
            requestAnimationFrame(function() {
                var isOpen = toggler.getAttribute('aria-expanded') === 'true';
                toggler.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
                document.body.classList.toggle('nav-menu-open', isOpen);
            });
        });
    });

    document.querySelectorAll('.navbar-collapse').forEach(function(menu) {
        menu.addEventListener('hidden.bs.collapse', function() {
            document.body.classList.remove('nav-menu-open');
            var toggler = document.querySelector('[data-bs-target="#' + menu.id + '"]');
            if (toggler) toggler.setAttribute('aria-label', 'Open navigation menu');
        });
        menu.querySelectorAll('.nav-link:not(.dropdown-toggle)').forEach(function(link) {
            link.addEventListener('click', function() {
                if (window.innerWidth < 992 && window.bootstrap) {
                    bootstrap.Collapse.getOrCreateInstance(menu).hide();
                }
            });
        });
    });

    // Page load fade-in
    var pageContent = document.querySelector('.hero-section, .account-header, .page-header, .dashboard-content, main, .container:first-of-type');
    if (pageContent) {
        pageContent.classList.add('fade-in-page');
        setTimeout(function() { pageContent.classList.add('show'); }, 50);
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
        });
    }

    // Hero Slider
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        let currentSlide = 0;
        const slides = heroSection.querySelectorAll('.hero-slide');
        const dots = heroSection.querySelectorAll('.hero-dot');
        let slideInterval;

        const showSlide = (index) => {
            slides.forEach(s => s.classList.remove('active'));
            dots.forEach(d => d.classList.remove('active'));
            currentSlide = (index + slides.length) % slides.length;
            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        };

        const nextSlide = () => showSlide(currentSlide + 1);
        const prevSlide = () => showSlide(currentSlide - 1);

        const startAutoSlide = () => {
            slideInterval = setInterval(nextSlide, 4000);
        };

        const resetAutoSlide = () => {
            clearInterval(slideInterval);
            startAutoSlide();
        };

        heroSection.querySelector('.hero-arrow.next')?.addEventListener('click', () => {
            nextSlide();
            resetAutoSlide();
        });

        heroSection.querySelector('.hero-arrow.prev')?.addEventListener('click', () => {
            prevSlide();
            resetAutoSlide();
        });

        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => {
                showSlide(i);
                resetAutoSlide();
            });
        });

        startAutoSlide();
    }

    // Back to Top
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(backToTop);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // Product Search
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = document.getElementById('searchInput').value;
            window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
        });
    }

    // Load Products
    const loadProducts = async (containerId, params = {}) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            const products = params.featured
                ? await api.getFeaturedProducts()
                : await api.getProducts(params);

            if (products.length === 0) {
                container.innerHTML = `
                    <div class="empty-state col-12">
                        <div class="icon">📦</div>
                        <h4>No Products Found</h4>
                        <p>Try adjusting your search or filter criteria.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = products.map(product => `
                <div class="col-6 col-lg-3 col-md-4 col-sm-6 mb-4 product-card-3d">
                    <div class="product-card">
                        <div class="product-image">
                            <img src="${resolveImageUrl(product.imageUrl)}" 
                                 alt="${product.name}"
                                 loading="lazy"
                                 onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                            ${product.compareAtPrice && product.compareAtPrice > product.price ? 
                                '<span class="product-badge sale">Sale</span>' : ''}
                            <div class="product-actions">
                                <button class="btn" onclick="cartManager.addItem({id:${product.id},name:'${product.name.replace(/'/g, "\\'")}',price:${product.price},imageUrl:'${product.imageUrl || ''}'})" title="Add to Cart">
                                    <i class="fas fa-shopping-cart"></i>
                                </button>
                                <button class="btn wishlist-btn" onclick="toggleWishlist(${product.id}, this)" title="Add to Wishlist">
                                    <i class="far fa-heart"></i>
                                </button>
                                <button class="btn" onclick="window.location.href='product-details.html?id=${product.id}'" title="Quick View">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="product-body">
                            <div class="product-category">${product.category ? product.category.name : 'General'}</div>
                            <h6 class="product-name">
                                <a href="product-details.html?id=${product.id}" class="text-decoration-none text-dark">
                                    ${product.name}
                                </a>
                            </h6>
                            <div class="product-price">
                                ₦${product.price.toFixed(2)}
                                ${product.compareAtPrice && product.compareAtPrice > product.price ? 
                                    `<span class="original">₦${product.compareAtPrice.toFixed(2)}</span>` : ''}
                            </div>
                            <div class="product-rating">
                                <span class="stars">${'★'.repeat(Math.round(product.rating || 0))}${'☆'.repeat(5 - Math.round(product.rating || 0))}</span>
                                <span class="count">(${product.reviewCount || 0})</span>
                            </div>
                            <button class="add-to-cart-btn" onclick="cartManager.addItem({id:${product.id},name:'${product.name.replace(/'/g, "\\'")}',price:${product.price},imageUrl:'${product.imageUrl || ''}'})">
                                <i class="fas fa-shopping-cart me-2"></i>Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state col-12">
                    <div class="icon">⚠️</div>
                    <h4>Error Loading Products</h4>
                    <p>${error.message}</p>
                </div>
            `;
        }
    };

    // Load Categories
    const loadCategories = async (containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const categories = await api.getCategories();
            container.innerHTML = categories.map(cat => `
                <div class="col-md-4 col-sm-6 mb-4">
                    <div class="category-card fade-in" onclick="window.location.href='shop.html?category=${cat.id}'" style="background-image:url('${cat.backgroundImageUrl || cat.imageUrl || PLACEHOLDER_IMG}')">
                        <div class="overlay">
                            <h4>${cat.name}</h4>
                            <p>${cat.description || 'Explore collection'}</p>
                        </div>
                    </div>
                </div>
            `).join('');

            setTimeout(() => {
                container.querySelectorAll('.fade-in').forEach(el => el.classList.add('show'));
            }, 100);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    // Load Product Details
    const loadProductDetails = async () => {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        if (!productId) return;

        const container = document.getElementById('productDetail');
        if (!container) return;

        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            const product = await api.getProduct(parseInt(productId));
            const reviews = await api.getReviews(parseInt(productId));

            container.innerHTML = `
                <div class="row g-5">
                    <div class="col-lg-6">
                        <div class="product-gallery">
                            <img src="${resolveImageUrl(product.imageUrl)}" 
                                 alt="${product.name}" 
                                 class="main-image"
                                 id="mainImage"
                                 onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                            <div class="thumbnails">
                                ${[product.imageUrl, product.imageUrl2, product.imageUrl3].filter(Boolean).map((img, i) => `
                                    <img src="${resolveImageUrl(img)}" class="${i === 0 ? 'active' : ''}" 
                                         onclick="document.getElementById('mainImage').src=this.src;document.querySelectorAll('.thumbnails img').forEach(t=>t.classList.remove('active'));this.classList.add('active')"
                                         onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="product-info">
                            <div class="product-category mb-2">${product.category ? product.category.name : 'General'}</div>
                            <h1>${product.name}</h1>
                            <div class="rating">
                                <span class="stars">${'★'.repeat(Math.round(product.rating || 0))}${'☆'.repeat(5 - Math.round(product.rating || 0))}</span>
                                <span>${product.rating || 0} (${product.reviewCount || 0} reviews)</span>
                            </div>
                            <div class="price">
                                    ₦${product.price.toFixed(2)}
                                    ${product.compareAtPrice ? `<span class="original">₦${product.compareAtPrice.toFixed(2)}</span>` : ''}
                            </div>
                            <p class="description">${product.description || 'No description available.'}</p>
                            ${product.brand ? `<p class="mb-2"><strong>Brand:</strong> ${product.brand}</p>` : ''}
                            <p class="mb-3"><strong>Availability:</strong> 
                                <span class="${product.stockQuantity > 0 ? 'text-success' : 'text-danger'}">
                                    ${product.stockQuantity > 0 ? 'In Stock (' + product.stockQuantity + ')' : 'Out of Stock'}
                                </span>
                            </p>
                            <div class="quantity-selector">
                                <button onclick="changeQty(-1)">-</button>
                                <input type="number" id="qtyInput" value="1" min="1" max="${product.stockQuantity}">
                                <button onclick="changeQty(1)">+</button>
                            </div>
                            <div class="d-flex gap-2 mb-3">
                                <button class="btn btn-primary btn-lg flex-grow-1" onclick="addToCartFromDetail(${product.id})">
                                    <i class="fas fa-shopping-cart me-2"></i>Add to Cart
                                </button>
                                <button class="btn btn-outline-danger btn-lg" onclick="toggleWishlist(${product.id}, this)">
                                    <i class="far fa-heart"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row mt-5">
                    <div class="col-12">
                        <h3 class="fw-bold mb-4">Customer Reviews</h3>
                        ${auth.isLoggedIn() ? `
                            <div class="card p-4 mb-4">
                                <h5>Write a Review</h5>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Rating</label>
                                    <div class="star-rating">
                                        ${[1,2,3,4,5].map(i => `<i class="far fa-star fs-4 me-1" style="cursor:pointer;color:var(--accent)" onmouseover="this.className='fas fa-star fs-4 me-1'" onmouseout="document.getElementById('ratingInput').value||(this.className='far fa-star fs-4 me-1')" onclick="document.querySelectorAll('.star-rating i').forEach((s,j)=>s.className=(j<=${i-1}?'fas':'far')+' fa-star fs-4 me-1');document.getElementById('ratingInput').value=${i}"></i>`).join('')}
                                        <input type="hidden" id="ratingInput" value="0">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <textarea class="form-control" id="reviewComment" rows="3" placeholder="Share your experience..."></textarea>
                                </div>
                                <button class="btn btn-primary" onclick="submitReview(${product.id})">Submit Review</button>
                            </div>
                        ` : `<p><a href="login.html">Login</a> to write a review.</p>`}
                        <div id="reviewsList">
                            ${reviews.map(r => `
                                <div class="card p-3 mb-3">
                                    <div class="d-flex justify-content-between">
                                        <div>
                                            <strong>${r.user ? r.user.fullName : 'Anonymous'}</strong>
                                            <span class="stars ms-2" style="color:var(--accent)">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                                        </div>
                                        <small class="text-muted">${new Date(r.createdAt).toLocaleDateString()}</small>
                                    </div>
                                    ${r.comment ? `<p class="mt-2 mb-0">${r.comment}</p>` : ''}
                                </div>
                            `).join('') || '<p class="text-muted">No reviews yet.</p>'}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    };

    // Utility functions
    window.changeQty = (delta) => {
        const input = document.getElementById('qtyInput');
        if (input) {
            const newVal = parseInt(input.value) + delta;
            if (newVal >= 1) input.value = newVal;
        }
    };

    window.addToCartFromDetail = (productId) => {
        const qty = parseInt(document.getElementById('qtyInput')?.value || 1);
        const name = document.querySelector('.product-info h1')?.textContent || '';
        const price = parseFloat(document.querySelector('.product-info .price')?.textContent?.replace('$', '') || '0');
        const image = document.getElementById('mainImage')?.src || '';
        cartManager.addItem({ id: productId, name, price, imageUrl: image }, qty);
    };

    window.toggleWishlist = async (productId, btn) => {
        if (!auth.isLoggedIn()) {
            window.location.href = 'login.html';
            return;
        }
        try {
            const icon = btn.querySelector('i');
            if (icon.classList.contains('fas')) {
                await api.removeFromWishlist(productId);
                icon.className = 'far fa-heart';
                btn.classList.remove('active');
                cartManager.showToast('Removed from wishlist', 'warning');
            } else {
                await api.addToWishlist(productId);
                icon.className = 'fas fa-heart';
                btn.classList.add('active');
                cartManager.showToast('Added to wishlist!', 'success');
            }
        } catch (error) {
            cartManager.showToast(error.message, 'error');
        }
    };

    window.submitReview = async (productId) => {
        const rating = parseInt(document.getElementById('ratingInput')?.value || '0');
        const comment = document.getElementById('reviewComment')?.value || '';
        if (!rating) {
            cartManager.showToast('Please select a rating', 'error');
            return;
        }
        try {
            await api.addReview(productId, rating, comment);
            cartManager.showToast('Review submitted!', 'success');
            loadProductDetails();
        } catch (error) {
            cartManager.showToast(error.message, 'error');
        }
    };

    // Initialize based on page
    const page = window.location.pathname.split('/').pop();

    if (page === 'index.html' || page === '') {
        loadProducts('featuredProducts', { featured: true });
        loadCategories('categoryGrid');
    }

    if (page === 'shop.html') {
        const params = new URLSearchParams(window.location.search);
        const loadParams = {};
        if (params.get('category')) loadParams.categoryId = parseInt(params.get('category'));
        if (params.get('search')) loadParams.search = params.get('search');
        if (params.get('minPrice')) loadParams.minPrice = parseFloat(params.get('minPrice'));
        if (params.get('maxPrice')) loadParams.maxPrice = parseFloat(params.get('maxPrice'));

        loadProducts('productsGrid', loadParams);

        if (document.getElementById('searchInput')) {
            document.getElementById('searchInput').value = params.get('search') || '';
        }

        // Category filter
        const loadFilterCategories = async () => {
            try {
                const cats = await api.getCategories();
                const container = document.getElementById('categoryFilters');
                if (container) {
                    container.innerHTML = `
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="categoryFilter" value="" id="catAll" checked onchange="applyFilters()">
                            <label class="form-check-label" for="catAll">All Categories</label>
                        </div>
                    ` + cats.map(cat => `
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="categoryFilter" value="${cat.id}" id="cat${cat.id}" onchange="applyFilters()">
                            <label class="form-check-label" for="cat${cat.id}">${cat.name}</label>
                        </div>
                    `).join('');
                }
            } catch (e) { console.error(e); }
        };
        loadFilterCategories();

        window.applyFilters = () => {
            const category = document.querySelector('input[name="categoryFilter"]:checked')?.value;
            const minPrice = document.getElementById('minPrice')?.value;
            const maxPrice = document.getElementById('maxPrice')?.value;
            const search = document.getElementById('searchInput')?.value;
            const sort = document.getElementById('sortSelect')?.value;

            let url = 'shop.html?';
            if (category) url += `category=${category}&`;
            if (minPrice) url += `minPrice=${minPrice}&`;
            if (maxPrice) url += `maxPrice=${maxPrice}&`;
            if (search) url += `search=${encodeURIComponent(search)}&`;

            window.location.href = url;
        };

        // Price range display
        const minPriceSlider = document.getElementById('minPrice');
        const maxPriceSlider = document.getElementById('maxPrice');
        const priceDisplay = document.getElementById('priceDisplay');
        if (minPriceSlider && maxPriceSlider && priceDisplay) {
            const updatePriceDisplay = () => {
                priceDisplay.textContent = `₦${minPriceSlider.value} - ₦${maxPriceSlider.value}`;
            };
            minPriceSlider.addEventListener('input', updatePriceDisplay);
            maxPriceSlider.addEventListener('input', updatePriceDisplay);
        }
    }

    if (page === 'product-details.html') {
        loadProductDetails();
    }

    if (page === 'my-account.html' || page === 'user-dashboard.html') {
        // user-dashboard.html has its own self-contained script
    }

    if (page === 'order-history.html') {
        auth.redirectIfNotLoggedIn();
        const loadOrders = async () => {
            const container = document.getElementById('ordersList');
            if (!container) return;
            container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
            try {
                const orders = await api.getOrderHistory();
                if (orders.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h4>No Orders Yet</h4><p>Start shopping to see your orders here.</p></div>';
                    return;
                }
                container.innerHTML = orders.map(order => `
                    <div class="order-card">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="fw-bold mb-1">Order #${order.orderNumber}</h5>
                                <p class="text-muted mb-2">${new Date(order.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span>
                        </div>
                        <div class="mt-3">
                            ${order.orderItems.map(item => `
                                <div class="d-flex align-items-center mb-2">
                                    <img src="${resolveImageUrl(item.productImage)}" width="50" height="50" style="object-fit:cover;border-radius:8px" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                                    <div class="ms-3">
                                        <strong>${item.productName}</strong>
                                        <div class="text-muted">Qty: ${item.quantity} x ₦${item.unitPrice.toFixed(2)}</div>
                                    </div>
                                    <div class="ms-auto fw-bold">₦${item.subtotal.toFixed(2)}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="d-flex justify-content-between border-top pt-3 mt-2">
                            <div>
                                <span class="text-muted">Payment: </span>
                                <span class="fw-bold ${order.paymentStatus === 'PAID' ? 'text-success' : 'text-warning'}">${order.paymentStatus}</span>
                            </div>
                            <div class="fw-bold fs-5 text-primary">₦${order.totalAmount.toFixed(2)}</div>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
            }
        };
        loadOrders();
    }

    if (page === 'checkout.html') {
        if (typeof auth !== 'undefined') auth.redirectIfNotLoggedIn();

        const cart = cartManager.getCart();
        if (cart.length === 0) {
            document.getElementById('checkoutContent').innerHTML = '<div class="empty-state"><div class="icon">🛒</div><h4>Your cart is empty</h4><p>Add some items before checking out.</p></div>';
        } else {
            const subtotal = cartManager.getTotal();
            const shipping = subtotal > 100 ? 0 : 10;
            const tax = subtotal * 0.08;
            const total = subtotal + shipping + tax;

            document.getElementById('checkoutItems').innerHTML = cart.map(item => `
                <div class="d-flex align-items-center mb-3">
                    <img src="${resolveImageUrl(item.image)}" width="60" height="60" style="object-fit:cover;border-radius:8px" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'">
                    <div class="ms-3 flex-grow-1">
                        <strong>${item.name}</strong>
                        <div class="text-muted">Qty: ${item.quantity}</div>
                    </div>
                    <div class="fw-bold">₦${(item.price * item.quantity).toFixed(2)}</div>
                </div>
            `).join('');

            document.getElementById('checkoutSubtotal').textContent = `₦${subtotal.toFixed(2)}`;
            document.getElementById('checkoutShipping').textContent = shipping === 0 ? 'Free' : `₦${shipping.toFixed(2)}`;
            document.getElementById('checkoutTax').textContent = `₦${tax.toFixed(2)}`;
            document.getElementById('checkoutTotal').textContent = `₦${total.toFixed(2)}`;
        }
    }

    // Newsletter form
    document.getElementById('newsletterForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = document.getElementById('newsletterEmail').value;
        if (email) {
            cartManager.showToast('Thanks for subscribing!', 'success');
            document.getElementById('newsletterEmail').value = '';
        }
    });

    // Login page
    if (page === 'login.html') {
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            if (!email) { triggerShake(document.getElementById('loginEmail')); return; }
            if (!password) { triggerShake(document.getElementById('loginPassword')); return; }
            const loginBtn = document.querySelector('#loginForm button[type="submit"]');
            setButtonLoading(loginBtn, true);
            const result = await auth.login(email, password);
            setButtonLoading(loginBtn, false);
            if (result.success) {
                const params = new URLSearchParams(window.location.search);
                var redirect = params.get('redirect');
                if (!redirect) {
                    if (result.user.role === 'ADMIN') redirect = 'admin/dashboard.html';
                    else if (result.user.role === 'SECRETARY') redirect = 'secretary-dashboard.html';
                    else if (result.user.role === 'DELIVERY_MAN') redirect = 'delivery-dashboard.html';
                    else if (result.user.role === 'WAREHOUSE') redirect = 'warehouse-dashboard.html';
                    else redirect = 'index.html';
                }
                var firstName = getFirstName(result.user.fullName);
                showWelcomeOverlay('Welcome back, ' + firstName + '!', 'fa-hand-wave', redirect);
            } else {
                cartManager.showToast(result.error, 'error');
            }
        });

        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const phone = document.getElementById('regPhone')?.value || '';
            if (!name) { triggerShake(document.getElementById('regName')); return; }
            if (!email) { triggerShake(document.getElementById('regEmail')); return; }
            if (!password || password.length < 6) { triggerShake(document.getElementById('regPassword')); return; }
            const regBtn = document.querySelector('#registerForm button[type="submit"]');
            setButtonLoading(regBtn, true);
            const result = await auth.register(name, email, password, phone);
            setButtonLoading(regBtn, false);
            if (result.success) {
                var firstName = getFirstName(result.user.fullName);
                showWelcomeOverlay('Welcome, ' + firstName + '! Have a great time shopping with us.', 'fa-shopping-bag', 'index.html');
            } else {
                cartManager.showToast(result.error, 'error');
            }
        });
    }

    // Update avatar initials
    updateAvatar();
    var avatarObserver = new MutationObserver(updateAvatar);
    var userNameEl = document.getElementById('userName');
    if (userNameEl) {
        avatarObserver.observe(userNameEl, { childList: true, characterData: true, subtree: true });
    }

    // Update user menu links based on role
    var userMenuLinks = document.querySelector('.dropdown-menu');
    if (userMenuLinks) {
        var role = auth.getRole ? auth.getRole() : null;
        var adminLink = document.getElementById('adminLink');
        var secLink = document.getElementById('secretaryLink');
        var delLink = document.getElementById('deliveryLink');
        var whLink = document.getElementById('warehouseLink');
        if (role === 'ADMIN' && adminLink) adminLink.style.display = 'block';
        if (role === 'SECRETARY' && secLink) secLink.style.display = 'block';
        if (role === 'DELIVERY_MAN' && delLink) delLink.style.display = 'block';
        if (role === 'WAREHOUSE' && whLink) whLink.style.display = 'block';
    }

    // Init animations
    initScrollReveal();
    addRippleToButtons();

    // Stagger product cards after load
    var checkCards = setInterval(function() {
        var cards = document.querySelectorAll('.product-card-3d');
        if (cards.length > 0) {
            cards.forEach(function(el, i) {
                el.style.transitionDelay = (0.05 * i) + 's';
                if (ANIM_OBSERVER) ANIM_OBSERVER.observe(el);
            });
            clearInterval(checkCards);
        }
    }, 500);
});
