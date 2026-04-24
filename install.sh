#!/bin/bash
# Co-Dialectic Manager
# Usage: curl -fsSL https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"
VERSION="3.2.0"
CONFIG_DIR="$HOME/.co-dialectic"

# Co-Dialectic plugin skill inventory (v3.2.0). Shared by install + uninstall.
# Append a new skill name here when a new skill is added to the plugin.
# Skills that ship executable helpers also need an entry in fetch_skill_extras().
PLUGIN_SKILLS=(
    "co-dialectic"
    "calibration-auditor"
    "hallucination-detector"
    "judge-panel"
    "unknown-unknown"
    "waky-waky"
)

# -----------------------------------------
# BACKGROUND CHECKER
# -----------------------------------------
if [ "$1" = "--bg-check" ]; then
    mkdir -p "$CONFIG_DIR"
    # Read YAML-frontmatter `version: "X.Y.Z"` first (v3+), fall back to legacy `**Version:**`.
    SKILL_REMOTE=$(curl -fsSL "$REPO/plugins/co-dialectic/skills/co-dialectic/SKILL.md")
    REMOTE_VERSION=$(echo "$SKILL_REMOTE" | awk -F'"' '/^[[:space:]]*version:[[:space:]]*"/{print $2; exit}')
    if [ -z "$REMOTE_VERSION" ]; then
        REMOTE_VERSION=$(echo "$SKILL_REMOTE" | grep "\*\*Version:\*\*" | head -n 1 | awk '{print $2}')
    fi
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
    for TARGET in ".cursorrules" ".windsurfrules" ".clinerules" ".roomodes" ".aider.instructions.md"; do
        if [ -f "$TARGET" ] && grep -q "### BEGIN CO-DIALECTIC ###" "$TARGET"; then
            awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "$TARGET" > "${TARGET}.tmp"
            cat "${TARGET}.tmp" > "$TARGET"
            rm "${TARGET}.tmp"
            echo "   Removed from $TARGET"
        fi
    done
    
    # 3. Remove standalone files — iterate the plugin's skill inventory so
    #    older installs (single co-dialectic skill) AND v3.2+ installs (all 6
    #    sibling skills) both get fully cleaned up.
    for SKILL in "${PLUGIN_SKILLS[@]}"; do
        for BASE in "$HOME/.claude/skills" "$HOME/.gemini/antigravity/skills"; do
            if [ -d "$BASE/$SKILL" ]; then
                rm -rf "$BASE/$SKILL"
                echo "   Deleted $BASE/$SKILL"
            fi
        done
    done
    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "$CONFIG_DIR"
        echo "   Deleted $CONFIG_DIR"
    fi
    
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
    SKILL_URL="$REPO/plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md"
    SELECTED_VER="lite"
    echo "⬇️  Downloading Lite version..."
else
    SKILL_URL="$REPO/plugins/co-dialectic/skills/co-dialectic/SKILL.md"
    SELECTED_VER="full"
    echo "⬇️  Downloading Standard version..."
fi

TMP_SKILL=$(mktemp)
curl -fsSL "$SKILL_URL" -o "$TMP_SKILL"

# -----------------------------------------
# Plugin skill install helpers
# -----------------------------------------
# Directory-based tools (Claude Code, Antigravity) get ALL PLUGIN_SKILLS.
# Text-append tools (Cursor / Windsurf / Cline / Aider / Roo) concatenate a
# single rules file and get the core skill only — supporting skills assume a
# plugin-style skill-directory layout that rules-files don't model.

fetch_skill_extras() {
    # Download executable helpers + auxiliary files for skills that ship them.
    # Called by install_plugin() after SKILL.md has landed.
    local skill_name="$1"
    local skill_dir="$2"
    case "$skill_name" in
        judge-panel)
            mkdir -p "$skill_dir/scripts"
            if curl -fsSL "$REPO/plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py" -o "$skill_dir/scripts/judge_panel.py"; then
                chmod +x "$skill_dir/scripts/judge_panel.py" 2>/dev/null || true
                echo "      └─ scripts/judge_panel.py (cascade harness)"
            else
                echo "      └─ ⚠️  failed to fetch scripts/judge_panel.py — judge-panel will not be functional"
            fi
            ;;
    esac
}

install_plugin() {
    # Fetch all PLUGIN_SKILLS into $target_base/<skill-name>/SKILL.md .
    # For the core 'co-dialectic' skill, honor the earlier lite-vs-full choice
    # by aliasing SKILL-lite.md -> SKILL.md when SELECTED_VER=lite.
    local target_base="$1"
    local prompt_msg="$2"
    local default_ans="$3"
    local tool_name="$4"

    local existing_core="$target_base/co-dialectic/SKILL.md"
    if [ -f "$existing_core" ]; then
        if ! ask_user "🔄 Co-Dialectic already installed at $target_base/. Overwrite all 6 skills? [Y/n]" "y"; then
            return
        fi
    else
        if ! ask_user "$prompt_msg" "$default_ans"; then
            return
        fi
    fi

    local skill skill_src skill_dir
    local failed=0
    for skill in "${PLUGIN_SKILLS[@]}"; do
        skill_dir="$target_base/$skill"
        mkdir -p "$skill_dir"
        if [ "$skill" = "co-dialectic" ] && [ "$SELECTED_VER" = "lite" ]; then
            skill_src="$REPO/plugins/co-dialectic/skills/$skill/SKILL-lite.md"
        else
            skill_src="$REPO/plugins/co-dialectic/skills/$skill/SKILL.md"
        fi
        if curl -fsSL "$skill_src" -o "$skill_dir/SKILL.md"; then
            echo "   ✅ $skill_dir/SKILL.md"
            fetch_skill_extras "$skill" "$skill_dir"
        else
            echo "   ❌ failed to fetch $skill/SKILL.md from $skill_src"
            failed=$((failed + 1))
        fi
    done

    if [ "$failed" -eq 0 ]; then
        echo "   ✅ Installed ${#PLUGIN_SKILLS[@]} skills to $target_base/"
        INSTALLED=true
        INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name"
    else
        echo "   ⚠️  Installed with $failed skill download failure(s) — re-run installer to retry."
        INSTALLED=true
        INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name-partial"
    fi
}

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
            cat "${target_file}.tmp" > "$target_file"
            rm "${target_file}.tmp"
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

# Directory-based plugin installs (Antigravity, Claude Code) — all 6 skills.
# For Claude Code users the recommended path is `/plugin install co-dialectic@thewhyman`
# via the marketplace; this installer path is the fallback for users not going
# through the plugin marketplace (e.g., they hit install.sh from a gift prompt).
if [ -d "$HOME/.gemini/antigravity/skills" ]; then
    install_plugin "$HOME/.gemini/antigravity/skills" "✅ Detected Antigravity. Install all 6 Co-Dialectic skills here? [Y/n]" "y" "antigravity"
    echo ""
fi

if [ -d "$HOME/.claude" ]; then
    mkdir -p "$HOME/.claude/skills"
    install_plugin "$HOME/.claude/skills" "✅ Detected Claude Code. Install all 6 Co-Dialectic skills here? (For the plugin path use: /plugin install co-dialectic@thewhyman) [Y/n]" "y" "claude_code"
    echo ""
fi

if [ -d ".cursor" ] || [ -f ".cursorrules" ]; then
    append_or_replace ".cursorrules" "✅ Detected Cursor project. Add to .cursorrules? [Y/n]" "y" "cursor"
    echo ""
fi

append_or_replace ".windsurfrules" "❓ Add to Windsurf workspace (.windsurfrules)? [y/N]" "n" "windsurf"
append_or_replace ".clinerules" "❓ Add to Cline CLI (.clinerules)? [y/N]" "n" "cline"
append_or_replace ".roomodes" "❓ Add to Roo Code (.roomodes)? [y/N]" "n" "roo"
append_or_replace ".aider.instructions.md" "❓ Add to Aider (.aider.instructions.md)? [y/N]" "n" "aider"

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
    echo "ℹ️  No installation selected. Downloading to ./plugins/co-dialectic/skills/co-dialectic/SKILL.md"
    mkdir -p plugins/co-dialectic/skills/co-dialectic
    cp "$TMP_SKILL" "plugins/co-dialectic/skills/co-dialectic/SKILL.md"
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

# Apply Telemetry — one pixel per tool for per-LLM install tracking
if [ "$TRACK_OPT_IN" = true ]; then
    for TOOL in $(echo "$INSTALLED_TOOLS" | tr ',' '\n' | sed '/^$/d'); do
        curl -s "https://static.scarf.sh/a.png?x-pxid=4a0ef8e3-2d13-4c30-841a-0ba3b3cf5c62&version=$SELECTED_VER&tool=$TOOL&os=$OSTYPE" > /dev/null 2>&1 &
    done
fi

rm -f "$TMP_SKILL"
echo ""
echo "🎉 Done! Co-Dialectic is ready."
echo "⚠️  IMPORTANT: You MUST start a completely new chat/session for the instructions to take effect."
