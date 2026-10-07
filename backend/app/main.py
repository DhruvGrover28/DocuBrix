from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_

from backend.app.config import ADMIN_EMAIL, APP_ENVIRONMENT, APP_NAME, APP_VERSION
from backend.app.db.database import SessionLocal, check_database_connection, ensure_schema
from backend.app.models.document import Document, DocumentChunk
from backend.app.models.user import User
from backend.app.services.auth import create_access_token, decode_access_token, hash_password, verify_password
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
from backend.app.services.classifier import classify_document_result
from backend.app.services.knowledge import chunk_text, generate_grounded_answer, query_terms

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="DocuBrix financial document processing service",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def initialize_database() -> None:
    try:
        ensure_schema()
    except Exception:
        pass


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def get_current_user(authorization: str | None = Header(default=None)) -> User:
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")

    payload = decode_access_token(authorization.split(" ", 1)[1].strip())
    user_id = payload.get("sub") if payload else None
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    with SessionLocal() as session:
        user = session.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User account was not found.")
        if payload.get("session_version", 0) != user.session_version:
            raise HTTPException(status_code=401, detail="This session is no longer valid.")
        session.expunge(user)
        return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return user


def document_query(session: Any, user: User) -> Any:
    query = session.query(Document)
    if user.role != "admin":
        query = query.filter(Document.owner_id == user.id)
    return query


def serialize_document(document: Document) -> dict[str, Any]:
    extracted_json = document.extracted_json or {}
    review_json = document.review_json or {}
    return {
        "document_id": document.id,
        "filename": document.filename,
        "document_type": document.document_type,
        "classification": {
            "method": document.classification_method,
            "model": document.classification_model,
            "confidence": document.classification_confidence,
            "classified_at": document.classified_at.isoformat() if document.classified_at else None,
        },
        "status": document.status,
        "file_type": document.file_type,
        "upload_time": document.upload_time.isoformat() if document.upload_time else None,
        "confidence": document.confidence_scores or {},
        "validation": extracted_json.get("validation", {}),
        "extracted_fields": extracted_json.get("extracted_fields", {}),
        "review_json": review_json,
        "raw_text": document.raw_text,
    }


@app.post("/auth/register")
def register(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    if len(name) < 2 or len(name) > 160:
        raise HTTPException(status_code=400, detail="Name must contain between 2 and 160 characters.")
    if "@" not in email or len(email) > 320:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters.")
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")

    with SessionLocal() as session:
        if session.query(User).filter(User.email == email).first() is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        user = User(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            password_hash=hash_password(password),
            role="admin" if ADMIN_EMAIL and email == ADMIN_EMAIL else "user",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        response_user = serialize_user(user)
        token = create_access_token(user.id, user.role, user.session_version)
    return {"access_token": token, "token_type": "bearer", "user": response_user}


@app.post("/auth/login")
def login(payload: dict[str, Any]) -> dict[str, Any]:
    email = str(payload.get("email") or "").strip().lower()
    password = str(payload.get("password") or "")
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")

    with SessionLocal() as session:
        user = session.query(User).filter(User.email == email).first()
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        response_user = serialize_user(user)
        token = create_access_token(user.id, user.role, user.session_version)
    return {"access_token": token, "token_type": "bearer", "user": response_user}


@app.get("/auth/me")
def current_user(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": serialize_user(user)}


@app.post("/auth/logout")
def logout(user: User = Depends(get_current_user)) -> dict[str, str]:
    with SessionLocal() as session:
        stored_user = session.query(User).filter(User.id == user.id).first()
        if stored_user is not None:
            stored_user.session_version += 1
            session.commit()
    return {"status": "signed_out"}


@app.patch("/auth/me")
def update_current_user(payload: dict[str, Any], user: User = Depends(get_current_user)) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if len(name) < 2 or len(name) > 160:
        raise HTTPException(status_code=400, detail="Name must contain between 2 and 160 characters.")
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")
    with SessionLocal() as session:
        stored_user = session.query(User).filter(User.id == user.id).first()
        if stored_user is None:
            raise HTTPException(status_code=404, detail="User account was not found.")
        stored_user.name = name
        session.commit()
        session.refresh(stored_user)
        return {"user": serialize_user(stored_user)}


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


@app.get("/admin/overview")
def admin_overview(user: User = Depends(require_admin)) -> dict[str, Any]:
    with SessionLocal() as session:
        documents = session.query(Document).all()
        user_count = session.query(User).count()
    confidence_values = [
        float((document.confidence_scores or {}).get("overall"))
        for document in documents
        if isinstance((document.confidence_scores or {}).get("overall"), (int, float))
    ]
    return {
        "user_count": user_count,
        "document_count": len(documents),
        "processed_count": sum(document.status in {"processed", "reviewed"} for document in documents),
        "failed_count": sum(document.status == "failed" for document in documents),
        "average_confidence": round(sum(confidence_values) / len(confidence_values), 4) if confidence_values else None,
    }


@app.get("/documents")
def list_documents(user: User = Depends(get_current_user)) -> dict[str, Any]:
    with SessionLocal() as session:
        documents = document_query(session, user).order_by(Document.upload_time.desc()).all()

    serialized = [serialize_document(document) for document in documents]

    return {"documents": serialized, "count": len(serialized)}


@app.get("/documents/summary")
def document_summary(user: User = Depends(get_current_user)) -> dict[str, Any]:
    documents_payload = list_documents(user).get("documents", [])

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


@app.get("/documents/search")
def search_documents(
    q: str = Query(min_length=1),
    document_type: str | None = None,
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    terms = query_terms(q)
    if not terms:
        return {"documents": [], "count": 0}
    with SessionLocal() as session:
        query = document_query(session, user)
        conditions = []
        for term in terms:
            pattern = f"%{term}%"
            conditions.append(
                or_(
                    Document.filename.ilike(pattern),
                    Document.raw_text.ilike(pattern),
                    Document.document_type.ilike(pattern),
                    Document.status.ilike(pattern),
                )
            )
        query = query.filter(or_(*conditions))
        if document_type:
            query = query.filter(Document.document_type == document_type)
        documents = query.order_by(Document.upload_time.desc()).all()
    serialized = [serialize_document(document) for document in documents]
    return {"documents": serialized, "count": len(serialized), "query": q}


@app.get("/documents/search/semantic")
def semantic_search_documents(q: str = Query(min_length=1), user: User = Depends(get_current_user)) -> dict[str, Any]:
    raise HTTPException(
        status_code=503,
        detail="Semantic search is unavailable until an embedding provider is configured.",
    )


@app.get("/documents/{document_id}")
def get_document(document_id: str, user: User = Depends(get_current_user)) -> dict[str, Any]:
    with SessionLocal() as session:
        document = document_query(session, user).filter(Document.id == document_id).first()
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
        "classification": {
            "method": document.classification_method,
            "model": document.classification_model,
            "confidence": document.classification_confidence,
            "classified_at": document.classified_at.isoformat() if document.classified_at else None,
        },
        "extracted_fields": extracted_json.get("extracted_fields", {}),
        "validation": extracted_json.get("validation", {}),
        "confidence": document.confidence_scores,
        "manual_corrections": review_json.get("manual_corrections", {}),
        "corrected_values": review_json.get("corrected_values", {}),
        "final_values": final_values,
        "raw_text": document.raw_text,
    }


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), user: User = Depends(get_current_user)) -> dict[str, Any]:
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

    classification = classify_document_result(cleaned_text)
    document_type = classification.document_type
    extracted_fields = extract_financial_fields(cleaned_text, document_type)
    validation = validate_extracted_fields(document_type, extracted_fields)
    confidence = build_confidence_report(document_type, extracted_fields, validation)
    layout_summary = extract_layout_summary(cleaned_text)

    record = {
        "filename": filename,
        "status": "processed",
        "file_type": extension,
        "document_type": document_type,
        "classification": classification.as_dict(),
        "layout_summary": layout_summary,
        "raw_text": cleaned_text,
        "extracted_fields": extracted_fields,
        "validation": validation,
        "confidence": confidence,
    }

    try:
        with SessionLocal() as session:
            document = Document(
                owner_id=user.id,
                filename=filename,
                status="processed",
                file_type=extension,
                document_type=document_type,
                classification_method=classification.method,
                classification_model=f"{classification.model_name}:{classification.model_version}" if classification.model_version and classification.model_name else classification.model_name,
                classification_confidence=classification.confidence,
                classified_at=datetime.fromisoformat(classification.classified_at) if classification.classified_at else None,
                raw_text=cleaned_text,
                extracted_json={
                    "document_type": document_type,
                    "classification": classification.as_dict(),
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
            session.flush()
            for index, content in enumerate(chunk_text(cleaned_text)):
                session.add(
                    DocumentChunk(
                        owner_id=user.id,
                        document_id=document.id,
                        chunk_index=index,
                        content=content,
                    )
                )
            session.commit()
            record["document_id"] = document.id
    except Exception as exc:
        raise HTTPException(status_code=500, detail="The processed document could not be persisted.") from exc

    return record


@app.post("/documents/{document_id}/ask")
def ask_document(document_id: str, payload: dict[str, Any], user: User = Depends(get_current_user)) -> dict[str, Any]:
    question = str(payload.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="A question is required.")
    with SessionLocal() as session:
        document = document_query(session, user).filter(Document.id == document_id).first()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        terms = query_terms(question)
        chunks = session.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.owner_id == user.id,
        ).all()
        ranked = sorted(
            chunks,
            key=lambda chunk: sum(term in chunk.content.lower() for term in terms),
            reverse=True,
        )
        sources = [
            {"document_id": document.id, "filename": document.filename, "chunk_index": chunk.chunk_index, "content": chunk.content}
            for chunk in ranked[:5]
            if not terms or any(term in chunk.content.lower() for term in terms)
        ]
    try:
        answer = generate_grounded_answer(question, sources)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"answer": answer, "sources": sources}


@app.get("/documents/{document_id}/similar")
def similar_documents(document_id: str, user: User = Depends(get_current_user)) -> dict[str, Any]:
    with SessionLocal() as session:
        document = document_query(session, user).filter(Document.id == document_id).first()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")
    raise HTTPException(
        status_code=503,
        detail="Similar-document search is unavailable until an embedding provider is configured.",
    )


@app.post("/documents/{document_id}/review")
def submit_review(document_id: str, payload: dict[str, Any], user: User = Depends(get_current_user)) -> dict[str, Any]:
    manual_corrections = payload.get("manual_corrections") or {}
    if not isinstance(manual_corrections, dict) or not manual_corrections:
        raise HTTPException(status_code=400, detail="manual_corrections must be a non-empty object.")

    with SessionLocal() as session:
        document = document_query(session, user).filter(Document.id == document_id).first()
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


@app.delete("/documents/{document_id}")
def delete_document(document_id: str, user: User = Depends(get_current_user)) -> dict[str, str]:
    with SessionLocal() as session:
        document = document_query(session, user).filter(Document.id == document_id).first()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        session.delete(document)
        session.commit()
    return {"document_id": document_id, "status": "deleted"}

