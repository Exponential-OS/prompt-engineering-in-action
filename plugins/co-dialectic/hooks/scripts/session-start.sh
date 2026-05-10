#!/usr/bin/env bash
# session-start.sh — Co-Dialectic session init + userSettings skill sync
# Fires at SessionStart.
# 1. Syncs ~/.claude/skills/co-dialectic/SKILL.md from plugin cache when stale.
# 2. Injects kernel stub so P0 fires even before SKILL.md is invoked.
set -euo pipefail

PLUGIN_SKILL="${CLAUDE_PLUGIN_ROOT}/skills/co-dialectic/SKILL.md"
USER_SKILL_DIR="${HOME}/.claude/skills/co-dialectic"
USER_SKILL="${USER_SKILL_DIR}/SKILL.md"

# Extract version from a SKILL.md file (reads frontmatter version: "X.Y.Z")
get_version() {
    grep -m1 'version:' "$1" 2>/dev/null | sed 's/.*version:[[:space:]]*"\{0,1\}\([0-9.]*\)"\{0,1\}.*/\1/' || echo ""
}

PLUGIN_VERSION=$(get_version "${PLUGIN_SKILL}")
USER_VERSION=$(get_version "${USER_SKILL}" 2>/dev/null || echo "")

if [ "${USER_VERSION}" != "${PLUGIN_VERSION}" ]; then
    mkdir -p "${USER_SKILL_DIR}"
    cp "${PLUGIN_SKILL}" "${USER_SKILL}"
fi

# Orphan sweep: poll lifecycle registry for stuck/timed-out agents from prior sessions.
LIFECYCLE_SCRIPT="${CLAUDE_PLUGIN_ROOT}/fish/scripts/agent_lifecycle.py"
LIFECYCLE_MSG=""
if [ -f "${LIFECYCLE_SCRIPT}" ]; then
    POLL_OUT=$(python3 "${LIFECYCLE_SCRIPT}" poll --timeout-min 10 2>/dev/null || echo '{}')
    STUCK_COUNT=$(echo "${POLL_OUT}" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(len(d.get('stuck', [])))
except Exception:
    print(0)
" 2>/dev/null || echo "0")
    if [ "${STUCK_COUNT}" != "0" ]; then
        LIFECYCLE_MSG=" ⚠️ ${STUCK_COUNT} background agent(s) timed out from a prior session — check status: python3 ${LIFECYCLE_SCRIPT} status"
    fi
fi

printf '{"systemMessage":"Co-Dialectic v%s loaded. Status line REQUIRED on every response: {Icon} {Domain} ({Name}) · {X}%%. Default persona: ⚡ Productivity (Tim Ferriss). Default mode: 🛞 Drive. New user? Type /co-dialectic-onboarding. Protocols absent? Type /co-dialectic.%s"}\n' "${PLUGIN_VERSION}" "${LIFECYCLE_MSG}"
