// Admin Dashboard Scripts
document.addEventListener('DOMContentLoaded', () => {
    auth.redirectIfNotAdmin();

    const loadSection = (section) => {
        document.querySelectorAll('.admin-content > div').forEach(el => el.style.display = 'none');
        const target = document.getElementById(section + 'Section');
        if (target) target.style.display = 'block';

        document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.admin-sidebar .nav-link[data-section="${section}"]`);
        if (activeLink) activeLink.classList.add('active');
    };

    document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            loadSection(link.dataset.section);
        });
    });

    // Dashboard stats
    const loadStats = async () => {
        try {
            const orders = await api.admin.getOrders();
            const users = await api.admin.getUsers();

            document.getElementById('totalOrders').textContent = orders.length;
            document.getElementById('totalUsers').textContent = users.length;
            document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'PENDING').length;
            document.getElementById('revenue').textContent = '$' + orders
                .filter(o => o.paymentStatus === 'PAID')
                .reduce((sum, o) => sum + o.totalAmount, 0)
                .toFixed(2);
        } catch (e) {
            console.error('Stats error:', e);
        }
    };
    loadStats();

    // Load products for admin
    const loadAdminProducts = async () => {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner"></div></td></tr>';
        try {
            const products = await api.getProducts();
            tbody.innerHTML = products.map(p => `
                <tr>
                    <td><img src="${resolveImageUrl(p.imageUrl) || 'https://via.placeholder.com/40'}" width="40" height="40" style="object-fit:cover;border-radius:4px"></td>
                    <td>${p.name}</td>
                    <td>₦${p.price.toFixed(2)}</td>
                    <td>${p.category ? p.category.name : '-'}</td>
                    <td><span class="${p.stockQuantity > 0 ? 'text-success' : 'text-danger'}">${p.stockQuantity}</span></td>
                    <td>${p.rating || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${e.message}</td></tr>`;
        }
    };

    // Product form
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = 'Saving...';

            const data = {
                name: document.getElementById('productName').value,
                description: document.getElementById('productDescription').value,
                price: parseFloat(document.getElementById('productPrice').value),
                compareAtPrice: parseFloat(document.getElementById('productComparePrice').value) || null,
                imageUrl: document.getElementById('productImage').value,
                stockQuantity: parseInt(document.getElementById('productStock').value),
                sku: document.getElementById('productSku').value,
                brand: document.getElementById('productBrand').value,
                categoryId: parseInt(document.getElementById('productCategory').value) || null,
                featured: document.getElementById('productFeatured').checked,
            };

            try {
                const productId = document.getElementById('productId').value;
                if (productId) {
                    await api.admin.updateProduct(parseInt(productId), data);
                } else {
                    await api.admin.createProduct(data);
                }
                cartManager.showToast('Product saved!', 'success');
                productForm.reset();
                document.getElementById('productId').value = '';
                document.getElementById('productImage').value = '';
                document.getElementById('imagePreview').style.display = 'none';
                loadAdminProducts();
                loadSection('products');
            } catch (error) {
                cartManager.showToast(error.message, 'error');
            }
            btn.disabled = false;
            btn.innerHTML = 'Save Product';
        });
    }

    window.uploadProductImage = (input) => {
        const file = input.files[0];
        if (!file) return;

        const preview = document.getElementById('imagePreview');
        const img = preview.querySelector('img');
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('file', file);

        const baseUrl = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:5001/api';
        fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${api.getToken()}` },
            body: formData,
        })
        .then(r => r.json())
        .then(data => {
            if (data.url) {
                document.getElementById('productImage').value = data.url;
                cartManager.showToast('Image uploaded!', 'success');
            }
        })
        .catch(err => {
            cartManager.showToast('Upload failed: ' + err.message, 'error');
        });
    };

    window.clearProductImage = () => {
        document.getElementById('productImage').value = '';
        document.getElementById('productImageInput').value = '';
        document.getElementById('imagePreview').style.display = 'none';
    };

    window.editProduct = async (id) => {
        loadSection('addProduct');
        try {
            const product = await api.getProduct(id);
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productComparePrice').value = product.compareAtPrice || '';
            document.getElementById('productImage').value = product.imageUrl || '';
            document.getElementById('productStock').value = product.stockQuantity;
            document.getElementById('productSku').value = product.sku || '';
            document.getElementById('productBrand').value = product.brand || '';
            document.getElementById('productCategory').value = product.category ? product.category.id : '';
            document.getElementById('productFeatured').checked = product.featured;

            // Show existing image preview
            if (product.imageUrl) {
                const preview = document.getElementById('imagePreview');
                preview.querySelector('img').src = resolveImageUrl(product.imageUrl);
                preview.style.display = 'block';
            }
        } catch (e) {
            cartManager.showToast(e.message, 'error');
        }
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.admin.deleteProduct(id);
            cartManager.showToast('Product deleted', 'success');
            loadAdminProducts();
        } catch (e) {
            cartManager.showToast(e.message, 'error');
        }
    };

    // Load orders for admin
    const loadAdminOrders = async () => {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>';
        try {
            const orders = await api.admin.getOrders();
            tbody.innerHTML = orders.map(o => `
                <tr>
                    <td>${o.orderNumber}</td>
                    <td>${o.user ? o.user.fullName : 'N/A'}</td>
                    <td>₦${o.totalAmount.toFixed(2)}</td>
                    <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
                    <td><span class="${o.paymentStatus === 'PAID' ? 'text-success' : 'text-warning'}">${o.paymentStatus}</span></td>
                    <td>
                        <select class="form-select form-select-sm" onchange="updateOrderStatus(${o.id}, this.value)">
                            <option value="PENDING" ${o.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                            <option value="PAID" ${o.status === 'PAID' ? 'selected' : ''}>Paid</option>
                            <option value="SHIPPED" ${o.status === 'SHIPPED' ? 'selected' : ''}>Shipped</option>
                            <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>Delivered</option>
                            <option value="CANCELLED" ${o.status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${e.message}</td></tr>`;
        }
    };

    window.updateOrderStatus = async (orderId, status) => {
        try {
            await api.admin.updateOrderStatus(orderId, status);
            cartManager.showToast('Order status updated!', 'success');
            loadAdminOrders();
        } catch (e) {
            cartManager.showToast(e.message, 'error');
        }
    };

    // Load users for admin
    const loadAdminUsers = async () => {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner"></div></td></tr>';
        try {
            const users = await api.admin.getUsers();
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.fullName}</td>
                    <td>${u.email}</td>
                    <td><span class="badge ${u.role === 'ADMIN' ? 'bg-primary' : 'bg-secondary'}">${u.role}</span></td>
                    <td>${new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${e.message}</td></tr>`;
        }
    };

    // Load categories for product form
    const loadAdminCategories = async () => {
        const select = document.getElementById('productCategory');
        if (!select) return;
        try {
            const cats = await api.getCategories();
            select.innerHTML = '<option value="">Select Category</option>' +
                cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        } catch (e) { console.error(e); }
    };

    // Initial load
    loadSection('dashboard');
    loadAdminProducts();
    loadAdminOrders();
    loadAdminUsers();
    loadAdminCategories();
});
