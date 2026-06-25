"""Authentication router: login, register, logout, me, refresh."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.core.db import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token
)
from app.core.deps import get_current_user
from app.modules.auth.models import User, Organization, AuditLog
from app.modules.auth.schemas import LoginRequest, RegisterRequest, UserOut, AuthResponse
from app.modules.auth.utils import slugify, log_audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


@router.post("/register", response_model=AuthResponse)
async def register(payload: RegisterRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower()
    existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    org_id = None
    if payload.organization_name:
        slug = slugify(payload.organization_name)
        org = (await db.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none()
        if not org:
            org = Organization(name=payload.organization_name, slug=slug)
            db.add(org)
            await db.flush()
        org_id = org.id

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role or "qa_manager",
        organization_id=org_id,
    )
    db.add(user)
    await db.flush()
    await log_audit(db, user, "user.register", "user", user.id, request)
    await db.commit()

    access = create_access_token(user.id, user.email, user.role)
    refresh = create_refresh_token(user.id)
    _set_cookies(response, access, refresh)
    return AuthResponse(user=UserOut.model_validate(user), access_token=access, refresh_token=refresh)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    await log_audit(db, user, "user.login", "user", user.id, request)
    await db.commit()
    await db.refresh(user)

    access = create_access_token(user.id, user.email, user.role)
    refresh = create_refresh_token(user.id)
    _set_cookies(response, access, refresh)
    return AuthResponse(user=UserOut.model_validate(user), access_token=access, refresh_token=refresh)


@router.post("/logout")
async def logout(response: Response, request: Request, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    await log_audit(db, user, "user.logout", "user", user.id, request)
    await db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user.id, user.email, user.role)
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    return {"access_token": access}
