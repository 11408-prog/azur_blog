@echo off
setlocal EnableExtensions
chcp 65001 >nul
title azur_blog Git Diagnostic

set "REPO=C:\Users\ASUS\Desktop\blog"
set "REPORT=%USERPROFILE%\Desktop\azur_blog_diagnostic_%DATE:/=-%_%TIME::=-%.txt"
set "REPORT=%REPORT: =_%"
set "REPORT=%REPORT:.=_%"

if not exist "%REPO%\.git" (
    echo [ERROR] Git repository not found: "%REPO%"
    echo Please edit REPO in this .cmd file to your blog folder.
    pause
    exit /b 1
)

echo ================================================================
echo azur_blog Git and media diagnostic
echo Repository: %REPO%
echo This script does not delete files, rewrite history, commit, or push.
echo ================================================================
echo.
echo Report will be saved to:
echo %REPORT%
echo.

(
echo azur_blog Git and media diagnostic
echo Time: %DATE% %TIME%
echo Repository: %REPO%
echo.
echo ==================== 1. Git status ====================
git -C "%REPO%" rev-parse --show-toplevel
git -C "%REPO%" branch --show-current
git -C "%REPO%" status --short --branch
echo.
echo ==================== 2. Git remotes ====================
git -C "%REPO%" remote -v
echo.
echo ==================== 3. Git object database size ====================
git -C "%REPO%" count-objects -vH
echo.
echo ==================== 4. Key paths ====================
for %%P in (".gitignore" "source" "source\carousel" "source\img" "source\videos" "source\music" ".tmp-cache" "cache_tmp" "public" "node_modules") do (
  if exist "%REPO%\%%~P" (echo EXISTS %%~P) else (echo MISSING %%~P)
)
echo.
echo ==================== 5. Tracked file counts ====================
echo source/carousel:
git -C "%REPO%" ls-files -- "source/carousel" | find /c /v ""
echo source/img:
git -C "%REPO%" ls-files -- "source/img" | find /c /v ""
echo source/videos:
git -C "%REPO%" ls-files -- "source/videos" | find /c /v ""
echo source/music:
git -C "%REPO%" ls-files -- "source/music" | find /c /v ""
echo .tmp-cache:
git -C "%REPO%" ls-files -- ".tmp-cache" | find /c /v ""
echo cache_tmp:
git -C "%REPO%" ls-files -- "cache_tmp" | find /c /v ""
echo public:
git -C "%REPO%" ls-files -- "public" | find /c /v ""
echo node_modules:
git -C "%REPO%" ls-files -- "node_modules" | find /c /v ""
echo.
echo ==================== 6. .gitignore cache-related lines ====================
findstr /n /i "cache node_modules public .tmp" "%REPO%\.gitignore"
echo.
echo ==================== 7. Current disk usage of key folders ====================
) > "%REPORT%" 2>&1

set "AZUR_DIAG_REPO=%REPO%"
for %%P in ("source\carousel" "source\img" "source\videos" "source\music" ".tmp-cache" "cache_tmp" "public" "node_modules") do (
    if exist "%REPO%\%%~P\" (
        >> "%REPORT%" echo.
        >> "%REPORT%" echo [Folder %%~P]
        powershell.exe -NoProfile -Command "$p=Join-Path $env:AZUR_DIAG_REPO '%%~P'; $f=@(Get-ChildItem -LiteralPath $p -File -Recurse -Force -ErrorAction SilentlyContinue); $sum=($f | Measure-Object Length -Sum).Sum; if($null -eq $sum){$sum=0}; 'Files: {0}; Size: {1:N2} MB' -f $f.Count,($sum/1MB)" >> "%REPORT%" 2>&1
    )
)

>> "%REPORT%" echo.
>> "%REPORT%" echo ==================== 8. Largest current files in selected folders ====================
set "AZUR_DIAG_REPO=%REPO%"
powershell.exe -NoProfile -Command "$roots=@('source\carousel','source\img','source\videos','source\music','.tmp-cache','cache_tmp','public','node_modules'); $all=@(); foreach($r in $roots){$p=Join-Path $env:AZUR_DIAG_REPO $r; if(Test-Path -LiteralPath $p -PathType Container){$all+=Get-ChildItem -LiteralPath $p -File -Recurse -Force -ErrorAction SilentlyContinue}}; $all | Sort-Object Length -Descending | Select-Object -First 30 @{n='SizeMB';e={[math]::Round($_.Length/1MB,2)}},FullName | Format-Table -AutoSize | Out-String -Width 240" >> "%REPORT%" 2>&1

>> "%REPORT%" echo.
>> "%REPORT%" echo ==================== 9. Largest historical Git blobs ====================
>> "%REPORT%" echo Note: this scans objects reachable from all Git refs; it may take time.
powershell.exe -NoProfile -Command "$repo=$env:AZUR_DIAG_REPO; $lines=git -C $repo rev-list --objects --all 2>$null; $items=foreach($line in $lines){if([string]::IsNullOrWhiteSpace($line)){continue}; $i=$line.IndexOf(' '); if($i -lt 1){continue}; $sha=$line.Substring(0,$i); $path=$line.Substring($i+1); $type=git -C $repo cat-file -t $sha 2>$null; if($type -ne 'blob'){continue}; $s=git -C $repo cat-file -s $sha 2>$null; $n=0L; if([long]::TryParse(($s | Select-Object -First 1),[ref]$n)){[pscustomobject]@{SizeMB=[math]::Round($n/1MB,2);Path=$path;SHA=$sha}}}; $items | Sort-Object SizeMB -Descending | Select-Object -First 40 | Format-Table -AutoSize | Out-String -Width 240" >> "%REPORT%" 2>&1

>> "%REPORT%" echo.
>> "%REPORT%" echo ==================== 10. Historical path category estimates ====================
powershell.exe -NoProfile -Command "$repo=$env:AZUR_DIAG_REPO; $lines=git -C $repo rev-list --objects --all 2>$null; $items=foreach($line in $lines){if([string]::IsNullOrWhiteSpace($line)){continue}; $i=$line.IndexOf(' '); if($i -lt 1){continue}; $sha=$line.Substring(0,$i); $path=$line.Substring($i+1); $type=git -C $repo cat-file -t $sha 2>$null; if($type -ne 'blob'){continue}; $s=git -C $repo cat-file -s $sha 2>$null; $n=0L; if([long]::TryParse(($s | Select-Object -First 1),[ref]$n)){[pscustomobject]@{Bytes=$n;Path=$path}}}; $groups=@(@{N='carousel';P='^source/carousel/'},@{N='all image files';P='\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|avif)$'},@{N='audio/video';P='\.(mp4|mov|webm|avi|mp3|wav|flac|m4a|ogg)$'},@{N='cache';P='(^|/)(\.tmp-cache|cache_tmp)(/|$)'},@{N='node_modules';P='(^|/)node_modules/'},@{N='public';P='^public/'}); foreach($g in $groups){$a=@($items|Where-Object {$_.Path -match $g.P});$sum=($a|Measure-Object Bytes -Sum).Sum;if($null -eq $sum){$sum=0}; '{0}: entries={1}, raw size={2:N2} MB' -f $g.N,$a.Count,($sum/1MB)}" >> "%REPORT%" 2>&1

echo.
echo Diagnostic finished.
echo Report saved to:
echo %REPORT%
echo.
echo Note: historical raw sizes are estimates, not the compressed Git pack size.
echo Please upload the report TXT file in ChatGPT.
pause
endlocal
