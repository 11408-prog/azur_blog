param([string]$repo, [string]$hash)

$api = "https://api.github.com/repos/$repo/actions/runs?per_page=5"
$run = $null

for ($i = 1; $i -le 12; $i++) {
    Start-Sleep -Seconds 5
    try {
        $runs = (Invoke-RestMethod -Uri $api -TimeoutSec 10).workflow_runs
        $run = $runs | Where-Object { $_.head_commit.id -eq $hash } | Select-Object -First 1
        if ($run) { break }
    } catch {}
    Write-Host "  [$i/12] CI not started yet, waiting..." -ForegroundColor DarkGray
}

if (-not $run) {
    Write-Host "[CI/CD] Run record not found. Check manually:" -ForegroundColor Yellow
    Write-Host "  https://github.com/$repo/actions" -ForegroundColor Gray
    return
}

Write-Host "[CI/CD] Found run. Status: $($run.status)" -ForegroundColor Cyan

while ($run.status -ne 'completed') {
    Start-Sleep -Seconds 10
    try {
        $run = Invoke-RestMethod -Uri $run.url -TimeoutSec 10
        Write-Host "  Current status: $($run.status) ..." -ForegroundColor DarkGray
    } catch {}
}

if ($run.conclusion -eq 'success') {
    Write-Host "[CI/CD] Deploy succeeded!" -ForegroundColor Green
} elseif ($run.conclusion -eq 'failure') {
    Write-Host "[CI/CD] Deploy failed!" -ForegroundColor Red
    Write-Host "  View logs: $($run.html_url)" -ForegroundColor Gray
} else {
    Write-Host "[CI/CD] Result: $($run.conclusion)" -ForegroundColor Yellow
    Write-Host "  Details: $($run.html_url)" -ForegroundColor Gray
}