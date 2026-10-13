@echo off
chcp 65001 >nul
echo =======================================================
echo   🛡️  SOLANA SENTINEL — UNIFIED LAUNCH SYSTEM
echo =======================================================
echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js v20+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Checking dependencies & data directories...
if not exist node_modules (
    echo [INFO] Installing required dependencies...
    call npm install
)

if not exist data (
    mkdir data
)

echo [3/3] Starting Solana Sentinel Full-Stack Server...
echo Target URL: http://localhost:3000
echo Running Paper Trading Simulator & Market Intelligence...
echo Press Ctrl+C to terminate cleanly.
echo =======================================================

call npm run start:all
pause
