"""Auth utility helpers."""
import re
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import AuditLog, User


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "org"


async def log_audit(
    db: AsyncSession,
    user: User | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    request: Request | None = None,
    metadata: dict | None = None,
):
    ip = None
    if request and request.client:
        ip = request.client.host
    entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=metadata,
        ip_address=ip,
    )
    db.add(entry)
