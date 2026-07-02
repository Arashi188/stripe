from flask import Blueprint, request
from app import db
from app.models import Category

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return [{
        'id': c.id,
        'name': c.name,
        'description': c.description,
        'imageUrl': c.image_url,
        'backgroundImageUrl': c.background_image_url,
    } for c in categories]


@categories_bp.route('', methods=['POST'])
def create_category():
    data = request.get_json()
    if not data or not data.get('name'):
        return {'error': 'Category name is required'}, 400

    category = Category(
        name=data['name'],
        description=data.get('description', ''),
        image_url=data.get('imageUrl', ''),
        background_image_url=data.get('backgroundImageUrl', ''),
    )
    db.session.add(category)
    db.session.commit()
    return {
        'id': category.id,
        'name': category.name,
        'description': category.description,
        'imageUrl': category.image_url,
        'backgroundImageUrl': category.background_image_url,
    }, 201
