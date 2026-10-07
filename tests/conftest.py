from __future__ import annotations

import os

import pytest


# Database integration tests are opt-in and must never point at an unisolated
# production database by accident.
test_database_url = os.getenv("DOCUBRIX_TEST_DATABASE_URL")
if test_database_url:
    os.environ["DATABASE_URL"] = test_database_url
    os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")


@pytest.fixture
def db_required():
    if not test_database_url:
        pytest.skip("Set DOCUBRIX_TEST_DATABASE_URL to a disposable PostgreSQL database to run integration tests.")

    from backend.app.db.database import check_database_connection, ensure_schema

    state = check_database_connection()
    if state["status"] != "connected":
        pytest.skip("The configured DOCUBRIX_TEST_DATABASE_URL is not reachable.")

    ensure_schema()
    try:
        yield
    finally:
        from backend.app.db.database import SessionLocal
        from backend.app.models.document import Document
        from backend.app.models.user import User

        if SessionLocal is not None:
            with SessionLocal() as session:
                session.query(Document).delete(synchronize_session=False)
                session.query(User).delete(synchronize_session=False)
                session.commit()
