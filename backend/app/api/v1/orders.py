"""Order endpoints: checkout, order history, single order lookup."""

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbSession, OptionalUser
from app.models.enums import UserRole
from app.schemas.order import CheckoutRequest, OrderResponse, OrderSummary
from app.services import orders as orders_service
from app.services.orders import CheckoutError

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: CheckoutRequest, db: DbSession, user: OptionalUser
) -> OrderResponse:
    try:
        order = await orders_service.create_order(db, payload, user)
    except CheckoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return OrderResponse.model_validate(order)


@router.get("", response_model=list[OrderSummary])
async def list_my_orders(db: DbSession, user: CurrentUser) -> list[OrderSummary]:
    orders = await orders_service.list_orders_for_user(db, user)
    return [
        OrderSummary(
            order_number=o.order_number,
            status=o.status,
            total=o.total,
            item_count=sum(i.qty for i in o.items),
            placed_at=o.placed_at,
        )
        for o in orders
    ]


@router.get("/{order_number}", response_model=OrderResponse)
async def get_order(
    order_number: str, db: DbSession, user: OptionalUser
) -> OrderResponse:
    order = await orders_service.get_order_by_number(db, order_number)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    # Orders tied to an account require that account (or an admin).
    # Guest orders (no user_id) are viewable by anyone holding the order number.
    if order.user_id is not None:
        is_owner = user is not None and user.id == order.user_id
        is_admin = user is not None and user.role == UserRole.admin.value
        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
            )

    return OrderResponse.model_validate(order)
