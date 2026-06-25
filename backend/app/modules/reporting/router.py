"""Reporting + analytics."""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import Execution, ExecutionStep, TestCase, Project, TestSuite

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
async def summary(project_id: str | None = None, days: int = 14, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base_filter = [Execution.created_at >= since]
    if project_id:
        base_filter.append(Execution.project_id == project_id)

    total = (await db.execute(select(func.count()).select_from(Execution).where(and_(*base_filter)))).scalar() or 0
    passed = (await db.execute(select(func.count()).select_from(Execution).where(and_(*base_filter, Execution.status == "passed")))).scalar() or 0
    failed = (await db.execute(select(func.count()).select_from(Execution).where(and_(*base_filter, Execution.status == "failed")))).scalar() or 0
    running = (await db.execute(select(func.count()).select_from(Execution).where(and_(*base_filter, Execution.status.in_(["running", "queued"]))))).scalar() or 0

    tc_total = (await db.execute(select(func.count()).select_from(TestCase) if not project_id else select(func.count()).select_from(TestCase).where(TestCase.project_id == project_id))).scalar() or 0
    suite_total = (await db.execute(select(func.count()).select_from(TestSuite) if not project_id else select(func.count()).select_from(TestSuite).where(TestSuite.project_id == project_id))).scalar() or 0
    proj_total = (await db.execute(select(func.count()).select_from(Project).where(Project.is_archived == False))).scalar() or 0

    healed_steps = (await db.execute(select(func.count()).select_from(ExecutionStep).where(ExecutionStep.healed == True))).scalar() or 0

    pass_rate = (passed / total * 100.0) if total else 0.0
    return {
        "total_executions": total,
        "passed_executions": passed,
        "failed_executions": failed,
        "active_executions": running,
        "pass_rate": round(pass_rate, 1),
        "total_test_cases": tc_total,
        "total_test_suites": suite_total,
        "total_projects": proj_total,
        "self_healed_steps": healed_steps,
    }


@router.get("/trend")
async def trend(project_id: str | None = None, days: int = 14, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date_trunc('day', Execution.created_at).label("day"),
            func.count().label("total"),
            func.sum(case((Execution.status == "passed", 1), else_=0)).label("passed"),
            func.sum(case((Execution.status == "failed", 1), else_=0)).label("failed"),
        )
        .where(Execution.created_at >= since)
        .group_by("day").order_by("day")
    )
    if project_id:
        stmt = stmt.where(Execution.project_id == project_id)
    res = await db.execute(stmt)
    rows = res.all()
    return [
        {"day": r.day.date().isoformat() if r.day else None, "total": r.total or 0, "passed": int(r.passed or 0), "failed": int(r.failed or 0)}
        for r in rows
    ]


@router.get("/recent")
async def recent_executions(project_id: str | None = None, limit: int = 10, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Execution).order_by(desc(Execution.created_at)).limit(limit)
    if project_id:
        stmt = stmt.where(Execution.project_id == project_id)
    res = await db.execute(stmt)
    return [
        {
            "id": e.id, "project_id": e.project_id, "status": e.status,
            "total_steps": e.total_steps, "passed_steps": e.passed_steps, "failed_steps": e.failed_steps,
            "duration_ms": e.duration_ms, "browser": e.browser,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in res.scalars().all()
    ]


@router.get("/flaky")
async def flaky_tests(project_id: str | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Tests that have both passed and failed in recent runs."""
    since = datetime.now(timezone.utc) - timedelta(days=30)
    stmt = (
        select(
            Execution.test_case_id,
            func.count().label("runs"),
            func.sum(case((Execution.status == "passed", 1), else_=0)).label("passed"),
            func.sum(case((Execution.status == "failed", 1), else_=0)).label("failed"),
        )
        .where(Execution.created_at >= since, Execution.test_case_id.is_not(None))
        .group_by(Execution.test_case_id)
        .having(func.count() > 1)
    )
    if project_id:
        stmt = stmt.where(Execution.project_id == project_id)
    res = await db.execute(stmt)
    flaky = []
    for r in res.all():
        p = int(r.passed or 0); f = int(r.failed or 0)
        if p > 0 and f > 0:
            tc = (await db.execute(select(TestCase).where(TestCase.id == r.test_case_id))).scalar_one_or_none()
            flaky.append({
                "test_case_id": r.test_case_id,
                "test_case_name": tc.name if tc else "Unknown",
                "runs": int(r.runs), "passed": p, "failed": f,
                "flakiness": round((min(p, f) / (p + f)) * 100, 1),
            })
    return sorted(flaky, key=lambda x: -x["flakiness"])
