import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from app import create_app, db
from app.models import User, Category, Product, BankAccount
from werkzeug.security import generate_password_hash


def create_admin_if_not_exists():
    """Check if an admin user exists; if not, create one from env vars."""
    if User.query.filter_by(role='ADMIN').first():
        print('Admin already exists, skipping')
        return

    email = os.environ.get('ADMIN_EMAIL')
    password = os.environ.get('ADMIN_PASSWORD')
    name = os.environ.get('ADMIN_NAME')

    if not all([email, password, name]):
        print('ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME not all set. Skipping admin creation.')
        return

    admin = User(
        email=email,
        password=generate_password_hash(password),
        full_name=name,
        role='ADMIN',
    )
    db.session.add(admin)
    db.session.commit()
    print(f'Admin user created: {email}')


def seed_data():
    app = create_app()
    with app.app_context():
        db.create_all()

        if User.query.first():
            print('Database already seeded. Skipping.')
            return

        # Regular user
        user = User(
            email='user@example.com',
            password=generate_password_hash('user123'),
            full_name='John Doe',
            role='USER',
        )
        db.session.add(user)

        # Secretary
        secretary = User(
            email='secretary@shoppremium.com',
            password=generate_password_hash('secretary123'),
            full_name='Jane Secretary',
            phone='+2348012345678',
            role='SECRETARY',
        )
        db.session.add(secretary)

        # Delivery man
        delivery_man = User(
            email='delivery@shoppremium.com',
            password=generate_password_hash('delivery123'),
            full_name='James Driver',
            phone='+2348098765432',
            role='DELIVERY_MAN',
        )
        db.session.add(delivery_man)

        # Warehouse worker
        warehouse = User(
            email='warehouse@shoppremium.com',
            password=generate_password_hash('warehouse123'),
            full_name='Walter Packer',
            phone='+2348123456789',
            role='WAREHOUSE',
        )
        db.session.add(warehouse)

        # Categories
        categories_data = [
            ('Fashion', 'Trendy clothing and accessories',
             'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80'),
            ('Electronics', 'Latest gadgets and devices',
             'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80'),
            ('Home & Living', 'Beautiful home decor and essentials',
             'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80'),
            ('Accessories', 'Complete your look with accessories',
             'https://images.unsplash.com/photo-1601929994966-6c8f7e5f5b7a?w=400&q=80'),
        ]
        categories = []
        for name, desc, img in categories_data:
            c = Category(name=name, description=desc, image_url=img)
            db.session.add(c)
            categories.append(c)
        db.session.flush()

        # Products
        products_data = [
            ('Premium Cotton T-Shirt', 'Ultra-soft 100% organic cotton t-shirt with a modern fit.',
             29.99, 49.99, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
             150, 'TSH-001', 'PremiumWear', True, categories[0]),
            ('Slim Fit Jeans', 'Classic slim-fit jeans crafted from premium denim.',
             59.99, 89.99, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80',
             100, 'JNS-001', 'PremiumWear', True, categories[0]),
            ('Wool Blend Blazer', 'Sophisticated wool blend blazer for the modern professional.',
             149.99, 249.99, 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80',
             50, 'BLZ-001', 'EliteFashion', True, categories[0]),
            ('Wireless Headphones Pro', 'Premium over-ear headphones with active noise cancellation.',
             249.99, 399.99, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
             75, 'HP-001', 'SoundPro', True, categories[1]),
            ('Smart Watch Pro', 'Advanced smartwatch with health monitoring and GPS.',
             199.99, 299.99, 'https://images.unsplash.com/photo-1546868871-af0de0ae72ce?w=400&q=80',
             60, 'SW-001', 'TechGear', True, categories[1]),
            ('Bluetooth Speaker', 'Portable waterproof speaker with 360-degree sound.',
             79.99, 129.99, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80',
             120, 'SPK-001', 'SoundPro', True, categories[1]),
            ('4K Ultra HD Monitor', '27-inch 4K UHD monitor with HDR support.',
             449.99, 599.99, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80',
             30, 'MON-001', 'TechGear', True, categories[1]),
            ('Minimalist Desk Lamp', 'LED desk lamp with wireless charging base.',
             69.99, None, 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&q=80',
             90, 'LMP-001', 'HomeCraft', True, categories[2]),
            ('Scented Candle Set', 'Hand-poured soy wax candles. Set of 3.',
             34.99, 49.99, 'https://images.unsplash.com/photo-1602525962425-31af72a22da8?w=400&q=80',
             200, 'CND-001', 'HomeCraft', False, categories[2]),
            ('Luxury Throw Blanket', 'Ultra-soft microfiber throw blanket.',
             49.99, 79.99, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80',
             80, 'BLK-001', 'HomeCraft', True, categories[2]),
            ('Leather Crossbody Bag', 'Genuine leather crossbody bag with multiple compartments.',
             89.99, 149.99, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80',
             65, 'BAG-001', 'LuxeAccessories', True, categories[3]),
            ('Aviator Sunglasses', 'Classic aviator sunglasses with UV400 protection.',
             39.99, 69.99, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&q=80',
             150, 'SUN-001', 'LuxeAccessories', True, categories[3]),
            ('Silk Tie Collection', 'Hand-finished silk ties. Set of 2.',
             44.99, None, 'https://images.unsplash.com/photo-1589756823695-278bc923f962?w=400&q=80',
             100, 'TIE-001', 'EliteFashion', False, categories[3]),
            ('Stainless Steel Water Bottle', 'Double-walled vacuum insulated bottle.',
             24.99, 39.99, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80',
             250, 'BTL-001', 'HomeCraft', False, categories[2]),
            ('Mechanical Keyboard', 'RGB mechanical keyboard with Cherry MX switches.',
             129.99, 179.99, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80',
             45, 'KEY-001', 'TechGear', True, categories[1]),
        ]

        for name, desc, price, compare, img, stock, sku, brand, featured, cat in products_data:
            p = Product(
                name=name, description=desc, price=price, compare_at_price=compare,
                image_url=img, stock_quantity=stock, sku=sku, brand=brand,
                featured=featured, category_id=cat.id, rating=4.5, review_count=24,
            )
            db.session.add(p)

        # Bank accounts
        bank1 = BankAccount(
            bank_name='GTBank',
            account_number='0123456789',
            account_name='ShopPremium Ltd',
        )
        db.session.add(bank1)
        bank2 = BankAccount(
            bank_name='Access Bank',
            account_number='9876543210',
            account_name='ShopPremium Payments',
        )
        db.session.add(bank2)

        db.session.commit()
        print('Database seeded successfully!')
        print('User:         user@example.com / user123')
        print('Secretary:    secretary@shoppremium.com / secretary123')
        print('Delivery Man: delivery@shoppremium.com / delivery123')
        print('Warehouse:    warehouse@shoppremium.com / warehouse123')


if __name__ == '__main__':
    seed_data()
