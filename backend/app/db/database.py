from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.config import DATABASE_URL

Base = declarative_base()

engine: Engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def check_database_connection() -> dict:
    try:
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
