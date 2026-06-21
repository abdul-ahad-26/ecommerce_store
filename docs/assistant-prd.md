# PRD — Meher AI Shopping Assistant

Status: **Draft for build** · Owner: Abdul Ahad · Last updated: 2026-06-20

This PRD covers the whole assistant — what exists, what's broken, and what we'll
build — grounded in verified behavior (reproduced bugs, real catalog data, the
actual SDK versions in the repo). Nothing here is aspirational hand-waving; every
feature maps to a concrete change and acceptance criteria.

---

## 1. Vision & North Star

A floating, bilingual (English / Roman Urdu) shopping assistant that **moves a
shopper from a question to a Cash-on-Delivery order** — by finding the right
piece, showing it (with a picture and a link), answering the doubts that
otherwise kill a COD sale (sizing, shipping, returns), and guiding them into the
cart.

**North-star metric:** assistant-attributed **add-to-carts / orders**.
Everything in this PRD is prioritized by how directly it drives that path:
`question → product card → product page → cart → checkout`.

It is **not** a feature for re-reading details the customer can already see on a
fast, full-screen product page. Its value is **discovery, decision-support, and
guided selling** — see §12 of the conversation that spawned this doc.

---

## 2. Goals & Success Metrics

| Goal | Metric (measurable via traces + light instrumentation) |
|---|---|
| Drive purchases | # of confirmed `add_to_cart` actions per 100 conversations; click-through from chat product cards to PDP |
| Reduce COD abandonment | Share of conversations that ask sizing/shipping/COD and still reach a cart |
| Self-serve support | # order-status / policy questions answered without owner involvement |
| Trust & accuracy | 0 hallucinated stock/price (every fact tool-sourced); 0 cross-account order leaks |
| Cost control | Avg cost/conversation under target on the chosen cheap model |

Instrumentation: OpenAI tracing (live) gives qualitative visibility now. A
minimal `assistant_events` log (cart-action confirmed, card clicked) is a
**Phase 2** add for hard conversion numbers.

---

## 3. Non-Goals

- LLM writing to the database (orders/stock/cart) — the model only **proposes**.
- RAG over the catalog — structured SQL tools are strictly better for
  stock/price/size (decided; see §7).
- A general-purpose assistant (coding, world knowledge) — explicitly out of
  scope and discouraged by prompt (see §6.9).
- Real-time inventory beyond what the catalog API already exposes.

---

## 4. Current State (verified)

**Built and working:**
- Backend agent on the **OpenAI Agents SDK** (`openai-agents 0.17.5`), read-only
  tools over `catalog.py` / `orders.py`, a `propose_cart_action` tool, streaming
  via SSE in the **Vercel AI SDK v6** UI-message-stream protocol.
- Frontend floating widget (`@ai-sdk/react 3.x` `useChat` + `DefaultChatTransport`)
  with token streaming, a confirmable Add-to-cart button, and a dev model picker.
- Model registry (OpenAI + Groq) swappable by env var / per-request.
- Observability: OpenAI dashboard tracing **and** verbose server logs (confirmed
  working).
- 66 backend tests pass; frontend `tsc` clean.

**Confirmed bugs / gaps (reproduced this session):**
- **Groq models 400** — `get_facets` (no args) emits a JSON schema with
  `required` but no `properties`; Groq rejects it. (§6.8)
- **Search misses named products** — the full query is one `ILIKE '%…%'`
  substring, so `"Sana Safinaz Mahay Lawn 3"` → 0 hits (real name interleaves
  "Unstitched"); `"…Shirt + Dupatta"` → 0 (punctuation/spacing). `"Sana Safinaz"`
  alone → 10. (§6.3)
- **Quantity has no stock cap** — PDP `+` increments past available stock;
  customer only learns at checkout. (§6.6)
- **Order-status messaging** — logged-in user querying an order not on their
  account is told to "log in" instead of "not on your account." (§6.5)
- **No product images/links in chat** — bot describes by name/colour/price only;
  wrong for fashion, and doesn't drive to the PDP. (§6.2)
- **No page/product context** — "is this in large?" fails; bot can't see the page.
  (§6.4)
- **No persistence** — refresh wipes the conversation (in-memory only); backend
  is stateless and sets no trace `group_id`, so dashboard runs only *look*
  grouped. (§6.7)
- **No "thinking" indicator** between send and first token. (§6.1)

---

## 5. Personas & Key Journeys

- **Discovery shopper:** "Show me lawn under 5000 / something for a summer
  mehndi." → cards → PDP → cart.
- **On-page shopper:** viewing a product, asks "is this available in large?" /
  "what would I wear with it?" → answered in context → add to cart.
- **Doubtful COD buyer:** "do you deliver to my city / is it really COD / can I
  return?" → reassured → continues.
- **Returning customer:** "track MR48857EB1" (logged in, own order).
- **(Stretch) Visual shopper:** uploads a photo — "what goes with this?" /
  "anything like this?"

---

## 6. Functional Requirements

Each item: **problem → solution → acceptance criteria (AC)**. Ordered by impact
on the north star.

### 6.1 Conversation feels responsive
- **Problem:** dead air between send and first token (#2).
- **Solution:** animated typing indicator (three dots) during `submitted` and
  until the first text delta; keep streaming thereafter.
- **AC:** within 100ms of sending, an animated indicator shows; it disappears as
  text starts streaming.

### 6.2 Product cards with image + link  ⭐ (primary conversion driver, #4)
- **Problem:** fashion is bought by *look*; text-only replies don't sell and
  don't link to the PDP.
- **Solution:** a `present_products(slugs)` tool the model calls to *show* picks.
  It streams a typed `data-product` part per item: `{ slug, name, price,
  on_sale, image, url }`. The widget renders a compact card — **thumbnail, name,
  price, "View" link to `/product/{slug}`**, and (per your choice) an inline
  **Add to cart**. `search_products` and `get_product_details` also return
  `primary_image`.
- **AC:** asking "show me lawn under 5000" renders ≥1 card with a real image and
  a working PDP link; clicking "View" lands on the product page.

### 6.3 Search that finds what the customer names (#9)
- **Problem:** single-substring `ILIKE` misses interleaved/punctuated titles.
- **Solution:** **tokenized search** — split the query on whitespace, strip
  stray punctuation, AND the tokens, each matching name OR description. Applied
  in the shared `catalog.list_products` (benefits storefront search too), with
  tests. Prompt the model to search with **short keywords** (brand + 1–2 words),
  not the full verbose title, and to always `search → take slug →
  get_product_details` (never guess a slug).
- **AC:** `"Sana Safinaz Mahay Lawn 3"` and `"Alkaram Shirt Black White"` each
  return the right product; the bot can then show/add it. Existing catalog tests
  still pass.

### 6.4 Page / product context  ⭐ (#11)
- **Problem:** bot has no idea what's on screen; "is *this* available in large?"
  fails.
- **Solution:** the widget sends `context: { path, product_slug, product_name }`
  in each request body; the per-request system prompt is augmented with *"The
  customer is currently viewing: <name> (<slug>)."* The agent prefers that
  product for "this/it" references.
- **AC:** on a product page, "is this available in large?" answers correctly
  without the customer naming the product.

### 6.5 Order tracking — correct, scoped messaging (#8)
- **Problem:** logged-in user with someone else's order number is told to "log
  in."
- **Solution:** tool returns distinct outcomes: `auth_required` (guest),
  `not_found_for_user` (logged in, no such order on their account), `ok`. Prompt
  maps each to the right line; we **never** reveal another account's order.
- **AC:** guest → "please log in"; logged-in + foreign/unknown number → "I can't
  find that order on your account…"; logged-in + own order → status + items.

### 6.6 Quantity respects stock (#1)
- **Problem:** can select 45 when 3 exist; fails at checkout.
- **Solution:** PDP quantity capped at the selected variant's `stock_qty`;
  disable `+` at max; show "Only N left" when low. `propose_cart_action` enforces
  the same cap (already partly there).
- **AC:** `+` won't exceed available stock; low-stock note appears; assistant
  won't propose more than is in stock.

### 6.7 Persistence + real session grouping (#7)
- **Problem:** refresh wipes the chat; traces only look grouped.
- **Solution:** generate a client **conversation id**; persist messages to
  `sessionStorage` under it; pass the id as the trace **`group_id`** so a
  conversation's runs genuinely group in the OpenAI dashboard.
- **AC:** refresh restores the visible conversation; the dashboard groups that
  conversation's runs under one id.

### 6.8 Groq works (#3)
- **Problem:** param-less tool schema → Groq 400.
- **Solution:** ensure every tool's `params_json_schema` includes
  `"properties": {}` when empty (one normalization pass over `ALL_TOOLS`).
- **AC:** all five registry models (3 OpenAI, 2 Groq) complete a basic
  tool-using turn end-to-end.

### 6.9 Stay in scope, cheaply (#6)
- **Problem:** bot will write code / act as general assistant.
- **Solution (decided: prompt-only + caps, no LLM guardrail):**
  - System prompt: refuse coding/general/off-topic, politely redirect to
    shopping.
  - **Output token cap** via `ModelSettings(max_tokens=…)` — bounds worst-case
    cost of any single reply.
  - **Rate limiting** per session/IP on the chat endpoints.
  - Revisit a lightweight guardrail only if traces show real abuse.
- **AC:** "write a calculator in Python" → polite refusal + redirect; a single
  reply can't exceed the token cap; abusive request rates are throttled.

### 6.10 Model flexibility & observability (done / hardening)
- Keep the registry swap (env + dev picker). Verbose logging behind an
  `ASSISTANT_VERBOSE` flag; OpenAI tracing on when an OpenAI key is present.
- **AC:** switching `ASSISTANT_MODEL` (or the dev dropdown) changes the model on
  the next message; verbose logs show tool calls.

### 6.11 Multimodal — styling + visual search  (v1 **stretch**, after the above)
- **6.11a Styling / "complete the look" (cheap, high sales value):** customer
  uploads a photo; the model reasons about complementary pieces and uses
  `search_products` to suggest pairings, shown as product cards. No new infra.
- **6.11b Visual similarity — attribute match (B1, v1 stretch):** model describes
  the photo (type/colour/pattern) → tokenized catalog search → cards. Reuses 6.3.
- **6.11c Visual similarity — true embeddings (B2, Phase 2):** image embeddings
  for all product images in **pgvector on Neon**; embed the upload; vector
  search. Adds an embedding pipeline + backfill + vector column.
- **AC (v1 stretch):** uploading a shirt photo and asking "what do I wear with
  this?" yields relevant catalog cards; "anything like this?" yields
  attribute-matched cards.

---

## 7. Architecture & Key Decisions

```
Next.js widget (useChat)
  → POST /assistant/chat/stream  (SSE, AI SDK v6 protocol; body: {messages, model?, context})
    → OpenAI Agents SDK agent (per-request; model from registry)
       read-only tools → catalog.py / orders.py
       present_products / propose_cart_action → typed data parts → widget cards/buttons
```

Decisions (locked):
- **Agent-lite:** tool-using loop, read-only data, writes only as *proposals*
  the frontend executes. Safe for COD.
- **No RAG** for catalog; static policy text in a tool/prompt. pgvector reserved
  for **visual** search only (6.11c), not text.
- **Stateless backend;** conversation history travels with each request. Session
  identity is a client id used for persistence + trace `group_id`.
- **Model-agnostic registry;** OpenAI native (tracing) + Groq (OpenAI-compatible).
- **Scope control via prompt + caps,** not a per-message guardrail.

---

## 8. Tool Surface (target)

| Tool | Change | Returns |
|---|---|---|
| `search_products` | tokenized query; add `primary_image` | compact list incl. image |
| `get_product_details` | add images; keep per-variant stock | detail incl. images |
| `get_facets` | **schema fix** (`properties:{}`) | categories/sizes/colours |
| `present_products(slugs)` | **new** — emit `data-product` cards | confirmation; cards streamed |
| `get_store_policy` | unchanged | policy text |
| `get_order_status` | distinct `auth_required` / `not_found_for_user` / `ok` | scoped status |
| `propose_cart_action` | enforce stock cap | `data-cart-action` |

Page context is injected into instructions (not a tool). Multimodal image is an
input content part on the user message.

---

## 9. Data / Schema

- **v1:** no DB migration. `primary_image` already exists via `product_images`;
  we just surface it. Conversation id is client-side only.
- **Phase 2 (6.11c):** enable `pgvector`; add an image-embedding column/table +
  a backfill job; new `search_by_image` path.

---

## 10. Phasing / Roadmap

- **Phase 0 — Correctness (unblocks everything):** 6.8 Groq fix · 6.3 search ·
  6.5 order messaging · 6.6 quantity cap · 6.1 typing indicator.
- **Phase 1 — Guided selling (the north star):** 6.2 product cards (image+link
  +add) · 6.4 page context · 6.9 scope/caps · 6.7 persistence + `group_id` ·
  6.10 hardening.
- **Phase 2 — Multimodal:** 6.11a styling · 6.11b attribute visual search ·
  then 6.11c pgvector visual similarity · `assistant_events` analytics.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model still guesses slugs / over-filters | Prompt rules (search→slug), tokenized search, `get_facets` for real values |
| Image inputs raise cost | Upload size cap; vision only when a photo is attached; cheap model |
| Cost abuse (off-topic) | Prompt refusal + output token cap + rate limit |
| Groq schema/feature drift | Schema normalization pass; keep OpenAI as default/prod |
| AI SDK protocol drift | Wire format isolated in `stream.py`; pin `ai` version |
| Cross-account order leak | Strict `user_id` scoping; `not_found_for_user` never reveals data |

---

## 12. Test Plan (also answers "test the use cases")

After Phase 0/1, validate live (browser automation + manual checklist):
1. "Show me lawn under 5000" → cards with images + working PDP links.
2. "Sana Safinaz Mahay Lawn 3" → finds the exact product; can show/add it.
3. On a PDP: "is this available in large?" → correct, no name needed.
4. "add the small red one" → add-to-cart button → item in cart with right price.
5. Quantity `+` stops at stock; "Only N left" shows.
6. Guest "track MR…": asks to log in. Logged-in foreign order: "not on your
   account." Logged-in own order: status.
7. "write a calculator in Python" → polite refusal.
8. Switch to each Groq model → basic turn completes.
9. Refresh mid-chat → conversation restored; dashboard groups the runs.
10. (Stretch) photo: "what do I wear with this?" / "anything like this?".

---

## 13. Open Questions / Future

- Hard conversion analytics (`assistant_events`) — needed to prove the north
  star; Phase 2.
- Proactive prompts (e.g., open on PDP after dwell) — later, measure first.
- WhatsApp channel reuse of the same agent — possible future, out of scope now.