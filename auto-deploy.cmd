@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM ================================================================
REM  Mizuki Blog - Build, deploy site, and commit source
REM
REM  Careful: never put a bare > or < inside an echoed message.
REM  cmd treats those as redirection operators.
REM ================================================================

cd /d "%~dp0"

echo ========================================
echo        Mizuki Deploy Script
echo ========================================
echo.

REM ========================================
REM Sanity check the PowerShell engine
REM ========================================
if not exist "deploy-pages.ps1" (
    echo [ERROR] deploy-pages.ps1 not found in this folder.
    pause
    exit /b 1
)

set "PS1SIZE=0"
for %%F in ("deploy-pages.ps1") do set "PS1SIZE=%%~zF"
if %PS1SIZE% LSS 8000 (
    echo [ERROR] deploy-pages.ps1 is only %PS1SIZE% bytes. It looks damaged.
    pause
    exit /b 1
)

REM ========================================
REM Ask whether to skip the rebuild
REM ========================================
set "SKIP_BUILD=0"
set /p "SKIP_BUILD=Skip rebuild and reuse dist/? (0=No, 1=Yes, default 0): "
if not "%SKIP_BUILD%"=="1" set "SKIP_BUILD=0"

REM ========================================
REM Ask for a custom commit message
REM ========================================
set "COMMIT_MSG="
set /p "COMMIT_MSG=Commit message (blank = 'Auto deploy: date time'): "
if defined COMMIT_MSG set "COMMIT_MSG=%COMMIT_MSG:"=%"

echo.
echo ========================================
echo [1/4] Building site and pushing gh-pages
echo ========================================
echo.

set "BUILD_ARG="
if "%SKIP_BUILD%"=="1" set "BUILD_ARG=-NoBuild"

powershell -NoProfile -ExecutionPolicy Bypass -File "deploy-pages.ps1" %BUILD_ARG% -Force

if errorlevel 1 (
    echo.
    echo [ERROR] Site deployment failed.
    echo [INFO] Source commit will still be attempted below.
    set "GITHUB_PAGES=FAILED"
) else (
    echo.
    echo [OK] Site deployed to GitHub Pages.
    set "GITHUB_PAGES=SUCCESS"
)

echo.

REM ========================================
REM Git source repository
REM ========================================
echo ========================================
echo [2/4] Committing source code
echo ========================================
echo.

set "COMMIT_OK=1"

git add -A

if errorlevel 1 (
    echo [WARNING] git add failed.
    set "COMMIT_OK=0"
) else (
    git diff --cached --quiet

    if errorlevel 1 (
        if "!COMMIT_MSG!"=="" (
            git commit -m "Auto deploy: %date% %time%"
        ) else (
            git commit -m "!COMMIT_MSG!"
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

echo.

REM ========================================
REM Push source to main
REM ========================================
echo ========================================
echo [3/4] Pushing source code to GitHub
echo ========================================
echo.

REM Push even when nothing new was committed, because an earlier
REM commit may have succeeded while its push failed.

if "%COMMIT_OK%"=="1" (
    set "HAS_REMOTE=0"
    git remote get-url origin >nul 2>&1
    if not errorlevel 1 set "HAS_REMOTE=1"

    if "!HAS_REMOTE!"=="1" (
        echo [INFO] Syncing with origin/main first.
        git fetch origin main

        if errorlevel 1 (
            echo [WARNING] git fetch failed. Skipping rebase.
        ) else (
            git rebase origin/main

            if errorlevel 1 (
                echo [ERROR] Rebase onto origin/main failed. Aborting rebase.
                echo [ERROR] Resolve conflicts manually with: git pull --rebase
                git rebase --abort
                set "COMMIT_OK=0"
            )
        )

        if "!COMMIT_OK!"=="1" (
            git push origin main

            if errorlevel 1 (
                echo [ERROR] Git push failed. Run "git pull --rebase" manually.
                set "GITHUB_SOURCE=FAILED"
            ) else (
                echo [OK] Source code pushed successfully.
                set "GITHUB_SOURCE=SUCCESS"
            )
        ) else (
            set "GITHUB_SOURCE=FAILED"
        )
    ) else (
        echo [ERROR] No 'origin' remote configured.
        echo [INFO] Add one with:
        echo [INFO]   git remote add origin https://github.com/11408-prog/azur_blog.git
        set "GITHUB_SOURCE=FAILED"
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
for /f %%c in ('git rev-list --count HEAD 2^>nul') do set "TOTAL_COMMITS=%%c"

REM ========================================
REM Summary
REM ========================================
echo ========================================
echo [4/4] Deployment Summary
echo ========================================
echo.
echo GitHub Pages  : %GITHUB_PAGES%
echo GitHub Source : %GITHUB_SOURCE%
echo.
echo Total commits : %TOTAL_COMMITS%
echo.
echo Live site     : https://11408-prog.github.io/azur_blog/
echo Build log     : build.log
echo ========================================
echo           Deployment Finished
echo ========================================
echo.

set /a "COMMIT_IS_EVEN=%TOTAL_COMMITS% %% 2"
if "%COMMIT_IS_EVEN%"=="0" (
    echo You have already committed %TOTAL_COMMITS% times QwQ
) else (
    echo You have already committed %TOTAL_COMMITS% times ^^v^^
)

echo.
pause

if "%GITHUB_SOURCE%"=="FAILED" exit /b 1
if "%GITHUB_PAGES%"=="FAILED" exit /b 1
exit /b 0
