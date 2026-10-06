import importlib
import os

import backend.app.config as config


def test_normalize_database_url_handles_render_postgres_urls() -> None:
    assert config.normalize_database_url("postgres://user:pass@host:5432/docubrix") == (
        "postgresql+psycopg://user:pass@host:5432/docubrix"
    )
    assert config.normalize_database_url("postgresql://user:pass@host:5432/docubrix") == (
        "postgresql+psycopg://user:pass@host:5432/docubrix"
    )


def test_config_normalizes_database_url_for_sqlalchemy(monkeypatch) -> None:
    original_url = os.getenv("DATABASE_URL")
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@render-host:5432/docubrix")
    importlib.reload(config)

    try:
        assert config.DATABASE_URL == "postgresql+psycopg://user:pass@render-host:5432/docubrix"
    finally:
        if original_url is None:
            monkeypatch.delenv("DATABASE_URL", raising=False)
        else:
            monkeypatch.setenv("DATABASE_URL", original_url)
        importlib.reload(config)
