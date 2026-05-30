"""Seed the database with an admin user, categories, and sample products.

Run after migrations:  uv run python seed.py

Re-runnable: the catalog (categories/products) is reset on each run; the admin
user is created once and preserved. Change ADMIN_EMAIL / ADMIN_PASSWORD (or via
env) before using in prod.
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


def img(photo_id: str, alt: str, order: int) -> ProductImage:
    return ProductImage(
        url=f"https://images.unsplash.com/{photo_id}?w=900&q=80",
        alt=alt,
        sort_order=order,
    )


# (name, slug, category_key, brand, fabric, piece_count, base, sale,
#  [photo_ids], [(sku, size, color, hex, stock)])
PRODUCTS = [
    (
        "Alkaram Lawn 3-Piece — Rose Garden",
        "alkaram-lawn-3pc-rose-garden",
        "unstitched",
        "Alkaram",
        "Lawn",
        "3-Piece (Unstitched)",
        "5990.00",
        "4790.00",
        ["photo-1610030469983-98e550d6193c", "photo-1594633312681-425c7b97ccd1"],
        [("ALK-RG-FREE", "Unstitched", "Rose Pink", "#E8A0BF", 25)],
    ),
    (
        "Sana Safinaz Luxury Lawn — Gulposh",
        "sana-safinaz-luxury-lawn-gulposh",
        "unstitched",
        "Sana Safinaz",
        "Lawn",
        "3-Piece (Unstitched)",
        "8500.00",
        "6800.00",
        ["photo-1595777457583-95e059d581b8", "photo-1469334031218-e382a71b716b"],
        [("SS-GP-FREE", "Unstitched", "Coral", "#E2725B", 14)],
    ),
    (
        "Gul Ahmed Embroidered Lawn — Meadow",
        "gul-ahmed-embroidered-lawn-meadow",
        "unstitched",
        "Gul Ahmed",
        "Lawn",
        "3-Piece (Unstitched)",
        "6200.00",
        None,
        ["photo-1490481651871-ab68de25d43d", "photo-1487412720507-e7ab37603c6f"],
        [("GA-MD-FREE", "Unstitched", "Sage Green", "#6B7257", 18)],
    ),
    (
        "Nishat Unstitched Khaddar — Terracotta",
        "nishat-unstitched-khaddar-terracotta",
        "unstitched",
        "Nishat",
        "Khaddar",
        "2-Piece (Unstitched)",
        "3900.00",
        None,
        ["photo-1539008835657-9e8e9680c956", "photo-1583744946564-b52ac1c389c8"],
        [("NS-TC-FREE", "Unstitched", "Terracotta", "#B14A33", 22)],
    ),
    (
        "Khaadi Stitched Kurta — Indigo Bloom",
        "khaadi-stitched-kurta-indigo-bloom",
        "stitched",
        "Khaadi",
        "Cotton",
        "1-Piece (Stitched)",
        "3490.00",
        None,
        ["photo-1576566588028-4147f3842f27", "photo-1525507119028-ed4c629a60a3"],
        [
            ("KHD-IB-S", "S", "Indigo", "#3F51B5", 10),
            ("KHD-IB-M", "M", "Indigo", "#3F51B5", 15),
            ("KHD-IB-L", "L", "Indigo", "#3F51B5", 8),
        ],
    ),
    (
        "Khaadi Stitched Kameez — Midnight",
        "khaadi-stitched-kameez-midnight",
        "stitched",
        "Khaadi",
        "Khaddar",
        "1-Piece (Stitched)",
        "4200.00",
        "3360.00",
        ["photo-1551488831-00ddcb6c6bd3", "photo-1434389677669-e08b4cac3105"],
        [
            ("KHD-MN-S", "S", "Black", "#1C1B2A", 6),
            ("KHD-MN-M", "M", "Black", "#1C1B2A", 9),
            ("KHD-MN-L", "L", "Black", "#1C1B2A", 4),
        ],
    ),
    (
        "Alkaram Cambric Stitched Suit — Saffron",
        "alkaram-cambric-stitched-suit-saffron",
        "stitched",
        "Alkaram",
        "Cambric",
        "2-Piece (Stitched)",
        "5500.00",
        None,
        ["photo-1591047139829-d91aecb6caea", "photo-1567401893414-76b7b1e5a7a5"],
        [
            ("ALK-SF-S", "S", "Saffron", "#E4A010", 7),
            ("ALK-SF-M", "M", "Saffron", "#E4A010", 11),
            ("ALK-SF-L", "L", "Saffron", "#E4A010", 0),  # demo sold-out size
            ("ALK-SF-XL", "XL", "Saffron", "#E4A010", 5),
        ],
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
            photos,
            variants,
        ) in PRODUCTS:
            db.add(
                Product(
                    name=name,
                    slug=slug,
                    description=(
                        f"{name} by {brand}. Crafted from premium {fabric.lower()} "
                        f"— {pieces.lower()}. Cash on delivery available nationwide."
                    ),
                    category_id=categories[cat_key].id,
                    brand=brand,
                    fabric=fabric,
                    piece_count=pieces,
                    base_price=Decimal(base),
                    sale_price=Decimal(sale) if sale else None,
                    is_published=True,
                    images=[
                        img(pid, name, i) for i, pid in enumerate(photos)
                    ],
                    variants=[
                        ProductVariant(
                            sku=sku,
                            size=size,
                            color=color,
                            color_hex=hex_,
                            stock_qty=stock,
                        )
                        for (sku, size, color, hex_, stock) in variants
                    ],
                )
            )

        await db.commit()

    await engine.dispose()
    print("Seed complete.")
    print(f"  Admin login: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"  Categories: 3, Products: {len(PRODUCTS)}")


if __name__ == "__main__":
    asyncio.run(seed())
