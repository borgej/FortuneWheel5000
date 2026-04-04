@echo off
:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed.
    echo Please download and install it from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Start the server in the background
start "FortuneWheel5000 Server" /min node "%~dp0server.js"

:: Give the server a moment to start
timeout /t 1 /nobreak >nul

:: Open the app in the default browser
start http://localhost:3000

echo FortuneWheel5000 is running.
echo Close the "FortuneWheel5000 Server" window to stop it.
echo.
