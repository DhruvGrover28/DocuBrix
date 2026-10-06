# DocuBrix

DocuBrix is a Python-based financial-document processing prototype for invoice, receipt, and bank statement workflows. The current project is a practical evaluation MVP covering document upload, OCR, classification, extraction, validation, confidence scoring, and human review.

## Project status

- Phase 0: environment audit and project foundation
- Phase 1: upload, OCR, and document ingestion
- Phase 2: document-type classification and layout detection
- Phase 3: extraction, validation, confidence scoring, and manual review
- Current state: working Phase 3 evaluation MVP

## Local development

1. Create a virtual environment:
   `python -m venv .venv`
2. Activate it:
   `./.venv/Scripts/Activate.ps1` on Windows
3. Install dependencies:
   `python -m pip install --upgrade pip`
   `python -m pip install -r requirements.txt`
4. Configure the local environment file:
   - copy `.env.example` to `.env`
   - set `DATABASE_URL` to your local PostgreSQL instance
5. Run the API:
   `uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000`
6. Start the frontend:
   `streamlit run frontend/streamlit_app.py --server.address 0.0.0.0 --server.port 8501`
7. Run tests:
   `pytest`

## Environment and security notes

- `.env` is intentionally ignored by git and must never be committed.
- Use `.env.example` as the tracked template for required runtime values.
- Do not commit PostgreSQL data directories, virtual environments, or generated caches.
- Production settings must use environment variables; no hardcoded local URLs in deployed services.

## Phase 3 approach

The current evaluation prototype uses a lightweight rule-based pipeline with explicit signals instead of an ML-heavy baseline. It combines:

- OCR text extraction from PDFs and common image formats
- heuristic document classification across invoice, receipt, bank statement, and other financial document
- field extraction for vendor/merchant, invoice number, statement account, date, totals, and balances
- validation checks for field presence, currency formatting, date patterns, and consistency
- explainable confidence scoring derived from field-quality and validation signals
- manual review records that preserve the distinction between automatically extracted and human-corrected values

This is intentionally focused on transparency and prototype suitability rather than advanced model automation.

## Render deployment

The project is prepared for a Render deployment using two web services:

- FastAPI backend service using the Dockerfile in `backend/Dockerfile`
- Streamlit frontend service using the Dockerfile in `frontend/Dockerfile`

Required environment variables:

- `DATABASE_URL` for the Render PostgreSQL service
- `DOCUBRIX_API_URL` for the frontend service pointing at the deployed API URL
- `PORT` for each service is provided by Render automatically

The backend container listens on `$PORT` and uses the environment-provided database URL. The frontend container uses `DOCUBRIX_API_URL` instead of a localhost value in production.

## Future phases

- Phase 4+: search, RAG, analytics, and workflow automation
