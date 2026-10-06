import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

APP_NAME = os.getenv("APP_NAME", "DocuBrix")
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")
APP_ENVIRONMENT = os.getenv("APP_ENVIRONMENT", "development")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/docubrix",
)
