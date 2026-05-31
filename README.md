# Pakistani Women's Wear — Ecommerce Store

A custom online store for selling Pakistani women's wear (shalwar kameez — lawn,
stitched & unstitched suits) to the **local Pakistan market**. Cash-on-Delivery
first.

Built as a decoupled fullstack app:

- **`frontend/`** — Next.js 16 (App Router, TypeScript, Tailwind CSS 4). Storefront + customer accounts + admin panel.
- **`backend/`** — FastAPI (Python 3.12), SQLAlchemy 2.0 async, PostgreSQL, JWT auth.

## Architecture

```
┌────────────────────┐        HTTPS/JSON        ┌─────────────────────┐
│  Next.js (Vercel)  │  ───────────────────►    │  FastAPI (Railway)  │
│  storefront/admin  │  ◄───────────────────    │   /api/v1/*         │
└────────────────────┘   refresh cookie (httpOnly)└──────────┬─────────┘
                                                              │ asyncpg
                                                   ┌──────────▼─────────┐
                                                   │ PostgreSQL (Neon)  │
                                                   └────────────────────┘
        images ──► Cloudinary
```

## Tech stack

| Layer    | Choice |
| -------- | ------ |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, TanStack Query, Zustand, react-hook-form + zod |
| Backend  | FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, asyncpg |
| Auth     | JWT access token + httpOnly refresh cookie, bcrypt password hashing |
| Database | PostgreSQL (Neon for dev & prod) |
| Images   | Cloudinary (admin signed uploads) |
| Payments | Cash on Delivery (gateways deferred) |

## Prerequisites

- **Node.js** 20+ and npm
- **uv** (Python package manager) — installs/pins Python 3.12 automatically
- A **Neon** Postgres database (free tier) — get a connection string from the dashboard

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env          # then fill in DATABASE_URL (Neon) + SECRET_KEY
uv sync                       # install deps into .venv
# (Phase 1+) uv run alembic upgrade head
# (Phase 1+) uv run python seed.py
uv run uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000`. Interactive docs: `http://localhost:8000/docs`.

> Use the async driver in `DATABASE_URL`: `postgresql+asyncpg://USER:PASS@HOST/DB`.
> Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL defaults to localhost:8000
npm install
npm run dev
```

Storefront runs at `http://localhost:3000`.

## Project status

Built in phases (see the plan). Each phase ends in a runnable state.

- [x] **Phase 0** — Scaffolding: backend + frontend wired up, health check passing end-to-end
- [x] **Phase 1** — Backend foundation: models, migrations, auth (JWT + roles), seed data
- [x] **Phase 2** — Catalog API + storefront browse (home, category, product detail)
- [x] **Phase 3** — Cart + COD checkout + orders
- [ ] **Phase 4** — Customer accounts (order history, addresses)
- [ ] **Phase 5** — Admin panel (products, categories, orders)
- [ ] **Phase 6** — Polish, SEO, tests, deploy

## Deployment (target)

- **Database:** Neon (managed Postgres)
- **Backend:** Railway / Render (long-running ASGI; run `alembic upgrade head` on deploy)
- **Frontend:** Vercel (set `NEXT_PUBLIC_API_URL` to the deployed API)
- In production set `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and lock `CORS_ORIGINS` to the Vercel domain.
