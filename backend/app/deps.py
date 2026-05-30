"""Shared FastAPI dependencies for authentication and authorization."""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.models.enums import UserRole
from app.models.user import User

# auto_error=False so we can return our own 401 and support optional auth.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]
_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != ACCESS_TOKEN_TYPE:
            return None
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> User:
    """Require a valid access token; raise 401 otherwise."""
    user = await _user_from_credentials(credentials, db)
    if user is None:
        raise _credentials_error
    return user


async def get_current_user_optional(
    db: DbSession,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> User | None:
    """Return the user if authenticated, else None (used for guest checkout)."""
    return await _user_from_credentials(credentials, db)


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Require the authenticated user to have the admin role."""
    if current_user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_current_user_optional)]
AdminUser = Annotated[User, Depends(require_admin)]
