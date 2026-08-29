@echo off
chcp 65001 >nul

set /p msg="Enter commit message (press Enter for default 'update'): "
if "%msg%"=="" set msg=update

echo ========================================
echo Commit: %msg%
echo ========================================

echo [1/4] git add .
git add .

echo [2/4] git commit
git commit -m "%msg%"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Commit failed. No changes to commit?
    pause
    exit /b 1
)

for /f "tokens=*" %%a in ('git rev-parse HEAD') do set "COMMIT_HASH=%%a"

echo [3/4] git push origin main
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Push failed
    pause
    exit /b 1
)

echo.
echo [4/4] Waiting for CI/CD result...

for /f "tokens=*" %%r in ('powershell -NoProfile -Command "(git remote get-url origin) -replace '.*github.com[/:]','' -replace '\.git$',''"') do set "REPO=%%r"

if "%REPO%"=="" (
    echo [ERROR] Failed to parse repository name from git remote
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-ci.ps1" -repo "%REPO%" -hash "%COMMIT_HASH%"

echo ========================================
pause