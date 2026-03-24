<#
.SYNOPSIS
Co-Dialectic installer for Windows.

.DESCRIPTION
Downloads and installs the Co-Dialectic skill to supported environments like Claude Code, Antigravity, Cursor, Windsurf, or copies it to the clipboard.
#>

$ErrorActionPreference = "Stop"

$RepoUrl = "https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"
$SkillUrl = "$RepoUrl/co-dialectic/SKILL.md"

Write-Host "🧠 Co-Dialectic Installer" -ForegroundColor Cyan
Write-Host "========================="
Write-Host ""

$Installed = $false

# Download to temp string
Write-Host "Downloading SKILL.md..."
try {
    $SkillContent = Invoke-RestMethod -Uri $SkillUrl
} catch {
    Write-Host "Failed to download SKILL.md" -ForegroundColor Red
    exit 1
}

Write-Host "Scanning for AI environments..."
Write-Host ""

function Ask-User {
    param([string]$PromptText, [string]$DefaultValue)
    $Choice = Read-Host "$PromptText"
    if ([string]::IsNullOrWhiteSpace($Choice)) {
        $Choice = $DefaultValue
    }
    if ($Choice -match "^[Yy]") {
        return $true
    }
    return $false
}

# 1. Antigravity Support
$AntigravityPath = Join-Path $env:USERPROFILE ".gemini\antigravity\skills"
if (Test-Path $AntigravityPath) {
    if (Ask-User "✅ Detected Antigravity ($AntigravityPath). Install here? [Y/n]" "y") {
        $DestDir = Join-Path $AntigravityPath "co-dialectic"
        if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Force -Path $DestDir | Out-Null }
        $SkillContent | Set-Content -Path (Join-Path $DestDir "SKILL.md") -Encoding UTF8
        Write-Host "   Installed to: $DestDir\SKILL.md" -ForegroundColor Green
        $Installed = $true
    }
    Write-Host ""
}

# 2. Claude Code Support
$ClaudePath = Join-Path $env:USERPROFILE ".claude"
if (Test-Path $ClaudePath) {
    if (Ask-User "✅ Detected Claude Code ($ClaudePath\skills). Install here? [Y/n]" "y") {
        $DestDir = Join-Path $ClaudePath "skills\co-dialectic"
        if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Force -Path $DestDir | Out-Null }
        $SkillContent | Set-Content -Path (Join-Path $DestDir "SKILL.md") -Encoding UTF8
        Write-Host "   Installed to: $DestDir\SKILL.md" -ForegroundColor Green
        $Installed = $true
    }
    Write-Host ""
}

# 3. Cursor Support
if ((Test-Path ".cursor") -or (Test-Path ".cursorrules")) {
    if (Ask-User "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y") {
        $SkillContent | Add-Content -Path ".cursorrules" -Encoding UTF8
        Write-Host "   Appended Co-Dialectic to .cursorrules" -ForegroundColor Green
        $Installed = $true
    }
    Write-Host ""
}

# 4. Windsurf Support
if (Ask-User "❓ Are you in a Windsurf workspace? Add to .windsurfrules? [y/N]" "n") {
    $SkillContent | Add-Content -Path ".windsurfrules" -Encoding UTF8
    Write-Host "   Appended Co-Dialectic to .windsurfrules" -ForegroundColor Green
    $Installed = $true
    Write-Host ""
}

# 5. Clipboard Integration
if (Ask-User "📋 Copy instructions to clipboard for ChatGPT / Claude.ai / Gemini Web? [y/N]" "n") {
    Set-Clipboard -Value $SkillContent
    Write-Host "   Copied to clipboard! You can now paste into your AI's custom instructions." -ForegroundColor Green
    $Installed = $true
    Write-Host ""
}

if (-not $Installed) {
    Write-Host "ℹ️  No installation selected. Downloading SKILL.md to current directory..."
    if (-not (Test-Path "co-dialectic")) { New-Item -ItemType Directory -Force -Path "co-dialectic" | Out-Null }
    $SkillContent | Set-Content -Path "co-dialectic\SKILL.md" -Encoding UTF8
    Write-Host "   Downloaded to: .\co-dialectic\SKILL.md"
}

Write-Host ""
Write-Host "🎉 Done! Co-Dialectic is ready." -ForegroundColor Cyan
Write-Host "   Updates: https://github.com/thewhyman/prompt-engineering-in-action"
Write-Host ""
