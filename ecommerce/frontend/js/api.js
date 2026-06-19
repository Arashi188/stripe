// === AFTER deploying backend to Render, replace the line below with your Render URL ===
// Example: const RENDER_URL = 'https://my-shop-api.onrender.com';
const RENDER_URL = 'https://stripe-584v.onrender.com';

const USE_LOCAL = !window.location.hostname
    || window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1';

const API_BASE = USE_LOCAL ? 'http://127.0.0.1:5000/api' : RENDER_URL + '/api';
const UPLOAD_BASE = USE_LOCAL ? 'http://127.0.0.1:5000' : RENDER_URL;
const FRONTEND_BASE = window.location.origin;

function resolveImageUrl(url) {
    if (!url) return url;
    if (url.startsWith('/uploads/')) {
        return UPLOAD_BASE + url;
    }
    return url;
}

const api = {
    getToken: () => {
        const raw = localStorage.getItem('token');
        if (!raw) return null;
        return raw.trim().replace(/^Bearer\s+/i, '');
    },

    request: async (endpoint, options = {}) => {
        const token = api.getToken();
        const isFormData = options.body instanceof FormData;
        const config = {
            headers: {
                ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
            ...options,
        };

        let response;
        try {
            response = await fetch(`${API_BASE}${endpoint}`, config);
        } catch (networkErr) {
            throw new Error(
                'Cannot reach the server at ' + API_BASE + '. Start the backend (python run.py) on port 5000.'
            );
        }

        const raw = await response.text();
        let data = {};
        if (raw) {
            try {
                data = JSON.parse(raw);
            } catch (parseErr) {
                if (!response.ok) {
                    throw new Error('Server error (' + response.status + '). Restart the backend after updating.');
                }
            }
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || 'Request failed (' + response.status + ')');
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

    // Bank accounts (public list for checkout transfer)
    getBankAccounts: () => api.request('/secretary/bank-accounts'),

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
        getDashboard: () => api.request('/admin/dashboard'),

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

        getAdminCategories: () => api.request('/admin/categories'),

        createCategory: (data) => api.request('/admin/categories', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

        updateCategory: (id, data) => api.request(`/admin/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

        deleteCategory: (id) => api.request(`/admin/categories/${id}`, {
            method: 'DELETE',
        }),

        getOrders: () => api.request('/admin/orders'),

        getOrderDetail: (id) => api.request(`/admin/orders/${id}`),

        updateOrderStatus: (orderId, status) => api.request(`/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

        getUsers: () => api.request('/admin/users'),
    },

    // Secretary
    secretary: {
        getDashboard: () => api.request('/secretary/dashboard'),
        getPendingTransfers: () => api.request('/secretary/pending-transfers'),
        approvePayment: (orderId) => api.request(`/secretary/approve-payment/${orderId}`, { method: 'POST' }),
        assignDelivery: (orderId, deliveryManId) => api.request(`/secretary/assign-delivery/${orderId}`, {
            method: 'POST',
            body: JSON.stringify({ deliveryManId }),
        }),
        getDeliveryMen: () => api.request('/secretary/delivery-men'),
        getBankAccounts: () => api.request('/secretary/bank-accounts'),
        getNotifications: () => api.request('/admin/notifications'),
        markNotificationRead: (id) => api.request(`/admin/notifications/${id}/read`, { method: 'POST' }),
        markAllRead: () => api.request('/admin/notifications/read-all', { method: 'POST' }),
    },

    // Delivery Man
    delivery: {
        getOrders: () => api.request('/delivery/orders'),
        updateLocation: (orderId, latitude, longitude) => api.request('/delivery/location', {
            method: 'POST',
            body: JSON.stringify({ orderId, latitude, longitude }),
        }),
        getLocation: (orderId) => api.request(`/delivery/location/${orderId}`),
        updateOrderStatus: (orderId, status) => api.request(`/delivery/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
    },

    // Tracking (public)
    getTracking: (trackingId) => api.request(`/tracking/${trackingId}`),

    // Receipt Upload
    uploadReceipt: (orderId, file) => {
        const formData = new FormData();
        formData.append('receipt', file);
        return api.request(`/orders/${orderId}/upload-receipt`, {
            method: 'POST',
            body: formData,
        });
    },

    getOrderReceipt: (orderId) => {
        const token = api.getToken();
        return fetch(`${API_BASE}/orders/${orderId}/receipt`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    },

    getScanResults: (orderId) => api.request(`/orders/${orderId}/scan-results`),
};

// Admin extensions
api.admin.createStaff = (data) => api.request('/admin/staff', { method: 'POST', body: JSON.stringify(data) });
api.admin.deleteStaff = (userId) => api.request(`/admin/staff/${userId}`, { method: 'DELETE' });
api.admin.getStaff = () => api.request('/admin/staff');
api.admin.changeRole = (userId, role) => api.request(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
api.admin.getBankAccounts = () => api.request('/admin/bank-accounts');
api.admin.createBankAccount = (data) => api.request('/admin/bank-accounts', { method: 'POST', body: JSON.stringify(data) });
api.admin.updateBankAccount = (id, data) => api.request(`/admin/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
api.admin.deleteBankAccount = (id) => api.request(`/admin/bank-accounts/${id}`, { method: 'DELETE' });
