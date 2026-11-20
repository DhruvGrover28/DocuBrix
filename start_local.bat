@echo off
title DocuBrix Local Launcher
echo ========================================================
echo        Starting DocuBrix Full Stack Application
echo ========================================================
echo.

echo 1. Starting FastAPI Backend on http://localhost:8000 ...
start "DocuBrix Backend" cmd /k "cd /d %~dp0backend && ..\backend\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak > nul

echo 2. Starting Vite Frontend on http://localhost:5173 ...
start "DocuBrix Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo ========================================================
echo DocuBrix is running!
echo Frontend: http://localhost:5173
echo Backend API & Docs: http://localhost:8000/docs
echo SQLite Database: docubrix.db (Auto-connected)
echo ========================================================
pause
