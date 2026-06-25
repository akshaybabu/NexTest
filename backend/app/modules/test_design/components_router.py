"""Reusable component CRUD + extract-from-test-case."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import TestCase
from app.modules.test_design.component_models import ReusableComponent

router = APIRouter(prefix="/components", tags=["components"])


class StepDef(BaseModel):
    keyword: str
    target: str | None = None
    value: str | None = None
    description: str | None = None
    expected: str | None = None
    config: dict | None = None


class ComponentCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    steps: list[StepDef] = []
    inputs: list[str] = []


class ComponentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list[StepDef] | None = None
    inputs: list[str] | None = None


class ComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    description: str | None = None
    steps: list | None = None
    inputs: list | None = None
    version: int
    created_at: datetime
    updated_at: datetime


class ExtractRequest(BaseModel):
    test_case_id: str
    name: str
    description: str | None = None
    step_indices: list[int] = []   # which steps to extract; empty = all
    replace_with_reference: bool = True   # replace extracted steps with a use_component step


@router.get("", response_model=list[ComponentOut])
async def list_components(project_id: str | None = None, q: str | None = None,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(ReusableComponent).order_by(desc(ReusableComponent.updated_at))
    if project_id:
        stmt = stmt.where(ReusableComponent.project_id == project_id)
    if q:
        stmt = stmt.where(ReusableComponent.name.ilike(f"%{q}%"))
    res = await db.execute(stmt)
    return [ComponentOut.model_validate(c) for c in res.scalars().all()]


@router.post("", response_model=ComponentOut)
async def create_component(payload: ComponentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = ReusableComponent(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        steps=[s.model_dump() for s in payload.steps],
        inputs=payload.inputs,
        created_by=user.id,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return ComponentOut.model_validate(c)


@router.get("/{component_id}", response_model=ComponentOut)
async def get_component(component_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = (await db.execute(select(ReusableComponent).where(ReusableComponent.id == component_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Component not found")
    return ComponentOut.model_validate(c)


@router.patch("/{component_id}", response_model=ComponentOut)
async def update_component(component_id: str, payload: ComponentUpdate,
                           db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = (await db.execute(select(ReusableComponent).where(ReusableComponent.id == component_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Component not found")
    data = payload.model_dump(exclude_unset=True)
    if "steps" in data and data["steps"] is not None:
        data["steps"] = [s if isinstance(s, dict) else s.model_dump() for s in data["steps"]]
    for k, v in data.items():
        setattr(c, k, v)
    c.version = (c.version or 1) + 1
    await db.commit()
    await db.refresh(c)
    return ComponentOut.model_validate(c)


@router.delete("/{component_id}")
async def delete_component(component_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    c = (await db.execute(select(ReusableComponent).where(ReusableComponent.id == component_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Component not found")
    await db.delete(c)
    await db.commit()
    return {"ok": True}


@router.post("/extract-from-test-case", response_model=ComponentOut)
async def extract_from_test_case(payload: ExtractRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Create a reusable component from selected steps of a test case.

    If replace_with_reference=True (default), the extracted steps are removed from the
    test case and replaced with a single `use_component` step pointing to the new component.
    """
    tc = (await db.execute(select(TestCase).where(TestCase.id == payload.test_case_id))).scalar_one_or_none()
    if not tc:
        raise HTTPException(404, "Test case not found")
    all_steps = tc.steps or []
    indices = sorted(set(payload.step_indices)) if payload.step_indices else list(range(len(all_steps)))
    if not indices or any(i < 0 or i >= len(all_steps) for i in indices):
        raise HTTPException(400, "Invalid step_indices")

    extracted = [all_steps[i] for i in indices]
    component = ReusableComponent(
        project_id=tc.project_id,
        name=payload.name,
        description=payload.description,
        steps=extracted,
        inputs=[],
        created_by=user.id,
    )
    db.add(component)
    await db.flush()

    if payload.replace_with_reference:
        replacement = {
            "keyword": "use_component",
            "target": component.id,
            "value": "",
            "description": f"Reusable component: {payload.name}",
            "config": {"component_name": payload.name},
        }
        # Build new step list: insert replacement at the position of the first extracted index,
        # skip the original extracted indices.
        idx_set = set(indices)
        new_steps = []
        inserted = False
        for i, s in enumerate(all_steps):
            if i in idx_set:
                if not inserted:
                    new_steps.append(replacement)
                    inserted = True
                continue
            new_steps.append(s)
        if not inserted:
            new_steps.append(replacement)
        tc.steps = new_steps
        tc.version = (tc.version or 1) + 1

    await db.commit()
    await db.refresh(component)
    return ComponentOut.model_validate(component)
