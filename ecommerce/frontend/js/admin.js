auth.redirectIfNotAdmin();

var currentProductPage = 1;
var currentCustomerPage = 1;
var currentOrderPage = 1;

// ── Image preview helpers ──

function previewProductImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large. Maximum is 5MB.', 'error');
        event.target.value = '';
        return;
    }
    var previewDiv = document.getElementById('productImagePreview');
    var previewImg = document.getElementById('productImagePreviewImg');
    previewImg.src = URL.createObjectURL(file);
    previewDiv.style.display = 'block';
}

function clearProductImage() {
    document.getElementById('productImage').value = '';
    var previewDiv = document.getElementById('productImagePreview');
    previewDiv.style.display = 'none';
    document.getElementById('productImagePreviewImg').src = '';
}

function previewCategoryImage(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('File too large. Maximum is 5MB.', 'error');
        event.target.value = '';
        return;
    }
    var previewDiv = document.getElementById('categoryImagePreview');
    var previewImg = document.getElementById('categoryImagePreviewImg');
    previewImg.src = URL.createObjectURL(file);
    previewDiv.style.display = 'block';
}

function clearCategoryImage() {
    document.getElementById('categoryImage').value = '';
    var previewDiv = document.getElementById('categoryImagePreview');
    previewDiv.style.display = 'none';
    document.getElementById('categoryImagePreviewImg').src = '';
}

function showSection(sectionId) {
    document.querySelectorAll('.sidebar .nav-link').forEach(function(l) {
        l.classList.remove('active');
    });
    document.querySelectorAll('.dashboard-content > div[id^="section-"]').forEach(function(s) {
        s.style.display = 'none';
    });
    var activeLink = document.querySelector('.sidebar .nav-link[data-section="' + sectionId + '"]');
    if (activeLink) activeLink.classList.add('active');
    var section = document.getElementById('section-' + sectionId);
    if (section) section.style.display = 'block';
    closeSidebar();
}

function closeSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('open');
        overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
    });
    showSection('dashboard');
    renderDashboard();
});

// ────────────────────── DASHBOARD ──────────────────────

function renderDashboard() {
    var statsEl = document.getElementById('statsCards');
    var recentOrdersEl = document.getElementById('recentOrdersTable');
    var recentUsersEl = document.getElementById('recentUsersTable');
    statsEl.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';

    api.admin.getDashboard().then(function(data) {
        var stats = [
            { label: 'Total Products', value: data.totalProducts, icon: 'fa-box', color: '#0d6efd' },
            { label: 'Categories', value: data.totalCategories, icon: 'fa-tags', color: '#6f42c1' },
            { label: 'Total Orders', value: data.totalOrders, icon: 'fa-shopping-bag', color: '#198754' },
            { label: 'Revenue', value: '₦' + (data.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2}), icon: 'fa-money-bill-wave', color: '#fd7e14' },
            { label: 'Pending Orders', value: data.pendingOrders, icon: 'fa-clock', color: '#ffc107' },
            { label: 'Customers', value: data.totalCustomers, icon: 'fa-user-friends', color: '#20c997' },
            { label: 'Staff', value: data.totalStaff, icon: 'fa-users-cog', color: '#dc3545' },
        ];
        statsEl.innerHTML = stats.map(function(s) {
            return '<div class="col-md-4 col-lg-3 col-sm-6">' +
                '<div class="card stat-card shadow-sm p-3">' +
                '<div class="d-flex align-items-center">' +
                '<div class="stat-icon me-3" style="background:' + s.color + '20;color:' + s.color + '"><i class="fas ' + s.icon + '"></i></div>' +
                '<div><div class="text-muted small">' + s.label + '</div><div class="fw-bold fs-5">' + s.value + '</div></div>' +
                '</div></div></div>';
        }).join('');

        if (data.recentOrders && data.recentOrders.length > 0) {
            recentOrdersEl.innerHTML = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
                data.recentOrders.map(function(o) {
                    return '<tr>' +
                        '<td><strong>#' + (o.orderNumber || o.id) + '</strong></td>' +
                        '<td>' + (o.user ? o.user.fullName : 'N/A') + '</td>' +
                        '<td>₦' + (o.totalAmount || 0).toFixed(2) + '</td>' +
                        '<td><span class="badge bg-' + (o.paymentMethod === 'transfer' ? 'info' : o.paymentMethod === 'card' ? 'primary' : 'secondary') + '">' + (o.paymentMethod || 'N/A') + '</span></td>' +
                        '<td><span class="badge bg-' + (o.status === 'DELIVERED' ? 'success' : o.status === 'SHIPPED' ? 'primary' : o.status === 'PROCESSING' ? 'warning' : 'secondary') + '">' + (o.status || 'N/A') + '</span></td>' +
                        '<td><small class="text-muted">' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '') + '</small></td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table></div>';
        } else {
            recentOrdersEl.innerHTML = '<div class="text-center text-muted py-4"><span>No orders yet</span></div>';
        }

        if (data.recentUsers && data.recentUsers.length > 0) {
            recentUsersEl.innerHTML = '<ul class="list-group list-group-flush">' +
                data.recentUsers.map(function(u) {
                    return '<li class="list-group-item d-flex align-items-center px-0 py-2">' +
                        '<div class="user-avatar me-2" style="width:36px;height:36px;font-size:.75rem">' + (u.fullName ? getInitials(u.fullName) : '?') + '</div>' +
                        '<div><div class="fw-semibold small">' + (u.fullName || 'Unknown') + '</div><div class="text-muted" style="font-size:.75rem">' + (u.email || '') + '</div></div>' +
                        '</li>';
                }).join('') +
                '</ul>';
        } else {
            recentUsersEl.innerHTML = '<div class="text-center text-muted py-4"><span>No recent users</span></div>';
        }
    }).catch(function(err) {
        statsEl.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">' + err.message + '</div></div>';
        recentOrdersEl.innerHTML = '';
        recentUsersEl.innerHTML = '';
    });
}

// ────────────────────── PRODUCTS ──────────────────────

function renderProducts(page) {
    if (page !== undefined) currentProductPage = page;
    var search = document.getElementById('productSearch').value;
    var categoryId = document.getElementById('productCategoryFilter').value;
    var container = document.getElementById('productsTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getProducts({ page: currentProductPage, search: search, category_id: categoryId || undefined }).then(function(data) {
        var products = data.products || data;
        var totalPages = (data.pagination && data.pagination.pages) || 1;
        var currentPage = (data.pagination && data.pagination.page) || currentProductPage;

        if (products.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-box fa-2x mb-2 d-block"></i><span>No products found</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th style="width:50px">Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Category</th><th>Active</th><th>Actions</th></tr></thead><tbody>';
        products.forEach(function(p) {
            var thumb = p.imageUrl ? '<img src="' + p.imageUrl + '" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover">' : '<div style="width:40px;height:40px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#94a3b8"><i class="fas fa-box"></i></div>';
            html += '<tr>' +
                '<td>' + thumb + '</td>' +
                '<td><strong>' + (p.name || '') + '</strong></td>' +
                '<td>₦' + (p.price || 0).toFixed(2) + '</td>' +
                '<td>' + (p.stockQuantity || 0) + '</td>' +
                '<td>' + (p.categoryName || '-') + '</td>' +
                '<td>' + (p.isActive !== false ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>') + '</td>' +
                '<td><div class="d-flex gap-1">' +
                '<button class="btn btn-sm btn-outline-primary" onclick="showEditProductModal(' + p.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(' + p.id + ')"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table></div>';

        if (totalPages > 1) {
            html += '<nav class="mt-3"><ul class="pagination pagination-sm justify-content-center mb-0">';
            for (var i = 1; i <= totalPages; i++) {
                html += '<li class="page-item' + (i === currentPage ? ' active' : '') + '"><a class="page-link" href="javascript:void(0)" onclick="renderProducts(' + i + ')">' + i + '</a></li>';
            }
            html += '</ul></nav>';
        }

        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

function showAddProductModal() {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productComparePrice').value = '';
    document.getElementById('productStock').value = '0';
    document.getElementById('productBrand').value = '';
    document.getElementById('productImage').value = '';
    clearProductImage();

    var catSelect = document.getElementById('productCategory');
    catSelect.innerHTML = '<option value="">Loading...</option>';
    api.admin.getCategories().then(function(cats) {
        catSelect.innerHTML = '<option value="">Select category...</option>' +
            cats.map(function(c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
    }).catch(function() {
        catSelect.innerHTML = '<option value="">Failed to load</option>';
    });

    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function showEditProductModal(id) {
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = id;
    document.getElementById('productImage').value = '';
    clearProductImage();

    var catSelect = document.getElementById('productCategory');
    catSelect.innerHTML = '<option value="">Loading...</option>';

    Promise.all([
        api.admin.getCategories(),
        api.request('/admin/products/' + id),
    ]).then(function(results) {
        var cats = results[0];
        var p = results[1];
        catSelect.innerHTML = '<option value="">Select category...</option>' +
            cats.map(function(c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
        document.getElementById('productName').value = p.name || '';
        document.getElementById('productDescription').value = p.description || '';
        document.getElementById('productPrice').value = p.price || '';
        document.getElementById('productComparePrice').value = p.compareAtPrice || '';
        document.getElementById('productStock').value = p.stockQuantity || 0;
        document.getElementById('productBrand').value = p.brand || '';
        if (p.categoryId) catSelect.value = p.categoryId;
        if (p.imageUrl) {
            var previewDiv = document.getElementById('productImagePreview');
            var previewImg = document.getElementById('productImagePreviewImg');
            previewImg.src = p.imageUrl;
            previewDiv.style.display = 'block';
        }
    }).catch(function(err) {
        showToast(err.message, 'error');
    });

    new bootstrap.Modal(document.getElementById('productModal')).show();
}

function saveProduct() {
    var id = document.getElementById('productId').value;
    var name = document.getElementById('productName').value.trim();
    var price = document.getElementById('productPrice').value;
    var categoryId = document.getElementById('productCategory').value;

    if (!name) { showToast('Product name is required', 'error'); return; }
    if (!price || parseFloat(price) < 0) { showToast('Valid price is required', 'error'); return; }
    if (!categoryId) { showToast('Please select a category', 'error'); return; }

    var fd = new FormData();
    fd.append('name', name);
    fd.append('description', document.getElementById('productDescription').value.trim());
    fd.append('price', price);
    var comparePrice = document.getElementById('productComparePrice').value;
    if (comparePrice) fd.append('compareAtPrice', comparePrice);
    fd.append('stockQuantity', document.getElementById('productStock').value || '0');
    fd.append('categoryId', categoryId);
    var brand = document.getElementById('productBrand').value.trim();
    if (brand) fd.append('brand', brand);
    var imageFile = document.getElementById('productImage').files[0];
    if (imageFile) fd.append('image', imageFile);

    var btn = document.getElementById('saveProductBtn');
    setButtonLoading(btn, true);

    var promise = id ? api.admin.updateProduct(parseInt(id), fd) : api.admin.createProduct(fd);
    promise.then(function(resp) {
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        showToast(id ? 'Product updated!' : 'Product created!', 'success');
        if (resp && resp.warning) showToast(resp.warning, 'warning');
        renderProducts();
    }).catch(function(err) {
        showToast(err.message, 'error');
    }).finally(function() {
        setButtonLoading(btn, false);
    });
}

function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product? It may be deactivated instead of permanently removed.')) return;
    api.admin.deleteProduct(id).then(function(result) {
        if (result && result.message && result.message.toLowerCase().includes('deactivated')) {
            showToast('Product has been deactivated', 'info');
        } else {
            showToast('Product deleted', 'success');
        }
        renderProducts();
    }).catch(function(err) {
        showToast(err.message, 'error');
    });
}

// ────────────────────── CATEGORIES ──────────────────────

function renderCategories() {
    var container = document.getElementById('categoriesTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getCategories().then(function(cats) {
        if (cats.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-tags fa-2x mb-2 d-block"></i><span>No categories</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th style="width:50px">Image</th><th>Name</th><th>Description</th><th>Products</th><th>Actions</th></tr></thead><tbody>';
        cats.forEach(function(c) {
            var thumb = c.imageUrl ? '<img src="' + c.imageUrl + '" alt="" style="width:40px;height:40px;border-radius:6px;object-fit:cover">' : '<div style="width:40px;height:40px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#94a3b8"><i class="fas fa-tag"></i></div>';
            html += '<tr>' +
                '<td>' + thumb + '</td>' +
                '<td><strong>' + (c.name || '') + '</strong></td>' +
                '<td>' + (c.description || '-') + '</td>' +
                '<td><span class="badge bg-secondary">' + (c.productCount || 0) + '</span></td>' +
                '<td><div class="d-flex gap-1">' +
                '<button class="btn btn-sm btn-outline-primary" onclick="showEditCategoryModal(' + c.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(' + c.id + ')"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

function showAddCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'Add Category';
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryDescription').value = '';
    document.getElementById('categoryImage').value = '';
    clearCategoryImage();
    new bootstrap.Modal(document.getElementById('categoryModal')).show();
}

function showEditCategoryModal(id) {
    document.getElementById('categoryModalTitle').textContent = 'Edit Category';
    document.getElementById('categoryId').value = id;
    document.getElementById('categoryImage').value = '';
    clearCategoryImage();

    api.admin.getCategories().then(function(cats) {
        var cat = cats.find(function(c) { return c.id === id; });
        if (cat) {
            document.getElementById('categoryName').value = cat.name || '';
            document.getElementById('categoryDescription').value = cat.description || '';
            if (cat.imageUrl) {
                var previewDiv = document.getElementById('categoryImagePreview');
                var previewImg = document.getElementById('categoryImagePreviewImg');
                previewImg.src = cat.imageUrl;
                previewDiv.style.display = 'block';
            }
        }
    }).catch(function(err) {
        showToast(err.message, 'error');
    });

    new bootstrap.Modal(document.getElementById('categoryModal')).show();
}

function saveCategory() {
    var id = document.getElementById('categoryId').value;
    var name = document.getElementById('categoryName').value.trim();

    if (!name) { showToast('Category name is required', 'error'); return; }

    var fd = new FormData();
    fd.append('name', name);
    fd.append('description', document.getElementById('categoryDescription').value.trim());
    var imageFile = document.getElementById('categoryImage').files[0];
    if (imageFile) fd.append('image', imageFile);

    var btn = document.getElementById('saveCategoryBtn');
    setButtonLoading(btn, true);

    var promise = id ? api.admin.updateCategory(parseInt(id), fd) : api.admin.createCategory(fd);
    promise.then(function(resp) {
        bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
        showToast(id ? 'Category updated!' : 'Category created!', 'success');
        if (resp && resp.warning) showToast(resp.warning, 'warning');
        renderCategories();
        refreshCategoryFilter();
    }).catch(function(err) {
        showToast(err.message, 'error');
    }).finally(function() {
        setButtonLoading(btn, false);
    });
}

function deleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    api.admin.deleteCategory(id).then(function() {
        showToast('Category deleted', 'success');
        renderCategories();
        refreshCategoryFilter();
    }).catch(function(err) {
        showToast(err.message, 'error');
    });
}

function refreshCategoryFilter() {
    api.admin.getCategories().then(function(cats) {
        var select = document.getElementById('productCategoryFilter');
        if (select) {
            var currentVal = select.value;
            select.innerHTML = '<option value="">All Categories</option>' +
                cats.map(function(c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
            select.value = currentVal;
        }
    }).catch(function() {});
}

// ────────────────────── STAFF ──────────────────────

function renderStaff() {
    var container = document.getElementById('staffTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getStaff().then(function(staff) {
        if (staff.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-users-cog fa-2x mb-2 d-block"></i><span>No staff members</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
        staff.forEach(function(s) {
            var roleBadge = 'secondary';
            if (s.role === 'SECRETARY') roleBadge = 'warning';
            else if (s.role === 'WAREHOUSE') roleBadge = 'info';
            else if (s.role === 'DELIVERY_MAN') roleBadge = 'primary';
            html += '<tr>' +
                '<td>' + s.id + '</td>' +
                '<td><strong>' + (s.fullName || '') + '</strong></td>' +
                '<td>' + (s.email || '') + '</td>' +
                '<td>' + (s.phone || '') + '</td>' +
                '<td><span class="badge bg-' + roleBadge + '">' + (s.role || '') + '</span></td>' +
                '<td><div class="d-flex gap-1">' +
                '<button class="btn btn-sm btn-outline-primary" onclick="showEditStaffModal(' + s.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteStaff(' + s.id + ')"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

function showAddStaffModal() {
    document.getElementById('staffModalTitle').textContent = 'Add Staff';
    document.getElementById('staffId').value = '';
    document.getElementById('staffName').value = '';
    document.getElementById('staffEmail').value = '';
    document.getElementById('staffPhone').value = '';
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffPassword').required = true;
    document.getElementById('staffRole').value = 'SECRETARY';
    document.getElementById('staffEmail').disabled = false;
    document.getElementById('staffRole').disabled = false;
    new bootstrap.Modal(document.getElementById('staffModal')).show();
}

function showEditStaffModal(id) {
    document.getElementById('staffModalTitle').textContent = 'Edit Staff';
    document.getElementById('staffId').value = id;
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffPassword').required = false;

    api.admin.getStaff().then(function(staff) {
        var s = staff.find(function(m) { return m.id === id; });
        if (s) {
            document.getElementById('staffName').value = s.fullName || '';
            document.getElementById('staffEmail').value = s.email || '';
            document.getElementById('staffPhone').value = s.phone || '';
            document.getElementById('staffRole').value = s.role || 'SECRETARY';
            // Staff edit: email and role disabled per project constraint
            document.getElementById('staffEmail').disabled = true;
            document.getElementById('staffRole').disabled = true;
        }
    }).catch(function(err) {
        showToast(err.message, 'error');
    });

    new bootstrap.Modal(document.getElementById('staffModal')).show();
}

function saveStaff() {
    var id = document.getElementById('staffId').value;
    var name = document.getElementById('staffName').value.trim();
    var email = document.getElementById('staffEmail').value.trim();
    var phone = document.getElementById('staffPhone').value.trim();
    var password = document.getElementById('staffPassword').value;
    var role = document.getElementById('staffRole').value;

    if (!name) { showToast('Full name is required', 'error'); return; }
    if (!email) { showToast('Email is required', 'error'); return; }
    if (!phone) { showToast('Phone is required', 'error'); return; }
    if (!id && !password) { showToast('Password is required for new staff', 'error'); return; }
    if (password && password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

    var data = { fullName: name, email: email, phone: phone, role: role };
    if (password) data.password = password;

    var btn = document.getElementById('saveStaffBtn');
    setButtonLoading(btn, true);

    var promise = id ? api.admin.updateStaff(parseInt(id), data) : api.admin.createStaff(data);
    promise.then(function() {
        bootstrap.Modal.getInstance(document.getElementById('staffModal')).hide();
        showToast(id ? 'Staff updated!' : 'Staff created!', 'success');
        renderStaff();
    }).catch(function(err) {
        showToast(err.message, 'error');
    }).finally(function() {
        setButtonLoading(btn, false);
    });
}

function deleteStaff(id) {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    api.admin.deleteStaff(id).then(function() {
        showToast('Staff member deleted', 'success');
        renderStaff();
    }).catch(function(err) {
        showToast(err.message, 'error');
    });
}

// ────────────────────── CUSTOMERS ──────────────────────

function renderCustomers(page, search) {
    if (page !== undefined) currentCustomerPage = page;
    if (search !== undefined) {
        document.getElementById('customerSearch').value = search;
    }
    var query = document.getElementById('customerSearch').value.trim();
    var container = document.getElementById('customersTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getCustomers({ page: currentCustomerPage, search: query || undefined }).then(function(data) {
        var customers = data.customers || data;
        var totalPages = (data.pagination && data.pagination.pages) || 1;
        var currentPage = (data.pagination && data.pagination.page) || currentCustomerPage;

        if (!customers || customers.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-user-friends fa-2x mb-2 d-block"></i><span>No customers found</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th></tr></thead><tbody>';
        customers.forEach(function(c) {
            html += '<tr>' +
                '<td>' + c.id + '</td>' +
                '<td><strong>' + (c.fullName || '') + '</strong></td>' +
                '<td>' + (c.email || '') + '</td>' +
                '<td>' + (c.phone || '-') + '</td>' +
                '<td><span class="badge bg-secondary">' + (c.orderCount || 0) + '</span></td>' +
                '<td><small class="text-muted">' + (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '') + '</small></td></tr>';
        });
        html += '</tbody></table></div>';

        if (totalPages > 1) {
            html += '<nav class="mt-3"><ul class="pagination pagination-sm justify-content-center mb-0">';
            for (var i = 1; i <= totalPages; i++) {
                html += '<li class="page-item' + (i === currentPage ? ' active' : '') + '"><a class="page-link" href="javascript:void(0)" onclick="renderCustomers(' + i + ')">' + i + '</a></li>';
            }
            html += '</ul></nav>';
        }

        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

// ────────────────────── ORDERS ──────────────────────

function renderOrders(page) {
    if (page !== undefined) currentOrderPage = page;
    var status = document.getElementById('orderStatusFilter').value;
    var payment = document.getElementById('orderPaymentFilter').value;
    var container = document.getElementById('ordersTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getOrders({ page: currentOrderPage, status: status || undefined, payment_method: payment || undefined }).then(function(data) {
        var orders = data.orders || data;
        var totalPages = (data.pagination && data.pagination.pages) || 1;
        var currentPage = (data.pagination && data.pagination.page) || currentOrderPage;

        if (!orders || orders.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-shopping-bag fa-2x mb-2 d-block"></i><span>No orders found</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead><tbody>';
        orders.forEach(function(o) {
            var paymentBadge = o.paymentMethod === 'transfer' ? 'info' : o.paymentMethod === 'card' ? 'primary' : 'secondary';
            var statusBadge = o.status === 'DELIVERED' ? 'success' : o.status === 'SHIPPED' ? 'primary' : o.status === 'PROCESSING' ? 'warning' : o.status === 'PENDING' ? 'secondary' : o.status === 'IN_WAREHOUSE' ? 'info' : o.status === 'CANCELLED' ? 'danger' : 'secondary';
            html += '<tr class="order-row" onclick="showOrderDetail(' + o.id + ')">' +
                '<td><strong>#' + (o.orderNumber || o.id) + '</strong></td>' +
                '<td>' + (o.customerName || 'N/A') + '</td>' +
                '<td>₦' + (o.totalAmount || 0).toFixed(2) + '</td>' +
                '<td><span class="badge bg-' + paymentBadge + '">' + (o.paymentMethod || '-') + '</span> ' +
                '<span class="badge bg-' + (o.paymentStatus === 'PAID' ? 'success' : 'warning') + '">' + (o.paymentStatus || '-') + '</span></td>' +
                '<td><span class="badge bg-' + statusBadge + '">' + (o.status || '-') + '</span></td>' +
                '<td><small class="text-muted">' + (o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '') + '</small></td></tr>';
        });
        html += '</tbody></table></div>';

        if (totalPages > 1) {
            html += '<nav class="mt-3"><ul class="pagination pagination-sm justify-content-center mb-0">';
            for (var i = 1; i <= totalPages; i++) {
                html += '<li class="page-item' + (i === currentPage ? ' active' : '') + '"><a class="page-link" href="javascript:void(0)" onclick="renderOrders(' + i + ')">' + i + '</a></li>';
            }
            html += '</ul></nav>';
        }

        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

function showOrderDetail(id) {
    var body = document.getElementById('orderDetailBody');
    body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    new bootstrap.Modal(document.getElementById('orderDetailModal')).show();

    api.admin.getOrderDetail(id).then(function(o) {
        var itemsHtml = '';
        if (o.items && o.items.length > 0) {
            itemsHtml = '<div class="table-responsive mt-3"><table class="table table-sm"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead><tbody>' +
                o.items.map(function(item) {
                    return '<tr><td>' + (item.productName || 'Product #' + item.productId) + '</td><td>' + item.quantity + '</td><td>₦' + (item.unitPrice || 0).toFixed(2) + '</td><td>₦' + (item.subtotal || 0).toFixed(2) + '</td></tr>';
                }).join('') +
                '</tbody></table></div>';
        }

        var statusBadge = o.status === 'DELIVERED' ? 'success' : o.status === 'SHIPPED' ? 'primary' : o.status === 'PROCESSING' ? 'warning' : o.status === 'PENDING' ? 'secondary' : o.status === 'IN_WAREHOUSE' ? 'info' : o.status === 'CANCELLED' ? 'danger' : 'secondary';

        body.innerHTML =
            '<div class="row g-3">' +
            '<div class="col-md-6"><strong>Order #</strong><br>' + (o.orderNumber || o.id) + '</div>' +
            '<div class="col-md-6"><strong>Date</strong><br>' + (o.createdAt ? new Date(o.createdAt).toLocaleString() : '-') + '</div>' +
            '<div class="col-md-6"><strong>Customer</strong><br>' + ((o.customer && o.customer.fullName) || 'N/A') + '<br><small class="text-muted">' + ((o.customer && o.customer.email) || '') + '</small></div>' +
            '<div class="col-md-6"><strong>Status</strong><br><span class="badge bg-' + statusBadge + ' fs-6">' + (o.status || '-') + '</span></div>' +
            '<div class="col-md-6"><strong>Payment Method</strong><br>' + (o.paymentMethod || '-') + '</div>' +
            '<div class="col-md-6"><strong>Payment Status</strong><br><span class="badge bg-' + (o.paymentStatus === 'PAID' ? 'success' : 'warning') + '">' + (o.paymentStatus || '-') + '</span></div>' +
            (o.shippingAddress ? '<div class="col-12"><strong>Shipping Address</strong><br>' + o.shippingAddress + '</div>' : '') +
            (o.trackingId ? '<div class="col-12"><strong>Tracking ID</strong><br>' + o.trackingId + '</div>' : '') +
            '<div class="col-12"><strong>Total Amount</strong><br><span class="fw-bold fs-5">₦' + (o.totalAmount || 0).toFixed(2) + '</span></div>' +
            '</div>' +
            itemsHtml;
    }).catch(function(err) {
        body.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

// ────────────────────── BANK ACCOUNTS ──────────────────────

function renderBankAccounts() {
    var container = document.getElementById('bankAccountsTable');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getBankAccounts().then(function(accounts) {
        if (accounts.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-university fa-2x mb-2 d-block"></i><span>No bank accounts</span></div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>ID</th><th>Bank Name</th><th>Account Name</th><th>Account Number</th><th>Actions</th></tr></thead><tbody>';
        accounts.forEach(function(a) {
            html += '<tr>' +
                '<td>' + a.id + '</td>' +
                '<td><strong>' + (a.bankName || '') + '</strong></td>' +
                '<td>' + (a.accountName || '') + '</td>' +
                '<td>' + (a.accountNumber || '') + '</td>' +
                '<td><div class="d-flex gap-1">' +
                '<button class="btn btn-sm btn-outline-primary" onclick="showEditBankAccountModal(' + a.id + ')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-sm btn-outline-danger" onclick="deleteBankAccount(' + a.id + ')"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    }).catch(function(err) {
        container.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}

function showAddBankAccountModal() {
    document.getElementById('bankAccountModalTitle').textContent = 'Add Bank Account';
    document.getElementById('bankAccountId').value = '';
    document.getElementById('bankName').value = '';
    document.getElementById('accountName').value = '';
    document.getElementById('accountNumber').value = '';
    new bootstrap.Modal(document.getElementById('bankAccountModal')).show();
}

function showEditBankAccountModal(id) {
    document.getElementById('bankAccountModalTitle').textContent = 'Edit Bank Account';
    document.getElementById('bankAccountId').value = id;

    api.admin.getBankAccounts().then(function(accounts) {
        var a = accounts.find(function(acct) { return acct.id === id; });
        if (a) {
            document.getElementById('bankName').value = a.bankName || '';
            document.getElementById('accountName').value = a.accountName || '';
            document.getElementById('accountNumber').value = a.accountNumber || '';
        }
    }).catch(function(err) {
        showToast(err.message, 'error');
    });

    new bootstrap.Modal(document.getElementById('bankAccountModal')).show();
}

function saveBankAccount() {
    var id = document.getElementById('bankAccountId').value;
    var bankName = document.getElementById('bankName').value.trim();
    var accountName = document.getElementById('accountName').value.trim();
    var accountNumber = document.getElementById('accountNumber').value.trim();

    if (!bankName) { showToast('Bank name is required', 'error'); return; }
    if (!accountName) { showToast('Account name is required', 'error'); return; }
    if (!accountNumber) { showToast('Account number is required', 'error'); return; }
    if (!/^\d{10}$/.test(accountNumber)) { showToast('Account number must be exactly 10 digits', 'error'); return; }

    var data = { bankName: bankName, accountName: accountName, accountNumber: accountNumber };

    var btn = document.getElementById('saveBankAccountBtn');
    setButtonLoading(btn, true);

    var promise = id ? api.admin.updateBankAccount(parseInt(id), data) : api.admin.createBankAccount(data);
    promise.then(function() {
        bootstrap.Modal.getInstance(document.getElementById('bankAccountModal')).hide();
        showToast(id ? 'Bank account updated!' : 'Bank account created!', 'success');
        renderBankAccounts();
    }).catch(function(err) {
        showToast(err.message, 'error');
    }).finally(function() {
        setButtonLoading(btn, false);
    });
}

function deleteBankAccount(id) {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    api.admin.deleteBankAccount(id).then(function() {
        showToast('Bank account deleted', 'success');
        renderBankAccounts();
    }).catch(function(err) {
        showToast(err.message, 'error');
    });
}

// ────────────────────── REPORTS ──────────────────────

function renderReports() {
    var salesEl = document.getElementById('salesReport');
    var productsEl = document.getElementById('productsReport');
    salesEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    productsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    api.admin.getSalesReport({}).then(function(sales) {
        if (sales.totalOrders !== undefined) {
            salesEl.innerHTML =
                '<div class="row g-3">' +
                '<div class="col-6"><div class="p-3 bg-light rounded-3"><small class="text-muted d-block">Total Orders</small><span class="fw-bold fs-4">' + (sales.totalOrders || 0) + '</span></div></div>' +
                '<div class="col-6"><div class="p-3 bg-light rounded-3"><small class="text-muted d-block">Total Revenue</small><span class="fw-bold fs-4">₦' + (sales.totalRevenue || 0).toFixed(2) + '</span></div></div>' +
                '<div class="col-6"><div class="p-3 bg-light rounded-3"><small class="text-muted d-block">Avg Order Value</small><span class="fw-bold fs-4">₦' + (sales.averageOrderValue || 0).toFixed(2) + '</span></div></div>' +
                '<div class="col-6"><div class="p-3 bg-light rounded-3"><small class="text-muted d-block">COD Revenue</small><span class="fw-bold fs-4">₦' + ((sales.revenueByMethod && sales.revenueByMethod.cod) || 0).toFixed(2) + '</span></div></div>' +
                '</div>';
        } else {
            salesEl.innerHTML = '<div class="text-center text-muted py-4"><span>No sales data available</span></div>';
        }
    }).catch(function(err) {
        salesEl.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });

    api.admin.getProductsReport().then(function(products) {
        var topByQty = products.topByQuantity || [];
        var topByRev = products.topByRevenue || [];
        var html = '';
        if (topByRev.length > 0) {
            html += '<h6 class="fw-bold mb-2">Top Products by Revenue</h6>' +
                '<div class="table-responsive mb-4"><table class="table table-hover mb-0"><thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead><tbody>';
            topByRev.forEach(function(p, i) {
                html += '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td><strong>' + (p.productName || '') + '</strong></td>' +
                    '<td>' + (p.totalQuantity || 0) + '</td>' +
                    '<td>₦' + (p.totalRevenue || 0).toFixed(2) + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }
        if (topByQty.length > 0) {
            html += '<h6 class="fw-bold mb-2">Top Products by Quantity Sold</h6>' +
                '<div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead><tbody>';
            topByQty.forEach(function(p, i) {
                html += '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td><strong>' + (p.productName || '') + '</strong></td>' +
                    '<td>' + (p.totalQuantity || 0) + '</td>' +
                    '<td>₦' + (p.totalRevenue || 0).toFixed(2) + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }
        if (!html) {
            html = '<div class="text-center text-muted py-4"><span>No product data available</span></div>';
        }
        productsEl.innerHTML = html;
    }).catch(function(err) {
        productsEl.innerHTML = '<div class="alert alert-danger mb-0">' + err.message + '</div>';
    });
}
