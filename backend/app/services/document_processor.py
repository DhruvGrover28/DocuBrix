from __future__ import annotations

import io
import os
from typing import Iterable

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


def detect_document_type(raw_text: str) -> str:
    normalized = raw_text.lower()
    if any(marker in normalized for marker in ["invoice", "amount due", "total due", "bill to", "vendor"]):
        return "invoice"
    if any(marker in normalized for marker in ["receipt", "payment", "cash receipt", "subtotal", "tax"]):
        return "invoice"
    return "other_financial_document"


def get_file_extension(filename: str) -> str:
    return filename.lower().rsplit(".", 1)[-1] if "." in filename else "unknown"
