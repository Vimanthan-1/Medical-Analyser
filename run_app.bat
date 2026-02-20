@echo off
echo ===================================================
echo   Starting Agentic Medical Analyser System
echo ===================================================

:: 1. Start Backend
echo.
echo [1/2] Launching Backend Server...
echo ---------------------------------
start "Backend Server (Port 8010)" cmd /k "cd /d %~dp0 && title Backend Server && echo Installing requirements... && pip install -r requirements.txt && echo Starting Server... && python main_combined.py"

:: 2. Start Frontend
echo.
echo [2/2] Launching Frontend...
echo ---------------------------------
start "Frontend (Port 8080)" cmd /k "cd /d %~dp0Agentic-Medical-Analyser && title Frontend Server && echo Installing dependencies... && npm install && echo Starting Vite... && npm run dev"

echo.
echo ===================================================
echo   Servers Logic:
echo   - Backend: http://localhost:8010
echo   - Frontend: http://localhost:8080
echo.
echo   Please wait for both windows to initialize...
echo ===================================================
pause
