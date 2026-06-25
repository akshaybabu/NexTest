"""Element / locator repository for self-healing."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import Element

router = APIRouter(prefix="/elements", tags=["elements"])


class ElementCreate(BaseModel):
    project_id: str
    name: str
    page: str | None = None
    primary_locator: str
    locator_type: str = "css"
    alternate_locators: list[dict] = []


class ElementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    page: str | None = None
    primary_locator: str
    locator_type: str
    alternate_locators: list | None = None
    confidence: float
    heal_count: int
    created_at: datetime


@router.get("", response_model=list[ElementOut])
async def list_elements(project_id: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Element).order_by(desc(Element.created_at))
    if project_id:
        stmt = stmt.where(Element.project_id == project_id)
    res = await db.execute(stmt)
    return [ElementOut.model_validate(e) for e in res.scalars().all()]


@router.post("", response_model=ElementOut)
async def create_element(payload: ElementCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = Element(**payload.model_dump())
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return ElementOut.model_validate(e)


@router.patch("/{el_id}", response_model=ElementOut)
async def update_element(el_id: str, payload: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = (await db.execute(select(Element).where(Element.id == el_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Element not found")
    allowed = {"name", "page", "primary_locator", "locator_type", "alternate_locators", "confidence"}
    for k, v in payload.items():
        if k in allowed:
            setattr(e, k, v)
    await db.commit()
    await db.refresh(e)
    return ElementOut.model_validate(e)


@router.delete("/{el_id}")
async def delete_element(el_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = (await db.execute(select(Element).where(Element.id == el_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Element not found")
    await db.delete(e)
    await db.commit()
    return {"ok": True}
