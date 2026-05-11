import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from config import config_by_name

db = SQLAlchemy()
jwt = JWTManager()


def create_app(config_name='development'):
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'uploads')
    app.config['UPLOAD_FOLDER'] = upload_dir
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    os.makedirs(upload_dir, exist_ok=True)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    jwt.init_app(app)

    from app.routes.auth import auth_bp
    from app.routes.products import products_bp
    from app.routes.categories import categories_bp
    from app.routes.cart import cart_bp
    from app.routes.orders import orders_bp
    from app.routes.payments import payments_bp
    from app.routes.users import users_bp
    from app.routes.reviews import reviews_bp
    from app.routes.admin import admin_bp
    from app.routes.upload import upload_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')
    app.register_blueprint(cart_bp, url_prefix='/api/cart')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(payments_bp, url_prefix='/api/payment')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(reviews_bp, url_prefix='/api/reviews')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Resource not found'}, 404

    @app.errorhandler(500)
    def server_error(e):
        return {'error': 'Internal server error'}, 500

    return app
