from __future__ import annotations

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.config import DATABASE_URL

Base = declarative_base()

engine: Engine | None = create_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) if engine else None


def check_database_connection() -> dict:
    if not DATABASE_URL:
        return {
            "status": "not_configured",
            "url": "not_configured",
            "error": "DATABASE_URL is not set. Configure the environment before deploying or running the service.",
        }

    try:
        assert engine is not None
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "status": "connected",
            "url": DATABASE_URL.split("@")[-1].split("/")[0] if "@" in DATABASE_URL else "local",
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": "Database server is not currently reachable.",
            "details": str(exc),
        }


def ensure_schema() -> None:
    if engine is None:
        return

    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    document_columns = {column["name"] for column in inspector.get_columns("documents")}
    if "owner_id" not in document_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE documents ADD COLUMN owner_id VARCHAR"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_owner_id ON documents (owner_id)"))
