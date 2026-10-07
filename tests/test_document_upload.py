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
