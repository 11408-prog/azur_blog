@echo off
chcp 65001 >nul

set /p msg="Enter commit message (press Enter for default 'update'): "
if "%msg%"=="" set msg=update

echo ========================================
echo Commit: %msg%
echo ========================================

echo [1/6] git add .
git add .

echo [2/6] git commit
git commit -m "%msg%"

echo [3/6] git push
git push origin main

echo [4/6] hexo clean
call npx hexo clean

echo [5/6] hexo generate
call npx hexo generate

echo [6/6] hexo deploy
call npx hexo deploy

echo ========================================
echo Done!
echo ========================================
pause
