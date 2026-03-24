<#
.SYNOPSIS
Co-Dialectic installer for Windows.
#>
$ErrorActionPreference = "Stop"

$RepoUrl = "https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"

Write-Host "🧠 Co-Dialectic Installer" -ForegroundColor Cyan
Write-Host "========================="
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

Write-Host "Which version do you want to install?"
Write-Host " [1] Standard (Best for Pro/Paid AI users)"
Write-Host " [2] Lite (Best for Free/Fast AI limits)"
$VersionChoice = Ask-Choice "Select [1/2]" "1"

if ($VersionChoice -eq "2") {
    $SkillUrl = "$RepoUrl/co-dialectic/SKILL-lite.md"
    Write-Host "⬇️  Downloading Lite version..." -ForegroundColor Yellow
} else {
    $SkillUrl = "$RepoUrl/co-dialectic/SKILL.md"
    Write-Host "⬇️  Downloading Standard version..." -ForegroundColor Yellow
}

try {
    $SkillContent = Invoke-RestMethod -Uri $SkillUrl
} catch {
    Write-Host "Failed to download SKILL.md" -ForegroundColor Red
    exit 1
}

$Installed = $false

function Append-Or-Replace {
    param([string]$TargetFile, [string]$PromptMsg, [string]$DefaultAns)
    
    $HasBlock = $false
    if (Test-Path $TargetFile) {
        $HasBlock = (Select-String -Path $TargetFile -Pattern "### BEGIN CO-DIALECTIC ###" -Quiet)
    }

    if ($HasBlock) {
        if (Ask-User "🔄 Co-Dialectic already in $TargetFile. Update it? (Overwrites manual edits in block) [Y/n]" "y") {
            $Content = Get-Content $TargetFile -Raw
            $Content = $Content -replace '(?s)### BEGIN CO-DIALECTIC ###.*?### END CO-DIALECTIC ###\s*', ''
            Set-Content -Path $TargetFile -Value $Content -Encoding UTF8
            Add-Content -Path $TargetFile -Value "`n$SkillContent" -Encoding UTF8
            Write-Host "   ✅ Updated $TargetFile" -ForegroundColor Green
            $script:Installed = $true
        }
    } else {
        if (Ask-User $PromptMsg $DefaultAns) {
            Add-Content -Path $TargetFile -Value "`n$SkillContent" -Encoding UTF8
            Write-Host "   ✅ Added to $TargetFile" -ForegroundColor Green
            $script:Installed = $true
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
    Append-Or-Replace $Target "✅ Detected Antigravity ($AntigravityPath). Install here? [Y/n]" "y"
    Write-Host ""
}

# 2. Claude Code Support
$ClaudePath = Join-Path $env:USERPROFILE ".claude"
if (Test-Path $ClaudePath) {
    $Target = Join-Path $ClaudePath "skills\co-dialectic\SKILL.md"
    if (-not (Test-Path (Split-Path $Target))) { New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null }
    Append-Or-Replace $Target "✅ Detected Claude Code ($ClaudePath\skills). Install here? [Y/n]" "y"
    Write-Host ""
}

# 3. Cursor Support
if ((Test-Path ".cursor") -or (Test-Path ".cursorrules")) {
    Append-Or-Replace ".cursorrules" "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y"
    Write-Host ""
}

# 4. Windsurf Support
Append-Or-Replace ".windsurfrules" "❓ Are you in a Windsurf workspace? Add to .windsurfrules? [y/N]" "n"
Write-Host ""

# 5. Cline Support
Append-Or-Replace ".clinerules" "❓ Add to Cline CLI (.clinerules)? [y/N]" "n"
Write-Host ""

# 6. Roo Code Support
Append-Or-Replace ".roomodes" "❓ Add to Roo Code (.roomodes)? [y/N]" "n"
Write-Host ""

# 7. Aider Support
Append-Or-Replace ".aider.conf.yml" "❓ Add to Aider (.aider.conf.yml)? [y/N]" "n"
Write-Host ""


# 8. Clipboard Integration
if (Ask-User "📋 Copy instructions to clipboard for web/desktop apps? [y/N]" "n") {
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
Write-Host "   Updates: run this script again anytime to update safely."
Write-Host ""
