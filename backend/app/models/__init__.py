"""Import all models so they register on Base.metadata.

Alembic's autogenerate and the test suite rely on importing this package to
discover every table.
"""

from app.models.address import Address
from app.models.category import Category
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductImage, ProductVariant
from app.models.user import User

__all__ = [
    "Address",
    "Category",
    "Order",
    "OrderItem",
    "Product",
    "ProductImage",
    "ProductVariant",
    "User",
]
