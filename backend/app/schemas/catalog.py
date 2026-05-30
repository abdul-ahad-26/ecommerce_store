"""Pydantic schemas for the public catalog (categories + products)."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    image_url: str | None
    parent_id: int | None
    sort_order: int


class ProductImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    alt: str | None
    sort_order: int


class ProductVariantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    size: str | None
    color: str | None
    color_hex: str | None
    price: Decimal  # effective unit price (price_override or product price)
    stock_qty: int
    in_stock: bool


class ProductListItem(BaseModel):
    """Compact product shape for grids/listings."""

    id: int
    name: str
    slug: str
    brand: str | None
    fabric: str | None
    piece_count: str | None
    base_price: Decimal
    sale_price: Decimal | None
    price: Decimal  # effective price (sale_price or base_price)
    on_sale: bool
    in_stock: bool
    primary_image: str | None
    category_slug: str
    category_name: str


class ProductDetail(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    brand: str | None
    fabric: str | None
    piece_count: str | None
    base_price: Decimal
    sale_price: Decimal | None
    price: Decimal
    on_sale: bool
    in_stock: bool
    category: CategoryResponse
    images: list[ProductImageResponse]
    variants: list[ProductVariantResponse]
    created_at: datetime


class PaginatedProducts(BaseModel):
    items: list[ProductListItem]
    total: int
    page: int
    page_size: int
    pages: int
