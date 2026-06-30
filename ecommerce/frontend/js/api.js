// === AFTER deploying backend to Render, replace the line below with your Render URL ===
// Example: const RENDER_URL = 'https://my-shop-api.onrender.com';
const RENDER_URL = 'https://stripe-584v.onrender.com';

const USE_LOCAL = !window.location.hostname
    || window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1';

const API_BASE = USE_LOCAL ? 'http://127.0.0.1:5000/api' : RENDER_URL + '/api';
const UPLOAD_BASE = USE_LOCAL ? 'http://127.0.0.1:5000' : RENDER_URL;
const FRONTEND_BASE = window.location.origin;
const PLACEHOLDER_IMG = '/images/no-image.svg';

function resolveImageUrl(url) {
    if (!url) return PLACEHOLDER_IMG;
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
        getNotifications: () => api.request('/secretary/notifications'),
        markNotificationRead: (id) => api.request(`/secretary/notifications/${id}/read`, { method: 'POST' }),
        markAllRead: () => api.request('/secretary/notifications/read-all', { method: 'POST' }),
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

// Admin
api.admin = {
    getDashboard: () => api.request('/admin/dashboard'),

    getProducts: (params = {}) => {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page);
        if (params.search) query.append('search', params.search);
        if (params.category_id) query.append('category_id', params.category_id);
        if (params.limit) query.append('limit', params.limit);
        const qs = query.toString();
        return api.request(`/admin/products${qs ? '?' + qs : ''}`);
    },
    createProduct: (formData) => api.request('/admin/products', { method: 'POST', body: formData }),
    updateProduct: (id, formData) => api.request(`/admin/products/${id}`, { method: 'PUT', body: formData }),
    deleteProduct: (id) => api.request(`/admin/products/${id}`, { method: 'DELETE' }),

    getCategories: () => api.request('/admin/categories'),
    createCategory: (formData) => api.request('/admin/categories', { method: 'POST', body: formData }),
    updateCategory: (id, formData) => api.request(`/admin/categories/${id}`, { method: 'PUT', body: formData }),
    deleteCategory: (id) => api.request(`/admin/categories/${id}`, { method: 'DELETE' }),

    getStaff: () => api.request('/admin/staff'),
    createStaff: (data) => api.request('/admin/staff', { method: 'POST', body: JSON.stringify(data) }),
    updateStaff: (id, data) => api.request(`/admin/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteStaff: (id) => api.request(`/admin/staff/${id}`, { method: 'DELETE' }),

    getCustomers: (params = {}) => {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page);
        if (params.search) query.append('search', params.search);
        const qs = query.toString();
        return api.request(`/admin/customers${qs ? '?' + qs : ''}`);
    },

    getOrders: (params = {}) => {
        const query = new URLSearchParams();
        if (params.page) query.append('page', params.page);
        if (params.status) query.append('status', params.status);
        if (params.payment_method) query.append('payment_method', params.payment_method);
        if (params.date_from) query.append('date_from', params.date_from);
        if (params.date_to) query.append('date_to', params.date_to);
        const qs = query.toString();
        return api.request(`/admin/orders${qs ? '?' + qs : ''}`);
    },
    getOrderDetail: (id) => api.request(`/admin/orders/${id}`),

    getBankAccounts: () => api.request('/admin/bank-accounts'),
    createBankAccount: (data) => api.request('/admin/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
    updateBankAccount: (id, data) => api.request(`/admin/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBankAccount: (id) => api.request(`/admin/bank-accounts/${id}`, { method: 'DELETE' }),

    getSalesReport: (params = {}) => {
        const query = new URLSearchParams();
        if (params.start_date) query.append('start_date', params.start_date);
        if (params.end_date) query.append('end_date', params.end_date);
        const qs = query.toString();
        return api.request(`/admin/reports/sales${qs ? '?' + qs : ''}`);
    },
    getProductsReport: () => api.request('/admin/reports/products'),
};

// Warehouse
api.warehouse = {
    getTasks: (status) => api.request(`/warehouse/tasks${status ? '?status=' + status : ''}`),
    markPacked: (taskId) => api.request(`/warehouse/tasks/${taskId}/pack`, { method: 'POST' }),
    undoPack: (taskId) => api.request(`/warehouse/tasks/${taskId}/unpack`, { method: 'POST' }),
    getOrderDetail: (orderId) => api.request(`/warehouse/order-detail/${orderId}`),
};

// Secretary — send to warehouse
api.secretary.sendToWarehouse = (orderId, notes) => api.request('/secretary/send-to-warehouse', {
    method: 'POST',
    body: JSON.stringify({ orderId, notes }),
});

// Chat
api.chat = {
    getConversations: () => api.request('/chat/conversations'),
    getMessages: (convId) => api.request(`/chat/conversations/${convId}/messages`),
    sendMessage: (convId, messageText) => api.request(`/chat/conversations/${convId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message_text: messageText }),
    }),
    getUnreadCount: () => api.request('/chat/unread-count'),
};
