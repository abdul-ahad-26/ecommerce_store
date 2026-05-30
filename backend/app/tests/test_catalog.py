"""Tests for the public catalog API (categories + products)."""

from decimal import Decimal

import pytest_asyncio
from httpx import AsyncClient

from app.models.category import Category
from app.models.product import Product, ProductImage, ProductVariant
from app.tests.conftest import TestSession

API = "/api/v1"


@pytest_asyncio.fixture
async def catalog_data():
    """Seed two categories and three products directly into the test DB."""
    async with TestSession() as db:
        lawn = Category(name="Lawn", slug="lawn", sort_order=1)
        stitched = Category(name="Stitched", slug="stitched", sort_order=2)
        db.add_all([lawn, stitched])
        await db.flush()

        db.add_all(
            [
                Product(
                    name="Alkaram Lawn Suit",
                    slug="alkaram-lawn-suit",
                    category_id=lawn.id,
                    brand="Alkaram",
                    base_price=Decimal("5000.00"),
                    sale_price=Decimal("4000.00"),
                    is_published=True,
                    images=[ProductImage(url="http://img/a.jpg", sort_order=0)],
                    variants=[
                        ProductVariant(sku="A-S", size="S", color="Red", stock_qty=5),
                        ProductVariant(sku="A-M", size="M", color="Red", stock_qty=0),
                    ],
                ),
                Product(
                    name="Khaadi Kurta",
                    slug="khaadi-kurta",
                    category_id=stitched.id,
                    brand="Khaadi",
                    base_price=Decimal("3000.00"),
                    is_published=True,
                    variants=[
                        ProductVariant(sku="K-L", size="L", color="Blue", stock_qty=3)
                    ],
                ),
                Product(
                    name="Unpublished Draft",
                    slug="unpublished-draft",
                    category_id=lawn.id,
                    base_price=Decimal("1000.00"),
                    is_published=False,
                ),
            ]
        )
        await db.commit()


async def test_list_categories(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/categories")
    assert res.status_code == 200
    slugs = [c["slug"] for c in res.json()]
    assert slugs == ["lawn", "stitched"]  # ordered by sort_order


async def test_list_products_excludes_unpublished(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    slugs = {p["slug"] for p in data["items"]}
    assert "unpublished-draft" not in slugs


async def test_effective_price_and_on_sale(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products", params={"category": "lawn"})
    item = res.json()["items"][0]
    assert item["slug"] == "alkaram-lawn-suit"
    assert item["on_sale"] is True
    assert Decimal(item["price"]) == Decimal("4000.00")
    assert item["in_stock"] is True  # one variant has stock


async def test_filter_by_category(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products", params={"category": "stitched"})
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "khaadi-kurta"


async def test_search(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products", params={"search": "khaadi"})
    assert res.json()["total"] == 1


async def test_price_sort(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products", params={"sort": "price_asc"})
    prices = [Decimal(p["price"]) for p in res.json()["items"]]
    assert prices == sorted(prices)


async def test_filter_by_size(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products", params={"size": "L"})
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["slug"] == "khaadi-kurta"


async def test_product_detail(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products/alkaram-lawn-suit")
    assert res.status_code == 200
    data = res.json()
    assert data["slug"] == "alkaram-lawn-suit"
    assert len(data["variants"]) == 2
    assert len(data["images"]) == 1
    assert data["category"]["slug"] == "lawn"


async def test_product_detail_404_for_unpublished(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products/unpublished-draft")
    assert res.status_code == 404


async def test_product_detail_404_missing(client: AsyncClient, catalog_data):
    res = await client.get(f"{API}/products/does-not-exist")
    assert res.status_code == 404
