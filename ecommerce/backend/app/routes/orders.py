import json
from datetime import datetime, timezone
import os
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Order, OrderItem, Product, User, Cart, Notification
from app.receipt_scanner import scan_receipt

orders_bp = Blueprint('orders', __name__)

ALLOWED_RECEIPT_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}
MAX_RECEIPT_SIZE = 5 * 1024 * 1024


def _get_receipt_folder():
    folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'uploads', 'receipts')
    os.makedirs(folder, exist_ok=True)
    return folder


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

    payment_method = data.get('paymentMethod', 'cod')
    if payment_method not in ('cod', 'transfer'):
        return {'error': 'Invalid payment method'}, 400

    order = Order(
        user_id=user_id,
        order_number=f"ORD-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        shipping_address=data.get('shippingAddress', ''),
        shipping_city=data.get('shippingCity', ''),
        shipping_state=data.get('shippingState', ''),
        shipping_zip_code=data.get('shippingZipCode', ''),
        shipping_country=data.get('shippingCountry', ''),
        shipping_phone=data.get('shippingPhone', ''),
        payment_method=payment_method,
        status='PROCESSING' if payment_method == 'cod' else 'PENDING',
        payment_status='UNPAID' if payment_method == 'cod' else 'PENDING',
    )
    if payment_method == 'cod':
        order.generate_tracking_id()
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

    Cart.query.filter_by(user_id=user_id).delete()

    # Notify secretaries about new transfer order
    if payment_method == 'transfer':
        secretaries = User.query.filter_by(role='SECRETARY').all()
        for sec in secretaries:
            db.session.add(Notification(
                user_id=sec.id,
                order_id=order.id,
                message=f'New transfer payment pending: Order #{order.order_number} - ₦{order.total_amount:.2f}',
                is_urgent=True,
            ))

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


@orders_bp.route('/<int:order_id>/upload-receipt', methods=['POST'])
@jwt_required()
def upload_receipt(order_id):
    user_id = int(get_jwt_identity())
    order = Order.query.get_or_404(order_id)
    if order.user_id != user_id:
        return {'error': 'Unauthorized'}, 403
    if order.payment_method != 'transfer':
        return {'error': 'Not a transfer order'}, 400
    if 'receipt' not in request.files:
        return {'error': 'No receipt file provided'}, 400
    file = request.files['receipt']
    if not file.filename:
        return {'error': 'No file selected'}, 400
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_RECEIPT_EXTENSIONS:
        return {'error': 'Invalid file type. Allowed: jpg, jpeg, png, pdf'}, 400
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_RECEIPT_SIZE:
        return {'error': 'File too large. Maximum size is 5MB'}, 400
    filename = secure_filename(f'{uuid.uuid4().hex}{ext}')
    receipt_folder = _get_receipt_folder()
    filepath = os.path.join(receipt_folder, filename)
    file.save(filepath)
    order.receipt_url = f'/uploads/receipts/{filename}'
    db.session.commit()
    scan_receipt(order, filepath)
    db.session.commit()
    scan_details = json.loads(order.receipt_scan_details) if order.receipt_scan_details else None
    return {
        'receiptUrl': order.receipt_url,
        'receiptScanStatus': order.receipt_scan_status,
        'receiptScanDetails': scan_details,
    }, 200


@orders_bp.route('/<int:order_id>/receipt', methods=['GET'])
@jwt_required()
def get_receipt(order_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role not in ('SECRETARY', 'ADMIN'):
        return {'error': 'Access denied'}, 403
    order = Order.query.get_or_404(order_id)
    if not order.receipt_url:
        return {'error': 'No receipt uploaded'}, 404
    filepath = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '..', '..', *order.receipt_url.strip('/').split('/')
    )
    if not os.path.exists(filepath):
        return {'error': 'Receipt file not found'}, 404
    return send_file(filepath)


@orders_bp.route('/<int:order_id>/scan-results', methods=['GET'])
@jwt_required()
def get_scan_results(order_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role not in ('SECRETARY', 'ADMIN'):
        return {'error': 'Access denied'}, 403
    order = Order.query.get_or_404(order_id)
    details = json.loads(order.receipt_scan_details) if order.receipt_scan_details else None
    return {
        'receipt_scan_status': order.receipt_scan_status,
        'receipt_scan_details': details,
        'order_id': order.id,
        'order_number': order.order_number,
        'total_amount': order.total_amount,
    }


def _order_json(order):
    return {
        'id': order.id,
        'orderNumber': order.order_number,
        'trackingId': order.tracking_id,
        'userId': order.user_id,
        'customerName': order.customer_name or (order.user.full_name if order.user else None),
        'customerEmail': order.customer_email or (order.user.email if order.user else None),
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
        'paymentMethod': order.payment_method,
        'deliveryMan': {
            'id': order.delivery_man.id,
            'fullName': order.delivery_man.full_name,
            'phone': order.delivery_man.phone,
        } if order.delivery_man else None,
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
        'paidAt': order.paid_at.isoformat() if order.paid_at else None,
        'receiptUrl': order.receipt_url,
        'receiptScanStatus': order.receipt_scan_status,
        'receiptScanDetails': json.loads(order.receipt_scan_details) if order.receipt_scan_details else None,
    }
