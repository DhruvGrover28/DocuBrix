@echo off
title Launch DocuBrix Local Platform
echo ========================================================
echo       Launching DocuBrix Intelligent Document Lifecycle
echo ========================================================
echo.
echo 1. Starting Backend server on port 8000...
start "DocuBrix Backend" "%~dp0run_backend.bat"

echo 2. Waiting 3 seconds for backend initialization...
timeout /t 3 /nobreak >nul

echo 3. Starting Frontend UI server on port 5173...
start "DocuBrix Frontend" "%~dp0run_frontend.bat"

echo 4. Opening DocuBrix in your default web browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo DocuBrix is running!
echo - Frontend: http://localhost:5173
echo - Backend:  http://localhost:8000
echo - Swagger:  http://localhost:8000/docs
echo.
echo Keep the backend and frontend command windows open while using.
echo ========================================================
timeout /t 5 >nul
