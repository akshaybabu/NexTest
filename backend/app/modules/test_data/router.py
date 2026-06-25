"""Test Data Management - CRUD for JSON/CSV datasets, environment variables, secure values."""
import csv
import io
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import TestData

router = APIRouter(prefix="/test-data", tags=["test-data"])


class TestDataCreate(BaseModel):
    project_id: str
    name: str
    type: str = "json"  # json | csv | env
    data: dict | list | None = None
    is_secure: bool = False


class TestDataUpdate(BaseModel):
    name: str | None = None
    data: dict | list | None = None
    is_secure: bool | None = None


class TestDataOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    name: str
    type: str
    data: dict | list | None = None
    is_secure: bool
    created_at: datetime


def _mask(data, is_secure: bool):
    """Mask secure values for output."""
    if not is_secure or data is None:
        return data
    if isinstance(data, dict):
        return {k: ("••••••" if v is not None else None) for k, v in data.items()}
    if isinstance(data, list):
        return [_mask(row, True) for row in data]
    return "••••••"


@router.get("", response_model=list[TestDataOut])
async def list_test_data(
    project_id: str | None = None,
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(TestData).order_by(desc(TestData.created_at))
    if project_id:
        stmt = stmt.where(TestData.project_id == project_id)
    if type:
        stmt = stmt.where(TestData.type == type)
    res = await db.execute(stmt)
    items = res.scalars().all()
    out = []
    for it in items:
        d = TestDataOut.model_validate(it)
        d.data = _mask(it.data, it.is_secure)
        out.append(d)
    return out


@router.post("", response_model=TestDataOut)
async def create_test_data(
    payload: TestDataCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    td = TestData(
        project_id=payload.project_id,
        name=payload.name,
        type=payload.type,
        data=payload.data,
        is_secure=payload.is_secure,
    )
    db.add(td)
    await db.commit()
    await db.refresh(td)
    out = TestDataOut.model_validate(td)
    out.data = _mask(td.data, td.is_secure)
    return out


@router.get("/{td_id}", response_model=TestDataOut)
async def get_test_data(
    td_id: str,
    reveal: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    td = (await db.execute(select(TestData).where(TestData.id == td_id))).scalar_one_or_none()
    if not td:
        raise HTTPException(404, "Test data not found")
    out = TestDataOut.model_validate(td)
    if td.is_secure and not reveal:
        out.data = _mask(td.data, True)
    return out


@router.patch("/{td_id}", response_model=TestDataOut)
async def update_test_data(
    td_id: str,
    payload: TestDataUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    td = (await db.execute(select(TestData).where(TestData.id == td_id))).scalar_one_or_none()
    if not td:
        raise HTTPException(404, "Test data not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(td, k, v)
    await db.commit()
    await db.refresh(td)
    out = TestDataOut.model_validate(td)
    out.data = _mask(td.data, td.is_secure)
    return out


@router.delete("/{td_id}")
async def delete_test_data(
    td_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    td = (await db.execute(select(TestData).where(TestData.id == td_id))).scalar_one_or_none()
    if not td:
        raise HTTPException(404, "Test data not found")
    await db.delete(td)
    await db.commit()
    return {"ok": True}


@router.post("/import-csv", response_model=TestDataOut)
async def import_csv(
    project_id: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        raise HTTPException(400, "CSV is empty or invalid")
    td = TestData(
        project_id=project_id,
        name=name or file.filename or "imported.csv",
        type="csv",
        data=rows,
        is_secure=False,
    )
    db.add(td)
    await db.commit()
    await db.refresh(td)
    return TestDataOut.model_validate(td)


@router.get("/{td_id}/export.csv")
async def export_csv(
    td_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    td = (await db.execute(select(TestData).where(TestData.id == td_id))).scalar_one_or_none()
    if not td:
        raise HTTPException(404, "Test data not found")
    if not isinstance(td.data, list) or not td.data:
        raise HTTPException(400, "Test data is not tabular / is empty")
    buf = io.StringIO()
    fieldnames = list(td.data[0].keys()) if isinstance(td.data[0], dict) else []
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for row in td.data:
        if isinstance(row, dict):
            writer.writerow(row)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{td.name}.csv"'},
    )


@router.post("/generate-random")
async def generate_random(
    kind: str = "string",
    length: int = 10,
    user: User = Depends(get_current_user),
):
    """Helper utility to generate random values for test data."""
    if kind == "string":
        return {"value": secrets.token_urlsafe(length)[:length]}
    if kind == "number":
        return {"value": secrets.randbelow(10 ** min(length, 10))}
    if kind == "email":
        return {"value": f"user_{secrets.token_hex(4)}@example.com"}
    if kind == "uuid":
        import uuid
        return {"value": str(uuid.uuid4())}
    raise HTTPException(400, "Unsupported kind. Use: string|number|email|uuid")
