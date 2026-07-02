from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Order, DeliveryLocation, User, Notification

delivery_bp = Blueprint('delivery', __name__)


def delivery_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role != 'DELIVERY_MAN':
            return {'error': 'Delivery man access required'}, 403
        return fn(*args, **kwargs)
    return wrapper


@delivery_bp.route('/orders', methods=['GET'])
@delivery_required
def my_orders():
    user_id = int(get_jwt_identity())
    orders = Order.query.filter_by(delivery_man_id=user_id)\
        .order_by(Order.created_at.desc()).all()
    return [{
        'id': o.id,
        'orderNumber': o.order_number,
        'trackingId': o.tracking_id,
        'user': {'fullName': o.user.full_name, 'phone': o.user.phone},
        'shippingAddress': o.shipping_address,
        'shippingCity': o.shipping_city,
        'shippingState': o.shipping_state,
        'shippingPhone': o.shipping_phone,
        'totalAmount': o.total_amount,
        'status': o.status,
        'paymentMethod': o.payment_method,
        'orderItems': [{
            'productName': i.product_name,
            'quantity': i.quantity,
            'unitPrice': i.unit_price,
        } for i in o.order_items],
        'createdAt': o.created_at.isoformat(),
    } for o in orders]


@delivery_bp.route('/location', methods=['POST'])
@delivery_required
def update_location():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or data.get('latitude') is None or data.get('longitude') is None:
        return {'error': 'Latitude and longitude required'}, 400
    order_id = data.get('orderId')
    if not order_id:
        return {'error': 'Order ID required'}, 400
    loc = DeliveryLocation(
        delivery_man_id=user_id,
        order_id=order_id,
        latitude=float(data['latitude']),
        longitude=float(data['longitude']),
    )
    db.session.add(loc)
    db.session.commit()
    return {'status': 'success'}


@delivery_bp.route('/location/<int:order_id>', methods=['GET'])
@delivery_required
def get_location(order_id):
    loc = DeliveryLocation.query.filter_by(order_id=order_id)\
        .order_by(DeliveryLocation.timestamp.desc()).first()
    if not loc:
        return {'latitude': None, 'longitude': None, 'timestamp': None}
    return {
        'latitude': loc.latitude,
        'longitude': loc.longitude,
        'timestamp': loc.timestamp.isoformat(),
        'deliveryManName': loc.delivery_man.full_name if loc.delivery_man else None,
    }


@delivery_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@delivery_required
def update_status(order_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    status = data.get('status') if data else None
    if status not in ('SHIPPED', 'DELIVERED'):
        return {'error': 'Invalid status'}, 400
    order = Order.query.get_or_404(order_id)
    if order.delivery_man_id != user_id:
        return {'error': 'Not your order'}, 403
    order.status = status
    if status == 'DELIVERED':
        order.delivered_at = datetime.now(timezone.utc)
        order.payment_status = 'PAID'
    db.session.commit()
    return {'status': 'success', 'message': f'Order {status.lower()}'}
