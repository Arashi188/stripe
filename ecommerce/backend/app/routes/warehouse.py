from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Order, OrderItem, Product, WarehouseTask, User

warehouse_bp = Blueprint('warehouse', __name__, url_prefix='/api/warehouse')


def warehouse_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role != 'WAREHOUSE':
            return {'error': 'Warehouse access required'}, 403
        return fn(*args, **kwargs)
    return wrapper


def warehouse_or_secretary_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role not in ('WAREHOUSE', 'SECRETARY'):
            return {'error': 'Warehouse or Secretary access required'}, 403
        return fn(*args, **kwargs)
    return wrapper


@warehouse_bp.route('/tasks', methods=['GET'])
@warehouse_or_secretary_required
def get_tasks():
    status_filter = request.args.get('status')
    query = WarehouseTask.query.order_by(WarehouseTask.created_at.desc())
    if status_filter:
        query = query.filter_by(status=status_filter.upper())
    tasks = query.all()
    return jsonify([{
        'id': t.id,
        'order_id': t.order_id,
        'order_number': t.order.order_number if t.order else None,
        'sent_by': t.sent_by,
        'sender_name': t.sender.full_name if t.sender else 'Unknown',
        'status': t.status,
        'items_summary': t.items_summary,
        'notes': t.notes,
        'created_at': t.created_at.isoformat() if t.created_at else None,
        'packed_at': t.packed_at.isoformat() if t.packed_at else None
    } for t in tasks])


@warehouse_bp.route('/tasks/<int:task_id>/pack', methods=['POST'])
@warehouse_required
def mark_packed(task_id):
    task = WarehouseTask.query.get_or_404(task_id)
    if task.status != 'PENDING':
        return jsonify({'error': 'Task is not pending'}), 400
    task.status = 'PACKED'
    task.packed_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'message': 'Task marked as packed', 'task_id': task.id})


@warehouse_bp.route('/tasks/<int:task_id>/unpack', methods=['POST'])
@warehouse_required
def undo_pack(task_id):
    task = WarehouseTask.query.get_or_404(task_id)
    if task.status != 'PACKED':
        return jsonify({'error': 'Task is not packed'}), 400
    task.status = 'PENDING'
    task.packed_at = None
    db.session.commit()
    return jsonify({'message': 'Task reverted to pending', 'task_id': task.id})


@warehouse_bp.route('/order-detail/<int:order_id>', methods=['GET'])
@warehouse_or_secretary_required
def get_order_detail(order_id):
    order = Order.query.get_or_404(order_id)
    items = OrderItem.query.filter_by(order_id=order_id).all()
    return jsonify({
        'id': order.id,
        'order_number': order.order_number,
        'status': order.status,
        'items': [{
            'id': item.id,
            'product_name': item.product.name if item.product else 'Unknown',
            'product_image': item.product.image_url if item.product else None,
            'quantity': item.quantity,
            'price': float(item.price)
        } for item in items]
    })
