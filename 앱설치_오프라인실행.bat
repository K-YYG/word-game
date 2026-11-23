@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js가 설치되어 있지 않습니다. nodejs.org 에서 LTS를 설치하세요.& pause & exit /b)
if not exist node_modules call npm install
echo 앱을 만드는 중입니다(빌드)...
call npm run build || (echo 빌드 실패 - 위 오류를 확인하세요.& pause & exit /b)
echo 브라우저가 열리면 주소창 오른쪽 [설치] 아이콘 또는 홈 화면의 [앱으로 설치] 버튼을 누르세요.
call npm run preview -- --port 4173 --open
pause
