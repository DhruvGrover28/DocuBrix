import io
import uuid

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_upload_and_process_document(db_required) -> None:
    registration = client.post(
        "/auth/register",
        json={
            "name": "Upload Tester",
            "email": f"upload-{uuid.uuid4().hex[:10]}@example.com",
            "password": "correct-password",
        },
    )
    assert registration.status_code == 200, registration.text
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    pdf_bytes = io.BytesIO()
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Invoice 1001\nVendor: Acme Labs\nTotal: $120.50\nDue: 2026-10-15")
    doc.save(pdf_bytes)
    doc.close()
    pdf_bytes.seek(0)

    response = client.post(
        "/documents/upload",
        files={"file": ("invoice_1001.pdf", pdf_bytes.read(), "application/pdf")},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["filename"] == "invoice_1001.pdf"
    assert payload["status"] == "processed"
    assert "Invoice 1001" in payload["raw_text"]
    assert payload["document_type"] in {"invoice", "other_financial_document"}


def test_upload_persists_chunks_and_schedules_background_embedding(db_required, monkeypatch) -> None:
    from unittest.mock import patch
    from backend.app.db.database import SessionLocal
    from backend.app.models.document import DocumentChunk

    monkeypatch.setenv("GEMINI_API_KEY", "test-bg-emb-key")

    registration = client.post(
        "/auth/register",
        json={
            "name": "Background Tester",
            "email": f"bg-upload-{uuid.uuid4().hex[:10]}@example.com",
            "password": "correct-password",
        },
    )
    assert registration.status_code == 200, registration.text
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    sample_text = "Vendor: Vertex Dynamics\nInvoice Number: 9942\nTotal Due: $4,200.00\nPayment terms: Net 30."

    with patch("backend.app.main.get_embedding", return_value=[0.11, 0.22, 0.33]) as mock_emb:
        response = client.post(
            "/documents/upload",
            files={"file": ("vertex_invoice.txt", sample_text.encode("utf-8"), "text/plain")},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        doc_id = response.json()["document_id"]

        # In TestClient, BackgroundTasks execute before response returns
        assert mock_emb.called

        with SessionLocal() as session:
            chunks = session.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
            assert len(chunks) >= 1
            assert chunks[0].embedding == [0.11, 0.22, 0.33]


def test_upload_and_background_embedding_sqlite(monkeypatch) -> None:
    from unittest.mock import patch
    from fastapi import BackgroundTasks, UploadFile
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from backend.app.db.database import Base
    from backend.app.models.user import User
    from backend.app.models.document import DocumentChunk
    from backend.app.main import upload_document

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine)

    monkeypatch.setattr("backend.app.main.SessionLocal", TestSession)
    monkeypatch.setenv("GEMINI_API_KEY", "test-bg-emb-key")

    dummy_user = User(id=str(uuid.uuid4()), name="Tester", email="t@example.com", role="user")
    bg_tasks = BackgroundTasks()

    sample_content = b"Vendor: Vertex Dynamics\nTotal Due: $4,200.00\nPayment: Net 30."
    upload_file = UploadFile(filename="invoice.txt", file=io.BytesIO(sample_content))

    result = upload_document(background_tasks=bg_tasks, file=upload_file, user=dummy_user)
    assert result["status"] == "processed"
    doc_id = result["document_id"]

    # Verify chunks exist with None embedding immediately after upload
    with TestSession() as session:
        chunks = session.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
        assert len(chunks) >= 1
        assert chunks[0].embedding is None

    # Run background tasks via anyio
    import anyio
    with patch("backend.app.main.get_embedding", return_value=[0.11, 0.22, 0.33]):
        anyio.run(bg_tasks)

    # Verify chunk embedding was populated by background task
    with TestSession() as session:
        chunks = session.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
        assert chunks[0].embedding == [0.11, 0.22, 0.33]
