"""Aggregates all v1 routers under a single APIRouter.

As features land (auth, catalog, orders, admin) their routers are included here.
"""

from fastapi import APIRouter

from app.api.v1 import auth, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
