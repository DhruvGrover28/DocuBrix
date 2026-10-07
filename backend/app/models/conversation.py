from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from backend.app.db.database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New Conversation")
    document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    messages = relationship(
        "ChatMessage",
        backref="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
        passive_deletes=True,
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(
        String,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(32), nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)  # List of source citation dicts
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

