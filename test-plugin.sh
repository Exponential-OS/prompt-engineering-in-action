#!/bin/bash
# Co-Dialectic Plugin & Distribution Test Suite
# Run: bash test-plugin.sh
# Run post-push: bash test-plugin.sh --remote

set -euo pipefail

PASS=0
FAIL=0
WARN=0
CHECK_REMOTE=false
REPO="https://raw.githubusercontent.com/Exponential-OS/prompt-engineering-in-action/main"

CHECK_SMOKE=false

for arg in "$@"; do
    case "$arg" in
        --remote)        CHECK_REMOTE=true ;;
        --smoke-install) CHECK_SMOKE=true ;;
    esac
done

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

# -----------------------------------------------
# 1. Plugin structure
# -----------------------------------------------
echo "=== 1. Plugin file structure ==="
for f in \
    .claude-plugin/marketplace.json \
    plugins/co-dialectic/.claude-plugin/plugin.json \
    plugins/co-dialectic/skills/co-dialectic/SKILL.md \
    plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md \
    plugins/co-dialectic/README.md \
    install.sh \
    install.ps1; do
    [ -f "$f" ] && pass "$f" || fail "$f missing"
done

# -----------------------------------------------
# 2. No orphaned directories
# -----------------------------------------------
echo ""
echo "=== 2. No orphaned directories ==="
[ ! -d "co-dialectic" ] && pass "co-dialectic/ removed" || fail "co-dialectic/ still exists"
[ ! -d "skills" ] && pass "root skills/ removed" || fail "root skills/ still exists"

# -----------------------------------------------
# 3. No unexpected symlinks (GEMINI.md→CLAUDE.md is intentional)
# -----------------------------------------------
echo ""
echo "=== 3. No unexpected symlinks ==="
SYMLINKS=$(find . -type l -not -path './.git/*' -not -name 'GEMINI.md' 2>/dev/null | head -5)
[ -z "$SYMLINKS" ] && pass "no unexpected symlinks found" || fail "symlinks found: $SYMLINKS"
# Verify GEMINI.md symlink target is correct
if [ -L "./GEMINI.md" ]; then
    TARGET=$(readlink "./GEMINI.md")
    [ "$TARGET" = "CLAUDE.md" ] && pass "GEMINI.md → CLAUDE.md symlink correct" || fail "GEMINI.md points to $TARGET (expected CLAUDE.md)"
fi

# -----------------------------------------------
# 4. JSON validity
# -----------------------------------------------
echo ""
echo "=== 4. JSON validity ==="
python3 -m json.tool .claude-plugin/marketplace.json > /dev/null 2>&1 \
    && pass "marketplace.json valid" || fail "marketplace.json invalid JSON"
python3 -m json.tool plugins/co-dialectic/.claude-plugin/plugin.json > /dev/null 2>&1 \
    && pass "plugin.json valid" || fail "plugin.json invalid JSON"

# -----------------------------------------------
# 5. SKILL.md frontmatter and markers
# -----------------------------------------------
echo ""
echo "=== 5. SKILL.md format ==="
head -1 plugins/co-dialectic/skills/co-dialectic/SKILL.md | grep -q "^---" \
    && pass "YAML frontmatter present" || fail "no YAML frontmatter"
grep -q "### BEGIN CO-DIALECTIC ###" plugins/co-dialectic/skills/co-dialectic/SKILL.md \
    && pass "BEGIN marker present" || fail "BEGIN marker missing"
grep -q "### END CO-DIALECTIC ###" plugins/co-dialectic/skills/co-dialectic/SKILL.md \
    && pass "END marker present" || fail "END marker missing"

# -----------------------------------------------
# 6. Marketplace source path resolves
# -----------------------------------------------
echo ""
echo "=== 6. Marketplace source path ==="
SOURCE=$(python3 -c "import json; print(json.load(open('.claude-plugin/marketplace.json'))['plugins'][0]['source'])")
[ -d "$SOURCE" ] && pass "source dir exists: $SOURCE" || fail "source dir missing: $SOURCE"
[ -f "$SOURCE/.claude-plugin/plugin.json" ] && pass "plugin.json at source" || fail "no plugin.json at source"

# -----------------------------------------------
# 7. Version consistency
# -----------------------------------------------
echo ""
echo "=== 7. Version consistency ==="
MKT_VER=$(python3 -c "import json; print(json.load(open('.claude-plugin/marketplace.json'))['plugins'][0]['version'])")
PLG_VER=$(python3 -c "import json; print(json.load(open('plugins/co-dialectic/.claude-plugin/plugin.json'))['version'])")
SKILL_VER=$(grep '^\*\*Version:\*\*' plugins/co-dialectic/skills/co-dialectic/SKILL.md | head -1 | awk '{print $2}')
SCRIPT_VER=$(grep '^VERSION=' install.sh | head -1 | sed 's/VERSION="//' | sed 's/"//')

echo "  marketplace.json: $MKT_VER"
echo "  plugin.json:      $PLG_VER"
echo "  SKILL.md:         $SKILL_VER"
echo "  install.sh:       $SCRIPT_VER"

if [ "$MKT_VER" = "$PLG_VER" ] && [ "$PLG_VER" = "$SKILL_VER" ] && [ "$SKILL_VER" = "$SCRIPT_VER" ]; then
    pass "all 4 versions match ($MKT_VER)"
else
    fail "version mismatch"
fi

# -----------------------------------------------
# 8. Install script paths reference correct files
# -----------------------------------------------
echo ""
echo "=== 8. Install script paths ==="
# Extract static download paths from install.sh (lines with $REPO/), skip loop-variable paths (e.g. $skill)
for path in $(grep -o '\$REPO/[^ "]*' install.sh | sed 's/\$REPO\///' | grep -v '\$' | sort -u); do
    [ -f "$path" ] && pass "$path" || fail "$path missing locally"
done

# -----------------------------------------------
# 9. README relative links
# -----------------------------------------------
echo ""
echo "=== 9. README relative links ==="
for link in $(grep -oE '\]\(([^)]+)\)' README.md | sed 's/\](\(.*\))/\1/' | sed 's/#.*//' | grep -v '^http' | grep -v '^$' | sort -u); do
    [ -e "$link" ] && pass "$link" || fail "$link broken"
done

# -----------------------------------------------
# 10. Plugin README relative links
# -----------------------------------------------
echo ""
echo "=== 10. Plugin README relative links ==="
for link in $(grep -oE '\]\(([^)]+)\)' plugins/co-dialectic/README.md | sed 's/\](\(.*\))/\1/' | sed 's/#.*//' | grep -v '^http' | grep -v '^$' | sort -u); do
    target="plugins/co-dialectic/$link"
    [ -e "$target" ] && pass "$link" || fail "$link -> $target broken"
done

# -----------------------------------------------
# 11. Scarf gateway and telemetry URLs
# -----------------------------------------------
echo ""
echo "=== 11. Scarf URLs present ==="
grep -q "thewhyman.gateway.scarf.sh/install.sh" README.md \
    && pass "Scarf gateway URL in README (shell)" || fail "Scarf gateway URL missing from README (shell)"
grep -q "thewhyman.gateway.scarf.sh/install.ps1" README.md \
    && pass "Scarf gateway URL in README (powershell)" || fail "Scarf gateway URL missing from README (powershell)"
grep -q "static.scarf.sh/a.png" README.md \
    && pass "Scarf telemetry pixel in README" || fail "Scarf telemetry pixel missing from README"
grep -q "static.scarf.sh/a.png" install.sh \
    && pass "Scarf telemetry in install.sh" || fail "Scarf telemetry missing from install.sh"
grep -q "static.scarf.sh/a.png" install.ps1 \
    && pass "Scarf telemetry in install.ps1" || fail "Scarf telemetry missing from install.ps1"

# -----------------------------------------------
# 12. No stale co-dialectic/ refs (outside plugins/)
# -----------------------------------------------
echo ""
echo "=== 12. No stale path references ==="
STALE=$(grep -rn 'co-dialectic/SKILL' README.md install.sh install.ps1 2>/dev/null \
    | grep -v 'plugins/co-dialectic' \
    | grep -v '\$HOME' \
    | grep -v '\$ClaudePath' \
    | grep -v '\$AntigravityPath' \
    | grep -v '\$target_base' \
    | grep -v 'gemini/antigravity' \
    | grep -v '\.claude/skills' || true)
[ -z "$STALE" ] && pass "no stale co-dialectic/ refs" || fail "stale refs found: $STALE"

# -----------------------------------------------
# 13. Remote URL checks (optional, post-push)
# -----------------------------------------------
if [ "$CHECK_REMOTE" = true ]; then
    echo ""
    echo "=== 13. Remote URL checks ==="
    for path in \
        install.sh \
        install.ps1 \
        plugins/co-dialectic/skills/co-dialectic/SKILL.md \
        plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md; do
        STATUS=$(curl -fsSL -o /dev/null -w "%{http_code}" "$REPO/$path" 2>/dev/null || echo "000")
        [ "$STATUS" = "200" ] && pass "$path (HTTP $STATUS)" || fail "$path (HTTP $STATUS)"
    done

    echo ""
    echo "=== 14. Scarf gateway reachable ==="
    SCARF_STATUS=$(curl -fsSL -o /dev/null -w "%{http_code}" "https://thewhyman.gateway.scarf.sh/install.sh" 2>/dev/null || echo "000")
    [ "$SCARF_STATUS" = "200" ] && pass "Scarf gateway (HTTP $SCARF_STATUS)" || warn "Scarf gateway (HTTP $SCARF_STATUS)"
fi

# -----------------------------------------------
# 14. Spec / CHANGELOG consistency
# -----------------------------------------------
echo ""
echo "=== 14. Spec / CHANGELOG consistency ==="

# Architecture decisions doc (plugin PRD) must exist
[ -f "plugins/co-dialectic/ARCHITECTURE-DECISIONS.md" ] \
    && pass "ARCHITECTURE-DECISIONS.md exists" \
    || fail "ARCHITECTURE-DECISIONS.md missing"

# CHANGELOG must have an entry for the current version
grep -q "^\#\# \[${PLG_VER}\]" CHANGELOG.md 2>/dev/null \
    && pass "CHANGELOG.md has [${PLG_VER}] entry" \
    || fail "CHANGELOG.md missing [${PLG_VER}] entry"

# Decision-2 compliance: no hardcoded cyborg-substrate paths inside skill source.
# Patterns must be path-like (tilde-anchored or specific known WIP dirs) to
# avoid false positives on generic prose like "brain layer" or "WIP/specs/".
# waky-waky auto-excluded via --exclude-dir: full hook-callback refactor tracked at anand-career-os#27
DECISION2_ALL=$(grep -rn \
    --exclude-dir=waky-waky \
    -e '~/cyborg/' \
    -e '~/anand-career-os/' \
    -e 'brain/identity/' \
    -e 'brain/network/' \
    -e 'brain/sessions/' \
    -e 'brain/projects/' \
    -e 'WIP/career-os-product' \
    -e 'WIP/branding-product' \
    -e 'WIP/prompt-engineering-in-action-product' \
    plugins/co-dialectic/skills/ 2>/dev/null \
    | grep -v '^Binary' \
    | grep -v 'never references\|does not reference\|must not reference\|❌\|Forbidden\|forbidden' \
    || true)
DECISION2_COUNT=$(echo "$DECISION2_ALL" | grep -c . || true)
DECISION2=$(echo "$DECISION2_ALL" | head -5)
[ -z "$DECISION2" ] \
    && pass "No Decision-2 substrate violations in skill source" \
    || fail "Decision-2: $DECISION2_COUNT violation(s) found (showing up to 5): $(echo "$DECISION2" | head -1)"

# -----------------------------------------------
# 15. Marketplace version sync (auto-update if local repo present)
# -----------------------------------------------
echo ""
echo "=== 15. Marketplace version sync ==="
MKT_REPO="$HOME/aiprojects/agent-marketplace"
MKT_FILE="$MKT_REPO/.claude-plugin/marketplace.json"

if [ ! -d "$MKT_REPO" ]; then
    warn "agent-marketplace not found at $MKT_REPO — skipping sync"
else
    MKT_CO_VER=$(python3 -c "
import json, sys
data = json.load(open('$MKT_FILE'))
plugins = {p['name']: p for p in data.get('plugins', [])}
print(plugins.get('co-dialectic', {}).get('version', ''))
" 2>/dev/null || echo "")

    if [ -z "$MKT_CO_VER" ]; then
        fail "Could not read co-dialectic version from $MKT_FILE"
    elif [ "$MKT_CO_VER" = "$PLG_VER" ]; then
        pass "agent-marketplace co-dialectic version matches ($PLG_VER)"
    else
        echo "  SYNC: marketplace=$MKT_CO_VER → plugin=$PLG_VER — auto-updating..."
        PLUGIN_DESC=$(python3 -c "import json; print(json.load(open('plugins/co-dialectic/.claude-plugin/plugin.json'))['description'])" 2>/dev/null || echo "")
        python3 - "$MKT_FILE" "$PLG_VER" "$PLUGIN_DESC" <<'PYEOF'
import json, sys
path, new_ver, new_desc = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(path))
for p in data.get('plugins', []):
    if p['name'] == 'co-dialectic':
        p['version'] = new_ver
        if new_desc:
            p['description'] = new_desc
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PYEOF
        pass "agent-marketplace updated $MKT_CO_VER → $PLG_VER (commit and push needed)"
        warn "Remember to commit $MKT_FILE and push agent-marketplace"
    fi
fi

# -----------------------------------------------
# 16. Install smoke test (--smoke-install)
# -----------------------------------------------
if [ "$CHECK_SMOKE" = true ]; then
    echo ""
    echo "=== 16. Install smoke test ==="
    TMP_HOME=$(mktemp -d)
    mkdir -p "$TMP_HOME/.claude"
    # Guaranteed cleanup on any exit (success, fail, or unexpected error)
    trap 'rm -rf "$TMP_HOME"' EXIT
    echo "  Temp HOME: $TMP_HOME"

    # Auto-responses: 1=Install, 1=Standard, y=Claude Code, n for rest
    ANSWERS=$'1\n1\ny\nn\nn\nn\nn\nn\n'
    if HOME="$TMP_HOME" bash install.sh <<< "$ANSWERS" > /tmp/co-dialectic-smoke.log 2>&1; then
        pass "install.sh exited 0"
    else
        fail "install.sh exited non-zero (see /tmp/co-dialectic-smoke.log)"
    fi

    # Extract skill names from install.sh PLUGIN_SKILLS array
    SMOKE_SKILLS=$(sed -n '/PLUGIN_SKILLS=(/,/^)/p' install.sh | grep '"[a-z]' | tr -d '"' | tr -d ' ')
    SKILL_FAIL=0
    for skill in $SMOKE_SKILLS; do
        if [ -f "$TMP_HOME/.claude/skills/$skill/SKILL.md" ]; then
            pass "Installed: $skill"
        else
            fail "Not installed: $skill"
            SKILL_FAIL=$((SKILL_FAIL + 1))
        fi
    done
    [ "$SKILL_FAIL" -eq 0 ] && pass "All skills landed in temp HOME" || fail "$SKILL_FAIL skill(s) missing after install"
fi

# -----------------------------------------------
# Summary
# -----------------------------------------------
echo ""
echo "========================================="
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
