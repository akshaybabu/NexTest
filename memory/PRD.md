# IntraTest Studio - Product Requirements Document

## Overview
Enterprise intranet no-code/low-code test automation platform competing with ACCELQ, TestRigor, Katalon, Applitools. Built as a **modular monolith** (FastAPI + PostgreSQL) with clear microservice module boundaries — environment forced FastAPI (supervisor read-only), so we shipped a NestJS-equivalent architecture in Python instead.

## Architecture
- **Backend:** FastAPI (Python 3.11) + SQLAlchemy async + PostgreSQL 15. Modular monolith under `/app/backend/app/modules/` — each module is a microservice boundary:
  - `auth/` — Login, JWT (access+refresh, httpOnly cookies), RBAC, audit logs.
  - `project/` — Projects, Environments, Test Cases, Test Suites, Executions, ExecutionSteps, Elements, Integrations (DB models).
  - `test_design/` — Test Case + Suite CRUD; keyword library (16 keywords across 9 categories).
  - `execution/` — Orchestrator with FastAPI background tasks; runs single test case or suite.
  - `web_runner/` — **Real Playwright Chromium** execution with self-healing (alternate locators) + screenshots on failure.
  - `api_testing/` — **Real httpx** HTTP request execution with status/JSONPath/header/body assertions.
  - `element/` — Locator repository with confidence scoring + heal_count tracking.
  - `reporting/` — Summary, trend (daily), flaky tests, recent executions.
  - `admin/` — User management, audit logs, org management, RBAC by role level.
- **Frontend:** React 19 + Tailwind + Radix UI components, dark theme (Outfit / Satoshi / JetBrains Mono fonts). React Router. axios with `withCredentials`.
- **DB:** PostgreSQL @ 127.0.0.1:5432, schema auto-created via SQLAlchemy `Base.metadata.create_all` on lifespan startup.

## User Personas
- **Super Admin** (level 100) — Full platform access, license/system management.
- **Org Admin** (80) — Manage org users, projects, integrations.
- **Project Admin** (60), **QA Manager** (50), **Automation Engineer** (40), **Developer** (30), **Manual Tester** (20), **Viewer** (10).

## Core Requirements (Static)
- No-code first, low-code when needed.
- Self-healing automation foundation (alternate locators tried on failure).
- Complete SDLC testing: Web (real), API (real), DB (schema-ready), Visual (schema-ready), Mobile (schema-ready).
- Enterprise-grade: JWT auth, RBAC, audit logs, encrypted password hashes, tenant (org) isolation.

## v1 Implemented (2026-01)
✅ JWT auth (httpOnly cookies + Bearer fallback) + refresh tokens + 8-role RBAC.
✅ Idempotent seeding (admin@intratest.io / Admin@12345 + qa@intratest.io / Qa@12345).
✅ Organizations, Projects (auto-seeds 4 envs: QA/UAT/Stage/Prod), Environments.
✅ No-code Test Builder with 16 keywords across 9 categories (Browser, Input, Click, Selection, Wait, Verify, API, Database, Visual).
✅ Test Case CRUD with version increment, Test Suite CRUD with multi-TC selection.
✅ Element / Locator repository with confidence + alternate locators.
✅ **Real Playwright Chromium** execution (background tasks) — observed 5/5 PASSED on seeded example.com test in ~4s.
✅ **Real HTTP API testing** with status_code / response_time / json_path / header / body_contains assertions.
✅ Execution orchestrator: queued → running → passed/failed status, step-level results with screenshots.
✅ Reports: summary, 14-day trend (line chart), daily volume (bar), flaky tests, recent executions.
✅ Admin: user CRUD (role-gated), audit logs, system health, org management.
✅ Frontend: 11 pages — Login, Dashboard, Projects, Test Builder (drag-drop steps), Test Suites, Executions (with step detail), API Testing (full request builder), Reports, Test Data (placeholder), Elements, Integrations (placeholder), Admin (users + audit).
✅ Polished dark IDE-aesthetic UI; distinctive typography; non-AI-slop visuals.
✅ Sample seed: DEMO project, 3 test cases, 1 suite, 2 elements.
✅ 28/28 backend pytest pass; frontend e2e flows pass.

## P1 — Prioritized Backlog
1. **Persist alternate locators per step** in Test Builder UI (currently only on Element repository).
2. **Test Data Management UI** — backend models exist; wire JSON/CSV/env vars UI.
3. **Visual testing module** — baseline image capture + pixel-diff workflow.
4. **DB Testing UI** — connection mgr + query runner (backend schema-ready via `db_connections`/`db_queries` extension).
5. **Mobile runner** (Appium integration).
6. **CSV/Excel/PDF export** of reports.
7. **CI/CD integrations** — Jenkins webhook + REST trigger + execution tokens.
8. **Jira defect creation** from failed step.
9. **Real-time execution updates** via WebSocket / Server-Sent Events.
10. **Schedule executions** (cron-style).

## P2 — Backlog
- AI Test Authoring Assistant (Claude/GPT) — user deferred for v1.
- False positive analyzer + Test enhancer.
- SSO/LDAP, password reset email flow, MFA.
- Distributed execution nodes (queue + worker pool).
- Multi-tenancy hardening: row-level security on every query.
- Swagger/OpenAPI doc theme + versioning.

## Tech Decisions / Trade-offs
- Forced **Python FastAPI** over NestJS (supervisor lockdown). Same modular architecture intent, ready to extract per-module microservices later.
- Background tasks via `BackgroundTasks` (no Redis/RabbitMQ yet) — sufficient for single-node MVP. Queue can later move to Redis + RQ / Celery for distributed.
- Cookies are httpOnly + Bearer header fallback (works for both browser UI and CLI / curl).

## Next Tasks
- Wire Test Data Management UI.
- Add CSV/PDF export to Reports.
- Wire Visual Baseline workflow (back-end model + screenshot diff UI).
- Add Jenkins + Slack notification connectors.
