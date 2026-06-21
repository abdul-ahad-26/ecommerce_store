"""Assistant tools — thin, read-only wrappers over the catalog/order services.

Each tool has two layers:
  * a plain ``*_impl`` coroutine (takes an ``AsyncSession``) — easy to unit-test
    without the agents SDK, and the place the actual logic lives;
  * a ``@function_tool`` wrapper that pulls the request-scoped session/user off
    the run context and delegates to the impl.

Returns are compact JSON-able dicts (no images/ids the model doesn't need) to
keep token cost down.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from agents import RunContextWrapper, function_tool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.services import catalog, orders
from app.services.catalog import ProductSort
from app.services.assistant.policy import POLICIES, POLICY_TOPICS


@dataclass
class AssistantContext:
    """Per-request state handed to every tool via the run context."""

    db: AsyncSession
    user: User | None = None
    # Cart suggestions raised this turn by ``propose_cart_action`` — the
    # endpoint reads these out and forwards them to the frontend.
    proposed_actions: list[dict] = field(default_factory=list)
    # Product cards raised this turn by ``present_products`` — streamed to the
    # widget as data-product parts (image + price + link to the PDP).
    proposed_products: list[dict] = field(default_factory=list)


# --- plain implementations (testable) ------------------------------------


def _to_decimal(value: float | int | str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


async def search_products_impl(
    db: AsyncSession,
    *,
    query: str | None = None,
    category: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    sort: str = "newest",
) -> dict:
    try:
        sort_enum = ProductSort(sort)
    except ValueError:
        sort_enum = ProductSort.newest

    result = await catalog.list_products(
        db,
        search=query,
        category=category,
        color=color,
        size=size,
        max_price=_to_decimal(max_price),
        sort=sort_enum,
        page=1,
        page_size=8,
    )
    return {
        "total_matches": result.total,
        "showing": len(result.items),
        "products": [
            {
                "name": p.name,
                "slug": p.slug,
                "price": float(p.price),
                "on_sale": p.on_sale,
                "in_stock": p.in_stock,
                "category": p.category_name,
                "fabric": p.fabric,
                "piece_count": p.piece_count,
            }
            for p in result.items
        ],
    }


async def get_product_details_impl(db: AsyncSession, slug: str) -> dict:
    product = await catalog.get_product_by_slug(db, slug)
    if product is None:
        return {"error": "not_found", "slug": slug}
    detail = catalog.map_detail(product)
    return {
        "name": detail.name,
        "slug": detail.slug,
        "description": detail.description,
        "fabric": detail.fabric,
        "piece_count": detail.piece_count,
        "price": float(detail.price),
        "on_sale": detail.on_sale,
        "category": detail.category.name,
        "variants": [
            {
                "size": v.size,
                "color": v.color,
                "in_stock": v.in_stock,
                "price": float(v.price),
            }
            for v in detail.variants
        ],
    }


async def present_products_impl(db: AsyncSession, slugs: list[str]) -> list[dict]:
    """Build compact product cards (image, price, link target, quick-add variant)
    for the given slugs — what the widget renders to drive clicks to the PDP."""
    cards: list[dict] = []
    seen: set[str] = set()
    for slug in slugs:
        slug = slug.strip()
        if not slug or slug in seen:
            continue
        seen.add(slug)
        product = await catalog.get_product_by_slug(db, slug)
        if product is None:
            continue
        image = product.images[0].url if product.images else None
        addable = next((v for v in product.variants if v.stock_qty > 0), None)
        card = {
            "slug": product.slug,
            "name": product.name,
            "price": float(catalog.effective_product_price(product)),
            "on_sale": product.sale_price is not None,
            "image": image,
            "in_stock": addable is not None,
            "variant_id": None,
            "variant_label": None,
            "unit_price": None,
            "available_qty": None,
        }
        if addable is not None:
            label_bits = " / ".join(
                b for b in (addable.size, addable.color) if b
            )
            card["variant_id"] = addable.id
            card["variant_label"] = label_bits or None
            card["unit_price"] = float(catalog.map_variant(product, addable).price)
            card["available_qty"] = addable.stock_qty
        cards.append(card)
    return cards


async def get_facets_impl(db: AsyncSession, kind: str | None = None) -> dict:
    """Valid filter values, so the model doesn't guess exact-match terms.

    ``kind`` optionally narrows the result to "categories", "sizes", or
    "colors"; omit it for all three.
    """
    want = (kind or "").strip().lower()
    result: dict = {}

    if want in ("", "categories"):
        cats = (
            await db.scalars(select(Category).order_by(Category.sort_order))
        ).all()
        result["categories"] = [{"slug": c.slug, "name": c.name} for c in cats]

    if want in ("", "sizes"):
        sizes = (
            await db.scalars(
                select(ProductVariant.size)
                .join(Product, ProductVariant.product_id == Product.id)
                .where(
                    Product.is_published.is_(True), ProductVariant.size.is_not(None)
                )
                .distinct()
            )
        ).all()
        result["sizes"] = sorted(s for s in sizes if s)

    if want in ("", "colors"):
        colors = (
            await db.scalars(
                select(ProductVariant.color)
                .join(Product, ProductVariant.product_id == Product.id)
                .where(
                    Product.is_published.is_(True), ProductVariant.color.is_not(None)
                )
                .distinct()
            )
        ).all()
        result["colors"] = sorted(c for c in colors if c)

    return result


def get_store_policy_impl(topic: str) -> dict:
    text = POLICIES.get(topic.strip().lower())
    if text is None:
        return {"error": "unknown_topic", "valid_topics": POLICY_TOPICS}
    return {"topic": topic, "policy": text}


async def get_order_status_impl(
    db: AsyncSession, user: User | None, order_number: str
) -> dict:
    if user is None:
        return {
            "error": "auth_required",
            "message": "Ask the customer to log in to track their order.",
        }
    order = await orders.get_order_by_number(db, order_number.strip())
    # Scope strictly to the logged-in user — never expose another customer's
    # order (which would leak name/address/phone). Distinct from auth_required so
    # the model tells a logged-in user "not on your account" instead of "log in".
    if order is None or order.user_id != user.id:
        return {
            "error": "not_found_for_user",
            "order_number": order_number,
            "message": "No order with that number is on this account.",
        }
    return {
        "order_number": order.order_number,
        "status": order.status,
        "total": float(order.total),
        "placed_at": order.placed_at.isoformat(),
        "items": [
            {"name": i.product_name, "variant": i.variant_label, "qty": i.qty}
            for i in order.items
        ],
    }


async def propose_cart_action_impl(
    db: AsyncSession,
    slug: str,
    *,
    size: str | None = None,
    color: str | None = None,
    qty: int = 1,
) -> dict:
    product = await catalog.get_product_by_slug(db, slug)
    if product is None:
        return {"error": "not_found", "slug": slug}

    variants = product.variants
    matches = [
        v
        for v in variants
        if (size is None or v.size == size) and (color is None or v.color == color)
    ]
    available = [
        {"size": v.size, "color": v.color, "in_stock": v.stock_qty > 0}
        for v in variants
    ]
    if not matches:
        return {"error": "variant_not_found", "available": available}
    if len(matches) > 1:
        # Ambiguous — make the model ask the customer to pick.
        return {"error": "ambiguous", "options": available}

    variant = matches[0]
    qty = max(1, qty)
    if variant.stock_qty < qty:
        return {"error": "out_of_stock", "available_qty": variant.stock_qty}

    label_bits = " / ".join(b for b in (variant.size, variant.color) if b)
    label = f"{product.name} — {label_bits}" if label_bits else product.name
    # Enrich with everything the frontend cart needs (price/image/labels) so the
    # widget can add the item without a second round-trip.
    price = catalog.map_variant(product, variant).price
    image = product.images[0].url if product.images else None
    return {
        "action": "add_to_cart",
        "variant_id": variant.id,
        "slug": slug,
        "product_name": product.name,
        "variant_label": label_bits or None,
        "unit_price": float(price),
        "image": image,
        "qty": qty,
        "available_qty": variant.stock_qty,  # soft cap for the cart steppers
        "label": label,
    }


# --- function_tool wrappers (what the agent calls) -----------------------
#
# strict_json_schema=False for cross-provider support: OpenAI's strict mode
# forces the model to emit every parameter (optionals become nullable+required).
# OpenAI complies, but Groq's Llama omits optional args and Groq then rejects its
# own tool call ("missing properties: …"). Non-strict accepts partial args; for
# these simple read-only tools the reliability cost on OpenAI is negligible.


@function_tool(strict_mode=False)
async def search_products(
    ctx: RunContextWrapper[AssistantContext],
    query: str | None = None,
    category: str | None = None,
    color: str | None = None,
    size: str | None = None,
    max_price: float | None = None,
    sort: str = "newest",
) -> dict:
    """Search the published catalog. Returns up to 8 matching products.

    Use exact filter values from get_facets for category/color/size. `query`
    does a keyword match on name/description. `sort` is one of: newest,
    price_asc, price_desc, name. Returns each product's `in_stock` flag only —
    call get_product_details for per-size/colour stock.

    Args:
        query: Free-text keywords to match in the name/description.
        category: Category slug (from get_facets).
        color: Exact colour name (from get_facets).
        size: Exact size label (from get_facets).
        max_price: Maximum price in PKR.
        sort: Result ordering.
    """
    return await search_products_impl(
        ctx.context.db,
        query=query,
        category=category,
        color=color,
        size=size,
        max_price=max_price,
        sort=sort,
    )


@function_tool(strict_mode=False)
async def get_product_details(
    ctx: RunContextWrapper[AssistantContext], slug: str
) -> dict:
    """Get full details for one product, including per-variant (size/colour)
    stock. Always use this to answer stock or size/colour-availability
    questions.

    Args:
        slug: The product slug from a search result.
    """
    return await get_product_details_impl(ctx.context.db, slug)


@function_tool(strict_mode=False)
async def present_products(
    ctx: RunContextWrapper[AssistantContext], slugs: list[str]
) -> dict:
    """Show the customer visual product cards (image, price, link to the product
    page, quick add-to-cart). ALWAYS call this when you recommend or list
    specific products, passing their slugs (from search results, up to 6). Keep
    your own text short afterwards — the cards already show the details.

    Args:
        slugs: Product slugs to display as cards.
    """
    cards = await present_products_impl(ctx.context.db, slugs[:6])
    ctx.context.proposed_products.extend(cards)
    return {"shown": len(cards), "slugs": [c["slug"] for c in cards]}


@function_tool(strict_mode=False)
async def get_facets(
    ctx: RunContextWrapper[AssistantContext], kind: str | None = None
) -> dict:
    """List the valid category slugs, sizes, and colours in the catalog. Call
    this before filtering search_products so you use real values.

    Args:
        kind: Optionally limit to "categories", "sizes", or "colors". Omit for all.
    """
    return await get_facets_impl(ctx.context.db, kind)


@function_tool(strict_mode=False)
async def get_store_policy(
    ctx: RunContextWrapper[AssistantContext], topic: str
) -> dict:
    """Look up store policy. Valid topics: shipping, cod, returns, sizing,
    fabric_care, contact.

    Args:
        topic: One of the valid policy topics.
    """
    return get_store_policy_impl(topic)


@function_tool(strict_mode=False)
async def get_order_status(
    ctx: RunContextWrapper[AssistantContext], order_number: str
) -> dict:
    """Look up the status of the logged-in customer's order by its number
    (e.g. "MR1A2B3C4D"). Returns auth_required for guests, not_found_for_user
    when the logged-in customer has no such order on their account, otherwise
    the order's status + items.

    Args:
        order_number: The order number to look up.
    """
    return await get_order_status_impl(
        ctx.context.db, ctx.context.user, order_number
    )


@function_tool(strict_mode=False)
async def propose_cart_action(
    ctx: RunContextWrapper[AssistantContext],
    slug: str,
    size: str | None = None,
    color: str | None = None,
    qty: int = 1,
) -> dict:
    """Propose adding a specific in-stock variant to the cart. This does NOT add
    anything itself — it returns a suggestion the customer confirms with a
    button. Resolve the exact size/colour first (ask the customer if unsure).
    On success returns the action; otherwise an error to act on.

    Args:
        slug: The product slug.
        size: Exact size of the desired variant.
        color: Exact colour of the desired variant.
        qty: Quantity (defaults to 1).
    """
    result = await propose_cart_action_impl(
        ctx.context.db, slug, size=size, color=color, qty=qty
    )
    if result.get("action") == "add_to_cart":
        ctx.context.proposed_actions.append(result)
    return result


ALL_TOOLS = [
    search_products,
    get_product_details,
    present_products,
    get_facets,
    get_store_policy,
    get_order_status,
    propose_cart_action,
]
