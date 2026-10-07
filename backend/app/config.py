import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def normalize_database_url(raw_url: str | None) -> str | None:
    if raw_url is None:
        return None

    normalized = raw_url.strip()
    if not normalized:
        return None

    if normalized.startswith("postgresql+psycopg://") or normalized.startswith("postgresql+psycopg2://"):
        return normalized

    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql+psycopg://", 1)

    if normalized.startswith("postgresql://"):
        return normalized.replace("postgresql://", "postgresql+psycopg://", 1)

    return normalized


APP_NAME = os.getenv("APP_NAME", "DocuBrix")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_ENVIRONMENT = os.getenv("APP_ENVIRONMENT", "development")
DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL"))
AUTH_SECRET = os.getenv("AUTH_SECRET", "docubrix-development-auth-secret-change-me")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
