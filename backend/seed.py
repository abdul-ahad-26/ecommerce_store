"""Seed the database with an admin user, categories, and sample products.

Run after migrations:  uv run python seed.py

Re-runnable: the catalog (categories/products) is reset on each run; the admin
user is created once and preserved. Change ADMIN_EMAIL / ADMIN_PASSWORD (or via
env) before using in prod.

Product data lives in seed_catalog.py (generated from PK brand Shopify stores
by .seed-tmp/build_catalog.py). Images are hotlinked from real brand CDNs for
demo/portfolio purposes only — replace with first-party Cloudinary uploads
(admin panel) before any production use.
"""

import asyncio
import os
from decimal import Decimal

from sqlalchemy import delete, select

from app.core.db import AsyncSessionLocal, engine
from app.core.security import hash_password
from app.models.category import Category
from app.models.enums import UserRole
from app.models.product import Product, ProductImage, ProductVariant
from app.models.user import User
from seed_catalog import CATALOG

# Avoid reserved TLDs (.test/.example) — pydantic's EmailStr rejects them.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@store.pk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")

# Stitched pieces get a size run (one sold-out size for demo); unstitched
# fabric is a single cut-length variant.
STITCHED_SIZES = [
    ("S", 8),
    ("M", 12),
    ("L", 6),
    ("XL", 0),
]


def build_variants(item: dict) -> list[ProductVariant]:
    if item["kind"] == "unstitched":
        return [
            ProductVariant(
                sku=f"{item['sku']}-U",
                size="Unstitched",
                color=item["color"],
                color_hex=item["color_hex"],
                stock_qty=25,
            )
        ]
    return [
        ProductVariant(
            sku=f"{item['sku']}-{size}",
            size=size,
            color=item["color"],
            color_hex=item["color_hex"],
            stock_qty=qty,
        )
        for size, qty in STITCHED_SIZES
    ]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # --- Admin (create once) ---
        admin = await db.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if admin is None:
            db.add(
                User(
                    email=ADMIN_EMAIL,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    full_name="Store Admin",
                    role=UserRole.admin.value,
                )
            )

        # --- Reset catalog ---
        await db.execute(delete(Product))
        await db.execute(delete(Category))
        await db.flush()

        categories = {
            "lawn": Category(
                name="Lawn",
                slug="lawn",
                description="Breathable lawn suits for everyday grace.",
                sort_order=1,
            ),
            "stitched": Category(
                name="Stitched",
                slug="stitched",
                description="Ready-to-wear shalwar kameez, made to shine.",
                sort_order=2,
            ),
            "unstitched": Category(
                name="Unstitched",
                slug="unstitched",
                description="Unstitched fabric — tailored to your story.",
                sort_order=3,
            ),
        }
        db.add_all(categories.values())
        await db.flush()

        for item in CATALOG:
            db.add(
                Product(
                    name=item["name"],
                    slug=item["slug"],
                    description=(
                        f"{item['name']} by {item['brand']}. Premium "
                        f"{item['fabric'].lower()} — {item['pieces'].lower()}. "
                        "Cash on delivery available nationwide."
                    ),
                    category_id=categories[item["category"]].id,
                    brand=item["brand"],
                    fabric=item["fabric"],
                    piece_count=item["pieces"],
                    base_price=Decimal(item["base_price"]),
                    sale_price=(
                        Decimal(item["sale_price"]) if item["sale_price"] else None
                    ),
                    is_published=True,
                    images=[
                        ProductImage(url=item["image"], alt=item["name"], sort_order=0)
                    ],
                    variants=build_variants(item),
                )
            )

        await db.commit()

    await engine.dispose()
    print("Seed complete.")
    print(f"  Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"  Categories: 3, Products: {len(CATALOG)}")


if __name__ == "__main__":
    asyncio.run(seed())
