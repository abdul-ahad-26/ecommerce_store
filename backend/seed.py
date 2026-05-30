"""Seed the database with an admin user, categories, and sample products.

Run after migrations:  uv run python seed.py

Re-runnable: the catalog (categories/products) is reset on each run; the admin
user is created once and preserved. Change ADMIN_EMAIL / ADMIN_PASSWORD (or via
env) before using in prod.

NOTE: product images are hotlinked from real Pakistani brand sites (Shopify CDN)
for demo/portfolio purposes only. Replace with first-party Cloudinary uploads
(admin panel, Phase 5) before any production use.
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

# Avoid reserved TLDs (.test/.example) — pydantic's EmailStr rejects them.
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@store.pk")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")

CDN = "https://cdn.shopify.com/s/files"

STITCHED_SIZES = [
    ("S", 8),
    ("M", 12),
    ("L", 6),
    ("XL", 0),  # one sold-out size for demo
]


def stitched_variants(prefix: str, color: str, hex_: str) -> list[ProductVariant]:
    return [
        ProductVariant(
            sku=f"{prefix}-{size}", size=size, color=color, color_hex=hex_, stock_qty=qty
        )
        for size, qty in STITCHED_SIZES
    ]


def unstitched_variant(prefix: str, color: str, hex_: str, qty: int) -> list[ProductVariant]:
    return [
        ProductVariant(
            sku=f"{prefix}-U", size="Unstitched", color=color, color_hex=hex_, stock_qty=qty
        )
    ]


# (name, slug, category, brand, fabric, pieces, base, sale, image_path, variants)
PRODUCTS = [
    # --- Sana Safinaz ---
    (
        "Sana Safinaz Printed Lawn — Shirt & Shalwar",
        "sana-safinaz-printed-lawn-shirt-shalwar",
        "lawn",
        "Sana Safinaz",
        "Lawn",
        "2-Piece (Stitched)",
        "5499.00",
        None,
        "/1/0740/1753/8280/files/SS26BSP113P2T_1.jpg?v=1779706506",
        stitched_variants("SS-PL", "Sky Blue", "#8Fb3cf"),
    ),
    (
        "Sana Safinaz Embroidered Luxury Lawn",
        "sana-safinaz-embroidered-luxury-lawn",
        "lawn",
        "Sana Safinaz",
        "Lawn",
        "3-Piece (Stitched)",
        "15199.00",
        "12999.00",
        "/1/0740/1753/8280/files/SS25LUX106AP2T_1bf508ce-6df3-452a-89f4-57b49a821d52.jpg?v=1779707120",
        stitched_variants("SS-EL", "Ivory", "#EDE6D6"),
    ),
    (
        "Sana Safinaz Printed Khaddar — Shirt & Culotte",
        "sana-safinaz-printed-khaddar-shirt-culotte",
        "stitched",
        "Sana Safinaz",
        "Khaddar",
        "2-Piece (Stitched)",
        "5899.00",
        None,
        "/1/0740/1753/8280/files/FW25BSP006_1_1.jpg?v=1764318817",
        stitched_variants("SS-KC", "Rust", "#A4502F"),
    ),
    # --- Alkaram Studio ---
    (
        "Alkaram Printed 3-Piece — Emerald",
        "alkaram-printed-3pc-emerald",
        "stitched",
        "Alkaram Studio",
        "Cambric",
        "3-Piece (Stitched)",
        "2693.00",
        None,
        "/1/0623/6481/1444/files/FW-105.1-25-1-Green-1.jpg?v=1760030739",
        stitched_variants("ALK-EM", "Emerald", "#1F6B53"),
    ),
    (
        "Alkaram Shirt & Trouser — Maroon",
        "alkaram-shirt-trouser-maroon",
        "stitched",
        "Alkaram Studio",
        "Cotton",
        "2-Piece (Stitched)",
        "2990.00",
        "2392.00",
        "/1/0623/6481/1444/files/EF23-26-Maroon-1_08b91fc2-207e-4819-8c3f-c3a35594e6f4.jpg?v=1768051105",
        stitched_variants("ALK-MR", "Maroon", "#7B2D3A"),
    ),
    (
        "Alkaram Embroidered 3-Piece — Peach",
        "alkaram-embroidered-3pc-peach",
        "lawn",
        "Alkaram Studio",
        "Lawn",
        "3-Piece (Stitched)",
        "4792.00",
        None,
        "/1/0623/6481/1444/files/EF01-26-Peach-1_6267bf0b-3d2d-4874-bdc6-99cb9b358dba.jpg?v=1768558509",
        stitched_variants("ALK-PC", "Peach", "#E8B7A0"),
    ),
    (
        "Alkaram Festive 3-Piece — Blush Pink",
        "alkaram-festive-3pc-blush-pink",
        "stitched",
        "Alkaram Studio",
        "Lawn",
        "3-Piece (Stitched)",
        "4392.00",
        None,
        "/1/0623/6481/1444/files/CAJ-11-26-Pink-1_0c95919a-36ce-4031-9fe1-e2f13b711cb2.jpg?v=1767860230",
        stitched_variants("ALK-BP", "Blush Pink", "#E8A0BF"),
    ),
    (
        "Alkaram Premium 3-Piece — Ivory",
        "alkaram-premium-3pc-ivory",
        "stitched",
        "Alkaram Studio",
        "Lawn",
        "3-Piece (Stitched)",
        "6594.00",
        "5275.00",
        "/1/0623/6481/1444/files/M-01-25-1-IVORY-1_bdd43873-27f7-46ba-93d3-0d15f39734e8.jpg?v=1740126916",
        stitched_variants("ALK-IV", "Ivory", "#EDE6D6"),
    ),
    # --- Gul Ahmed ---
    (
        "Gul Ahmed Silver Star Unstitched Cotton",
        "gul-ahmed-silver-star-unstitched-cotton",
        "unstitched",
        "Gul Ahmed",
        "Cotton",
        "Unstitched",
        "3699.00",
        None,
        "/1/0706/3253/8159/files/silver-star-gs-unstitched-fabric-cotton-white-fullshot-front.jpg?v=1780144755",
        unstitched_variant("GA-SS", "Off White", "#F2EDE2", 30),
    ),
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

        for (
            name,
            slug,
            cat_key,
            brand,
            fabric,
            pieces,
            base,
            sale,
            image_path,
            variants,
        ) in PRODUCTS:
            db.add(
                Product(
                    name=name,
                    slug=slug,
                    description=(
                        f"{name} by {brand}. Premium {fabric.lower()} — "
                        f"{pieces.lower()}. Cash on delivery available nationwide."
                    ),
                    category_id=categories[cat_key].id,
                    brand=brand,
                    fabric=fabric,
                    piece_count=pieces,
                    base_price=Decimal(base),
                    sale_price=Decimal(sale) if sale else None,
                    is_published=True,
                    images=[ProductImage(url=f"{CDN}{image_path}", alt=name, sort_order=0)],
                    variants=variants,
                )
            )

        await db.commit()

    await engine.dispose()
    print("Seed complete.")
    print(f"  Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"  Categories: 3, Products: {len(PRODUCTS)}")


if __name__ == "__main__":
    asyncio.run(seed())
