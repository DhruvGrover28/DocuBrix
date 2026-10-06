import io

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_upload_and_process_document() -> None:
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
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["filename"] == "invoice_1001.pdf"
    assert payload["status"] == "processed"
    assert "Invoice 1001" in payload["raw_text"]
    assert payload["document_type"] in {"invoice", "other_financial_document"}
