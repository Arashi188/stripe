from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Order, User, Notification, BankAccount, WarehouseTask, ChatConversation, ChatMessage

secretary_bp = Blueprint('secretary', __name__)


def secretary_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role != 'SECRETARY':
            return {'error': 'Secretary access required'}, 403
        return fn(*args, **kwargs)
    return wrapper


@secretary_bp.route('/dashboard', methods=['GET'])
@secretary_required
def dashboard():
    pending_transfers = Order.query.filter_by(
        payment_method='transfer', payment_status='PENDING', status='PENDING'
    ).order_by(Order.created_at.desc()).all()

    recent_orders = Order.query.filter(
        Order.payment_status != 'UNPAID'
    ).order_by(Order.created_at.desc()).limit(20).all()

    approved_today = Order.query.filter(
        Order.payment_status == 'PAID',
        db.func.date(Order.paid_at) == db.func.date('now')
    ).count()

    return {
        'pendingTransfers': [{
            'id': o.id,
            'orderNumber': o.order_number,
            'user': {'fullName': o.user.full_name, 'email': o.user.email, 'phone': o.user.phone},
            'totalAmount': o.total_amount,
            'createdAt': o.created_at.isoformat(),
            'trackingId': o.tracking_id,
            'receiptUrl': o.receipt_url,
            'receiptScanStatus': o.receipt_scan_status,
            'shippingAddress': o.shipping_address,
            'shippingCity': o.shipping_city,
            'orderItems': [{
                'productName': i.product_name,
                'quantity': i.quantity,
                'unitPrice': i.unit_price,
            } for i in o.order_items],
        } for o in pending_transfers],
        'recentOrders': [{
            'id': o.id,
            'orderNumber': o.order_number,
            'user': {'fullName': o.user.full_name, 'email': o.user.email},
            'totalAmount': o.total_amount,
            'paymentMethod': o.payment_method,
            'paymentStatus': o.payment_status,
            'status': o.status,
            'trackingId': o.tracking_id,
            'receiptUrl': o.receipt_url,
            'deliveryManId': o.delivery_man_id,
            'createdAt': o.created_at.isoformat(),
        } for o in recent_orders],
        'approvedToday': approved_today,
        'pendingCount': len(pending_transfers),
    }


@secretary_bp.route('/approve-payment/<int:order_id>', methods=['POST'])
@secretary_required
def approve_payment(order_id):
    order = Order.query.get_or_404(order_id)
    if order.payment_method != 'transfer':
        return {'error': 'Not a transfer order'}, 400
    if not order.receipt_url:
        return {'error': 'Cannot approve order without a receipt'}, 400
    order.payment_status = 'PAID'
    order.status = 'PROCESSING'
    order.paid_at = datetime.now(timezone.utc)
    if not order.tracking_id:
        order.generate_tracking_id()
    db.session.commit()
    return {
        'status': 'success',
        'message': 'Payment approved',
        'trackingId': order.tracking_id,
        'orderNumber': order.order_number,
        'orderId': order.id,
    }


@secretary_bp.route('/assign-delivery/<int:order_id>', methods=['POST'])
@secretary_required
def assign_delivery(order_id):
    data = request.get_json()
    delivery_man_id = data.get('deliveryManId') if data else None
    if not delivery_man_id:
        return {'error': 'Delivery man ID required'}, 400
    delivery_man = User.query.get(delivery_man_id)
    if not delivery_man or delivery_man.role != 'DELIVERY_MAN':
        return {'error': 'Invalid delivery man'}, 400
    order = Order.query.get_or_404(order_id)
    order.delivery_man_id = delivery_man_id
    order.status = 'SHIPPED'
    order.shipped_at = datetime.now(timezone.utc)
    if order.payment_method == 'transfer' and order.payment_status == 'PENDING':
        order.payment_status = 'PAID'
        order.paid_at = datetime.now(timezone.utc)
    if not order.tracking_id:
        order.generate_tracking_id()

    secretary_id = int(get_jwt_identity())

    existing_conv = ChatConversation.query.filter_by(
        order_id=order.id, delivery_man_id=delivery_man_id
    ).first()
    if not existing_conv:
        conv = ChatConversation(
            order_id=order.id,
            secretary_id=secretary_id,
            delivery_man_id=delivery_man_id,
        )
        db.session.add(conv)

    db.session.commit()
    Notification(
        user_id=delivery_man_id,
        order_id=order.id,
        message=f'New delivery assigned: Order #{order.order_number}',
        is_urgent=True,
    )
    db.session.commit()
    return {'status': 'success', 'message': f'Assigned to {delivery_man.full_name}', 'trackingId': order.tracking_id}


@secretary_bp.route('/delivery-men', methods=['GET'])
@secretary_required
def list_delivery_men():
    men = User.query.filter_by(role='DELIVERY_MAN').all()
    return [{'id': m.id, 'fullName': m.full_name, 'phone': m.phone, 'email': m.email} for m in men]


@secretary_bp.route('/send-to-warehouse', methods=['POST'])
@secretary_required
def send_to_warehouse():
    data = request.get_json()
    order_id = data.get('orderId')
    notes = data.get('notes', '')
    if not order_id:
        return {'error': 'Order ID required'}, 400
    order = Order.query.get_or_404(order_id)
    existing_task = WarehouseTask.query.filter_by(order_id=order_id, status='PENDING').first()
    if existing_task:
        return {'error': 'Order already sent to warehouse'}, 400
    items_summary = '; '.join([f'{i.product_name} x{i.quantity}' for i in order.order_items])
    task = WarehouseTask(
        order_id=order.id,
        sent_by=int(get_jwt_identity()),
        items_summary=items_summary,
        notes=notes,
    )
    db.session.add(task)
    if order.status == 'PROCESSING':
        order.status = 'IN_WAREHOUSE'
    db.session.commit()
    return {'message': 'Order sent to warehouse', 'task_id': task.id}


@secretary_bp.route('/notifications', methods=['GET'])
@secretary_required
def get_notifications():
    user_id = int(get_jwt_identity())
    notifs = Notification.query.filter_by(user_id=user_id, is_read=False)\
        .order_by(Notification.created_at.desc()).all()
    return [{
        'id': n.id,
        'message': n.message,
        'orderId': n.order_id,
        'isUrgent': n.is_urgent,
        'createdAt': n.created_at.isoformat(),
    } for n in notifs]


@secretary_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@secretary_required
def mark_notification_read(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    notif.is_read = True
    db.session.commit()
    return {'status': 'success'}


@secretary_bp.route('/notifications/read-all', methods=['POST'])
@secretary_required
def mark_all_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(user_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()
    return {'status': 'success'}


@secretary_bp.route('/bank-accounts', methods=['GET'])
def bank_accounts():
    accounts = BankAccount.query.filter_by(is_active=True).all()
    return [{
        'id': a.id,
        'bankName': a.bank_name,
        'accountNumber': a.account_number,
        'accountName': a.account_name,
    } for a in accounts]
