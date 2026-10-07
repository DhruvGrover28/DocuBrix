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
   `cd frontend && npm install && npm run dev`
7. Run tests:
   `pytest`

## Environment and security notes

- `.env` is intentionally ignored by git and must never be committed.
- Use `.env.example` as the tracked template for required runtime values.
- Do not commit PostgreSQL data directories, virtual environments, or generated caches.
- Production settings must use environment variables; no hardcoded local URLs in deployed services.

## Database schema initialization

On backend startup, SQLAlchemy creates missing `users` and `documents` tables. The startup migration also adds the `users.session_version` column and the `documents.owner_id` index/foreign key when they are missing. Existing documents are preserved; legacy rows without an owner remain inaccessible to normal users and are visible only to administrators until explicitly assigned.

Database integration tests are opt-in and require a disposable PostgreSQL database:

`$env:DOCUBRIX_TEST_DATABASE_URL="postgresql+psycopg://..."; pytest -q`

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

The project is prepared for a Render deployment using a static frontend, an API web service, and PostgreSQL:

- React/Vite frontend as a Render Static Site with root directory `frontend`, build command `npm run build`, and publish directory `dist`
- FastAPI backend service using the Dockerfile in `backend/Dockerfile`
- Render PostgreSQL for persistent users and document ownership

Required environment variables:

- `DATABASE_URL` for the Render PostgreSQL service
- `AUTH_SECRET` for signed authentication sessions
- `ADMIN_EMAIL` for the bootstrap administrator account
- `VITE_API_URL` for the static frontend build, pointing at the deployed API URL
- `PORT` for each service is provided by Render automatically

The backend container listens on `$PORT` and uses the environment-provided database URL. The frontend container uses `DOCUBRIX_API_URL` instead of a localhost value in production.

## Future phases

- Phase 4+: search, RAG, analytics, and workflow automation
