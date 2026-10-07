from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from backend.app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="uploaded", nullable=False)
    file_type = Column(String, nullable=False)
    document_type = Column(String, default="other_financial_document", nullable=False)
    classification_method = Column(String, default="heuristic_fallback", nullable=False)
    classification_model = Column(String, nullable=True)
    classification_confidence = Column(JSON, nullable=True)
    classified_at = Column(DateTime, nullable=True)
    raw_text = Column(Text, nullable=True)
    extracted_json = Column(JSON, nullable=True)
    confidence_scores = Column(JSON, nullable=True)
    review_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    chunks = relationship("DocumentChunk", backref="document", cascade="all, delete-orphan", passive_deletes=True)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
