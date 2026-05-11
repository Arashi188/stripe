const API_BASE = 'http://localhost:5001/api';
const UPLOAD_BASE = 'http://localhost:5001';

function resolveImageUrl(url) {
    if (!url) return url;
    if (url.startsWith('/uploads/')) {
        return UPLOAD_BASE + url;
    }
    return url;
}

const api = {
    getToken: () => localStorage.getItem('token'),

    request: async (endpoint, options = {}) => {
        const token = api.getToken();
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
            ...options,
        };

        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }

        return data;
    },

    // Auth
    login: (credentials) => api.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }),

    register: (userData) => api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),

    // Products
    getProducts: (params = {}) => {
        const query = new URLSearchParams();
        if (params.categoryId) query.append('categoryId', params.categoryId);
        if (params.minPrice) query.append('minPrice', params.minPrice);
        if (params.maxPrice) query.append('maxPrice', params.maxPrice);
        if (params.search) query.append('search', params.search);
        const qs = query.toString();
        return api.request(`/products${qs ? '?' + qs : ''}`);
    },

    getFeaturedProducts: () => api.request('/products/featured'),

    getProduct: (id) => api.request(`/products/${id}`),

    getProductsByCategory: (categoryId) => api.request(`/products/category/${categoryId}`),

    // Categories
    getCategories: () => api.request('/categories'),

    // Cart
    getCart: () => api.request('/cart'),

    addToCart: (productId, quantity) => api.request('/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
    }),

    removeFromCart: (cartId) => api.request(`/cart/remove/${cartId}`, {
        method: 'DELETE',
    }),

    // Orders
    createOrder: (orderData) => api.request('/orders/create', {
        method: 'POST',
        body: JSON.stringify(orderData),
    }),

    getOrderHistory: () => api.request('/orders/history'),

    getOrder: (orderId) => api.request(`/orders/${orderId}`),

    // Payment
    initializePayment: (orderId) => api.request('/payment/initialize', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
    }),

    verifyPayment: (paymentIntentId) => api.request('/payment/verify', {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId }),
    }),

    // User
    getProfile: () => api.request('/users/profile'),

    updateProfile: (data) => api.request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    // Wishlist
    getWishlist: () => api.request('/users/wishlist'),

    addToWishlist: (productId) => api.request(`/users/wishlist/add/${productId}`, {
        method: 'POST',
    }),

    removeFromWishlist: (productId) => api.request(`/users/wishlist/remove/${productId}`, {
        method: 'DELETE',
    }),

    // Reviews
    getReviews: (productId) => api.request(`/reviews/product/${productId}`),

    addReview: (productId, rating, comment) => api.request('/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId, rating, comment }),
    }),

    // Admin
    admin: {
        createProduct: (data) => api.request('/admin/products', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

        updateProduct: (id, data) => api.request(`/admin/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

        deleteProduct: (id) => api.request(`/admin/products/${id}`, {
            method: 'DELETE',
        }),

        getOrders: () => api.request('/admin/orders'),

        updateOrderStatus: (orderId, status) => api.request(`/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

        getUsers: () => api.request('/admin/users'),
    },
};
