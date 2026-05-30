"""Async SQLAlchemy 2.0 engine, session factory, and declarative base.

A single async engine is created from `settings.DATABASE_URL`. Request handlers
get a session via the `get_db` dependency (see app/deps.py).
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.sqlalchemy_url,
    echo=settings.SQL_ECHO,
    pool_pre_ping=True,
    future=True,
    connect_args=settings.db_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a transactional session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
