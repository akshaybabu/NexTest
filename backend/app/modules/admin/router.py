"""Admin: user management, audit logs, system health."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user, require_min_level
from app.core.security import hash_password
from app.modules.auth.models import User, AuditLog, Organization
from app.modules.auth.schemas import UserOut, AuditOut

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "viewer"
    organization_id: str | None = None


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    organization_id: str | None = None


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    description: str | None = None
    is_active: bool
    created_at: datetime


class OrgCreate(BaseModel):
    name: str
    description: str | None = None


@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(60))):
    res = await db.execute(select(User).order_by(desc(User.created_at)))
    return [UserOut.model_validate(u) for u in res.scalars().all()]


@router.post("/users", response_model=UserOut)
async def create_user(payload: CreateUserRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(80))):
    if (await db.execute(select(User).where(User.email == payload.email.lower()))).scalar_one_or_none():
        raise HTTPException(400, "Email already exists")
    u = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        organization_id=payload.organization_id or user.organization_id,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return UserOut.model_validate(u)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UpdateUserRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(80))):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(u, k, v)
    await db.commit()
    await db.refresh(u)
    return UserOut.model_validate(u)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(100))):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == user.id:
        raise HTTPException(400, "Cannot delete self")
    await db.delete(u)
    await db.commit()
    return {"ok": True}


@router.get("/audit-logs", response_model=list[AuditOut])
async def list_audit(limit: int = 100, db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(60))):
    res = await db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit))
    return [AuditOut.model_validate(a) for a in res.scalars().all()]


@router.get("/orgs", response_model=list[OrgOut])
async def list_orgs(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    res = await db.execute(select(Organization).order_by(Organization.created_at))
    return [OrgOut.model_validate(o) for o in res.scalars().all()]


@router.post("/orgs", response_model=OrgOut)
async def create_org(payload: OrgCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_min_level(80))):
    from app.modules.auth.utils import slugify
    slug = slugify(payload.name)
    if (await db.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none():
        raise HTTPException(400, "Organization already exists")
    o = Organization(name=payload.name, slug=slug, description=payload.description)
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return OrgOut.model_validate(o)


@router.get("/health")
async def system_health(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_orgs = (await db.execute(select(func.count()).select_from(Organization))).scalar() or 0
    return {
        "status": "healthy",
        "database": "connected",
        "total_users": total_users,
        "total_organizations": total_orgs,
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }
