#!/bin/bash
# Co-Dialectic Manager
# Usage: curl -fsSL https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"
VERSION="2.1.0"
CONFIG_DIR="$HOME/.co-dialectic"

# -----------------------------------------
# BACKGROUND CHECKER
# -----------------------------------------
if [ "$1" = "--bg-check" ]; then
    mkdir -p "$CONFIG_DIR"
    REMOTE_VERSION=$(curl -fsSL "$REPO/co-dialectic/SKILL.md" | grep "**Version:**" | head -n 1 | awk '{print $2}')
    LOCAL_VERSION=""
    if [ -f "$CONFIG_DIR/version.txt" ]; then LOCAL_VERSION=$(cat "$CONFIG_DIR/version.txt"); fi
    
    if [ -n "$REMOTE_VERSION" ] && [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            osascript -e "display notification \"Run: curl -fsSL https://thewhyman.gateway.scarf.sh/install.sh | bash\" with title \"🧠 Co-Dialectic Update Available ($REMOTE_VERSION)\""
        elif command -v notify-send >/dev/null 2>&1; then
            notify-send "🧠 Co-Dialectic Update" "Version $REMOTE_VERSION is available! Run the curl installer to update."
        fi
    fi
    exit 0
fi

# -----------------------------------------
# UI HELPERS
# -----------------------------------------
echo "🧠 Co-Dialectic Manager (v$VERSION)"
echo "=================================="

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

# -----------------------------------------
# MAIN MENU
# -----------------------------------------
echo "What would you like to do?"
echo " [1] Install or Update"
echo " [2] Uninstall completely"
echo " [3] Exit"
MENU_CHOICE=$(ask_choice "Select [1, 2, or 3]:" "1")

if [ "$MENU_CHOICE" = "3" ]; then
    echo "Exiting."
    exit 0
fi

# -----------------------------------------
# UNINSTALL LOGIC
# -----------------------------------------
if [ "$MENU_CHOICE" = "2" ]; then
    echo "🗑️ Uninstalling Co-Dialectic..."
    
    # 1. Remove LaunchAgent / Background Checks
    if [[ "$OSTYPE" == "darwin"* ]] && [ -f "$HOME/Library/LaunchAgents/com.codialectic.updater.plist" ]; then
        launchctl unload "$HOME/Library/LaunchAgents/com.codialectic.updater.plist" 2>/dev/null || true
        rm -f "$HOME/Library/LaunchAgents/com.codialectic.updater.plist"
        echo "   Removed MacOS background updater."
    fi
    
    # 2. Remove IDE Blocks
    for TARGET in ".cursorrules" ".windsurfrules" ".clinerules" ".roomodes" ".aider.conf.yml"; do
        if [ -f "$TARGET" ] && grep -q "### BEGIN CO-DIALECTIC ###" "$TARGET"; then
            awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "$TARGET" > "${TARGET}.tmp"
            mv "${TARGET}.tmp" "$TARGET"
            echo "   Removed from $TARGET"
        fi
    done
    
    # 3. Remove standalone files
    for DIR in "$HOME/.claude/skills/co-dialectic" "$HOME/.gemini/antigravity/skills/co-dialectic" "$CONFIG_DIR"; do
        if [ -d "$DIR" ]; then
            rm -rf "$DIR"
            echo "   Deleted $DIR"
        fi
    done
    
    echo "✅ Successfully uninstalled."
    exit 0
fi

# -----------------------------------------
# INSTALL LOGIC
# -----------------------------------------
echo ""
echo "Which version do you want to install?"
echo " [1] Standard (Best for Pro/Paid AI users)"
echo " [2] Lite (Best for Free/Fast AI limits)"
VERSION_CHOICE=$(ask_choice "Select [1/2]:" "1")

if [ "$VERSION_CHOICE" = "2" ]; then
    SKILL_URL="$REPO/co-dialectic/SKILL-lite.md"
    SELECTED_VER="lite"
    echo "⬇️  Downloading Lite version..."
else
    SKILL_URL="$REPO/co-dialectic/SKILL.md"
    SELECTED_VER="full"
    echo "⬇️  Downloading Standard version..."
fi

TMP_SKILL=$(mktemp)
curl -fsSL "$SKILL_URL" -o "$TMP_SKILL"

# Feature choices
TRACK_OPT_IN=$(ask_user "📊 Share anonymous install metrics to help the project (OS/Tool choices)? [Y/n]" "y")
BG_UPDATES=$(ask_user "🔄 Enable weekly background checks for updates (MacOS/Linux)? [Y/n]" "y")

INSTALLED=false
INSTALLED_TOOLS=""

append_or_replace() {
    local target_file="$1"
    local prompt_msg="$2"
    local default_ans="$3"
    local tool_name="$4"
    
    if [ ! -f "$target_file" ]; then touch "$target_file"; fi
    
    # Backward compatibility for completely old installations
    if grep -q "# Co-Dialectic" "$target_file" 2>/dev/null && ! grep -q "### BEGIN CO-DIALECTIC ###" "$target_file" 2>/dev/null; then
        echo "   ⚠️  Found an older v1/v2.0 installation in $target_file without safe-update markers."
        echo "   ⚠️  To upgrade cleanly, please manually delete the old Co-Dialectic text from this file once."
        echo "   ⚠️  Skipping this file to prevent duplicates."
        return
    fi
    
    if grep -q "### BEGIN CO-DIALECTIC ###" "$target_file" 2>/dev/null; then
        if ask_user "🔄 Co-Dialectic already in $target_file. Update it? [Y/n]" "y"; then
            awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "$target_file" > "${target_file}.tmp"
            cat "$TMP_SKILL" >> "${target_file}.tmp"
            mv "${target_file}.tmp" "$target_file"
            echo "   ✅ Updated $target_file"
            INSTALLED=true
            INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name"
        fi
    else
        if ask_user "$prompt_msg" "$default_ans"; then
            echo "" >> "$target_file"
            cat "$TMP_SKILL" >> "$target_file"
            echo "   ✅ Added to $target_file"
            INSTALLED=true
            INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name"
        fi
    fi
}

echo ""
echo "Scanning for AI environments..."
echo ""

# Tool injections
if [ -d "$HOME/.gemini/antigravity/skills" ]; then
    mkdir -p "$HOME/.gemini/antigravity/skills/co-dialectic"
    append_or_replace "$HOME/.gemini/antigravity/skills/co-dialectic/SKILL.md" "✅ Detected Antigravity. Install here? [Y/n]" "y" "antigravity"
    echo ""
fi

if [ -d "$HOME/.claude" ]; then
    mkdir -p "$HOME/.claude/skills/co-dialectic"
    append_or_replace "$HOME/.claude/skills/co-dialectic/SKILL.md" "✅ Detected Claude Code. Install here? [Y/n]" "y" "claude_code"
    echo ""
fi

if [ -d ".cursor" ] || [ -f ".cursorrules" ]; then
    append_or_replace ".cursorrules" "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y" "cursor"
    echo ""
fi

append_or_replace ".windsurfrules" "❓ Add to Windsurf workspace (.windsurfrules)? [y/N]" "n" "windsurf"
append_or_replace ".clinerules" "❓ Add to Cline CLI (.clinerules)? [y/N]" "n" "cline"
append_or_replace ".roomodes" "❓ Add to Roo Code (.roomodes)? [y/N]" "n" "roo"
append_or_replace ".aider.conf.yml" "❓ Add to Aider (.aider.conf.yml)? [y/N]" "n" "aider"

if ask_user "📋 Copy to clipboard for web apps (claude.ai, ChatGPT)? [y/N]" "n"; then
    if command -v pbcopy >/dev/null 2>&1; then cat "$TMP_SKILL" | pbcopy; echo "   Copied via pbcopy!"
    elif command -v clip.exe >/dev/null 2>&1; then cat "$TMP_SKILL" | clip.exe; echo "   Copied via clip.exe!"
    elif command -v xclip >/dev/null 2>&1; then cat "$TMP_SKILL" | xclip -selection clipboard; echo "   Copied via xclip!"
    elif command -v xsel >/dev/null 2>&1; then cat "$TMP_SKILL" | xsel --clipboard --input; echo "   Copied via xsel!"
    else echo "   ❌ Could not find clipboard tools."; fi
    INSTALLED=true
    INSTALLED_TOOLS="$INSTALLED_TOOLS,clipboard"
fi

if [ "$INSTALLED" = false ]; then
    echo "ℹ️  No installation selected. Downloading to ./co-dialectic/SKILL.md"
    mkdir -p co-dialectic
    cp "$TMP_SKILL" "co-dialectic/SKILL.md"
    INSTALLED_TOOLS="standalone"
fi

# Apply Background Checks
if [ "$BG_UPDATES" = true ] && [[ "$OSTYPE" == "darwin"* ]]; then
    PLIST_FILE="$HOME/Library/LaunchAgents/com.codialectic.updater.plist"
    cat << 'EOF' > "$PLIST_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.codialectic.updater</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>curl -fsSL https://thewhyman.gateway.scarf.sh/install.sh | bash -s -- --bg-check</string>
    </array>
    <key>StartInterval</key>
    <integer>604800</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
    launchctl load "$PLIST_FILE"
    echo "⏰ Native background updater installed (checks weekly via launchd)."
fi

# Save Config
mkdir -p "$CONFIG_DIR"
echo "$VERSION" > "$CONFIG_DIR/version.txt"

# Apply Telemetry
if [ "$TRACK_OPT_IN" = true ]; then
    # Fire and forget async
    curl -s "https://static.scarf.sh/a.png?x-pxid=4a0ef8e3-2d13-4c30-841a-0ba3b3cf5c62&version=$SELECTED_VER&tools=$INSTALLED_TOOLS&os=$OSTYPE" > /dev/null 2>&1 &
fi

rm -f "$TMP_SKILL"
echo ""
echo "🎉 Done! Co-Dialectic is ready."
echo "⚠️  IMPORTANT: You MUST start a completely new chat/session for the instructions to take effect."
