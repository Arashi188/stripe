from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Order, OrderItem, Product, User

orders_bp = Blueprint('orders', __name__)


@orders_bp.route('/create', methods=['POST'])
@jwt_required()
def create_order():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    user = User.query.get(user_id)
    items_data = data.get('items', [])
    if not items_data:
        return {'error': 'No items in order'}, 400

    order = Order(
        user_id=user_id,
        order_number=f"ORD-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        shipping_address=data.get('shippingAddress', ''),
        shipping_city=data.get('shippingCity', ''),
        shipping_state=data.get('shippingState', ''),
        shipping_zip_code=data.get('shippingZipCode', ''),
        shipping_country=data.get('shippingCountry', ''),
        shipping_phone=data.get('shippingPhone', ''),
        status='PENDING',
        payment_status='UNPAID',
    )
    db.session.add(order)
    db.session.flush()

    subtotal = 0.0
    for item_data in items_data:
        product = Product.query.get_or_404(item_data['productId'])
        qty = item_data.get('quantity', 1)

        if product.stock_quantity < qty:
            return {'error': f'Insufficient stock for {product.name}'}, 400

        product.stock_quantity -= qty

        item_subtotal = product.price * qty
        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            product_image=product.image_url,
            quantity=qty,
            unit_price=product.price,
            subtotal=item_subtotal,
        )
        db.session.add(order_item)
        subtotal += item_subtotal

    order.subtotal = subtotal
    order.shipping_cost = 0.0 if subtotal > 100 else 10.0
    order.tax = subtotal * 0.08
    order.total_amount = subtotal + order.shipping_cost + order.tax

    # Clear user's cart
    from app.models import Cart
    Cart.query.filter_by(user_id=user_id).delete()

    db.session.commit()

    return _order_json(order), 201


@orders_bp.route('/history', methods=['GET'])
@jwt_required()
def order_history():
    user_id = int(get_jwt_identity())
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return [_order_json(o) for o in orders]


@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)
    if order.user_id != user_id:
        user = User.query.get(user_id)
        if user.role != 'ADMIN':
            return {'error': 'Unauthorized'}, 403
    return _order_json(order)


def _order_json(order):
    return {
        'id': order.id,
        'orderNumber': order.order_number,
        'userId': order.user_id,
        'user': {
            'id': order.user.id,
            'fullName': order.user.full_name,
            'email': order.user.email,
        } if order.user else None,
        'shippingAddress': order.shipping_address,
        'shippingCity': order.shipping_city,
        'shippingState': order.shipping_state,
        'shippingZipCode': order.shipping_zip_code,
        'shippingCountry': order.shipping_country,
        'shippingPhone': order.shipping_phone,
        'subtotal': order.subtotal,
        'shippingCost': order.shipping_cost,
        'tax': order.tax,
        'totalAmount': order.total_amount,
        'status': order.status,
        'paymentStatus': order.payment_status,
        'orderItems': [{
            'id': item.id,
            'productId': item.product_id,
            'productName': item.product_name,
            'productImage': item.product_image,
            'quantity': item.quantity,
            'unitPrice': item.unit_price,
            'subtotal': item.subtotal,
        } for item in order.order_items],
        'createdAt': order.created_at.isoformat() if order.created_at else None,
    }
