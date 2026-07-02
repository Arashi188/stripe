from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import ChatConversation, ChatMessage, User

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')


def chat_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role not in ('SECRETARY', 'DELIVERY_MAN'):
            return {'error': 'Chat access requires SECRETARY or DELIVERY_MAN role'}, 403
        return fn(*args, **kwargs)
    return wrapper


@chat_bp.route('/conversations', methods=['GET'])
@chat_required
def get_conversations():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role == 'SECRETARY':
        convs = ChatConversation.query.filter_by(secretary_id=user_id, is_active=True)\
            .order_by(ChatConversation.last_message_at.desc(), ChatConversation.created_at.desc()).all()
    else:
        convs = ChatConversation.query.filter_by(delivery_man_id=user_id, is_active=True)\
            .order_by(ChatConversation.last_message_at.desc(), ChatConversation.created_at.desc()).all()
    return jsonify([{
        'id': c.id,
        'order_id': c.order_id,
        'order_number': c.order.order_number if c.order else None,
        'other_user': {
            'id': c.delivery_man.id if user.role == 'SECRETARY' else c.secretary.id,
            'full_name': c.delivery_man.full_name if user.role == 'SECRETARY' else c.secretary.full_name,
        },
        'last_message_at': c.last_message_at.isoformat() if c.last_message_at else None,
        'is_active': c.is_active,
    } for c in convs])


@chat_bp.route('/conversations/<int:conv_id>/messages', methods=['GET'])
@chat_required
def get_messages(conv_id):
    user_id = int(get_jwt_identity())
    conv = ChatConversation.query.get_or_404(conv_id)
    if conv.secretary_id != user_id and conv.delivery_man_id != user_id:
        return {'error': 'Access denied'}, 403
    messages = ChatMessage.query.filter_by(conversation_id=conv_id)\
        .order_by(ChatMessage.created_at.asc()).all()

    unread_ids = [m.id for m in messages if m.receiver_id == user_id and not m.is_read]
    if unread_ids:
        ChatMessage.query.filter(ChatMessage.id.in_(unread_ids)).update(
            {'is_read': True}, synchronize_session='fetch'
        )
        db.session.commit()

    return jsonify([{
        'id': m.id,
        'sender_id': m.sender_id,
        'receiver_id': m.receiver_id,
        'message_text': m.message_text,
        'is_read': m.is_read,
        'created_at': m.created_at.isoformat() if m.created_at else None,
        'sender_name': m.sender.full_name if m.sender else None,
    } for m in messages])


@chat_bp.route('/conversations/<int:conv_id>/messages', methods=['POST'])
@chat_required
def send_message(conv_id):
    user_id = int(get_jwt_identity())
    conv = ChatConversation.query.get_or_404(conv_id)
    if conv.secretary_id != user_id and conv.delivery_man_id != user_id:
        return {'error': 'Access denied'}, 403

    data = request.get_json()
    text = data.get('message_text', '').strip()
    if not text:
        return {'error': 'Message text is required'}, 400

    receiver_id = conv.delivery_man_id if conv.secretary_id == user_id else conv.secretary_id

    msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=user_id,
        receiver_id=receiver_id,
        message_text=text,
    )
    conv.last_message_at = datetime.now(timezone.utc)
    db.session.add(msg)
    db.session.commit()

    return jsonify({
        'id': msg.id,
        'sender_id': msg.sender_id,
        'receiver_id': msg.receiver_id,
        'message_text': msg.message_text,
        'is_read': msg.is_read,
        'created_at': msg.created_at.isoformat() if msg.created_at else None,
        'sender_name': msg.sender.full_name if msg.sender else None,
    }), 201


@chat_bp.route('/unread-count', methods=['GET'])
@chat_required
def unread_count():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user.role == 'SECRETARY':
        convs = ChatConversation.query.filter_by(secretary_id=user_id).all()
    else:
        convs = ChatConversation.query.filter_by(delivery_man_id=user_id).all()
    conv_ids = [c.id for c in convs]
    if not conv_ids:
        return {'unread': 0}
    count = ChatMessage.query.filter(
        ChatMessage.conversation_id.in_(conv_ids),
        ChatMessage.receiver_id == user_id,
        ChatMessage.is_read == False
    ).count()
    return {'unread': count}
