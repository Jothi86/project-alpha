# Keep-alive wrapper for the chief-of-staff Telegram bot.
# Runs chief-of-staff.mjs forever: if node exits for any reason, wait and restart.
# Started automatically at logon by the scheduled task the installer registers.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$logDir = Join-Path $root 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'bot.log'

function Write-Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $log -Value $line -Encoding utf8
}

# Only one copy of this bot at a time, no matter how the wrapper was started.
# Named after the folder, so two bots in two folders don't block each other.
$sha = [System.Security.Cryptography.SHA256]::Create()
$tag = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLower())) | Select-Object -First 6 | ForEach-Object { $_.ToString('x2') })
$mutex = New-Object System.Threading.Mutex($false, "Global\ChiefOfStaff-$tag")
if (-not $mutex.WaitOne(0)) {
    Write-Log 'Another instance is already running. Exiting.'
    exit 0
}

# Find node.
$node = $env:COS_NODE_BIN
if (-not $node) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) {
    Write-Log "node.exe not found at '$node'. Set COS_NODE_BIN or install Node."
    exit 1
}

Write-Log "Wrapper started. node=$node"

$delay = 5          # seconds before the next restart
$maxDelay = 300     # backs off to 5 minutes if it keeps dying
$lastStart = Get-Date

while ($true) {
    # Trim the log if it grows past ~5 MB.
    if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) {
        $keep = Get-Content $log -Tail 1000
        Set-Content -Path $log -Value $keep -Encoding utf8
        Write-Log 'Log trimmed to last 1000 lines.'
    }

    $lastStart = Get-Date
    Write-Log 'Starting chief-of-staff.mjs'

    # Append through cmd so node's output lands as raw UTF-8 bytes.
    # PowerShell 5.1's own >> would re-encode the whole stream as UTF-16.
    $mjs = Join-Path $root 'chief-of-staff.mjs'
    & cmd /c "`"$node`" `"$mjs`" >> `"$log`" 2>&1"
    $code = $LASTEXITCODE

    $ranFor = ((Get-Date) - $lastStart).TotalSeconds
    Write-Log ("Exited with code {0} after {1:N0}s." -f $code, $ranFor)

    # Ran fine for a while => treat this as a one-off blip and retry fast.
    if ($ranFor -gt 120) { $delay = 5 } else { $delay = [Math]::Min($delay * 2, $maxDelay) }

    Write-Log "Restarting in ${delay}s."
    Start-Sleep -Seconds $delay
}
