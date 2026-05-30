"""Seed the database with an admin user, categories, and sample products.

Run after migrations:  uv run python seed.py

Idempotent: if the admin user already exists, seeding is skipped.
Change ADMIN_EMAIL / ADMIN_PASSWORD below (or via env) before using in prod.
"""

import asyncio
import os
from decimal import Decimal

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.security import hash_password
from app.models.category import Category
from app.models.enums import UserRole
from app.models.product import Product, ProductImage, ProductVariant
from app.models.user import User

# Note: avoid reserved TLDs like .test/.example — pydantic's EmailStr rejects
# them, which would block login. Use a real domain.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@store.pk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")

# Royalty-free placeholder images (Unsplash). Replace with Cloudinary uploads.
_IMG = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=80"
_IMG2 = "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing_admin = await db.scalar(
            select(User).where(User.email == ADMIN_EMAIL)
        )
        if existing_admin is not None:
            print(f"Admin {ADMIN_EMAIL} already exists — skipping seed.")
            return

        # --- Admin user ---
        admin = User(
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            full_name="Store Admin",
            role=UserRole.admin.value,
        )
        db.add(admin)

        # --- Categories ---
        lawn = Category(
            name="Lawn",
            slug="lawn",
            description="Breathable lawn suits for everyday wear.",
            sort_order=1,
        )
        stitched = Category(
            name="Stitched",
            slug="stitched",
            description="Ready-to-wear stitched shalwar kameez.",
            sort_order=2,
        )
        unstitched = Category(
            name="Unstitched",
            slug="unstitched",
            description="Unstitched fabric — get it tailored your way.",
            sort_order=3,
        )
        db.add_all([lawn, stitched, unstitched])
        await db.flush()  # assign category IDs

        # --- Products ---
        products = [
            Product(
                name="Alkaram Lawn 3-Piece — Rose Garden",
                slug="alkaram-lawn-3pc-rose-garden",
                description="Printed lawn shirt with embroidered front, "
                "cambric trousers and chiffon dupatta.",
                category_id=unstitched.id,
                brand="Alkaram",
                fabric="Lawn",
                piece_count="3-Piece (Unstitched)",
                base_price=Decimal("5990.00"),
                sale_price=Decimal("4790.00"),
                is_published=True,
                images=[ProductImage(url=_IMG, alt="Rose Garden lawn suit")],
                variants=[
                    ProductVariant(
                        sku="ALK-RG-FREE",
                        size="Unstitched",
                        color="Rose Pink",
                        color_hex="#E8A0BF",
                        stock_qty=25,
                    )
                ],
            ),
            Product(
                name="Khaadi Stitched Kurta — Indigo Bloom",
                slug="khaadi-stitched-kurta-indigo-bloom",
                description="Ready-to-wear printed cotton kurta with side slits.",
                category_id=stitched.id,
                brand="Khaadi",
                fabric="Cotton",
                piece_count="1-Piece (Stitched)",
                base_price=Decimal("3490.00"),
                is_published=True,
                images=[ProductImage(url=_IMG2, alt="Indigo Bloom kurta")],
                variants=[
                    ProductVariant(
                        sku="KHD-IB-S",
                        size="S",
                        color="Indigo",
                        color_hex="#3F51B5",
                        stock_qty=10,
                    ),
                    ProductVariant(
                        sku="KHD-IB-M",
                        size="M",
                        color="Indigo",
                        color_hex="#3F51B5",
                        stock_qty=15,
                    ),
                    ProductVariant(
                        sku="KHD-IB-L",
                        size="L",
                        color="Indigo",
                        color_hex="#3F51B5",
                        stock_qty=8,
                    ),
                ],
            ),
        ]
        db.add_all(products)

        await db.commit()
        print("Seed complete.")
        print(f"  Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f"  Categories: 3, Products: {len(products)}")


if __name__ == "__main__":
    asyncio.run(seed())
