@echo off
cd /d "%~dp0"
pwsh -NoProfile -File scripts\Configure-Free-AI.ps1
pause
