from fastapi.testclient import TestClient

from backend.app.main import app


def test_invoice_extraction_and_validation() -> None:
    invoice_text = """INVOICE 1001
Vendor: Acme Labs
Date: 2026-10-01
Invoice Number: 1001
Total Due: $120.50
Tax: $10.50
Amount Due: $120.50
"""

    from backend.app.services.document_processor import (
        build_confidence_report,
        extract_financial_fields,
        validate_extracted_fields,
    )

    extracted = extract_financial_fields(invoice_text, "invoice")

    assert extracted["vendor"] == "Acme Labs"
    assert extracted["invoice_number"] == "1001"
    assert extracted["total_amount"] == "120.50"
    assert extracted["document_date"] == "2026-10-01"

    validation = validate_extracted_fields("invoice", extracted)
    assert validation["is_valid"] is True
    assert validation["errors"] == []

    confidence = build_confidence_report("invoice", extracted, validation)
    assert 0.0 <= confidence["overall"] <= 1.0
    assert confidence["overall"] >= 0.60
    assert "ocr_confidence" in confidence["signals"]


def test_upload_and_review_round_trip_persists_manual_corrections() -> None:
    payload = """BANK STATEMENT
Account: Checking 1234
Beginning Balance: $1,000.00
Ending Balance: $1,550.25
Transaction: Salary deposit $550.25
"""

    with TestClient(app) as client:
        upload_response = client.post(
            "/documents/upload",
            files={"file": ("statement.txt", payload.encode("utf-8"), "text/plain")},
        )

        assert upload_response.status_code == 200, upload_response.text
        document_id = upload_response.json()["document_id"]

        extracted = upload_response.json()["extracted_fields"]
        assert extracted["document_type"] == "bank_statement"
        assert extracted["account_name"] == "Checking 1234"

        get_response = client.get(f"/documents/{document_id}")
        assert get_response.status_code == 200, get_response.text
        assert get_response.json()["document_type"] == "bank_statement"

        review_response = client.post(
            f"/documents/{document_id}/review",
            json={
                "manual_corrections": {
                    "account_name": "Checking 1234 - Personal",
                    "ending_balance": "1550.25",
                }
            },
        )

        assert review_response.status_code == 200, review_response.text
        json_body = review_response.json()
        assert json_body["manual_corrections"]["account_name"] == "Checking 1234 - Personal"
        assert json_body["extracted_values"]["account_name"] == "Checking 1234"
        assert json_body["corrected_values"]["account_name"] == "Checking 1234 - Personal"
        assert json_body["status"] == "reviewed"
