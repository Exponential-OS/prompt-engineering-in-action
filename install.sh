#!/bin/bash
# Co-Dialectic installer
# Usage: curl -fsSL https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"

echo "🧠 Co-Dialectic Installer"
echo "========================="
echo ""

ask_user() {
    local prompt="$1"
    local default="$2"
    local reply
    if [ -t 0 ]; then read -r -p "$prompt " reply; elif [ -c /dev/tty ]; then read -r -p "$prompt " reply </dev/tty; else echo -n "$prompt "; reply="$default"; echo "$reply (auto-selected)"; fi
    if [[ -z "$reply" ]]; then reply="$default"; fi
    case "$reply" in [Yy]* ) return 0 ;; * ) return 1 ;; esac
}

ask_choice() {
    local prompt="$1"
    local default="$2"
    local reply
    if [ -t 0 ]; then read -r -p "$prompt " reply; elif [ -c /dev/tty ]; then read -r -p "$prompt " reply </dev/tty; else echo -n "$prompt "; reply="$default"; echo "$reply (auto-selected)"; fi
    if [[ -z "$reply" ]]; then reply="$default"; fi
    echo "$reply"
}

echo "Which version do you want to install?"
echo " [1] Standard (Best for Pro/Paid AI users)"
echo " [2] Lite (Best for Free/Fast AI limits)"
VERSION_CHOICE=$(ask_choice "Select [1/2]:" "1")

if [ "$VERSION_CHOICE" = "2" ]; then
    SKILL_URL="$REPO/co-dialectic/SKILL-lite.md"
    echo "⬇️  Downloading Lite version..."
else
    SKILL_URL="$REPO/co-dialectic/SKILL.md"
    echo "⬇️  Downloading Standard version..."
fi

TMP_SKILL=$(mktemp)
curl -fsSL "$SKILL_URL" -o "$TMP_SKILL"

INSTALLED=false

append_or_replace() {
    local target_file="$1"
    local prompt_msg="$2"
    local default_ans="$3"
    
    if grep -q "### BEGIN CO-DIALECTIC ###" "$target_file" 2>/dev/null; then
        if ask_user "🔄 Co-Dialectic already in $target_file. Update it? (Overwrites manual edits in block) [Y/n]" "y"; then
            awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "$target_file" > "${target_file}.tmp"
            cat "$TMP_SKILL" >> "${target_file}.tmp"
            mv "${target_file}.tmp" "$target_file"
            echo "   ✅ Updated $target_file"
            INSTALLED=true
        fi
    else
        if ask_user "$prompt_msg" "$default_ans"; then
            if [ ! -f "$target_file" ]; then touch "$target_file"; fi
            echo "" >> "$target_file"
            cat "$TMP_SKILL" >> "$target_file"
            echo "   ✅ Added to $target_file"
            INSTALLED=true
        fi
    fi
}

echo ""
echo "Scanning for AI environments..."
echo ""

# 1. Antigravity Support
if [ -d "$HOME/.gemini/antigravity/skills" ]; then
    TARGET="$HOME/.gemini/antigravity/skills/co-dialectic/SKILL.md"
    mkdir -p "$(dirname "$TARGET")"
    append_or_replace "$TARGET" "✅ Detected Antigravity (~/.gemini/antigravity/skills). Install here? [Y/n]" "y"
    echo ""
fi

# 2. Claude Code Support
if [ -d "$HOME/.claude" ]; then
    TARGET="$HOME/.claude/skills/co-dialectic/SKILL.md"
    mkdir -p "$(dirname "$TARGET")"
    append_or_replace "$TARGET" "✅ Detected Claude Code (~/.claude). Install here? [Y/n]" "y"
    echo ""
fi

# 3. Cursor Support
if [ -d ".cursor" ] || [ -f ".cursorrules" ]; then
    append_or_replace ".cursorrules" "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y"
    echo ""
fi

# 4. Windsurf Support
append_or_replace ".windsurfrules" "❓ Are you in a Windsurf workspace? Add to .windsurfrules? [y/N]" "n"
echo ""

# 5. Cline Support
append_or_replace ".clinerules" "❓ Add to Cline CLI (.clinerules)? [y/N]" "n"
echo ""

# 6. Roo Code Support
append_or_replace ".roomodes" "❓ Add to Roo Code (.roomodes)? [y/N]" "n"
echo ""

# 7. Aider Support
append_or_replace ".aider.conf.yml" "❓ Add to Aider (.aider.conf.yml)? [y/N]" "n"
echo ""

# 8. Clipboard Integration
if ask_user "📋 Copy instructions to clipboard for web/desktop apps (claude.ai, ChatGPT, Gemini)? [y/N]" "n"; then
    if command -v pbcopy >/dev/null 2>&1; then cat "$TMP_SKILL" | pbcopy; echo "   Copied via pbcopy!"
    elif command -v clip.exe >/dev/null 2>&1; then cat "$TMP_SKILL" | clip.exe; echo "   Copied to Windows clipboard!"
    elif command -v xclip >/dev/null 2>&1; then cat "$TMP_SKILL" | xclip -selection clipboard; echo "   Copied via xclip!"
    elif command -v xsel >/dev/null 2>&1; then cat "$TMP_SKILL" | xsel --clipboard --input; echo "   Copied via xsel!"
    else echo "   ❌ Could not find clipboard tools. Skipping..."; fi
    INSTALLED=true
    echo ""
fi

# Fallback
if [ "$INSTALLED" = false ]; then
    echo "ℹ️  No installation selected. Downloading to current directory..."
    mkdir -p co-dialectic
    cp "$TMP_SKILL" "co-dialectic/SKILL.md"
    echo "   Downloaded to: ./co-dialectic/SKILL.md"
fi

rm -f "$TMP_SKILL"

echo ""
echo "🎉 Done! Co-Dialectic is ready."
echo "   Updates: run this script again anytime to update safely."
echo ""
