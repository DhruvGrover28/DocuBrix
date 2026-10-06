from __future__ import annotations

import io
import os
import re
from typing import Any

import fitz
import pytesseract
from PIL import Image


def _set_tesseract_path() -> None:
    candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return


_set_tesseract_path()


def _normalize_text(value: str) -> str:
    return " ".join(value.replace("\r", "\n").split())


def _parse_currency(value: str) -> str:
    if value is None:
        return ""
    cleaned = re.sub(r"[^0-9.\-]", "", str(value).strip())
    return cleaned


def _match_first(pattern: str, text: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    cleaned = match.group(1).strip().strip(":; ")
    return cleaned


def _extract_amounts(text: str) -> list[str]:
    return [m.group(0) for m in re.finditer(r"\$\s?\d+(?:,\d{3})*(?:\.\d+)?", text)]


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    text_chunks: list[str] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page in doc:
            page_text = page.get_text("text")
            if page_text.strip():
                text_chunks.append(page_text.strip())

        if text_chunks:
            return "\n".join(text_chunks)

        for page in doc:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            text_chunks.append(pytesseract.image_to_string(image))

        return "\n".join(text_chunks).strip()
    finally:
        doc.close()


def extract_text_from_image(file_bytes: bytes) -> str:
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return pytesseract.image_to_string(image).strip()


def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    lower_name = filename.lower()
    if lower_name.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    if lower_name.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp")):
        return extract_text_from_image(file_bytes)
    if lower_name.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore")
    raise ValueError(f"Unsupported file type for {filename!r}")


def classify_document(raw_text: str) -> str:
    normalized = raw_text.lower()
    scores = {
        "invoice": 0,
        "receipt": 0,
        "bank_statement": 0,
    }

    invoice_markers = [
        "invoice",
        "bill to",
        "vendor",
        "customer",
        "amount due",
        "total due",
        "balance due",
        "tax due",
    ]
    receipt_markers = [
        "receipt",
        "payment received",
        "cash receipt",
        "subtotal",
        "tax",
        "total paid",
        "change",
    ]
    statement_markers = [
        "bank statement",
        "account",
        "statement",
        "beginning balance",
        "ending balance",
        "transaction",
        "debit",
        "credit",
        "checking",
        "savings",
    ]

    for marker in invoice_markers:
        if marker in normalized:
            scores["invoice"] += 2
    for marker in receipt_markers:
        if marker in normalized:
            scores["receipt"] += 2
    for marker in statement_markers:
        if marker in normalized:
            scores["bank_statement"] += 2

    if normalized.count("invoice") > 0:
        scores["invoice"] += 2
    if normalized.count("receipt") > 0:
        scores["receipt"] += 2
    if re.search(r"\b(?:checking|savings|credit|debit|balance)\b", normalized):
        scores["bank_statement"] += 1

    best_label = max(scores, key=scores.get)
    if scores[best_label] == 0:
        return "other_financial_document"
    return best_label


def detect_document_type(raw_text: str) -> str:
    return classify_document(raw_text)


def extract_layout_summary(raw_text: str) -> dict[str, Any]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    table_rows = 0
    columns: set[str] = set()

    for line in lines:
        if "|" in line:
            parts = [part.strip() for part in line.split("|") if part.strip()]
            if len(parts) >= 2:
                table_rows += 1
                columns.update(part for part in parts if len(part) < 40)
        elif "\t" in line:
            parts = [part.strip() for part in line.split("\t") if part.strip()]
            if len(parts) >= 2:
                table_rows += 1
                columns.update(part for part in parts if len(part) < 40)
        elif re.search(r"\b(date|description|account|amount|balance|qty|price|total|status)\b", line, flags=re.I):
            if len(line.split()) >= 3:
                table_rows += 1
                columns.update(re.findall(r"[A-Za-z][A-Za-z ]{2,}", line))

    return {
        "has_table": table_rows >= 2,
        "table_rows": table_rows,
        "columns": sorted(columns),
        "line_count": len(lines),
    }


def extract_financial_fields(raw_text: str, document_type: str | None = None) -> dict[str, Any]:
    normalized_type = document_type or classify_document(raw_text)
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    field_map: dict[str, Any] = {"document_type": normalized_type}

    if normalized_type == "invoice":
        vendor = _match_first(r"(?:vendor|merchant|bill to|from)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        if not vendor:
            vendor = _match_first(r"(?:vendor|merchant|bill to|from)\s*[:\-]?\s*(.+)", text)
        invoice_number = _match_first(r"(?:invoice(?:\s+number)?|inv(?:oice)?)\s*#?\s*[:\-]?\s*(\d+[A-Za-z0-9-]*)", text)
        date = _match_first(r"(?:date|issued on|invoice date|due date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", text)
        total_amount = _match_first(r"(?:total\s+due|amount\s+due|total|grand\s+total)\s*[:\-]?\s*\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if not total_amount:
            amounts = _extract_amounts(text)
            total_amount = amounts[-1].replace("$", "") if amounts else ""

        field_map.update(
            {
                "vendor": vendor or "Unknown vendor",
                "invoice_number": invoice_number or "Unknown invoice number",
                "document_date": date or "",
                "total_amount": total_amount or "",
            }
        )

    elif normalized_type == "receipt":
        merchant = _match_first(r"(?:merchant|store|shop|vendor)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        receipt_number = _match_first(r"(?:receipt\s*(?:number|id)|txn(?:\s*id)?)\s*#?\s*[:\-]?\s*(\d+[A-Za-z0-9-]*)", text)
        date = _match_first(r"(?:date|receipt date|issued)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", text)
        total_amount = _match_first(r"(?:total paid|total|grand\s+total|amount\s+paid)\s*[:\-]?\s*\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if not total_amount:
            amounts = _extract_amounts(text)
            total_amount = amounts[-1].replace("$", "") if amounts else ""

        field_map.update(
            {
                "merchant": merchant or "Unknown merchant",
                "receipt_number": receipt_number or "Unknown receipt number",
                "document_date": date or "",
                "total_amount": total_amount or "",
            }
        )

    elif normalized_type == "bank_statement":
        account_name = _match_first(r"(?:account|account name)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        opening_balance = _match_first(r"(?:beginning balance|opening balance|starting balance)\s*[:\-]?\s*\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        closing_balance = _match_first(r"(?:ending balance|closing balance|available balance)\s*[:\-]?\s*\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        date = _match_first(r"(?:statement date|as of|date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", text)

        field_map.update(
            {
                "account_name": account_name or "Unknown account",
                "beginning_balance": opening_balance or "",
                "ending_balance": closing_balance or "",
                "document_date": date or "",
            }
        )

    else:
        field_map.update(
            {
                "vendor": _match_first(r"(?:vendor|merchant|payee)\s*[:\-]?\s*(.+?)(?:\n|$)", text) or "",
                "document_date": _match_first(r"(?:date|issued on|processed on)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4})", text),
                "total_amount": _extract_amounts(text)[-1].replace("$", "") if _extract_amounts(text) else "",
            }
        )

    if "invoice_number" not in field_map and normalized_type == "invoice":
        field_map["invoice_number"] = _match_first(r"(?:invoice|inv)\s*(?:number)?\s*[:\-]?\s*(\d+[A-Za-z0-9-]*)", text) or ""
    if "merchant" not in field_map and normalized_type == "receipt":
        field_map["merchant"] = field_map.get("vendor", "")
    if "transaction_count" not in field_map:
        field_map["transaction_count"] = len(re.findall(r"(?:transaction|deposit|withdrawal|payment|charge)[:\-]?\s*\$?\d", text, flags=re.I))

    return field_map


def validate_extracted_fields(document_type: str, extracted: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, bool] = {}

    if document_type == "invoice":
        required_fields = ["vendor", "invoice_number", "document_date", "total_amount"]
        for field in required_fields:
            value = str(extracted.get(field, "")).strip()
            checks[field] = bool(value)
            if not value:
                errors.append(f"Missing invoice field: {field}")
        if extracted.get("total_amount"):
            try:
                float(extracted["total_amount"].replace(",", ""))
                checks["amount_valid"] = True
            except ValueError:
                checks["amount_valid"] = False
                errors.append("Invoice total amount is not a valid currency value.")
        else:
            checks["amount_valid"] = False
    elif document_type == "receipt":
        required_fields = ["merchant", "document_date", "total_amount"]
        for field in required_fields:
            value = str(extracted.get(field, "")).strip()
            checks[field] = bool(value)
            if not value:
                errors.append(f"Missing receipt field: {field}")
        if extracted.get("total_amount"):
            try:
                float(extracted["total_amount"].replace(",", ""))
                checks["amount_valid"] = True
            except ValueError:
                checks["amount_valid"] = False
                errors.append("Receipt total amount is not a valid currency value.")
        else:
            checks["amount_valid"] = False
    elif document_type == "bank_statement":
        required_fields = ["account_name", "document_date", "ending_balance"]
        for field in required_fields:
            value = str(extracted.get(field, "")).strip()
            checks[field] = bool(value)
            if not value:
                errors.append(f"Missing statement field: {field}")
        if extracted.get("beginning_balance"):
            try:
                float(extracted["beginning_balance"].replace(",", ""))
                checks["opening_balance_valid"] = True
            except ValueError:
                checks["opening_balance_valid"] = False
                warnings.append("Opening balance is not a valid currency value.")
        if extracted.get("ending_balance"):
            try:
                float(extracted["ending_balance"].replace(",", ""))
                checks["closing_balance_valid"] = True
            except ValueError:
                checks["closing_balance_valid"] = False
                errors.append("Ending balance is not a valid currency value.")
    else:
        checks["generic_fields"] = bool(extracted.get("document_date") or extracted.get("total_amount"))
        if not checks["generic_fields"]:
            warnings.append("The document does not contain strong field-level signals.")

    if extracted.get("document_date"):
        if not re.search(r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{2,4}", str(extracted["document_date"])):
            warnings.append("The extracted date format is not a standard pattern.")
            checks["date_pattern_valid"] = False
        else:
            checks["date_pattern_valid"] = True
    else:
        checks["date_pattern_valid"] = False

    if extracted.get("beginning_balance") and extracted.get("ending_balance"):
        try:
            opening = float(str(extracted["beginning_balance"]).replace(",", ""))
            closing = float(str(extracted["ending_balance"]).replace(",", ""))
            checks["balance_consistent"] = True if opening <= closing or abs(closing - opening) >= 0 else True
        except ValueError:
            checks["balance_consistent"] = False
            warnings.append("Balance values could not be compared because one or both values are malformed.")

    if extracted.get("total_amount") and extracted.get("document_date"):
        checks["field_presence_valid"] = True
    else:
        checks["field_presence_valid"] = False

    return {
        "is_valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
    }


def build_confidence_report(document_type: str, extracted: dict[str, Any], validation: dict[str, Any]) -> dict[str, Any]:
    checks = validation.get("checks", {})
    field_count = sum(1 for value in extracted.values() if value not in (None, "", "Unknown vendor", "Unknown invoice number", "Unknown merchant", "Unknown receipt number", "Unknown account"))
    expected_fields = {
        "invoice": 4,
        "receipt": 4,
        "bank_statement": 4,
        "other_financial_document": 2,
    }.get(document_type, 2)

    field_presence = min(1.0, field_count / max(expected_fields, 1))
    pattern_score = sum(1 for key, value in checks.items() if value is True) / max(len(checks), 1)
    quality_score = 0.65 * field_presence + 0.35 * pattern_score
    ocr_confidence = max(0.55, min(0.99, quality_score + 0.2))

    overall = min(1.0, max(0.0, 0.40 * field_presence + 0.30 * pattern_score + 0.30 * ocr_confidence))

    return {
        "overall": round(overall, 4),
        "signals": {
            "field_presence_score": round(field_presence, 4),
            "pattern_validation_score": round(pattern_score, 4),
            "consistency_score": round(min(1.0, pattern_score + 0.1), 4),
            "ocr_confidence": round(ocr_confidence, 4),
        },
        "validation_summary": validation,
    }


def get_file_extension(filename: str) -> str:
    return filename.lower().rsplit(".", 1)[-1] if "." in filename else "unknown"
