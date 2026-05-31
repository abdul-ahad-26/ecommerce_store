"""Order creation and retrieval.

Checkout is a single transaction: validate stock (with row locks to prevent
oversell) → compute totals → create the order + items → decrement stock.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.schemas.order import CheckoutRequest

# Flat-rate shipping (PKR). Mirrors the storefront announcement bar.
FREE_SHIPPING_THRESHOLD = Decimal("5000")
SHIPPING_FEE = Decimal("200")


class CheckoutError(Exception):
    """Raised when an order cannot be placed (stock/availability)."""


def _variant_label(variant: ProductVariant) -> str | None:
    return " · ".join(p for p in (variant.size, variant.color) if p) or None


def _variant_unit_price(variant: ProductVariant) -> Decimal:
    if variant.price_override is not None:
        return variant.price_override
    product = variant.product
    return product.sale_price if product.sale_price is not None else product.base_price


def _generate_order_number() -> str:
    return "MR" + uuid.uuid4().hex[:8].upper()


async def create_order(
    db: AsyncSession, payload: CheckoutRequest, user: User | None
) -> Order:
    # Aggregate quantities per variant (defensive against duplicate lines).
    wanted: dict[int, int] = {}
    for item in payload.items:
        wanted[item.variant_id] = wanted.get(item.variant_id, 0) + item.qty

    # Lock the variant rows for the duration of the transaction.
    # innerjoin (product_id is NOT NULL) + `of=ProductVariant` so Postgres locks
    # only product_variants — FOR UPDATE can't touch the nullable side of an
    # outer join.
    result = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.id.in_(wanted.keys()))
        .options(
            joinedload(ProductVariant.product, innerjoin=True).selectinload(
                Product.images
            )
        )
        .with_for_update(of=ProductVariant)
    )
    variants = {v.id: v for v in result.scalars().all()}

    subtotal = Decimal("0.00")
    order_items: list[OrderItem] = []

    for variant_id, qty in wanted.items():
        variant = variants.get(variant_id)
        if variant is None or not variant.product.is_published:
            raise CheckoutError("One or more items are no longer available.")
        if qty > variant.stock_qty:
            label = _variant_label(variant)
            suffix = f" ({label})" if label else ""
            raise CheckoutError(
                f"Only {variant.stock_qty} left of {variant.product.name}{suffix}."
            )

        unit_price = _variant_unit_price(variant)
        line_total = unit_price * qty
        subtotal += line_total

        images = variant.product.images
        order_items.append(
            OrderItem(
                variant_id=variant.id,
                product_name=variant.product.name,
                product_slug=variant.product.slug,
                image_url=images[0].url if images else None,
                variant_label=_variant_label(variant),
                unit_price=unit_price,
                qty=qty,
                line_total=line_total,
            )
        )

        # Decrement stock.
        variant.stock_qty -= qty

    shipping_fee = (
        Decimal("0.00") if subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
    )
    discount = Decimal("0.00")
    total = subtotal + shipping_fee - discount

    order = Order(
        order_number=_generate_order_number(),
        user_id=user.id if user else None,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        discount=discount,
        total=total,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        shipping_line1=payload.shipping_line1,
        shipping_line2=payload.shipping_line2,
        shipping_city=payload.shipping_city,
        shipping_province=payload.shipping_province,
        shipping_postal_code=payload.shipping_postal_code,
        notes=payload.notes,
        items=order_items,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return order


async def list_orders_for_user(db: AsyncSession, user: User) -> list[Order]:
    result = await db.execute(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.placed_at.desc())
        .options(selectinload(Order.items))
    )
    return list(result.scalars().all())


async def get_order_by_number(db: AsyncSession, order_number: str) -> Order | None:
    result = await db.execute(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items))
    )
    return result.scalars().one_or_none()
