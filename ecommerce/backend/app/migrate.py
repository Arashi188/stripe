"""Lightweight SQLite/PostgreSQL column migrations for existing databases."""
from sqlalchemy import inspect, text

from app import db


def _table_columns(table_name):
    return {c['name'] for c in inspect(db.engine).get_columns(table_name)}


def _add_column_if_missing(table_name, column_name, column_ddl):
    if column_name in _table_columns(table_name):
        return
    db.session.execute(text(f'ALTER TABLE {table_name} ADD COLUMN {column_ddl}'))
    db.session.commit()


def run_migrations():
    """Add columns introduced after initial deploy without dropping data."""
    inspector = inspect(db.engine)
    if 'orders' not in inspector.get_table_names():
        db.create_all()
        return

    _add_column_if_missing('orders', 'customer_name', 'customer_name VARCHAR(100)')
    _add_column_if_missing('orders', 'customer_email', 'customer_email VARCHAR(120)')
    _add_column_if_missing('orders', 'receipt_url', 'receipt_url VARCHAR(500)')
    _add_column_if_missing('orders', 'receipt_scan_status', 'receipt_scan_status VARCHAR(20)')
    _add_column_if_missing('orders', 'receipt_scan_details', 'receipt_scan_details TEXT')

    _add_column_if_missing('categories', 'background_image_url', 'background_image_url VARCHAR(500)')

    if 'warehouse_tasks' not in inspector.get_table_names():
        db.session.execute(text('CREATE TABLE warehouse_tasks (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), sent_by INTEGER NOT NULL REFERENCES users(id), status VARCHAR(20) DEFAULT \'PENDING\', items_summary TEXT, notes TEXT, created_at TIMESTAMP, packed_at TIMESTAMP)'))
        db.session.commit()

    if 'chat_conversations' not in inspector.get_table_names():
        db.session.execute(text('CREATE TABLE chat_conversations (id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), secretary_id INTEGER NOT NULL REFERENCES users(id), delivery_man_id INTEGER NOT NULL REFERENCES users(id), last_message_at TIMESTAMP, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP)'))
        db.session.commit()

    if 'chat_messages' not in inspector.get_table_names():
        db.session.execute(text('CREATE TABLE chat_messages (id SERIAL PRIMARY KEY, conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id), sender_id INTEGER NOT NULL REFERENCES users(id), receiver_id INTEGER NOT NULL REFERENCES users(id), message_text TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP)'))
        db.session.commit()

    if 'payments' in inspector.get_table_names():
        _add_column_if_missing('payments', 'payment_method', "payment_method VARCHAR(30) DEFAULT 'cod'")
        _add_column_if_missing('payments', 'stripe_checkout_session_id', 'stripe_checkout_session_id VARCHAR(200)')
        _add_column_if_missing('payments', 'stripe_payment_intent_id', 'stripe_payment_intent_id VARCHAR(200)')
