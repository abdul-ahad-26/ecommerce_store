# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

"Meher" — a decoupled e-commerce store for Pakistani women's wear (Cash-on-Delivery first). Two independent apps in one repo: `backend/` (FastAPI) and `frontend/` (Next.js). They talk over HTTPS/JSON; there is no shared package.

## Commands

All backend commands run from `backend/` (uv pins Python 3.12):

```bash
uv sync                                   # install deps
uv run alembic upgrade head               # apply migrations
uv run python seed.py                     # reset catalog + ensure admin (idempotent on admin)
uv run uvicorn app.main:app --reload --port 8000
uv run pytest                             # full suite (in-memory SQLite, no DB needed)
uv run pytest app/tests/test_orders.py::test_guest_checkout_succeeds   # single test
uv run alembic revision --autogenerate -m "msg"   # after changing models
```

Frontend commands run from `frontend/`:

```bash
npm install
npm run dev            # localhost:3000
npx tsc --noEmit       # type-check — this is the only frontend "test" gate
npm run build          # production build
```

Local dev needs a `DATABASE_URL` in `backend/.env` (Neon Postgres) and `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (defaults to `http://localhost:8000/api/v1`). See the `.env.example` files.

## Architecture

**Topology:** Next.js (Vercel) → FastAPI (Render, Docker) → PostgreSQL (Neon); product images on Cloudinary. Everything is env-driven so the same code runs locally and in prod.

**Backend** (`app/`):
- `main.py` is an app factory; routers live under `api/v1/` and are aggregated in `api/v1/router.py` under the `/api/v1` prefix.
- **Layering:** thin routers → `services/` (business logic: `catalog.py`, `orders.py`, `admin.py`) → SQLAlchemy 2.0 **async** models. `core/config.py` (pydantic-settings), `core/db.py` (async engine/session + `Base`), `core/security.py` (bcrypt + JWT).
- **Auth/authorization** in `deps.py`: `CurrentUser`, `OptionalUser` (guest checkout), `AdminUser` (role gate). Access tokens are short-lived JWTs in the `Authorization` header; the refresh token is an httpOnly cookie (`auth.py`).
- **Checkout** (`services/orders.py`) is one transaction: lock variant rows, validate stock, compute totals, create order + items, decrement stock. Order items **snapshot** product name/price/slug/image so orders stay intact when the catalog changes.

**Frontend** (`src/`):
- App Router. **Server Components** fetch catalog data for SSR/SEO (home, `/shop`, `/category/[slug]`, `/product/[slug]`). **Client Components** handle interactivity (cart, checkout, account, all of `/admin`).
- `lib/api.ts` is the single fetch wrapper: injects the in-memory access token, sends credentials, and on a 401 transparently calls a registered refresh handler and retries once. Typed API clients: `lib/catalog.ts`, `lib/orders.ts`, `lib/auth.ts`, `lib/addresses.ts`, `lib/admin.ts`.
- State: **Zustand** `store/cart.ts` (localStorage-persisted) and `store/auth.ts` (in-memory token; `AuthProvider` does a silent `/auth/refresh` on load to restore the session). **TanStack Query** for client-side lists (account, admin).
- Design system lives in `app/globals.css` via Tailwind 4 `@theme` tokens (paper/ink/madder/gold palette, Fraunces + Hanken Grotesk + Noto Nastaliq Urdu fonts). Reusable shells: `components/info-page.tsx`, `components/product-listing.tsx`.

## Critical gotchas (learned the hard way)

- **Neon + asyncpg:** `core/config.py` strips libpq-only query params (`sslmode`, `channel_binding`) that asyncpg rejects, re-adds SSL, and sets `statement_cache_size=0` (required for Neon's PgBouncer pooler). Use the `postgresql+asyncpg://` scheme; paste Neon URLs as-is.
- **Postgres row locking:** the checkout query uses `joinedload(..., innerjoin=True)` + `with_for_update(of=ProductVariant)` because Postgres rejects `FOR UPDATE` on the nullable side of an outer join. **SQLite tests don't catch this** — verify checkout against real Postgres.
- **`EmailStr` rejects reserved TLDs** (`.test`, `.example`). Seed/admin emails use a real domain (`admin@store.pk` / `admin12345`).
- **`NEXT_PUBLIC_*` env vars are baked at build time** — changing them on Vercel requires a **redeploy**, not just a save. A missing/wrong `NEXT_PUBLIC_API_URL` makes the storefront silently empty (catalog fetch fails → falls back to `[]`).
- **Tests use in-memory SQLite** (`app/tests/conftest.py`, StaticPool) with the `get_db` dependency overridden — no external DB required, but Postgres-specific behavior won't surface there.
- **Orders are immutable records.** To retire a product, set `is_published = false` (keeps order links live) rather than hard-deleting.

## Next.js 16 note

`frontend/AGENTS.md` (imported by `frontend/CLAUDE.md`) warns that this Next.js version differs from training data — **read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing frontend code.** Key differences already in play: `fetch` is **not** cached by default; route `params` and `searchParams` are **Promises** (await them, or `use()` in client components).

## Deployment

Deployed from GitHub: **Vercel** (root `frontend/`) + **Render** (root `backend/`, builds `backend/Dockerfile` which runs migrations then uvicorn on `$PORT`) + **Neon** (DB). Cross-origin auth requires `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and `CORS_ORIGINS` set to the exact Vercel origin on the backend. Full step-by-step is in `README.md`.
