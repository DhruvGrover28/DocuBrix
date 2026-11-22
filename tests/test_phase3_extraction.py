from fastapi.testclient import TestClient
import uuid

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


def test_invoice_extraction_complex_multiline_and_formatting() -> None:
    invoice_text = """INVOICE
Acme Supplies Inc.
Invoice Number: INV-2024-001
Date: 2024-05-12
Bill To: John Doe
Description: Consulting Services
Subtotal: $1,250.00
Tax: $125.00
Total: $1,375.00
Payment due in 30 days.
"""

    from backend.app.services.document_processor import (
        extract_financial_fields,
        validate_extracted_fields,
    )

    extracted = extract_financial_fields(invoice_text, "invoice")

    assert extracted["vendor"] == "Acme Supplies Inc"
    assert extracted["invoice_number"] == "INV-2024-001"
    assert extracted["total_amount"] == "1,375.00"
    assert extracted["document_date"] == "2024-05-12"

    validation = validate_extracted_fields("invoice", extracted)
    assert validation["is_valid"] is True
    assert validation["errors"] == []


def test_receipt_extraction_and_subtotal_avoidance() -> None:
    receipt_text = """SUPERMART STORE #402
123 Market Street
Date: 15/04/2024
Receipt No: REC-9921
Items:
Milk $3.50
Bread $2.50
Subtotal $6.00
Tax $0.50
Total Paid: $6.50
Payment Method: VISA Card
Thank you for shopping!
"""

    from backend.app.services.document_processor import (
        extract_financial_fields,
        validate_extracted_fields,
    )

    extracted = extract_financial_fields(receipt_text, "receipt")

    assert "SUPERMART" in extracted["merchant"]
    assert extracted["receipt_number"] == "REC-9921"
    assert extracted["total_amount"] == "6.50"
    assert extracted["payment_method"] == "VISA Card"

    validation = validate_extracted_fields("receipt", extracted)
    assert validation["is_valid"] is True


def test_upload_and_review_round_trip_persists_manual_corrections(db_required) -> None:
    payload = """BANK STATEMENT
Account: Checking 1234
Beginning Balance: $1,000.00
Ending Balance: $1,550.25
Transaction: Salary deposit $550.25
"""

    with TestClient(app) as client:
        registration = client.post(
            "/auth/register",
            json={
                "name": "Phase 3 Tester",
                "email": f"phase3-{uuid.uuid4().hex[:10]}@example.com",
                "password": "correct-password",
            },
        )
        assert registration.status_code == 200, registration.text
        headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}
        upload_response = client.post(
            "/documents/upload",
            files={"file": ("statement.txt", payload.encode("utf-8"), "text/plain")},
            headers=headers,
        )

        assert upload_response.status_code == 200, upload_response.text
        document_id = upload_response.json()["document_id"]

        extracted = upload_response.json()["extracted_fields"]
        assert extracted["document_type"] == "bank_statement"
        assert extracted["account_name"] == "Checking 1234"

        get_response = client.get(f"/documents/{document_id}", headers=headers)
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
            headers=headers,
        )

        assert review_response.status_code == 200, review_response.text
        json_body = review_response.json()
        assert json_body["manual_corrections"]["account_name"] == "Checking 1234 - Personal"
        assert json_body["extracted_values"]["account_name"] == "Checking 1234"
        assert json_body["corrected_values"]["account_name"] == "Checking 1234 - Personal"
        assert json_body["status"] == "reviewed"
