from flask import Blueprint, request
from flask_jwt_extended import create_access_token
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    email = data.get('email', '').strip().lower()
    if User.query.filter_by(email=email).first():
        return {'error': 'Email already registered'}, 400

    if not email or not data.get('password'):
        return {'error': 'Email and password are required'}, 400

    user = User(
        email=email,
        password=generate_password_hash(data['password']),
        full_name=data.get('fullName', ''),
        phone=data.get('phone', ''),
        role='USER'
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'email': user.email}
    )

    return {
        'token': token,
        'userId': user.id,
        'email': user.email,
        'fullName': user.full_name,
        'role': user.role,
    }, 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return {'error': 'No data provided'}, 400

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return {'error': 'Invalid email or password'}, 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'email': user.email}
    )

    return {
        'token': token,
        'userId': user.id,
        'email': user.email,
        'fullName': user.full_name,
        'role': user.role,
    }
