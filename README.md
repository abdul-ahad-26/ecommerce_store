# Meher — Pakistani Women's Wear Store (مہر)

A full-stack e-commerce store for premium Pakistani women's wear — lawn, stitched
& unstitched shalwar kameez — built for the **local Pakistan market** with a
**Cash-on-Delivery-first** checkout.

> Editorial "Atelier Heritage" storefront · guest & account checkout · role-gated
> admin panel · typed Python API · 44 automated tests.

<!-- After deploying, fill these in: -->
**🔗 Live demo:** _add Vercel URL_ &nbsp;·&nbsp; **🛠️ Admin demo:** _add URL_ `/admin`
(`admin@store.pk` / `admin12345`)

<!-- Add 2–3 screenshots here after deploy:
![Home](docs/home.png)
![Product](docs/product.png)
![Admin](docs/admin.png)
-->

---

## Why this project

A decoupled **Next.js + FastAPI** build that mirrors how a real production store is
structured: a TypeScript storefront, a typed Python API with auto-generated
OpenAPI docs, a managed Postgres database, and image hosting on a CDN — deployed
across three platforms with cross-origin auth done properly.

## Features

**Storefront**
- Editorial, mobile-responsive design with a bilingual (Latin + Urdu Nastaliq) brand mark
- Catalog browsing: categories, search, brand/size/price filters, sorting, pagination
- Product pages with image gallery + size/colour variant selection (SSR for SEO)
- Cart (persisted) → **Cash-on-Delivery checkout** with live stock validation
- Order confirmation + order history with product thumbnails

**Accounts**
- Register / login with JWT (short-lived access token + httpOnly refresh cookie)
- Saved addresses (exclusive default) · checkout pre-fill · guest checkout supported

**Admin** (`/admin`, role-gated)
- Dashboard: revenue, order/product counts, low-stock alerts, recent orders
- Product CRUD with variant management + Cloudinary image upload
- Category management · order status workflow (pending → delivered)

**Engineering**
- Single-transaction checkout with row-locked stock decrement (no oversell)
- Order line-items snapshot name/price/image/slug — orders stay intact if the catalog changes
- Transparent access-token refresh-and-retry
- SEO: dynamic `sitemap.xml`, `robots.txt`, product JSON-LD, Open Graph
- **44 backend tests** (auth, catalog, checkout, accounts, admin authorization)

## Architecture

```
┌────────────────────┐        HTTPS / JSON         ┌─────────────────────┐
│  Next.js (Vercel)  │  ───────────────────────►   │  FastAPI (Render)   │
│  storefront/admin  │  ◄───────────────────────   │     /api/v1/*       │
└────────────────────┘   refresh cookie (httpOnly) └──────────┬──────────┘
         │                                                     │ asyncpg
         │ admin image upload                       ┌──────────▼──────────┐
         ▼                                          │  PostgreSQL (Neon)  │
   Cloudinary (CDN)                                 └─────────────────────┘
```

## Tech stack

| Layer    | Choice |
| -------- | ------ |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, TanStack Query, Zustand, react-hook-form + zod |
| Backend  | FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, asyncpg |
| Auth     | JWT access token + httpOnly refresh cookie, bcrypt |
| Database | PostgreSQL (Neon) |
| Images   | Cloudinary (admin signed uploads) |
| Payments | Cash on Delivery |
| Hosting  | Vercel (web) · Render (API) · Neon (DB) |

## Local development

**Prerequisites:** Node.js 20+, [uv](https://docs.astral.sh/uv/) (pins Python 3.12),
and a free [Neon](https://neon.tech) Postgres database.

### Backend

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL (Neon) + SECRET_KEY
uv sync
uv run alembic upgrade head
uv run python seed.py         # admin user + categories + sample products
uv run uvicorn app.main:app --reload --port 8000
```

API → `http://localhost:8000` · interactive docs → `/docs`.

> `DATABASE_URL` uses the async driver: `postgresql+asyncpg://USER:PASS@HOST/DB`
> (Neon's `?sslmode=...&channel_binding=...` params are handled automatically).
> Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL defaults to localhost:8000
npm install
npm run dev
```

Storefront → `http://localhost:3000`. Seeded admin: `admin@store.pk` / `admin12345`.

### Tests

```bash
cd backend && uv run pytest        # 44 tests
cd frontend && npx tsc --noEmit    # type-check
```

## Deployment

Deployed from this GitHub repo. Database is **Neon** (managed Postgres).

**Backend → Render** (Docker, builds `backend/Dockerfile`)
- New Web Service from the repo, root directory `backend/`, runtime **Docker**.
- Env vars: `DATABASE_URL` (Neon, `postgresql+asyncpg://…`), `SECRET_KEY`,
  `CORS_ORIGINS=https://<vercel-domain>`, `COOKIE_SECURE=true`,
  `COOKIE_SAMESITE=none`, `ENVIRONMENT=production`,
  `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`.
- The Docker `CMD` runs `alembic upgrade head` then starts uvicorn on `$PORT`.
- Seed once after first deploy (Render Shell): `uv run python seed.py`.

**Frontend → Vercel**
- Import the repo, root directory `frontend/`.
- Env: `NEXT_PUBLIC_API_URL=https://<render-domain>/api/v1`,
  `NEXT_PUBLIC_SITE_URL=https://<vercel-domain>`.

**Cross-origin auth:** storefront and API live on different domains, so the refresh
cookie is `SameSite=None; Secure` and `CORS_ORIGINS` must list the exact Vercel origin.

**Smoke test:** browse → add to cart → COD checkout → confirmation; register/login;
admin login → edit a product → see it live.

## Project status

All six build phases complete:

- [x] Scaffolding · [x] Backend foundation (models, auth) · [x] Catalog + storefront
- [x] COD checkout + orders · [x] Customer accounts · [x] Admin panel · [x] SEO + deploy prep

## Notes

- Demo product imagery is hotlinked from public brand CDNs for illustration only;
  replace with first-party photography (admin → Cloudinary upload) for production use.
- To retire a product, **unpublish** it (keeps order links live) rather than hard-deleting.
