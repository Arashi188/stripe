from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import User, Wishlist

users_bp = Blueprint('users', __name__)


@users_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    return {
        'id': user.id,
        'email': user.email,
        'fullName': user.full_name,
        'phone': user.phone or '',
        'address': user.address or '',
        'city': user.city or '',
        'state': user.state or '',
        'zipCode': user.zip_code or '',
        'country': user.country or '',
        'role': user.role,
        'createdAt': user.created_at.isoformat() if user.created_at else None,
    }


@users_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    if 'fullName' in data:
        user.full_name = data['fullName']
    if 'phone' in data:
        user.phone = data['phone']
    if 'address' in data:
        user.address = data['address']
    if 'city' in data:
        user.city = data['city']
    if 'state' in data:
        user.state = data['state']
    if 'zipCode' in data:
        user.zip_code = data['zipCode']
    if 'country' in data:
        user.country = data['country']

    db.session.commit()
    return {'message': 'Profile updated successfully'}


@users_bp.route('/wishlist', methods=['GET'])
@jwt_required()
def get_wishlist():
    user_id = int(get_jwt_identity())
    items = Wishlist.query.filter_by(user_id=user_id).all()
    return [{
        'id': item.id,
        'productId': item.product_id,
        'name': item.product.name,
        'price': item.product.price,
        'imageUrl': item.product.image_url,
        'rating': item.product.rating,
    } for item in items]


@users_bp.route('/wishlist/add/<int:product_id>', methods=['POST'])
@jwt_required()
def add_to_wishlist(product_id):
    user_id = int(get_jwt_identity())
    existing = Wishlist.query.filter_by(user_id=user_id, product_id=product_id).first()
    if existing:
        return {'error': 'Product already in wishlist'}, 400

    item = Wishlist(user_id=user_id, product_id=product_id)
    db.session.add(item)
    db.session.commit()
    return {'id': item.id, 'productId': item.product_id}, 201


@users_bp.route('/wishlist/remove/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_from_wishlist(product_id):
    user_id = int(get_jwt_identity())
    item = Wishlist.query.filter_by(user_id=user_id, product_id=product_id).first_or_404(
        description='Wishlist item not found'
    )
    db.session.delete(item)
    db.session.commit()
    return {'message': 'Removed from wishlist'}
