from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import APP_ENVIRONMENT, APP_NAME, APP_VERSION
from backend.app.db.database import Base, SessionLocal, check_database_connection, engine
from backend.app.models.document import Document
from backend.app.services.document_processor import (
    build_confidence_report,
    classify_document,
    detect_document_type,
    extract_financial_fields,
    extract_layout_summary,
    extract_text_from_file,
    get_file_extension,
    validate_extracted_fields,
)

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="DocuBrix financial document processing service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def initialize_database() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass


@app.get("/health")
def health() -> dict[str, Any]:
    db_state = check_database_connection()
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": APP_VERSION,
        "environment": APP_ENVIRONMENT,
        "database": db_state,
    }


@app.get("/documents")
def list_documents() -> dict[str, Any]:
    with SessionLocal() as session:
        documents = session.query(Document).order_by(Document.upload_time.desc()).all()

    serialized = []
    for document in documents:
        extracted_json = document.extracted_json or {}
        review_json = document.review_json or {}
        serialized.append(
            {
                "document_id": document.id,
                "filename": document.filename,
                "document_type": document.document_type,
                "status": document.status,
                "file_type": document.file_type,
                "upload_time": document.upload_time.isoformat() if document.upload_time else None,
                "confidence": document.confidence_scores or {},
                "validation": extracted_json.get("validation", {}),
                "extracted_fields": extracted_json.get("extracted_fields", {}),
                "review_json": review_json,
                "raw_text": document.raw_text,
            }
        )

    return {"documents": serialized, "count": len(serialized)}


@app.get("/documents/summary")
def document_summary() -> dict[str, Any]:
    documents_payload = list_documents().get("documents", [])

    total_documents = len(documents_payload)
    successful_documents = sum(1 for item in documents_payload if item.get("status") in {"processed", "reviewed"})
    needs_review = sum(
        1
        for item in documents_payload
        if (item.get("validation") or {}).get("is_valid") is False
        or bool((item.get("review_json") or {}).get("manual_corrections"))
    )

    confidence_values = []
    for item in documents_payload:
        value = (item.get("confidence") or {}).get("overall")
        if isinstance(value, (int, float)):
            confidence_values.append(float(value))

    average_confidence = round(sum(confidence_values) / len(confidence_values), 4) if confidence_values else None

    type_counts: dict[str, int] = {}
    for item in documents_payload:
        doc_type = item.get("document_type") or "unknown"
        type_counts[doc_type] = type_counts.get(doc_type, 0) + 1

    status_counts: dict[str, int] = {}
    for item in documents_payload:
        status = item.get("status") or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "total_documents": total_documents,
        "successful_documents": successful_documents,
        "documents_needing_review": needs_review,
        "average_confidence": average_confidence,
        "document_type_distribution": type_counts,
        "status_distribution": status_counts,
        "recent_documents": documents_payload[:5],
    }


@app.get("/documents/{document_id}")
def get_document(document_id: str) -> dict[str, Any]:
    with SessionLocal() as session:
        document = session.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    extracted_json = document.extracted_json or {}
    review_json = document.review_json or {}
    final_values = dict(extracted_json.get("extracted_fields", {}))
    final_values.update(review_json.get("manual_corrections", {}))

    return {
        "document_id": document.id,
        "filename": document.filename,
        "document_type": document.document_type,
        "status": document.status,
        "file_type": document.file_type,
        "upload_time": document.upload_time.isoformat() if document.upload_time else None,
        "extracted_fields": extracted_json.get("extracted_fields", {}),
        "validation": extracted_json.get("validation", {}),
        "confidence": document.confidence_scores,
        "manual_corrections": review_json.get("manual_corrections", {}),
        "corrected_values": review_json.get("corrected_values", {}),
        "final_values": final_values,
        "raw_text": document.raw_text,
    }


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A file is required for document processing.")

    filename = file.filename.strip()
    allowed_extensions = {"pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "txt"}
    extension = get_file_extension(filename)
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{extension}'. Supported types: {', '.join(sorted(allowed_extensions))}.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        raw_text = extract_text_from_file(filename, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    cleaned_text = "\n".join(part.strip() for part in raw_text.splitlines() if part.strip())
    if not cleaned_text:
        raise HTTPException(status_code=422, detail="No readable text was found in the document.")

    document_type = classify_document(cleaned_text)
    extracted_fields = extract_financial_fields(cleaned_text, document_type)
    validation = validate_extracted_fields(document_type, extracted_fields)
    confidence = build_confidence_report(document_type, extracted_fields, validation)
    layout_summary = extract_layout_summary(cleaned_text)

    record = {
        "filename": filename,
        "status": "processed",
        "file_type": extension,
        "document_type": document_type,
        "layout_summary": layout_summary,
        "raw_text": cleaned_text,
        "extracted_fields": extracted_fields,
        "validation": validation,
        "confidence": confidence,
    }

    try:
        with SessionLocal() as session:
            document = Document(
                filename=filename,
                status="processed",
                file_type=extension,
                document_type=document_type,
                raw_text=cleaned_text,
                extracted_json={
                    "document_type": document_type,
                    "source": "ocr",
                    "layout_summary": layout_summary,
                    "extracted_fields": extracted_fields,
                    "validation": validation,
                },
                confidence_scores=confidence,
                review_json={
                    "manual_corrections": {},
                    "corrected_values": {},
                },
            )
            session.add(document)
            session.commit()
            record["document_id"] = document.id
    except Exception:
        record["document_id"] = None

    return record


@app.post("/documents/{document_id}/review")
def submit_review(document_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    manual_corrections = payload.get("manual_corrections") or {}
    if not isinstance(manual_corrections, dict) or not manual_corrections:
        raise HTTPException(status_code=400, detail="manual_corrections must be a non-empty object.")

    with SessionLocal() as session:
        document = session.query(Document).filter(Document.id == document_id).first()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")

        extracted_json = document.extracted_json or {}
        auto_extracted = dict(extracted_json.get("extracted_fields", {}))
        manual_record = dict(document.review_json.get("manual_corrections", {})) if document.review_json else {}
        manual_record.update(manual_corrections)

        corrected_values = {}
        for key, value in manual_corrections.items():
            if key in auto_extracted:
                corrected_values[key] = value

        document.review_json = {
            "manual_corrections": manual_record,
            "corrected_values": corrected_values,
            "extracted_values": auto_extracted,
        }
        document.status = "reviewed"
        session.commit()

    return {
        "document_id": document_id,
        "status": "reviewed",
        "manual_corrections": manual_record,
        "extracted_values": auto_extracted,
        "corrected_values": corrected_values,
    }

