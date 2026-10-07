from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, String

from backend.app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    name = Column(String(160), nullable=False)
    email = Column(String(320), unique=True, index=True, nullable=False)
    password_hash = Column(String(512), nullable=False)
    role = Column(String(32), nullable=False, default="user")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)