"""Tests for the auth flow: register, login, me, refresh, and failure cases."""

from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import create_reset_token
from app.models.user import User
from app.tests.conftest import TestSession

PREFIX = "/api/v1/auth"

VALID_USER = {
    "email": "buyer@example.com",
    "password": "supersecret",
    "full_name": "Ayesha Khan",
    "phone": "03001234567",
}


async def _register(client: AsyncClient, **overrides):
    payload = {**VALID_USER, **overrides}
    return await client.post(f"{PREFIX}/register", json=payload)


async def test_register_returns_token_and_user(client: AsyncClient):
    res = await _register(client)
    assert res.status_code == 201
    data = res.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == VALID_USER["email"]
    assert data["user"]["role"] == "customer"
    # refresh cookie should be set
    assert "refresh_token" in res.cookies


async def test_register_duplicate_email_conflicts(client: AsyncClient):
    await _register(client)
    res = await _register(client)
    assert res.status_code == 409


async def test_login_success_and_me(client: AsyncClient):
    await _register(client)
    res = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]

    me = await client.get(
        f"{PREFIX}/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == VALID_USER["email"]


async def test_login_wrong_password_rejected(client: AsyncClient):
    await _register(client)
    res = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": "wrongpass"},
    )
    assert res.status_code == 401


async def test_me_requires_auth(client: AsyncClient):
    res = await client.get(f"{PREFIX}/me")
    assert res.status_code == 401


async def test_me_rejects_garbage_token(client: AsyncClient):
    res = await client.get(
        f"{PREFIX}/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert res.status_code == 401


async def test_refresh_issues_new_access_token(client: AsyncClient):
    reg = await _register(client)
    # The AsyncClient stores the refresh cookie automatically.
    assert "refresh_token" in reg.cookies

    res = await client.post(f"{PREFIX}/refresh")
    assert res.status_code == 200
    assert res.json()["access_token"]


async def test_refresh_without_cookie_rejected(client: AsyncClient):
    res = await client.post(f"{PREFIX}/refresh")
    assert res.status_code == 401


async def test_forgot_password_is_generic_for_unknown_email(client: AsyncClient):
    res = await client.post(
        f"{PREFIX}/forgot-password", json={"email": "nobody@example.com"}
    )
    # Always 202 with the same body — never reveal whether the email exists.
    assert res.status_code == 202
    assert "reset link" in res.json()["detail"].lower()


async def _reset_token_for(email: str) -> str:
    async with TestSession() as db:
        user = await db.scalar(select(User).where(User.email == email))
        return create_reset_token(user.id, user.password_hash)


async def test_reset_password_changes_password_and_token_is_single_use(
    client: AsyncClient,
):
    await _register(client)
    token = await _reset_token_for(VALID_USER["email"])

    res = await client.post(
        f"{PREFIX}/reset-password",
        json={"token": token, "new_password": "brand-new-pass"},
    )
    assert res.status_code == 200

    # Old password no longer works; new one does.
    old = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    assert old.status_code == 401
    new = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": "brand-new-pass"},
    )
    assert new.status_code == 200

    # The same token can't be reused — the fingerprint no longer matches.
    reuse = await client.post(
        f"{PREFIX}/reset-password",
        json={"token": token, "new_password": "another-pass"},
    )
    assert reuse.status_code == 400


async def _auth_headers(client: AsyncClient, **overrides) -> dict[str, str]:
    reg = await _register(client, **overrides)
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


async def test_update_profile(client: AsyncClient):
    headers = await _auth_headers(client)
    res = await client.patch(
        f"{PREFIX}/me",
        json={"full_name": "Ayesha Updated", "phone": "03009998877"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "Ayesha Updated"
    assert res.json()["phone"] == "03009998877"

    me = await client.get(f"{PREFIX}/me", headers=headers)
    assert me.json()["full_name"] == "Ayesha Updated"


async def test_change_password_flow(client: AsyncClient):
    headers = await _auth_headers(client)

    # Wrong current password is rejected.
    bad = await client.post(
        f"{PREFIX}/change-password",
        json={"current_password": "nope", "new_password": "freshpass1"},
        headers=headers,
    )
    assert bad.status_code == 400

    ok = await client.post(
        f"{PREFIX}/change-password",
        json={
            "current_password": VALID_USER["password"],
            "new_password": "freshpass1",
        },
        headers=headers,
    )
    assert ok.status_code == 204

    # Old password no longer works; new one does.
    old = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": VALID_USER["password"]},
    )
    assert old.status_code == 401
    new = await client.post(
        f"{PREFIX}/login",
        json={"email": VALID_USER["email"], "password": "freshpass1"},
    )
    assert new.status_code == 200


async def test_change_password_requires_auth(client: AsyncClient):
    res = await client.post(
        f"{PREFIX}/change-password",
        json={"current_password": "x", "new_password": "yyyyyyyy"},
    )
    assert res.status_code == 401


async def test_reset_password_rejects_garbage_token(client: AsyncClient):
    res = await client.post(
        f"{PREFIX}/reset-password",
        json={"token": "not-a-token", "new_password": "whatever123"},
    )
    assert res.status_code == 400
