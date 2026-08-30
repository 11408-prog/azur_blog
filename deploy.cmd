@echo off

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

echo [3/4] git push origin main
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Push failed
    pause
    exit /b 1
)

echo [4/4] Local build and deploy to gh-pages
call npm run deploy
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Deploy failed
    pause
    exit /b 1
)

echo ========================================
echo Done: source pushed, site deployed
pause