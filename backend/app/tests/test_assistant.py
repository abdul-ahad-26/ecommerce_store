"""Tests for the AI assistant tools + endpoints.

The tool *impl* functions are tested directly against the in-memory DB (no LLM,
no network). The /chat endpoint is only checked for its fail-safe behaviour
when no model key is configured — exercising the live model would need network.
"""

from decimal import Decimal

import pytest_asyncio
from httpx import AsyncClient
from openai.types.responses import ResponseTextDeltaEvent

from app.models.category import Category
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.core.db import Base
from app.schemas.assistant import ChatMessage
from app.services.assistant import stream as stream_mod
from app.services.assistant import tools
from app.tests.conftest import TestSession, engine

API = "/api/v1"


@pytest_asyncio.fixture
async def catalog_data():
    """Seed two users, a published product (2 variants, one sold out), an
    unpublished product, and an order belonging to user A.

    Creates the schema directly (these tests don't use the ``client`` fixture).
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSession() as db:
        cat = Category(name="Lawn", slug="lawn", sort_order=1)
        db.add(cat)
        await db.flush()

        product = Product(
            name="Rose Lawn 3pc",
            slug="rose-lawn-3pc",
            category_id=cat.id,
            base_price=Decimal("4500.00"),
            fabric="Lawn",
            piece_count="3 piece",
            is_published=True,
            variants=[
                ProductVariant(sku="RL-S-RED", size="S", color="Red", stock_qty=4),
                ProductVariant(sku="RL-M-RED", size="M", color="Red", stock_qty=0),
            ],
        )
        hidden = Product(
            name="Secret Draft",
            slug="secret-draft",
            category_id=cat.id,
            base_price=Decimal("9999.00"),
            is_published=False,
            variants=[ProductVariant(sku="SD-1", size="S", stock_qty=3)],
        )
        user_a = User(
            email="a@example.com", password_hash="x", full_name="User A"
        )
        user_b = User(
            email="b@example.com", password_hash="x", full_name="User B"
        )
        db.add_all([product, hidden, user_a, user_b])
        await db.commit()

        order = Order(
            order_number="MRTEST0001",
            user_id=user_a.id,
            subtotal=Decimal("4500.00"),
            total=Decimal("4700.00"),
            customer_name="User A",
            customer_phone="03001234567",
            shipping_line1="House 1",
            shipping_city="Lahore",
            shipping_province="Punjab",
            items=[
                OrderItem(
                    product_name="Rose Lawn 3pc",
                    variant_label="S · Red",
                    unit_price=Decimal("4500.00"),
                    qty=1,
                    line_total=Decimal("4500.00"),
                )
            ],
        )
        db.add(order)
        await db.commit()
        ids = {"user_a": user_a.id, "user_b": user_b.id}

    yield ids

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def test_search_returns_only_published(catalog_data):
    async with TestSession() as db:
        res = await tools.search_products_impl(db, query="lawn")
    slugs = {p["slug"] for p in res["products"]}
    assert "rose-lawn-3pc" in slugs
    assert "secret-draft" not in slugs  # unpublished hidden


async def test_search_is_tokenized(catalog_data):
    # Reordered words + punctuation must still find "Rose Lawn 3pc".
    async with TestSession() as db:
        reordered = await tools.search_products_impl(db, query="lawn rose")
        punctuated = await tools.search_products_impl(db, query="Rose — Lawn!")
    assert "rose-lawn-3pc" in {p["slug"] for p in reordered["products"]}
    assert "rose-lawn-3pc" in {p["slug"] for p in punctuated["products"]}


async def test_product_details_exposes_variant_stock(catalog_data):
    async with TestSession() as db:
        res = await tools.get_product_details_impl(db, "rose-lawn-3pc")
    stock = {(v["size"], v["color"]): v["in_stock"] for v in res["variants"]}
    assert stock[("S", "Red")] is True
    assert stock[("M", "Red")] is False  # sold out


async def test_facets_lists_real_values(catalog_data):
    async with TestSession() as db:
        res = await tools.get_facets_impl(db)
    assert {"slug": "lawn", "name": "Lawn"} in res["categories"]
    assert "S" in res["sizes"] and "M" in res["sizes"]
    assert "Red" in res["colors"]


async def test_present_products_builds_cards(catalog_data):
    async with TestSession() as db:
        cards = await tools.present_products_impl(
            db, ["rose-lawn-3pc", "secret-draft", "does-not-exist"]
        )
    # Only the published product yields a card.
    assert len(cards) == 1
    card = cards[0]
    assert card["slug"] == "rose-lawn-3pc"
    assert card["in_stock"] is True
    # Quick-add points at the first in-stock variant (S / Red, qty 4).
    assert card["variant_id"] and card["available_qty"] == 4


def test_policy_lookup_and_unknown():
    assert "COD" in tools.get_store_policy_impl("cod")["policy"]
    bad = tools.get_store_policy_impl("nope")
    assert bad["error"] == "unknown_topic" and "cod" in bad["valid_topics"]


async def test_order_status_requires_auth(catalog_data):
    async with TestSession() as db:
        res = await tools.get_order_status_impl(db, None, "MRTEST0001")
    assert res["error"] == "auth_required"


async def test_order_status_scoped_to_owner(catalog_data):
    async with TestSession() as db:
        owner = await db.get(User, catalog_data["user_a"])
        other = await db.get(User, catalog_data["user_b"])
        ok = await tools.get_order_status_impl(db, owner, "MRTEST0001")
        denied = await tools.get_order_status_impl(db, other, "MRTEST0001")
    assert ok["status"] == "pending"
    # Never leak another user's order — and signal it distinctly from a guest so
    # the model says "not on your account" rather than "log in".
    assert denied["error"] == "not_found_for_user"


async def test_propose_cart_action_in_stock(catalog_data):
    async with TestSession() as db:
        res = await tools.propose_cart_action_impl(
            db, "rose-lawn-3pc", size="S", color="Red"
        )
    assert res["action"] == "add_to_cart"
    assert res["qty"] == 1 and res["variant_id"]


async def test_propose_cart_action_out_of_stock(catalog_data):
    async with TestSession() as db:
        res = await tools.propose_cart_action_impl(
            db, "rose-lawn-3pc", size="M", color="Red"
        )
    assert res["error"] == "out_of_stock"


async def test_propose_cart_action_ambiguous(catalog_data):
    # No size/colour given -> two variants match -> must ask the customer.
    async with TestSession() as db:
        res = await tools.propose_cart_action_impl(db, "rose-lawn-3pc")
    assert res["error"] == "ambiguous"


async def test_models_endpoint_lists_registry(client: AsyncClient):
    res = await client.get(f"{API}/assistant/models")
    assert res.status_code == 200
    body = res.json()
    keys = {m["key"] for m in body["models"]}
    assert "openai:gpt-4.1-mini" in keys
    assert body["default"] == "openai:gpt-4.1-mini"


def _clear_provider_keys(monkeypatch):
    """Force both provider keys empty so the 'misconfigured' path is exercised
    deterministically, regardless of what's in the developer's .env."""
    from app.services.assistant import models

    monkeypatch.setattr(models.settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(models.settings, "GROQ_API_KEY", "")


async def test_chat_fails_safe_without_api_key(client: AsyncClient, monkeypatch):
    # No provider key configured -> build_model raises -> 503, not a crash.
    _clear_provider_keys(monkeypatch)
    res = await client.post(
        f"{API}/assistant/chat",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code == 503


async def test_chat_stream_fails_safe_without_api_key(
    client: AsyncClient, monkeypatch
):
    _clear_provider_keys(monkeypatch)
    res = await client.post(
        f"{API}/assistant/chat/stream",
        json={"messages": [{"role": "user", "content": "hi"}]},
    )
    assert res.status_code == 503


# --- streaming protocol (fake runner, no network) ------------------------


class _RawDeltaEvent:
    type = "raw_response_event"

    def __init__(self, delta: str):
        self.data = ResponseTextDeltaEvent.model_construct(delta=delta)


class _FakeStreaming:
    """Mimics RunResultStreaming: yields text deltas, then 'tool' fills the
    context's proposed_actions (as the real propose_cart_action tool would)."""

    def __init__(self, deltas, actions, context, products=()):
        self._deltas = deltas
        self._actions = actions
        self._products = products
        self._context = context

    async def stream_events(self):
        for d in self._deltas:
            yield _RawDeltaEvent(d)
        self._context.proposed_actions.extend(self._actions)
        self._context.proposed_products.extend(self._products)


async def test_stream_emits_ai_sdk_protocol(monkeypatch):
    action = {
        "action": "add_to_cart",
        "variant_id": 1,
        "slug": "rose-lawn-3pc",
        "label": "Rose Lawn 3pc — S / Red",
        "qty": 1,
    }

    product = {"slug": "rose-lawn-3pc", "name": "Rose Lawn 3pc", "price": 4500.0}

    def fake_run_streamed(agent, input_items, *, context, max_turns):
        return _FakeStreaming(["Hel", "lo"], [action], context, products=[product])

    monkeypatch.setattr(
        stream_mod, "build_agent", lambda key, page_note="": object()
    )
    monkeypatch.setattr(stream_mod.Runner, "run_streamed", fake_run_streamed)

    ctx = tools.AssistantContext(db=None)  # db unused by the fake
    messages = [ChatMessage(role="user", content="add the small red one")]
    chunks = [
        c
        async for c in stream_mod.stream_assistant(
            context=ctx, messages=messages, model_key="openai:gpt-4.1-mini"
        )
    ]
    joined = "".join(chunks)

    assert chunks[0] == 'data: {"type":"start"}\n\n'
    assert '"type":"text-start"' in joined
    assert '"type":"text-delta"' in joined and '"delta":"Hel"' in joined
    assert '"type":"data-product"' in joined and "rose-lawn-3pc" in joined
    assert '"type":"data-cart-action"' in joined and '"variant_id":1' in joined
    # finish comes after the data parts, and the stream terminates with [DONE].
    assert joined.index('"finish"') > joined.index("data-cart-action")
    assert chunks[-1] == "data: [DONE]\n\n"
