<#
.SYNOPSIS
Co-Dialectic Manager for Windows.
#>
param(
    [switch]$BgCheck,
    [ValidateSet("auto", "cursor", "codex", "all")]
    [string]$Target = "auto",
    [switch]$Lite,
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$RepoUrl = if ($env:CO_DIALECTIC_REPO) { $env:CO_DIALECTIC_REPO } else { "https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main" }
$Version = "3.0.0"
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

function Get-RepoFileContent {
    param([string]$SourceUrl)

    if (Test-Path $SourceUrl) {
        return Get-Content $SourceUrl -Raw
    }

    if ($SourceUrl.StartsWith("$RepoUrl/")) {
        $LocalPath = $SourceUrl.Substring($RepoUrl.Length + 1) -replace '/', [IO.Path]::DirectorySeparatorChar
        if (Test-Path $LocalPath) {
            return Get-Content $LocalPath -Raw
        }
        if ($PSScriptRoot) {
            $ScriptRelativePath = Join-Path $PSScriptRoot $LocalPath
            if (Test-Path $ScriptRelativePath) {
                return Get-Content $ScriptRelativePath -Raw
            }
        }

        if ($LocalPath -eq ("plugins/co-dialectic/adapters/cursor/co-dialectic.mdc" -replace '/', [IO.Path]::DirectorySeparatorChar)) {
            return Get-CursorAdapterContent
        }
        if ($LocalPath -eq ("plugins/co-dialectic/adapters/codex/AGENTS.md" -replace '/', [IO.Path]::DirectorySeparatorChar)) {
            return Get-CodexAdapterContent
        }
    }

    return Invoke-RestMethod -Uri $SourceUrl
}

function Get-CursorAdapterContent {
    return @'
---
description: Co-Dialectic prompt sharpening and verification rules for Cursor
alwaysApply: true
---

### BEGIN CO-DIALECTIC ###
# Co-Dialectic for Cursor

Co-Dialectic is always active in this workspace. Keep the behavior compact and code-focused.

## Runtime Defaults
- Default to Cruise mode: answer directly unless the user's prompt is ambiguous enough that a wrong implementation is likely.
- Keep status metadata quiet by default. Do not prepend persona/score lines unless the user asks for `codi status`.
- Prefer short, actionable prompt sharpening over teaching. If the user's ask is unclear, rewrite the ask in one sentence, state the assumption, and proceed when the assumption is low-risk.
- Use Drive mode only when the next step would change architecture, delete data, publish externally, or spend money.

## Cursor Coding Behavior
- Read the relevant files before editing.
- Preserve user changes. Do not revert unrelated edits.
- Keep patches scoped to the requested behavior.
- Prefer existing project patterns and libraries over new abstractions.
- Run focused validation when available, and report what did or did not run.
- For reviews, lead with defects and file/line references before summaries.

## Verification By Stakes
- Routine local edits: run syntax/type/unit checks that are already present.
- Shared or user-facing changes: also inspect edge cases, error states, and docs/install paths.
- Significant claims, security, legal, financial, medical, or release guidance: verify against primary/current sources before presenting as fact.

## Commands
- `codi status`: summarize active mode, assumptions, and any verification gaps.
- `codi drive`: ask before applying sharpened prompts or taking broad actions.
- `codi cruise`: proceed with reasonable assumptions and concise notes.
- `codi quiet`: suppress status surfaces unless something needs attention.
- `codi review`: switch to code-review posture, prioritizing bugs and regressions.
- `codi handoff`: produce a concise continuation note with files touched, decisions, tests, and next steps.

### END CO-DIALECTIC ###
'@
}

function Get-CodexAdapterContent {
    return @'
### BEGIN CO-DIALECTIC ###
# Co-Dialectic for Codex

Use Co-Dialectic as a lightweight engineering discipline layer, not as a chat persona system.

## Defaults
- Stay concise and implementation-oriented.
- Read code before changing it.
- Make scoped edits that follow the repository's existing patterns.
- Preserve user changes and ignore unrelated dirty worktree files.
- Prefer `rg`/`rg --files` for search.
- Use patch-style edits for manual file changes.
- Run focused tests or checks when available, and say exactly what ran.

## Prompt Sharpening
- If the user's request is clear, do the work.
- If the request is ambiguous but low-risk, state the assumption and proceed.
- If the ambiguity could cause destructive, externally visible, or expensive work, ask one direct question.
- When helpful, internally rewrite vague requests into concrete acceptance criteria before implementation.

## Verification By Stakes
- Routine code edits: local tests, type checks, or lint checks where practical.
- Installer, release, security, or public-facing changes: validate idempotency, failure paths, and documentation.
- Current facts or high-stakes guidance: verify with primary/current sources before treating them as true.

## Commands
- `codi status`: report assumptions, touched files, validation, and remaining risk.
- `codi review`: use code-review posture; findings first, then brief summary.
- `codi handoff`: write a continuation summary with branch, files changed, tests, and next steps.
- `codi quiet`: minimize Co-Dialectic surface text.

### END CO-DIALECTIC ###
'@
}

# -----------------------------------------
# MAIN MENU
# -----------------------------------------
Write-Host "What would you like to do?"
Write-Host " [1] Install or Update"
Write-Host " [2] Uninstall completely"
Write-Host " [3] Exit"
if ($Target -eq "auto") {
    $MenuChoice = Ask-Choice "Select [1, 2, or 3]" "1"
} else {
    $MenuChoice = "1"
}

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
    $CursorRule = ".cursor\rules\co-dialectic.mdc"
    if (Test-Path $CursorRule) {
        Remove-Item -Force $CursorRule
        Write-Host "   Removed $CursorRule"
    }
    if (Test-Path "AGENTS.md") {
        $HasBlock = Select-String -Path "AGENTS.md" -Pattern "### BEGIN CO-DIALECTIC ###" -Quiet
        if ($HasBlock) {
            $Content = Get-Content "AGENTS.md" -Raw
            $Content = $Content -replace '(?s)### BEGIN CO-DIALECTIC ###.*?### END CO-DIALECTIC ###\s*', ''
            Set-Content -Path "AGENTS.md" -Value $Content -Encoding UTF8
            Write-Host "   Removed from AGENTS.md"
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
if ($Lite -or (($Target -ne "auto") -and (-not $Full))) {
    $VersionChoice = "2"
} elseif ($Full) {
    $VersionChoice = "1"
} else {
    $VersionChoice = Ask-Choice "Select [1/2]" "1"
}

$SelectedVerStr = "full"
if ($VersionChoice -eq "2") {
    $SkillUrl = "$RepoUrl/plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md"
    $SelectedVerStr = "lite"
    Write-Host "⬇️  Downloading Lite version..." -ForegroundColor Yellow
} else {
    $SkillUrl = "$RepoUrl/plugins/co-dialectic/skills/co-dialectic/SKILL.md"
    Write-Host "⬇️  Downloading Standard version..." -ForegroundColor Yellow
}

if ($Target -eq "auto") {
    try {
        $SkillContent = Get-RepoFileContent $SkillUrl
    } catch {
        Write-Host "Failed to download SKILL.md" -ForegroundColor Red
        exit 1
    }

    $TrackOptIn = Ask-User "📊 Share anonymous install metrics to help the project (OS/Tool choices)? [Y/n]" "y"
    $BgUpdates = Ask-User "🔄 Enable weekly background checks for updates via Scheduled Tasks? [Y/n]" "y"
} else {
    $SkillContent = ""
    $TrackOptIn = $false
    $BgUpdates = $false
}

$Installed = $false
$InstalledTools = @()

function Install-Skill {
    # Full-file overwrite for dedicated skill files (Claude Code, Antigravity).
    # Unlike Append-Or-Replace, these files are owned entirely by Co-Dialectic,
    # so YAML frontmatter must sit on line 1 and must not be duplicated on update.
    param([string]$TargetFile, [string]$PromptMsg, [string]$DefaultAns, [string]$ToolName)

    $FileExists = Test-Path $TargetFile

    if ($FileExists) {
        if (Ask-User "🔄 Co-Dialectic already installed at $TargetFile. Overwrite it? [Y/n]" "y") {
            $SkillContent | Set-Content -Path $TargetFile -Encoding UTF8 -NoNewline
            Write-Host "   ✅ Updated $TargetFile" -ForegroundColor Green
            $script:Installed = $true
            $script:InstalledTools += $ToolName
        }
    } else {
        if (Ask-User $PromptMsg $DefaultAns) {
            $SkillContent | Set-Content -Path $TargetFile -Encoding UTF8 -NoNewline
            Write-Host "   ✅ Installed to $TargetFile" -ForegroundColor Green
            $script:Installed = $true
            $script:InstalledTools += $ToolName
        }
    }
}

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

function Install-OwnedFile {
    param(
        [string]$SourceUrl,
        [string]$TargetFile,
        [string]$PromptMsg,
        [string]$DefaultAns,
        [string]$ToolName,
        [bool]$Force = $false
    )

    if ((-not $Force) -and (-not (Ask-User $PromptMsg $DefaultAns))) { return }

    try {
        $Content = Get-RepoFileContent $SourceUrl
    } catch {
        Write-Host "   ❌ Failed to download $SourceUrl" -ForegroundColor Red
        return
    }

    $Parent = Split-Path $TargetFile
    if (($Parent -ne "") -and (-not (Test-Path $Parent))) {
        New-Item -ItemType Directory -Force -Path $Parent | Out-Null
    }
    $Content | Set-Content -Path $TargetFile -Encoding UTF8 -NoNewline
    Write-Host "   ✅ Installed $TargetFile" -ForegroundColor Green
    $script:Installed = $true
    $script:InstalledTools += $ToolName
}

function Append-Or-ReplaceRemote {
    param(
        [string]$SourceUrl,
        [string]$TargetFile,
        [string]$PromptMsg,
        [string]$DefaultAns,
        [string]$ToolName,
        [bool]$Force = $false
    )

    if ((-not $Force) -and (-not (Ask-User $PromptMsg $DefaultAns))) { return }

    try {
        $RemoteContent = Get-RepoFileContent $SourceUrl
    } catch {
        Write-Host "   ❌ Failed to download $SourceUrl" -ForegroundColor Red
        return
    }

    if (-not (Test-Path $TargetFile)) {
        $RemoteContent | Set-Content -Path $TargetFile -Encoding UTF8 -NoNewline
        Write-Host "   ✅ Added to $TargetFile" -ForegroundColor Green
    } else {
        $Content = Get-Content $TargetFile -Raw
        if ($Content -match "### BEGIN CO-DIALECTIC ###") {
        $Content = $Content -replace '(?s)### BEGIN CO-DIALECTIC ###.*?### END CO-DIALECTIC ###\s*', ''
        Set-Content -Path $TargetFile -Value ($Content.TrimEnd() + "`n`n" + $RemoteContent) -Encoding UTF8
        Write-Host "   ✅ Updated $TargetFile" -ForegroundColor Green
        } else {
        Add-Content -Path $TargetFile -Value "`n$RemoteContent" -Encoding UTF8
        Write-Host "   ✅ Added to $TargetFile" -ForegroundColor Green
        }
    }

    $script:Installed = $true
    $script:InstalledTools += $ToolName
}

function Target-Selected {
    param([string]$Name)
    if ($Target -eq "all") { return $true }
    return $Target -eq $Name
}

Write-Host ""
Write-Host "Scanning for AI environments..."
Write-Host ""

if ($Target -ne "auto") {
    if (Target-Selected "cursor") {
        Install-OwnedFile `
            "$RepoUrl/plugins/co-dialectic/adapters/cursor/co-dialectic.mdc" `
            ".cursor\rules\co-dialectic.mdc" `
            "✅ Install Cursor project rules to .cursor/rules/co-dialectic.mdc? [Y/n]" `
            "y" `
            "cursor_mdc" `
            $true
    }
    if (Target-Selected "codex") {
        Append-Or-ReplaceRemote `
            "$RepoUrl/plugins/co-dialectic/adapters/codex/AGENTS.md" `
            "AGENTS.md" `
            "✅ Add Codex instructions to AGENTS.md? [Y/n]" `
            "y" `
            "codex_agents" `
            $true
    }
} else {

# 1. Antigravity Support (dedicated skill file, full overwrite)
$AntigravityPath = Join-Path $env:USERPROFILE ".gemini\antigravity\skills"
if (Test-Path $AntigravityPath) {
    $Target = Join-Path $AntigravityPath "co-dialectic\SKILL.md"
    if (-not (Test-Path (Split-Path $Target))) { New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null }
    Install-Skill $Target "✅ Detected Antigravity. Install here? [Y/n]" "y" "antigravity"
    Write-Host ""
}

# 2. Claude Code Support (dedicated skill file, full overwrite)
$ClaudePath = Join-Path $env:USERPROFILE ".claude"
if (Test-Path $ClaudePath) {
    $Target = Join-Path $ClaudePath "skills\co-dialectic\SKILL.md"
    if (-not (Test-Path (Split-Path $Target))) { New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null }
    Install-Skill $Target "✅ Detected Claude Code. Install here? [Y/n]" "y" "claude_code"
    Write-Host ""
}

# 3. Cursor Support
if ((Test-Path ".cursor") -or (Test-Path ".cursorrules")) {
    Install-OwnedFile `
        "$RepoUrl/plugins/co-dialectic/adapters/cursor/co-dialectic.mdc" `
        ".cursor\rules\co-dialectic.mdc" `
        "✅ Detected Cursor project. Install modern Cursor rule to .cursor/rules/co-dialectic.mdc? [Y/n]" `
        "y" `
        "cursor_mdc"
    Write-Host ""
}

if ((Test-Path "AGENTS.md") -or (Get-Command codex -ErrorAction SilentlyContinue)) {
    Append-Or-ReplaceRemote `
        "$RepoUrl/plugins/co-dialectic/adapters/codex/AGENTS.md" `
        "AGENTS.md" `
        "✅ Detected Codex. Add workspace instructions to AGENTS.md? [Y/n]" `
        "y" `
        "codex_agents"
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

# Apply Telemetry — one pixel per tool for per-LLM install tracking
if ($TrackOptIn) {
    foreach ($Tool in $InstalledTools) {
        if ($Tool -ne "") {
            $TelemetryUrl = "https://static.scarf.sh/a.png?x-pxid=dad54773-1711-4acf-bc86-b4fd4c5415b1&version=$SelectedVerStr&tool=$Tool&os=windows"
            try {
                Invoke-RestMethod -Uri $TelemetryUrl -TimeoutSec 3 | Out-Null
            } catch {}
        }
    }
}

Write-Host ""
Write-Host "🎉 Done! Co-Dialectic is ready." -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: You MUST start a completely new chat/session for the instructions to take effect." -ForegroundColor Yellow
Write-Host "   Updates: run this script again anytime to update safely."
Write-Host ""
