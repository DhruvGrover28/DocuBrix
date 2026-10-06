from backend.app.services.document_processor import classify_document, extract_layout_summary


def test_classify_document_types() -> None:
    invoice_text = "INVOICE 1001\nVendor: Acme Labs\nTotal Due: $120.50\nDue Date: 2026-10-15"
    receipt_text = "RECEIPT\nPayment Received: $42.75\nSubtotal: $40.00\nTax: $2.75"
    statement_text = "BANK STATEMENT\nAccount: Checking 1234\nBeginning Balance: $1,000.00\nEnding Balance: $1,550.25"
    other = "Q3 earnings report\nRevenue up 12%\nBoard summary"

    assert classify_document(invoice_text) == "invoice"
    assert classify_document(receipt_text) == "receipt"
    assert classify_document(statement_text) == "bank_statement"
    assert classify_document(other) == "other_financial_document"


def test_extract_layout_summary_looks_for_table_structure() -> None:
    text = "Date | Description | Amount\n2026-10-01 | Coffee | $7.50\n2026-10-02 | Lunch | $18.00\nEnding Balance | $1,245.00"

    summary = extract_layout_summary(text)

    assert summary["has_table"] is True
    assert summary["table_rows"] >= 2
    assert "Date" in summary["columns"]
    assert "Amount" in summary["columns"]
