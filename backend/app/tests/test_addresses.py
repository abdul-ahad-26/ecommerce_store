"""Tests for the saved-addresses CRUD endpoints."""

import pytest_asyncio
from httpx import AsyncClient

API = "/api/v1"

USER = {"email": "addr@example.com", "password": "supersecret", "full_name": "Addr User"}

ADDR = {
    "recipient_name": "Ayesha Khan",
    "phone": "03001234567",
    "line1": "House 1, Street 2",
    "city": "Lahore",
    "province": "Punjab",
}


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient):
    reg = await client.post(f"{API}/auth/register", json=USER)
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


async def test_addresses_require_auth(client: AsyncClient):
    res = await client.get(f"{API}/addresses")
    assert res.status_code == 401


async def test_first_address_is_default(client: AsyncClient, auth_headers):
    res = await client.post(f"{API}/addresses", json=ADDR, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["is_default"] is True


async def test_default_is_exclusive(client: AsyncClient, auth_headers):
    await client.post(f"{API}/addresses", json=ADDR, headers=auth_headers)
    res2 = await client.post(
        f"{API}/addresses",
        json={**ADDR, "line1": "Second address", "is_default": True},
        headers=auth_headers,
    )
    assert res2.json()["is_default"] is True

    listing = await client.get(f"{API}/addresses", headers=auth_headers)
    defaults = [a for a in listing.json() if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["line1"] == "Second address"


async def test_update_address(client: AsyncClient, auth_headers):
    created = await client.post(f"{API}/addresses", json=ADDR, headers=auth_headers)
    aid = created.json()["id"]
    res = await client.put(
        f"{API}/addresses/{aid}",
        json={"city": "Karachi", "province": "Sindh"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["city"] == "Karachi"
    assert res.json()["recipient_name"] == "Ayesha Khan"  # untouched


async def test_delete_promotes_new_default(client: AsyncClient, auth_headers):
    a1 = await client.post(f"{API}/addresses", json=ADDR, headers=auth_headers)
    await client.post(
        f"{API}/addresses",
        json={**ADDR, "line1": "Second"},
        headers=auth_headers,
    )
    # Delete the default (first) address.
    res = await client.delete(
        f"{API}/addresses/{a1.json()['id']}", headers=auth_headers
    )
    assert res.status_code == 204

    listing = await client.get(f"{API}/addresses", headers=auth_headers)
    data = listing.json()
    assert len(data) == 1
    assert data[0]["is_default"] is True  # remaining one promoted


async def test_cannot_touch_other_users_address(client: AsyncClient, auth_headers):
    created = await client.post(f"{API}/addresses", json=ADDR, headers=auth_headers)
    aid = created.json()["id"]

    other = await client.post(
        f"{API}/auth/register",
        json={**USER, "email": "intruder@example.com"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    res = await client.put(
        f"{API}/addresses/{aid}", json={"city": "Hacked"}, headers=other_headers
    )
    assert res.status_code == 404
