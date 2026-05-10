@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
git add .
git commit -m "%~1"
git push
echo.
echo Done! Vercel is updating: https://arnona-agent.vercel.app/
pause
