# DocuBrix

DocuBrix is a Python-based document processing prototype for financial documents. This repository currently contains the Phase 0 foundation: a working FastAPI service with a health endpoint and a reproducible environment.

## Project status

- Phase 0: Environment audit and project foundation
- Current state: working FastAPI health endpoint

## Quick start

1. Create a virtual environment:
   `C:/Users/grove/AppData/Local/Microsoft/WindowsApps/python3.13.exe -m venv C:/Users/grove/Docubrix/.venv`
2. Activate it:
   `C:/Users/grove/Docubrix/.venv/Scripts/Activate.ps1`
3. Install dependencies:
   `python -m pip install --upgrade pip`
   `python -m pip install -r requirements.txt`
4. Run the API:
   `uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000`
5. Check the health endpoint:
   `http://localhost:8000/health`

## Environment notes

- PostgreSQL is the target database for the project, but this Phase 0 checkpoint validates the application successfully without requiring a live database server.
- The application reports database availability as part of the health response and fails gracefully if no PostgreSQL instance is reachable.
- Tesseract is not yet installed in the system environment; the Python wrapper is included so the OCR pipeline can be enabled once the OCR dependency is available.

## Phase 2 classification approach

The current prototype uses a lightweight rule-based classifier instead of a trained ML model. It scores document text for keyword clusters associated with the prototype categories:

- invoice: invoice, bill to, vendor, total due, balance due
- receipt: receipt, payment received, subtotal, tax, total paid
- bank statement: account, statement, beginning balance, ending balance, debit, credit
- other financial document: default when no category-specific signals are strong enough

This is intentionally simple: it favors explainability and fast iteration over deep semantic understanding. It is limited in a few important ways:

- mixed documents can be misclassified when they contain several keyword families
- layout and tabular structure are not yet interpreted as a full document model
- OCR noise can distort keyword counts and reduce confidence in real-world scans

## Basic layout and table understanding

The prototype also generates a minimal layout summary for uploaded documents. It looks for repeated table-like rows using separators such as pipes or tabs, and it counts rows that resemble financial records by detecting labels like date, amount, balance, description, and total. This is intentionally conservative and is not meant to replace a full document parser.

## Future phases

- Phase 1: ingestion, preprocessing, OCR, raw text extraction
- Phase 2: classification and basic document understanding
- Phase 3: extraction, validation, and human review
- Phase 4+: search, RAG, analytics, and workflow automation
