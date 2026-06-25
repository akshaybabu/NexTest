"""IntraTest Studio - FastAPI backend (modular monolith with microservice boundaries).

Modules: auth, project, test_design, execution, web_runner, api_testing, element, reporting, admin.
Database: PostgreSQL via SQLAlchemy async.
"""
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.db import engine, Base, AsyncSessionLocal
from app.core.security import hash_password, verify_password

# Import models so they are registered with Base.metadata
from app.modules.auth.models import User, Organization, AuditLog  # noqa: F401
from app.modules.project.models import (  # noqa: F401
    Project, Environment, Element, TestCase, TestSuite,
    Execution, ExecutionStep, TestData, Integration,
)
from app.modules.test_design.component_models import ReusableComponent  # noqa: F401

# Routers
from app.modules.auth.router import router as auth_router
from app.modules.project.router import router as project_router
from app.modules.test_design.router import router as test_design_router
from app.modules.test_design.keywords import router as keywords_router
from app.modules.test_design.components_router import router as components_router
from app.modules.element.router import router as element_router
from app.modules.execution.router import router as execution_router
from app.modules.api_testing.router import router as api_testing_router
from app.modules.reporting.router import router as reporting_router
from app.modules.admin.router import router as admin_router
from app.modules.test_data.router import router as test_data_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("intratest")


async def _seed_admin_and_demo():
    """Idempotent admin + demo user seeding."""
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@intratest.io")
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
    demo_email = os.environ.get("DEMO_USER_EMAIL", "qa@intratest.io")
    demo_pwd = os.environ.get("DEMO_USER_PASSWORD", "Qa@12345")

    async with AsyncSessionLocal() as db:
        # default org
        org = (await db.execute(select(Organization).where(Organization.slug == "intratest"))).scalar_one_or_none()
        if not org:
            org = Organization(name="IntraTest", slug="intratest", description="Default organization")
            db.add(org)
            await db.flush()

        # admin
        admin = (await db.execute(select(User).where(User.email == admin_email))).scalar_one_or_none()
        if not admin:
            db.add(User(email=admin_email, full_name="Super Admin", password_hash=hash_password(admin_pwd),
                        role="super_admin", organization_id=org.id))
        else:
            if not verify_password(admin_pwd, admin.password_hash):
                admin.password_hash = hash_password(admin_pwd)
            if not admin.organization_id:
                admin.organization_id = org.id

        # demo
        demo = (await db.execute(select(User).where(User.email == demo_email))).scalar_one_or_none()
        if not demo:
            db.add(User(email=demo_email, full_name="QA Demo", password_hash=hash_password(demo_pwd),
                        role="qa_manager", organization_id=org.id))
        else:
            if not verify_password(demo_pwd, demo.password_hash):
                demo.password_hash = hash_password(demo_pwd)
            if not demo.organization_id:
                demo.organization_id = org.id

        await db.commit()
    logger.info("Seed: admin=%s, demo=%s", admin_email, demo_email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_admin_and_demo()
    yield


app = FastAPI(title="IntraTest Studio API", version="1.0.0", lifespan=lifespan)

# Routers under /api
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"service": "IntraTest Studio API", "version": "1.0.0", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(project_router)
api_router.include_router(test_design_router)
api_router.include_router(keywords_router)
api_router.include_router(components_router)
api_router.include_router(element_router)
api_router.include_router(execution_router)
api_router.include_router(api_testing_router)
api_router.include_router(reporting_router)
api_router.include_router(admin_router)
api_router.include_router(test_data_router)
app.include_router(api_router)

# Static screenshots
storage_dir = Path(__file__).parent / "storage"
storage_dir.mkdir(exist_ok=True)
(storage_dir / "screenshots").mkdir(exist_ok=True)
app.mount("/api/storage", StaticFiles(directory=str(storage_dir)), name="storage")

# CORS - allow credentials from any origin for dev (browsers reject "*" with credentials,
# so reflect the request origin instead).
origins_env = os.environ.get("CORS_ORIGINS", "*")
if origins_env.strip() == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins_env.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
