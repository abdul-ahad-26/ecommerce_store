"""Customer saved-address endpoints (all require authentication)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update

from app.deps import CurrentUser, DbSession
from app.models.address import Address
from app.schemas.address import AddressCreate, AddressResponse, AddressUpdate

router = APIRouter(prefix="/addresses", tags=["addresses"])


async def _clear_other_defaults(db: DbSession, user_id: int, keep_id: int | None) -> None:
    stmt = update(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
    if keep_id is not None:
        stmt = stmt.where(Address.id != keep_id)
    await db.execute(stmt.values(is_default=False))


async def _get_owned(db: DbSession, user: CurrentUser, address_id: int) -> Address:
    address = await db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found"
        )
    return address


@router.get("", response_model=list[AddressResponse])
async def list_addresses(db: DbSession, user: CurrentUser) -> list[Address]:
    rows = await db.scalars(
        select(Address)
        .where(Address.user_id == user.id)
        .order_by(Address.is_default.desc(), Address.id.desc())
    )
    return list(rows.all())


@router.post("", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_address(
    payload: AddressCreate, db: DbSession, user: CurrentUser
) -> Address:
    # First address is always the default.
    existing_count = await db.scalar(
        select(Address).where(Address.user_id == user.id).limit(1)
    )
    make_default = payload.is_default or existing_count is None

    address = Address(user_id=user.id, **payload.model_dump())
    address.is_default = make_default
    db.add(address)
    await db.flush()

    if make_default:
        await _clear_other_defaults(db, user.id, keep_id=address.id)

    await db.commit()
    await db.refresh(address)
    return address


@router.put("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: int, payload: AddressUpdate, db: DbSession, user: CurrentUser
) -> Address:
    address = await _get_owned(db, user, address_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(address, field, value)
    await db.flush()

    if data.get("is_default") is True:
        await _clear_other_defaults(db, user.id, keep_id=address.id)

    await db.commit()
    await db.refresh(address)
    return address


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    address_id: int, db: DbSession, user: CurrentUser
) -> None:
    address = await _get_owned(db, user, address_id)
    was_default = address.is_default
    await db.delete(address)
    await db.flush()

    # Promote another address to default if we removed the default one.
    if was_default:
        next_addr = await db.scalar(
            select(Address)
            .where(Address.user_id == user.id)
            .order_by(Address.id.desc())
            .limit(1)
        )
        if next_addr is not None:
            next_addr.is_default = True

    await db.commit()
