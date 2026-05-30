"""Pytest fixtures: an isolated in-memory SQLite DB and an HTTP client.

Each test gets a fresh schema (create_all / drop_all) and an httpx AsyncClient
wired to the FastAPI app with the get_db dependency overridden to the test DB.
No external database (Neon) is required to run the suite.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - register tables on Base.metadata
from app.core.db import Base, get_db
from app.main import app

# StaticPool keeps a single in-memory connection alive across sessions so the
# schema persists for the duration of a test.
engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = async_sessionmaker(engine, expire_on_commit=False)


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
