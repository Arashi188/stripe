from flask import Blueprint, request
from app.models import Product
from app.routes.admin import admin_required

products_bp = Blueprint('products', __name__)


@products_bp.route('', methods=['GET'])
def get_products():
    query = Product.query.filter_by(is_active=True)

    category_id = request.args.get('categoryId', type=int)
    if category_id:
        query = query.filter_by(category_id=category_id)

    min_price = request.args.get('minPrice', type=float)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    max_price = request.args.get('maxPrice', type=float)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    search = request.args.get('search', '').strip()
    if search:
        query = query.filter(
            Product.name.ilike(f'%{search}%') |
            Product.description.ilike(f'%{search}%')
        )

    products = query.order_by(Product.created_at.desc()).all()
    return [_product_json(p) for p in products]


@products_bp.route('/featured', methods=['GET'])
def get_featured():
    products = Product.query.filter_by(featured=True, is_active=True).all()
    return [_product_json(p) for p in products]


@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id, description='Product not found')
    return _product_json(product)


@products_bp.route('/category/<int:category_id>', methods=['GET'])
def get_by_category(category_id):
    products = Product.query.filter_by(category_id=category_id, is_active=True).all()
    return [_product_json(p) for p in products]


def _product_json(p):
    return {
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'price': p.price,
        'compareAtPrice': p.compare_at_price,
        'imageUrl': p.image_url,
        'imageUrl2': p.image_url_2,
        'imageUrl3': p.image_url_3,
        'stockQuantity': p.stock_quantity,
        'sku': p.sku,
        'brand': p.brand,
        'featured': p.featured,
        'rating': p.rating,
        'reviewCount': p.review_count,
        'category': {
            'id': p.category.id,
            'name': p.category.name,
        } if p.category else None,
        'createdAt': p.created_at.isoformat() if p.created_at else None,
    }
