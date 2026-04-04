#!/bin/bash
# Co-Dialectic Plugin & Distribution Test Suite
# Run: bash test-plugin.sh
# Run post-push: bash test-plugin.sh --remote

set -euo pipefail

PASS=0
FAIL=0
WARN=0
CHECK_REMOTE=false
REPO="https://raw.githubusercontent.com/thewhyman/prompt-engineering-in-action/main"

if [ "${1:-}" = "--remote" ]; then
    CHECK_REMOTE=true
fi

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
    plugins/co-dialectic/skills/co-dialectic/SKILL-chatgpt.md \
    plugins/co-dialectic/skills/co-dialectic/SKILL-chatgpt-lite.md \
    plugins/co-dialectic/README.md \
    plugins/co-dialectic/install-instructions.md \
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
# 3. No symlinks
# -----------------------------------------------
echo ""
echo "=== 3. No symlinks ==="
SYMLINKS=$(find . -type l -not -path './.git/*' 2>/dev/null | head -5)
[ -z "$SYMLINKS" ] && pass "no symlinks found" || fail "symlinks found: $SYMLINKS"

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
# Extract download paths from install.sh (lines with $REPO/)
for path in $(grep -o '\$REPO/[^ "]*' install.sh | sed 's/\$REPO\///' | sort -u); do
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
# Summary
# -----------------------------------------------
echo ""
echo "========================================="
echo "  PASS: $PASS  |  FAIL: $FAIL  |  WARN: $WARN"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
