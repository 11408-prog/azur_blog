<#
.SYNOPSIS
    Mizuki Blog - build the site and publish it to the GitHub Pages branch.

.DESCRIPTION
    Full pipeline:
        check tools -> free ports -> clean -> build -> pagefind index
        -> verify output -> stage publish tree -> drop template junk
        -> git commit -> push to gh-pages of the azur_blog repo -> confirm

    Publishing is incremental. The history of what was uploaded last time is kept
    in .publish-git (next to this script, git-ignored), so a normal deploy only
    uploads the files that changed - usually a few MB instead of the whole site.
    Use -Fresh to throw that history away and start over.

    Every message is plain ASCII English on purpose, so no code page can turn
    it into mojibake.

    Three things this script works around, all measured on this machine:

    1. Git cannot talk TLS because the system gitconfig forces the schannel
       backend, which fails with SEC_E_NO_CREDENTIALS. We pass
       -c http.sslBackend=openssl plus an explicit CA bundle on every call.

    2. The git credential helper is unusable here: git shells out to sh.exe to
       run it, and sh.exe cannot create its signal pipe. We therefore skip the
       helper: the token is read from -Token or from the .deploy-token file next
       to this script, and handed to git as an Authorization header. It stays in
       memory only - never printed, never written anywhere else.

    3. GitHub Pages builds this repository with Jekyll in legacy mode, and
       Jekyll silently drops every directory whose name starts with an
       underscore. Astro emits its bundle into _astro, so a missing .nojekyll
       would put the whole stylesheet and script set behind a 404.

.PARAMETER NoBuild
    Publish the existing dist/ without rebuilding.

.PARAMETER KeepCache
    Incremental build. Do NOT use right after replacing images.

.PARAMETER DryRun
    Do everything except the actual push. Useful to see the staged size first.

.PARAMETER Force
    Skip the confirmation prompt before the push.

.PARAMETER Fresh
    Discard the saved publish history (.publish-git) and upload the whole site
    again as a single new commit. Slow on a weak uplink, but it squashes the
    gh-pages history. Run it now and then, not every time.

.PARAMETER Repo
    Override the target repository URL.

.EXAMPLE
    .\deploy-pages.ps1
    Build and publish. The everyday command.

.EXAMPLE
    .\deploy-pages.ps1 -DryRun
    Build everything and stop before pushing, so you can inspect .publish.

.EXAMPLE
    .\deploy-pages.ps1 -NoBuild -DryRun
    Rehearse packaging only. Fast.
#>

param(
	[switch]$NoBuild,
	[switch]$KeepCache,
	[switch]$DryRun,
	[switch]$Force,
	[switch]$Fresh,
	[string]$Repo = "https://github.com/11408-prog/azur_blog.git",
	[string]$Branch = "gh-pages",
	[string]$Token = ""
)

$ErrorActionPreference = "Continue"

$C = @{
	Banner  = "DarkBlue"
	Rule    = "DarkBlue"
	Title   = "White"
	Dim     = "DarkGray"
	Step    = "Blue"
	StepAlt = "DarkCyan"
	Ok      = "Green"
	Value   = "Cyan"
	Warn    = "Yellow"
	Err     = "Red"
	Accent  = "Magenta"
}

Set-Location $PSScriptRoot
$env:ENABLE_CONTENT_SYNC = "false"
$ProgressPreference = "SilentlyContinue"

try {
	[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
	$OutputEncoding = [System.Text.Encoding]::UTF8
}
catch { }

$DistDir = Join-Path $PSScriptRoot "dist"
$PubDir = Join-Path $PSScriptRoot ".publish"
# Publish history. Kept outside .publish because .publish is wiped on every run.
$GitDir = Join-Path $PSScriptRoot ".publish-git"
$HeartbeatSeconds = 10

function Step($msg) {
	Write-Host "  "
	Write-Host "  ==> $msg" -ForegroundColor $C.Step
}
function Ok($msg) { Write-Host "      [OK]   $msg" -ForegroundColor $C.Ok }
function Warn($msg) { Write-Host "      [WARN] $msg" -ForegroundColor $C.Warn }
function Err($msg) { Write-Host "      [FAIL] $msg" -ForegroundColor $C.Err }
function Info($msg) { Write-Host "             $msg" -ForegroundColor $C.Dim }
function Rule { Write-Host "  ------------------------------------------------------------" -ForegroundColor $C.Rule }

function Format-MB($bytes) { return ("{0:N1} MB" -f ($bytes / 1MB)) }

function Get-TreeSize($path) {
	if (-not (Test-Path $path)) { return 0 }
	$m = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
	if ($null -eq $m.Sum) { return 0 }
	return $m.Sum
}

function Exit-With($code, $msg) {
	if ($msg) { Err $msg }
	Write-Host "  "
	Rule
	Write-Host "    DEPLOY ABORTED" -ForegroundColor $C.Err
	Rule
	Write-Host "  "
	exit $code
}

# ------------------------------------------------------------------
# Push helpers
# ------------------------------------------------------------------

# Bytes sent by all network adapters so far. Windows has no cheap per-process
# counter, so the heartbeat reports the difference over time; that includes
# other programs. Returns $null when the statistics are not available.
function Get-NetSentBytes {
	try {
		$m = Get-NetAdapterStatistics -ErrorAction Stop | Measure-Object -Property SentBytes -Sum
		if ($null -eq $m.Sum) { return $null }
		return [int64]$m.Sum
	}
	catch { return $null }
}

# git redraws "Counting objects: 37% (102/275)" in place with carriage returns.
# Here every redraw arrives as a line of its own, so one push would print
# hundreds of them. Keep only the last line of each phase (the one that ends in
# "done." or "completed with") and drop the intermediate percentages.
function Test-GitProgressNoise([string]$Line) {
	return ($Line -match ":\s+\d+% \(\d+/\d+\)" -and $Line -notmatch ",\s+done\.|completed with")
}

# Runs git in a background job and prints a status line every few seconds.
# git itself only shows progress while it writes the pack into a local buffer.
# The network upload that follows is silent, and on a slow uplink it is the
# longest part of a deploy, so without this the script looks frozen.
# Returns git's exit code.
function Invoke-GitPush([string[]]$GitArgs) {
	$job = Start-Job -ScriptBlock {
		param($a)
		& git @a 2>&1 | ForEach-Object { "$_" }
		"@@EXIT@@" + $LASTEXITCODE
	} -ArgumentList (, $GitArgs)

	$code = 1
	$sw = [Diagnostics.Stopwatch]::StartNew()
	$lastBeat = 0.0
	$firstSent = Get-NetSentBytes
	$lastSent = $firstSent
	$lastSentAt = 0.0

	Info "git prints nothing while the upload itself runs; a status line follows every $HeartbeatSeconds s"
	try {
		while ($true) {
			# Read the state first, then drain output: anything written before the job
			# finished is still collected by the drain that follows.
			$running = ($job.State -eq "Running")
			foreach ($line in @(Receive-Job -Job $job -ErrorAction SilentlyContinue)) {
				$text = "$line"
				if ($text -like "@@EXIT@@*") { $code = [int]$text.Substring(8); continue }
				if ($text -match "AUTHORIZATION|basic ") { continue }
				if (Test-GitProgressNoise $text) { continue }
				Write-Host "             $text" -ForegroundColor $C.Dim
				$lastBeat = $sw.Elapsed.TotalSeconds
			}
			if (-not $running) { break }

			$now = $sw.Elapsed.TotalSeconds
			if (($now - $lastBeat) -ge $HeartbeatSeconds) {
				$msg = "uploading... {0:00}:{1:00} elapsed" -f [int][math]::Floor($now / 60), [int]($now % 60)
				$sent = Get-NetSentBytes
				if ($null -ne $sent -and $null -ne $firstSent) {
					$msg += ", {0} sent" -f (Format-MB ($sent - $firstSent))
					if ($null -ne $lastSent -and $now -gt $lastSentAt) {
						$mbps = (($sent - $lastSent) * 8 / 1000000) / ($now - $lastSentAt)
						$msg += ", {0:N1} Mbps" -f $mbps
					}
					$lastSent = $sent
					$lastSentAt = $now
				}
				Info $msg
				$lastBeat = $now
			}
			Start-Sleep -Milliseconds 500
		}
	}
	finally {
		Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
	}
	return $code
}

Clear-Host
Write-Host "  "
Write-Host "  ============================================================" -ForegroundColor $C.Banner
Write-Host "    MIZUKI BLOG" -NoNewline -ForegroundColor $C.Accent
Write-Host "  -  Deploy to GitHub Pages" -ForegroundColor $C.Title
Write-Host "  =============================================================" -ForegroundColor $C.Banner
Write-Host "    Path    $PSScriptRoot" -ForegroundColor $C.Dim
Write-Host "    Target  $Repo" -ForegroundColor $C.Dim
Write-Host "    Branch  $Branch" -ForegroundColor $C.Dim
if ($DryRun) {
	Write-Host "    Mode    DRY RUN - nothing will be pushed" -ForegroundColor $C.Warn
}
elseif ($NoBuild) {
	Write-Host "    Mode    Package existing dist" -ForegroundColor $C.Value
}
elseif ($KeepCache) {
	Write-Host "    Mode    Build (incremental)" -ForegroundColor $C.Value
}
else {
	Write-Host "    Mode    Build (clean)" -ForegroundColor $C.Value
}
Write-Host "  "

# ------------------------------------------------------------------
# 1. Tool check
# ------------------------------------------------------------------
Step "Checking tools"

try {
	$gitVersion = (& git --version) 2>&1
	Ok "git $gitVersion"
}
catch {
	Exit-With 1 "git not found on PATH"
}

$gcm = Join-Path $env:ProgramFiles "Git\mingw64\bin\git-credential-manager.exe"
if (-not (Test-Path $gcm)) {
	$gcmCmd = Get-Command git-credential-manager -ErrorAction SilentlyContinue
	if ($gcmCmd) { $gcm = $gcmCmd.Source }
}
if (Test-Path $gcm) { Ok "credential manager found" }
else { Warn "credential manager not found at the usual place" }

$caBundle = Join-Path $env:ProgramFiles "Git\mingw64\etc\ssl\certs\ca-bundle.crt"
if (Test-Path $caBundle) { Ok "CA bundle found" }
else {
	Exit-With 1 "CA bundle missing: $caBundle"
}

# ------------------------------------------------------------------
# 2. Credentials (never printed)
# ------------------------------------------------------------------
# Two problems make git's own credential helper useless here:
#   - git shells out to sh.exe to run the helper, and sh.exe cannot create
#     its signal pipe, so the helper never answers.
#   - when a console IS attached, git-credential-manager pops up an account
#     chooser and waits forever for a human. Measured: it hangs past 20s.
# So the token comes from a local file the user controls. Nothing here can
# block on a dialog.
Step "Reading GitHub credentials"

$credUser = "11408-prog"
$credToken = $null
$tokenFile = Join-Path $PSScriptRoot ".deploy-token"

if ($Token) {
	$credToken = $Token.Trim()
	Ok "Token taken from -Token"
}
elseif (Test-Path $tokenFile) {
	$raw = (Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue)
	if ($raw) { $credToken = $raw.Trim() }
	if ($credToken) { Ok "Token read from .deploy-token" }
}

if (-not $credToken) {
	Warn "No token found"
	Info "Create one at https://github.com/settings/tokens with the repo scope,"
	Info "paste it into $tokenFile, then run this script again."
	Info "The token must stay on its own line, nothing else in the file."
	Exit-With 1 "Cannot authenticate without a token"
}

# A classic token starts with ghp_, a fine-grained one with github_pat_.
# Anything else means a stale file or a typo, which would fail with a cryptic
# 403 much later in the run.
if ($credToken -notmatch '^(ghp_|github_pat_|gho_|ghs_)') {
	Warn "The token does not look like a GitHub token (unexpected prefix)"
	Info "Expected something starting with ghp_ or github_pat_"
	Exit-With 1 "Refusing to use a malformed token"
}

Ok "Token loaded ($($credToken.Length) chars, never printed or written)"

$authHeader = "AUTHORIZATION: basic " + [Convert]::ToBase64String(
	[Text.Encoding]::UTF8.GetBytes("${credUser}:${credToken}"))

# Every git call that touches the network needs these four overrides.
$remoteTip = ""
$GitNet = @(
	"-c", "http.sslBackend=openssl",
	"-c", "http.sslVerify=true",
	"-c", "http.sslCAInfo=$($caBundle -replace '\\','/')",
	"-c", "http.https://github.com/.extraheader=$authHeader",
	"-c", "credential.helper="
)

Write-Host "             testing connectivity" -NoNewline -ForegroundColor $C.Dim
$remote = & git @GitNet ls-remote --heads $Repo 2>&1
if ($LASTEXITCODE -eq 0) {
	Write-Host "  ok" -ForegroundColor $C.Ok
	$remoteBranches = @($remote | ForEach-Object { ($_ -split "\s+")[1] })
	$remoteTip = ""
	foreach ($ln in @($remote)) {
		if ("$ln" -match "^([0-9a-f]{40})\s+refs/heads/$([regex]::Escape($Branch))$") { $remoteTip = $Matches[1] }
	}
	if ($remoteBranches -contains "refs/heads/$Branch") { Ok "Remote branch $Branch exists, it will be replaced" }
	else { Ok "Remote branch $Branch does not exist, it will be created" }
}
else {
	Write-Host "  failed" -ForegroundColor $C.Err
	Write-Host ($remote | Out-String).Trim() -ForegroundColor $C.Err
	Exit-With 1 "Cannot reach the remote repository"
}

# ------------------------------------------------------------------
# 3. Free ports
# ------------------------------------------------------------------
# A running dev server shares node_modules/.vite with the build and breaks it.
Step "Checking ports"

foreach ($p in @(3000)) {
	$conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
	if ($conns) {
		foreach ($procId in ($conns.OwningProcess | Sort-Object -Unique)) {
			$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
			if ($proc) {
				Warn "Port $p held by $($proc.ProcessName) (PID $procId), stopping it"
				Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
				Start-Sleep -Seconds 1
			}
		}
	}
	else {
		Ok "Port $p is free"
	}
}

# ------------------------------------------------------------------
# 4. Clean
# ------------------------------------------------------------------
if ($NoBuild) {
	Step "Cleanup skipped"
	Info "Publishing the dist that is already there"
}
elseif ($KeepCache) {
	Step "Cleaning build scratch only"
	Remove-Item -Recurse -Force (Join-Path $DistDir ".prerender") -ErrorAction SilentlyContinue
	Warn "Image cache kept; replaced images may still be stale"
}
else {
	Step "Cleaning previous output"
	Remove-Item -Recurse -Force $DistDir -ErrorAction SilentlyContinue
	# The image cache is what makes a replaced picture stay old forever.
	Remove-Item -Recurse -Force (Join-Path $PSScriptRoot "node_modules\.astro") -ErrorAction SilentlyContinue
	Ok "Removed dist and node_modules\.astro"
}

# ------------------------------------------------------------------
# 5. Build
# ------------------------------------------------------------------
if (-not $NoBuild) {
	Step "Building (about a minute)"

	$logFile = Join-Path $PSScriptRoot "build.log"
	Remove-Item -Force $logFile -ErrorAction SilentlyContinue

	# Route through cmd so notes Astro writes to stderr stay plain text.
	cmd /c "node node_modules/astro/bin/astro.mjs build 2>&1" | Tee-Object -FilePath $logFile
	$exitCode = $LASTEXITCODE

	if ($exitCode -ne 0) {
		Info "Full log: $logFile"
		Exit-With 1 "Build failed with exit code $exitCode"
	}
	if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
		Exit-With 1 "Build reported success but dist\index.html is missing"
	}
	Ok "Build succeeded"

	$logText = ""
	if (Test-Path $logFile) { $logText = Get-Content $logFile -Raw }
	$reused = ([regex]::Matches($logText, "reused cache entry")).Count
	$regenerated = ([regex]::Matches($logText, "after:")).Count
	if ($regenerated -gt 0) { Ok "Images regenerated: $regenerated" }
	if ($reused -gt 0) { Warn "$reused image(s) came from the old cache - rerun without -KeepCache if you swapped a picture" }
}
else {
	Step "Build skipped"
}

# ------------------------------------------------------------------
# 6. Search index
# ------------------------------------------------------------------
# The site's search needs the pagefind index. It is not part of `astro build`;
# it is a separate step in the npm build chain that we cannot call directly.
Step "Building the search index"

$pagefindCmd = Join-Path $PSScriptRoot "node_modules\.bin\pagefind.cmd"
$pagefindOut = Join-Path $DistDir "pagefind"
if (Test-Path $pagefindCmd) {
	cmd /c "`"$pagefindCmd`" --site dist 2>&1" | Select-Object -Last 8
	if ((Test-Path $pagefindOut) -and (Get-ChildItem $pagefindOut -Recurse -File -ErrorAction SilentlyContinue)) {
		Ok "Search index created"
	}
	else {
		Warn "pagefind finished but produced no index"
		Info "The site still publishes; only the search box stays empty"
	}
}
else {
	Warn "pagefind not installed, skipping"
	Info "Run: pnpm install   (or pnpm add -D pagefind) to enable search"
}

# ------------------------------------------------------------------
# 7. Verify the output
# ------------------------------------------------------------------
Step "Verifying the build output"

if (-not (Test-Path (Join-Path $DistDir "index.html"))) {
	Exit-With 1 "dist\index.html is missing"
}

# This one has taken the whole site down before: Astro prefixes its assets with
# the base path taken from siteConfig.siteURL, so a bare /_astro reference means
# the base was lost and the pages will 404 their own stylesheet.
$indexHtml = Get-Content (Join-Path $DistDir "index.html") -Raw
$based = ([regex]::Matches($indexHtml, '"/azur_blog/')).Count
$bare = ([regex]::Matches($indexHtml, '(?:href|src)="/_astro/')).Count
if ($bare -gt 0) {
	Warn "$bare asset reference(s) lack the /azur_blog base prefix"
	Info "Check siteConfig.siteURL; the site may render unstyled"
}
if ($based -gt 0) { Ok "Base path /azur_blog present ($based references)" }

# Jekyll drops underscore directories, so Pages would serve a site whose CSS and
# JS are 404. .nojekyll is what stops that.
$nojekyll = Join-Path $DistDir ".nojekyll"
if (-not (Test-Path $nojekyll)) {
	New-Item -ItemType File -Path $nojekyll -Force -ErrorAction SilentlyContinue | Out-Null
}
if (Test-Path $nojekyll) { Ok ".nojekyll present" }
else { Warn ".nojekyll missing from dist - it will be added to the publish tree instead" }

$astroCount = (Get-ChildItem (Join-Path $DistDir "_astro") -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
if ($astroCount -lt 50) { Exit-With 1 "_astro holds only $astroCount files - the bundle looks broken" }
Ok "_astro holds $astroCount files"

$pageCount = (Get-ChildItem $DistDir -Recurse -Filter *.html -ErrorAction SilentlyContinue | Measure-Object).Count
$postCount = (Get-ChildItem (Join-Path $DistDir "posts") -Recurse -Filter *.html -ErrorAction SilentlyContinue | Measure-Object).Count
Ok "$pageCount pages, $postCount post pages"

if (-not (Get-ChildItem (Join-Path $DistDir "music") -Filter *.mp3 -ErrorAction SilentlyContinue)) {
	Warn "No mp3 under dist\music - the player will be silent"
	Info "Run: node scripts/sync-music.mjs"
}
else {
	$mp3 = Get-ChildItem (Join-Path $DistDir "music") -Filter *.mp3
	Ok "$($mp3.Count) tracks, $(Format-MB (($mp3 | Measure-Object Length -Sum).Sum))"
}

# ------------------------------------------------------------------
# 8. Stage the publish tree
# ------------------------------------------------------------------
Step "Staging the publish tree"

# .publish-git holds hundreds of MB of history. If git did not ignore it, the
# 'git add -A' in auto-deploy.cmd would pull all of it into the source repo.
& git check-ignore -q ".publish-git" 2>$null
if ($LASTEXITCODE -eq 1) {
	Exit-With 1 ".publish-git is not git-ignored. Add a line '.publish-git' to .gitignore, then run again."
}

# Publish history lives in .publish-git, outside .publish, so .publish can be
# wiped and rebuilt on every run while git still remembers what it uploaded last
# time. That memory is what makes later pushes incremental.
$legacyGit = Join-Path $PubDir ".git"
if (-not (Test-Path (Join-Path $GitDir "HEAD")) -and (Test-Path (Join-Path $legacyGit "HEAD"))) {
	if (Test-Path $GitDir) { Remove-Item -Recurse -Force $GitDir -ErrorAction SilentlyContinue }
	Move-Item $legacyGit $GitDir
	Ok "Adopted the publish history left behind by the previous script version"
}
if ($Fresh -and (Test-Path $GitDir)) {
	Remove-Item -Recurse -Force $GitDir -ErrorAction SilentlyContinue
	Info "-Fresh: saved publish history discarded"
}

if (Test-Path $PubDir) {
	Remove-Item -Recurse -Force $PubDir -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $PubDir -Force | Out-Null
Copy-Item (Join-Path $DistDir "*") -Destination $PubDir -Recurse -Force -ErrorAction SilentlyContinue
if (-not (Test-Path (Join-Path $PubDir "index.html"))) {
	Exit-With 1 "Copying dist into .publish failed - check free space and antivirus"
}
Ok "Copied dist to .publish"

# .nojekyll has to exist in the published root. Creating it here rather than in
# dist keeps this working even when dist refuses a new file.
$pubNojekyll = Join-Path $PubDir ".nojekyll"
if (-not (Test-Path $pubNojekyll)) {
	New-Item -ItemType File -Path $pubNojekyll -Force -ErrorAction SilentlyContinue | Out-Null
}
if (Test-Path $pubNojekyll) { Ok ".nojekyll present in the publish tree" }
else { Exit-With 1 "Cannot create .nojekyll - GitHub Pages would strip _astro" }

# Four songs ship with the template and nothing on the site refers to them:
# no HTML, JS or CSS under dist mentions /assets/music at all. They only make
# the push 20 MB heavier, so they do not go out.
$junkDirs = @(
	(Join-Path $PubDir "assets\music")
)
$dropped = 0
foreach ($junk in $junkDirs) {
	if (Test-Path $junk) {
		$size = Get-TreeSize $junk
		Remove-Item -Recurse -Force $junk -ErrorAction SilentlyContinue
		$dropped += $size
		Info "Skipped template leftovers: $([IO.Path]::GetFileName((Split-Path $junk -Parent)))\$([IO.Path]::GetFileName($junk)) ($(Format-MB $size))"
	}
}
if ($dropped -gt 0) { Ok "Publish tree trimmed by $(Format-MB $dropped)" }
else { Ok "Nothing to trim" }

$pubSize = Get-TreeSize $PubDir
$pubFiles = (Get-ChildItem $PubDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
Ok "Publish tree: $pubFiles files, $(Format-MB $pubSize)"

$biggest = Get-ChildItem $PubDir -Recurse -File | Sort-Object Length -Descending | Select-Object -First 1
if ($biggest) {
	$bigMB = [math]::Round($biggest.Length / 1MB, 1)
	if ($bigMB -gt 50) {
		Warn "Largest file is $bigMB MB ($($biggest.Name)); GitHub warns above 50 MB and refuses above 100 MB"
	}
	else {
		Ok "Largest file is $bigMB MB, well under the 50 MB warning line"
	}
}

# ------------------------------------------------------------------
# 9. Commit
# ------------------------------------------------------------------
Step "Creating the deployment commit"

# Every call that touches the publish history. Line endings and file modes are
# pinned so a file that did not change always hashes to the same object.
$GitLocal = @(
	"-c", "core.autocrlf=false",
	"-c", "core.safecrlf=false",
	"-c", "core.filemode=false",
	"-c", "user.name=11408-prog",
	"-c", "user.email=3036248429@qq.com",
	"--git-dir=$GitDir",
	"--work-tree=$PubDir"
)

$firstDeploy = -not (Test-Path (Join-Path $GitDir "HEAD"))
if ($firstDeploy) {
	& git @GitLocal init -q 2>&1 | Out-Null
}
# Works on an empty repository too, unlike 'git checkout -B'.
& git @GitLocal symbolic-ref HEAD "refs/heads/$Branch" 2>&1 | Out-Null

& git @GitLocal add -A 2>&1 | Out-Null
$pending = @(& git @GitLocal status --porcelain 2>&1)
& git @GitLocal rev-parse --verify -q HEAD 2>&1 | Out-Null
$hasHead = ($LASTEXITCODE -eq 0)

$nothingToPush = $false
if ($hasHead -and $pending.Count -eq 0) {
	$headSha = ("" + (& git @GitLocal rev-parse HEAD 2>&1)).Trim()
	if ($headSha -eq $remoteTip) {
		$nothingToPush = $true
		Ok "Nothing changed since the last deploy"
	}
	else {
		Info "No new changes, but the remote differs from the saved history; the saved commit will be pushed"
	}
}
else {
	$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
	& git @GitLocal commit -q -m "Deploy: $stamp" 2>&1 | Out-Null
}

$head = ("" + (& git @GitLocal rev-parse --short HEAD 2>&1)).Trim()
$tracked = @(& git @GitLocal ls-files 2>&1)
$commitCount = ("" + (& git @GitLocal rev-list --count HEAD 2>&1)).Trim()
Ok "Commit $head, $($tracked.Count) files tracked, $commitCount commit(s) of history"

# Say up front how much this push will really upload.
if ($firstDeploy) {
	Info "No saved history yet: this push uploads the whole site once ($(Format-MB $pubSize))"
}
elseif ($remoteTip) {
	& git @GitLocal cat-file -e "$($remoteTip)^{commit}" 2>&1 | Out-Null
	if ($LASTEXITCODE -eq 0) { Ok "Incremental push: only changed files will be uploaded" }
	else { Warn "The remote $Branch was changed outside this machine: the whole site will be uploaded once" }
}
if ([int]$commitCount -gt 100) {
	Info "History is $commitCount commits long. Run with -Fresh once in a while to squash it."
}

# ------------------------------------------------------------------
# 10. Push
# ------------------------------------------------------------------
if ($DryRun) {
	Step "DRY RUN - push skipped"
	Info "Everything is staged in .publish"
	Info "Remove -DryRun to actually publish"
	Write-Host "  "
	Rule
	Write-Host "    NOTHING WAS PUSHED" -ForegroundColor $C.Warn
	Rule
	Write-Host "  "
	exit 0
}

if ($nothingToPush) {
	Write-Host "  "
	Rule
	Write-Host "    NOTHING TO PUSH" -ForegroundColor $C.Ok
	Write-Host "    The live site already matches this build." -ForegroundColor $C.Dim
	Rule
	Write-Host "  "
	exit 0
}

if (-not $Force) {
	Write-Host "  "
	Write-Host "  This replaces the whole $Branch branch of the repository." -ForegroundColor $C.Warn
	Write-Host "  $pubFiles files, $(Format-MB $pubSize), will go live." -ForegroundColor $C.Warn
	Write-Host "  "
	$answer = Read-Host "  Type YES to publish"
	if ($answer -ne "YES") {
		Info "Cancelled. Nothing was pushed."
		exit 0
	}
}

Step "Pushing to $Branch"

# --force because this branch is owned by this script alone.
$pushArgs = @($GitNet) + @("--git-dir=$GitDir", "push", "--force", "--progress", $Repo, "HEAD:refs/heads/$Branch")
$pushCode = Invoke-GitPush $pushArgs

if ($pushCode -ne 0) {
	Info "Retrying with a bigger buffer and no compression in case the transfer timed out"
	$retryArgs = @($GitNet) + @("-c", "http.postBuffer=524288000", "-c", "core.compression=0", "--git-dir=$GitDir", "push", "--force", $Repo, "HEAD:refs/heads/$Branch")
	$pushCode = Invoke-GitPush $retryArgs
}

if ($pushCode -ne 0) {
	Exit-With 1 "Push failed. Run again with -NoBuild -Force to retry; files that are already live on GitHub are not uploaded again."
}

Ok "Pushed"

$remoteNow = & git @GitNet ls-remote --heads $Repo 2>&1 | Select-String "refs/heads/$Branch$"
Info ("Remote $Branch is now: " + ($remoteNow -split "\s+")[0])

# ------------------------------------------------------------------
# 11. What happens next
# ------------------------------------------------------------------
Write-Host "  "
Rule
Write-Host "    PUSHED    " -NoNewline -ForegroundColor $C.StepAlt
Write-Host "branch $Branch of $Repo" -ForegroundColor $C.Value
Write-Host "    LIVE AT   " -NoNewline -ForegroundColor $C.StepAlt
Write-Host "https://11408-prog.github.io/azur_blog/" -ForegroundColor $C.Accent
Write-Host "    WATCH     " -NoNewline -ForegroundColor $C.StepAlt
Write-Host "repo -> Actions -> pages build and deployment" -ForegroundColor $C.Dim
Write-Host "    TIMING    " -NoNewline -ForegroundColor $C.StepAlt
Write-Host "GitHub usually rebuilds within 1-2 minutes" -ForegroundColor $C.Dim
Rule
Write-Host "  "
Info "If the page still shows the old site after a few minutes, hard-refresh"
Info "with Ctrl+Shift+R - GitHub Pages sets a short cache on the HTML."
Write-Host "  "
