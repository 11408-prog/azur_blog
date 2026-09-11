@echo off
chcp 65001 >nul 2>&1   REM Switch to UTF-8 encoding to avoid special character issues

:: ========== Get ANSI escape character ==========
for /F %%i in ('echo prompt $E ^| cmd') do set "ESC=%%i"

:: ========== Define colors (blue theme) ==========
set "BLUE=%ESC%[94m"      REM Bright blue (main color)
set "CYAN=%ESC%[96m"      REM Bright cyan (secondary)
set "GREEN=%ESC%[92m"     REM Bright green (success)
set "YELLOW=%ESC%[93m"    REM Bright yellow (warning)
set "RED=%ESC%[91m"       REM Bright red (error)
set "BOLD=%ESC%[1m"       REM Bold
set "RESET=%ESC%[0m"      REM Reset color

:: ========== Ask whether to deploy to Netlify ==========
set DEPLOY_NETLIFY=0
set /p DEPLOY_NETLIFY="Also deploy to Netlify? (0=No, 1=Yes, default 0): "
if "%DEPLOY_NETLIFY%"=="" set DEPLOY_NETLIFY=0
if not "%DEPLOY_NETLIFY%"=="0" if not "%DEPLOY_NETLIFY%"=="1" set DEPLOY_NETLIFY=0

echo %BOLD%%BLUE%========================================%RESET%
echo %BOLD%%BLUE%Hexo Multi-Deploy Script%RESET%
echo %BOLD%%BLUE%========================================%RESET%
echo.

:: ========== 1. Clean and generate ==========
echo %CYAN%[1/5] hexo clean%RESET%
call hexo clean
if errorlevel 1 (
    echo %RED%[ERROR] Clean failed%RESET%
    pause
    exit /b 1
)

echo %CYAN%[2/5] hexo generate -c 4%RESET%
call hexo generate -c 4
if errorlevel 1 (
    echo %YELLOW%[WARNING] Concurrent build failed, trying serial build...%RESET%
    call hexo generate -c 1
    if errorlevel 1 (
        echo %RED%[ERROR] Build failed%RESET%
        pause
        exit /b 1
    )
)

:: ========== 2. Deploy to GitHub Pages ==========
echo %CYAN%[3/5] Deploy to GitHub Pages via hexo deploy...%RESET%
call hexo deploy
if errorlevel 1 (
    echo %YELLOW%[WARNING] hexo deploy failed. Check _config.yml deploy settings.%RESET%
    echo %YELLOW%Continuing with Cloudflare Pages deploy...%RESET%
) else (
    echo %GREEN%[OK] GitHub Pages deployed successfully.%RESET%
)

:: ========== 3. Push source code ==========
echo %CYAN%[4/5] Push source code to GitHub repository...%RESET%
git add .
git commit -m "Auto deploy: %date% %time%"
git push origin main
if errorlevel 1 (
    echo %YELLOW%[WARNING] Source push failed. Make sure git is configured.%RESET%
) else (
    echo %GREEN%[OK] Source code pushed to GitHub.%RESET%
)

:: ========== 4. Deploy to Cloudflare Pages ==========
echo %CYAN%[5/5] Deploy to Cloudflare Pages...%RESET%
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[ERROR] wrangler not found. Install it first:%RESET%
    echo   npm install -g wrangler
    echo Then login once:
    echo   wrangler login
    pause
    exit /b 1
)

call wrangler pages deploy ./public --project-name=azurlane-enterprise --branch=main
if errorlevel 1 (
    echo %RED%[ERROR] Cloudflare Pages deploy failed.%RESET%
    echo Make sure you ran: wrangler login
    pause
    exit /b 1
)

:: ========== 5. Optional: Deploy to Netlify ==========
if "%DEPLOY_NETLIFY%"=="1" (
    echo %CYAN%[Optional] Deploy to Netlify...%RESET%
    where netlify >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo %YELLOW%[WARNING] netlify-cli not found. Skipping Netlify deploy.%RESET%
    ) else (
        call netlify deploy --dir=public --prod
        if errorlevel 1 (
            echo %YELLOW%[WARNING] Netlify deploy failed. It may have exceeded the free quota.%RESET%
        ) else (
            echo %GREEN%[OK] Netlify deployed successfully.%RESET%
        )
    )
)

echo %BOLD%%BLUE%========================================%RESET%
echo %BOLD%%BLUE%All deployments completed!%RESET%
echo %BLUE%  - GitHub Pages: via hexo deploy%RESET%
echo %BLUE%  - Source Code: pushed to GitHub repo%RESET%
echo %BLUE%  - Cloudflare Pages: deployed via wrangler%RESET%
if "%DEPLOY_NETLIFY%"=="1" echo %BLUE%  - Netlify: attempted (check logs above)%RESET%
echo %BOLD%%BLUE%========================================%RESET%
pause