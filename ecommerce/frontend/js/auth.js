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
        // FIX: Use a relative path that works from any subdirectory depth
        const depth = window.location.pathname.split('/').filter(Boolean).length;
        const prefix = depth > 1 ? '../'.repeat(depth - 1) : './';
        // Detect if we're in /admin/ subfolder and go up accordingly
        const path = window.location.pathname;
        if (path.includes('/admin/')) {
            window.location.href = '../login.html';
        } else {
            window.location.href = 'login.html';
        }
    },

    getRole: () => {
        const user = auth.getUser();
        return user ? user.role : null;
    },

    isAdmin: () => {
        const user = auth.getUser();
        return user && user.role === 'ADMIN';
    },

    clearSession: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    redirectToLogin: () => {
        const returnTo = window.location.pathname + window.location.search;
        // FIX: Determine correct login.html path based on current location
        const path = window.location.pathname;
        const loginPath = path.includes('/admin/') ? '../login.html' : 'login.html';
        window.location.href = loginPath + '?redirect=' + encodeURIComponent(returnTo);
    },

    redirectIfNotLoggedIn: () => {
        if (!auth.isLoggedIn()) {
            auth.redirectToLogin();
        }
    },

    redirectIfNotAdmin: () => {
        if (!auth.isLoggedIn()) {
            auth.redirectToLogin();
            return;
        }
        if (!auth.isAdmin()) {
            // FIX: Go to correct index.html from /admin/ subfolder
            const path = window.location.pathname;
            window.location.href = path.includes('/admin/') ? '../index.html' : 'index.html';
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

        // These controls are flex items; using "block" breaks vertical icon centering.
        if (loginLink) loginLink.style.display = isLoggedIn ? 'none' : 'flex';
        if (userMenu) userMenu.style.display = isLoggedIn ? 'flex' : 'none';

        // FIX: Truncate long names so they don't overflow the navbar
        if (userName && user) {
            const name = user.fullName || '';
            // Show first name only if full name is long, with tooltip for full name
            const firstName = name.split(' ')[0];
            const displayName = name.length > 15 ? firstName : name;
            userName.textContent = displayName;
            userName.title = name; // Show full name on hover
        } else if (userName) {
            userName.textContent = '';
        }

        if (adminLink) {
            adminLink.style.display = isLoggedIn && user && user.role === 'ADMIN' ? 'block' : 'none';
        }

        const secLink = document.getElementById('secretaryLink');
        const delLink = document.getElementById('deliveryLink');
        if (secLink) secLink.style.display = isLoggedIn && user && user.role === 'SECRETARY' ? 'block' : 'none';
        if (delLink) delLink.style.display = isLoggedIn && user && user.role === 'DELIVERY_MAN' ? 'block' : 'none';

        if (logoutBtn) {
            // FIX: Remove old listeners before adding new one to avoid duplicates
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            newLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                auth.logout();
            });
        }

        const sidebarLogout = document.getElementById('logoutBtnSidebar');
        if (sidebarLogout) {
            const newSidebarLogout = sidebarLogout.cloneNode(true);
            sidebarLogout.parentNode.replaceChild(newSidebarLogout, sidebarLogout);
            newSidebarLogout.addEventListener('click', (e) => {
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
