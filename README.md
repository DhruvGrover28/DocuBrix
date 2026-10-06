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

## Future phases

- Phase 1: ingestion, preprocessing, OCR, raw text extraction
- Phase 2: classification and basic document understanding
- Phase 3: extraction, validation, and human review
- Phase 4+: search, RAG, analytics, and workflow automation
