"""Admin business logic: product create/update (with variant upsert) + stats."""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import OrderStatus
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductImage, ProductVariant
from app.schemas.admin import AdminOrderSummary, ProductWrite

LOW_STOCK_THRESHOLD = 3


def _build_images(payload: ProductWrite) -> list[ProductImage]:
    return [
        ProductImage(url=i.url, alt=i.alt, sort_order=i.sort_order)
        for i in payload.images
    ]


async def get_admin_product(db: AsyncSession, product_id: int) -> Product | None:
    return await db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.images), selectinload(Product.variants))
    )


async def list_admin_products(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    q: str | None = None,
    published: bool | None = None,
) -> dict:
    """Paginated + filtered product list for the admin table."""
    filters = []
    if q:
        like = f"%{q}%"
        filters.append(Product.name.ilike(like) | Product.brand.ilike(like))
    if published is not None:
        filters.append(Product.is_published.is_(published))

    total = (
        await db.scalar(
            select(func.count()).select_from(Product).where(*filters)
        )
        or 0
    )
    pages = max(1, -(-total // page_size))  # ceil division
    page = min(max(1, page), pages)

    rows = await db.scalars(
        select(Product)
        .where(*filters)
        .order_by(Product.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Product.images), selectinload(Product.variants))
    )
    return {
        "items": list(rows.all()),
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


async def create_product(db: AsyncSession, payload: ProductWrite) -> Product:
    product = Product(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        category_id=payload.category_id,
        brand=payload.brand,
        fabric=payload.fabric,
        piece_count=payload.piece_count,
        base_price=payload.base_price,
        sale_price=payload.sale_price,
        is_published=payload.is_published,
        images=_build_images(payload),
        variants=[
            ProductVariant(
                sku=v.sku,
                size=v.size,
                color=v.color,
                color_hex=v.color_hex,
                price_override=v.price_override,
                stock_qty=v.stock_qty,
            )
            for v in payload.variants
        ],
    )
    db.add(product)
    await db.commit()
    return await get_admin_product(db, product.id)  # type: ignore[return-value]


async def update_product(
    db: AsyncSession, product: Product, payload: ProductWrite
) -> Product:
    # Scalar fields.
    product.name = payload.name
    product.slug = payload.slug
    product.description = payload.description
    product.category_id = payload.category_id
    product.brand = payload.brand
    product.fabric = payload.fabric
    product.piece_count = payload.piece_count
    product.base_price = payload.base_price
    product.sale_price = payload.sale_price
    product.is_published = payload.is_published

    # Replace images (not referenced elsewhere — safe to recreate).
    product.images = _build_images(payload)

    # Upsert variants: update by id, create new, delete those omitted.
    existing = {v.id: v for v in product.variants}
    next_variants: list[ProductVariant] = []
    for v in payload.variants:
        if v.id is not None and v.id in existing:
            current = existing[v.id]
            current.sku = v.sku
            current.size = v.size
            current.color = v.color
            current.color_hex = v.color_hex
            current.price_override = v.price_override
            current.stock_qty = v.stock_qty
            next_variants.append(current)
        else:
            next_variants.append(
                ProductVariant(
                    sku=v.sku,
                    size=v.size,
                    color=v.color,
                    color_hex=v.color_hex,
                    price_override=v.price_override,
                    stock_qty=v.stock_qty,
                )
            )
    # Reassigning the collection deletes orphaned variants (delete-orphan
    # cascade). Order items keep their snapshots; variant_id becomes NULL.
    product.variants = next_variants

    await db.commit()
    return await get_admin_product(db, product.id)  # type: ignore[return-value]


async def dashboard_stats(db: AsyncSession) -> dict:
    total_orders = await db.scalar(select(func.count()).select_from(Order)) or 0
    pending_orders = (
        await db.scalar(
            select(func.count())
            .select_from(Order)
            .where(Order.status == OrderStatus.pending.value)
        )
        or 0
    )
    revenue = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(
                Order.status != OrderStatus.cancelled.value
            )
        )
        or Decimal("0")
    )
    total_products = (
        await db.scalar(select(func.count()).select_from(Product)) or 0
    )
    published_products = (
        await db.scalar(
            select(func.count())
            .select_from(Product)
            .where(Product.is_published.is_(True))
        )
        or 0
    )
    low_stock = (
        await db.scalar(
            select(func.count())
            .select_from(ProductVariant)
            .where(ProductVariant.stock_qty <= LOW_STOCK_THRESHOLD)
        )
        or 0
    )

    recent_rows = await db.scalars(
        select(Order)
        .order_by(Order.placed_at.desc())
        .limit(5)
        .options(selectinload(Order.items))
    )
    recent = [
        AdminOrderSummary(
            order_number=o.order_number,
            customer_name=o.customer_name,
            customer_phone=o.customer_phone,
            status=o.status,
            payment_status=o.payment_status,
            total=o.total,
            item_count=sum(i.qty for i in o.items),
            placed_at=o.placed_at,
        )
        for o in recent_rows.all()
    ]

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "revenue": revenue,
        "total_products": total_products,
        "published_products": published_products,
        "low_stock_variants": low_stock,
        "recent_orders": recent,
    }


async def list_admin_orders(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    q: str | None = None,
) -> dict:
    """Paginated + filtered order list for the admin table.

    Filters run server-side so they work across the whole order history, not
    just the current page.
    """
    filters = []
    if status:
        filters.append(Order.status == status)
    if q:
        like = f"%{q}%"
        filters.append(
            Order.order_number.ilike(like)
            | Order.customer_name.ilike(like)
            | Order.customer_phone.ilike(like)
        )

    total = (
        await db.scalar(
            select(func.count()).select_from(Order).where(*filters)
        )
        or 0
    )
    pages = max(1, -(-total // page_size))  # ceil division
    page = min(max(1, page), pages)

    rows = await db.scalars(
        select(Order)
        .where(*filters)
        .order_by(Order.placed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Order.items))
    )
    items = [
        AdminOrderSummary(
            order_number=o.order_number,
            customer_name=o.customer_name,
            customer_phone=o.customer_phone,
            status=o.status,
            payment_status=o.payment_status,
            total=o.total,
            item_count=sum(i.qty for i in o.items),
            placed_at=o.placed_at,
        )
        for o in rows.all()
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }
