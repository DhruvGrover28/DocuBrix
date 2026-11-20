@echo off
title DocuBrix Frontend (Vite + React)
echo ===================================================
echo Starting DocuBrix Frontend on http://localhost:5173
echo ===================================================
cd /d "%~dp0frontend"
npm run dev
pause
