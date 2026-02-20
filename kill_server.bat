@echo off
echo Finding process on port 8010...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8010" ^| find "LISTENING"') do (
    echo Killing process %%a...
    taskkill /f /pid %%a
)
echo Done. You can now start the server again.
pause
