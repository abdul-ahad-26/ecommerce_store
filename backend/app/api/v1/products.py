"""Public product catalog endpoints."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import DbSession
from app.schemas.catalog import PaginatedProducts, ProductDetail
from app.services import catalog
from app.services.catalog import ProductSort

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=PaginatedProducts)
async def list_products(
    db: DbSession,
    category: str | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    min_price: Annotated[Decimal | None, Query(ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0)] = None,
    sort: ProductSort = ProductSort.newest,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> PaginatedProducts:
    return await catalog.list_products(
        db,
        category=category,
        search=search,
        brand=brand,
        size=size,
        color=color,
        min_price=min_price,
        max_price=max_price,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/{slug}", response_model=ProductDetail)
async def get_product(slug: str, db: DbSession) -> ProductDetail:
    product = await catalog.get_product_by_slug(db, slug)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    return catalog.map_detail(product)
