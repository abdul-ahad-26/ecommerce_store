# PRD — Meher AI Shopping Assistant

Status: **Phase 0 & 1 shipped + deployed** · Phase 2 (multimodal) pending ·
Owner: Abdul Ahad · Last updated: 2026-06-21

This PRD covers the whole assistant — what exists, what was fixed, and what's
next — grounded in verified behavior (reproduced bugs, real catalog data, live
production testing, the actual SDK versions in the repo). Every feature maps to a
concrete change and acceptance criteria. Phase 0/1 items below are **done and
verified in the browser against production**; §6.11 (multimodal) is the remaining
work.

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

## 4. Current State (shipped & deployed)

**Stack (live):**
- Backend agent on the **OpenAI Agents SDK** (`openai-agents 0.17.5`), read-only
  tools over `catalog.py` / `orders.py`, `present_products` + `propose_cart_action`
  tools, streaming via SSE in the **Vercel AI SDK v6** UI-message-stream protocol.
- Frontend floating widget (`@ai-sdk/react 3.x` `useChat` + `DefaultChatTransport`)
  with token streaming, product cards, and confirmable add-to-cart.
- Model registry (OpenAI + Groq) swappable by env var; **dev-only** model picker.
- Observability: OpenAI tracing + `ASSISTANT_VERBOSE` server logs (both confirmed).
- Deployed: Vercel (frontend) + Render (backend) + Neon (DB). **68 backend tests
  pass; frontend `tsc` clean.**

**Phase 0 — correctness (all shipped):**
- ✅ Groq tool-calling fixed (real cause: strict mode + a param-less tool — see §6.8)
- ✅ Tokenized catalog search (finds products by any word/order/punctuation) (§6.3)
- ✅ Order-status returns `not_found_for_user` vs `auth_required` (§6.5)
- ✅ Quantity capped at stock on PDP **and** cart (§6.6)
- ✅ Animated typing indicator (§6.1)

**Phase 1 — guided selling (all shipped):**
- ✅ `present_products` → image/price/PDP-link/add-to-cart cards (§6.2)
- ✅ Page/product context — "is *this* in large?" resolves (§6.4)
- ✅ Scope guard (prompt + `max_tokens` cap + per-IP rate limit) (§6.9)
- ✅ Refresh-clears / navigation-retains chat + per-load trace `group_id` (§6.7)
- ✅ Model picker hidden in prod; language mirrors the customer (§6.10)

**Known production issue (open):**
- **Groq `gpt-oss-120b` is intermittently inaccurate.** Live, the same "lawn
  under 5000" query once returned "we don't have any under Rs 5,000" (false — a
  Rs 3,299 item exists) and once returned it correctly. The backend/search/data
  are proven correct; the model fumbles multi-constraint (category + price) tool
  calls. **Decision: run production on `openai:gpt-4.1-mini` for reliability**
  (see §6.10 / §7). Groq stays for dev only.

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

### 6.6 Quantity respects stock (#1) — ✅ shipped
- **Problem:** can select 45 when 3 exist; fails at checkout (PDP **and** cart).
- **Solution:** the cart store carries `maxQty` (available stock at add-time) and
  clamps centrally in `addItem`/`setQty`, so every `+` (PDP and cart page) is
  capped; `+` disables at max with an "Only N left" / "Max available" note.
  `propose_cart_action` and product cards pass `available_qty` so chatbot-added
  items are capped too. Checkout still re-validates against the live DB.
- **AC:** `+` won't exceed available stock on PDP or cart; low-stock note shows;
  assistant won't propose more than is in stock. ✅ verified.

### 6.7 Refresh-clears / navigation-retains + session grouping (#7) — ✅ shipped
- **Decision (changed):** we initially added `sessionStorage` persistence so a
  refresh *kept* the chat. The owner then chose the opposite: **a hard refresh
  should start a fresh chat, but client-side navigation should keep it.**
- **Solution:** drop message persistence and rely on in-memory React state. The
  widget lives in the layout, so it is **not** remounted on client-side
  navigation (chat retained) but **is** reset on a hard refresh (chat cleared). A
  new **conversation id** is generated per page load and passed as the trace
  **`group_id`** so a session's runs group in the OpenAI dashboard.
- **AC:** navigate between pages → chat retained; hard refresh → chat clears +
  new trace group. ✅ verified live.

### 6.8 Groq works (#3) — ✅ shipped (with a caveat)
- **Problem:** Groq 400'd on tool calls. The "empty `properties`" theory was a
  red herring (the payload already had it).
- **Real cause + fix (two layers):** (1) `get_facets` took no args → gave it a
  real optional `kind` param so no tool sends an empty schema; (2) the actual
  blocker was **strict mode** — OpenAI's strict function schema forces the model
  to emit every parameter, and Groq's Llama omits optionals then rejects its own
  call. Set `strict_mode=False` on all tools (negligible on OpenAI, essential for
  any OpenAI-compatible provider).
- **AC:** OpenAI models + `groq:gpt-oss-120b` complete tool-using turns. ⚠️
  `groq:llama-3.3-70b` intermittently fails to format tool calls → labelled
  "(flaky tools)"; `gpt-oss-120b` is the recommended Groq model. See §4 for the
  separate `gpt-oss-120b` accuracy caveat that drives the prod-model choice.

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

### 6.10 Model flexibility & observability — ✅ shipped
- Registry swap via `ASSISTANT_MODEL`. The dev model picker is gated by
  `ASSISTANT_ALLOW_MODEL_OVERRIDE`, which now **defaults `False`** so the picker
  and per-request model switching are **hidden in production** (no public model
  switching / cost abuse); enable it via `.env` in dev.
- `ASSISTANT_VERBOSE` flag streams agent steps + tool calls to server logs;
  OpenAI tracing works whenever an OpenAI key is present (even on Groq runs).
- The system prompt **mirrors the customer's language/script** (English in →
  English out; only Urdu/Roman Urdu when they use it).
- **Production model decision:** default to **`openai:gpt-4.1-mini`** for
  accuracy + native tracing; `gpt-oss-120b` (Groq) is the free dev option.
- **AC:** picker absent in prod; verbose logs show tool calls; English prompt →
  English reply. ✅ verified live.

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
- **Stateless backend;** conversation history travels with each request. The
  client conversation id (regenerated per page load) is used only for trace
  `group_id` — there is **no message persistence** (refresh starts fresh).
- **Model-agnostic registry;** OpenAI native (tracing) + Groq (OpenAI-compatible).
  **Production runs `openai:gpt-4.1-mini`** for reliability; Groq is dev-only
  (cheaper/faster but intermittently inaccurate on filtered queries — see §4).
- **Scope control via prompt + caps,** not a per-message guardrail.

---

## 8. Tool Surface (target)

| Tool | Change | Returns |
|---|---|---|
| `search_products` | tokenized query; add `primary_image` | compact list incl. image |
| `get_product_details` | add images; keep per-variant stock | detail incl. images |
| `get_facets` | add optional `kind` param + `strict_mode=False` (Groq fix) | categories/sizes/colours |
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

- **Phase 0 — Correctness — ✅ DONE & deployed:** 6.8 Groq fix · 6.3 search ·
  6.5 order messaging · 6.6 quantity cap · 6.1 typing indicator.
- **Phase 1 — Guided selling — ✅ DONE & deployed:** 6.2 product cards (image+
  link+add) · 6.4 page context · 6.9 scope/caps · 6.7 refresh/nav chat behavior
  + `group_id` · 6.10 hardening (prod model = gpt-4.1-mini; picker hidden).
- **Phase 2 — Multimodal (next):** 6.11a styling · 6.11b attribute visual search ·
  then 6.11c pgvector visual similarity · `assistant_events` analytics.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Model still guesses slugs / over-filters | Prompt rules (search→slug), tokenized search, `get_facets` for real values |
| Image inputs raise cost | Upload size cap; vision only when a photo is attached; cheap model |
| Cost abuse (off-topic) | Prompt refusal + output token cap + rate limit |
| Groq inaccuracy on filtered queries (observed in prod) | Run prod on `openai:gpt-4.1-mini`; Groq dev-only; `strict_mode=False` for compatibility |
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
9. Navigate mid-chat → conversation retained; hard refresh → chat clears.
10. (Stretch) photo: "what do I wear with this?" / "anything like this?".

---

## 13. Open Questions / Future

- Hard conversion analytics (`assistant_events`) — needed to prove the north
  star; Phase 2.
- Proactive prompts (e.g., open on PDP after dwell) — later, measure first.
- WhatsApp channel reuse of the same agent — possible future, out of scope now.