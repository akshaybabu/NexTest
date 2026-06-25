"""Execution orchestrator: starts background test runs."""
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from app.core.db import get_db, AsyncSessionLocal
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.modules.project.models import (
    Execution, ExecutionStep, TestCase, TestSuite, Environment, Project, Element
)
from app.modules.test_design.component_models import ReusableComponent
from app.modules.web_runner.runner import execute_steps


async def _resolve_component(component_id: str):
    async with AsyncSessionLocal() as db:
        c = (await db.execute(select(ReusableComponent).where(ReusableComponent.id == component_id))).scalar_one_or_none()
        return (c.steps or []) if c else None


async def _build_element_lookup(project_id: str) -> dict:
    """Build {element_id: {locator info}} for the project."""
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Element).where(Element.project_id == project_id))).scalars().all()
        return {
            e.id: {
                "primary_locator": e.primary_locator,
                "locator_type": e.locator_type,
                "alternate_locators": e.alternate_locators or [],
                "confidence": e.confidence or 1.0,
            } for e in rows
        }

router = APIRouter(prefix="/executions", tags=["executions"])


class ExecuteRequest(BaseModel):
    test_case_id: str | None = None
    suite_id: str | None = None
    environment_id: str | None = None
    browser: str = "chromium"


class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    suite_id: str | None = None
    test_case_id: str | None = None
    environment_id: str | None = None
    browser: str
    status: str
    total_steps: int
    passed_steps: int
    failed_steps: int
    duration_ms: int
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime


class ExecutionStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    execution_id: str
    test_case_id: str | None = None
    step_index: int
    keyword: str
    target: str | None = None
    value: str | None = None
    status: str
    duration_ms: int
    error_message: str | None = None
    screenshot_url: str | None = None
    healed: bool
    healed_locator: str | None = None


async def _run_test_case(execution_id: str, test_case_id: str, env_base_url: str | None, browser: str):
    """Background task: execute a single test case."""
    async with AsyncSessionLocal() as db:
        execu = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one_or_none()
        tc = (await db.execute(select(TestCase).where(TestCase.id == test_case_id))).scalar_one_or_none()
        if not execu or not tc:
            return
        execu.status = "running"
        execu.started_at = datetime.now(timezone.utc)
        execu.total_steps = len(tc.steps or [])
        await db.commit()

    started = datetime.now(timezone.utc)
    error = None
    results = []
    try:
        if tc.type == "web":
            el_lookup = await _build_element_lookup(tc.project_id)
            out = await execute_steps(
                tc.steps or [], env_base_url, execution_id, browser,
                component_resolver=_resolve_component, element_lookup=el_lookup,
            )
            results = out["results"]
        else:
            results = [{"index": i, "keyword": s.get("keyword"), "target": s.get("target"), "value": s.get("value"),
                        "status": "skipped", "healed": False, "healed_locator": None,
                        "duration_ms": 0, "error_message": "Use /api/api-tests/run for API tests", "screenshot_url": None}
                       for i, s in enumerate(tc.steps or [])]
    except Exception as e:
        error = f"{type(e).__name__}: {e}"

    passed = sum(1 for r in results if r["status"] in ("passed", "healed"))
    failed = sum(1 for r in results if r["status"] == "failed")
    final_status = "failed" if failed > 0 or error else ("passed" if results else "failed")
    finished = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        execu = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one()
        execu.status = final_status
        execu.passed_steps = passed
        execu.failed_steps = failed
        execu.duration_ms = int((finished - started).total_seconds() * 1000)
        execu.finished_at = finished
        execu.error_message = error
        for r in results:
            db.add(ExecutionStep(
                execution_id=execution_id,
                test_case_id=test_case_id,
                step_index=r["index"],
                keyword=r["keyword"] or "",
                target=r.get("target"),
                value=r.get("value"),
                status=r["status"],
                duration_ms=r["duration_ms"],
                error_message=r.get("error_message"),
                screenshot_url=r.get("screenshot_url"),
                healed=r.get("healed", False),
                healed_locator=r.get("healed_locator"),
            ))
        await db.commit()


async def _run_suite(execution_id: str, suite_id: str, env_base_url: str | None, browser: str):
    async with AsyncSessionLocal() as db:
        execu = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one_or_none()
        suite = (await db.execute(select(TestSuite).where(TestSuite.id == suite_id))).scalar_one_or_none()
        if not execu or not suite:
            return
        execu.status = "running"
        execu.started_at = datetime.now(timezone.utc)
        await db.commit()
        tc_ids = suite.test_case_ids or []
        tcs = []
        if tc_ids:
            tcs = (await db.execute(select(TestCase).where(TestCase.id.in_(tc_ids)))).scalars().all()

    started = datetime.now(timezone.utc)
    all_results = []
    total_steps = 0
    for tc in tcs:
        steps = tc.steps or []
        total_steps += len(steps)
        try:
            if tc.type == "web":
                el_lookup = await _build_element_lookup(tc.project_id)
                out = await execute_steps(
                    steps, env_base_url, execution_id, browser,
                    component_resolver=_resolve_component, element_lookup=el_lookup,
                )
                res = out["results"]
            else:
                res = [{"index": i, "keyword": s.get("keyword"), "target": s.get("target"), "value": s.get("value"),
                        "status": "skipped", "healed": False, "healed_locator": None,
                        "duration_ms": 0, "error_message": "Non-web step", "screenshot_url": None}
                       for i, s in enumerate(steps)]
        except Exception as e:
            res = [{"index": 0, "keyword": "suite_error", "target": None, "value": None,
                    "status": "failed", "healed": False, "healed_locator": None, "duration_ms": 0,
                    "error_message": f"{type(e).__name__}: {e}", "screenshot_url": None}]
        all_results.append((tc.id, res))

    passed = 0
    failed = 0
    for tc_id, res in all_results:
        for r in res:
            if r["status"] in ("passed", "healed"):
                passed += 1
            elif r["status"] == "failed":
                failed += 1

    finished = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        execu = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one()
        execu.status = "failed" if failed > 0 else ("passed" if passed > 0 else "failed")
        execu.passed_steps = passed
        execu.failed_steps = failed
        execu.total_steps = total_steps
        execu.duration_ms = int((finished - started).total_seconds() * 1000)
        execu.finished_at = finished
        for tc_id, res in all_results:
            for r in res:
                db.add(ExecutionStep(
                    execution_id=execution_id,
                    test_case_id=tc_id,
                    step_index=r["index"],
                    keyword=r["keyword"] or "",
                    target=r.get("target"),
                    value=r.get("value"),
                    status=r["status"],
                    duration_ms=r["duration_ms"],
                    error_message=r.get("error_message"),
                    screenshot_url=r.get("screenshot_url"),
                    healed=r.get("healed", False),
                    healed_locator=r.get("healed_locator"),
                ))
        await db.commit()


@router.post("/run", response_model=ExecutionOut)
async def trigger_execution(
    payload: ExecuteRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.test_case_id and not payload.suite_id:
        raise HTTPException(400, "Provide test_case_id or suite_id")

    project_id = None
    base_url = None
    if payload.environment_id:
        env = (await db.execute(select(Environment).where(Environment.id == payload.environment_id))).scalar_one_or_none()
        if env:
            base_url = env.base_url
            project_id = env.project_id

    if payload.test_case_id:
        tc = (await db.execute(select(TestCase).where(TestCase.id == payload.test_case_id))).scalar_one_or_none()
        if not tc:
            raise HTTPException(404, "Test case not found")
        project_id = project_id or tc.project_id
    else:
        suite = (await db.execute(select(TestSuite).where(TestSuite.id == payload.suite_id))).scalar_one_or_none()
        if not suite:
            raise HTTPException(404, "Suite not found")
        project_id = project_id or suite.project_id

    execu = Execution(
        project_id=project_id,
        suite_id=payload.suite_id,
        test_case_id=payload.test_case_id,
        environment_id=payload.environment_id,
        triggered_by=user.id,
        browser=payload.browser,
        status="queued",
    )
    db.add(execu)
    await db.commit()
    await db.refresh(execu)

    if payload.test_case_id:
        background_tasks.add_task(_run_test_case, execu.id, payload.test_case_id, base_url, payload.browser)
    else:
        background_tasks.add_task(_run_suite, execu.id, payload.suite_id, base_url, payload.browser)

    return ExecutionOut.model_validate(execu)


@router.get("", response_model=list[ExecutionOut])
async def list_executions(project_id: str | None = None, limit: int = 50, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Execution).order_by(desc(Execution.created_at)).limit(limit)
    if project_id:
        stmt = stmt.where(Execution.project_id == project_id)
    res = await db.execute(stmt)
    return [ExecutionOut.model_validate(e) for e in res.scalars().all()]


@router.get("/{execution_id}", response_model=ExecutionOut)
async def get_execution(execution_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Execution not found")
    return ExecutionOut.model_validate(e)


@router.get("/{execution_id}/steps", response_model=list[ExecutionStepOut])
async def get_execution_steps(execution_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    res = await db.execute(select(ExecutionStep).where(ExecutionStep.execution_id == execution_id).order_by(ExecutionStep.step_index))
    return [ExecutionStepOut.model_validate(s) for s in res.scalars().all()]


@router.post("/{execution_id}/cancel", response_model=ExecutionOut)
async def cancel_execution(execution_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    e = (await db.execute(select(Execution).where(Execution.id == execution_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Execution not found")
    if e.status in ("queued", "running"):
        e.status = "cancelled"
        e.finished_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(e)
    return ExecutionOut.model_validate(e)
