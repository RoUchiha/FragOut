@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then open this launcher again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo FragOut requires Node.js 24 or newer.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  call npm.cmd install
  if errorlevel 1 goto failed
)
if not exist "public\mobile\index.html" (
  if not exist "mobile\node_modules\expo\package.json" (
    call npm.cmd install --prefix mobile
    if errorlevel 1 goto failed
  )
  call npm.cmd run export:web --prefix mobile
  if errorlevel 1 goto failed
)
if not exist ".next\BUILD_ID" (
  call npm.cmd run build
  if errorlevel 1 goto failed
)
echo Opening FragOut at http://localhost:3000/mobile
echo Keep this window open while using the app. Press Ctrl+C to stop it.
start "" "http://localhost:3000/mobile"
call npm.cmd run start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo FragOut could not start. If port 3000 is already in use, open http://localhost:3000/mobile or stop the other copy first.
pause
exit /b 1
