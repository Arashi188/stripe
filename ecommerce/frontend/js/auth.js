const auth = {
    isLoggedIn: () => !!localStorage.getItem('token'),

    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    },

    login: async (email, password) => {
        try {
            const response = await api.login({ email, password });
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify({
                id: response.userId,
                email: response.email,
                fullName: response.fullName,
                role: response.role,
            }));
            return { success: true, user: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    register: async (fullName, email, password, phone) => {
        try {
            const response = await api.register({ fullName, email, password, phone });
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify({
                id: response.userId,
                email: response.email,
                fullName: response.fullName,
                role: response.role,
            }));
            return { success: true, user: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    },

    isAdmin: () => {
        const user = auth.getUser();
        return user && user.role === 'ADMIN';
    },

    redirectIfNotLoggedIn: () => {
        if (!auth.isLoggedIn()) {
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
    },

    redirectIfNotAdmin: () => {
        auth.redirectIfNotLoggedIn();
        if (!auth.isAdmin()) {
            window.location.href = 'index.html';
        }
    },

    updateNavbar: () => {
        const isLoggedIn = auth.isLoggedIn();
        const user = auth.getUser();

        const loginLink = document.getElementById('loginLink');
        const userMenu = document.getElementById('userMenu');
        const userName = document.getElementById('userName');
        const adminLink = document.getElementById('adminLink');
        const logoutBtn = document.getElementById('logoutBtn');
        const cartCount = document.getElementById('cartCount');

        if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : 'block';
        if (userMenu) userMenu.style.display = isLoggedIn ? 'block' : 'none';
        if (userName) userName.textContent = user ? user.fullName : '';
        if (adminLink) adminLink.style.display = isLoggedIn && user && user.role === 'ADMIN' ? 'block' : 'none';

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.logout();
            });
        }

        if (cartCount) {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
        }
    },
};

document.addEventListener('DOMContentLoaded', auth.updateNavbar);
