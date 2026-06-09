from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Product, Category, Order, OrderItem, Cart, Wishlist, Review, Notification, BankAccount

admin_bp = Blueprint('admin', __name__)


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


# ── Dashboard ──

@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def get_dashboard():
    orders = Order.query.all()
    users = User.query.all()
    products = Product.query.all()
    revenue = sum(o.total_amount for o in orders if o.payment_status == 'PAID')
    return {
        'totalOrders': len(orders),
        'totalUsers': len(users),
        'totalProducts': len(products),
        'pendingOrders': len([o for o in orders if o.status == 'PENDING']),
        'revenue': revenue,
        'recentOrders': [_admin_order_json(o) for o in sorted(orders, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]],
    }


# ── Products ──

@admin_bp.route('/products', methods=['POST'])
@admin_required
def create_product():
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    product = Product(
        name=data.get('name', ''),
        description=data.get('description', ''),
        price=data.get('price', 0),
        compare_at_price=data.get('compareAtPrice'),
        image_url=data.get('imageUrl', ''),
        image_url_2=data.get('imageUrl2'),
        image_url_3=data.get('imageUrl3'),
        stock_quantity=data.get('stockQuantity', 0),
        sku=data.get('sku', ''),
        brand=data.get('brand', ''),
        featured=data.get('featured', False),
        category_id=data.get('categoryId'),
    )
    db.session.add(product)
    db.session.commit()
    return {'id': product.id, 'name': product.name}, 201


@admin_bp.route('/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    fields = {
        'name': 'name', 'description': 'description', 'price': 'price',
        'compareAtPrice': 'compare_at_price', 'imageUrl': 'image_url',
        'imageUrl2': 'image_url_2', 'imageUrl3': 'image_url_3',
        'stockQuantity': 'stock_quantity', 'sku': 'sku', 'brand': 'brand',
        'featured': 'featured', 'categoryId': 'category_id',
    }
    for json_key, attr in fields.items():
        if json_key in data:
            setattr(product, attr, data[json_key])

    db.session.commit()
    return {'message': 'Product updated successfully'}


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    Cart.query.filter_by(product_id=product_id).delete()
    Wishlist.query.filter_by(product_id=product_id).delete()
    Review.query.filter_by(product_id=product_id).delete()
    OrderItem.query.filter_by(product_id=product_id).update({OrderItem.product_id: None})
    db.session.delete(product)
    db.session.commit()
    return {'message': 'Product permanently deleted'}


# ── Categories ──

@admin_bp.route('/categories', methods=['GET'])
@admin_required
def get_categories():
    cats = Category.query.all()
    return [{
        'id': c.id, 'name': c.name, 'description': c.description,
        'imageUrl': c.image_url, 'productCount': len(c.products),
    } for c in cats]


@admin_bp.route('/categories', methods=['POST'])
@admin_required
def create_category():
    data = request.get_json()
    if not data or not data.get('name'):
        return {'error': 'Category name is required'}, 400
    cat = Category(name=data['name'], description=data.get('description', ''), image_url=data.get('imageUrl', ''))
    db.session.add(cat)
    db.session.commit()
    return {'id': cat.id, 'name': cat.name, 'description': cat.description, 'imageUrl': cat.image_url}, 201


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    cat = Category.query.get_or_404(category_id)
    data = request.get_json()
    if 'name' in data:
        cat.name = data['name']
    if 'description' in data:
        cat.description = data['description']
    if 'imageUrl' in data:
        cat.image_url = data['imageUrl']
    db.session.commit()
    return {'message': 'Category updated'}


@admin_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    cat = Category.query.get_or_404(category_id)
    Product.query.filter_by(category_id=category_id).update({Product.category_id: None})
    db.session.delete(cat)
    db.session.commit()
    return {'message': 'Category deleted'}


# ── Orders ──

@admin_bp.route('/orders', methods=['GET'])
@admin_required
def get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return [_admin_order_json(o) for o in orders]


@admin_bp.route('/orders/<int:order_id>', methods=['GET'])
@admin_required
def get_order_detail(order_id):
    order = Order.query.get_or_404(order_id)
    return _admin_order_detail_json(order)


@admin_bp.route('/orders/<int:order_id>/status', methods=['PATCH'])
@admin_required
def update_order_status(order_id):
    data = request.get_json()
    if not data or not data.get('status'):
        return {'error': 'Status is required'}, 400

    order = Order.query.get_or_404(order_id)
    status = data['status'].upper()
    order.status = status

    if status == 'PAID':
        order.paid_at = datetime.now(timezone.utc)
    elif status == 'SHIPPED':
        order.shipped_at = datetime.now(timezone.utc)
    elif status == 'DELIVERED':
        order.delivered_at = datetime.now(timezone.utc)

    db.session.commit()
    return _admin_order_json(order)


# ── Users ──

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    return [{
        'id': u.id, 'email': u.email, 'fullName': u.full_name,
        'role': u.role, 'createdAt': u.created_at.isoformat() if u.created_at else None,
    } for u in users]


# ── Staff Management ──

@admin_bp.route('/staff', methods=['POST'])
@admin_required
def create_staff():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('role'):
        return {'error': 'Email, password, and role required'}, 400
    role = data['role'].upper()
    if role not in ('SECRETARY', 'DELIVERY_MAN'):
        return {'error': 'Role must be SECRETARY or DELIVERY_MAN'}, 400
    if User.query.filter_by(email=data['email']).first():
        return {'error': 'Email already exists'}, 400
    user = User(
        email=data['email'],
        full_name=data.get('fullName', ''),
        phone=data.get('phone', ''),
        role=role,
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return {
        'id': user.id, 'email': user.email, 'fullName': user.full_name,
        'role': user.role, 'phone': user.phone,
    }, 201


@admin_bp.route('/staff/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_staff(user_id):
    user = User.query.get_or_404(user_id)
    if user.role not in ('SECRETARY', 'DELIVERY_MAN'):
        return {'error': 'Not a staff member'}, 400
    db.session.delete(user)
    db.session.commit()
    return {'message': f'{user.role} deleted'}


@admin_bp.route('/staff', methods=['GET'])
@admin_required
def list_staff():
    staff = User.query.filter(User.role.in_(['SECRETARY', 'DELIVERY_MAN'])).all()
    return [{
        'id': u.id, 'email': u.email, 'fullName': u.full_name,
        'phone': u.phone, 'role': u.role,
        'createdAt': u.created_at.isoformat() if u.created_at else None,
    } for u in staff]


@admin_bp.route('/users/<int:user_id>/role', methods=['PATCH'])
@admin_required
def change_role(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    role = data.get('role', '').upper() if data else ''
    if role not in ('USER', 'SECRETARY', 'DELIVERY_MAN', 'ADMIN'):
        return {'error': 'Invalid role'}, 400
    user.role = role
    db.session.commit()
    return {'message': f'Role changed to {role}'}


# ── Bank Accounts ──

@admin_bp.route('/bank-accounts', methods=['POST'])
@admin_required
def create_bank_account():
    data = request.get_json()
    if not data or not data.get('bankName') or not data.get('accountNumber'):
        return {'error': 'Bank name and account number required'}, 400
    account = BankAccount(
        bank_name=data['bankName'],
        account_number=data['accountNumber'],
        account_name=data.get('accountName', ''),
    )
    db.session.add(account)
    db.session.commit()
    return {
        'id': account.id, 'bankName': account.bank_name,
        'accountNumber': account.account_number,
        'accountName': account.account_name,
    }, 201


@admin_bp.route('/bank-accounts/<int:account_id>', methods=['PUT'])
@admin_required
def update_bank_account(account_id):
    account = BankAccount.query.get_or_404(account_id)
    data = request.get_json()
    if data:
        if 'bankName' in data:
            account.bank_name = data['bankName']
        if 'accountNumber' in data:
            account.account_number = data['accountNumber']
        if 'accountName' in data:
            account.account_name = data['accountName']
        if 'isActive' in data:
            account.is_active = data['isActive']
    db.session.commit()
    return {'message': 'Bank account updated'}


@admin_bp.route('/bank-accounts/<int:account_id>', methods=['DELETE'])
@admin_required
def delete_bank_account(account_id):
    account = BankAccount.query.get_or_404(account_id)
    db.session.delete(account)
    db.session.commit()
    return {'message': 'Bank account deleted'}


@admin_bp.route('/bank-accounts', methods=['GET'])
@admin_required
def list_bank_accounts():
    accounts = BankAccount.query.all()
    return [{
        'id': a.id, 'bankName': a.bank_name,
        'accountNumber': a.account_number,
        'accountName': a.account_name,
        'isActive': a.is_active,
    } for a in accounts]


# ── Notifications ──

@admin_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role not in ('SECRETARY', 'ADMIN'):
        return {'error': 'Access denied'}, 403
    notifs = Notification.query.filter_by(user_id=user_id, is_read=False)\
        .order_by(Notification.created_at.desc()).all()
    return [{
        'id': n.id,
        'message': n.message,
        'orderId': n.order_id,
        'isUrgent': n.is_urgent,
        'createdAt': n.created_at.isoformat(),
    } for n in notifs]


@admin_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    notif.is_read = True
    db.session.commit()
    return {'status': 'success'}


@admin_bp.route('/notifications/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return {'status': 'success'}


# ── Helpers ──

def _admin_order_json(order):
    return {
        'id': order.id, 'orderNumber': order.order_number,
        'user': {'id': order.user.id, 'fullName': order.user.full_name, 'email': order.user.email} if order.user else None,
        'totalAmount': order.total_amount, 'status': order.status,
        'paymentStatus': order.payment_status,
        'paymentMethod': order.payment_method,
        'receiptUrl': order.receipt_url,
        'deliveryMan': {
            'id': order.delivery_man.id,
            'fullName': order.delivery_man.full_name,
        } if order.delivery_man else None,
        'createdAt': order.created_at.isoformat() if order.created_at else None,
    }


def _admin_order_detail_json(order):
    return {
        'id': order.id, 'orderNumber': order.order_number,
        'user': {'id': order.user.id, 'fullName': order.user.full_name, 'email': order.user.email} if order.user else None,
        'totalAmount': order.total_amount, 'subtotal': order.subtotal,
        'shippingCost': order.shipping_cost, 'tax': order.tax,
        'status': order.status, 'paymentStatus': order.payment_status,
        'paymentMethod': order.payment_method,
        'receiptUrl': order.receipt_url,
        'deliveryMan': {
            'id': order.delivery_man.id,
            'fullName': order.delivery_man.full_name,
        } if order.delivery_man else None,
        'shippingAddress': order.shipping_address, 'shippingCity': order.shipping_city,
        'shippingState': order.shipping_state, 'shippingCountry': order.shipping_country,
        'shippingPhone': order.shipping_phone,
        'createdAt': order.created_at.isoformat() if order.created_at else None,
        'items': [{
            'productName': i.product_name, 'productImage': i.product_image,
            'quantity': i.quantity, 'unitPrice': i.unit_price, 'subtotal': i.subtotal,
        } for i in order.order_items],
    }
