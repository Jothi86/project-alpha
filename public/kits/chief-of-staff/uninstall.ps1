# Removes the Chief of Staff bot from this PC: stops it, removes the scheduled
# task, and deletes the bot's folder (including its settings and logs).
# Your own files, and the name cards it filed in your documents, are not touched.
# Run: powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\ChiefOfStaff\uninstall.ps1"

$ErrorActionPreference = 'Stop'
$Dir = $PSScriptRoot
$TaskName = if ($env:COS_TASK_NAME) { $env:COS_TASK_NAME } else { 'ChiefOfStaffBot' }

$answer = Read-Host "Remove the bot and delete $Dir ? [y/N]"
if ($answer -notmatch '^[yY]') { Write-Host 'Nothing removed.'; return }

try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop } catch {}
try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}

# The wrapper's node process may outlive the task by a moment.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*$Dir*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false }

Set-Location $env:USERPROFILE
Remove-Item -Recurse -Force $Dir
Write-Host 'Removed. To delete the Telegram bot itself, send /deletebot to @BotFather.'
