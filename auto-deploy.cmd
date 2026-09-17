@echo off
setlocal
chcp 936 >nul 2>&1

echo ========================================
echo        Hexo Multi-Deploy Script
echo ========================================
echo.

REM ========================================
REM Ask whether to deploy to Netlify
REM ========================================
set "DEPLOY_NETLIFY=0"
set /p "DEPLOY_NETLIFY=Also deploy to Netlify? (0=No, 1=Yes, default 0): "

if not "%DEPLOY_NETLIFY%"=="1" (
    set "DEPLOY_NETLIFY=0"
)

REM ========================================
REM Ask for a custom commit message
REM ========================================
set "COMMIT_MSG="
set /p "COMMIT_MSG=Commit message (leave blank to use default 'Auto deploy: date time'): "
if defined COMMIT_MSG set "COMMIT_MSG=%COMMIT_MSG:"=%"

echo.
echo ========================================
echo [1/6] Cleaning Hexo build files...
echo ========================================

call hexo clean

if errorlevel 1 (
    echo.
    echo [ERROR] Hexo clean failed.
    echo.
    pause
    exit /b 1
)

echo [OK] Hexo clean completed.
echo.

REM ========================================
REM Generate
REM ========================================
echo ========================================
echo [2/6] Generating Hexo site...
echo ========================================

call hexo generate -c 4

if errorlevel 1 (
    echo.
    echo [WARNING] Concurrent build failed.
    echo [INFO] Trying serial build...
    echo.

    call hexo generate -c 1

    if errorlevel 1 (
        echo.
        echo [ERROR] Hexo build failed.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [OK] Hexo build completed.
echo.

REM ========================================
REM Validate
REM ========================================
echo ========================================
echo [3/6] Validating build...
echo ========================================

if not exist "test\validate-build.js" (
    echo [WARNING] test\validate-build.js not found.
    echo [INFO] Skipping build validation.
) else (
    call node test\validate-build.js

    if errorlevel 1 (
        echo.
        echo [ERROR] Build validation failed.
        echo [INFO] Fix the errors before deploying.
        echo.
        pause
        exit /b 1
    )

    echo [OK] Build validation passed.
)

echo.

REM ========================================
REM GitHub Pages
REM ========================================
echo ========================================
echo [4/6] Deploying to GitHub Pages...
echo ========================================

call hexo deploy

if errorlevel 1 (
    echo [WARNING] GitHub Pages deployment failed.
    echo [INFO] Continuing with other deployments...
    set "GITHUB_PAGES=FAILED"
) else (
    echo [OK] GitHub Pages deployed successfully.
    set "GITHUB_PAGES=SUCCESS"
)

echo.

REM ========================================
REM Git source repository
REM ========================================
echo ========================================
echo [5/6] Pushing source code to GitHub...
echo ========================================

set "COMMIT_OK=1"

git add .

if errorlevel 1 (
    echo [WARNING] git add failed.
    set "COMMIT_OK=0"
) else (
    git diff --cached --quiet

    if errorlevel 1 (
        if "%COMMIT_MSG%"=="" (
            git commit -m "Auto deploy: %date% %time%"
        ) else (
            git commit -m "%COMMIT_MSG%"
        )

        if errorlevel 1 (
            echo [WARNING] Git commit failed.
            set "COMMIT_OK=0"
        ) else (
            echo [OK] Changes committed.
        )
    ) else (
        echo [INFO] No new changes to commit.
    )
)

REM Push even when there are no new changes, because an earlier
REM commit may have succeeded while its push failed.
if "%COMMIT_OK%"=="1" (
    git push origin main

    if errorlevel 1 (
        echo [WARNING] Git push failed. Make sure git is configured.
        set "GITHUB_SOURCE=FAILED"
    ) else (
        echo [OK] Source code pushed successfully.
        set "GITHUB_SOURCE=SUCCESS"
    )
) else (
    echo [WARNING] Skipped push because a Git operation failed.
    set "GITHUB_SOURCE=FAILED"
)

echo.

REM ========================================
REM Count commits
REM ========================================
set "TOTAL_COMMITS=0"

for /f %%c in ('git rev-list --count HEAD 2^>nul') do (
    set "TOTAL_COMMITS=%%c"
)

REM ========================================
REM Cloudflare Pages
REM ========================================
echo ========================================
echo [6/6] Deploying to Cloudflare Pages...
echo ========================================

where wrangler >nul 2>&1

if errorlevel 1 (
    echo [WARNING] Wrangler was not found. Skipping Cloudflare Pages deploy.
    echo.
    echo Install it with:
    echo   npm install -g wrangler
    echo.
    echo Then login with:
    echo   wrangler login
    echo.
    set "CLOUDFLARE=FAILED"
) else (
    call wrangler pages deploy ./public --project-name=azurlane-enterprise --branch=main

    if errorlevel 1 (
        echo [WARNING] Cloudflare Pages deployment failed.
        echo [INFO] Make sure you have run: wrangler login
        set "CLOUDFLARE=FAILED"
    ) else (
        echo [OK] Cloudflare Pages deployed successfully.
        set "CLOUDFLARE=SUCCESS"
    )
)

echo.

REM ========================================
REM Optional Netlify
REM ========================================
if "%DEPLOY_NETLIFY%"=="1" (
    echo ========================================
    echo [Optional] Deploying to Netlify...
    echo ========================================

    where netlify >nul 2>&1

    if errorlevel 1 (
        echo [WARNING] Netlify CLI was not found.
        echo [INFO] Skipping Netlify deployment.
        set "NETLIFY=SKIPPED"
    ) else (
        call netlify deploy --dir=public --prod

        if errorlevel 1 (
            echo [WARNING] Netlify deployment failed.
            set "NETLIFY=FAILED"
        ) else (
            echo [OK] Netlify deployed successfully.
            set "NETLIFY=SUCCESS"
        )
    )

    echo.
) else (
    set "NETLIFY=NOT REQUESTED"
)

REM ========================================
REM Summary
REM ========================================
echo ========================================
echo           Deployment Summary
echo ========================================
echo.
echo GitHub Pages    : %GITHUB_PAGES%
echo GitHub Source   : %GITHUB_SOURCE%
echo Cloudflare Pages: %CLOUDFLARE%
echo Netlify         : %NETLIFY%
echo.
echo Total commits   : %TOTAL_COMMITS%
echo.
echo ========================================
echo           Deployment Finished
echo ========================================
echo.
echo You have already committed %TOTAL_COMMITS% times ^^v^^
echo.

pause
exit /b 0
