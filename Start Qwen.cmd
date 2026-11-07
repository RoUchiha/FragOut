@echo off
setlocal
cd /d "%~dp0"
where ollama >nul 2>nul
if not errorlevel 1 (
  echo Starting Ollama. Keep this window open while using photo analysis.
  echo If this is your first run, install the model in another terminal:
  echo ollama pull qwen3-vl:2b-instruct
  ollama serve
  exit /b
)
if exist "..\..\work\qwen-runtime\ollama.exe" (
  set "OLLAMA_MODELS=%~dp0..\..\work\qwen-runtime\models"
  set "OLLAMA_HOST=127.0.0.1:11434"
  set "OLLAMA_NO_CLOUD=1"
  "..\..\work\qwen-runtime\ollama.exe" serve
  exit /b
)
echo Install Ollama from https://ollama.com/download then run:
echo ollama pull qwen3-vl:2b-instruct
echo Qwen runs on the computer or server, not on your phone.
pause
