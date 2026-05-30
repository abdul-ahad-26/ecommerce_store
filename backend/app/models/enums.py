"""String enums used across models and schemas.

Stored as plain VARCHAR columns (not native Postgres enum types) to keep
Alembic migrations simple; the Python enums give us validation and a single
source of truth for allowed values.
"""

import enum


class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    cod = "COD"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
