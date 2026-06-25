"""Web automation runner using Playwright."""
import asyncio
import json
import os
import time
import base64
from pathlib import Path
import httpx
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError, Error as PWError

SCREENSHOT_DIR = Path("/app/backend/storage/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


SELECTOR_TYPES = {"css", "xpath", "id", "text", "role", "name", "placeholder"}


def _to_pw_selector(target: str, locator_type: str | None = None) -> str:
    if not target:
        return ""
    t = target.strip()
    lt = (locator_type or "").lower()
    if lt == "xpath" or t.startswith("//") or t.startswith("xpath="):
        return t if t.startswith("xpath=") else f"xpath={t}"
    if lt == "id" or t.startswith("#"):
        return t if t.startswith("#") else f"#{t}"
    if lt == "text":
        return f"text={t}"
    if lt == "role":
        return f"role={t}"
    if lt == "placeholder":
        return f"[placeholder=\"{t}\"]"
    if lt == "name":
        return f"[name=\"{t}\"]"
    return t


async def _capture_shot(page, exec_id: str, idx: int) -> str | None:
    try:
        fname = f"{exec_id}_{idx}.png"
        path = SCREENSHOT_DIR / fname
        await page.screenshot(path=str(path), full_page=False)
        return f"/api/storage/screenshots/{fname}"
    except Exception:
        return None


def _get_json_path(obj, path: str):
    if not path or not path.startswith("$"):
        path = "$." + (path or "")
    parts = path.replace("[", ".").replace("]", "").split(".")
    cur = obj
    for p in parts[1:]:
        if p == "":
            continue
        if isinstance(cur, list):
            try: cur = cur[int(p)]
            except (ValueError, IndexError): return None
        elif isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur


def _eval_assertion(a: dict, status_code: int, rtime_ms: int, headers: dict, body):
    try:
        atype = a.get("type")
        op = a.get("operator", "equals")
        exp = a.get("expected")
        if atype == "status_code":
            actual = status_code
        elif atype == "response_time_ms":
            actual = rtime_ms
        elif atype == "header":
            actual = headers.get(a.get("path") or "", None)
        elif atype == "json_path":
            actual = _get_json_path(body, a.get("path") or "$")
        elif atype == "body_contains":
            return (str(exp) in (json.dumps(body) if not isinstance(body, str) else body)), None
        else:
            return False, f"Unknown assertion type: {atype}"
        if op == "equals": passed = str(actual) == str(exp)
        elif op == "not_equals": passed = str(actual) != str(exp)
        elif op == "less_than": passed = float(actual) < float(exp)
        elif op == "greater_than": passed = float(actual) > float(exp)
        elif op == "contains": passed = str(exp) in str(actual)
        else: return False, f"Unknown operator: {op}"
        return passed, None if passed else f"expected {exp}, got {actual}"
    except Exception as e:
        return False, str(e)


async def _run_api_step(step: dict, base_url: str | None):
    cfg = step.get("config") or {}
    method = (cfg.get("method") or step.get("target") or "GET").upper()
    url = cfg.get("url") or step.get("value") or ""
    if base_url and url and not url.startswith("http"):
        url = base_url.rstrip("/") + "/" + url.lstrip("/")
    headers = dict(cfg.get("headers") or {})
    body = cfg.get("body")
    body_type = cfg.get("body_type") or "json"
    timeout_ms = cfg.get("timeout_ms") or 30000
    assertions = cfg.get("assertions") or []
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000, follow_redirects=True) as client:
            kwargs = {"method": method, "url": url, "headers": headers}
            if body is not None and method in ("POST", "PUT", "PATCH", "DELETE"):
                if body_type == "json": kwargs["json"] = body
                elif body_type == "form": kwargs["data"] = body
                else: kwargs["content"] = str(body)
            r = await client.request(**kwargs)
            rtime_ms = int((time.perf_counter() - started) * 1000)
            ctype = r.headers.get("content-type", "")
            if "application/json" in ctype:
                try: resp_body = r.json()
                except Exception: resp_body = r.text
            else:
                resp_body = r.text[:50000]
            if not assertions:
                if 200 <= r.status_code < 400:
                    return "passed", None
                return "failed", f"HTTP {r.status_code}"
            for a in assertions:
                passed, msg = _eval_assertion(a, r.status_code, rtime_ms, dict(r.headers), resp_body)
                if not passed:
                    return "failed", f"{a.get('type')} {a.get('operator')} {a.get('expected')} -> {msg}"
            return "passed", None
    except Exception as e:
        return "failed", f"{type(e).__name__}: {e}"


async def execute_steps(steps, base_url, exec_id, browser_kind="chromium", capture_on_failure=True, component_resolver=None):
    """Execute web test steps. component_resolver(component_id) -> list[step] | None."""
    expanded = []  # (step, owner_component_id|None)

    async def _expand(items, owner=None, depth=0):
        if depth > 5:
            return
        for s in items:
            if (s.get("keyword") or "").lower() == "use_component":
                comp_id = s.get("target")
                inner = None
                if component_resolver and comp_id:
                    inner = await component_resolver(comp_id)
                if inner:
                    await _expand(inner, owner=comp_id, depth=depth + 1)
                else:
                    expanded.append((s, owner))
            else:
                expanded.append((s, owner))

    await _expand(steps)

    results = []
    async with async_playwright() as p:
        browser_launcher = getattr(p, browser_kind if browser_kind in ("chromium", "firefox", "webkit") else "chromium")
        browser = await browser_launcher.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        for idx, (step, owner_component) in enumerate(expanded):
            kw = (step.get("keyword") or "").lower().replace(" ", "_")
            target = step.get("target") or ""
            value = step.get("value") or ""
            locator_type = step.get("locator_type")
            started = time.perf_counter()
            status = "passed"
            error = None
            healed = False
            healed_locator = None
            screenshot_url = None

            try:
                if kw in ("open_browser", "open"):
                    pass
                elif kw in ("navigate", "go_to", "navigate_to_url", "open_url"):
                    url = value or target
                    if base_url and url and not url.startswith("http"):
                        url = base_url.rstrip("/") + "/" + url.lstrip("/")
                    await page.goto(url, timeout=20000)
                elif kw in ("click", "click_element"):
                    sel = _to_pw_selector(target, locator_type)
                    try:
                        await page.locator(sel).first.click(timeout=10000)
                    except PWError as primary_err:
                        alts = step.get("alternate_locators") or []
                        clicked = False
                        for alt in alts:
                            try:
                                alt_sel = _to_pw_selector(alt.get("locator", ""), alt.get("type"))
                                await page.locator(alt_sel).first.click(timeout=5000)
                                healed = True
                                healed_locator = alt.get("locator")
                                clicked = True
                                break
                            except Exception:
                                continue
                        if not clicked:
                            raise primary_err
                elif kw in ("type", "enter_text", "fill"):
                    sel = _to_pw_selector(target, locator_type)
                    await page.locator(sel).first.fill(value, timeout=10000)
                elif kw in ("press", "press_key"):
                    await page.keyboard.press(value or target)
                elif kw in ("wait", "sleep"):
                    try:
                        await asyncio.sleep(min(float(value or target or 1), 10))
                    except ValueError:
                        await asyncio.sleep(1)
                elif kw in ("wait_for_element",):
                    sel = _to_pw_selector(target, locator_type)
                    await page.locator(sel).first.wait_for(timeout=15000)
                elif kw in ("verify_text", "assert_text"):
                    sel = _to_pw_selector(target, locator_type) if target else "body"
                    txt = await page.locator(sel).first.text_content(timeout=10000)
                    if value and value not in (txt or ""):
                        raise AssertionError(f"Text '{value}' not found in '{txt}'")
                elif kw in ("verify_url", "assert_url"):
                    cur = page.url
                    if value and value not in cur:
                        raise AssertionError(f"URL does not contain '{value}', current: {cur}")
                elif kw in ("verify_title",):
                    title = await page.title()
                    if value and value not in title:
                        raise AssertionError(f"Title does not contain '{value}', current: {title}")
                elif kw in ("verify_visible",):
                    sel = _to_pw_selector(target, locator_type)
                    visible = await page.locator(sel).first.is_visible(timeout=10000)
                    if not visible:
                        raise AssertionError(f"Element {target} not visible")
                elif kw in ("select", "select_dropdown"):
                    sel = _to_pw_selector(target, locator_type)
                    await page.locator(sel).first.select_option(value, timeout=10000)
                elif kw in ("check", "check_checkbox"):
                    sel = _to_pw_selector(target, locator_type)
                    await page.locator(sel).first.check(timeout=10000)
                elif kw in ("screenshot",):
                    screenshot_url = await _capture_shot(page, exec_id, idx)
                elif kw == "api_request":
                    status, error = await _run_api_step(step, base_url)
                elif kw == "use_component":
                    status = "skipped"
                    error = "Component not resolved"
                else:
                    status = "skipped"
                    error = f"Unknown keyword: {step.get('keyword')}"
            except (PWTimeoutError, PWError, AssertionError, Exception) as e:
                status = "failed"
                error = f"{type(e).__name__}: {str(e)[:500]}"
                if capture_on_failure:
                    screenshot_url = await _capture_shot(page, exec_id, idx)

            duration_ms = int((time.perf_counter() - started) * 1000)
            results.append({
                "index": idx,
                "keyword": step.get("keyword"),
                "target": target,
                "value": value,
                "status": "healed" if healed else status,
                "healed": healed,
                "healed_locator": healed_locator,
                "duration_ms": duration_ms,
                "error_message": error,
                "screenshot_url": screenshot_url,
                "component_id": owner_component,
            })
            if status == "failed":
                break

        await context.close()
        await browser.close()
    return results
