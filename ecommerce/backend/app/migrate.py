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

    if 'payments' in inspector.get_table_names():
        _add_column_if_missing('payments', 'payment_method', "payment_method VARCHAR(30) DEFAULT 'cod'")
        _add_column_if_missing('payments', 'stripe_checkout_session_id', 'stripe_checkout_session_id VARCHAR(200)')
        _add_column_if_missing('payments', 'stripe_payment_intent_id', 'stripe_payment_intent_id VARCHAR(200)')
