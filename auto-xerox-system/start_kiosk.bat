@echo off
TITLE Auto-Xerox Kiosk Master Control
COLOR 0A

echo ===================================================
echo     STARTING AUTO-XEROX KIOSK SYSTEM SERVICES
echo ===================================================
echo.

:: Navigate to root project directory
cd /d "C:\AUTO-ZEROX-SYSTEM\auto-xerox-system"

:: 1. Launch Node.js Server in a new command window
echo [1/2] Launching Node.js Kiosk Backend...
start "Auto-Xerox Node Server" cmd /k "cd /d C:\AUTO-ZEROX-SYSTEM\auto-xerox-system && title Node.js Server && node server.js"

:: Pause briefly to allow Node server to initialize
timeout /t 3 /nobreak >nul

:: 2. Launch Python Print Agent in a new command window
echo [2/2] Launching Python Hardware Print Agent...
start "Auto-Xerox Print Agent" cmd /k "cd /d C:\AUTO-ZEROX-SYSTEM\auto-xerox-system && title Python Print Agent && python print_agent.py"

:: Pause briefly
timeout /t 2 /nobreak >nul

:: 3. Launch Default Browser to Kiosk UI
echo [3/3] Opening Kiosk Interface in Web Browser...
start http://localhost:3000

echo.
echo ===================================================
echo     ALL SERVICES STARTED SUCCESSFULLY!
echo ===================================================
echo.
pause
