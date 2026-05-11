from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Cart, Product

cart_bp = Blueprint('cart', __name__)


@cart_bp.route('', methods=['GET'])
@jwt_required()
def get_cart():
    user_id = int(get_jwt_identity())
    items = Cart.query.filter_by(user_id=user_id).all()
    return [{
        'id': item.id,
        'productId': item.product_id,
        'name': item.product.name,
        'price': item.product.price,
        'image': item.product.image_url,
        'quantity': item.quantity,
    } for item in items]


@cart_bp.route('/add', methods=['POST'])
@jwt_required()
def add_to_cart():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    product_id = data.get('productId')
    quantity = data.get('quantity', 1)

    product = Product.query.get_or_404(product_id, description='Product not found')
    if product.stock_quantity < quantity:
        return {'error': 'Insufficient stock'}, 400

    existing = Cart.query.filter_by(user_id=user_id, product_id=product_id).first()
    if existing:
        existing.quantity += quantity
        item = existing
    else:
        item = Cart(user_id=user_id, product_id=product_id, quantity=quantity)
        db.session.add(item)

    db.session.commit()
    return {
        'id': item.id,
        'productId': item.product_id,
        'quantity': item.quantity,
    }, 201


@cart_bp.route('/remove/<int:cart_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(cart_id):
    user_id = int(get_jwt_identity())
    item = Cart.query.get_or_404(cart_id, description='Cart item not found')
    if item.user_id != user_id:
        return {'error': 'Unauthorized'}, 403
    db.session.delete(item)
    db.session.commit()
    return {'message': 'Item removed from cart'}
