from flask import Blueprint, request, current_app
import stripe
from app import db
from app.models import Order, Payment

payments_bp = Blueprint('payments', __name__)


@payments_bp.route('/initialize', methods=['POST'])
def initialize_payment():
    data = request.get_json()
    if not data or not data.get('orderId'):
        return {'error': 'Order ID is required'}, 400

    order = Order.query.get_or_404(data['orderId'])
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']

    try:
        intent = stripe.PaymentIntent.create(
            amount=int(order.total_amount * 100),
            currency='usd',
            metadata={
                'order_id': order.id,
                'order_number': order.order_number,
            },
        )

        payment = Payment(
            order_id=order.id,
            stripe_payment_intent_id=intent.id,
            stripe_client_secret=intent.client_secret,
            amount=order.total_amount,
            currency='usd',
            status='PENDING',
        )
        db.session.add(payment)
        db.session.commit()

        return {
            'clientSecret': intent.client_secret,
            'paymentIntentId': intent.id,
            'amount': order.total_amount,
        }
    except stripe.error.StripeError as e:
        return {'error': str(e)}, 400


@payments_bp.route('/verify', methods=['POST'])
def verify_payment():
    data = request.get_json()
    if not data or not data.get('paymentIntentId'):
        return {'error': 'Payment intent ID is required'}, 400

    payment = Payment.query.filter_by(
        stripe_payment_intent_id=data['paymentIntentId']
    ).first_or_404(description='Payment not found')

    payment.status = 'SUCCEEDED'
    order = payment.order
    order.payment_status = 'PAID'
    order.status = 'PAID'
    from datetime import datetime, timezone
    order.paid_at = datetime.now(timezone.utc)
    db.session.commit()

    return {
        'status': 'success',
        'message': 'Payment confirmed successfully',
    }
