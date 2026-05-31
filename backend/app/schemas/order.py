"""Pydantic schemas for checkout and orders."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CheckoutItem(BaseModel):
    variant_id: int
    qty: int = Field(ge=1, le=99)


class CheckoutRequest(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1)

    customer_name: str = Field(min_length=1, max_length=255)
    customer_phone: str = Field(min_length=7, max_length=32)
    customer_email: EmailStr | None = None

    shipping_line1: str = Field(min_length=1, max_length=255)
    shipping_line2: str | None = Field(default=None, max_length=255)
    shipping_city: str = Field(min_length=1, max_length=120)
    shipping_province: str = Field(min_length=1, max_length=120)
    shipping_postal_code: str | None = Field(default=None, max_length=20)

    notes: str | None = Field(default=None, max_length=1000)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_name: str
    variant_label: str | None
    unit_price: Decimal
    qty: int
    line_total: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_number: str
    status: str
    payment_method: str
    payment_status: str

    subtotal: Decimal
    shipping_fee: Decimal
    discount: Decimal
    total: Decimal

    customer_name: str
    customer_phone: str
    customer_email: str | None
    shipping_line1: str
    shipping_line2: str | None
    shipping_city: str
    shipping_province: str
    shipping_postal_code: str | None
    notes: str | None

    placed_at: datetime
    items: list[OrderItemResponse]


class OrderSummary(BaseModel):
    """Compact shape for the order-history list."""

    order_number: str
    status: str
    total: Decimal
    item_count: int
    placed_at: datetime
