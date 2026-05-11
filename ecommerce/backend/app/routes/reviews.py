from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Review, Product

reviews_bp = Blueprint('reviews', __name__)


@reviews_bp.route('/product/<int:product_id>', methods=['GET'])
def get_reviews(product_id):
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    return [{
        'id': r.id,
        'userId': r.user_id,
        'user': {
            'fullName': r.user.full_name,
        } if r.user else None,
        'rating': r.rating,
        'comment': r.comment or '',
        'createdAt': r.created_at.isoformat() if r.created_at else None,
    } for r in reviews]


@reviews_bp.route('', methods=['POST'])
@jwt_required()
def add_review():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    product_id = data.get('productId')
    rating = data.get('rating')
    comment = data.get('comment', '')

    if not product_id or not rating:
        return {'error': 'Product ID and rating are required'}, 400
    if rating < 1 or rating > 5:
        return {'error': 'Rating must be between 1 and 5'}, 400

    product = Product.query.get_or_404(product_id, description='Product not found')

    review = Review(
        user_id=user_id,
        product_id=product_id,
        rating=rating,
        comment=comment,
    )
    db.session.add(review)
    db.session.commit()

    # Update product rating
    all_reviews = Review.query.filter_by(product_id=product_id).all()
    avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
    product.rating = round(avg_rating, 1)
    product.review_count = len(all_reviews)
    db.session.commit()

    return {
        'id': review.id,
        'rating': review.rating,
        'comment': review.comment,
    }, 201
