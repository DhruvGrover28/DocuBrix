from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.main import app, serialize_conversation
from backend.app.models.conversation import ChatMessage, Conversation
from backend.app.models.document import Document, DocumentChunk
from backend.app.models.user import User
from backend.app.services.knowledge import (
    build_chat_prompt,
    generate_chat_answer,
    rank_chunks_by_relevance,
)

client = TestClient(app)


# ============================================================================
# Unit Tests for Chat Prompt Formatting, Multi-Turn Window & Helpers
# ============================================================================


def test_build_chat_prompt_structure() -> None:
    sources = [
        {"filename": "apex_invoice.pdf", "chunk_index": 0, "content": "Total amount due: $34,500.00"},
        {"filename": "nova_contract.pdf", "chunk_index": 1, "content": "Service renewal fee: $12,000.00"},
    ]
    chat_history = [
        {"role": "user", "content": "What is the total of my invoices?"},
        {"role": "assistant", "content": "Your total invoice amount is $34,500.00 [apex_invoice.pdf chunk 0]."},
    ]

    prompt = build_chat_prompt("When is it due?", sources, chat_history=chat_history)

    assert "DocuBrix AI Assistant" in prompt
    assert "[Source 1: apex_invoice.pdf chunk 0]" in prompt
    assert "Total amount due: $34,500.00" in prompt
    assert "[Source 2: nova_contract.pdf chunk 1]" in prompt
    assert "User: What is the total of my invoices?" in prompt
    assert "Assistant: Your total invoice amount is $34,500.00" in prompt
    assert "Current User Question: When is it due?" in prompt


def test_build_chat_prompt_empty_sources() -> None:
    prompt = build_chat_prompt("Who is the vendor?", [], chat_history=None)
    assert "No relevant document chunks found in user workspace." in prompt
    assert "Current User Question: Who is the vendor?" in prompt


def test_rank_chunks_by_relevance_with_filename_map() -> None:
    class MockChunk:
        def __init__(self, doc_id: str, content: str, chunk_index: int):
            self.document_id = doc_id
            self.content = content
            self.chunk_index = chunk_index
            self.embedding = None

    c1 = MockChunk("doc-1", "Invoice from Quantum Aerospace Corp.", 0)
    c2 = MockChunk("doc-2", "Contract with Stellar Orbitals LLC.", 0)
    c3 = MockChunk("doc-3", "Irrelevant office supplies receipt.", 0)

    filename_map = {
        "doc-1": "quantum_invoice.pdf",
        "doc-2": "stellar_contract.pdf",
        "doc-3": "supplies.pdf",
    }

    ranked = rank_chunks_by_relevance(
        "Quantum Aerospace Stellar Orbitals",
        [c1, c2, c3],
        filename_map=filename_map,
        top_k=2,
    )

    assert len(ranked) == 2
    filenames = [r["filename"] for r in ranked]
    assert "quantum_invoice.pdf" in filenames
    assert "stellar_contract.pdf" in filenames
    assert "supplies.pdf" not in filenames


def test_generate_chat_answer_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
        generate_chat_answer("Hello", [])


def test_generate_chat_answer_mocked(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-chat-key")
    mock_payload = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Based on apex_invoice.pdf, the total is $34,500.00."}]
                }
            }
        ]
    }
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        answer = generate_chat_answer(
            "What is the total?",
            [{"filename": "apex_invoice.pdf", "chunk_index": 0, "content": "Total: $34,500"}],
            chat_history=[{"role": "user", "content": "Hi"}],
        )
        assert answer == "Based on apex_invoice.pdf, the total is $34,500.00."


# ============================================================================
# In-Memory SQLite Tests: Multi-Turn Persistence, Owner Isolation & Cross-Doc RAG
# ============================================================================


def test_conversation_persistence_and_owner_isolation_in_sqlite() -> None:
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    with TestSession() as session:
        # Create User A conversation
        conv_a = Conversation(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            title="User A Private Financial Chat",
        )
        session.add(conv_a)
        session.commit()

        # Add messages to User A's conversation
        msg_1 = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv_a.id,
            role="user",
            content="What are my Q3 expenses?",
        )
        msg_2 = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv_a.id,
            role="assistant",
            content="Your Q3 expenses total $45,000 across 3 vendors.",
            sources=[{"filename": "q3_expenses.pdf", "chunk_index": 0, "relevance_score": 0.95}],
        )
        session.add_all([msg_1, msg_2])
        session.commit()

        # 1. User B query for User A's conversation must return None
        conv_for_b = (
            session.query(Conversation)
            .filter(Conversation.id == conv_a.id, Conversation.owner_id == user_b_id)
            .first()
        )
        assert conv_for_b is None

        # 2. User A can retrieve their conversation and messages
        conv_for_a = (
            session.query(Conversation)
            .filter(Conversation.id == conv_a.id, Conversation.owner_id == user_a_id)
            .first()
        )
        assert conv_for_a is not None
        assert len(conv_for_a.messages) == 2
        assert conv_for_a.messages[0].role == "user"
        assert conv_for_a.messages[1].role == "assistant"
        assert conv_for_a.messages[1].sources[0]["filename"] == "q3_expenses.pdf"

        # 3. Cascading message deletion
        session.delete(conv_a)
        session.commit()

        remaining_messages = (
            session.query(ChatMessage).filter(ChatMessage.conversation_id == conv_a.id).all()
        )
        assert len(remaining_messages) == 0


def test_cross_document_rag_owner_isolation_in_sqlite() -> None:
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)

    user_a_id = str(uuid.uuid4())
    user_b_id = str(uuid.uuid4())

    with TestSession() as session:
        # User A owns Doc 1 and Doc 2
        doc_a1 = Document(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            filename="apex_invoice.pdf",
            status="processed",
            file_type="pdf",
            document_type="invoice",
            raw_text="Apex invoice for $34,500 due 2026-10-15.",
        )
        doc_a2 = Document(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            filename="nova_contract.pdf",
            status="processed",
            file_type="pdf",
            document_type="contract",
            raw_text="Nova Systems agreement retainer fee $12,000.",
        )
        # User B owns Doc 3
        doc_b = Document(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            filename="b_confidential_receipt.pdf",
            status="processed",
            file_type="pdf",
            document_type="receipt",
            raw_text="Secret User B payment $999,999 to Project Vault.",
        )
        session.add_all([doc_a1, doc_a2, doc_b])
        session.flush()

        chunk_a1 = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            document_id=doc_a1.id,
            chunk_index=0,
            content="Apex invoice total due is $34,500 payable by October 15.",
        )
        chunk_a2 = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            document_id=doc_a2.id,
            chunk_index=0,
            content="Nova Systems software maintenance fee is $12,000.",
        )
        chunk_b = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            document_id=doc_b.id,
            chunk_index=0,
            content="Secret User B payment $999,999 to Project Vault.",
        )
        session.add_all([chunk_a1, chunk_a2, chunk_b])
        session.commit()

        # Query chunks for User A
        chunks_for_a = session.query(DocumentChunk).filter(DocumentChunk.owner_id == user_a_id).all()
        assert len(chunks_for_a) == 2
        # Verify User A's candidate chunks contain Doc A1 and Doc A2, but NEVER User B's chunk
        doc_ids_a = {c.document_id for c in chunks_for_a}
        assert doc_a1.id in doc_ids_a
        assert doc_a2.id in doc_ids_a
        assert doc_b.id not in doc_ids_a

        # Query chunks for User B
        chunks_for_b = session.query(DocumentChunk).filter(DocumentChunk.owner_id == user_b_id).all()
        assert len(chunks_for_b) == 1
        assert chunks_for_b[0].document_id == doc_b.id
        assert doc_a1.id != chunks_for_b[0].document_id
        assert doc_a2.id != chunks_for_b[0].document_id


# ============================================================================
# API Endpoint Authentication & Contract Tests (No DB required for 401)
# ============================================================================


def test_chat_endpoints_require_authentication() -> None:
    # Unauthenticated requests must strictly return HTTP 401
    assert client.post("/conversations", json={"title": "Test"}).status_code == 401
    assert client.get("/conversations").status_code == 401
    assert client.get("/conversations/conv-123").status_code == 401
    assert client.patch("/conversations/conv-123", json={"title": "New"}).status_code == 401
    assert client.delete("/conversations/conv-123").status_code == 401
    assert client.post("/conversations/conv-123/messages", json={"content": "Hi"}).status_code == 401


# ============================================================================
# End-to-End Database Chat Tests (Opt-in via db_required)
# ============================================================================


def register_user(email: str, name: str, password: str = "correct-password") -> dict:
    resp = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_e2e_conversations_crud_and_cross_document_chat(db_required, monkeypatch: pytest.MonkeyPatch) -> None:
    suffix = uuid.uuid4().hex[:8]
    user_a = register_user(f"chat_a_{suffix}@example.com", "Chat User A")
    user_b = register_user(f"chat_b_{suffix}@example.com", "Chat User B")
    headers_a = {"Authorization": f"Bearer {user_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['access_token']}"}

    # User A uploads Document 1 (Apex invoice)
    doc1_content = "INVOICE 7701\nVendor: Apex Telemetry\nTotal Due: $34,500.00\nPayment due by 2026-10-15."
    up1 = client.post("/documents/upload", files={"file": ("apex_invoice.txt", doc1_content.encode("utf-8"), "text/plain")}, headers=headers_a)
    assert up1.status_code == 200

    # User A uploads Document 2 (Nova contract)
    doc2_content = "SERVICE AGREEMENT\nVendor: Nova Aerospace\nMonthly Retainer: $12,000.00\nTerm: 12 months."
    up2 = client.post("/documents/upload", files={"file": ("nova_contract.txt", doc2_content.encode("utf-8"), "text/plain")}, headers=headers_a)
    assert up2.status_code == 200

    # 1. User A creates a conversation
    create_resp = client.post("/conversations", json={"title": "Financial Audit"}, headers=headers_a)
    assert create_resp.status_code == 200
    conv_a_id = create_resp.json()["id"]
    assert create_resp.json()["title"] == "Financial Audit"

    # 2. User B attempts to access User A's conversation: 404 Not Found
    get_b_on_a = client.get(f"/conversations/{conv_a_id}", headers=headers_b)
    assert get_b_on_a.status_code == 404

    # 3. User B attempts to send a message to User A's conversation: 404 Not Found
    msg_b_on_a = client.post(f"/conversations/{conv_a_id}/messages", json={"content": "Hacked"}, headers=headers_b)
    assert msg_b_on_a.status_code == 404

    # 4. User A sends message without GEMINI_API_KEY: 503 Service Unavailable
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    msg_unconfigured = client.post(f"/conversations/{conv_a_id}/messages", json={"content": "What is the total due?"}, headers=headers_a)
    assert msg_unconfigured.status_code == 503
    assert "GEMINI_API_KEY is not configured" in msg_unconfigured.json()["detail"]

    # 5. User A sends message with mocked Gemini response: Turn 1
    monkeypatch.setenv("GEMINI_API_KEY", "test-valid-key")
    mock_payload_1 = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Based on apex_invoice.txt, the total due is $34,500.00."}]
                }
            }
        ]
    }
    mock_response = MagicMock()
    mock_response.read.return_value = json.dumps(mock_payload_1).encode("utf-8")
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        turn1_resp = client.post(
            f"/conversations/{conv_a_id}/messages",
            json={"content": "What is the total due on Apex invoice?"},
            headers=headers_a,
        )
        assert turn1_resp.status_code == 200, turn1_resp.text
        turn1_body = turn1_resp.json()
        assert "34,500.00" in turn1_body["assistant_message"]["content"]
        assert len(turn1_body["sources"]) >= 1

    # 6. User A sends follow-up Turn 2: verify multi-turn context
    mock_payload_2 = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "It is due by 2026-10-15 according to apex_invoice.txt."}]
                }
            }
        ]
    }
    mock_response_2 = MagicMock()
    mock_response_2.read.return_value = json.dumps(mock_payload_2).encode("utf-8")
    mock_response_2.__enter__.return_value = mock_response_2

    with patch("urllib.request.urlopen", return_value=mock_response_2):
        turn2_resp = client.post(
            f"/conversations/{conv_a_id}/messages",
            json={"content": "When is it due?"},
            headers=headers_a,
        )
        assert turn2_resp.status_code == 200, turn2_resp.text
        turn2_body = turn2_resp.json()
        assert "2026-10-15" in turn2_body["assistant_message"]["content"]

    # 7. Verify conversation messages count
    get_conv_a = client.get(f"/conversations/{conv_a_id}", headers=headers_a)
    assert get_conv_a.status_code == 200
    assert len(get_conv_a.json()["messages"]) == 4  # 2 user + 2 assistant

    # 8. Rename conversation
    patch_resp = client.patch(f"/conversations/{conv_a_id}", json={"title": "Updated Audit Title"}, headers=headers_a)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["title"] == "Updated Audit Title"

    # 9. Delete conversation
    del_resp = client.delete(f"/conversations/{conv_a_id}", headers=headers_a)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # Verify conversation is gone
    assert client.get(f"/conversations/{conv_a_id}", headers=headers_a).status_code == 404


# ============================================================================
# Diagnostic Error Handling & Server-Side Logging Tests
# ============================================================================


def test_diagnostic_sanitizer() -> None:
    from backend.app.services.knowledge import _sanitize_diagnostic_text

    secret_key = "AIzaSyAbCdEf1234567890123456789012345"
    text_with_key = f"Error at https://example.com/api?key={secret_key}&foo=bar for key {secret_key}"
    sanitized = _sanitize_diagnostic_text(text_with_key, api_key=secret_key)

    assert secret_key not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized or "[REDACTED_KEY]" in sanitized


def test_diagnostic_logging_missing_api_key(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
        generate_chat_answer("What is this?", [])

    assert any("[missing_api_key]" in record.message for record in caplog.records)


def test_diagnostic_logging_http_error_redacts_api_key(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    import io
    import urllib.error

    secret_key = "AIzaSyRealSecretKey12345678901234567"
    monkeypatch.setenv("GEMINI_API_KEY", secret_key)
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")

    error_body = b'{"error": {"code": 404, "message": "models/gemini-2.5-flash is not found for API version v1beta"}}'
    http_error = urllib.error.HTTPError(
        url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        code=404,
        msg="Not Found",
        hdrs={},
        fp=io.BytesIO(error_body),
    )

    with patch("urllib.request.urlopen", side_effect=http_error):
        with pytest.raises(RuntimeError, match="The configured Gemini service could not answer the question"):
            generate_chat_answer("Test question", [])

    http_records = [r for r in caplog.records if "[http_error]" in r.message]
    assert len(http_records) >= 1
    record_text = http_records[0].message
    assert "404" in record_text
    assert "models/gemini-2.5-flash is not found" in record_text
    assert "gemini-2.5-flash" in record_text
    assert secret_key not in record_text


def test_diagnostic_logging_timeout_network_error(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
    with patch("urllib.request.urlopen", side_effect=TimeoutError("Request timed out")):
        with pytest.raises(RuntimeError, match="The configured Gemini service could not answer the question"):
            generate_chat_answer("Test question", [])

    timeout_records = [r for r in caplog.records if "[timeout_network_error]" in r.message]
    assert len(timeout_records) >= 1
    assert "timed out" in timeout_records[0].message


def test_diagnostic_logging_response_parsing_error(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-123")
    mock_response = MagicMock()
    mock_response.read.return_value = b"invalid-json-{"
    mock_response.__enter__.return_value = mock_response

    with patch("urllib.request.urlopen", return_value=mock_response):
        with pytest.raises(RuntimeError, match="The configured Gemini service could not answer the question"):
            generate_chat_answer("Test question", [])

    parse_records = [r for r in caplog.records if "[response_parsing_error]" in r.message]
    assert len(parse_records) >= 1
    assert "JSONDecodeError" in parse_records[0].message or "Failed to decode" in parse_records[0].message

