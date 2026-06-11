"""Tests for the admin panel: authorization, product/category/order management."""

from decimal import Decimal

import pytest_asyncio
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.category import Category
from app.models.enums import UserRole
from app.models.user import User
from app.tests.conftest import TestSession

API = "/api/v1"


@pytest_asyncio.fixture
async def admin_headers(client: AsyncClient):
    async with TestSession() as db:
        db.add(
            User(
                email="admin@store.pk",
                password_hash=hash_password("admin12345"),
                full_name="Admin",
                role=UserRole.admin.value,
            )
        )
        await db.commit()
    res = await client.post(
        f"{API}/auth/login",
        json={"email": "admin@store.pk", "password": "admin12345"},
    )
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest_asyncio.fixture
async def customer_headers(client: AsyncClient):
    res = await client.post(
        f"{API}/auth/register",
        json={"email": "cust@example.com", "password": "supersecret", "full_name": "C"},
    )
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest_asyncio.fixture
async def category_id():
    async with TestSession() as db:
        cat = Category(name="Lawn", slug="lawn")
        db.add(cat)
        await db.commit()
        return cat.id


def product_body(category_id: int, **over):
    body = {
        "name": "New Suit",
        "slug": "new-suit",
        "category_id": category_id,
        "base_price": "4000.00",
        "is_published": True,
        "images": [{"url": "http://img/a.jpg"}],
        "variants": [{"sku": "NS-S", "size": "S", "stock_qty": 5}],
    }
    body.update(over)
    return body


async def test_admin_routes_blocked_for_anonymous(client: AsyncClient):
    assert (await client.get(f"{API}/admin/stats")).status_code == 401


async def test_admin_routes_blocked_for_customer(client: AsyncClient, customer_headers):
    res = await client.get(f"{API}/admin/stats", headers=customer_headers)
    assert res.status_code == 403


async def test_admin_can_create_product(client: AsyncClient, admin_headers, category_id):
    res = await client.post(
        f"{API}/admin/products",
        json=product_body(category_id),
        headers=admin_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["slug"] == "new-suit"
    assert len(data["variants"]) == 1
    assert len(data["images"]) == 1


async def test_created_product_visible_in_storefront(
    client: AsyncClient, admin_headers, category_id
):
    await client.post(
        f"{API}/admin/products",
        json=product_body(category_id),
        headers=admin_headers,
    )
    res = await client.get(f"{API}/products/new-suit")
    assert res.status_code == 200


async def test_unpublished_product_hidden_from_storefront(
    client: AsyncClient, admin_headers, category_id
):
    await client.post(
        f"{API}/admin/products",
        json=product_body(category_id, slug="draft", is_published=False),
        headers=admin_headers,
    )
    assert (await client.get(f"{API}/products/draft")).status_code == 404
    # but visible in admin list
    listing = await client.get(f"{API}/admin/products", headers=admin_headers)
    slugs = {p["slug"] for p in listing.json()["items"]}
    assert "draft" in slugs


async def test_duplicate_slug_conflicts(client: AsyncClient, admin_headers, category_id):
    await client.post(
        f"{API}/admin/products", json=product_body(category_id), headers=admin_headers
    )
    res = await client.post(
        f"{API}/admin/products", json=product_body(category_id), headers=admin_headers
    )
    assert res.status_code == 409


async def test_update_product_upserts_variants(
    client: AsyncClient, admin_headers, category_id
):
    created = (
        await client.post(
            f"{API}/admin/products",
            json=product_body(category_id),
            headers=admin_headers,
        )
    ).json()
    pid = created["id"]
    vid = created["variants"][0]["id"]

    # Update existing variant stock + add a new variant + drop nothing.
    updated = await client.put(
        f"{API}/admin/products/{pid}",
        json=product_body(
            category_id,
            variants=[
                {"id": vid, "sku": "NS-S", "size": "S", "stock_qty": 99},
                {"sku": "NS-M", "size": "M", "stock_qty": 3},
            ],
        ),
        headers=admin_headers,
    )
    assert updated.status_code == 200
    variants = {v["sku"]: v for v in updated.json()["variants"]}
    assert variants["NS-S"]["stock_qty"] == 99
    assert variants["NS-M"]["stock_qty"] == 3
    assert len(variants) == 2


async def test_delete_product(client: AsyncClient, admin_headers, category_id):
    created = (
        await client.post(
            f"{API}/admin/products",
            json=product_body(category_id),
            headers=admin_headers,
        )
    ).json()
    res = await client.delete(
        f"{API}/admin/products/{created['id']}", headers=admin_headers
    )
    assert res.status_code == 204
    assert (await client.get(f"{API}/products/new-suit")).status_code == 404


async def test_admin_category_crud(client: AsyncClient, admin_headers):
    created = await client.post(
        f"{API}/admin/categories",
        json={"name": "Festive", "slug": "festive"},
        headers=admin_headers,
    )
    assert created.status_code == 201
    cid = created.json()["id"]

    res = await client.delete(f"{API}/admin/categories/{cid}", headers=admin_headers)
    assert res.status_code == 204


async def test_admin_order_status_update(
    client: AsyncClient, admin_headers, category_id
):
    # Create a product, place a guest order, then advance its status.
    created = (
        await client.post(
            f"{API}/admin/products",
            json=product_body(category_id),
            headers=admin_headers,
        )
    ).json()
    vid = created["variants"][0]["id"]
    placed = await client.post(
        f"{API}/orders",
        json={
            "items": [{"variant_id": vid, "qty": 1}],
            "customer_name": "Ayesha",
            "customer_phone": "03001234567",
            "shipping_line1": "House 1",
            "shipping_city": "Lahore",
            "shipping_province": "Punjab",
        },
    )
    number = placed.json()["order_number"]

    res = await client.patch(
        f"{API}/admin/orders/{number}/status",
        json={"status": "shipped"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "shipped"


async def _place_order(client: AsyncClient, variant_id: int, name: str, phone: str):
    res = await client.post(
        f"{API}/orders",
        json={
            "items": [{"variant_id": variant_id, "qty": 1}],
            "customer_name": name,
            "customer_phone": phone,
            "shipping_line1": "House 1",
            "shipping_city": "Lahore",
            "shipping_province": "Punjab",
        },
    )
    assert res.status_code == 201
    return res.json()["order_number"]


async def test_admin_orders_pagination_and_filters(
    client: AsyncClient, admin_headers, category_id
):
    created = (
        await client.post(
            f"{API}/admin/products",
            json=product_body(
                category_id, variants=[{"sku": "NS-S", "size": "S", "stock_qty": 50}]
            ),
            headers=admin_headers,
        )
    ).json()
    vid = created["variants"][0]["id"]

    n1 = await _place_order(client, vid, "Ayesha Khan", "03001111111")
    await _place_order(client, vid, "Sana Malik", "03002222222")
    await _place_order(client, vid, "Hira Aslam", "03003333333")

    # Pagination math: 3 orders, page_size 2 → 2 pages.
    page1 = (
        await client.get(
            f"{API}/admin/orders?page=1&page_size=2", headers=admin_headers
        )
    ).json()
    assert page1["total"] == 3
    assert page1["pages"] == 2
    assert len(page1["items"]) == 2
    page2 = (
        await client.get(
            f"{API}/admin/orders?page=2&page_size=2", headers=admin_headers
        )
    ).json()
    assert len(page2["items"]) == 1

    # Out-of-range page clamps instead of returning nothing.
    clamped = (
        await client.get(
            f"{API}/admin/orders?page=99&page_size=2", headers=admin_headers
        )
    ).json()
    assert clamped["page"] == 2

    # Search by customer name and by phone fragment.
    by_name = (
        await client.get(f"{API}/admin/orders?q=sana", headers=admin_headers)
    ).json()
    assert by_name["total"] == 1
    assert by_name["items"][0]["customer_name"] == "Sana Malik"
    by_phone = (
        await client.get(f"{API}/admin/orders?q=0300333", headers=admin_headers)
    ).json()
    assert by_phone["total"] == 1

    # Status filter.
    await client.patch(
        f"{API}/admin/orders/{n1}/status",
        json={"status": "shipped"},
        headers=admin_headers,
    )
    shipped = (
        await client.get(f"{API}/admin/orders?status=shipped", headers=admin_headers)
    ).json()
    assert shipped["total"] == 1
    assert shipped["items"][0]["order_number"] == n1
    pending = (
        await client.get(f"{API}/admin/orders?status=pending", headers=admin_headers)
    ).json()
    assert pending["total"] == 2


async def test_admin_products_pagination_and_filters(
    client: AsyncClient, admin_headers, category_id
):
    for i in range(3):
        await client.post(
            f"{API}/admin/products",
            json=product_body(
                category_id,
                name=f"Suit {i}",
                slug=f"suit-{i}",
                is_published=(i < 2),  # 2 live, 1 draft
                variants=[{"sku": f"S{i}", "size": "S", "stock_qty": 1}],
            ),
            headers=admin_headers,
        )

    page1 = (
        await client.get(
            f"{API}/admin/products?page=1&page_size=2", headers=admin_headers
        )
    ).json()
    assert page1["total"] == 3
    assert page1["pages"] == 2
    assert len(page1["items"]) == 2

    drafts = (
        await client.get(
            f"{API}/admin/products?published=false", headers=admin_headers
        )
    ).json()
    assert drafts["total"] == 1
    assert drafts["items"][0]["slug"] == "suit-2"

    by_name = (
        await client.get(f"{API}/admin/products?q=suit 1", headers=admin_headers)
    ).json()
    assert by_name["total"] == 1


async def test_dashboard_stats(client: AsyncClient, admin_headers, category_id):
    await client.post(
        f"{API}/admin/products", json=product_body(category_id), headers=admin_headers
    )
    res = await client.get(f"{API}/admin/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_products"] == 1
    assert stats["published_products"] == 1
    assert "revenue" in stats
