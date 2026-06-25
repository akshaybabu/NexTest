"""Project + Environment CRUD."""
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import Project, Environment

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    key: str = Field(min_length=1, max_length=40)
    description: str | None = None
    tags: list[str] = []


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_archived: bool | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    key: str
    description: str | None = None
    tags: list | None = None
    organization_id: str | None = None
    is_archived: bool
    created_at: datetime


class EnvCreate(BaseModel):
    name: str
    base_url: str | None = None
    variables: dict = {}


class EnvOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    base_url: str | None = None
    variables: dict | None = None
    created_at: datetime


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    q: str | None = None,
    archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Project).where(Project.is_archived == archived).order_by(desc(Project.created_at))
    if user.organization_id:
        stmt = stmt.where(Project.organization_id == user.organization_id)
    if q:
        stmt = stmt.where(Project.name.ilike(f"%{q}%"))
    res = await db.execute(stmt)
    return [ProjectOut.model_validate(p) for p in res.scalars().all()]


@router.post("", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    key = re.sub(r"[^A-Z0-9_]", "", payload.key.upper())[:40] or "PROJ"
    existing = (await db.execute(select(Project).where(Project.key == key, Project.organization_id == user.organization_id))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Project key already exists")
    p = Project(
        name=payload.name,
        key=key,
        description=payload.description,
        tags=payload.tags,
        organization_id=user.organization_id,
        created_by=user.id,
    )
    db.add(p)
    await db.flush()
    # Seed default environments
    for env_name in ["QA", "UAT", "Stage", "Prod"]:
        db.add(Environment(project_id=p.id, name=env_name, variables={}))
    await db.commit()
    await db.refresh(p)
    return ProjectOut.model_validate(p)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Project not found")
    return ProjectOut.model_validate(p)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Project not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    await db.commit()
    await db.refresh(p)
    return ProjectOut.model_validate(p)


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    p = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Project not found")
    await db.delete(p)
    await db.commit()
    return {"ok": True}


# Environments
@router.get("/{project_id}/environments", response_model=list[EnvOut])
async def list_envs(project_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    res = await db.execute(select(Environment).where(Environment.project_id == project_id).order_by(Environment.created_at))
    return [EnvOut.model_validate(e) for e in res.scalars().all()]


@router.post("/{project_id}/environments", response_model=EnvOut)
async def create_env(project_id: str, payload: EnvCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = Environment(project_id=project_id, name=payload.name, base_url=payload.base_url, variables=payload.variables)
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return EnvOut.model_validate(e)
