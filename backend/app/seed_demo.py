"""Seed sample data: a demo project with environments, example test cases and elements.

Run with:  cd /app/backend && python -m app.seed_demo
"""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select

from app.core.db import AsyncSessionLocal, engine, Base
from app.modules.auth.models import User, Organization
from app.modules.project.models import (
    Project, Environment, TestCase, TestSuite, Element
)


SAMPLE_WEB_TC = [
    {
        "name": "Open example.com and verify",
        "description": "Simple smoke test against example.com",
        "type": "web",
        "priority": "high",
        "tags": ["smoke", "web"],
        "steps": [
            {"keyword": "navigate", "target": "", "value": "https://example.com", "description": "Open URL"},
            {"keyword": "verify_title", "target": "", "value": "Example", "description": "Verify page title"},
            {"keyword": "verify_visible", "target": "h1", "value": "", "description": "H1 is visible"},
            {"keyword": "verify_text", "target": "h1", "value": "Example Domain", "description": "Heading text matches"},
            {"keyword": "screenshot", "target": "", "value": "", "description": "Capture screenshot"},
        ],
    },
    {
        "name": "Search on DuckDuckGo",
        "description": "Search flow on DuckDuckGo",
        "type": "web",
        "priority": "medium",
        "tags": ["regression", "search"],
        "steps": [
            {"keyword": "navigate", "target": "", "value": "https://duckduckgo.com", "description": "Open DuckDuckGo"},
            {"keyword": "type", "target": "input[name='q']", "value": "playwright python", "description": "Type query"},
            {"keyword": "press", "target": "", "value": "Enter", "description": "Submit search"},
            {"keyword": "wait", "target": "", "value": "2", "description": "Wait 2s"},
            {"keyword": "screenshot", "target": "", "value": "", "description": "Capture results"},
        ],
    },
    {
        "name": "Fetch JSONPlaceholder post",
        "description": "API test against jsonplaceholder",
        "type": "api",
        "priority": "low",
        "tags": ["api", "smoke"],
        "steps": [
            {"keyword": "api_request", "target": "GET", "value": "https://jsonplaceholder.typicode.com/posts/1", "description": "GET post 1"},
        ],
    },
]


SAMPLE_ELEMENTS = [
    {"name": "Search input", "page": "DuckDuckGo Home", "primary_locator": "input[name='q']", "locator_type": "css", "alternate_locators": [{"locator": "#search_form_input_homepage", "type": "css"}]},
    {"name": "H1 heading", "page": "Example", "primary_locator": "h1", "locator_type": "css", "alternate_locators": []},
]


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.email == "admin@intratest.io"))).scalar_one_or_none()
        if not admin:
            print("Admin not found; start the server first.")
            return
        org_id = admin.organization_id

        # Project
        proj = (await db.execute(select(Project).where(Project.key == "DEMO"))).scalar_one_or_none()
        if not proj:
            proj = Project(name="Demo Project", key="DEMO", description="Sample project for IntraTest Studio",
                           organization_id=org_id, created_by=admin.id, tags=["demo"])
            db.add(proj)
            await db.flush()
            for env_name in ["QA", "UAT", "Stage", "Prod"]:
                db.add(Environment(project_id=proj.id, name=env_name, base_url=None, variables={}))

        # Test cases
        existing = (await db.execute(select(TestCase).where(TestCase.project_id == proj.id))).scalars().all()
        if not existing:
            tcs = []
            for spec in SAMPLE_WEB_TC:
                tc = TestCase(project_id=proj.id, created_by=admin.id, **spec)
                db.add(tc)
                tcs.append(tc)
            await db.flush()
            # Suite
            db.add(TestSuite(project_id=proj.id, name="Smoke Suite", description="Web smoke tests",
                             test_case_ids=[t.id for t in tcs if t.type == "web"], parallel=False, tags=["smoke"]))

        # Elements
        el_exists = (await db.execute(select(Element).where(Element.project_id == proj.id))).scalars().all()
        if not el_exists:
            for e in SAMPLE_ELEMENTS:
                db.add(Element(project_id=proj.id, **e))

        await db.commit()
        print(f"Seeded demo project: {proj.id}")


if __name__ == "__main__":
    asyncio.run(main())
