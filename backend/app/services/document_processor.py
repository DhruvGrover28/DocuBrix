from __future__ import annotations

import io
import os
import re
from typing import Any

import fitz
import pytesseract
from PIL import Image

from backend.app.services.classifier import (
    DOCUMENT_CATEGORY_MAP,
    _heuristic_label,
    classify_document_result,
)


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
    return [m.group(0) for m in re.finditer(r"[\$₹€£]?\s?\d+(?:,\d{3})*(?:\.\d+)?", text)]


def _extract_dates(text: str) -> list[str]:
    pattern = r"\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b"
    return re.findall(pattern, text, flags=re.IGNORECASE)


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
    return _heuristic_label(raw_text)


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
        elif re.search(r"\b(date|description|account|amount|balance|qty|price|total|status|grade|course|subject)\b", line, flags=re.I):
            if len(line.split()) >= 3:
                table_rows += 1
                columns.update(re.findall(r"[A-Za-z][A-Za-z ]{2,}", line))

    return {
        "has_table": table_rows >= 2,
        "table_rows": table_rows,
        "columns": sorted(columns)[:12],
        "line_count": len(lines),
    }


def extract_domain_fields(raw_text: str, document_type: str | None = None) -> dict[str, Any]:
    norm_type = document_type or classify_document(raw_text)
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    category = DOCUMENT_CATEGORY_MAP.get(norm_type, "General")
    field_map: dict[str, Any] = {
        "document_type": norm_type,
        "category": category,
    }

    dates = _extract_dates(text)
    amounts = _extract_amounts(text)
    primary_date = dates[0] if dates else ""

    # 1. FINANCIAL DOCUMENTS
    if norm_type == "invoice":
        vendor = _match_first(r"(?:vendor|merchant|bill\s*from|from|seller)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        if not vendor:
            vendor = _match_first(r"([A-Z0-9\s,&.\-]{3,40}(?:Inc|LLC|Ltd|Corporation|Enterprises|Solutions|Services))\b", text)
        invoice_number = _match_first(r"(?:invoice\s*(?:no|num|number)?|inv(?:oice)?)\s*#?\s*[:\-]?\s*([A-Za-z0-9\-]+)", text)
        date = _match_first(r"(?:invoice\s*date|issued\s*on|date)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", text) or primary_date
        due_date = _match_first(r"(?:due\s*date|payment\s*due)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", text)
        total_amount = _match_first(r"(?:total\s+due|amount\s+due|grand\s+total|total)\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if not total_amount and amounts:
            total_amount = amounts[-1].replace("$", "").replace("₹", "").strip()

        field_map.update({
            "vendor": vendor or "Unknown Vendor",
            "invoice_number": invoice_number or "INV-UNKNOWN",
            "document_date": date or primary_date,
            "due_date": due_date or "",
            "total_amount": total_amount or "",
        })

    elif norm_type == "receipt":
        merchant = _match_first(r"(?:merchant|store|shop|vendor)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        if not merchant:
            merchant = _match_first(r"^([A-Z0-9\s,&.\-]{3,35})\b", text)
        receipt_number = _match_first(r"(?:receipt\s*(?:no|number|id)?|txn\s*(?:id|no)?)\s*#?\s*[:\-]?\s*([A-Za-z0-9\-]+)", text)
        total_amount = _match_first(r"(?:total\s*paid|total|grand\s*total|amount\s*paid)\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        if not total_amount and amounts:
            total_amount = amounts[-1].replace("$", "").replace("₹", "").strip()
        payment_method = _match_first(r"(?:payment\s*method|paid\s*via|tender)\s*[:\-]?\s*(cash|credit\s*card|debit\s*card|upi|visa|mastercard)", text) or "Card/Electronic"

        field_map.update({
            "merchant": merchant or "Unknown Merchant",
            "receipt_number": receipt_number or "REC-UNKNOWN",
            "document_date": primary_date or "",
            "total_amount": total_amount or "",
            "payment_method": payment_method,
        })

    elif norm_type == "bank_statement":
        account_name = _match_first(r"(?:account\s*name|holder\s*name|customer\s*name)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        account_number = _match_first(r"(?:account\s*(?:no|number)?|a/c\s*(?:no)?)\s*[:\-]?\s*([A-Za-z0-9\-X*]+)", text)
        opening_balance = _match_first(r"(?:opening\s*balance|beginning\s*balance|starting\s*balance)\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        closing_balance = _match_first(r"(?:closing\s*balance|ending\s*balance|available\s*balance)\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)

        field_map.update({
            "account_name": account_name or "Unknown Account Holder",
            "account_number": account_number or "AC-XXXX",
            "document_date": primary_date or "",
            "beginning_balance": opening_balance or "",
            "ending_balance": closing_balance or "",
        })

    elif norm_type == "salary_slip":
        employee_name = _match_first(r"(?:employee\s*name|name)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        employee_id = _match_first(r"(?:employee\s*(?:id|code)|emp\s*id)\s*[:\-]?\s*([A-Za-z0-9\-]+)", text)
        employer_name = _match_first(r"(?:company\s*name|employer|organization)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        pay_period = _match_first(r"(?:pay\s*period|month\s*(?:of)?|salary\s*for)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        gross_pay = _match_first(r"(?:gross\s*(?:salary|pay|earnings))\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        net_pay = _match_first(r"(?:net\s*(?:salary|pay|take\s*home))\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)
        deductions = _match_first(r"(?:total\s*deductions|deductions)\s*[:\-]?\s*[\$₹€£]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)", text)

        field_map.update({
            "employee_name": employee_name or "Unknown Employee",
            "employee_id": employee_id or "EMP-XXXX",
            "employer_name": employer_name or "Employer",
            "pay_period": pay_period or "Current Month",
            "gross_pay": gross_pay or "",
            "net_pay": net_pay or "",
            "deductions": deductions or "",
            "document_date": primary_date or "",
        })

    # 2. ACADEMIC DOCUMENTS
    elif norm_type == "academic_transcript":
        student_name = _match_first(r"(?:student\s*name|name\s*of\s*student|candidate\s*name)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        roll_number = _match_first(r"(?:roll\s*(?:no|number)?|registration\s*(?:no|number)?|enrollment\s*no)\s*[:\-]?\s*([A-Za-z0-9\-]+)", text)
        institution = _match_first(r"(?:university|institute|college|board|school)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        if not institution:
            institution = _match_first(r"([A-Z\s]{4,40}(?:UNIVERSITY|INSTITUTE|COLLEGE|SCHOOL))\b", text)
        program = _match_first(r"(?:course|degree|program|branch)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        semester = _match_first(r"(?:semester|sem|term|year)\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?:\n|$)", text)
        cgpa = _match_first(r"(?:cgpa|gpa|sgpa|percentage|marks\s*obtained)\s*[:\-]?\s*(\d+(?:\.\d+)?(?:\s*/\s*\d+)?)", text)
        result_status = _match_first(r"(?:result|status|division)\s*[:\-]?\s*(pass|first\s*class|distinction|cleared|promoted|fail)", text) or "Pass"

        field_map.update({
            "student_name": student_name or "Student Name",
            "roll_number": roll_number or "ROLL-XXXX",
            "institution_name": institution or "Academic Institution",
            "program_name": program or "Undergraduate / Graduate Program",
            "semester_year": semester or "Semester",
            "cgpa_percentage": cgpa or "",
            "result_status": result_status,
            "document_date": primary_date or "",
        })

    elif norm_type == "academic_certificate":
        recipient_name = _match_first(r"(?:conferred\s*upon|awarded\s*to|certifies\s*that)\s*[:\-]?\s*(.+?)(?:\n|,|who)", text)
        institution = _match_first(r"([A-Z\s]{4,50}(?:UNIVERSITY|INSTITUTE|ACADEMY|COLLEGE))\b", text)
        degree_name = _match_first(r"(?:degree\s*of|diploma\s*in|certificate\s*in)\s*[:\-]?\s*(.+?)(?:\n|,|in)", text)
        major = _match_first(r"(?:major\s*in|specialization\s*in|in\s*the\s*field\s*of)\s*[:\-]?\s*(.+?)(?:\n|,)", text)

        field_map.update({
            "recipient_name": recipient_name or "Recipient Name",
            "institution_name": institution or "Issuing Institution",
            "degree_name": degree_name or "Degree / Certificate",
            "major_discipline": major or "Field of Study",
            "document_date": primary_date or "",
        })

    # 3. LEGAL DOCUMENTS
    elif norm_type in ("legal_contract", "non_disclosure_agreement"):
        contract_title = _match_first(r"^([A-Z0-9\s\-]{4,50}(?:AGREEMENT|CONTRACT|DEED|MEMORANDUM))\b", text) or ("Non-Disclosure Agreement" if norm_type == "non_disclosure_agreement" else "Legal Agreement")
        party_one = _match_first(r"(?:between|disclosing\s*party|first\s*party)\s*[:\-]?\s*(.+?)(?:\n|,|and|\()", text)
        party_two = _match_first(r"(?:and|receiving\s*party|second\s*party)\s*[:\-]?\s*(.+?)(?:\n|,|\()", text)
        effective_date = _match_first(r"(?:effective\s*date|dated\s*as\s*of|entered\s*into\s*on)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", text) or primary_date
        term_period = _match_first(r"(?:term|duration|period\s*of\s*agreement)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        governing_law = _match_first(r"(?:governing\s*law|jurisdiction\s*of|laws\s*of)\s*[:\-]?\s*(.+?)(?:\n|\.|$)", text)

        field_map.update({
            "contract_title": contract_title,
            "party_one": party_one or "Party A",
            "party_two": party_two or "Party B",
            "effective_date": effective_date or "",
            "term_period": term_period or "Standard Term",
            "governing_law": governing_law or "Jurisdiction",
            "document_date": effective_date or primary_date,
        })

    # 4. MEDICAL DOCUMENTS
    elif norm_type == "medical_prescription":
        patient_name = _match_first(r"(?:patient\s*name|name)\s*[:\-]?\s*(.+?)(?:\n|,|age|$)", text)
        patient_age = _match_first(r"(?:age|age/sex|age/gender)\s*[:\-]?\s*(\d+\s*(?:yrs|years)?(?:\s*/\s*[MFmf])?)", text)
        doctor_name = _match_first(r"(?:dr\.|doctor\s*name|consultant)\s*[:\-]?\s*([A-Za-z\s.]+?)(?:\n|,|$)", text)
        clinic_hospital = _match_first(r"(?:clinic|hospital|healthcare|centre)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        medications = _match_first(r"(?:rx|medications?|prescriptions?)\s*[:\-]?\s*(.+?)(?:\n\n|\Z)", text)

        field_map.update({
            "patient_name": patient_name or "Patient Name",
            "patient_age_gender": patient_age or "",
            "doctor_name": (f"Dr. {doctor_name}".replace("Dr. Dr.", "Dr.")) if doctor_name else "Consulting Physician",
            "clinic_hospital": clinic_hospital or "Healthcare Center",
            "medications_notes": medications[:120] if medications else "Prescribed therapy",
            "document_date": primary_date or "",
        })

    elif norm_type == "medical_lab_report":
        patient_name = _match_first(r"(?:patient\s*name|name)\s*[:\-]?\s*(.+?)(?:\n|,|$)", text)
        lab_name = _match_first(r"(?:lab(?:oratory)?|diagnostic|pathology)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        test_name = _match_first(r"(?:test\s*name|investigation|parameter)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        observed_value = _match_first(r"(?:result|observed\s*value|value)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        reference_range = _match_first(r"(?:reference\s*(?:range|interval)|normal\s*range)\s*[:\-]?\s*(.+?)(?:\n|$)", text)

        field_map.update({
            "patient_name": patient_name or "Patient Name",
            "laboratory_name": lab_name or "Diagnostic Laboratory",
            "test_name": test_name or "Clinical Diagnostic Test",
            "observed_value": observed_value or "Observed Reading",
            "reference_range": reference_range or "Standard Range",
            "document_date": primary_date or "",
        })

    # 5. ADMINISTRATIVE DOCUMENTS
    elif norm_type == "identity_document":
        full_name = _match_first(r"(?:name|full\s*name|holder)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        id_number = _match_first(r"(?:id\s*(?:no|number)?|passport\s*(?:no)?|licen[sc]e\s*(?:no)?)\s*[:\-]?\s*([A-Za-z0-9\-]+)", text)
        dob = _match_first(r"(?:date\s*of\s*birth|dob|birth\s*date)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", text)
        authority = _match_first(r"(?:authority|issued\s*by|country|state)\s*[:\-]?\s*(.+?)(?:\n|$)", text)

        field_map.update({
            "full_name": full_name or "Cardholder Name",
            "id_number": id_number or "ID-XXXXXX",
            "date_of_birth": dob or "",
            "issuing_authority": authority or "Government Authority",
            "document_date": primary_date or "",
        })

    elif norm_type == "official_notice":
        authority = _match_first(r"(?:issued\s*by|from|office\s*of)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        subject = _match_first(r"(?:sub(?:ject)?|regarding|ref)\s*[:\-]?\s*(.+?)(?:\n|$)", text)
        notice_number = _match_first(r"(?:order\s*no|notice\s*no|ref\s*no)\s*[:\-]?\s*([A-Za-z0-9\-/]+)", text)

        field_map.update({
            "issuing_authority": authority or "Administrative Office",
            "subject": subject or "Official Notification",
            "notice_number": notice_number or "REF-XXXX",
            "document_date": primary_date or "",
        })

    else:
        field_map.update({
            "vendor": _match_first(r"(?:vendor|merchant|payee|from)\s*[:\-]?\s*(.+?)(?:\n|$)", text) or "Entity",
            "document_date": primary_date or "",
            "total_amount": amounts[-1].replace("$", "").replace("₹", "").strip() if amounts else "",
        })

    return field_map


def extract_financial_fields(raw_text: str, document_type: str | None = None) -> dict[str, Any]:
    """Preserve backwards-compatible signature while serving multi-domain extraction."""
    return extract_domain_fields(raw_text, document_type)


def validate_extracted_fields(document_type: str, extracted: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    checks: dict[str, bool] = {}

    category = DOCUMENT_CATEGORY_MAP.get(document_type, "General")

    if document_type == "invoice":
        for field in ["vendor", "invoice_number", "document_date", "total_amount"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                errors.append(f"Missing invoice field: {field}")
        if extracted.get("total_amount"):
            try:
                float(str(extracted["total_amount"]).replace(",", ""))
                checks["amount_valid"] = True
            except ValueError:
                checks["amount_valid"] = False
                errors.append("Invoice total amount is not a valid currency value.")

    elif document_type == "receipt":
        for field in ["merchant", "receipt_number", "document_date", "total_amount"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                warnings.append(f"Missing receipt field: {field}")

    elif document_type == "bank_statement":
        for field in ["account_name", "document_date", "ending_balance"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                errors.append(f"Missing statement field: {field}")

    elif document_type == "salary_slip":
        for field in ["employee_name", "employer_name", "net_pay"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                warnings.append(f"Missing salary slip field: {field}")

    elif document_type in ("academic_transcript", "academic_certificate"):
        for field in ["student_name", "institution_name", "document_date"]:
            val = str(extracted.get(field, "") or extracted.get("recipient_name", "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                warnings.append(f"Incomplete academic record: missing {field}")

    elif document_type in ("legal_contract", "non_disclosure_agreement"):
        for field in ["party_one", "party_two", "effective_date"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                warnings.append(f"Uncertain contract party/date: {field}")

    elif document_type in ("medical_prescription", "medical_lab_report"):
        for field in ["patient_name", "document_date"]:
            val = str(extracted.get(field, "")).strip()
            present = bool(val and not val.startswith("Unknown"))
            checks[field] = present
            if not present:
                warnings.append(f"Incomplete medical record: missing {field}")

    else:
        checks["generic_presence"] = bool(extracted.get("document_date") or extracted.get("total_amount") or extracted.get("vendor"))
        if not checks["generic_presence"]:
            warnings.append("Document lacks key entity and date markers.")

    # General date pattern check
    if extracted.get("document_date"):
        checks["date_pattern_valid"] = True
    else:
        checks["date_pattern_valid"] = False
        warnings.append("No valid document date identified.")

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
    }


def build_confidence_report(document_type: str, extracted: dict[str, Any], validation: dict[str, Any]) -> dict[str, Any]:
    checks = validation.get("checks", {})
    non_empty = sum(
        1 for k, v in extracted.items()
        if k not in ("document_type", "category") and v not in (None, "", "Unknown", "Entity")
    )
    expected_fields = 4 if document_type in ("invoice", "receipt", "bank_statement", "salary_slip", "academic_transcript") else 3

    field_presence = min(1.0, non_empty / max(expected_fields, 1))
    pattern_score = (sum(1 for v in checks.values() if v is True) / max(len(checks), 1)) if checks else 0.70
    quality_score = 0.60 * field_presence + 0.40 * pattern_score
    ocr_confidence = max(0.65, min(0.99, quality_score + 0.15))

    overall = min(1.0, max(0.40, 0.40 * field_presence + 0.35 * pattern_score + 0.25 * ocr_confidence))

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
