"""Admin panel endpoints. Every route requires the admin role (AdminUser dep)."""

import time

import cloudinary.utils
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.deps import AdminUser, DbSession
from app.models.category import Category
from app.models.order import Order
from app.models.product import Product
from app.schemas.admin import (
    AdminOrderSummary,
    AdminProduct,
    CategoryWrite,
    DashboardStats,
    OrderStatusUpdate,
    ProductWrite,
    UploadSignature,
)
from app.schemas.catalog import CategoryResponse
from app.services import admin as admin_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[])


# --- Dashboard ---
@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: DbSession, _: AdminUser) -> DashboardStats:
    return DashboardStats(**await admin_service.dashboard_stats(db))


# --- Products ---
@router.get("/products", response_model=list[AdminProduct])
async def list_products(db: DbSession, _: AdminUser) -> list[Product]:
    return await admin_service.list_admin_products(db)


@router.get("/products/{product_id}", response_model=AdminProduct)
async def get_product(product_id: int, db: DbSession, _: AdminUser) -> Product:
    product = await admin_service.get_admin_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post(
    "/products", response_model=AdminProduct, status_code=status.HTTP_201_CREATED
)
async def create_product(
    payload: ProductWrite, db: DbSession, _: AdminUser
) -> Product:
    try:
        return await admin_service.create_product(db, payload)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Slug or SKU already exists"
        ) from exc


@router.put("/products/{product_id}", response_model=AdminProduct)
async def update_product(
    product_id: int, payload: ProductWrite, db: DbSession, _: AdminUser
) -> Product:
    product = await admin_service.get_admin_product(db, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        return await admin_service.update_product(db, product, payload)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Slug or SKU already exists"
        ) from exc


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, db: DbSession, _: AdminUser) -> None:
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()


# --- Categories ---
@router.post(
    "/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED
)
async def create_category(
    payload: CategoryWrite, db: DbSession, _: AdminUser
) -> Category:
    category = Category(**payload.model_dump())
    db.add(category)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Slug already exists") from exc
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int, payload: CategoryWrite, db: DbSession, _: AdminUser
) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump().items():
        setattr(category, field, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Slug already exists") from exc
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: DbSession, _: AdminUser) -> None:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        await db.delete(category)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a category that still has products",
        ) from exc


# --- Orders ---
@router.get("/orders", response_model=list[AdminOrderSummary])
async def list_orders(db: DbSession, _: AdminUser) -> list[AdminOrderSummary]:
    return await admin_service.list_admin_orders(db)


@router.patch("/orders/{order_number}/status", response_model=AdminOrderSummary)
async def update_order_status(
    order_number: str, payload: OrderStatusUpdate, db: DbSession, _: AdminUser
) -> AdminOrderSummary:
    from sqlalchemy.orm import selectinload

    order = await db.scalar(
        select(Order)
        .where(Order.order_number == order_number)
        .options(selectinload(Order.items))
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = payload.status.value
    await db.commit()
    return AdminOrderSummary(
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        status=order.status,
        payment_status=order.payment_status,
        total=order.total,
        item_count=sum(i.qty for i in order.items),
        placed_at=order.placed_at,
    )


# --- Cloudinary signed upload ---
@router.get("/uploads/signature", response_model=UploadSignature)
async def upload_signature(_: AdminUser) -> UploadSignature:
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        raise HTTPException(
            status_code=503,
            detail="Image uploads are not configured. Paste an image URL instead.",
        )
    folder = "meher/products"
    timestamp = int(time.time())
    signature = cloudinary.utils.api_sign_request(
        {"timestamp": timestamp, "folder": folder},
        settings.CLOUDINARY_API_SECRET,
    )
    return UploadSignature(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        timestamp=timestamp,
        signature=signature,
        folder=folder,
    )
