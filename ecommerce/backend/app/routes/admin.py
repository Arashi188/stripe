from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app import db
from app.models import User, Product, Category, Order, OrderItem, Cart, Wishlist, Review, BankAccount, WarehouseTask, ChatConversation, ChatMessage
from werkzeug.security import generate_password_hash
from app.cloudinary_helper import upload_image

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'ADMIN':
            return {'error': 'Admin access required'}, 403
        return f(*args, **kwargs)
    return decorated


def _paginate(query, page=1, limit=20):
    page = max(int(page), 1)
    limit = min(max(int(limit), 1), 100)
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, {
        'page': page,
        'limit': limit,
        'total': total,
        'pages': (total + limit - 1) // limit,
    }


# ── Dashboard ──

@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def get_dashboard():
    try:
        total_products = Product.query.count()
        total_categories = Category.query.count()
        total_orders = Order.query.count()
        total_revenue = db.session.query(func.sum(Order.total_amount)).filter(
            Order.payment_status == 'PAID'
        ).scalar() or 0
        pending_orders = Order.query.filter(Order.status == 'PENDING').count()
        total_customers = User.query.filter_by(role='USER').count()
        total_staff = User.query.filter(User.role.in_(['SECRETARY', 'WAREHOUSE', 'DELIVERY_MAN'])).count()

        recent_orders = Order.query.order_by(Order.created_at.desc()).limit(5).all()
        recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()

        return {
            'totalProducts': total_products,
            'totalCategories': total_categories,
            'totalOrders': total_orders,
            'totalRevenue': float(total_revenue),
            'pendingOrders': pending_orders,
            'totalCustomers': total_customers,
            'totalStaff': total_staff,
            'recentOrders': [{
                'id': o.id,
                'orderNumber': o.order_number,
                'customerName': o.user.full_name if o.user else o.customer_name,
                'totalAmount': float(o.total_amount),
                'status': o.status,
                'paymentStatus': o.payment_status,
                'createdAt': o.created_at.isoformat() if o.created_at else None,
            } for o in recent_orders],
            'recentUsers': [{
                'id': u.id,
                'fullName': u.full_name,
                'email': u.email,
                'role': u.role,
                'createdAt': u.created_at.isoformat() if u.created_at else None,
            } for u in recent_users],
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load dashboard data'}, 500


# ── Products ──

@admin_bp.route('/products', methods=['GET'])
@admin_required
def get_products():
    try:
        query = Product.query
        search = request.args.get('search', '').strip()
        category_id = request.args.get('category_id', type=int)
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)

        if search:
            query = query.filter(Product.name.ilike(f'%{search}%'))
        if category_id:
            query = query.filter_by(category_id=category_id)

        query = query.order_by(Product.created_at.desc())
        items, pagination = _paginate(query, page, limit)

        return {
            'products': [{
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'price': float(p.price),
                'stockQuantity': p.stock_quantity,
                'categoryId': p.category_id,
                'categoryName': p.category.name if p.category else None,
                'isActive': p.is_active,
                'imageUrl': p.image_url,
                'createdAt': p.created_at.isoformat() if p.created_at else None,
            } for p in items],
            'pagination': pagination,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load products'}, 500


@admin_bp.route('/products', methods=['POST'])
@admin_required
def create_product():
    try:
        data = request.form if request.form else request.get_json(silent=True) or {}
        file = request.files.get('image')

        errors = {}
        name = (data.get('name') or '').strip()
        if not name:
            errors['name'] = 'Product name is required'

        price = data.get('price')
        if price is None:
            errors['price'] = 'Price is required'
        else:
            try:
                price = float(price)
                if price < 0:
                    errors['price'] = 'Price must be a positive number'
            except (ValueError, TypeError):
                errors['price'] = 'Price must be a valid number'

        stock_quantity = data.get('stockQuantity', 0)
        try:
            stock_quantity = int(stock_quantity)
            if stock_quantity < 0:
                errors['stockQuantity'] = 'Stock quantity must be a non-negative number'
        except (ValueError, TypeError):
            errors['stockQuantity'] = 'Stock quantity must be a valid integer'

        category_id = data.get('categoryId')
        if category_id is not None:
            cat = Category.query.get(category_id)
            if not cat:
                errors['categoryId'] = 'Category does not exist'

        if errors:
            return {'errors': errors}, 400

        image_url = None
        upload_warning = None
        if file and file.filename:
            try:
                image_url = upload_image(file, 'products')
            except (ValueError, RuntimeError) as e:
                upload_warning = str(e)

        compare_at_price = data.get('compareAtPrice')
        if compare_at_price:
            try:
                compare_at_price = float(compare_at_price)
            except (ValueError, TypeError):
                compare_at_price = None

        brand = (data.get('brand') or '').strip() or None

        product = Product(
            name=name,
            description=(data.get('description') or '').strip(),
            price=price,
            compare_at_price=compare_at_price,
            stock_quantity=stock_quantity,
            category_id=category_id,
            brand=brand,
            image_url=image_url,
        )
        db.session.add(product)
        db.session.commit()
        response = {
            'id': product.id,
            'name': product.name,
            'price': float(product.price),
            'stockQuantity': product.stock_quantity,
            'categoryId': product.category_id,
            'imageUrl': product.image_url,
        }
        if upload_warning:
            current_app.logger.warning('Product create image upload failed: %s', upload_warning)
            response['warning'] = 'Product created, but image upload failed: ' + upload_warning
        return response, 201
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to create product'}, 500


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        data = request.form if request.form else request.get_json(silent=True) or {}
        file = request.files.get('image')

        if 'name' in data:
            name = (data['name'] or '').strip()
            if not name:
                return {'error': 'Product name cannot be empty'}, 400
            product.name = name
        if 'description' in data:
            product.description = (data['description'] or '').strip()
        if 'price' in data:
            try:
                price = float(data['price'])
                if price < 0:
                    return {'error': 'Price must be a positive number'}, 400
                product.price = price
            except (ValueError, TypeError):
                return {'error': 'Price must be a valid number'}, 400
        if 'stockQuantity' in data:
            try:
                sq = int(data['stockQuantity'])
                if sq < 0:
                    return {'error': 'Stock quantity must be non-negative'}, 400
                product.stock_quantity = sq
            except (ValueError, TypeError):
                return {'error': 'Stock quantity must be a valid integer'}, 400
        if 'categoryId' in data:
            cat = Category.query.get(data['categoryId'])
            if not cat:
                return {'error': 'Category does not exist'}, 400
            product.category_id = data['categoryId']

        upload_warning = None
        if file and file.filename:
            try:
                product.image_url = upload_image(file, 'products')
            except (ValueError, RuntimeError) as e:
                upload_warning = str(e)

        db.session.commit()
        response = {
            'id': product.id,
            'name': product.name,
            'price': float(product.price),
            'stockQuantity': product.stock_quantity,
            'categoryId': product.category_id,
            'imageUrl': product.image_url,
        }
        if upload_warning:
            current_app.logger.warning('Product update image upload failed: %s', upload_warning)
            response['warning'] = 'Product updated, but image upload failed: ' + upload_warning
        return response
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to update product'}, 500


@admin_bp.route('/products/<int:product_id>', methods=['GET'])
@admin_required
def get_product(product_id):
    try:
        p = Product.query.get_or_404(product_id)
        return {
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'price': float(p.price),
            'compareAtPrice': float(p.compare_at_price) if p.compare_at_price else None,
            'stockQuantity': p.stock_quantity,
            'categoryId': p.category_id,
            'categoryName': p.category.name if p.category else None,
            'brand': p.brand,
            'imageUrl': p.image_url,
            'isActive': p.is_active,
            'createdAt': p.created_at.isoformat() if p.created_at else None,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load product'}, 500


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    try:
        product = Product.query.get_or_404(product_id)
        has_order_items = OrderItem.query.filter_by(product_id=product_id).first() is not None

        if has_order_items:
            product.is_active = False
            db.session.commit()
            return {
                'message': 'Product has existing order history and was deactivated (soft delete) instead of deleted.',
                'type': 'soft',
            }
        else:
            Cart.query.filter_by(product_id=product_id).delete()
            Wishlist.query.filter_by(product_id=product_id).delete()
            Review.query.filter_by(product_id=product_id).delete()
            db.session.delete(product)
            db.session.commit()
            return {'message': 'Product permanently deleted.', 'type': 'hard'}
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to delete product'}, 500


# ── Categories ──

@admin_bp.route('/categories', methods=['GET'])
@admin_required
def get_categories():
    try:
        cats = Category.query.all()
        return [{
            'id': c.id,
            'name': c.name,
            'description': c.description,
            'imageUrl': c.image_url,
            'productCount': len(c.products),
            'isActive': c.is_active,
            'createdAt': c.created_at.isoformat() if hasattr(c, 'created_at') and c.created_at else None,
        } for c in cats]
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load categories'}, 500


@admin_bp.route('/categories', methods=['POST'])
@admin_required
def create_category():
    try:
        data = request.form if request.form else request.get_json(silent=True) or {}
        file = request.files.get('image')

        name = (data.get('name') or '').strip()
        if not name:
            return {'error': 'Category name is required'}, 400

        existing = Category.query.filter(func.lower(Category.name) == func.lower(name)).first()
        if existing:
            return {'error': 'A category with this name already exists'}, 400

        image_url = None
        upload_warning = None
        if file and file.filename:
            try:
                image_url = upload_image(file, 'categories')
            except (ValueError, RuntimeError) as e:
                upload_warning = str(e)

        cat = Category(
            name=name,
            description=(data.get('description') or '').strip(),
            image_url=image_url,
        )
        db.session.add(cat)
        db.session.commit()
        response = {
            'id': cat.id,
            'name': cat.name,
            'description': cat.description,
            'imageUrl': cat.image_url,
            'productCount': 0,
        }
        if upload_warning:
            current_app.logger.warning('Category create image upload failed: %s', upload_warning)
            response['warning'] = 'Category created, but image upload failed: ' + upload_warning
        return response, 201
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to create category'}, 500


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    try:
        cat = Category.query.get_or_404(category_id)
        data = request.form if request.form else request.get_json(silent=True) or {}
        file = request.files.get('image')

        if 'name' in data:
            name = (data['name'] or '').strip()
            if not name:
                return {'error': 'Category name cannot be empty'}, 400
            existing = Category.query.filter(
                func.lower(Category.name) == func.lower(name),
                Category.id != category_id,
            ).first()
            if existing:
                return {'error': 'A category with this name already exists'}, 400
            cat.name = name
        if 'description' in data:
            cat.description = (data['description'] or '').strip()

        upload_warning = None
        if file and file.filename:
            try:
                cat.image_url = upload_image(file, 'categories')
            except (ValueError, RuntimeError) as e:
                upload_warning = str(e)

        db.session.commit()
        response = {
            'id': cat.id,
            'name': cat.name,
            'description': cat.description,
            'imageUrl': cat.image_url,
            'productCount': len(cat.products),
        }
        if upload_warning:
            current_app.logger.warning('Category update image upload failed: %s', upload_warning)
            response['warning'] = 'Category updated, but image upload failed: ' + upload_warning
        return response
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to update category'}, 500


@admin_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    try:
        cat = Category.query.get_or_404(category_id)
        linked_products = Product.query.filter_by(category_id=category_id).count()
        if linked_products > 0:
            return {
                'error': f'Cannot delete category with {linked_products} existing product(s). Reassign or delete those products first.'
            }, 400
        db.session.delete(cat)
        db.session.commit()
        return {'message': 'Category deleted successfully.'}
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to delete category'}, 500


# ── Staff Management ──

@admin_bp.route('/staff', methods=['GET'])
@admin_required
def get_staff():
    try:
        staff = User.query.filter(User.role.in_(['SECRETARY', 'WAREHOUSE', 'DELIVERY_MAN'])).all()
        return [{
            'id': u.id,
            'fullName': u.full_name,
            'email': u.email,
            'phone': u.phone,
            'role': u.role,
            'isActive': True,
            'createdAt': u.created_at.isoformat() if u.created_at else None,
        } for u in staff]
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load staff'}, 500


@admin_bp.route('/staff', methods=['POST'])
@admin_required
def create_staff():
    try:
        data = request.get_json()
        if not data:
            return {'error': 'No data provided'}, 400

        full_name = (data.get('fullName') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password')
        role = (data.get('role') or '').upper()
        phone = (data.get('phone') or '').strip()

        errors = {}
        if not full_name:
            errors['fullName'] = 'Full name is required'
        if not email:
            errors['email'] = 'Email is required'
        if not password or len(password) < 6:
            errors['password'] = 'Password is required (minimum 6 characters)'
        if role not in ('SECRETARY', 'WAREHOUSE', 'DELIVERY_MAN'):
            errors['role'] = 'Role must be SECRETARY, WAREHOUSE, or DELIVERY_MAN'
        if email and User.query.filter_by(email=email).first():
            errors['email'] = 'Email is already registered'

        if errors:
            return {'errors': errors}, 400

        user = User(
            email=email,
            full_name=full_name,
            phone=phone,
            role=role,
        )
        user.password = generate_password_hash(password)
        db.session.add(user)
        db.session.commit()
        return {
            'id': user.id,
            'fullName': user.full_name,
            'email': user.email,
            'phone': user.phone,
            'role': user.role,
        }, 201
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to create staff member'}, 500


@admin_bp.route('/staff/<int:user_id>', methods=['PUT'])
@admin_required
def update_staff(user_id):
    try:
        user = User.query.get_or_404(user_id)
        if user.role not in ('SECRETARY', 'WAREHOUSE', 'DELIVERY_MAN'):
            return {'error': 'Not a staff member'}, 400

        data = request.get_json()
        if not data:
            return {'error': 'No data provided'}, 400

        if 'fullName' in data:
            name = (data['fullName'] or '').strip()
            if not name:
                return {'error': 'Full name cannot be empty'}, 400
            user.full_name = name
        if 'phone' in data:
            user.phone = (data['phone'] or '').strip()
        if 'isActive' in data:
            user.is_active = bool(data['isActive'])

        db.session.commit()
        return {
            'id': user.id,
            'fullName': user.full_name,
            'email': user.email,
            'phone': user.phone,
            'role': user.role,
            'isActive': True,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to update staff member'}, 500


@admin_bp.route('/staff/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_staff(user_id):
    try:
        user = User.query.get_or_404(user_id)
        if user.role not in ('SECRETARY', 'WAREHOUSE', 'DELIVERY_MAN'):
            return {'error': 'Not a staff member'}, 400

        has_orders = Order.query.filter(
            db.or_(Order.user_id == user_id, Order.delivery_man_id == user_id)
        ).first() is not None
        has_tasks = WarehouseTask.query.filter_by(sent_by=user_id).first() is not None
        has_chats = ChatConversation.query.filter(
            db.or_(ChatConversation.secretary_id == user_id, ChatConversation.delivery_man_id == user_id)
        ).first() is not None

        if has_orders or has_tasks or has_chats:
            return {
                'error': 'This staff member has linked orders, tasks, or conversations. Deactivate the account instead of deleting it.'
            }, 400

        db.session.delete(user)
        db.session.commit()
        return {'message': 'Staff member deleted successfully.'}
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to delete staff member'}, 500


# ── Customers (view only) ──

@admin_bp.route('/customers', methods=['GET'])
@admin_required
def get_customers():
    try:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '').strip()
        limit = 20

        query = User.query.filter_by(role='USER')
        if search:
            query = query.filter(
                db.or_(
                    User.full_name.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                )
            )

        query = query.order_by(User.created_at.desc())
        items, pagination = _paginate(query, page, limit)

        customer_data = []
        for u in items:
            order_count = Order.query.filter_by(user_id=u.id).count()
            total_spent = db.session.query(func.sum(Order.total_amount)).filter(
                Order.user_id == u.id, Order.payment_status == 'PAID'
            ).scalar() or 0
            customer_data.append({
                'id': u.id,
                'fullName': u.full_name,
                'email': u.email,
                'phone': u.phone,
                'totalOrders': order_count,
                'totalSpent': float(total_spent),
                'createdAt': u.created_at.isoformat() if u.created_at else None,
            })

        return {
            'customers': customer_data,
            'pagination': pagination,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load customers'}, 500


# ── Orders ──

@admin_bp.route('/orders', methods=['GET'])
@admin_required
def get_orders():
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        status_filter = request.args.get('status', '').strip().upper()
        payment_filter = request.args.get('payment_method', '').strip().lower()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()

        query = Order.query

        if status_filter and status_filter in ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'IN_WAREHOUSE'):
            query = query.filter(Order.status == status_filter)
        if payment_filter and payment_filter in ('cod', 'transfer', 'paystack'):
            query = query.filter(Order.payment_method == payment_filter)
        if date_from:
            try:
                query = query.filter(Order.created_at >= datetime.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                query = query.filter(Order.created_at <= datetime.fromisoformat(date_to))
            except ValueError:
                pass

        query = query.order_by(Order.created_at.desc())
        items, pagination = _paginate(query, page, limit)

        return {
            'orders': [{
                'id': o.id,
                'orderNumber': o.order_number,
                'customerName': o.user.full_name if o.user else o.customer_name,
                'totalAmount': float(o.total_amount),
                'status': o.status,
                'paymentStatus': o.payment_status,
                'paymentMethod': o.payment_method,
                'itemsCount': len(o.order_items),
                'createdAt': o.created_at.isoformat() if o.created_at else None,
            } for o in items],
            'pagination': pagination,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load orders'}, 500


@admin_bp.route('/orders/<int:order_id>', methods=['GET'])
@admin_required
def get_order_detail(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        return {
            'id': order.id,
            'orderNumber': order.order_number,
            'customer': {
                'fullName': order.user.full_name if order.user else order.customer_name,
                'email': order.user.email if order.user else order.customer_email,
                'phone': order.shipping_phone,
            } if order.user else {'fullName': order.customer_name, 'email': order.customer_email, 'phone': order.shipping_phone},
            'shippingAddress': order.shipping_address,
            'shippingCity': order.shipping_city,
            'shippingState': order.shipping_state,
            'shippingZipCode': order.shipping_zip_code,
            'shippingCountry': order.shipping_country,
            'shippingPhone': order.shipping_phone,
            'subtotal': float(order.subtotal),
            'shippingCost': float(order.shipping_cost),
            'tax': float(order.tax),
            'totalAmount': float(order.total_amount),
            'status': order.status,
            'paymentMethod': order.payment_method,
            'paymentStatus': order.payment_status,
            'trackingId': order.tracking_id,
            'deliveryMan': {
                'fullName': order.delivery_man.full_name,
                'phone': order.delivery_man.phone,
            } if order.delivery_man else None,
            'createdAt': order.created_at.isoformat() if order.created_at else None,
            'paidAt': order.paid_at.isoformat() if order.paid_at else None,
            'items': [{
                'productName': i.product_name,
                'quantity': i.quantity,
                'unitPrice': float(i.unit_price),
                'subtotal': float(i.subtotal),
            } for i in order.order_items],
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load order detail'}, 500


# ── Bank Accounts ──

@admin_bp.route('/bank-accounts', methods=['GET'])
@admin_required
def get_bank_accounts():
    try:
        accounts = BankAccount.query.all()
        return [{
            'id': a.id,
            'bankName': a.bank_name,
            'accountName': a.account_name,
            'accountNumber': a.account_number,
            'isActive': a.is_active,
            'createdAt': a.created_at.isoformat() if hasattr(a, 'created_at') and a.created_at else None,
        } for a in accounts]
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to load bank accounts'}, 500


@admin_bp.route('/bank-accounts', methods=['POST'])
@admin_required
def create_bank_account():
    try:
        data = request.get_json()
        if not data:
            return {'error': 'No data provided'}, 400

        bank_name = (data.get('bankName') or '').strip()
        account_name = (data.get('accountName') or '').strip()
        account_number = (data.get('accountNumber') or '').strip()

        errors = {}
        if not bank_name:
            errors['bankName'] = 'Bank name is required'
        if not account_name:
            errors['accountName'] = 'Account name is required'
        if not account_number:
            errors['accountNumber'] = 'Account number is required'
        elif not account_number.isdigit() or len(account_number) != 10:
            errors['accountNumber'] = 'Account number must be exactly 10 digits'

        if errors:
            return {'errors': errors}, 400

        account = BankAccount(
            bank_name=bank_name,
            account_name=account_name,
            account_number=account_number,
        )
        db.session.add(account)
        db.session.commit()
        return {
            'id': account.id,
            'bankName': account.bank_name,
            'accountName': account.account_name,
            'accountNumber': account.account_number,
        }, 201
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to create bank account'}, 500


@admin_bp.route('/bank-accounts/<int:account_id>', methods=['PUT'])
@admin_required
def update_bank_account(account_id):
    try:
        account = BankAccount.query.get_or_404(account_id)
        data = request.get_json()
        if not data:
            return {'error': 'No data provided'}, 400

        if 'bankName' in data:
            account.bank_name = (data['bankName'] or '').strip()
        if 'accountName' in data:
            account.account_name = (data['accountName'] or '').strip()
        if 'accountNumber' in data:
            an = (data['accountNumber'] or '').strip()
            if not an.isdigit() or len(an) != 10:
                return {'error': 'Account number must be exactly 10 digits'}, 400
            account.account_number = an
        if 'isActive' in data:
            account.is_active = bool(data['isActive'])

        db.session.commit()
        return {
            'id': account.id,
            'bankName': account.bank_name,
            'accountName': account.account_name,
            'accountNumber': account.account_number,
            'isActive': account.is_active,
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to update bank account'}, 500


@admin_bp.route('/bank-accounts/<int:account_id>', methods=['DELETE'])
@admin_required
def delete_bank_account(account_id):
    try:
        account = BankAccount.query.get_or_404(account_id)
        db.session.delete(account)
        db.session.commit()
        return {'message': 'Bank account deleted successfully.'}
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to delete bank account'}, 500


# ── Reports ──

@admin_bp.route('/reports/sales', methods=['GET'])
@admin_required
def sales_report():
    try:
        now = datetime.now(timezone.utc)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if start_date:
            try:
                start = datetime.fromisoformat(start_date)
            except ValueError:
                return {'error': 'Invalid start_date format. Use ISO format (YYYY-MM-DD)'}, 400
        else:
            start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

        if end_date:
            try:
                end = datetime.fromisoformat(end_date)
            except ValueError:
                return {'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DD)'}, 400
        else:
            end = now

        base = Order.query.filter(Order.created_at >= start, Order.created_at <= end)
        total_orders = base.count()
        total_revenue = base.filter(Order.payment_status == 'PAID').with_entities(
            func.sum(Order.total_amount)
        ).scalar() or 0
        avg_order = (total_revenue / total_orders) if total_orders > 0 else 0

        cod_revenue = base.filter(Order.payment_method == 'cod', Order.payment_status == 'PAID').with_entities(
            func.sum(Order.total_amount)
        ).scalar() or 0
        transfer_revenue = base.filter(Order.payment_method == 'transfer', Order.payment_status == 'PAID').with_entities(
            func.sum(Order.total_amount)
        ).scalar() or 0
        paystack_revenue = base.filter(Order.payment_method == 'paystack', Order.payment_status == 'PAID').with_entities(
            func.sum(Order.total_amount)
        ).scalar() or 0

        return {
            'startDate': start.isoformat(),
            'endDate': end.isoformat(),
            'totalRevenue': float(total_revenue),
            'totalOrders': total_orders,
            'averageOrderValue': float(avg_order),
            'revenueByMethod': {
                'cod': float(cod_revenue),
                'transfer': float(transfer_revenue),
                'paystack': float(paystack_revenue),
            },
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to generate sales report'}, 500


@admin_bp.route('/reports/products', methods=['GET'])
@admin_required
def products_report():
    try:
        top_by_qty = db.session.query(
            OrderItem.product_id,
            Product.name.label('product_name'),
            func.sum(OrderItem.quantity).label('total_qty'),
            func.sum(OrderItem.subtotal).label('total_revenue'),
        ).join(Product, OrderItem.product_id == Product.id
        ).group_by(OrderItem.product_id, Product.name
        ).order_by(func.sum(OrderItem.quantity).desc()
        ).limit(10).all()

        top_by_revenue = db.session.query(
            OrderItem.product_id,
            Product.name.label('product_name'),
            func.sum(OrderItem.quantity).label('total_qty'),
            func.sum(OrderItem.subtotal).label('total_revenue'),
        ).join(Product, OrderItem.product_id == Product.id
        ).group_by(OrderItem.product_id, Product.name
        ).order_by(func.sum(OrderItem.subtotal).desc()
        ).limit(10).all()

        return {
            'topByQuantity': [{
                'productId': r.product_id,
                'productName': r.product_name,
                'totalQuantity': int(r.total_qty),
                'totalRevenue': float(r.total_revenue),
            } for r in top_by_qty],
            'topByRevenue': [{
                'productId': r.product_id,
                'productName': r.product_name,
                'totalQuantity': int(r.total_qty),
                'totalRevenue': float(r.total_revenue),
            } for r in top_by_revenue],
        }
    except Exception:
        db.session.rollback()
        return {'error': 'Failed to generate products report'}, 500
