"""API Testing runner - real HTTP execution with assertions."""
import time
import json
import httpx
from typing import Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User

router = APIRouter(prefix="/api-tests", tags=["api-testing"])


class Assertion(BaseModel):
    type: str  # status_code | response_time_ms | json_path | header | body_contains
    operator: str = "equals"  # equals|not_equals|less_than|greater_than|contains|matches
    expected: Any | None = None
    path: str | None = None  # JSON path like $.data.id or header name


class ApiTestRunRequest(BaseModel):
    method: str = "GET"
    url: str
    headers: dict = {}
    query_params: dict = {}
    body: Any | None = None
    body_type: str = "json"  # json | text | form
    auth_type: str = "none"  # none | basic | bearer | api_key
    auth_config: dict = {}
    timeout_ms: int = 30000
    assertions: list[Assertion] = []


class AssertionResult(BaseModel):
    type: str
    operator: str
    expected: Any | None = None
    actual: Any | None = None
    passed: bool
    message: str | None = None


class ApiTestRunResponse(BaseModel):
    status_code: int | None = None
    response_time_ms: int
    response_headers: dict
    response_body: Any | None = None
    response_size_bytes: int = 0
    error: str | None = None
    assertions: list[AssertionResult]
    overall_passed: bool


def _get_json_path(obj, path: str):
    """Very small JSONPath-ish: supports $.a.b.0 and $.a[0].b."""
    if not path.startswith("$"):
        path = "$." + path
    parts = path.replace("[", ".").replace("]", "").split(".")
    cur = obj
    for p in parts[1:]:
        if p == "":
            continue
        if isinstance(cur, list):
            try:
                cur = cur[int(p)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur


def _eval_assertion(a: Assertion, status_code: int, rtime_ms: int, headers: dict, body) -> AssertionResult:
    actual = None
    passed = False
    msg = None
    try:
        if a.type == "status_code":
            actual = status_code
        elif a.type == "response_time_ms":
            actual = rtime_ms
        elif a.type == "header":
            actual = headers.get(a.path or "", None)
        elif a.type == "json_path":
            actual = _get_json_path(body, a.path or "$")
        elif a.type == "body_contains":
            actual = a.expected in (json.dumps(body) if not isinstance(body, str) else body)
            passed = bool(actual)
            return AssertionResult(type=a.type, operator=a.operator, expected=a.expected, actual=actual, passed=passed)

        op = a.operator
        exp = a.expected
        if op == "equals":
            passed = actual == exp
        elif op == "not_equals":
            passed = actual != exp
        elif op == "less_than":
            passed = float(actual) < float(exp)
        elif op == "greater_than":
            passed = float(actual) > float(exp)
        elif op == "contains":
            passed = str(exp) in str(actual)
        else:
            msg = f"Unknown operator {op}"
    except Exception as e:
        msg = str(e)
    return AssertionResult(type=a.type, operator=a.operator, expected=a.expected, actual=actual, passed=passed, message=msg)


@router.post("/run", response_model=ApiTestRunResponse)
async def run_api_test(payload: ApiTestRunRequest, user: User = Depends(get_current_user)):
    headers = dict(payload.headers or {})
    # Auth
    if payload.auth_type == "bearer" and payload.auth_config.get("token"):
        headers["Authorization"] = f"Bearer {payload.auth_config['token']}"
    elif payload.auth_type == "api_key":
        k = payload.auth_config.get("key")
        v = payload.auth_config.get("value")
        loc = payload.auth_config.get("in", "header")
        if k and v and loc == "header":
            headers[k] = v
    basic_auth = None
    if payload.auth_type == "basic":
        basic_auth = (payload.auth_config.get("username", ""), payload.auth_config.get("password", ""))

    started = time.perf_counter()
    error = None
    status_code = None
    resp_headers: dict = {}
    resp_body: Any = None
    size = 0
    try:
        async with httpx.AsyncClient(timeout=payload.timeout_ms / 1000, follow_redirects=True) as client:
            req_kwargs = {
                "method": payload.method.upper(),
                "url": payload.url,
                "headers": headers,
                "params": payload.query_params or None,
            }
            if basic_auth:
                req_kwargs["auth"] = basic_auth
            if payload.body is not None and payload.method.upper() in ("POST", "PUT", "PATCH", "DELETE"):
                if payload.body_type == "json":
                    req_kwargs["json"] = payload.body
                elif payload.body_type == "form":
                    req_kwargs["data"] = payload.body
                else:
                    req_kwargs["content"] = str(payload.body)
            r = await client.request(**req_kwargs)
            status_code = r.status_code
            resp_headers = dict(r.headers)
            size = len(r.content)
            ctype = r.headers.get("content-type", "")
            if "application/json" in ctype:
                try:
                    resp_body = r.json()
                except Exception:
                    resp_body = r.text
            else:
                resp_body = r.text[:50000]
    except Exception as e:
        error = f"{type(e).__name__}: {e}"

    rtime_ms = int((time.perf_counter() - started) * 1000)
    assertions = [_eval_assertion(a, status_code or 0, rtime_ms, resp_headers, resp_body) for a in payload.assertions]
    overall = (error is None) and all(a.passed for a in assertions)

    return ApiTestRunResponse(
        status_code=status_code,
        response_time_ms=rtime_ms,
        response_headers=resp_headers,
        response_body=resp_body,
        response_size_bytes=size,
        error=error,
        assertions=assertions,
        overall_passed=overall,
    )
