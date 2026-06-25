"""Pydantic schemas for auth module."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1, max_length=200)
    organization_name: str | None = None
    role: str | None = "qa_manager"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    role: str
    organization_id: str | None = None
    is_active: bool
    last_login: datetime | None = None
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_email: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    created_at: datetime
