@echo off
chcp 65001 >nul

set /p msg="Enter commit message (press Enter for default 'update'): "
if "%msg%"=="" set msg=update

powershell -Command "Write-Host '========================================' -ForegroundColor Cyan"
powershell -Command "Write-Host ('Commit: ' + '%msg%') -ForegroundColor Yellow"
powershell -Command "Write-Host '========================================' -ForegroundColor Cyan"

powershell -Command "Write-Host '[1/6] git add .' -ForegroundColor Blue"
git add .

powershell -Command "Write-Host '[2/6] git commit' -ForegroundColor Blue"
git commit -m "%msg%"

powershell -Command "Write-Host '[3/6] git push origin main' -ForegroundColor Blue"
git push origin main

powershell -Command "Write-Host '========================================' -ForegroundColor Cyan"
powershell -Command "Write-Host 'Done!' -ForegroundColor Green"
powershell -Command "Write-Host '========================================' -ForegroundColor Cyan"

pause
