@echo off

set /p msg="Enter commit message (press Enter for default 'update'): "
if "%msg%"=="" set msg=update

echo ========================================
echo Commit: %msg%
echo ========================================

echo [1/4] git add .
git add .

echo [2/4] git commit (skip if no changes)
git diff --cached --quiet
if %ERRORLEVEL% EQU 0 (
    echo [INFO] No changes to commit, skipping
) else (
    git commit -m "%msg%"
    if errorlevel 1 (
        echo [ERROR] Commit failed
        pause
        exit /b 1
    )
)

echo [3/4] git push origin main
git push origin main
if errorlevel 1 (
    echo [ERROR] Push failed
    pause
    exit /b 1
)

echo [4/4] Local build and deploy to gh-pages
call npm run deploy
if errorlevel 1 (
    echo [ERROR] Deploy failed
    pause
    exit /b 1
)

echo ========================================
echo Done: source pushed, site deployed
pause