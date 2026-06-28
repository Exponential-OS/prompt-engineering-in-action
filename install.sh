#!/bin/bash
# product-vs-solution: example - install script references owner gateway URL (legitimate distribution channel).
# Co-Dialectic Manager
# Usage: curl -fsSL https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main/install.sh | bash

set -e

REPO="https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main"
VERSION="4.25.0"
CONFIG_DIR="$HOME/.co-dialectic"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
TARGET_ARG="auto"
VERSION_ARG=""

# Co-Dialectic plugin skill inventory (v4.3.0). Shared by install + uninstall.
# Append a new skill name here when a new skill is added to the plugin.
# Skills that ship executable helpers also need an entry in fetch_skill_extras().
PLUGIN_SKILLS=(
    "co-dialectic"
    "calibration-auditor"
    "fish-swarm"
    "hallucination-detector"
    "handoff"
    "judge-panel"
    "unknown-unknown"
    "waky-waky"
)

fetch_repo_file() {
    local source_url="$1"
    local target_file="$2"
    local local_path="${source_url#"$REPO/"}"

    if [ -f "$source_url" ]; then
        cp "$source_url" "$target_file"
    elif [ "$local_path" != "$source_url" ] && [ -f "$local_path" ]; then
        cp "$local_path" "$target_file"
    elif [ "$local_path" != "$source_url" ] && [ -f "$SCRIPT_DIR/$local_path" ]; then
        cp "$SCRIPT_DIR/$local_path" "$target_file"
    else
        if curl -fsSL "$source_url" -o "$target_file" 2>/dev/null; then
            return 0
        fi
        case "$local_path" in
            plugins/co-dialectic/adapters/cursor/co-dialectic.mdc)
                write_cursor_adapter "$target_file"
                ;;
            plugins/co-dialectic/adapters/codex/AGENTS.md)
                write_codex_adapter "$target_file"
                ;;
            *)
                return 1
                ;;
        esac
    fi
}

# -----------------------------------------
# BACKGROUND CHECKER
# -----------------------------------------
if [ "$1" = "--bg-check" ]; then
    mkdir -p "$CONFIG_DIR"
    # Read YAML-frontmatter `version: "X.Y.Z"` first (v3+), fall back to legacy `**Version:**`.
    TMP_BG_SKILL=$(mktemp)
    if fetch_repo_file "$REPO/plugins/co-dialectic/skills/co-dialectic/SKILL.md" "$TMP_BG_SKILL"; then
        SKILL_REMOTE=$(cat "$TMP_BG_SKILL")
    else
        SKILL_REMOTE=""
    fi
    rm -f "$TMP_BG_SKILL"
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

while [ "$#" -gt 0 ]; do
    case "$1" in
        --target)
            shift
            TARGET_ARG="${1:-auto}"
            ;;
        --target=*)
            TARGET_ARG="${1#--target=}"
            ;;
        --lite)
            VERSION_ARG="lite"
            ;;
        --full)
            VERSION_ARG="full"
            ;;
        --help|-h)
            echo "Usage: install.sh [--target auto|cursor|codex|all] [--lite|--full]"
            exit 0
            ;;
    esac
    shift
done

case "$TARGET_ARG" in
    auto|cursor|codex|all) ;;
    *)
        echo "❌ Unknown --target '$TARGET_ARG'. Use cursor, codex, all, or auto."
        exit 1
        ;;
esac

write_cursor_adapter() {
    local target_file="$1"
    cat > "$target_file" <<'EOF'
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
EOF
}

write_codex_adapter() {
    local target_file="$1"
    cat > "$target_file" <<'EOF'
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
EOF
}

# -----------------------------------------
# UI HELPERS
# -----------------------------------------
echo "🧠 Co-Dialectic Manager (v$VERSION)"
echo "=================================="

ask_user() {
    local prompt="$1"
    local default="$2"
    local reply
    if [ -t 0 ]; then
        read -r -p "$prompt " reply
    elif [ -c /dev/tty ] && { read -r -p "$prompt " reply </dev/tty; } 2>/dev/null; then
        :
    else
        echo -n "$prompt "
        reply="$default"
        echo "$reply (auto-selected)"
    fi
    if [[ -z "$reply" ]]; then reply="$default"; fi
    case "$reply" in [Yy]* ) return 0 ;; * ) return 1 ;; esac
}

ask_choice() {
    local prompt="$1"
    local default="$2"
    local reply
    if [ -t 0 ]; then
        read -r -p "$prompt " reply
    elif [ -c /dev/tty ] && { read -r -p "$prompt " reply </dev/tty; } 2>/dev/null; then
        :
    else
        echo -n "$prompt "
        reply="$default"
        echo "$reply (auto-selected)"
    fi
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
if [ "$TARGET_ARG" = "auto" ]; then
    MENU_CHOICE=$(ask_choice "Select [1, 2, or 3]:" "1")
else
    MENU_CHOICE="1"
fi

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
    if [ -f ".cursor/rules/co-dialectic.mdc" ]; then
        rm -f ".cursor/rules/co-dialectic.mdc"
        echo "   Removed .cursor/rules/co-dialectic.mdc"
    fi
    if [ -f "AGENTS.md" ] && grep -q "### BEGIN CO-DIALECTIC ###" "AGENTS.md"; then
        awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "AGENTS.md" > "AGENTS.md.tmp"
        cat "AGENTS.md.tmp" > "AGENTS.md"
        rm "AGENTS.md.tmp"
        echo "   Removed from AGENTS.md"
    fi
    
    # 2b. Remove fish gate hook from ~/.claude/settings.json
    unwire_agent_hook

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
if [ "$VERSION_ARG" = "lite" ]; then
    VERSION_CHOICE="2"
elif [ "$VERSION_ARG" = "full" ]; then
    VERSION_CHOICE="1"
elif [ "$TARGET_ARG" != "auto" ]; then
    VERSION_CHOICE="2"
else
    VERSION_CHOICE=$(ask_choice "Select [1/2]:" "1")
fi

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
fetch_repo_file "$SKILL_URL" "$TMP_SKILL"

INSTALLED=false
INSTALLED_TOOLS=""
TRACK_OPT_IN=false
BG_UPDATES=false

if [ "$TARGET_ARG" = "auto" ]; then
    if ask_user "📊 Share anonymous install metrics to help the project (OS/Tool choices)? [Y/n]" "y"; then
        TRACK_OPT_IN=true
    fi
    if ask_user "🔄 Enable weekly background checks for updates? [Y/n]" "y"; then
        BG_UPDATES=true
    fi
fi

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
            if curl -fsSL "$REPO/plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.ts" -o "$skill_dir/scripts/judge_panel.ts"; then
                chmod +x "$skill_dir/scripts/judge_panel.ts" 2>/dev/null || true
                echo "      └─ scripts/judge_panel.ts (cascade harness)"
            else
                echo "      └─ ⚠️  failed to fetch scripts/judge_panel.ts — judge-panel will not be functional"
            fi
            ;;
    esac
}

# -----------------------------------------
# FISH GATE INSTALL + HOOK WIRING
# -----------------------------------------
FISH_INSTALL_DIR="$HOME/.claude/skills/co-dialectic/fish"
FISH_HOOK_CMD="bun run $HOME/.claude/skills/co-dialectic/fish/hooks/claude-code.ts"

install_fish_gate() {
    # Downloads handler.ts + hooks/claude-code.ts into the installed skill dir.
    # These are the runtime primitives; the hook wiring happens in wire_agent_hook().
    local failed=0
    mkdir -p "$FISH_INSTALL_DIR/hooks"

    if curl -fsSL "$REPO/plugins/co-dialectic/fish/handler.ts" \
            -o "$FISH_INSTALL_DIR/handler.ts" 2>/dev/null; then
        chmod +x "$FISH_INSTALL_DIR/handler.ts"
        echo "   ✅ fish/handler.ts (pre-task gate engine)"
    else
        echo "   ⚠️  failed to fetch fish/handler.ts"
        failed=$((failed + 1))
    fi

    if curl -fsSL "$REPO/plugins/co-dialectic/fish/hooks/claude-code.ts" \
            -o "$FISH_INSTALL_DIR/hooks/claude-code.ts" 2>/dev/null; then
        chmod +x "$FISH_INSTALL_DIR/hooks/claude-code.ts"
        echo "   ✅ fish/hooks/claude-code.ts (Claude Code PreToolUse adapter)"
    else
        echo "   ⚠️  failed to fetch fish/hooks/claude-code.ts"
        failed=$((failed + 1))
    fi

    return $failed
}

wire_agent_hook() {
    # Merges the Agent PreToolUse hook into ~/.claude/settings.json via Python stdlib.
    # Idempotent — skips if already wired to this path.
    local settings="$HOME/.claude/settings.json"
    if [ ! -f "$settings" ]; then
        echo "   ℹ️  ~/.claude/settings.json not found — skipping hook wiring"
        return
    fi

    python3 - "$settings" "$FISH_HOOK_CMD" << 'PYEOF'
import json, sys, os

settings_path = sys.argv[1]
hook_cmd      = sys.argv[2]

try:
    with open(settings_path) as f:
        settings = json.load(f)
except (OSError, json.JSONDecodeError) as e:
    print(f"   ⚠️  Could not read {settings_path}: {e}")
    sys.exit(0)

new_entry = {
    "matcher": "Agent",
    "hooks": [{"type": "command", "command": hook_cmd, "timeout": 25}]
}

hooks    = settings.setdefault("hooks", {})
pretool  = hooks.setdefault("PreToolUse", [])

# Idempotency: skip if any Agent matcher already points to our fish adapter.
already = any(
    e.get("matcher") == "Agent" and
    any("co-dialectic/fish/hooks/claude-code.ts" in h.get("command", "")
        for h in e.get("hooks", []))
    for e in pretool
)

if already:
    print("   ✅ Fish gate hook already wired in ~/.claude/settings.json")
    sys.exit(0)

pretool.append(new_entry)

try:
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)
    print("   ✅ Fish gate hook wired → ~/.claude/settings.json (PreToolUse → Agent)")
except OSError as e:
    print(f"   ⚠️  Could not write {settings_path}: {e}")
PYEOF
}

unwire_agent_hook() {
    # Removes the co-dialectic fish gate hook from ~/.claude/settings.json.
    local settings="$HOME/.claude/settings.json"
    [ -f "$settings" ] || return

    python3 - "$settings" << 'PYEOF'
import json, sys

settings_path = sys.argv[1]
try:
    with open(settings_path) as f:
        settings = json.load(f)
except (OSError, json.JSONDecodeError):
    sys.exit(0)

pretool = settings.get("hooks", {}).get("PreToolUse", [])
before  = len(pretool)
settings["hooks"]["PreToolUse"] = [
    e for e in pretool
    if not (
        e.get("matcher") == "Agent" and
        any("co-dialectic/fish/hooks/claude-code.ts" in h.get("command", "")
            for h in e.get("hooks", []))
    )
]

if len(settings["hooks"]["PreToolUse"]) < before:
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)
    print("   ✅ Fish gate hook removed from ~/.claude/settings.json")
else:
    print("   ℹ️  Fish gate hook not found in ~/.claude/settings.json")
PYEOF
}

download_skills_direct() {
    # Download all PLUGIN_SKILLS to $1/$skill/SKILL.md without prompting.
    # Used as the silent fallback when `claude plugin install` is unavailable
    # or the user declines the plugin path.
    local target_base="$1"
    local tool_name="$2"
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
        if fetch_repo_file "$skill_src" "$skill_dir/SKILL.md"; then
            echo "   ✅ $skill_dir/SKILL.md"
            fetch_skill_extras "$skill" "$skill_dir"
        else
            echo "   ❌ failed to fetch $skill/SKILL.md"
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
        if fetch_repo_file "$skill_src" "$skill_dir/SKILL.md"; then
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

install_owned_file() {
    local source_url="$1"
    local target_file="$2"
    local prompt_msg="$3"
    local default_ans="$4"
    local tool_name="$5"
    local force="${6:-false}"
    local tmp_file

    if [ "$force" != "true" ] && ! ask_user "$prompt_msg" "$default_ans"; then
        return
    fi

    mkdir -p "$(dirname "$target_file")"
    tmp_file=$(mktemp)
    if fetch_repo_file "$source_url" "$tmp_file"; then
        cat "$tmp_file" > "$target_file"
        rm -f "$tmp_file"
        echo "   ✅ Installed $target_file"
        INSTALLED=true
        INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name"
    else
        rm -f "$tmp_file"
        echo "   ❌ failed to fetch $source_url"
    fi
}

append_or_replace_remote() {
    local source_url="$1"
    local target_file="$2"
    local prompt_msg="$3"
    local default_ans="$4"
    local tool_name="$5"
    local force="${6:-false}"
    local tmp_file

    if [ "$force" != "true" ] && ! ask_user "$prompt_msg" "$default_ans"; then
        return
    fi

    tmp_file=$(mktemp)
    if ! fetch_repo_file "$source_url" "$tmp_file"; then
        rm -f "$tmp_file"
        echo "   ❌ failed to fetch $source_url"
        return
    fi

    if [ ! -f "$target_file" ]; then
        cat "$tmp_file" > "$target_file"
        echo "   ✅ Added to $target_file"
    elif grep -q "### BEGIN CO-DIALECTIC ###" "$target_file" 2>/dev/null; then
        awk '/### BEGIN CO-DIALECTIC ###/{flag=1} !flag {print} /### END CO-DIALECTIC ###/{flag=0}' "$target_file" > "${target_file}.tmp"
        cat "$tmp_file" >> "${target_file}.tmp"
        cat "${target_file}.tmp" > "$target_file"
        rm "${target_file}.tmp"
        echo "   ✅ Updated $target_file"
    else
        echo "" >> "$target_file"
        cat "$tmp_file" >> "$target_file"
        echo "   ✅ Added to $target_file"
    fi
    rm -f "$tmp_file"
    INSTALLED=true
    INSTALLED_TOOLS="$INSTALLED_TOOLS,$tool_name"
}

target_selected() {
    local target="$1"
    [ "$TARGET_ARG" = "all" ] && return 0
    case ",$TARGET_ARG," in
        *",$target,"*) return 0 ;;
        *) return 1 ;;
    esac
}

echo ""
echo "Scanning for AI environments..."
echo ""

if [ "$TARGET_ARG" != "auto" ]; then
    if target_selected "cursor"; then
        install_owned_file \
            "$REPO/plugins/co-dialectic/adapters/cursor/co-dialectic.mdc" \
            ".cursor/rules/co-dialectic.mdc" \
            "✅ Install Cursor project rules to .cursor/rules/co-dialectic.mdc? [Y/n]" \
            "y" \
            "cursor_mdc" \
            "true"
    fi
    if target_selected "codex"; then
        append_or_replace_remote \
            "$REPO/plugins/co-dialectic/adapters/codex/AGENTS.md" \
            "AGENTS.md" \
            "✅ Add Codex instructions to AGENTS.md? [Y/n]" \
            "y" \
            "codex_agents" \
            "true"
    fi
    if [ "$INSTALLED" = false ]; then
        echo "❌ No installation completed for --target '$TARGET_ARG'. See fetch errors above."
        exit 1
    fi
else

# Directory-based plugin installs (Antigravity, Claude Code) — all 6 skills.
# For Claude Code users the recommended path is `/plugin install co-dialectic@xos`
# via the marketplace; this installer path is the fallback for users not going
# through the plugin marketplace (e.g., they hit install.sh from a gift prompt).
if [ -d "$HOME/.gemini/antigravity/skills" ]; then
    install_plugin "$HOME/.gemini/antigravity/skills" "✅ Detected Antigravity. Install all 6 Co-Dialectic skills here? [Y/n]" "y" "antigravity"
    echo ""
fi

if [ -d "$HOME/.claude" ]; then
    if command -v claude > /dev/null 2>&1; then
        # Claude CLI present — prefer repo-native plugin install; fall back to direct download
        _use_direct=true
        if ask_user "✅ Detected Claude Code. Install via 'claude plugin install co-dialectic@xos' (recommended)? [Y/n]" "y"; then
            claude plugin marketplace add Exponential-OS/agent-marketplace > /dev/null 2>&1 || true
            if claude plugin install co-dialectic@xos 2>/dev/null; then
                echo "   ✅ Installed via claude plugin (co-dialectic@xos)"
                # The plugin system does not register a skill whose name matches
                # the plugin itself (naming collision). Install the main skill
                # directly so `codi on` resolves correctly.
                mkdir -p "$HOME/.claude/skills/co-dialectic"
                if fetch_repo_file "$REPO/plugins/co-dialectic/skills/co-dialectic/SKILL.md" \
                        "$HOME/.claude/skills/co-dialectic/SKILL.md"; then
                    echo "   ✅ co-dialectic skill registered at ~/.claude/skills/"
                else
                    echo "   ⚠️  Could not fetch main skill file — run installer again to retry"
                fi
                # Fish gate: download handler.ts + adapter and wire the PreToolUse hook
                echo "   ⬇️  Installing fish gate (pre-task approach checker)..."
                if install_fish_gate; then
                    wire_agent_hook
                else
                    echo "   ⚠️  Fish gate install incomplete — hook not wired"
                fi
                INSTALLED=true
                INSTALLED_TOOLS="$INSTALLED_TOOLS,claude_code"
                _use_direct=false
            else
                echo "   ⚠️  Plugin install unavailable. Falling back to direct download..."
            fi
        else
            echo "   ℹ️  Skipping plugin install — using direct download..."
        fi
        if [ "$_use_direct" = true ]; then
            mkdir -p "$HOME/.claude/skills"
            download_skills_direct "$HOME/.claude/skills" "claude_code"
            echo "   ⬇️  Installing fish gate (pre-task approach checker)..."
            if install_fish_gate; then
                wire_agent_hook
            else
                echo "   ⚠️  Fish gate install incomplete — hook not wired"
            fi
        fi
    else
        mkdir -p "$HOME/.claude/skills"
        install_plugin "$HOME/.claude/skills" "✅ Detected Claude Code. Install all ${#PLUGIN_SKILLS[@]} skills here? (run 'claude plugin install co-dialectic@xos' if you have the CLI) [Y/n]" "y" "claude_code"
    fi
    echo ""
fi

if [ -d ".cursor" ] || [ -f ".cursorrules" ]; then
    install_owned_file \
        "$REPO/plugins/co-dialectic/adapters/cursor/co-dialectic.mdc" \
        ".cursor/rules/co-dialectic.mdc" \
        "✅ Detected Cursor project. Install modern Cursor rule to .cursor/rules/co-dialectic.mdc? [Y/n]" \
        "y" \
        "cursor_mdc"
    echo ""
fi

if [ -f "AGENTS.md" ] || command -v codex > /dev/null 2>&1; then
    append_or_replace_remote \
        "$REPO/plugins/co-dialectic/adapters/codex/AGENTS.md" \
        "AGENTS.md" \
        "✅ Detected Codex. Add workspace instructions to AGENTS.md? [Y/n]" \
        "y" \
        "codex_agents"
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
    mkdir -p "$(dirname "$PLIST_FILE")"
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
    if launchctl load "$PLIST_FILE" 2>/dev/null; then
        echo "⏰ Native background updater installed (checks weekly via launchd)."
    else
        echo "⚠️  Could not load macOS background updater. Run the installer from a normal user terminal to enable weekly checks."
    fi
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
