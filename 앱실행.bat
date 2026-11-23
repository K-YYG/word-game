@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js가 설치되어 있지 않습니다. nodejs.org 에서 LTS를 설치하세요.& pause & exit /b)
if not exist node_modules call npm install
call npm run dev -- --open
pause
