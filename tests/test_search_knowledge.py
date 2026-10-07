from __future__ import annotations

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.main import app, serialize_document
from backend.app.models.document import Document, DocumentChunk
from backend.app.models.user import User
from backend.app.services.knowledge import (
    chunk_text,
    extract_excerpts,
    extract_highlighted_snippet,
    extract_snippet,
    query_terms,
)

client = TestClient(app)


# ============================================================================
# Unit Tests for Knowledge & Excerpt Functions (No DB required)
# ============================================================================


def test_chunk_text_sliding_window() -> None:
    words = [f"word{i}" for i in range(1500)]
    text = " ".join(words)
    chunks = chunk_text(text, size=700, overlap=100)

    assert len(chunks) >= 2
    # Verify first chunk contains word0 and chunk has up to 700 words
    assert "word0" in chunks[0]
    assert len(chunks[0].split()) == 700

    # Overlap check: words around index 650 should appear in both chunks
    assert "word650" in chunks[0]
    assert "word650" in chunks[1]

    # Empty text check
    assert chunk_text("") == []
    assert chunk_text("   \n\t ") == []


def test_query_terms_tokenization() -> None:
    terms = query_terms("Acme Labs, Invoice #1001: Total $120.50!")
    assert "acme" in terms
    assert "labs" in terms
    assert "invoice" in terms
    assert "1001" in terms
    assert "120" in terms or "120.50" in terms or "$120" in terms

    # Test short terms and empty
    assert query_terms("") == []
    assert query_terms("a") == ["a"]
    assert query_terms("in") == ["in"]


def test_extract_snippet_and_highlighting() -> None:
    text = (
        "DocuBrix provides intelligent document processing and knowledge indexing. "
        "All data is strictly scoped by user owner ID."
    )
    terms = ["docubrix", "indexing"]
    snippet = extract_snippet(text, terms, max_len=120)
    assert "DocuBrix" in snippet
    assert "indexing" in snippet

    highlighted = extract_highlighted_snippet(text, terms, max_len=120)
    assert "<mark>DocuBrix</mark>" in highlighted
    assert "<mark>indexing</mark>" in highlighted

    # Test non-matching terms
    no_match = extract_snippet(text, ["nonexistent"], max_len=50)
    assert len(no_match) <= 55

    # Test empty text
    assert extract_snippet("", ["test"]) == ""
    assert extract_highlighted_snippet("", ["test"]) == ""


def test_extract_excerpts_multiple_lines() -> None:
    multiline_text = (
        "Header: Acme Annual Report 2026\n"
        "Revenue for consulting services was $50,000.\n"
        "Expenses included equipment purchase of $12,000.\n"
        "Net consulting profit reached $38,000."
    )
    excerpts = extract_excerpts(multiline_text, ["consulting"], max_excerpts=2)
    assert len(excerpts) == 2
    assert all("<mark>consulting</mark>" in exc.lower() for exc in excerpts)


# ============================================================================
# Unit Tests for Search Isolation & Query Scoping (In-Memory SQLite)
# ============================================================================


def test_multi_field_search_and_strict_owner_isolation_in_sqlite() -> None:
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)

    with TestSession() as session:
        user_a_id = str(uuid.uuid4())
        user_b_id = str(uuid.uuid4())

        # Seed User A document + chunks
        doc_a = Document(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            filename="user_a_tax_invoice.pdf",
            status="processed",
            file_type="pdf",
            document_type="invoice",
            raw_text="Invoice for Acme Quantum Computing audit. Total amount due $5,000.",
        )
        session.add(doc_a)
        session.flush()

        chunk_a1 = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            document_id=doc_a.id,
            chunk_index=0,
            content="Invoice for Acme Quantum Computing audit.",
        )
        chunk_a2 = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_a_id,
            document_id=doc_a.id,
            chunk_index=1,
            content="Total amount due $5,000 payable upon receipt.",
        )
        session.add_all([chunk_a1, chunk_a2])

        # Seed User B document + chunks
        doc_b = Document(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            filename="user_b_payroll_receipt.pdf",
            status="processed",
            file_type="pdf",
            document_type="receipt",
            raw_text="Receipt for Acme Coffee Shop lunch. Paid with cash.",
        )
        session.add(doc_b)
        session.flush()

        chunk_b1 = DocumentChunk(
            id=str(uuid.uuid4()),
            owner_id=user_b_id,
            document_id=doc_b.id,
            chunk_index=0,
            content="Receipt for Acme Coffee Shop lunch.",
        )
        session.add(chunk_b1)
        session.commit()

        # 1. User A searches for shared keyword "Acme": User A must ONLY see Doc A
        user_a_docs = (
            session.query(Document)
            .filter(Document.owner_id == user_a_id, Document.raw_text.ilike("%Acme%"))
            .all()
        )
        assert len(user_a_docs) == 1
        assert user_a_docs[0].id == doc_a.id
        assert user_a_docs[0].owner_id == user_a_id

        # 2. User B searches for shared keyword "Acme": User B must ONLY see Doc B
        user_b_docs = (
            session.query(Document)
            .filter(Document.owner_id == user_b_id, Document.raw_text.ilike("%Acme%"))
            .all()
        )
        assert len(user_b_docs) == 1
        assert user_b_docs[0].id == doc_b.id
        assert user_b_docs[0].owner_id == user_b_id

        # 3. User B searches for User A's unique keyword "Quantum": returns ZERO documents
        user_b_quantum_search = (
            session.query(Document)
            .filter(Document.owner_id == user_b_id, Document.raw_text.ilike("%Quantum%"))
            .all()
        )
        assert len(user_b_quantum_search) == 0

        # 4. User B searches User A's chunks: returns ZERO chunks
        user_b_chunk_search = (
            session.query(DocumentChunk)
            .filter(DocumentChunk.owner_id == user_b_id, DocumentChunk.content.ilike("%Quantum%"))
            .all()
        )
        assert len(user_b_chunk_search) == 0

        # 5. Deletion check matching main.py delete_document: deleting doc and its chunks
        session.query(DocumentChunk).filter(DocumentChunk.document_id == doc_a.id).delete(synchronize_session=False)
        session.delete(doc_a)
        session.commit()
        remaining_chunks = (
            session.query(DocumentChunk).filter(DocumentChunk.document_id == doc_a.id).all()
        )
        assert len(remaining_chunks) == 0


# ============================================================================
# API Endpoint Authentication & Contract Tests (No DB required for 401/unauth)
# ============================================================================


def test_search_endpoints_require_authentication() -> None:
    # Unauthenticated requests must return 401
    assert client.get("/documents/search?q=invoice").status_code == 401
    assert client.get("/documents/search/status").status_code == 401
    assert client.get("/documents/search/semantic?q=invoice").status_code == 401
    assert client.get("/documents/some-id/chunks").status_code == 401
    assert client.get("/documents/some-id/similar").status_code == 401


# ============================================================================
# End-to-End Database-Backed Search & Isolation Tests (Opt-in via db_required)
# ============================================================================


def register_user(email: str, name: str, password: str = "correct-password") -> dict:
    resp = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_e2e_search_status_and_semantic_unavailable(db_required) -> None:
    suffix = uuid.uuid4().hex[:8]
    user = register_user(f"search_tester_{suffix}@example.com", "Search Tester")
    headers = {"Authorization": f"Bearer {user['access_token']}"}

    # 1. Search status reports keyword available and semantic unavailable
    status_resp = client.get("/documents/search/status", headers=headers)
    assert status_resp.status_code == 200
    status_body = status_resp.json()
    assert status_body["keyword_search"]["available"] is True
    assert status_body["semantic_search"]["available"] is False
    assert "Dense embedding provider is not configured" in status_body["semantic_search"]["reason"]

    # 2. Semantic search returns HTTP 503
    semantic_resp = client.get("/documents/search/semantic?q=invoice", headers=headers)
    assert semantic_resp.status_code == 503
    assert "unavailable until an embedding provider is configured" in semantic_resp.json()["detail"]


def test_e2e_search_multi_field_and_user_isolation(db_required) -> None:
    suffix = uuid.uuid4().hex[:8]
    user_a = register_user(f"user_a_{suffix}@example.com", "User Alpha")
    user_b = register_user(f"user_b_{suffix}@example.com", "User Beta")
    headers_a = {"Authorization": f"Bearer {user_a['access_token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['access_token']}"}

    # Upload document for User A
    doc_a_payload = (
        "INVOICE 9001\n"
        "Vendor: Quantum Aerospace Corp\n"
        "Date: 2026-10-01\n"
        "Total Due: $85,000.00\n"
        "Confidential Project Falcon orbital telemetry audit.\n"
    )
    resp_a = client.post(
        "/documents/upload",
        files={"file": ("quantum_falcon.txt", doc_a_payload.encode("utf-8"), "text/plain")},
        headers=headers_a,
    )
    assert resp_a.status_code == 200, resp_a.text
    doc_a_id = resp_a.json()["document_id"]

    # Upload document for User B
    doc_b_payload = (
        "RECEIPT 4410\n"
        "Store: Quantum Coffee Corner\n"
        "Date: 2026-10-02\n"
        "Total Paid: $12.50\n"
        "Coffee and muffin breakfast.\n"
    )
    resp_b = client.post(
        "/documents/upload",
        files={"file": ("quantum_coffee.txt", doc_b_payload.encode("utf-8"), "text/plain")},
        headers=headers_b,
    )
    assert resp_b.status_code == 200, resp_b.text
    doc_b_id = resp_b.json()["document_id"]

    # 1. User A searches shared term "Quantum": returns ONLY User A's document
    search_a = client.get("/documents/search?q=Quantum", headers=headers_a)
    assert search_a.status_code == 200
    docs_a = search_a.json()["documents"]
    assert len(docs_a) == 1
    assert docs_a[0]["document_id"] == doc_a_id
    assert docs_a[0]["excerpts"] is not None

    # 2. User B searches shared term "Quantum": returns ONLY User B's document
    search_b = client.get("/documents/search?q=Quantum", headers=headers_b)
    assert search_b.status_code == 200
    docs_b = search_b.json()["documents"]
    assert len(docs_b) == 1
    assert docs_b[0]["document_id"] == doc_b_id

    # 3. User B searches User A's secret term "Falcon": returns ZERO documents
    search_b_falcon = client.get("/documents/search?q=Falcon", headers=headers_b)
    assert search_b_falcon.status_code == 200
    assert len(search_b_falcon.json()["documents"]) == 0

    # 4. User B attempts to access User A's chunks: 404 Not Found
    chunk_access_b = client.get(f"/documents/{doc_a_id}/chunks", headers=headers_b)
    assert chunk_access_b.status_code == 404

    # 5. User A accesses their own chunks: 200 OK with chunk contents
    chunk_access_a = client.get(f"/documents/{doc_a_id}/chunks", headers=headers_a)
    assert chunk_access_a.status_code == 200
    chunk_data_a = chunk_access_a.json()
    assert chunk_data_a["chunk_count"] >= 1
    assert "Falcon" in chunk_data_a["chunks"][0]["content"]

    # 6. Filter by document_type: User A searches "Quantum" with type="receipt" -> 0 matches
    filter_search = client.get("/documents/search?q=Quantum&document_type=receipt", headers=headers_a)
    assert filter_search.status_code == 200
    assert len(filter_search.json()["documents"]) == 0

    # 7. Similar document: User B on Doc A returns 404; User A on Doc A returns 503 (vector provider unconfigured)
    assert client.get(f"/documents/{doc_a_id}/similar", headers=headers_b).status_code == 404
    assert client.get(f"/documents/{doc_a_id}/similar", headers=headers_a).status_code == 503
