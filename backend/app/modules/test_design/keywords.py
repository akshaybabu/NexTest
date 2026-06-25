"""No-code keyword library and seed data."""
from fastapi import APIRouter

router = APIRouter(tags=["keywords"])

KEYWORDS = [
    # Browser
    {"category": "Browser", "keyword": "navigate", "label": "Navigate to URL", "params": ["url"], "description": "Open a URL in the browser"},
    {"category": "Browser", "keyword": "screenshot", "label": "Take screenshot", "params": [], "description": "Capture a screenshot"},
    # Input
    {"category": "Input", "keyword": "type", "label": "Enter text", "params": ["target", "value"], "description": "Type text into an input"},
    {"category": "Input", "keyword": "press", "label": "Press key", "params": ["value"], "description": "Press a keyboard key (Enter, Tab, etc.)"},
    # Click
    {"category": "Click", "keyword": "click", "label": "Click element", "params": ["target"], "description": "Click on an element"},
    # Selection
    {"category": "Selection", "keyword": "select", "label": "Select dropdown", "params": ["target", "value"], "description": "Select option in dropdown"},
    {"category": "Selection", "keyword": "check", "label": "Check checkbox", "params": ["target"], "description": "Tick a checkbox"},
    # Wait
    {"category": "Wait", "keyword": "wait", "label": "Wait (seconds)", "params": ["value"], "description": "Pause for N seconds"},
    {"category": "Wait", "keyword": "wait_for_element", "label": "Wait for element", "params": ["target"], "description": "Wait until element appears"},
    # Verify
    {"category": "Verify", "keyword": "verify_text", "label": "Verify text", "params": ["target", "value"], "description": "Assert element contains text"},
    {"category": "Verify", "keyword": "verify_url", "label": "Verify URL", "params": ["value"], "description": "Assert current URL contains"},
    {"category": "Verify", "keyword": "verify_title", "label": "Verify title", "params": ["value"], "description": "Assert page title contains"},
    {"category": "Verify", "keyword": "verify_visible", "label": "Verify visible", "params": ["target"], "description": "Assert element is visible"},
    # API
    {"category": "API", "keyword": "api_request", "label": "API request", "params": ["target", "value", "config"], "description": "Execute API request (configurable: method, URL, headers, body, assertions)"},
    # Components
    {"category": "Components", "keyword": "use_component", "label": "Use reusable component", "params": ["target"], "description": "Insert and execute a reusable component"},
    # Database
    {"category": "Database", "keyword": "db_query", "label": "DB query", "params": ["target", "value"], "description": "Run SQL query (configure DB)"},
    # Visual
    {"category": "Visual", "keyword": "visual_compare", "label": "Visual compare", "params": ["target"], "description": "Compare against baseline image"},
]


@router.get("/keywords")
async def list_keywords():
    return KEYWORDS


SAMPLE_WEB_STEPS = [
    {"keyword": "navigate", "target": "", "value": "https://example.com", "description": "Open example.com"},
    {"keyword": "verify_title", "target": "", "value": "Example", "description": "Verify page title contains 'Example'"},
    {"keyword": "verify_visible", "target": "h1", "value": "", "description": "Verify H1 heading is visible"},
    {"keyword": "verify_text", "target": "h1", "value": "Example Domain", "description": "Verify H1 reads 'Example Domain'"},
    {"keyword": "screenshot", "target": "", "value": "", "description": "Capture screenshot"},
]

SAMPLE_API_STEPS = [
    {"keyword": "api_request", "target": "GET", "value": "https://jsonplaceholder.typicode.com/posts/1", "description": "Fetch sample post"},
]
