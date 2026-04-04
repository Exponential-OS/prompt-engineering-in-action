<#
.SYNOPSIS
Co-Dialectic Manager for Windows.
#>
param(
    [switch]$BgCheck
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"
$Version = "2.1.0"
$ConfigDir = Join-Path $env:USERPROFILE ".co-dialectic"

# -----------------------------------------
# BACKGROUND CHECKER
# -----------------------------------------
if ($BgCheck) {
    if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null }
    
    try {
        $RemoteContent = Invoke-RestMethod -Uri "$RepoUrl/plugins/co-dialectic/skills/co-dialectic/SKILL.md"
        $RemoteVersion = ""
        if ($RemoteContent -match "\*\*Version:\*\* ([^\r\n]+)") {
            $RemoteVersion = $matches[1]
        }
        
        $LocalVersion = ""
        $VersionFile = Join-Path $ConfigDir "version.txt"
        if (Test-Path $VersionFile) { $LocalVersion = Get-Content $VersionFile }
        
        if (($RemoteVersion -ne "") -and ($RemoteVersion -ne $LocalVersion)) {
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.MessageBox]::Show("A new version of Co-Dialectic ($RemoteVersion) is available! Run the installer PowerShell script to update.", "Co-Dialectic Update", "OK", "Information")
        }
    } catch {}
    exit 0
}

# -----------------------------------------
# UI HELPERS
# -----------------------------------------
Write-Host "🧠 Co-Dialectic Manager (v$Version)" -ForegroundColor Cyan
Write-Host "=================================="
Write-Host ""

function Ask-User {
    param([string]$PromptText, [string]$DefaultValue)
    $Choice = Read-Host "$PromptText"
    if ([string]::IsNullOrWhiteSpace($Choice)) { $Choice = $DefaultValue }
    if ($Choice -match "^[Yy]") { return $true }
    return $false
}

function Ask-Choice {
    param([string]$PromptText, [string]$DefaultValue)
    $Choice = Read-Host "$PromptText"
    if ([string]::IsNullOrWhiteSpace($Choice)) { return $DefaultValue }
    return $Choice
}

# -----------------------------------------
# MAIN MENU
# -----------------------------------------
Write-Host "What would you like to do?"
Write-Host " [1] Install or Update"
Write-Host " [2] Uninstall completely"
Write-Host " [3] Exit"
$MenuChoice = Ask-Choice "Select [1, 2, or 3]" "1"

if ($MenuChoice -eq "3") { exit 0 }

# -----------------------------------------
# UNINSTALL LOGIC
# -----------------------------------------
if ($MenuChoice -eq "2") {
    Write-Host "🗑️ Uninstalling Co-Dialectic..." -ForegroundColor Yellow
    
    # Remove Scheduled Task
    $TaskExists = Get-ScheduledTask -TaskName "CoDialecticUpdater" -ErrorAction SilentlyContinue
    if ($TaskExists) {
        Unregister-ScheduledTask -TaskName "CoDialecticUpdater" -Confirm:$false
        Write-Host "   Removed Windows Scheduled Task background updater."
    }
    
    # Remove configs
    $Targets = @(".cursorrules", ".windsurfrules", ".clinerules", ".roomodes", ".aider.instructions.md")
    foreach ($T in $Targets) {
        if (Test-Path $T) {
            $HasBlock = Select-String -Path $T -Pattern "### BEGIN CO-DIALECTIC ###" -Quiet
            if ($HasBlock) {
                $Content = Get-Content $T -Raw
                $Content = $Content -replace '(?s)### BEGIN CO-DIALECTIC ###.*?### END CO-DIALECTIC ###\s*', ''
                Set-Content -Path $T -Value $Content -Encoding UTF8
                Write-Host "   Removed from $T"
            }
        }
    }
    
    # Remove Folders
    $Dirs = @(
        (Join-Path $env:USERPROFILE ".claude\skills\co-dialectic"),
        (Join-Path $env:USERPROFILE ".gemini\antigravity\skills\co-dialectic"),
        $ConfigDir
    )
    foreach ($D in $Dirs) {
        if (Test-Path $D) {
            Remove-Item -Recurse -Force $D
            Write-Host "   Deleted $D"
        }
    }
    
    Write-Host "✅ Successfully uninstalled." -ForegroundColor Green
    exit 0
}

# -----------------------------------------
# INSTALL LOGIC
# -----------------------------------------
Write-Host "Which version do you want to install?"
Write-Host " [1] Standard (Best for Pro/Paid AI users)"
Write-Host " [2] Lite (Best for Free/Fast AI limits)"
$VersionChoice = Ask-Choice "Select [1/2]" "1"

$SelectedVerStr = "full"
if ($VersionChoice -eq "2") {
    $SkillUrl = "$RepoUrl/plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md"
    $SelectedVerStr = "lite"
    Write-Host "⬇️  Downloading Lite version..." -ForegroundColor Yellow
} else {
    $SkillUrl = "$RepoUrl/plugins/co-dialectic/skills/co-dialectic/SKILL.md"
    Write-Host "⬇️  Downloading Standard version..." -ForegroundColor Yellow
}

try {
    $SkillContent = Invoke-RestMethod -Uri $SkillUrl
} catch {
    Write-Host "Failed to download SKILL.md" -ForegroundColor Red
    exit 1
}

$TrackOptIn = Ask-User "📊 Share anonymous install metrics to help the project (OS/Tool choices)? [Y/n]" "y"
$BgUpdates = Ask-User "🔄 Enable weekly background checks for updates via Scheduled Tasks? [Y/n]" "y"

$Installed = $false
$InstalledTools = @()

function Append-Or-Replace {
    param([string]$TargetFile, [string]$PromptMsg, [string]$DefaultAns, [string]$ToolName)
    
    $FileExists = Test-Path $TargetFile
    $HasBlock = $false
    $HasLegacy = $false

    if ($FileExists) {
        $HasBlock = (Select-String -Path $TargetFile -Pattern "### BEGIN CO-DIALECTIC ###" -Quiet)
        $HasLegacy = (Select-String -Path $TargetFile -Pattern "# Co-Dialectic" -Quiet)
    }

    if ($HasLegacy -and -not $HasBlock) {
        Write-Host "   ⚠️  Found an older v1/v2.0 installation in $TargetFile without safe-update markers." -ForegroundColor Yellow
        Write-Host "   ⚠️  To upgrade cleanly, please manually delete the old text from this file once." -ForegroundColor Yellow
        Write-Host "   ⚠️  Skipping this file to prevent duplicates." -ForegroundColor Yellow
        return
    }

    if ($HasBlock) {
        if (Ask-User "🔄 Co-Dialectic already in $TargetFile. Update it? (Overwrites manual edits in block) [Y/n]" "y") {
            $Content = Get-Content $TargetFile -Raw
            $Content = $Content -replace '(?s)### BEGIN CO-DIALECTIC ###.*?### END CO-DIALECTIC ###\s*', ''
            Set-Content -Path $TargetFile -Value $Content -Encoding UTF8
            Add-Content -Path $TargetFile -Value "`n$SkillContent" -Encoding UTF8
            Write-Host "   ✅ Updated $TargetFile" -ForegroundColor Green
            $script:Installed = $true
            $script:InstalledTools += $ToolName
        }
    } else {
        if (Ask-User $PromptMsg $DefaultAns) {
            Add-Content -Path $TargetFile -Value "`n$SkillContent" -Encoding UTF8
            Write-Host "   ✅ Added to $TargetFile" -ForegroundColor Green
            $script:Installed = $true
            $script:InstalledTools += $ToolName
        }
    }
}

Write-Host ""
Write-Host "Scanning for AI environments..."
Write-Host ""

# 1. Antigravity Support
$AntigravityPath = Join-Path $env:USERPROFILE ".gemini\antigravity\skills"
if (Test-Path $AntigravityPath) {
    $Target = Join-Path $AntigravityPath "co-dialectic\SKILL.md"
    if (-not (Test-Path (Split-Path $Target))) { New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null }
    Append-Or-Replace $Target "✅ Detected Antigravity. Install here? [Y/n]" "y" "antigravity"
    Write-Host ""
}

# 2. Claude Code Support
$ClaudePath = Join-Path $env:USERPROFILE ".claude"
if (Test-Path $ClaudePath) {
    $Target = Join-Path $ClaudePath "skills\co-dialectic\SKILL.md"
    if (-not (Test-Path (Split-Path $Target))) { New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null }
    Append-Or-Replace $Target "✅ Detected Claude Code. Install here? [Y/n]" "y" "claude_code"
    Write-Host ""
}

# 3. Cursor Support
if ((Test-Path ".cursor") -or (Test-Path ".cursorrules")) {
    Append-Or-Replace ".cursorrules" "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y" "cursor"
    Write-Host ""
}

Append-Or-Replace ".windsurfrules" "❓ Add to Windsurf workspace (.windsurfrules)? [y/N]" "n" "windsurf"
Append-Or-Replace ".clinerules" "❓ Add to Cline CLI (.clinerules)? [y/N]" "n" "cline"
Append-Or-Replace ".roomodes" "❓ Add to Roo Code (.roomodes)? [y/N]" "n" "roo"
Append-Or-Replace ".aider.instructions.md" "❓ Add to Aider (.aider.instructions.md)? [y/N]" "n" "aider"

# 8. Clipboard Integration
if (Ask-User "📋 Copy instructions to clipboard for web/desktop apps? [y/N]" "n") {
    Set-Clipboard -Value $SkillContent
    Write-Host "   Copied to clipboard!" -ForegroundColor Green
    $Installed = $true
    $InstalledTools += "clipboard"
    Write-Host ""
}

if (-not $Installed) {
    Write-Host "ℹ️  No installation selected. Downloading SKILL.md to current directory..."
    if (-not (Test-Path "plugins\co-dialectic\skills\co-dialectic")) { New-Item -ItemType Directory -Force -Path "plugins\co-dialectic\skills\co-dialectic" | Out-Null }
    $SkillContent | Set-Content -Path "plugins\co-dialectic\skills\co-dialectic\SKILL.md" -Encoding UTF8
    Write-Host "   Downloaded to: .\plugins\co-dialectic\skills\co-dialectic\SKILL.md"
    $InstalledTools += "standalone"
}

# Apply Background Checks
if ($BgUpdates) {
    try {
        $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command ""Invoke-RestMethod https://thewhyman.gateway.scarf.sh/install.ps1 | Invoke-Expression -ArgumentList '-BgCheck'"""
        $Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
        Register-ScheduledTask -TaskName "CoDialecticUpdater" -Action $Action -Trigger $Trigger -RunLevel Highest -Force | Out-Null
        Write-Host "⏰ Windows Scheduled Task background updater installed (checks weekly)."
    } catch {
        Write-Host "⚠️ Could not register Scheduled Task. Run as Administrator if required." -ForegroundColor Yellow
    }
}

# Save Config
if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null }
$Version | Set-Content -Path (Join-Path $ConfigDir "version.txt")

# Apply Telemetry
$ToolsStr = $InstalledTools -join ","
if ($TrackOptIn) {
    $TelemetryUrl = "https://static.scarf.sh/a.png?x-pxid=dad54773-1711-4acf-bc86-b4fd4c5415b1&version=$SelectedVerStr&tools=$ToolsStr&os=windows"
    try {
        Invoke-RestMethod -Uri $TelemetryUrl -TimeoutSec 3 | Out-Null
    } catch {}
}

Write-Host ""
Write-Host "🎉 Done! Co-Dialectic is ready." -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: You MUST start a completely new chat/session for the instructions to take effect." -ForegroundColor Yellow
Write-Host "   Updates: run this script again anytime to update safely."
Write-Host ""
