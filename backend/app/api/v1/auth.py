"""Authentication endpoints: register, login, refresh, logout, me.

Flow:
- register/login return an access token (JSON) AND set an httpOnly refresh
  cookie on the response.
- refresh reads the cookie, rotates it, and returns a fresh access token.
- logout clears the cookie.
"""

from fastapi import APIRouter, BackgroundTasks, Cookie, HTTPException, Response, status
from sqlalchemy import select

from app.core.config import settings
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    RESET_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    create_reset_token,
    decode_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.deps import CurrentUser, DbSession
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.services import email as email_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
        domain=settings.COOKIE_DOMAIN,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )


def _issue_tokens(response: Response, user: User) -> TokenResponse:
    access = create_access_token(user.id, user.role)
    refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(
        access_token=access, user=UserResponse.model_validate(user)
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest, response: Response, db: DbSession
) -> TokenResponse:
    existing = await db.scalar(
        select(User).where(User.email == payload.email.lower())
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _issue_tokens(response, user)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, response: Response, db: DbSession
) -> TokenResponse:
    user = await db.scalar(
        select(User).where(User.email == payload.email.lower())
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled"
        )

    return _issue_tokens(response, user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> dict[str, str]:
    """Email a reset link if the account exists.

    Always returns 202 with the same body — we never reveal whether an email is
    registered.
    """
    user = await db.scalar(
        select(User).where(User.email == payload.email.lower())
    )
    if user is not None and user.is_active:
        token = create_reset_token(user.id, user.password_hash)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        background_tasks.add_task(
            email_service.send_password_reset, user.email, reset_url
        )
    return {"detail": "If an account exists for that email, a reset link is on its way."}


@router.post("/reset-password", response_model=TokenResponse)
async def reset_password(
    payload: ResetPasswordRequest, response: Response, db: DbSession
) -> TokenResponse:
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired.",
    )
    try:
        claims = decode_token(payload.token)
        if claims.get("type") != RESET_TOKEN_TYPE:
            raise ValueError("wrong token type")
        user_id = int(claims["sub"])
        fingerprint = claims.get("fp")
    except Exception as exc:  # noqa: BLE001 - any failure means invalid token
        raise invalid from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise invalid
    # Single-use: fingerprint must match the password hash the token was minted
    # against. Once the password changes, old reset links stop working.
    if fingerprint != password_fingerprint(user.password_hash):
        raise invalid

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(user)

    return _issue_tokens(response, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    db: DbSession,
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != REFRESH_TOKEN_TYPE:
            raise ValueError("wrong token type")
        user_id = int(payload["sub"])
    except Exception as exc:  # noqa: BLE001 - any failure means invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    return _issue_tokens(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest, current_user: CurrentUser, db: DbSession
) -> UserResponse:
    current_user.full_name = payload.full_name
    current_user.phone = payload.phone
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest, current_user: CurrentUser, db: DbSession
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your current password is incorrect.",
        )
    current_user.password_hash = hash_password(payload.new_password)
    await db.commit()
