// Admin Dashboard Scripts
let allProducts = [];
let deleteCallback = null;

// FIX: Define loadSection on window IMMEDIATELY (outside DOMContentLoaded)
// so that onclick="loadSection('addProduct')" in HTML works before DOMContentLoaded fires
window.loadSection = function(section) {
    document.querySelectorAll('.admin-content > div[id$="Section"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById(section + 'Section');
    if (target) target.style.display = 'block';
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.admin-sidebar .nav-link[data-section="${section}"]`);
    if (activeLink) activeLink.classList.add('active');
};

document.addEventListener('DOMContentLoaded', async () => {
    auth.redirectIfNotAdmin();

    document.querySelectorAll('.admin-sidebar .nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) loadSection(section);
        });
    });

    // ── Delete Modal ──
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
        if (deleteCallback) deleteCallback();
        deleteModal.hide();
    });

    window.confirmDelete = (message, callback) => {
        document.getElementById('deleteModalBody').textContent = message;
        deleteCallback = callback;
        deleteModal.show();
    };

    // ── Category Modal ──
    const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
    document.getElementById('categorySaveBtn').addEventListener('click', () => {
        document.getElementById('categoryForm').requestSubmit();
    });
    document.getElementById('categoryModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('categoryForm').reset();
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryModalTitle').innerHTML = '<i class="fas fa-tag me-2 text-primary"></i>Add Category';
    });

    // ════════════════════════════════════════
    //  DASHBOARD
    // ════════════════════════════════════════
    const loadDashboard = async () => {
        try {
            const data = await api.admin.getDashboard();
            document.getElementById('totalOrders').textContent = data.totalOrders ?? 0;
            document.getElementById('totalUsers').textContent = data.totalUsers ?? 0;
            document.getElementById('totalProducts').textContent = data.totalProducts ?? 0;
            document.getElementById('revenue').textContent = '₦' + (data.revenue ?? 0).toFixed(2);

            const tbody = document.getElementById('dashboardOrdersTable');
            if (!tbody) return;
            if (data.recentOrders && data.recentOrders.length) {
                tbody.innerHTML = data.recentOrders.map(o => `
                    <tr>
                        <td><strong>#${o.orderNumber}</strong></td>
                        <td>${o.user ? escapeHtml(o.user.fullName) : 'N/A'}</td>
                        <td>₦${Number(o.totalAmount).toFixed(2)}</td>
                        <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
                        <td><span class="${o.paymentStatus === 'PAID' ? 'text-success' : 'text-warning'} fw-semibold">${o.paymentStatus}</span></td>
                        <td>${o.receiptUrl ? '<span class="badge bg-success">Uploaded</span>' : '<span class="badge bg-secondary">N/A</span>'}</td>
                        <td>${o.deliveryMan ? escapeHtml(o.deliveryMan.fullName) : '<span class="text-muted">-</span>'}</td>
                        <td><small class="text-muted">${new Date(o.createdAt).toLocaleString()}</small></td>
                        <td>-</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-3">No orders yet</td></tr>';
            }
        } catch (e) {
            console.error('Dashboard error:', e);
        }
    };

    // ════════════════════════════════════════
    //  PRODUCTS
    // ════════════════════════════════════════
    const loadAdminProducts = async () => {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            allProducts = await api.getProducts();
            renderProducts();
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    window.renderProducts = () => {
        const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
        const catFilter = document.getElementById('categoryFilter')?.value || '';
        const filtered = allProducts.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(search) || (p.sku || '').toLowerCase().includes(search);
            const matchCat = !catFilter || String(p.category?.id) === catFilter;
            return matchSearch && matchCat;
        });
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No products found</td></tr>';
            return;
        }
        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td><img src="${escapeHtml(resolveImageUrl(p.imageUrl) || 'https://via.placeholder.com/40')}" 
                    width="40" height="40" style="object-fit:cover;border-radius:4px" 
                    onerror="this.src='https://via.placeholder.com/40'"></td>
                <td><strong>${escapeHtml(p.name)}</strong>${p.sku ? `<br><small class="text-muted">SKU: ${escapeHtml(p.sku)}</small>` : ''}</td>
                <td>₦${Number(p.price).toFixed(2)}</td>
                <td>${p.category ? escapeHtml(p.category.name) : '-'}</td>
                <td><span class="${p.stockQuantity > 0 ? 'text-success' : 'text-danger'} fw-semibold">${p.stockQuantity}</span></td>
                <td>${p.rating != null ? p.rating : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    };

    window.filterProducts = () => renderProducts();

    const loadCategoryFilter = async () => {
        const select = document.getElementById('categoryFilter');
        if (!select) return;
        try {
            const cats = await api.getCategories();
            select.innerHTML = '<option value="">All Categories</option>' +
                cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        } catch (e) { console.error('Category filter error:', e); }
    };

    // ── Product Form ──
    let pendingFile = null;

    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = productForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

            try {
                let imageUrl = document.getElementById('productImage').value;
                if (pendingFile) {
                    const formData = new FormData();
                    formData.append('file', pendingFile);
                    const res = await fetch(`${API_BASE}/upload`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${api.getToken()}` },
                        body: formData,
                    });
                    const data = await res.json();
                    if (data.url) imageUrl = data.url;
                }

                const productData = {
                    name: document.getElementById('productName').value.trim(),
                    description: document.getElementById('productDescription').value.trim(),
                    price: parseFloat(document.getElementById('productPrice').value),
                    compareAtPrice: parseFloat(document.getElementById('productComparePrice').value) || null,
                    imageUrl: imageUrl || null,
                    stockQuantity: parseInt(document.getElementById('productStock').value),
                    sku: document.getElementById('productSku').value.trim() || null,
                    brand: document.getElementById('productBrand').value.trim() || null,
                    categoryId: parseInt(document.getElementById('productCategory').value) || null,
                    featured: document.getElementById('productFeatured').checked,
                };

                const productId = document.getElementById('productId').value;
                if (productId) {
                    await api.admin.updateProduct(parseInt(productId), productData);
                    cartManager.showToast('Product updated!', 'success');
                } else {
                    await api.admin.createProduct(productData);
                    cartManager.showToast('Product created!', 'success');
                }

                pendingFile = null;
                productForm.reset();
                document.getElementById('productId').value = '';
                document.getElementById('productImage').value = '';
                document.getElementById('imagePreview').style.display = 'none';
                document.getElementById('productFormTitle').textContent = 'Add New Product';
                await loadAdminProducts();
                loadSection('products');
            } catch (error) {
                cartManager.showToast(error.message, 'error');
            }

            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save me-2"></i>Save Product';
        });
    }

    window.uploadProductImage = (input) => {
        const file = input.files[0];
        if (!file) return;
        // Validate file size (16MB max)
        if (file.size > 16 * 1024 * 1024) {
            cartManager.showToast('Image too large. Max size is 16MB.', 'error');
            input.value = '';
            return;
        }
        pendingFile = file;
        const preview = document.getElementById('imagePreview');
        const img = preview.querySelector('img');
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('productImageInput')?.addEventListener('change', function () {
        window.uploadProductImage(this);
    });

    window.clearProductImage = () => {
        pendingFile = null;
        document.getElementById('productImage').value = '';
        document.getElementById('productImageInput').value = '';
        document.getElementById('imagePreview').style.display = 'none';
    };

    window.editProduct = async (id) => {
        loadSection('addProduct');
        document.getElementById('productFormTitle').textContent = 'Edit Product';
        try {
            // FIX: Load category select before setting value
            await loadProductCategorySelect();
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
            if (product.imageUrl) {
                const preview = document.getElementById('imagePreview');
                const resolvedUrl = resolveImageUrl(product.imageUrl);
                preview.querySelector('img').src = resolvedUrl;
                preview.style.display = 'block';
            } else {
                document.getElementById('imagePreview').style.display = 'none';
            }
        } catch (e) {
            cartManager.showToast(e.message, 'error');
        }
    };

    window.deleteProduct = (id) => {
        const product = allProducts.find(p => p.id === id);
        confirmDelete(
            `Permanently delete "${product ? product.name : 'this product'}"? All related cart, wishlist, and review data will also be removed.`,
            async () => {
                try {
                    await api.admin.deleteProduct(id);
                    cartManager.showToast('Product deleted permanently', 'success');
                    loadAdminProducts();
                } catch (e) { cartManager.showToast(e.message, 'error'); }
            }
        );
    };

    // ════════════════════════════════════════
    //  CATEGORIES
    // ════════════════════════════════════════
    const loadAdminCategories = async () => {
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            const cats = await api.admin.getAdminCategories();
            if (!cats.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No categories yet</td></tr>';
                return;
            }
            tbody.innerHTML = cats.map(c => `
                <tr>
                    <td>${c.id}</td>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td>${c.description ? escapeHtml(c.description) : '-'}</td>
                    <td><span class="badge bg-info bg-opacity-10 text-info">${c.productCount ?? 0}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editCategory(${c.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${c.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('categoryId').value;
        const data = {
            name: document.getElementById('categoryName').value.trim(),
            description: document.getElementById('categoryDescription').value.trim(),
        };
        if (!data.name) { cartManager.showToast('Category name is required', 'error'); return; }
        try {
            if (id) {
                await api.admin.updateCategory(parseInt(id), data);
                cartManager.showToast('Category updated!', 'success');
            } else {
                await api.admin.createCategory(data);
                cartManager.showToast('Category created!', 'success');
            }
            bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
            loadAdminCategories();
            loadCategoryFilter();
            loadProductCategorySelect();
        } catch (e) { cartManager.showToast(e.message, 'error'); }
    });

    window.editCategory = async (id) => {
        try {
            const cats = await api.admin.getAdminCategories();
            const cat = cats.find(c => c.id === id);
            if (!cat) return;
            document.getElementById('categoryId').value = cat.id;
            document.getElementById('categoryName').value = cat.name;
            document.getElementById('categoryDescription').value = cat.description || '';
            document.getElementById('categoryModalTitle').innerHTML = '<i class="fas fa-edit me-2 text-primary"></i>Edit Category';
            bootstrap.Modal.getOrCreateInstance(document.getElementById('categoryModal')).show();
        } catch (e) { cartManager.showToast(e.message, 'error'); }
    };

    window.deleteCategory = (id) => {
        confirmDelete('Delete this category? Products in this category will become uncategorized.', async () => {
            try {
                await api.admin.deleteCategory(id);
                cartManager.showToast('Category deleted', 'success');
                loadAdminCategories();
                loadCategoryFilter();
                loadProductCategorySelect();
            } catch (e) { cartManager.showToast(e.message, 'error'); }
        });
    };

    // ════════════════════════════════════════
    //  ORDERS
    // ════════════════════════════════════════
    const loadAdminOrders = async () => {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            const orders = await api.admin.getOrders();
            if (!orders.length) {
                tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No orders yet</td></tr>';
                return;
            }
            tbody.innerHTML = orders.map(o => `
                <tr>
                    <td><strong>#${o.orderNumber}</strong></td>
                    <td>${o.user ? escapeHtml(o.user.fullName) : 'N/A'}</td>
                    <td>₦${Number(o.totalAmount).toFixed(2)}</td>
                    <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
                    <td><span class="${o.paymentStatus === 'PAID' ? 'text-success' : 'text-warning'} fw-semibold">${o.paymentStatus}</span></td>
                    <td>${o.receiptUrl
                        ? `<button class="btn btn-sm btn-outline-info" onclick="viewAdminReceipt(${o.id})"><i class="fas fa-receipt me-1"></i>View</button>`
                        : '<span class="badge bg-secondary">N/A</span>'}</td>
                    <td>${o.deliveryMan ? escapeHtml(o.deliveryMan.fullName) : '<span class="text-muted">-</span>'}</td>
                    <td><small class="text-muted" title="${new Date(o.createdAt).toLocaleString()}">${new Date(o.createdAt).toLocaleDateString()}</small></td>
                    <td>
                        <select class="form-select form-select-sm" onchange="updateOrderStatus(${o.id}, this.value)">
                            ${['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED'].map(s =>
                                `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0)+s.slice(1).toLowerCase()}</option>`
                            ).join('')}
                        </select>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    window.updateOrderStatus = async (orderId, status) => {
        try {
            await api.admin.updateOrderStatus(orderId, status);
            cartManager.showToast('Order status updated!', 'success');
            loadAdminOrders();
            loadDashboard();
        } catch (e) { cartManager.showToast(e.message, 'error'); }
    };

    window.viewAdminReceipt = async (orderId) => {
        const body = document.getElementById('receiptModalBody');
        body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('receiptModal'));
        modal.show();
        try {
            const response = await api.getOrderReceipt(orderId);
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Receipt not available' }));
                throw new Error(err.error || 'Receipt not available');
            }
            const contentType = response.headers.get('content-type') || '';
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            if (contentType.includes('application/pdf')) {
                body.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="600px" style="border:none">
                    <div class="mt-3"><a href="${url}" download="receipt.pdf" class="btn btn-primary"><i class="fas fa-download me-1"></i>Download PDF</a></div>`;
            } else {
                body.innerHTML = `<img src="${url}" class="img-fluid" style="max-height:500px;object-fit:contain">
                    <div class="mt-3"><a href="${url}" download="receipt.png" class="btn btn-primary"><i class="fas fa-download me-1"></i>Download</a></div>`;
            }
        } catch (e) {
            body.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(e.message)}</div>`;
        }
    };

    // ════════════════════════════════════════
    //  USERS
    // ════════════════════════════════════════
    const loadAdminUsers = async () => {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            const users = await api.admin.getUsers();
            if (!users.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No users yet</td></tr>';
                return;
            }
            tbody.innerHTML = users.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td><strong>${escapeHtml(u.fullName)}</strong></td>
                    <td>${escapeHtml(u.email)}</td>
                    <td><span class="badge ${u.role === 'ADMIN' ? 'bg-primary' : u.role === 'SECRETARY' ? 'bg-warning text-dark' : u.role === 'DELIVERY_MAN' ? 'bg-info' : 'bg-secondary'}">${u.role}</span></td>
                    <td><small class="text-muted">${new Date(u.createdAt).toLocaleDateString()}</small></td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    // ════════════════════════════════════════
    //  PRODUCT FORM CATEGORY SELECT
    // ════════════════════════════════════════
    const loadProductCategorySelect = async () => {
        const select = document.getElementById('productCategory');
        if (!select) return;
        try {
            const cats = await api.getCategories();
            select.innerHTML = '<option value="">Select Category</option>' +
                cats.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        } catch (e) { console.error('Product category select error:', e); }
    };

    // ════════════════════════════════════════
    //  STAFF
    // ════════════════════════════════════════
    const loadStaff = async () => {
        const tbody = document.getElementById('staffTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            const staff = await api.admin.getStaff();
            if (!staff.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No staff members yet</td></tr>';
                return;
            }
            tbody.innerHTML = staff.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td><strong>${escapeHtml(u.fullName)}</strong></td>
                    <td>${escapeHtml(u.email)}</td>
                    <td>${u.phone ? escapeHtml(u.phone) : '-'}</td>
                    <td><span class="badge ${u.role === 'SECRETARY' ? 'bg-warning text-dark' : 'bg-info'}">${u.role}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteStaff(${u.id}, '${escapeHtml(u.fullName).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    const staffModal = new bootstrap.Modal(document.getElementById('staffModal'));
    document.getElementById('staffSaveBtn').addEventListener('click', () => {
        document.getElementById('staffForm').requestSubmit();
    });
    document.getElementById('staffModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('staffForm').reset();
    });

    document.getElementById('staffForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('staffName').value.trim(),
            email: document.getElementById('staffEmail').value.trim(),
            password: document.getElementById('staffPassword').value,
            phone: document.getElementById('staffPhone').value.trim() || null,
            role: document.getElementById('staffRole').value,
        };
        try {
            await api.admin.createStaff(data);
            cartManager.showToast('Staff created!', 'success');
            staffModal.hide();
            loadStaff();
        } catch (err) { cartManager.showToast(err.message, 'error'); }
    });

    window.deleteStaff = (id, name) => {
        confirmDelete(`Remove ${name} from staff?`, async () => {
            try {
                await api.admin.deleteStaff(id);
                cartManager.showToast('Staff removed', 'success');
                loadStaff();
            } catch (e) { cartManager.showToast(e.message, 'error'); }
        });
    };

    // ════════════════════════════════════════
    //  BANK ACCOUNTS
    // ════════════════════════════════════════
    const loadBankAccounts = async () => {
        const tbody = document.getElementById('bankAccountsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div></td></tr>';
        try {
            const accounts = await api.admin.getBankAccounts();
            if (!accounts.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No bank accounts yet</td></tr>';
                return;
            }
            tbody.innerHTML = accounts.map(a => `
                <tr>
                    <td><strong>${escapeHtml(a.bankName)}</strong></td>
                    <td>${escapeHtml(a.accountNumber)}</td>
                    <td>${escapeHtml(a.accountName)}</td>
                    <td><span class="badge ${a.isActive ? 'bg-success' : 'bg-secondary'}">${a.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editBankAccount(${a.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteBankAccount(${a.id}, '${escapeHtml(a.bankName).replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escapeHtml(e.message)}</td></tr>`;
        }
    };

    const bankAccountModal = new bootstrap.Modal(document.getElementById('bankAccountModal'));
    document.getElementById('bankAccountSaveBtn').addEventListener('click', () => {
        document.getElementById('bankAccountForm').requestSubmit();
    });
    document.getElementById('bankAccountModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('bankAccountForm').reset();
        document.getElementById('bankAccountId').value = '';
        document.getElementById('bankAccountModalTitle').innerHTML = '<i class="fas fa-university me-2 text-primary"></i>Add Bank Account';
    });

    document.getElementById('bankAccountForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('bankAccountId').value;
        const data = {
            bankName: document.getElementById('bankName').value.trim(),
            accountNumber: document.getElementById('accountNumber').value.trim(),
            accountName: document.getElementById('accountName').value.trim(),
            isActive: document.getElementById('accountActive').checked,
        };
        try {
            if (id) {
                await api.admin.updateBankAccount(parseInt(id), data);
                cartManager.showToast('Bank account updated!', 'success');
            } else {
                await api.admin.createBankAccount(data);
                cartManager.showToast('Bank account created!', 'success');
            }
            bankAccountModal.hide();
            loadBankAccounts();
        } catch (err) { cartManager.showToast(err.message, 'error'); }
    });

    window.editBankAccount = async (id) => {
        try {
            const accounts = await api.admin.getBankAccounts();
            const a = accounts.find(x => x.id === id);
            if (!a) return;
            document.getElementById('bankAccountId').value = a.id;
            document.getElementById('bankName').value = a.bankName;
            document.getElementById('accountNumber').value = a.accountNumber;
            document.getElementById('accountName').value = a.accountName;
            document.getElementById('accountActive').checked = a.isActive;
            document.getElementById('bankAccountModalTitle').innerHTML = '<i class="fas fa-edit me-2 text-primary"></i>Edit Bank Account';
            bankAccountModal.show();
        } catch (e) { cartManager.showToast(e.message, 'error'); }
    };

    window.deleteBankAccount = (id, name) => {
        confirmDelete(`Delete ${name} account?`, async () => {
            try {
                await api.admin.deleteBankAccount(id);
                cartManager.showToast('Bank account deleted', 'success');
                loadBankAccounts();
            } catch (e) { cartManager.showToast(e.message, 'error'); }
        });
    };

    // ════════════════════════════════════════
    //  INIT — load all data in parallel
    // ════════════════════════════════════════
    await Promise.allSettled([
        loadDashboard(),
        loadAdminProducts(),
        loadCategoryFilter(),
        loadAdminOrders(),
        loadAdminUsers(),
        loadAdminCategories(),
        loadProductCategorySelect(),
        loadStaff(),
        loadBankAccounts(),
    ]);

    loadSection('dashboard');
});

// ════════════════════════════════════════
//  UTILITY
// ════════════════════════════════════════
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}