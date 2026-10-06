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


def get_file_extension(filename: str) -> str:
    return filename.lower().rsplit(".", 1)[-1] if "." in filename else "unknown"
