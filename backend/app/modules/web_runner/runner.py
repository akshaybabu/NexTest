"""Web automation runner using Playwright."""
import asyncio
import os
import time
import base64
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PWTimeoutError, Error as PWError

SCREENSHOT_DIR = Path("/app/backend/storage/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


SELECTOR_TYPES = {"css", "xpath", "id", "text", "role", "name", "placeholder"}


def _to_pw_selector(target: str, locator_type: str | None = None) -> str:
    """Convert locator hint into a Playwright selector string."""
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
    return t  # default CSS


async def _capture_shot(page, exec_id: str, idx: int) -> str | None:
    try:
        fname = f"{exec_id}_{idx}.png"
        path = SCREENSHOT_DIR / fname
        await page.screenshot(path=str(path), full_page=False)
        return f"/api/storage/screenshots/{fname}"
    except Exception:
        return None


async def execute_steps(steps: list[dict], base_url: str | None, exec_id: str, browser_kind: str = "chromium", capture_on_failure: bool = True):
    """Execute web test steps. Returns list of step results."""
    results = []
    async with async_playwright() as p:
        browser_launcher = getattr(p, browser_kind if browser_kind in ("chromium", "firefox", "webkit") else "chromium")
        browser = await browser_launcher.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await context.new_page()

        for idx, step in enumerate(steps):
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
                    pass  # browser already open
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
                        # self-healing attempt
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
            })
            if status == "failed":
                break

        await context.close()
        await browser.close()
    return results
