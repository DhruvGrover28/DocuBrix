from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import APP_ENVIRONMENT, APP_NAME, APP_VERSION
from backend.app.db.database import Base, SessionLocal, check_database_connection, engine
from backend.app.models.document import Document
from backend.app.services.document_processor import (
    detect_document_type,
    extract_text_from_file,
    get_file_extension,
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

    document_type = detect_document_type(cleaned_text)
    record = {
        "filename": filename,
        "status": "processed",
        "file_type": extension,
        "document_type": document_type,
        "raw_text": cleaned_text,
    }

    try:
        with SessionLocal() as session:
            document = Document(
                filename=filename,
                status="processed",
                file_type=extension,
                document_type=document_type,
                raw_text=cleaned_text,
                extracted_json={"document_type": document_type, "source": "ocr"},
            )
            session.add(document)
            session.commit()
            record["document_id"] = document.id
    except Exception:
        record["document_id"] = None

    return record
