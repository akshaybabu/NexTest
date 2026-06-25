"""Test Case + Test Suite CRUD."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import TestCase, TestSuite

router = APIRouter(tags=["test-design"])


class StepDef(BaseModel):
    keyword: str
    target: str | None = None
    value: str | None = None
    description: str | None = None
    expected: str | None = None


class TestCaseCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    type: str = "web"
    priority: str = "medium"
    tags: list[str] = []
    steps: list[StepDef] = []


class TestCaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: str | None = None
    tags: list[str] | None = None
    steps: list[StepDef] | None = None


class TestCaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    description: str | None = None
    type: str
    priority: str
    tags: list | None = None
    steps: list | None = None
    version: int
    created_at: datetime
    updated_at: datetime


class TestSuiteCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    test_case_ids: list[str] = []
    parallel: bool = False
    tags: list[str] = []


class TestSuiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    description: str | None = None
    test_case_ids: list | None = None
    parallel: bool
    tags: list | None = None
    created_at: datetime


# ----- Test cases -----

@router.get("/test-cases", response_model=list[TestCaseOut])
async def list_test_cases(project_id: str | None = None, type: str | None = None, q: str | None = None,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(TestCase).order_by(desc(TestCase.updated_at))
    if project_id:
        stmt = stmt.where(TestCase.project_id == project_id)
    if type:
        stmt = stmt.where(TestCase.type == type)
    if q:
        stmt = stmt.where(TestCase.name.ilike(f"%{q}%"))
    res = await db.execute(stmt)
    return [TestCaseOut.model_validate(t) for t in res.scalars().all()]


@router.post("/test-cases", response_model=TestCaseOut)
async def create_test_case(payload: TestCaseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tc = TestCase(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        type=payload.type,
        priority=payload.priority,
        tags=payload.tags,
        steps=[s.model_dump() for s in payload.steps],
        created_by=user.id,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return TestCaseOut.model_validate(tc)


@router.get("/test-cases/{tc_id}", response_model=TestCaseOut)
async def get_test_case(tc_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tc = (await db.execute(select(TestCase).where(TestCase.id == tc_id))).scalar_one_or_none()
    if not tc:
        raise HTTPException(404, "Test case not found")
    return TestCaseOut.model_validate(tc)


@router.patch("/test-cases/{tc_id}", response_model=TestCaseOut)
async def update_test_case(tc_id: str, payload: TestCaseUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tc = (await db.execute(select(TestCase).where(TestCase.id == tc_id))).scalar_one_or_none()
    if not tc:
        raise HTTPException(404, "Test case not found")
    data = payload.model_dump(exclude_unset=True)
    if "steps" in data and data["steps"] is not None:
        data["steps"] = [s if isinstance(s, dict) else s.model_dump() for s in data["steps"]]
    for k, v in data.items():
        setattr(tc, k, v)
    tc.version = (tc.version or 1) + 1
    await db.commit()
    await db.refresh(tc)
    return TestCaseOut.model_validate(tc)


@router.delete("/test-cases/{tc_id}")
async def delete_test_case(tc_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    tc = (await db.execute(select(TestCase).where(TestCase.id == tc_id))).scalar_one_or_none()
    if not tc:
        raise HTTPException(404, "Test case not found")
    await db.delete(tc)
    await db.commit()
    return {"ok": True}


# ----- Test suites -----

@router.get("/test-suites", response_model=list[TestSuiteOut])
async def list_suites(project_id: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(TestSuite).order_by(desc(TestSuite.created_at))
    if project_id:
        stmt = stmt.where(TestSuite.project_id == project_id)
    res = await db.execute(stmt)
    return [TestSuiteOut.model_validate(s) for s in res.scalars().all()]


@router.post("/test-suites", response_model=TestSuiteOut)
async def create_suite(payload: TestSuiteCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = TestSuite(**payload.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return TestSuiteOut.model_validate(s)


@router.get("/test-suites/{suite_id}", response_model=TestSuiteOut)
async def get_suite(suite_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = (await db.execute(select(TestSuite).where(TestSuite.id == suite_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Suite not found")
    return TestSuiteOut.model_validate(s)


@router.patch("/test-suites/{suite_id}", response_model=TestSuiteOut)
async def update_suite(suite_id: str, payload: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = (await db.execute(select(TestSuite).where(TestSuite.id == suite_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Suite not found")
    allowed = {"name", "description", "test_case_ids", "parallel", "tags"}
    for k, v in payload.items():
        if k in allowed:
            setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return TestSuiteOut.model_validate(s)


@router.delete("/test-suites/{suite_id}")
async def delete_suite(suite_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    s = (await db.execute(select(TestSuite).where(TestSuite.id == suite_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Suite not found")
    await db.delete(s)
    await db.commit()
    return {"ok": True}
