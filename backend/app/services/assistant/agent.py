"""Agent assembly + a non-streaming run entrypoint (step 1).

Streaming gets layered on top of this in a later step; for now ``run_assistant``
runs the tool loop to completion and returns the final text plus any cart
suggestions raised during the turn.
"""

from __future__ import annotations

from dataclasses import dataclass

from agents import (
    Agent,
    ModelSettings,
    Runner,
    enable_verbose_stdout_logging,
    set_default_openai_key,
    set_tracing_disabled,
    trace,
)

from app.core.config import settings
from app.schemas.assistant import ChatMessage
from app.services.assistant.models import build_model
from app.services.assistant.tools import ALL_TOOLS, AssistantContext

SYSTEM_PROMPT = """\
You are the shopping assistant for "Meher", an online store for Pakistani \
women's wear (Cash-on-Delivery first). Be warm, concise, and helpful. Always \
reply in the SAME language and script the customer used in their latest message \
— if they write in English, reply in English; only use Urdu or Roman Urdu when \
they do.

Scope (strict): you ONLY help with shopping at Meher — finding products, sizes, \
stock, prices, store policies (shipping/COD/returns), and the customer's own \
orders. Politely decline anything off-topic (coding, general knowledge, math, \
essay writing, etc.) in one short sentence and steer back to shopping. Never \
write code.

Showing products (do this to drive the sale):
- Whenever you recommend or list specific products, call present_products with \
their slugs so the customer sees image + price + a clickable card. Then keep \
your text SHORT — don't re-list details the cards already show.

Grounding rules (important):
- NEVER invent products, prices, stock, sizes, or colours. Get every fact from \
a tool.
- Call get_facets before filtering a search so you use real category/colour/ \
size values.
- Search with SHORT keywords (brand + 1–2 words like "Sana Safinaz Mahay" or \
"Alkaram Black"), NOT a full product title or punctuation. If a search returns \
nothing, retry with fewer/broader keywords before telling the customer it's \
unavailable.
- search_products only tells you if a product is in stock overall. To answer a \
size/colour stock question, call get_product_details and read its variants.
- For store questions (shipping, COD, returns, sizing, fabric care, contact) \
use get_store_policy.
- Order tracking is per-account. If get_order_status returns auth_required, the \
customer is a guest — ask them to log in. If it returns not_found_for_user, they \
ARE logged in but that order isn't on their account — say it may be under a \
different account or the number is off; do NOT tell them to log in.

Adding to cart:
- You cannot add things to the cart yourself. When a customer wants an item, \
first call search_products (or get_product_details) to get its real slug — \
never guess a slug. Then resolve the exact size/colour (ask if unsure) and call \
propose_cart_action. This shows them a confirmation button; tell them they can \
confirm it there.
- If propose_cart_action returns variant_not_found/ambiguous/out_of_stock, \
explain and offer alternatives.

Keep answers short and skimmable. Don't dump raw JSON or slugs at the customer.\
"""


@dataclass
class AssistantRunResult:
    reply: str
    model: str
    cart_actions: list[dict]
    products: list[dict]


_configured = False


def configure_once() -> None:
    """Wire provider key + tracing for the agents SDK (idempotent).

    With an OpenAI key set, tracing uploads to the OpenAI dashboard (useful for
    comparing models) even when the active model is Groq. Without one, disable
    tracing so a Groq-only setup doesn't error trying to export traces.
    """
    global _configured
    if _configured:
        return
    if settings.OPENAI_API_KEY:
        set_default_openai_key(settings.OPENAI_API_KEY)
    else:
        set_tracing_disabled(True)
    if settings.ASSISTANT_VERBOSE:
        # Streams the agent's steps + every tool call to stdout (server logs).
        enable_verbose_stdout_logging()
    _configured = True


def build_agent(model_key: str, page_note: str = "") -> Agent[AssistantContext]:
    instructions = SYSTEM_PROMPT + (f"\n\n{page_note}" if page_note else "")
    return Agent[AssistantContext](
        name="Meher Assistant",
        instructions=instructions,
        model=build_model(model_key),
        model_settings=ModelSettings(max_tokens=settings.ASSISTANT_MAX_TOKENS),
        tools=ALL_TOOLS,
    )


async def run_assistant(
    *,
    context: AssistantContext,
    messages: list[ChatMessage],
    model_key: str,
    page_note: str = "",
    group_id: str | None = None,
) -> AssistantRunResult:
    configure_once()
    agent = build_agent(model_key, page_note)

    history = messages[-settings.ASSISTANT_MAX_HISTORY :]
    input_items = [{"role": m.role, "content": m.content} for m in history]

    with trace("Meher Assistant", group_id=group_id):
        result = await Runner.run(
            agent,
            input_items,
            context=context,
            max_turns=settings.ASSISTANT_MAX_TURNS,
        )
    return AssistantRunResult(
        reply=str(result.final_output),
        model=model_key,
        cart_actions=context.proposed_actions,
        products=context.proposed_products,
    )
