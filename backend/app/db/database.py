from __future__ import annotations

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.config import DATABASE_URL

Base = declarative_base()

engine: Engine | None = (
    create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5} if DATABASE_URL.startswith("postgresql") else {},
    )
    if DATABASE_URL
    else None
)
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
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    document_columns = {column["name"] for column in inspector.get_columns("documents")}
    with engine.begin() as connection:
        if "session_version" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0"))
        if "owner_id" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN owner_id VARCHAR"))
        if "classification_method" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN classification_method VARCHAR NOT NULL DEFAULT 'heuristic_fallback'"))
        if "classification_model" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN classification_model VARCHAR"))
        if "classification_confidence" not in document_columns:
            json_type = "JSONB" if engine.dialect.name == "postgresql" else "JSON"
            connection.execute(text(f"ALTER TABLE documents ADD COLUMN classification_confidence {json_type}"))
        if "classified_at" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN classified_at TIMESTAMP"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_owner_id ON documents (owner_id)"))

        if engine.dialect.name == "postgresql":
            foreign_keys = {foreign_key["name"] for foreign_key in inspect(connection).get_foreign_keys("documents")}
            if "fk_documents_owner_id" not in foreign_keys:
                connection.execute(
                    text(
                        "ALTER TABLE documents "
                        "ADD CONSTRAINT fk_documents_owner_id "
                        "FOREIGN KEY (owner_id) REFERENCES users (id) NOT VALID"
                    )
                )

        table_names = set(inspector.get_table_names())
        if "conversations" in table_names:
            conv_columns = {col["name"] for col in inspector.get_columns("conversations")}
            if "document_id" not in conv_columns:
                connection.execute(text("ALTER TABLE conversations ADD COLUMN document_id VARCHAR"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_conversations_owner_id ON conversations (owner_id)"))
        if "chat_messages" in table_names:
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_id ON chat_messages (conversation_id)"))
