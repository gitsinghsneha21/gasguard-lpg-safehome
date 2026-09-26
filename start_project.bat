@echo off
cd /d "%~dp0"
title LPG SafeHome - Backend & Web Server
echo ===================================================
echo   Starting LPG SafeHome System...
echo ===================================================

:: Ensure user nodejs is in path
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

:: Open default browser after 1 second so the server is ready first
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:5000"

:: Start the backend server
node backend/src/server.js

pause
