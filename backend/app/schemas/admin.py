"""Pydantic schemas for the admin panel (products, categories, orders, stats)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import OrderStatus


# --- Products ---
class VariantIn(BaseModel):
    id: int | None = None  # present = update existing, absent = create
    sku: str = Field(min_length=1, max_length=80)
    size: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=60)
    color_hex: str | None = Field(default=None, max_length=9)
    price_override: Decimal | None = None
    stock_qty: int = Field(ge=0, default=0)


class ImageIn(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    alt: str | None = Field(default=None, max_length=255)
    sort_order: int = 0


class ProductWrite(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=280)
    description: str | None = None
    category_id: int
    brand: str | None = Field(default=None, max_length=120)
    fabric: str | None = Field(default=None, max_length=120)
    piece_count: str | None = Field(default=None, max_length=60)
    base_price: Decimal = Field(ge=0)
    sale_price: Decimal | None = Field(default=None, ge=0)
    is_published: bool = False
    images: list[ImageIn] = []
    variants: list[VariantIn] = []


class AdminVariant(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    size: str | None
    color: str | None
    color_hex: str | None
    price_override: Decimal | None
    stock_qty: int


class AdminImage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    alt: str | None
    sort_order: int


class AdminProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    category_id: int
    brand: str | None
    fabric: str | None
    piece_count: str | None
    base_price: Decimal
    sale_price: Decimal | None
    is_published: bool
    created_at: datetime
    images: list[AdminImage]
    variants: list[AdminVariant]


# --- Categories ---
class CategoryWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=140)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    parent_id: int | None = None
    sort_order: int = 0


# --- Orders ---
class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class AdminOrderSummary(BaseModel):
    order_number: str
    customer_name: str
    customer_phone: str
    status: str
    payment_status: str
    total: Decimal
    item_count: int
    placed_at: datetime


# --- Dashboard ---
class DashboardStats(BaseModel):
    total_orders: int
    pending_orders: int
    revenue: Decimal
    total_products: int
    published_products: int
    low_stock_variants: int
    recent_orders: list[AdminOrderSummary]


# --- Uploads ---
class UploadSignature(BaseModel):
    cloud_name: str
    api_key: str
    timestamp: int
    signature: str
    folder: str
