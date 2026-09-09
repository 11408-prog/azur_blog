@echo off

echo ========================================
echo Hexo Multi-Deploy Script
echo ========================================

:: ========== 1. 清理并生成 ==========
echo [1/5] hexo clean
call hexo clean

echo [2/5] hexo generate
call hexo generate
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

:: ========== 2. 部署到 GitHub Pages（hexo deploy） ==========
echo [3/5] Deploy to GitHub Pages via hexo deploy...
call hexo deploy
if errorlevel 1 (
    echo [WARNING] hexo deploy failed. Check _config.yml deploy settings.
    echo Continuing with Netlify deploy...
) else (
    echo [OK] GitHub Pages deployed successfully.
)

:: ========== 3. 推送源代码到 GitHub（备份源码） ==========
echo [4/5] Push source code to GitHub repository...
git add .
git commit -m "Auto deploy: %date% %time%"
git push origin main
if errorlevel 1 (
    echo [WARNING] Source push failed. Make sure git is configured.
) else (
    echo [OK] Source code pushed to GitHub.
)

:: ========== 4. 部署到 Netlify ==========
echo [5/5] Deploy to Netlify...
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
echo All deployments completed!
echo   - GitHub Pages: via hexo deploy
echo   - Source Code: pushed to GitHub repo
echo   - Netlify: deployed via CLI
pause