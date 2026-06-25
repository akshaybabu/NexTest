"""IntraTest Studio - Comprehensive Backend API Tests (pytest)

Covers: auth, projects+envs, keywords, test-cases, test-suites, elements,
api-tests/run, executions (Playwright web), reports, admin/RBAC.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://qa-nexus-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@intratest.io"
ADMIN_PWD = "Admin@12345"
QA_EMAIL = "qa@intratest.io"
QA_PWD = "Qa@12345"


# ----------------- Fixtures -----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def qa_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": QA_EMAIL, "password": QA_PWD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"QA login failed: {r.status_code} {r.text}")
    body = r.json()
    token = body.get("access_token") or body.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ----------------- Auth tests -----------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_success_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Either user object or wrapping
        user = data.get("user") or data
        assert user.get("email") == ADMIN_EMAIL
        # Cookies expected
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names, f"access_token cookie missing, got: {cookie_names}"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG_xxx"}, timeout=20)
        assert r.status_code == 401, r.text

    def test_me_returns_user(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("email") == ADMIN_EMAIL

    def test_logout_clears(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=20)
        r = s.post(f"{API}/auth/logout", timeout=15)
        assert r.status_code in (200, 204), r.text


# ----------------- Projects -----------------
class TestProjects:
    project_id = None
    project_key = None

    def test_list_projects(self, admin_session):
        r = admin_session.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_create_project_seeds_envs(self, admin_session):
        key = f"TST{uuid.uuid4().hex[:6].upper()}"
        payload = {"name": f"TEST_Proj_{key}", "key": key, "description": "test", "tags": ["qa"]}
        r = admin_session.post(f"{API}/projects", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("key") == key
        TestProjects.project_id = data.get("id")
        TestProjects.project_key = key

        # Verify 4 envs auto-created
        r2 = admin_session.get(f"{API}/projects/{TestProjects.project_id}/environments", timeout=15)
        assert r2.status_code == 200, r2.text
        envs = r2.json()
        names = sorted([e.get("name") for e in envs])
        assert len(envs) == 4, f"expected 4 envs, got {envs}"
        assert names == sorted(["QA", "UAT", "Stage", "Prod"]), f"got {names}"

    def test_patch_project(self, admin_session):
        assert TestProjects.project_id
        r = admin_session.patch(f"{API}/projects/{TestProjects.project_id}",
                                json={"description": "updated"}, timeout=15)
        assert r.status_code in (200, 204), r.text
        # GET back
        r2 = admin_session.get(f"{API}/projects/{TestProjects.project_id}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("description") == "updated"

    def test_delete_project(self, admin_session):
        assert TestProjects.project_id
        r = admin_session.delete(f"{API}/projects/{TestProjects.project_id}", timeout=15)
        assert r.status_code in (200, 204), r.text


# ----------------- Keywords -----------------
def test_keywords_listing(admin_session):
    r = admin_session.get(f"{API}/keywords", timeout=15)
    assert r.status_code == 200, r.text
    kws = r.json()
    assert isinstance(kws, list)
    assert len(kws) >= 16, f"expected >=16 keywords, got {len(kws)}"
    categories = {k.get("category") for k in kws}
    for cat in ["Browser", "Input", "Click", "Selection", "Wait", "Verify", "API", "Database", "Visual"]:
        assert cat in categories, f"missing category {cat} in {categories}"


# ----------------- Demo project lookup helper -----------------
@pytest.fixture(scope="session")
def demo_project(admin_session):
    r = admin_session.get(f"{API}/projects", timeout=15)
    assert r.status_code == 200
    for p in r.json():
        if p.get("key") == "DEMO":
            return p
    pytest.skip("DEMO project not seeded")


# ----------------- Test cases -----------------
class TestTestCases:
    tc_id = None

    def test_create_test_case(self, admin_session, demo_project):
        payload = {
            "project_id": demo_project["id"],
            "name": f"TEST_TC_{uuid.uuid4().hex[:6]}",
            "description": "auto",
            "type": "web",
            "steps": [{"keyword": "navigate", "params": {"url": "https://example.com"}}],
        }
        r = admin_session.post(f"{API}/test-cases", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("name") == payload["name"]
        TestTestCases.tc_id = data["id"]

    def test_list_filter_by_project(self, admin_session, demo_project):
        r = admin_session.get(f"{API}/test-cases", params={"project_id": demo_project["id"]}, timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert any(t.get("id") == TestTestCases.tc_id for t in items)

    def test_patch_increments_version(self, admin_session):
        # Get current version
        r0 = admin_session.get(f"{API}/test-cases/{TestTestCases.tc_id}", timeout=15)
        assert r0.status_code == 200
        v0 = r0.json().get("version", 1)
        r = admin_session.patch(f"{API}/test-cases/{TestTestCases.tc_id}",
                                json={"description": "edited"}, timeout=15)
        assert r.status_code in (200, 204), r.text
        r2 = admin_session.get(f"{API}/test-cases/{TestTestCases.tc_id}", timeout=15)
        v1 = r2.json().get("version", 1)
        assert v1 > v0, f"version did not increment {v0}->{v1}"

    def test_delete_tc(self, admin_session):
        r = admin_session.delete(f"{API}/test-cases/{TestTestCases.tc_id}", timeout=15)
        assert r.status_code in (200, 204), r.text


# ----------------- Test suites -----------------
class TestTestSuites:
    suite_id = None

    def test_create_suite(self, admin_session, demo_project):
        # find an existing tc id in demo
        r = admin_session.get(f"{API}/test-cases", params={"project_id": demo_project["id"]}, timeout=15)
        tcs = r.json()
        tc_ids = [t["id"] for t in tcs[:1]] if tcs else []
        payload = {
            "project_id": demo_project["id"],
            "name": f"TEST_Suite_{uuid.uuid4().hex[:5]}",
            "description": "x",
            "test_case_ids": tc_ids,
        }
        r = admin_session.post(f"{API}/test-suites", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        TestTestSuites.suite_id = r.json()["id"]

    def test_list_suite(self, admin_session, demo_project):
        r = admin_session.get(f"{API}/test-suites", params={"project_id": demo_project["id"]}, timeout=15)
        assert r.status_code == 200

    def test_delete_suite(self, admin_session):
        r = admin_session.delete(f"{API}/test-suites/{TestTestSuites.suite_id}", timeout=15)
        assert r.status_code in (200, 204)


# ----------------- Elements -----------------
def test_create_and_list_elements(admin_session, demo_project):
    payload = {
        "project_id": demo_project["id"],
        "name": f"TEST_El_{uuid.uuid4().hex[:5]}",
        "page": "TestPage",
        "primary_locator": "#submit",
        "locator_type": "css",
        "alternate_locators": [{"locator": "//button", "type": "xpath"}],
    }
    r = admin_session.post(f"{API}/elements", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    el_id = r.json()["id"]

    r2 = admin_session.get(f"{API}/elements", params={"project_id": demo_project["id"]}, timeout=15)
    assert r2.status_code == 200
    assert any(e["id"] == el_id for e in r2.json())

    admin_session.delete(f"{API}/elements/{el_id}", timeout=15)


# ----------------- API Testing real HTTP -----------------
def test_api_test_run_real_http(admin_session):
    payload = {
        "method": "GET",
        "url": "https://jsonplaceholder.typicode.com/posts/1",
        "headers": {},
        "assertions": [
            {"type": "status_code", "operator": "equals", "expected": 200},
            {"type": "json_path", "operator": "equals", "path": "$.id", "expected": 1},
        ],
    }
    r = admin_session.post(f"{API}/api-tests/run", json=payload, timeout=45)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("overall_passed") is True, data
    assert data.get("status_code") == 200
    asserts = data.get("assertions") or data.get("assertion_results") or []
    assert len(asserts) == 2
    for a in asserts:
        assert a.get("passed") is True, a


# ----------------- Reports -----------------
class TestReports:
    def test_summary(self, admin_session):
        r = admin_session.get(f"{API}/reports/summary", timeout=15)
        assert r.status_code == 200, r.text

    def test_trend(self, admin_session):
        r = admin_session.get(f"{API}/reports/trend", timeout=15)
        assert r.status_code == 200

    def test_flaky(self, admin_session):
        r = admin_session.get(f"{API}/reports/flaky", timeout=15)
        assert r.status_code == 200

    def test_recent(self, admin_session):
        r = admin_session.get(f"{API}/reports/recent", timeout=15)
        assert r.status_code == 200


# ----------------- Admin & RBAC -----------------
class TestAdmin:
    def test_admin_users(self, admin_session):
        r = admin_session.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_admin_audit_logs(self, admin_session):
        r = admin_session.get(f"{API}/admin/audit-logs", timeout=15)
        assert r.status_code == 200, r.text

    def test_admin_health(self, admin_session):
        r = admin_session.get(f"{API}/admin/health", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_users" in data
        assert "total_organizations" in data

    def test_qa_cannot_create_admin_user(self, qa_session):
        payload = {"email": f"TEST_x{uuid.uuid4().hex[:6]}@x.io", "password": "Aa@12345!", "full_name": "x", "role": "qa_engineer"}
        r = qa_session.post(f"{API}/admin/users", json=payload, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


# ----------------- Web execution via Playwright -----------------
def test_web_execution_real_playwright(admin_session, demo_project):
    # Find the specific seeded demo web TC by exact name to avoid race with other tests
    r = admin_session.get(f"{API}/test-cases", params={"project_id": demo_project["id"]}, timeout=15)
    assert r.status_code == 200
    tcs = r.json()
    web_tcs = [t for t in tcs if t.get("type") == "web" and t.get("name") == "Open example.com and verify"]
    assert web_tcs, f"seeded demo web TC missing; tcs={[t.get('name') for t in tcs]}"
    tc = web_tcs[0]

    # Find env
    re_envs = admin_session.get(f"{API}/projects/{demo_project['id']}/environments", timeout=15)
    env_id = re_envs.json()[0]["id"]

    r2 = admin_session.post(f"{API}/executions/run",
                            json={"test_case_id": tc["id"], "environment_id": env_id}, timeout=20)
    assert r2.status_code in (200, 201, 202), r2.text
    exe = r2.json()
    exe_id = exe.get("id") or exe.get("execution_id")
    assert exe_id, exe
    assert exe.get("status") in ("queued", "running", "pending"), exe

    # poll up to 90s
    final = None
    for _ in range(45):
        time.sleep(2)
        rp = admin_session.get(f"{API}/executions/{exe_id}", timeout=15)
        assert rp.status_code == 200
        body = rp.json()
        if body.get("status") in ("passed", "failed", "error", "completed"):
            final = body
            break
    assert final is not None, "execution did not complete in 90s"
    assert final.get("status") == "passed", f"final={final}"

    rs = admin_session.get(f"{API}/executions/{exe_id}/steps", timeout=15)
    assert rs.status_code == 200
    steps = rs.json()
    assert len(steps) >= 1
    passed_count = sum(1 for s in steps if s.get("status") == "passed")
    assert passed_count >= 1
    for s in steps:
        assert "keyword" in s
        assert "duration" in s or "duration_ms" in s
