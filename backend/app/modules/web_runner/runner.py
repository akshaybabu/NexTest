"""Web automation runner using Playwright. Supports:
- Weighted alternate locators (self-healing prefers high-weight).
- Variable substitution: ${var} replaced from runtime store.
- API steps with response variable extraction (chaining).
- Inline expansion of reusable components.
"""
import asyncio
import json
import os
import re
import time
from pathlib import Path
import httpx
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError, Error as PWError

SCREENSHOT_DIR = Path("/app/backend/storage/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

VAR_PATTERN = re.compile(r"\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _substitute(s, variables):
    if not isinstance(s, str) or not variables:
        return s
    return VAR_PATTERN.sub(lambda m: str(variables.get(m.group(1), m.group(0))), s)


def _sub_obj(obj, variables):
    if isinstance(obj, str):
        return _substitute(obj, variables)
    if isinstance(obj, list):
        return [_sub_obj(x, variables) for x in obj]
    if isinstance(obj, dict):
        return {k: _sub_obj(v, variables) for k, v in obj.items()}
    return obj


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


def _ordered_locators(step: dict, element_lookup: dict | None):
    """Return [(locator, type, weight, source)] sorted by weight desc.

    Sources: 'primary', 'alternate', 'element-primary', 'element-alternate'.
    """
    items = []
    el_id = (step.get("config") or {}).get("element_id") if step.get("config") else None
    if el_id and element_lookup and el_id in element_lookup:
        el = element_lookup[el_id]
        items.append((el["primary_locator"], el.get("locator_type"), el.get("confidence") or 1.0, "element-primary"))
        for alt in (el.get("alternate_locators") or []):
            items.append((alt.get("locator"), alt.get("type"), alt.get("weight") or 0.5, "element-alternate"))
    if step.get("target"):
        items.append((step["target"], step.get("locator_type"), 1.0, "primary"))
    for alt in (step.get("alternate_locators") or []):
        items.append((alt.get("locator"), alt.get("type"), alt.get("weight") or 0.5, "alternate"))
    items = [x for x in items if x[0]]
    items.sort(key=lambda x: -x[2])
    return items


async def _try_action(page, locators, action, timeout_ms=10000):
    """Try locators in weight order. Returns (success, healed, used_locator, error)."""
    last_err = None
    first = True
    for loc, ltype, weight, source in locators:
        sel = _to_pw_selector(loc, ltype)
        try:
            await action(page.locator(sel).first, timeout_ms)
            return True, (not first or source.endswith("alternate")), loc, None
        except Exception as e:
            last_err = e
            first = False
            continue
    return False, False, None, last_err


async def _capture_shot(page, exec_id, idx):
    try:
        fname = f"{exec_id}_{idx}.png"
        path = SCREENSHOT_DIR / fname
        await page.screenshot(path=str(path), full_page=False)
        return f"/api/storage/screenshots/{fname}"
    except Exception:
        return None


def _get_json_path(obj, path):
    if not path: return obj
    if not path.startswith("$"): path = "$." + path
    parts = path.replace("[", ".").replace("]", "").split(".")
    cur = obj
    for p in parts[1:]:
        if p == "": continue
        if isinstance(cur, list):
            try: cur = cur[int(p)]
            except (ValueError, IndexError): return None
        elif isinstance(cur, dict):
            cur = cur.get(p)
        else: return None
    return cur


def _eval_assertion(a, status, rtime, headers, body):
    try:
        atype = a.get("type"); op = a.get("operator", "equals"); exp = a.get("expected")
        if atype == "status_code": actual = status
        elif atype == "response_time_ms": actual = rtime
        elif atype == "header": actual = headers.get(a.get("path") or "", None)
        elif atype == "json_path": actual = _get_json_path(body, a.get("path") or "$")
        elif atype == "body_contains":
            return (str(exp) in (json.dumps(body) if not isinstance(body, str) else body)), None
        else: return False, f"Unknown type {atype}"
        if op == "equals": passed = str(actual) == str(exp)
        elif op == "not_equals": passed = str(actual) != str(exp)
        elif op == "less_than": passed = float(actual) < float(exp)
        elif op == "greater_than": passed = float(actual) > float(exp)
        elif op == "contains": passed = str(exp) in str(actual)
        else: return False, f"Unknown op {op}"
        return passed, None if passed else f"expected {exp}, got {actual}"
    except Exception as e:
        return False, str(e)


async def _run_api_step(step, base_url, variables):
    """Returns (status, error, extracted_vars dict, response_preview)."""
    cfg = _sub_obj(step.get("config") or {}, variables)
    method = (cfg.get("method") or step.get("target") or "GET").upper()
    url = cfg.get("url") or _substitute(step.get("value") or "", variables)
    if base_url and url and not url.startswith("http"):
        url = base_url.rstrip("/") + "/" + url.lstrip("/")
    headers = dict(cfg.get("headers") or {})
    body = cfg.get("body")
    body_type = cfg.get("body_type") or "json"
    timeout_ms = cfg.get("timeout_ms") or 30000
    assertions = cfg.get("assertions") or []
    extracts = cfg.get("extract") or []  # [{name, path}]
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000, follow_redirects=True) as client:
            kw = {"method": method, "url": url, "headers": headers}
            if body is not None and method in ("POST", "PUT", "PATCH", "DELETE"):
                if body_type == "json": kw["json"] = body
                elif body_type == "form": kw["data"] = body
                else: kw["content"] = str(body)
            r = await client.request(**kw)
            rtime = int((time.perf_counter() - started) * 1000)
            ctype = r.headers.get("content-type", "")
            if "application/json" in ctype:
                try: rbody = r.json()
                except Exception: rbody = r.text
            else:
                rbody = r.text[:50000]
            extracted = {}
            for e in extracts:
                name = e.get("name"); path = e.get("path")
                if name:
                    extracted[name] = _get_json_path(rbody, path or "$")
            preview = {"status": r.status_code, "time_ms": rtime, "body": rbody}
            if not assertions:
                if 200 <= r.status_code < 400:
                    return "passed", None, extracted, preview
                return "failed", f"HTTP {r.status_code}", extracted, preview
            for a in assertions:
                ok, msg = _eval_assertion(a, r.status_code, rtime, dict(r.headers), rbody)
                if not ok:
                    return "failed", f"{a.get('type')} {a.get('operator')} {a.get('expected')} -> {msg}", extracted, preview
            return "passed", None, extracted, preview
    except Exception as e:
        return "failed", f"{type(e).__name__}: {e}", {}, None


async def execute_steps(
    steps,
    base_url,
    exec_id,
    browser_kind="chromium",
    capture_on_failure=True,
    component_resolver=None,
    element_lookup=None,
    initial_variables=None,
):
    """Execute steps. element_lookup: dict[el_id] -> {primary_locator, locator_type, alternate_locators[], confidence}."""
    variables = dict(initial_variables or {})
    expanded = []  # [(step, owner_component_id)]

    async def _expand(items, owner=None, depth=0):
        if depth > 5: return
        for s in items:
            if (s.get("keyword") or "").lower() == "use_component":
                cid = s.get("target")
                inner = await component_resolver(cid) if (component_resolver and cid) else None
                if inner:
                    await _expand(inner, owner=cid, depth=depth + 1)
                else:
                    expanded.append((s, owner))
            else:
                expanded.append((s, owner))
    await _expand(steps)

    results = []
    async with async_playwright() as p:
        launcher = getattr(p, browser_kind if browser_kind in ("chromium", "firefox", "webkit") else "chromium")
        browser = await launcher.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        for idx, (raw_step, owner) in enumerate(expanded):
            step = _sub_obj(raw_step, variables)
            kw = (step.get("keyword") or "").lower().replace(" ", "_")
            target = step.get("target") or ""
            value = step.get("value") or ""
            started = time.perf_counter()
            status = "passed"; error = None; healed = False; healed_locator = None; screenshot_url = None
            try:
                if kw in ("open_browser", "open"):
                    pass
                elif kw in ("navigate", "go_to", "navigate_to_url", "open_url"):
                    url = value or target
                    if base_url and url and not url.startswith("http"):
                        url = base_url.rstrip("/") + "/" + url.lstrip("/")
                    await page.goto(url, timeout=20000)
                elif kw in ("click", "click_element"):
                    locs = _ordered_locators(step, element_lookup)
                    async def _click(locator, t): await locator.click(timeout=t)
                    ok, was_healed, used, err = await _try_action(page, locs, _click)
                    if not ok: raise err or Exception("Click failed")
                    healed = was_healed; healed_locator = used if was_healed else None
                elif kw in ("type", "enter_text", "fill"):
                    locs = _ordered_locators(step, element_lookup)
                    async def _fill(locator, t): await locator.fill(value, timeout=t)
                    ok, was_healed, used, err = await _try_action(page, locs, _fill)
                    if not ok: raise err or Exception("Fill failed")
                    healed = was_healed; healed_locator = used if was_healed else None
                elif kw in ("press", "press_key"):
                    await page.keyboard.press(value or target)
                elif kw in ("wait", "sleep"):
                    try: await asyncio.sleep(min(float(value or target or 1), 10))
                    except ValueError: await asyncio.sleep(1)
                elif kw == "wait_for_element":
                    locs = _ordered_locators(step, element_lookup)
                    async def _wait(locator, t): await locator.wait_for(timeout=t)
                    ok, was_healed, used, err = await _try_action(page, locs, _wait, timeout_ms=15000)
                    if not ok: raise err or Exception("Wait failed")
                elif kw in ("verify_text", "assert_text"):
                    locs = _ordered_locators(step, element_lookup)
                    if not locs:
                        txt = await page.text_content("body", timeout=10000)
                    else:
                        txt = None
                        for loc, ltype, w, src in locs:
                            try:
                                txt = await page.locator(_to_pw_selector(loc, ltype)).first.text_content(timeout=10000)
                                healed = (src.endswith("alternate")); healed_locator = loc if healed else None
                                break
                            except Exception:
                                continue
                    if value and value not in (txt or ""):
                        raise AssertionError(f"Text '{value}' not found in '{txt}'")
                elif kw == "verify_url":
                    if value and value not in page.url:
                        raise AssertionError(f"URL does not contain '{value}' (current: {page.url})")
                elif kw == "verify_title":
                    title = await page.title()
                    if value and value not in title:
                        raise AssertionError(f"Title does not contain '{value}' (current: {title})")
                elif kw == "verify_visible":
                    locs = _ordered_locators(step, element_lookup)
                    found = False
                    for loc, ltype, w, src in locs:
                        try:
                            if await page.locator(_to_pw_selector(loc, ltype)).first.is_visible(timeout=10000):
                                found = True
                                healed = src.endswith("alternate"); healed_locator = loc if healed else None
                                break
                        except Exception:
                            continue
                    if not found: raise AssertionError(f"Element not visible")
                elif kw in ("select", "select_dropdown"):
                    locs = _ordered_locators(step, element_lookup)
                    async def _select(locator, t): await locator.select_option(value, timeout=t)
                    ok, was_healed, used, err = await _try_action(page, locs, _select)
                    if not ok: raise err or Exception("Select failed")
                elif kw in ("check", "check_checkbox"):
                    locs = _ordered_locators(step, element_lookup)
                    async def _check(locator, t): await locator.check(timeout=t)
                    ok, was_healed, used, err = await _try_action(page, locs, _check)
                    if not ok: raise err or Exception("Check failed")
                elif kw == "screenshot":
                    screenshot_url = await _capture_shot(page, exec_id, idx)
                elif kw == "api_request":
                    status, error, extracted, preview = await _run_api_step(step, base_url, variables)
                    if extracted:
                        variables.update(extracted)
                elif kw == "use_component":
                    status = "skipped"; error = "Component not resolved"
                else:
                    status = "skipped"; error = f"Unknown keyword: {step.get('keyword')}"
            except (PWTimeoutError, PWError, AssertionError, Exception) as e:
                status = "failed"
                error = f"{type(e).__name__}: {str(e)[:500]}"
                if capture_on_failure:
                    screenshot_url = await _capture_shot(page, exec_id, idx)

            duration_ms = int((time.perf_counter() - started) * 1000)
            results.append({
                "index": idx,
                "keyword": raw_step.get("keyword"),
                "target": target,
                "value": value,
                "status": "healed" if healed else status,
                "healed": healed,
                "healed_locator": healed_locator,
                "duration_ms": duration_ms,
                "error_message": error,
                "screenshot_url": screenshot_url,
                "component_id": owner,
            })
            if status == "failed":
                break

        await context.close()
        await browser.close()
    return {"results": results, "variables": variables}
