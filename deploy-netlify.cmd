@echo off

echo ========================================
echo Netlify Deploy Script
echo ========================================

echo [1/3] hexo clean
call hexo clean

echo [2/3] hexo generate
call hexo generate
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo [3/3] netlify deploy
where netlify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] netlify-cli not found. Install it first:
    echo   npm install -g netlify-cli
    echo Then login and link this site once:
    echo   netlify login
    echo   netlify init
    pause
    exit /b 1
)

call netlify deploy --dir=public --prod
if errorlevel 1 (
    echo [ERROR] Netlify deploy failed. Make sure you ran: netlify login ^&^& netlify init
    pause
    exit /b 1
)

echo ========================================
echo Done: site deployed to Netlify
pause