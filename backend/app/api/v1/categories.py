"""Public category endpoints."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import DbSession
from app.models.category import Category
from app.schemas.catalog import CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def list_categories(db: DbSession) -> list[Category]:
    rows = await db.scalars(
        select(Category).order_by(Category.sort_order, Category.name)
    )
    return list(rows.all())


@router.get("/{slug}", response_model=CategoryResponse)
async def get_category(slug: str, db: DbSession) -> Category:
    category = await db.scalar(select(Category).where(Category.slug == slug))
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return category
