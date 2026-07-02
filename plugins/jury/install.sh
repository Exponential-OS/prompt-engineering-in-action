#!/bin/bash
# Jury plugin installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main/plugins/jury/install.sh | bash

set -e

REPO="${JURY_REPO:-https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main}"
VERSION="0.1.0"
CONFIG_DIR="$HOME/.jury"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
TARGET_ARG="auto"

fetch_repo_file() {
    local source_url="$1"
    local target_file="$2"
    local local_path="${source_url#"$REPO/"}"

    if [ -f "$source_url" ]; then
        cp "$source_url" "$target_file"
    elif [ "$local_path" != "$source_url" ] && [ -f "$local_path" ]; then
        cp "$local_path" "$target_file"
    elif [ "$local_path" != "$source_url" ] && [ -f "$SCRIPT_DIR/../../$local_path" ]; then
        cp "$SCRIPT_DIR/../../$local_path" "$target_file"
    elif [ "$local_path" != "$source_url" ] && [ -f "$SCRIPT_DIR/$local_path" ]; then
        cp "$SCRIPT_DIR/$local_path" "$target_file"
    else
        curl -fsSL "$source_url" -o "$target_file"
    fi
}

usage() {
    echo "Usage: install.sh [--target auto|claude|antigravity|all]"
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --target)
            shift
            TARGET_ARG="${1:-auto}"
            ;;
        --target=*)
            TARGET_ARG="${1#--target=}"
            ;;
        auto|claude|antigravity|all)
            TARGET_ARG="$1"
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument '$1'"
            usage
            exit 1
            ;;
    esac
    shift
done

case "$TARGET_ARG" in
    auto|claude|antigravity|all) ;;
    *)
        echo "Unknown target '$TARGET_ARG'"
        usage
        exit 1
        ;;
esac

install_jury_skill() {
    local target_base="$1"
    local tool_name="$2"
    local skill_dir="$target_base/jury"

    mkdir -p "$skill_dir/scripts"
    fetch_repo_file "$REPO/plugins/jury/skills/jury/SKILL.md" "$skill_dir/SKILL.md"
    fetch_repo_file "$REPO/plugins/jury/skills/jury/scripts/jury_panel.ts" "$skill_dir/scripts/jury_panel.ts"
    chmod +x "$skill_dir/scripts/jury_panel.ts" 2>/dev/null || true
    echo "Installed jury skill to $skill_dir ($tool_name)"
}

echo "Jury installer (v$VERSION)"

INSTALLED=false

if [ "$TARGET_ARG" = "claude" ] || [ "$TARGET_ARG" = "all" ]; then
    mkdir -p "$HOME/.claude/skills"
    install_jury_skill "$HOME/.claude/skills" "claude"
    INSTALLED=true
fi

if [ "$TARGET_ARG" = "antigravity" ] || [ "$TARGET_ARG" = "all" ]; then
    mkdir -p "$HOME/.gemini/antigravity/skills"
    install_jury_skill "$HOME/.gemini/antigravity/skills" "antigravity"
    INSTALLED=true
fi

if [ "$TARGET_ARG" = "auto" ]; then
    if [ -d "$HOME/.claude" ] || command -v claude >/dev/null 2>&1; then
        mkdir -p "$HOME/.claude/skills"
        install_jury_skill "$HOME/.claude/skills" "claude"
        INSTALLED=true
    fi
    if [ -d "$HOME/.gemini/antigravity/skills" ]; then
        install_jury_skill "$HOME/.gemini/antigravity/skills" "antigravity"
        INSTALLED=true
    fi
fi

if [ "$INSTALLED" = false ]; then
    mkdir -p "$HOME/.claude/skills"
    install_jury_skill "$HOME/.claude/skills" "claude"
fi

mkdir -p "$CONFIG_DIR"
echo "$VERSION" > "$CONFIG_DIR/version.txt"

echo "Jury is ready. Start a new session for the skill to load."
