# Chief of Staff bot: installer for Windows.
# Open PowerShell and run:
#   irm https://project-alpha-dlz.pages.dev/kits/chief-of-staff/install.ps1 | iex
#
# It installs what is missing (Node.js, Claude Code), asks for your Telegram bot
# token, sets the bot to start by itself, and opens Telegram to pair it with you.
# Running it again updates the bot and keeps your settings.
#
# Optional, for testing or unattended installs (environment variables):
#   COS_INSTALL_DIR  where to install (default: %USERPROFILE%\ChiefOfStaff)
#   COS_TASK_NAME    scheduled task name (default: ChiefOfStaffBot)
#   COS_KIT_SOURCE   a local copy of the kit to install from, instead of the website
#   COS_KIT_BASE     where to download the kit from (default: the project alpha site)
#   COS_KIT_KEY      access key, sent with every download (for paid kits)
#   COS_TOKEN, COS_GEMINI_KEY, COS_WORK_DIR  answers to the questions below

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is very slow with the progress bar on

$Base = if ($env:COS_KIT_BASE) { $env:COS_KIT_BASE } else { 'https://project-alpha-dlz.pages.dev/kits/chief-of-staff' }
$KitHeaders = @{}
if ($env:COS_KIT_KEY) { $KitHeaders['X-Kit-Key'] = $env:COS_KIT_KEY }
$Dir = if ($env:COS_INSTALL_DIR) { $env:COS_INSTALL_DIR } else { Join-Path $env:USERPROFILE 'ChiefOfStaff' }
$TaskName = if ($env:COS_TASK_NAME) { $env:COS_TASK_NAME } else { 'ChiefOfStaffBot' }

function Say($text) { Write-Host $text -ForegroundColor Cyan }
function Ok($text) { Write-Host "  OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  !   $text" -ForegroundColor Yellow }
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
        [Environment]::GetEnvironmentVariable('Path', 'User') + ';' +
        (Join-Path $env:USERPROFILE '.local\bin')
}
function Read-EnvFile($path) {
    $map = @{}
    if (Test-Path $path) {
        foreach ($line in [IO.File]::ReadAllLines($path)) {
            if ($line -match '^\s*([A-Z_]+)\s*=(.*)$') { $map[$Matches[1]] = $Matches[2].Trim() }
        }
    }
    return $map
}

Write-Host ''
Say 'Chief of Staff bot: setup'
Write-Host 'A private Telegram bot that answers you by running Claude on this PC.'
Write-Host ''

# --- 1. Node.js -------------------------------------------------------------

Say '1/6  Node.js'
Refresh-Path
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeOk = $false
if ($node) { $nodeOk = ([int]((& node --version) -replace '^v(\d+).*', '$1')) -ge 20 }
if (-not $nodeOk) {
    Write-Host '  Installing Node.js (you may be asked to agree to its terms)...'
    winget install -e --id OpenJS.NodeJS.LTS
    Refresh-Path
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js did not install. Install it from https://nodejs.org (LTS), then run this again.'
    }
}
Ok "Node.js $(& node --version)"

# --- 2. Claude Code ---------------------------------------------------------

Say '2/6  Claude Code'
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host '  Installing Claude Code...'
    Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
    Refresh-Path
    if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
        throw 'Claude Code did not install. See https://docs.claude.com/en/docs/claude-code/setup, then run this again.'
    }
}

function Test-ClaudeLogin {
    $out = & claude -p 'Reply with the single word OK.' --output-format json 2>$null
    return ($LASTEXITCODE -eq 0) -and ($out -match '"is_error"\s*:\s*false')
}
if (-not (Test-ClaudeLogin)) {
    Warn 'Claude needs you to sign in once (you need a Claude Pro or Max plan, or an API key).'
    Write-Host '  A Claude window will open. Sign in, then type /exit to come back here.'
    Read-Host '  Press Enter to open it'
    Start-Process -FilePath (Get-Command claude).Source -Wait
    if (-not (Test-ClaudeLogin)) { throw 'Claude still is not signed in. Run "claude" once, sign in, then run this again.' }
}
Ok 'Claude Code is installed and signed in'

# --- 3. The bot's files -----------------------------------------------------

Say "3/6  Bot files -> $Dir"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$wasRunning = $false
try { $wasRunning = (Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop).State -eq 'Running' } catch {}
if ($wasRunning) { Stop-ScheduledTask -TaskName $TaskName }

if ($env:COS_KIT_SOURCE) {
    $src = $env:COS_KIT_SOURCE
} else {
    # files.txt lists every file in the kit, one path per line.
    $src = Join-Path $env:TEMP 'chief-of-staff-kit'
    if (Test-Path $src) { Remove-Item -Recurse -Force $src }
    $list = (Invoke-WebRequest "$Base/files.txt" -Headers $KitHeaders -UseBasicParsing).Content
    foreach ($f in ($list -split "`r?`n" | Where-Object { $_.Trim() })) {
        $out = Join-Path $src ($f.Trim() -replace '/', '\')
        New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
        Invoke-WebRequest "$Base/$($f.Trim())" -Headers $KitHeaders -OutFile $out -UseBasicParsing
    }
}
# Your settings (.env) and logs are never overwritten.
Get-ChildItem $src -Force | Where-Object { $_.Name -notin @('.env', 'logs', '.git') } |
    Copy-Item -Destination $Dir -Recurse -Force
Ok 'Files in place'

$envFile = Join-Path $Dir '.env'
$current = Read-EnvFile $envFile

# --- 4. Telegram bot token ---------------------------------------------------

Say '4/6  Your Telegram bot'
$token = $env:COS_TOKEN
if (-not $token -and $current['TELEGRAM_BOT_TOKEN']) {
    $keep = Read-Host '  Keep the bot you set up last time? [Y/n]'
    if ($keep -notmatch '^[nN]') { $token = $current['TELEGRAM_BOT_TOKEN'] }
}
if (-not $token) {
    Write-Host '  Make a bot in Telegram: message @BotFather, send /newbot, pick a name.'
    Write-Host '  It replies with a token like 123456789:ABC... Copy it.'
    Start-Process 'https://t.me/BotFather'
}
$bot = $null
while (-not $bot) {
    if (-not $token) { $token = (Read-Host '  Paste the token here').Trim() }
    try {
        $bot = (Invoke-RestMethod "https://api.telegram.org/bot$token/getMe").result
    } catch {
        Warn 'Telegram did not accept that token. Copy it again from @BotFather.'
        $token = $null
        if ($env:COS_TOKEN) { throw 'COS_TOKEN was not accepted by Telegram.' }
    }
}
Ok "Bot @$($bot.username)"

# --- 5. Name cards (optional) and the folder Claude may read ------------------

Say '5/6  Settings'
$gemini = $env:COS_GEMINI_KEY
if (-not $gemini) { $gemini = $current['GEMINI_API_KEY'] }
if (-not $gemini -and -not $env:COS_TOKEN) {
    Write-Host '  Optional: to read name card photos, get a free Gemini key at'
    Write-Host '  https://aistudio.google.com/apikey (Create API key, then copy it).'
    $gemini = (Read-Host '  Paste it here, or press Enter to skip').Trim()
}
if ($gemini) {
    try {
        Invoke-RestMethod 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' -Headers @{ 'x-goog-api-key' = $gemini } | Out-Null
        Ok 'Name cards: on'
    } catch {
        Warn 'Google did not accept that Gemini key. Name cards stay off; add it to .env later.'
        $gemini = ''
    }
} else { Warn 'Name cards: off (add GEMINI_API_KEY to .env later)' }

$defaultWork = if ($current['COS_WORK_DIR']) { $current['COS_WORK_DIR'] } else { [Environment]::GetFolderPath('MyDocuments') }
$work = $env:COS_WORK_DIR
if (-not $work -and -not $env:COS_TOKEN) {
    Write-Host '  Claude can read files in one folder (and everything inside it).'
    $work = (Read-Host "  Which folder? Press Enter for $defaultWork").Trim('"', ' ')
}
if (-not $work) { $work = $defaultWork }
if (-not (Test-Path $work -PathType Container)) { throw "Folder not found: $work" }
Ok "Claude reads: $work"

# Same bot as before and already paired: keep the owner. Otherwise pair again.
$owner = if ($token -eq $current['TELEGRAM_BOT_TOKEN']) { $current['COS_ALLOWED_CHAT'] } else { '' }
$pair = -join ((1..12) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })

$lines = @(
    "TELEGRAM_BOT_TOKEN=$token",
    "COS_WORK_DIR=$work",
    "GEMINI_API_KEY=$gemini"
)
if ($owner) { $lines += "COS_ALLOWED_CHAT=$owner" } else { $lines += "COS_PAIR_CODE=$pair" }
# Keep anything else from the old file (Google Contacts keys, custom settings).
$managed = 'TELEGRAM_BOT_TOKEN', 'COS_WORK_DIR', 'GEMINI_API_KEY', 'COS_ALLOWED_CHAT', 'COS_PAIR_CODE'
foreach ($k in $current.Keys) { if ($k -notin $managed) { $lines += "$k=$($current[$k])" } }
# UTF-8 without a BOM, so the first setting reads cleanly.
[IO.File]::WriteAllText($envFile, ($lines -join "`r`n") + "`r`n", (New-Object Text.UTF8Encoding $false))
Ok 'Settings saved'

# --- 6. Start it, and pair it with you --------------------------------------

Say '6/6  Starting the bot'
& (Join-Path $Dir 'task\register-task.ps1') -Name $TaskName | Out-Null
Start-ScheduledTask -TaskName $TaskName
Ok "Runs by itself at every logon (scheduled task '$TaskName')"

if ($owner) {
    Write-Host ''
    Say "Done. @$($bot.username) is running and still paired with you."
    return
}

$link = "https://t.me/$($bot.username)?start=$pair"
Write-Host ''
Say 'Last step: Telegram is opening. Press START in the chat with your bot.'
Write-Host "  (If it does not open, go to $link on your phone.)"
Start-Process $link

$paired = $false
for ($i = 0; $i -lt 90 -and -not $paired; $i++) {
    Start-Sleep -Seconds 2
    $paired = [bool](Read-EnvFile $envFile)['COS_ALLOWED_CHAT']
}
Write-Host ''
if ($paired) {
    Say "Done. @$($bot.username) is yours. Message it from your phone anytime this PC is on."
} else {
    Warn "Not paired yet. Open $link and press START; the bot is waiting for you."
}
