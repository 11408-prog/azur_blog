@echo off
REM -----------------------------------------------------------------
REM  Mizuki Blog - double-click launcher for build-and-open.ps1
REM
REM  Careful: never put a bare > or < inside any echoed message here.
REM  cmd treats those as redirection operators, which once made this
REM  file silently overwrite build-and-open.ps1 with one line of text.
REM -----------------------------------------------------------------

chcp 65001 >nul
cd /d "%~dp0"
setlocal

REM Sanity check: a healthy script is ~9 KB. Anything tiny means it got
REM clobbered, so shout instead of failing in silence.
set "PS1SIZE=0"
for %%F in ("build-and-open.ps1") do set "PS1SIZE=%%~zF"
if %PS1SIZE% LSS 1000 (
    echo.
    echo   PROBLEM: build-and-open.ps1 is only %PS1SIZE% bytes.
    echo   It looks damaged. Please ask for a fresh copy.
    echo.
    pause
    exit /b 1
)

REM Prefer the absolute Windows PowerShell path so a mangled PATH cannot break this.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell"

echo.
echo   Mizuki Blog - Build and Open
echo   launching build-and-open.ps1
echo.

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "build-and-open.ps1" %*

echo.
echo   --------------------------------------------------
echo   The script ended with code %errorlevel%
echo   Press any key to close this window.
echo   --------------------------------------------------
pause
