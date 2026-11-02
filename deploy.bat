@echo off
REM -----------------------------------------------------------------
REM  Mizuki Blog - double-click launcher for deploy-pages.ps1
REM
REM  Careful: never put a bare > or < inside any echoed message here.
REM  cmd treats those as redirection operators, and a stray arrow once
REM  made a launcher silently overwrite its own script.
REM -----------------------------------------------------------------

chcp 65001 >nul
cd /d "%~dp0"
setlocal

REM Sanity check: a healthy script is well over 10 KB. Anything tiny means
REM it got clobbered, so shout instead of failing in silence.
set "PS1SIZE=0"
for %%F in ("deploy-pages.ps1") do set "PS1SIZE=%%~zF"
if %PS1SIZE% LSS 8000 (
    echo.
    echo   PROBLEM: deploy-pages.ps1 is only %PS1SIZE% bytes.
    echo   It looks damaged. Please ask for a fresh copy.
    echo.
    pause
    exit /b 1
)

set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell"

echo.
echo   Mizuki Blog - Deploy to GitHub Pages
echo   launching deploy-pages.ps1
echo.

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "deploy-pages.ps1" %*

echo.
echo   --------------------------------------------------
echo   The script ended with code %errorlevel%
echo   Press any key to close this window.
echo   --------------------------------------------------
pause
