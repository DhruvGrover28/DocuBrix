from __future__ import annotations

import io
import json
import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.main import app, serialize_document
from backend.app.models.document import Document, DocumentChunk
from backend.app.models.user import User
from backend.app.services.knowledge import (
    build_gemini_prompt,
    cosine_similarity,
    generate_grounded_answer,
    get_embedding,
    is_embedding_configured,
    is_llm_configured,
    rank_chunks_by_relevance,
)

client = TestClient(app)


# ============================================================================
# Unit Tests for Math, Embeddings, and Prompt Formatting (No DB required)
# ============================================================================


def test_cosine_similarity_math() -> None:
    # Identical vectors
    v1 = [1.0, 2.0, 3.0]
    assert cosine_similarity(v1, v1) == 1.0

    # Orthogonal vectors
    v_orth1 = [1.0, 0.0]
    v_orth2 = [0.0, 1.0]
    assert cosine_similarity(v_orth1, v_orth2) == 0.0

    # Opposite vectors
    v_opp = [-1.0, -2.0, -3.0]
    assert cosine_similarity(v1, v_opp) == -1.0

    # Edge cases: None, empty, length mismatch, zero magnitude
    assert cosine_similarity(None, [1.0]) == 0.0
    assert cosine_similarity([1.0], None) == 0.0
    assert cosine_similarity([], []) == 0.0
    assert cosine_similarity([1.0], [1.0, 2.0]) == 0.0
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_build_gemini_prompt_includes_citations() -> None:
    sources = [
        {"filename": "contract.pdf", "chunk_index": 0, "content": "Agreement date is 2026-05-01."},
        {"filename": "contract.pdf", "chunk_index": 1, "content": "Total payment amount is $100,000."},
    ]
    prompt = build_gemini_prompt("What is the payment amount?", sources)
    assert "What is the payment amount?" in prompt
    assert "[Source 1: contract.pdf chunk 0]" in prompt
    assert "[Source 2: contract.pdf chunk 1]" in prompt
    assert "Agreement date is 2026-05-01." in prompt
    assert "Total payment amount is $100,000." in prompt


def test_generate_grounded_answer_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
        generate_grounded_answer("test question", [{"filename": "f.txt", "chunk_index": 0, "content": "c"}])


def test_generate_grounded_answer_empty_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    answer = generate_grounded_answer("test question", [])
    assert "does not contain enough information" in answer


def test_generate_grounded_answer_with_mock_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    mock_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "The total payment is $100,000 based on contract chunk 1."}]
                }
            }
        ]
    }
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        answer = generate_grounded_answer(
            "What is the payment amount?",
            [{"filename": "contract.pdf", "chunk_index": 1, "content": "Payment is $100,000."}],
        )
        assert answer == "The total payment is $100,000 based on contract chunk 1."


def test_get_embedding_default_and_custom_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-emb-key")
    monkeypatch.delenv("EMBEDDING_MODEL", raising=False)
    mock_payload = {"embedding": {"values": [0.123, 0.456, 0.789]}}
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        vec = get_embedding("Hello world")
        assert vec == [0.123, 0.456, 0.789]
        req = mock_urlopen.call_args[0][0]
        assert "models/gemini-embedding-2:embedContent" in req.full_url
        sent_data = json.loads(req.data.decode("utf-8"))
        assert sent_data["model"] == "models/gemini-embedding-2"
        assert sent_data["content"]["parts"][0]["text"] == "Hello world"

    # Test override with custom model
    monkeypatch.setenv("EMBEDDING_MODEL", "custom-embedding-model")
    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        get_embedding("Hello world")
        req = mock_urlopen.call_args[0][0]
        assert "models/custom-embedding-model:embedContent" in req.full_url


def test_generate_grounded_answer_model_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    mock_payload = {
        "candidates": [{"content": {"parts": [{"text": "Answer from default model."}]}}]
    }
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    sources = [{"filename": "doc.pdf", "chunk_index": 0, "content": "Sample content"}]
    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        ans = generate_grounded_answer("Question?", sources)
        assert ans == "Answer from default model."
        req = mock_urlopen.call_args[0][0]
        assert "models/gemini-2.5-flash:generateContent" in req.full_url

    # Test override with gemini-2.5-flash-lite
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        generate_grounded_answer("Question?", sources)
        req = mock_urlopen.call_args[0][0]
        assert "models/gemini-2.5-flash-lite:generateContent" in req.full_url


def test_search_status_model_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.main import search_status
    dummy_user = User(id="user-1", name="Test", email="t@example.com", role="user")

    # When unconfigured
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)
    status_unconfigured = search_status(user=dummy_user)
    assert status_unconfigured["semantic_search"]["available"] is False
    assert status_unconfigured["semantic_search"]["provider"] is None
    assert status_unconfigured["llm_qa"]["available"] is False
    assert status_unconfigured["llm_qa"]["model"] is None

    # When configured with defaults
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("EMBEDDING_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    status_configured = search_status(user=dummy_user)
    assert status_configured["semantic_search"]["available"] is True
    assert status_configured["semantic_search"]["provider"] == "google-gemini (gemini-embedding-2)"
    assert status_configured["llm_qa"]["available"] is True
    assert status_configured["llm_qa"]["model"] == "gemini-2.5-flash"


def test_rank_chunks_by_relevance_keyword_fallback() -> None:
    # Minimal chunk mock objects
    class MockChunk:
        def __init__(self, content: str, chunk_index: int, embedding: Any = None):
            self.id = str(uuid.uuid4())
            self.document_id = "doc-1"
            self.content = content
            self.chunk_index = chunk_index
            self.embedding = embedding

    chunks = [
        MockChunk("Irrelevant terms and conditions.", 0),
        MockChunk("Total Amount Due: $5,400.00 by Acme Labs.", 1),
        MockChunk("Office supplies and stationery list.", 2),
    ]

    # Keyword search for "Amount Due"
    ranked = rank_chunks_by_relevance("Amount Due Acme", chunks, filename="invoice.pdf", top_k=2)
    assert len(ranked) == 2
    assert ranked[0]["chunk_index"] == 1
    assert ranked[0]["retrieval_method"] == "keyword"
    assert "Total Amount Due" in ranked[0]["content"]


def test_rank_chunks_by_relevance_semantic(monkeypatch: pytest.MonkeyPatch) -> None:
    class MockChunk:
        def __init__(self, content: str, chunk_index: int, embedding: list[float]):
            self.id = str(uuid.uuid4())
            self.document_id = "doc-1"
            self.content = content
            self.chunk_index = chunk_index
            self.embedding = embedding

    # Chunk 0 has vector close to query, Chunk 1 is orthogonal
    chunk_0 = MockChunk("Semantically matched content.", 0, [0.9, 0.1, 0.0])
    chunk_1 = MockChunk("Distant topic.", 1, [0.0, 0.0, 0.9])
    chunks = [chunk_1, chunk_0]

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    # Mock query embedding to match chunk 0
    with patch("backend.app.services.knowledge.get_embedding", return_value=[0.95, 0.05, 0.0]):
        ranked = rank_chunks_by_relevance("What is the match?", chunks, filename="doc.pdf", top_k=2)
        assert len(ranked) == 2
        assert ranked[0]["chunk_index"] == 0
        assert ranked[0]["retrieval_method"] == "semantic"
        assert ranked[0]["relevance_score"] > ranked[1]["relevance_score"]


# ============================================================================
# API Endpoint Authentication & Validation Tests (No DB required)
# ============================================================================


def test_ask_endpoint_unauthenticated() -> None:
    resp = client.post("/documents/test-doc/ask", json={"question": "What is total?"})
    assert resp.status_code == 401


def test_ask_endpoint_empty_question() -> None:
    # With dummy user header to bypass auth in a mock or test
    # If unauthenticated, it returns 401 first
    resp = client.post("/documents/test-doc/ask", json={"question": "   "})
    assert resp.status_code == 401


# ============================================================================
# Multi-User Ownership & Isolation Tests for Q&A and Search (In-Memory SQLite)
# ============================================================================


def test_q_and_a_isolation_in_sqlite(monkeypatch: pytest.MonkeyPatch) -> None:
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    with TestSession() as session:
        # Create Doc A for User A
        doc_a = Document(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            filename="user_a_confidential.pdf",
            status="processed",
            file_type="pdf",
            document_type="invoice",
            raw_text="Confidential Project Apex budget: $1,200,000.",
        )
        session.add(doc_a)
        session.flush()

        chunk_a = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            document_id=doc_a.id,
            chunk_index=0,
            content="Project Apex budget: $1,200,000 approved by executive board.",
            embedding=[0.8, 0.2, 0.0],
        )
        session.add(chunk_a)

        # Create Doc B for User B
        doc_b = Document(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            filename="user_b_grocery.pdf",
            status="processed",
            file_type="pdf",
            document_type="receipt",
            raw_text="Grocery receipt: $45.00 for fruits and vegetables.",
        )
        session.add(doc_b)
        session.flush()

        chunk_b = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            document_id=doc_b.id,
            chunk_index=0,
            content="Grocery receipt: $45.00 for apples, oranges, bread.",
            embedding=[0.0, 0.1, 0.9],
        )
        session.add(chunk_b)
        session.commit()

        # 1. User B query for Doc A must be rejected by ownership filter
        from backend.app.main import document_query
        user_b = User(id=user_b_id, name="User B", email="b@example.com", role="user")
        user_a = User(id=user_a_id, name="User A", email="a@example.com", role="user")

        assert document_query(session, user_b).filter(Document.id == doc_a.id).first() is None
        assert document_query(session, user_a).filter(Document.id == doc_a.id).first() is not None

        # 2. Semantic query by User B must NEVER search or match Chunk A
        query_emb_apex = [0.85, 0.15, 0.0]  # Closely matches Chunk A
        user_b_chunks = (
            session.query(DocumentChunk)
            .filter(DocumentChunk.owner_id == user_b.id, DocumentChunk.embedding.isnot(None))
            .all()
        )
        assert len(user_b_chunks) == 1
        assert user_b_chunks[0].document_id == doc_b.id
        # Chunks for User A are completely absent from User B's candidates
        assert all(c.owner_id == user_b.id for c in user_b_chunks)


# ============================================================================
# End-to-End Database Q&A and Semantic Search Tests (Opt-in via db_required)
# ============================================================================


def register_user(email: str, name: str, password: str = "correct-password") -> dict:
    resp = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_e2e_ask_document_ownership_and_mocked_llm(db_required, monkeypatch: pytest.MonkeyPatch) -> None:
    suffix = uuid.uuid4().hex[:8]
    user_a = register_user(f"qa_a_{suffix}@example.com", "QA User A")
    user_b = register_user(f"qa_b_{suffix}@example.com", "QA User B")
    headers_a = {"Authorization": f"Bearer {user_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['access_token']}"}

    # User A uploads an invoice
    doc_content = (
        "INVOICE 7701\n"
        "Vendor: Apex Satellite Tech\n"
        "Date: 2026-10-05\n"
        "Total Due: $34,500.00\n"
        "Services: Ground station telemetry calibration and antenna maintenance.\n"
    )
    upload_resp = client.post(
        "/documents/upload",
        files={"file": ("apex_invoice.txt", doc_content.encode("utf-8"), "text/plain")},
        headers=headers_a,
    )
    assert upload_resp.status_code == 200, upload_resp.text
    doc_a_id = upload_resp.json()["document_id"]

    # 1. User B attempts to ask on User A's document: 404 Not Found (ownership isolation)
    qa_b_on_a = client.post(
        f"/documents/{doc_a_id}/ask",
        json={"question": "What is the total due?"},
        headers=headers_b,
    )
    assert qa_b_on_a.status_code == 404

    # 2. User A asks without GEMINI_API_KEY: returns 503 Service Unavailable
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    qa_a_unconfigured = client.post(
        f"/documents/{doc_a_id}/ask",
        json={"question": "What is the total due?"},
        headers=headers_a,
    )
    assert qa_a_unconfigured.status_code == 503
    assert "GEMINI_API_KEY is not configured" in qa_a_unconfigured.json()["detail"]

    # 3. User A asks with mocked Gemini API response: returns 200 with answer + sources
    monkeypatch.setenv("GEMINI_API_KEY", "test-valid-key")
    mock_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "The total due is $34,500.00 for Apex Satellite Tech telemetry services."}]
                }
            }
        ]
    }
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        qa_a_success = client.post(
            f"/documents/{doc_a_id}/ask",
            json={"question": "What is the total amount due and vendor?"},
            headers=headers_a,
        )
        assert qa_a_success.status_code == 200, qa_a_success.text
        body = qa_a_success.json()
        assert "The total due is $34,500.00" in body["answer"]
        assert len(body["sources"]) >= 1
        assert body["sources"][0]["document_id"] == doc_a_id
        assert "Apex Satellite Tech" in body["sources"][0]["content"]

