<#
.SYNOPSIS
    Mizuki Blog - one-click build and open in browser.

.DESCRIPTION
    Full pipeline: free the port -> clean old output and image cache -> build
                   -> verify -> start local server -> open browser.

    Every message is plain ASCII English on purpose, so no matter which code
    page your terminal is using, nothing turns into mojibake.

.PARAMETER Dev
    Dev mode: run "astro dev" with hot reload on port 3000. Skips the build.

.PARAMETER PreviewOnly
    Open the existing dist/ without rebuilding. Fastest way to just look.

.PARAMETER KeepCache
    Incremental build: keep dist/ and the image cache. Faster.
    Do not use this right after changing images, you may still see the old ones.

.PARAMETER NoBrowser
    Start the server but do not open the browser automatically.

.PARAMETER Port
    Port used by the preview server. Default 4321.

.EXAMPLE
    .\build-and-open.ps1
    Full build, then open the site. The everyday command.

.EXAMPLE
    .\build-and-open.ps1 -Dev
    Live development mode with hot reload.

.EXAMPLE
    .\build-and-open.ps1 -PreviewOnly
    Skip the build, just review the last output.
#>

param(
	[switch]$Dev,
	[switch]$PreviewOnly,
	[switch]$KeepCache,
	[switch]$NoBrowser,
	[int]$Port = 4321
)

$ErrorActionPreference = "Continue"

# Sixteen classic console colours are available. The palette below is blue-led:
# headers read blue, while state and emphasis still get their own colour.
$C = @{
	Banner  = "DarkBlue"
	Rule    = "DarkBlue"
	Title   = "White"
	Dim     = "DarkGray"
	Step    = "Blue"
	StepAlt = "DarkCyan"
	Ok      = "Green"
	Value   = "Cyan"
	Note    = "DarkCyan"
	Warn    = "Yellow"
	Err     = "Red"
	Accent  = "Magenta"
}

Set-Location $PSScriptRoot
$env:ENABLE_CONTENT_SYNC = "false"

# Invoke-WebRequest prints a progress bar that floods the screen. Silence it.
$ProgressPreference = "SilentlyContinue"

# Astro emits UTF-8; decode it as UTF-8 so Chinese post titles stay readable.
try {
	[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
	[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
	$OutputEncoding = [System.Text.Encoding]::UTF8
}
catch { }

function Step($msg) {
	Write-Host "  "
	Write-Host "  ==> $msg" -ForegroundColor $C.Step
}
function Ok($msg) {
	Write-Host "      [OK]   $msg" -ForegroundColor $C.Ok
}
function Warn($msg) {
	Write-Host "      [WARN] $msg" -ForegroundColor $C.Warn
}
function Err($msg) {
	Write-Host "      [FAIL] $msg" -ForegroundColor $C.Err
}
function Info($msg) {
	Write-Host "             $msg" -ForegroundColor $C.Dim
}
function Rule {
	Write-Host "  ------------------------------------------------------------" -ForegroundColor $C.Rule
}

Clear-Host
Write-Host "  "
Write-Host "  ============================================================" -ForegroundColor $C.Banner
Write-Host "    MIZUKI BLOG" -NoNewline -ForegroundColor $C.Accent
Write-Host "  -  Build and Open" -ForegroundColor $C.Title
Write-Host "  ============================================================" -ForegroundColor $C.Banner
Write-Host "    Path  $PSScriptRoot" -ForegroundColor $C.Dim
if ($Dev) { Write-Host "    Mode  Development (hot reload)" -ForegroundColor $C.Value }
elseif ($PreviewOnly) { Write-Host "    Mode  Preview existing dist" -ForegroundColor $C.Value }
elseif ($KeepCache) { Write-Host "    Mode  Build (incremental)" -ForegroundColor $C.Value }
else { Write-Host "    Mode  Build (clean)" -ForegroundColor $C.Value }
Write-Host "  "

# ------------------------------------------------------------------
# 1. Free the ports
# ------------------------------------------------------------------
# A running dev server shares node_modules/.vite with the build and makes it
# fail, so before building we clear both dev (3000) and the preview port.
Step "Checking ports"

$portsToFree = @($Port)
if (-not $Dev) { $portsToFree += 3000 }
$portsToFree = $portsToFree | Sort-Object -Unique

foreach ($p in $portsToFree) {
	$conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
	if ($conns) {
		$pids = $conns.OwningProcess | Sort-Object -Unique
		foreach ($procId in $pids) {
			$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
			if ($proc) {
				Warn "Port $p is held by $($proc.ProcessName) (PID $procId), stopping it"
				Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
				Start-Sleep -Seconds 1
				Ok "Stopped PID $procId"
			}
		}
	}
	else {
		Ok "Port $p is free"
	}
}

# ------------------------------------------------------------------
# 2. Clean previous output
# ------------------------------------------------------------------
if ($PreviewOnly -or $Dev) {
	Step "Cleanup skipped"
	Info "Nothing to clean for this mode"
}
elseif ($KeepCache) {
	Step "Cleaning build scratch only"
	Remove-Item -Recurse -Force "dist\.prerender" -ErrorAction SilentlyContinue
	Info "Kept dist and the image cache"
	Warn "If you just replaced images you may still see the old ones"
}
else {
	Step "Cleaning previous output"
	Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
	Remove-Item -Recurse -Force "node_modules\.astro" -ErrorAction SilentlyContinue
	Ok "Removed dist and node_modules\.astro"
	Info "Clearing the image cache is what forces fresh images"
}

# ------------------------------------------------------------------
# 3. Build
# ------------------------------------------------------------------
if (-not ($Dev -or $PreviewOnly)) {
	Step "Building (about a minute)"

	$logFile = Join-Path $PSScriptRoot "build.log"
	Remove-Item -Force $logFile -ErrorAction SilentlyContinue

	# Route through cmd so notes Astro writes to stderr (e.g. an album missing
	# its cover) stay plain text instead of becoming a red PowerShell error.
	cmd /c "node node_modules/astro/bin/astro.mjs build 2>&1" | Tee-Object -FilePath $logFile
	$exitCode = $LASTEXITCODE

	if ($exitCode -ne 0) {
		Err "Build failed with exit code $exitCode"
		Info "Full log saved to build.log"
		exit 1
	}

	if (-not (Test-Path "dist\index.html")) {
		Err "Build reported no error, but dist\index.html is missing"
		exit 1
	}

	Ok "Build succeeded"

	# The classic trap: Astro reuses cached images, so a replaced image never
	# reaches the output. "reused cache entry" is the fingerprint of that.
	$logText = ""
	if (Test-Path $logFile) { $logText = Get-Content $logFile -Raw }
	$reused = ([regex]::Matches($logText, "reused cache entry")).Count
	$optimized = ([regex]::Matches($logText, "after:")).Count

	if ($optimized -gt 0) {
		Ok "Images regenerated: $optimized"
	}
	if ($reused -gt 0) {
		Warn "$reused image(s) reused the old cache"
		Info "If you just swapped an image, rerun without -KeepCache"
	}
}
elseif ($Dev) {
	Step "Build skipped"
	Info "Dev mode reflects your changes live"
}
else {
	if (-not (Test-Path "dist\index.html")) {
		Err "No dist\index.html found, run once without -PreviewOnly"
		exit 1
	}
	Step "Build skipped"
	Info "Opening the dist you already built"
}

# ------------------------------------------------------------------
# 4. Start the local server
# ------------------------------------------------------------------
Step "Starting local server"

if ($Dev) {
	$serverArgs = @("node_modules/astro/bin/astro.mjs", "dev", "--port", "3000")
	$url = "http://localhost:3000/"
	$modeName = "dev server"
}
else {
	$serverArgs = @("node_modules/astro/bin/astro.mjs", "preview", "--host", "127.0.0.1", "--port", "$Port")
	$url = "http://127.0.0.1:$Port/"
	$modeName = "preview server"
}

$server = Start-Process -FilePath "node" -ArgumentList $serverArgs -PassThru -WindowStyle Minimized
Info "$modeName started, PID $($server.Id)"

Write-Host "             waiting for it to respond" -NoNewline -ForegroundColor $C.Dim
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
	Start-Sleep -Seconds 1
	Write-Host "." -NoNewline -ForegroundColor $C.Dim
	try {
		$resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
		if ($resp.StatusCode -eq 200) { $ready = $true; break }
	}
	catch { }
}
Write-Host "  "

if (-not $ready) {
	Err "The $modeName did not answer in time"
	Info "Usual causes: port still busy, node not on PATH, deps not installed"
	Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
	exit 1
}

Ok "Server is up"

# ------------------------------------------------------------------
# 5. Open the browser
# ------------------------------------------------------------------
if ($NoBrowser) {
	Step "Ready"
	Write-Host "             Open it yourself: " -NoNewline -ForegroundColor $C.Dim
	Write-Host $url -ForegroundColor $C.Accent
}
else {
	Step "Opening the browser"
	Start-Process $url
	Ok "Opened $url"
}

Write-Host "  "
Rule
Write-Host "    ADDRESS   " -NoNewline -ForegroundColor $C.StepAlt
Write-Host $url -ForegroundColor $C.Accent
if ($Dev) {
	Write-Host "    NOTE      " -NoNewline -ForegroundColor $C.StepAlt
	Write-Host "Save a file and the page refreshes itself" -ForegroundColor $C.Value
}
Write-Host "    STOP      " -NoNewline -ForegroundColor $C.StepAlt
Write-Host "Press Ctrl+C or close this window" -ForegroundColor $C.Dim
Rule
Write-Host "  "

# Keep this window attached to the server so Ctrl+C takes both down.
try { Wait-Process -Id $server.Id } catch { }
