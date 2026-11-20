@echo off
title Push DocuBrix to GitHub
cd /d "%~dp0"
echo ========================================================
echo        Upload DocuBrix to GitHub (Tester-acc-007)
echo ========================================================
echo.
echo Note: GitHub does NOT accept normal account passwords here.
echo Instead, GitHub uses a free 'Personal Access Token' (takes 30 seconds):
echo.
echo 1. Open this link in your browser:
echo    https://github.com/settings/tokens/new
echo.
echo 2. On that page:
echo    - In 'Note', type: docubrix
echo    - Check the top checkbox: [x] repo
echo    - Scroll down and click the green button: 'Generate token'
echo    - Copy your new token (starts with ghp_...)
echo.
set /p TOKEN="3. Right-click here to paste your token, then press Enter: "

echo.
echo Uploading project files to GitHub...
echo.

git remote set-url origin https://github.com/Tester-acc-007/DocuBrix.git
git push -u https://Tester-acc-007:%TOKEN%@github.com/Tester-acc-007/DocuBrix.git main --force

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo SUCCESS! All files have been uploaded to:
    echo https://github.com/Tester-acc-007/DocuBrix
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo Upload failed. Make sure you copied the token starting with ghp_
    echo and checked the [x] repo checkbox.
    echo ========================================================
)
pause
