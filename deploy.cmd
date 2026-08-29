@echo off
chcp 65001 >nul

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

for /f "tokens=*" %%a in ('git rev-parse HEAD') do set "COMMIT_HASH=%%a"

echo [3/4] git push origin main
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Push failed
    pause
    exit /b 1
)

echo.
echo [4/4] Waiting for CI/CD result...

for /f "tokens=*" %%r in ('powershell -NoProfile -Command "(git remote get-url origin) -replace '.*github.com[/:]','' -replace '\.git$',''"') do set "REPO=%%r"

set "PSFILE=%TEMP%\check-ci-%RANDOM%.ps1"
(
echo $repo = '%REPO%'
echo $hash = '%COMMIT_HASH%'
echo $api = "https://api.github.com/repos/$repo/actions/runs?per_page=5"
echo $run = $null
echo.
echo for ($i = 1; $i -le 12; $i++) {
echo     Start-Sleep -Seconds 5
echo     try {
echo         $runs = (Invoke-RestMethod -Uri $api -TimeoutSec 10).workflow_runs
echo         $run = $runs ^| Where-Object { $_.head_commit.id -eq $hash } ^| Select-Object -First 1
echo         if ($run) { break }
echo     } catch {}
echo     Write-Host "  [$i/12] CI not started yet, waiting..." -ForegroundColor DarkGray
echo }
echo.
echo if (-not $run) {
echo     Write-Host "[CI/CD] Run record not found. Check manually:" -ForegroundColor Yellow
echo     Write-Host "  https://github.com/$repo/actions" -ForegroundColor Gray
echo     exit
echo }
echo.
echo Write-Host "[CI/CD] Found run. Status: $($run.status)" -ForegroundColor Cyan
echo.
echo while ($run.status -ne 'completed') {
echo     Start-Sleep -Seconds 10
echo     try {
echo         $run = Invoke-RestMethod -Uri $run.url -TimeoutSec 10
echo         Write-Host "  Current status: $($run.status) ..." -ForegroundColor DarkGray
echo     } catch {}
echo }
echo.
echo if ($run.conclusion -eq 'success') {
echo     Write-Host "[CI/CD] Deploy succeeded!" -ForegroundColor Green
echo } elseif ($run.conclusion -eq 'failure') {
echo     Write-Host "[CI/CD] Deploy failed!" -ForegroundColor Red
echo     Write-Host "  View logs: $($run.html_url)" -ForegroundColor Gray
echo } else {
echo     Write-Host "[CI/CD] Result: $($run.conclusion)" -ForegroundColor Yellow
echo     Write-Host "  Details: $($run.html_url)" -ForegroundColor Gray
echo }
) > "%PSFILE%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PSFILE%"
del "%PSFILE%" 2>nul

echo ========================================
pause