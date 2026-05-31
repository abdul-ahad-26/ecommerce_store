"""Tests for checkout + orders: totals, stock decrement, validation, access."""

from decimal import Decimal

import pytest_asyncio
from httpx import AsyncClient

from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.tests.conftest import TestSession

API = "/api/v1"

CUSTOMER = {
    "email": "shopper@example.com",
    "password": "supersecret",
    "full_name": "Shopper",
}


@pytest_asyncio.fixture
async def variant_ids():
    """Seed one product with two variants; return their ids and stock."""
    async with TestSession() as db:
        cat = Category(name="Lawn", slug="lawn")
        db.add(cat)
        await db.flush()
        product = Product(
            name="Test Lawn Suit",
            slug="test-lawn-suit",
            category_id=cat.id,
            base_price=Decimal("3000.00"),
            is_published=True,
            variants=[
                ProductVariant(sku="T-S", size="S", stock_qty=5),
                ProductVariant(sku="T-M", size="M", stock_qty=2),
            ],
        )
        db.add(product)
        await db.commit()
        return {
            "s": product.variants[0].id,
            "m": product.variants[1].id,
        }


def checkout_body(items):
    return {
        "items": items,
        "customer_name": "Ayesha Khan",
        "customer_phone": "03001234567",
        "shipping_line1": "House 1, Street 2",
        "shipping_city": "Lahore",
        "shipping_province": "Punjab",
    }


async def test_guest_checkout_succeeds(client: AsyncClient, variant_ids):
    res = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["s"], "qty": 2}]),
    )
    assert res.status_code == 201
    data = res.json()
    assert data["order_number"].startswith("MR")
    assert data["payment_method"] == "COD"
    assert data["payment_status"] == "unpaid"
    assert data["status"] == "pending"
    # 2 x 3000 = 6000 -> free shipping (>= 5000)
    assert Decimal(data["subtotal"]) == Decimal("6000.00")
    assert Decimal(data["shipping_fee"]) == Decimal("0.00")
    assert Decimal(data["total"]) == Decimal("6000.00")


async def test_shipping_fee_applied_under_threshold(client: AsyncClient, variant_ids):
    res = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["s"], "qty": 1}]),
    )
    data = res.json()
    assert Decimal(data["subtotal"]) == Decimal("3000.00")
    assert Decimal(data["shipping_fee"]) == Decimal("200.00")
    assert Decimal(data["total"]) == Decimal("3200.00")


async def test_checkout_decrements_stock(client: AsyncClient, variant_ids):
    await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["m"], "qty": 2}]),
    )
    # M had stock 2; now 0 -> a second order for 1 should fail.
    res = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["m"], "qty": 1}]),
    )
    assert res.status_code == 409
    assert "Only 0 left" in res.json()["detail"]


async def test_checkout_rejects_over_stock(client: AsyncClient, variant_ids):
    res = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["m"], "qty": 5}]),
    )
    assert res.status_code == 409
    assert "Only 2 left" in res.json()["detail"]


async def test_checkout_empty_items_rejected(client: AsyncClient, variant_ids):
    res = await client.post(f"{API}/orders", json=checkout_body([]))
    assert res.status_code == 422


async def test_order_history_requires_auth(client: AsyncClient):
    res = await client.get(f"{API}/orders")
    assert res.status_code == 401


async def test_logged_in_order_appears_in_history(client: AsyncClient, variant_ids):
    reg = await client.post(f"{API}/auth/register", json=CUSTOMER)
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["s"], "qty": 1}]),
        headers=headers,
    )

    res = await client.get(f"{API}/orders", headers=headers)
    assert res.status_code == 200
    history = res.json()
    assert len(history) == 1
    assert history[0]["item_count"] == 1


async def test_guest_order_viewable_by_number(client: AsyncClient, variant_ids):
    placed = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["s"], "qty": 1}]),
    )
    number = placed.json()["order_number"]
    res = await client.get(f"{API}/orders/{number}")
    assert res.status_code == 200
    assert res.json()["order_number"] == number


async def test_other_users_order_is_hidden(client: AsyncClient, variant_ids):
    # User A places an order.
    reg = await client.post(f"{API}/auth/register", json=CUSTOMER)
    token_a = reg.json()["access_token"]
    placed = await client.post(
        f"{API}/orders",
        json=checkout_body([{"variant_id": variant_ids["s"], "qty": 1}]),
        headers={"Authorization": f"Bearer {token_a}"},
    )
    number = placed.json()["order_number"]

    # User B cannot see it.
    reg_b = await client.post(
        f"{API}/auth/register",
        json={**CUSTOMER, "email": "other@example.com"},
    )
    token_b = reg_b.json()["access_token"]
    res = await client.get(
        f"{API}/orders/{number}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res.status_code == 404
