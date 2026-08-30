@echo off
setlocal
cd /d "%~dp0"
title Redstone World Server
set PORT=8000
set URL=http://localhost:%PORT%
echo ============================================
echo            Redstone World - Launcher
echo ============================================
echo.
where python >nul 2>nul && (
  echo Starting server with python ... %URL%
  start "" "%URL%"
  python server.py %PORT%
  goto end
)
where py >nul 2>nul && (
  echo Starting server with py launcher ... %URL%
  start "" "%URL%"
  py server.py %PORT%
  goto end
)
where npx >nul 2>nul && (
  echo Python not found, using Node http-server ... %URL%
  start "" "%URL%"
  npx --yes http-server -p %PORT% -c-1
  goto end
)
echo [ERROR] Neither Python nor Node was found.
echo Install Python from https://www.python.org/downloads/
echo Install Node from https://nodejs.org/
echo.
pause
:end