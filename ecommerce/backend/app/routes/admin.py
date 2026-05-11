from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Product, Category, Order

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

    if 'name' in data:
        product.name = data['name']
    if 'description' in data:
        product.description = data['description']
    if 'price' in data:
        product.price = data['price']
    if 'compareAtPrice' in data:
        product.compare_at_price = data['compareAtPrice']
    if 'imageUrl' in data:
        product.image_url = data['imageUrl']
    if 'imageUrl2' in data:
        product.image_url_2 = data['imageUrl2']
    if 'imageUrl3' in data:
        product.image_url_3 = data['imageUrl3']
    if 'stockQuantity' in data:
        product.stock_quantity = data['stockQuantity']
    if 'sku' in data:
        product.sku = data['sku']
    if 'brand' in data:
        product.brand = data['brand']
    if 'featured' in data:
        product.featured = data['featured']
    if 'categoryId' in data:
        product.category_id = data['categoryId']

    db.session.commit()
    return {'message': 'Product updated successfully'}


@admin_bp.route('/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    product.is_active = False
    db.session.commit()
    return {'message': 'Product deleted'}


@admin_bp.route('/orders', methods=['GET'])
@admin_required
def get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return [_admin_order_json(o) for o in orders]


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


@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    return [{
        'id': u.id,
        'email': u.email,
        'fullName': u.full_name,
        'role': u.role,
        'createdAt': u.created_at.isoformat() if u.created_at else None,
    } for u in users]


def _admin_order_json(order):
    return {
        'id': order.id,
        'orderNumber': order.order_number,
        'user': {
            'id': order.user.id,
            'fullName': order.user.full_name,
            'email': order.user.email,
        } if order.user else None,
        'totalAmount': order.total_amount,
        'status': order.status,
        'paymentStatus': order.payment_status,
        'createdAt': order.created_at.isoformat() if order.created_at else None,
    }
