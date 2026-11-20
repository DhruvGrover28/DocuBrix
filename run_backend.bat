@echo off
title DocuBrix Backend (FastAPI)
echo ===================================================
echo Starting DocuBrix Backend Service on http://localhost:8000
echo ===================================================
cd /d "%~dp0"
call "backend\.venv\Scripts\activate.bat"
set PYTHONPATH=%~dp0
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
