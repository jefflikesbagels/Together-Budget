@echo off
cd /d "%~dp0"

set "NODE_EXE="

where node >nul 2>&1 && set "NODE_EXE=node"

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)

if not defined NODE_EXE if exist "%LocalAppData%\Programs\cursor\resources\app\resources\helpers\node.exe" (
  set "NODE_EXE=%LocalAppData%\Programs\cursor\resources\app\resources\helpers\node.exe"
)

if not defined NODE_EXE (
  echo Node.js was not found in PATH or usual install locations.
  echo.
  echo Install from https://nodejs.org then restart Cursor, or run from PowerShell:
  echo   cd "%~dp0"
  echo   node server.js
  pause
  exit /b 1
)

echo Starting Together Budget server...
echo Using: %NODE_EXE%
echo.
"%NODE_EXE%" server.js
if errorlevel 1 pause
