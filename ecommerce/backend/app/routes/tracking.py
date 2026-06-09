from flask import Blueprint
from app import db
from app.models import Order, DeliveryLocation

tracking_bp = Blueprint('tracking', __name__)


@tracking_bp.route('/<tracking_id>', methods=['GET'])
def get_tracking(tracking_id):
    order = Order.query.filter_by(tracking_id=tracking_id).first()
    if not order:
        return {'error': 'Tracking ID not found'}, 404

    loc = DeliveryLocation.query.filter_by(order_id=order.id)\
        .order_by(DeliveryLocation.timestamp.desc()).first()

    return {
        'orderNumber': order.order_number,
        'trackingId': order.tracking_id,
        'status': order.status,
        'paymentStatus': order.payment_status,
        'paymentMethod': order.payment_method,
        'totalAmount': order.total_amount,
        'shippingAddress': order.shipping_address,
        'shippingCity': order.shipping_city,
        'user': {'fullName': order.user.full_name, 'phone': order.user.phone},
        'deliveryMan': {
            'fullName': order.delivery_man.full_name,
            'phone': order.delivery_man.phone,
        } if order.delivery_man else None,
        'deliveryLocation': {
            'latitude': loc.latitude,
            'longitude': loc.longitude,
            'timestamp': loc.timestamp.isoformat(),
        } if loc else None,
        'orderItems': [{
            'productName': i.product_name,
            'quantity': i.quantity,
            'unitPrice': i.unit_price,
        } for i in order.order_items],
        'createdAt': order.created_at.isoformat(),
        'paidAt': order.paid_at.isoformat() if order.paid_at else None,
        'shippedAt': order.shipped_at.isoformat() if order.shipped_at else None,
        'deliveredAt': order.delivered_at.isoformat() if order.delivered_at else None,
    }
