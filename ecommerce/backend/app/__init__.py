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

    CORS(app, origins=[
        'https://stripe-two-dun.vercel.app',
        'http://127.0.0.1:5500',
        'http://localhost:5500'
    ])
    db.init_app(app)
    jwt.init_app(app)

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'error': 'Session expired. Please log in again.'}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {'error': 'Invalid session. Please log in again.'}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {'error': 'Login required.'}, 401

    from app.routes.auth import auth_bp
    from app.routes.products import products_bp
    from app.routes.categories import categories_bp
    from app.routes.cart import cart_bp
    from app.routes.orders import orders_bp
    from app.routes.users import users_bp
    from app.routes.reviews import reviews_bp
    from app.routes.admin import admin_bp
    from app.routes.upload import upload_bp
    from app.routes.secretary import secretary_bp
    from app.routes.delivery import delivery_bp
    from app.routes.tracking import tracking_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(categories_bp, url_prefix='/api/categories')
    app.register_blueprint(cart_bp, url_prefix='/api/cart')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(secretary_bp, url_prefix='/api/secretary')
    app.register_blueprint(delivery_bp, url_prefix='/api/delivery')
    app.register_blueprint(tracking_bp, url_prefix='/api/tracking')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(reviews_bp, url_prefix='/api/reviews')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(upload_bp, url_prefix='/api/upload')

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    @app.route('/favicon.ico')
    def favicon():
        return send_from_directory(os.path.join(app.root_path, '..', '..', 'frontend'), 'favicon.svg', mimetype='image/svg+xml')

    @app.errorhandler(404)
    def not_found(e):
        return {'error': 'Resource not found'}, 404

    @app.errorhandler(500)
    def server_error(e):
        return {'error': 'Internal server error'}, 500

    with app.app_context():
        db.create_all()
        from app.migrate import run_migrations
        run_migrations()

        from app.seed import create_admin_if_not_exists
        create_admin_if_not_exists()

    return app
