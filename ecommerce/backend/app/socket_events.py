from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app import db
from app.models import User, ChatMessage, ChatConversation
from datetime import datetime, timezone


def register_socket_handlers(socketio):

    @socketio.on('connect')
    def on_connect():
        token = request.args.get('token')
        if not token:
            return False
        try:
            data = decode_token(token)
            user_id = data['sub']
            user = User.query.get(int(user_id))
            if not user:
                return False
            join_room(f'user_{user_id}')
            return True
        except Exception:
            return False

    @socketio.on('disconnect')
    def on_disconnect():
        pass

    @socketio.on('join_conversation')
    def handle_join_conv(data):
        conv_id = data.get('conversation_id')
        if conv_id:
            join_room(f'conv_{conv_id}')

    @socketio.on('leave_conversation')
    def handle_leave_conv(data):
        conv_id = data.get('conversation_id')
        if conv_id:
            leave_room(f'conv_{conv_id}')

    @socketio.on('send_message')
    def handle_send_message(data):
        token = request.args.get('token')
        if not token:
            return
        try:
            token_data = decode_token(token)
            user_id = int(token_data['sub'])
        except Exception:
            return

        conv_id = data.get('conversation_id')
        text = data.get('message_text', '').strip()
        if not conv_id or not text:
            return

        conv = ChatConversation.query.get(conv_id)
        if not conv:
            return
        if conv.secretary_id != user_id and conv.delivery_man_id != user_id:
            return

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

        msg_data = {
            'id': msg.id,
            'sender_id': msg.sender_id,
            'receiver_id': msg.receiver_id,
            'message_text': msg.message_text,
            'is_read': msg.is_read,
            'created_at': msg.created_at.isoformat() if msg.created_at else None,
            'sender_name': msg.sender.full_name if msg.sender else None,
        }

        emit('new_message', msg_data, room=f'conv_{conv_id}')
        emit('unread_update', {'conversation_id': conv_id}, room=f'user_{receiver_id}')
