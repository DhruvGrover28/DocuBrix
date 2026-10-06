from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import APP_ENVIRONMENT, APP_NAME, APP_VERSION
from backend.app.db.database import check_database_connection

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="DocuBrix Phase 0 foundation service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    db_state = check_database_connection()
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": APP_VERSION,
        "environment": APP_ENVIRONMENT,
        "database": db_state,
    }
