"""Catalog query + mapping logic shared by the public product/category APIs."""

import re
from decimal import Decimal
from enum import Enum

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.schemas.catalog import (
    PaginatedProducts,
    ProductDetail,
    ProductImageResponse,
    ProductListItem,
    ProductVariantResponse,
)


class ProductSort(str, Enum):
    newest = "newest"
    price_asc = "price_asc"
    price_desc = "price_desc"
    name = "name"


def effective_product_price(product: Product) -> Decimal:
    return product.sale_price if product.sale_price is not None else product.base_price


def _effective_variant_price(product: Product, variant: ProductVariant) -> Decimal:
    if variant.price_override is not None:
        return variant.price_override
    return effective_product_price(product)


def map_variant(product: Product, variant: ProductVariant) -> ProductVariantResponse:
    return ProductVariantResponse(
        id=variant.id,
        sku=variant.sku,
        size=variant.size,
        color=variant.color,
        color_hex=variant.color_hex,
        price=_effective_variant_price(product, variant),
        stock_qty=variant.stock_qty,
        in_stock=variant.stock_qty > 0,
    )


def _is_in_stock(product: Product) -> bool:
    return any(v.stock_qty > 0 for v in product.variants)


def map_list_item(product: Product) -> ProductListItem:
    primary = product.images[0].url if product.images else None
    return ProductListItem(
        id=product.id,
        name=product.name,
        slug=product.slug,
        brand=product.brand,
        fabric=product.fabric,
        piece_count=product.piece_count,
        base_price=product.base_price,
        sale_price=product.sale_price,
        price=effective_product_price(product),
        on_sale=product.sale_price is not None,
        in_stock=_is_in_stock(product),
        primary_image=primary,
        category_slug=product.category.slug,
        category_name=product.category.name,
    )


def map_detail(product: Product) -> ProductDetail:
    return ProductDetail(
        id=product.id,
        name=product.name,
        slug=product.slug,
        description=product.description,
        brand=product.brand,
        fabric=product.fabric,
        piece_count=product.piece_count,
        base_price=product.base_price,
        sale_price=product.sale_price,
        price=effective_product_price(product),
        on_sale=product.sale_price is not None,
        in_stock=_is_in_stock(product),
        category=product.category,  # type: ignore[arg-type]  (from_attributes)
        images=[ProductImageResponse.model_validate(i) for i in product.images],
        variants=[map_variant(product, v) for v in product.variants],
        created_at=product.created_at,
    )


async def list_products(
    db: AsyncSession,
    *,
    category: str | None = None,
    search: str | None = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    sort: ProductSort = ProductSort.newest,
    page: int = 1,
    page_size: int = 12,
) -> PaginatedProducts:
    # Effective price expression for filtering/sorting.
    eff_price = func.coalesce(Product.sale_price, Product.base_price)

    conditions = [Product.is_published.is_(True)]

    if category:
        conditions.append(
            Product.category_id.in_(
                select(Category.id).where(Category.slug == category)
            )
        )
    if search:
        # Tokenized search: split into alphanumeric words and AND them, each
        # matching name OR description. A single rigid substring missed real
        # titles ("Sana Safinaz Mahay Lawn 3" never matches the literal name
        # "Sana Safinaz Unstitched Mahay Lawn 3 Piece Suit"); per-token matching
        # finds it regardless of word order or punctuation.
        tokens = [
            t
            for t in re.findall(r"[a-z0-9]+", search.lower())
            if len(t) >= 2 or t.isdigit()
        ]
        for token in tokens:
            like = f"%{token}%"
            conditions.append(
                or_(Product.name.ilike(like), Product.description.ilike(like))
            )
    if brand:
        conditions.append(Product.brand == brand)
    if min_price is not None:
        conditions.append(eff_price >= min_price)
    if max_price is not None:
        conditions.append(eff_price <= max_price)

    # Variant-level filters via a subquery to avoid duplicate product rows.
    if size or color:
        variant_conds = []
        if size:
            variant_conds.append(ProductVariant.size == size)
        if color:
            variant_conds.append(ProductVariant.color == color)
        conditions.append(
            Product.id.in_(
                select(ProductVariant.product_id).where(*variant_conds)
            )
        )

    total = await db.scalar(
        select(func.count()).select_from(Product).where(*conditions)
    )
    total = total or 0

    order_by = {
        ProductSort.newest: Product.created_at.desc(),
        ProductSort.price_asc: eff_price.asc(),
        ProductSort.price_desc: eff_price.desc(),
        ProductSort.name: Product.name.asc(),
    }[sort]

    stmt = (
        select(Product)
        .where(*conditions)
        .order_by(order_by)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(
            joinedload(Product.category),
            selectinload(Product.images),
            selectinload(Product.variants),
        )
    )
    products = (await db.scalars(stmt)).unique().all()

    pages = (total + page_size - 1) // page_size if page_size else 0
    return PaginatedProducts(
        items=[map_list_item(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


async def get_product_by_slug(db: AsyncSession, slug: str) -> Product | None:
    stmt = (
        select(Product)
        .where(Product.slug == slug, Product.is_published.is_(True))
        .options(
            joinedload(Product.category),
            selectinload(Product.images),
            selectinload(Product.variants),
        )
    )
    return (await db.scalars(stmt)).unique().one_or_none()
