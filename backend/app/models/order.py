from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus

if TYPE_CHECKING:
    from app.models.product import ProductVariant
    from app.models.user import User


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    # Null user_id = guest checkout.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default=OrderStatus.pending.value, nullable=False
    )
    payment_method: Mapped[str] = mapped_column(
        String(20), default=PaymentMethod.cod.value, nullable=False
    )
    payment_status: Mapped[str] = mapped_column(
        String(20), default=PaymentStatus.unpaid.value, nullable=False
    )

    # Money (PKR).
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    shipping_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    discount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Shipping snapshot (captured at order time, independent of saved addresses).
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(255))
    shipping_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    shipping_line2: Mapped[str | None] = mapped_column(String(255))
    shipping_city: Mapped[str] = mapped_column(String(120), nullable=False)
    shipping_province: Mapped[str] = mapped_column(String(120), nullable=False)
    shipping_postal_code: Mapped[str | None] = mapped_column(String(20))

    notes: Mapped[str | None] = mapped_column(Text)
    placed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User | None"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Keep the row even if the variant is later deleted.
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="SET NULL")
    )

    # Snapshots so the order is readable regardless of catalog changes.
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    variant_label: Mapped[str | None] = mapped_column(String(120))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    variant: Mapped["ProductVariant | None"] = relationship()
