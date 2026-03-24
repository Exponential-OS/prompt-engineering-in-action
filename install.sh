#!/bin/bash
# Co-Dialectic installer
# Usage: curl -fsSL https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"
SKILL_URL="$REPO/co-dialectic/SKILL.md"

echo "🧠 Co-Dialectic Installer"
echo "========================="
echo ""

# Function to prompt user interactively, even when piped
ask_user() {
    local prompt="$1"
    local default="$2"
    local reply
    
    # Read from /dev/tty if available
    if [ -t 0 ]; then
        read -r -p "$prompt " reply
    elif [ -c /dev/tty ]; then
        read -r -p "$prompt " reply </dev/tty
    else
        # Non-interactive fallback
        echo -n "$prompt "
        reply="$default"
        echo "$reply (auto-selected)"
    fi
    
    if [[ -z "$reply" ]]; then
        reply="$default"
    fi
    
    case "$reply" in
        [Yy]* ) return 0 ;;
        * ) return 1 ;;
    esac
}

# Download SKILL.md to a temporary file first
TMP_SKILL=$(mktemp)
curl -fsSL "$SKILL_URL" -o "$TMP_SKILL"

# Check available environments
INSTALLED=false

echo "Scanning for AI environments..."
echo ""

# 1. Antigravity Support
if [ -d "$HOME/.gemini/antigravity/skills" ]; then
    if ask_user "✅ Detected Antigravity (~/.gemini/antigravity/skills). Install here? [Y/n]" "y"; then
        SKILLS_DIR="$HOME/.gemini/antigravity/skills/co-dialectic"
        mkdir -p "$SKILLS_DIR"
        cp "$TMP_SKILL" "$SKILLS_DIR/SKILL.md"
        echo "   Installed to: $SKILLS_DIR/SKILL.md"
        echo "   Antigravity will auto-detect the skill."
        INSTALLED=true
    fi
    echo ""
fi

# 2. Claude Code Support
if [ -d "$HOME/.claude" ]; then
    if ask_user "✅ Detected Claude Code (~/.claude). Install here? [Y/n]" "y"; then
        SKILLS_DIR="$HOME/.claude/skills/co-dialectic"
        mkdir -p "$SKILLS_DIR"
        cp "$TMP_SKILL" "$SKILLS_DIR/SKILL.md"
        echo "   Installed to: $SKILLS_DIR/SKILL.md"
        echo "   Type 'cod' in any Claude Code conversation to activate."
        INSTALLED=true
    fi
    echo ""
fi

# 3. Cursor Support
if [ -d ".cursor" ] || [ -f ".cursorrules" ]; then
    if ask_user "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y"; then
        cat "$TMP_SKILL" >> .cursorrules
        echo "   Appended Co-Dialectic to .cursorrules"
        INSTALLED=true
    fi
    echo ""
fi

# 4. Windsurf Support
if ask_user "❓ Are you in a Windsurf workspace? Add to .windsurfrules? [y/N]" "n"; then
    cat "$TMP_SKILL" >> .windsurfrules
    echo "   Appended Co-Dialectic to .windsurfrules"
    INSTALLED=true
    echo ""
fi

# 5. Clipboard Integration for Web/Desktop GUIs
if ask_user "📋 Copy instructions to clipboard for web/desktop apps (claude.ai, ChatGPT, Gemini)? [y/N]" "n"; then
    if command -v pbcopy >/dev/null 2>&1; then
        cat "$TMP_SKILL" | pbcopy
        echo "   Copied! You can now paste into your AI's custom instructions."
        INSTALLED=true
    elif command -v clip.exe >/dev/null 2>&1; then # WSL
        cat "$TMP_SKILL" | clip.exe
        echo "   Copied to Windows clipboard! You can now paste into your AI's custom instructions."
        INSTALLED=true
    elif command -v xclip >/dev/null 2>&1; then
        cat "$TMP_SKILL" | xclip -selection clipboard
        echo "   Copied via xclip! You can now paste into your AI's custom instructions."
        INSTALLED=true
    elif command -v xsel >/dev/null 2>&1; then
        cat "$TMP_SKILL" | xsel --clipboard --input
        echo "   Copied via xsel! You can now paste into your AI's custom instructions."
        INSTALLED=true
    else
        echo "   ❌ Could not find a clipboard manager (pbcopy, clip.exe, xclip, xsel)."
        echo "   Downloading SKILL.md locally instead..."
        mkdir -p co-dialectic
        cp "$TMP_SKILL" "co-dialectic/SKILL.md"
        echo "   Saved file to ./co-dialectic/SKILL.md"
        INSTALLED=true
    fi
    echo ""
fi

# Fallback: Just download to current folder if user skipped everything
if [ "$INSTALLED" = false ]; then
    echo "ℹ️  No installation selected. Downloading SKILL.md to current directory..."
    mkdir -p co-dialectic
    cp "$TMP_SKILL" "co-dialectic/SKILL.md"
    echo "   Downloaded to: ./co-dialectic/SKILL.md"
    echo ""
    echo "   Next steps — paste the contents into your AI:"
    echo "   • claude.ai → Projects → Custom Instructions"
    echo "   • ChatGPT Desktop/Web → Settings → Personalization → Custom Instructions"
fi

rm -f "$TMP_SKILL"

echo ""
echo "🎉 Done! Co-Dialectic is ready."
echo "   Updates: https://github.com/thewhyman/prompt-engineering-in-action"
echo ""
