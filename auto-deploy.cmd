@echo off
chcp 65001 >nul 2>&1   REM 切换到 UTF-8 编码，避免特殊字符乱码

:: ========== 获取 ANSI 转义字符 ==========
for /F %%i in ('echo prompt $E ^| cmd') do set "ESC=%%i"

:: ========== 定义颜色（蓝色主题） ==========
set "BLUE=%ESC%[94m"      REM 亮蓝色（主色调）
set "CYAN=%ESC%[96m"      REM 亮青色（辅助）
set "GREEN=%ESC%[92m"     REM 亮绿色（成功）
set "YELLOW=%ESC%[93m"    REM 亮黄色（警告/注意）
set "RED=%ESC%[91m"       REM 亮红色（错误）
set "BOLD=%ESC%[1m"       REM 粗体
set "RESET=%ESC%[0m"      REM 重置颜色

echo %BOLD%%BLUE%========================================%RESET%
echo %BOLD%%BLUE%Hexo Multi-Deploy Script%RESET%
echo %BOLD%%BLUE%========================================%RESET%
echo.

:: ========== 1. 清理并生成 ==========
echo %CYAN%[1/5] hexo clean%RESET%
call hexo clean
if errorlevel 1 (
    echo %RED%[ERROR] Clean failed%RESET%
    pause
    exit /b 1
)

echo %CYAN%[2/5] hexo generate%RESET%
call hexo generate
if errorlevel 1 (
    echo %RED%[ERROR] Build failed%RESET%
    pause
    exit /b 1
)

:: ========== 2. 部署到 GitHub Pages ==========
echo %CYAN%[3/5] Deploy to GitHub Pages via hexo deploy...%RESET%
call hexo deploy
if errorlevel 1 (
    echo %YELLOW%[WARNING] hexo deploy failed. Check _config.yml deploy settings.%RESET%
    echo %YELLOW%Continuing with Netlify deploy...%RESET%
) else (
    echo %GREEN%[OK] GitHub Pages deployed successfully.%RESET%
)

:: ========== 3. 推送源代码 ==========
echo %CYAN%[4/5] Push source code to GitHub repository...%RESET%
git add .
git commit -m "Auto deploy: %date% %time%"
git push origin main
if errorlevel 1 (
    echo %YELLOW%[WARNING] Source push failed. Make sure git is configured.%RESET%
) else (
    echo %GREEN%[OK] Source code pushed to GitHub.%RESET%
)

:: ========== 4. 部署到 Netlify ==========
echo %CYAN%[5/5] Deploy to Netlify...%RESET%
where netlify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo %RED%[ERROR] netlify-cli not found. Install it first:%RESET%
    echo   npm install -g netlify-cli
    echo Then login and link this site once:
    echo   netlify login
    echo   netlify init
    pause
    exit /b 1
)

call netlify deploy --dir=public --prod
if errorlevel 1 (
    echo %RED%[ERROR] Netlify deploy failed. Make sure you ran: netlify login ^&^& netlify init%RESET%
    pause
    exit /b 1
)

echo %BOLD%%BLUE%========================================%RESET%
echo %BOLD%%BLUE%All deployments completed!%RESET%
echo %BLUE%  - GitHub Pages: via hexo deploy%RESET%
echo %BLUE%  - Source Code: pushed to GitHub repo%RESET%
echo %BLUE%  - Netlify: deployed via CLI%RESET%
echo %BOLD%%BLUE%========================================%RESET%
pause