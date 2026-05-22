#!/usr/bin/env bash
# install-survival-layer.sh — Co-Dialectic auto-install on first SessionStart.
#
# Idempotent. Runs on every SessionStart. Four responsibilities:
#   1. Create ~/.codialectic/state.json if missing (defaults: active=true, mode=drive).
#   2. Copy the current plugin's statusline.sh to ~/.codialectic/statusline.sh
#      (overwrite — keeps the canonical copy fresh on plugin upgrade). The settings.json
#      statusLine entry points at the fixed path, so no version-sort gymnastics.
#   3. Add statusLine block to ~/.claude/settings.json if missing — pointing at the
#      fixed ~/.codialectic/statusline.sh path.
#   4. (v4.17.0) Trigger one-shot migration of ~/.codialectic/state.json to
#      co-dialectic/status-state.json via brain-kernel-bootstrap, if:
#        - BRAIN_WORKSPACE_ROOT or CAREER_HOME env is set (workspace is known), AND
#        - ~/.codialectic/state.json exists (there is legacy state to migrate), AND
#        - co-dialectic/status-state.json does NOT yet exist in the workspace.
#
# This avoids the `ls -v` macOS-vs-Linux portability trap (BSD ls does not version-sort).
# Single canonical path = predictable behavior across platforms.

set -euo pipefail

CODI_DIR="${HOME}/.codialectic"
STATE_FILE="${CODI_DIR}/state.json"
RESIDENT_STATUSLINE="${CODI_DIR}/statusline.sh"
SETTINGS_FILE="${HOME}/.claude/settings.json"
INSTALL_LOG="${CODI_DIR}/install.log"

# Plugin-root statusline.sh — the source of truth this script ships from.
# CLAUDE_PLUGIN_ROOT is set by Claude Code when invoking plugin hooks.
PLUGIN_STATUSLINE="${CLAUDE_PLUGIN_ROOT:-}/hooks/statusline.sh"

mkdir -p "${CODI_DIR}"

# ── 1. Create state.json if missing ──────────────────────────────────────────
if [ ! -f "${STATE_FILE}" ]; then
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  # Read version from the plugin's plugin.json (portable; no ls -v needed)
  CODI_VERSION="unknown"
  if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json" ]; then
    CODI_VERSION=$(python3 -c "
import json, sys
try:
    with open('${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json') as f:
        print(json.load(f).get('version', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null)
  fi
  cat > "${STATE_FILE}" <<EOF
{
  "schema_version": "1.0.0",
  "active": true,
  "mode": "drive",
  "honesty": "grounded",
  "persona": null,
  "persona_icon": null,
  "last_score": null,
  "last_cal": null,
  "wildcard": false,
  "session_start_ts": "${NOW}",
  "version": "${CODI_VERSION}",
  "growth_total_turns": 0,
  "last_updated_ts": "${NOW}"
}
EOF
  echo "[install-survival-layer] Created ${STATE_FILE} (version ${CODI_VERSION})" >&2
fi

# ── 2. Copy current plugin statusline.sh to fixed ~/.codialectic/ path ──────
# Always overwrite — keeps the resident copy fresh on every plugin upgrade.
if [ -f "${PLUGIN_STATUSLINE}" ]; then
  cp "${PLUGIN_STATUSLINE}" "${RESIDENT_STATUSLINE}"
  chmod +x "${RESIDENT_STATUSLINE}"
fi

# ── 3. Add statusLine to ~/.claude/settings.json if missing ─────────────────
if [ -f "${SETTINGS_FILE}" ]; then
  python3 <<'PYEOF' || true
import json
import sys
from pathlib import Path

settings_path = Path.home() / ".claude" / "settings.json"
log_path = Path.home() / ".codialectic" / "install.log"
resident_path = Path.home() / ".codialectic" / "statusline.sh"

try:
    with settings_path.open() as f:
        settings = json.load(f)
except Exception as e:
    print(f"[install-survival-layer] cannot parse settings.json: {e}", file=sys.stderr)
    sys.exit(0)  # fail-open — never break SessionStart

target_cmd = f'bash "{resident_path}"'

# Idempotent: only modify if missing or pointing at the wrong place
if "statusLine" in settings and isinstance(settings["statusLine"], dict):
    if settings["statusLine"].get("command") == target_cmd:
        sys.exit(0)  # already correctly wired

settings["statusLine"] = {
    "type": "command",
    "command": target_cmd,
}

with settings_path.open("w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

with log_path.open("a") as f:
    f.write(f"statusLine wired to {resident_path}\n")

print(f"[install-survival-layer] statusLine wired to {resident_path}", file=sys.stderr)
PYEOF
fi

# ── 4. One-shot migration to brain-kernel (v4.17.0) ──────────────────────────
# Trigger migration only when all three conditions hold:
#   (a) a workspace root is known (BRAIN_WORKSPACE_ROOT or CAREER_HOME is set)
#   (b) legacy state exists at ~/.codialectic/state.json
#   (c) workspace does not yet have co-dialectic/status-state.json
#
# Migration is delegated to brain-kernel-bootstrap.ts via bun.
# Failure here is NON-FATAL — the hook logs the error and continues.
# The next SessionStart will retry until migration succeeds.

WORKSPACE_ROOT="${BRAIN_WORKSPACE_ROOT:-${CAREER_HOME:-}}"
BUN_BIN="${HOME}/.bun/bin/bun"
BOOTSTRAP_TS="${CLAUDE_PLUGIN_ROOT:-}/brain-kernel-bootstrap.ts"

if [ -n "${WORKSPACE_ROOT}" ] && \
   [ -f "${STATE_FILE}" ] && \
   [ ! -f "${WORKSPACE_ROOT}/co-dialectic/status-state.json" ] && \
   [ -f "${BOOTSTRAP_TS}" ] && \
   [ -x "${BUN_BIN}" ]; then

  MIGRATE_OUT=$("${BUN_BIN}" run - <<MIGRATE_SCRIPT 2>&1 || true)
import { createBrain } from "${WORKSPACE_ROOT}/../xos/plugins/brain-kernel/kernel.ts";
import { migrateLocalState } from "${BOOTSTRAP_TS}";

const brain = createBrain("${WORKSPACE_ROOT}");
const result = await migrateLocalState(brain);
process.stdout.write(JSON.stringify(result) + "\n");
MIGRATE_SCRIPT

  MIGRATE_STATUS=$(echo "${MIGRATE_OUT}" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.readline())
    print(d.get('status', 'unknown'))
except Exception:
    print('error')
" 2>/dev/null || echo "error")

  if [ "${MIGRATE_STATUS}" = "migrated" ]; then
    echo "[install-survival-layer] state.json migrated to brain-kernel at ${WORKSPACE_ROOT}/co-dialectic/status-state.json" >&2
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] brain-kernel migration: migrated to ${WORKSPACE_ROOT}/co-dialectic/status-state.json" >> "${INSTALL_LOG}" 2>/dev/null || true
  elif [ "${MIGRATE_STATUS}" = "skipped" ]; then
    : # already migrated — silent
  elif [ "${MIGRATE_STATUS}" = "no-source" ]; then
    : # no legacy state to migrate — silent
  else
    echo "[install-survival-layer] WARN: brain-kernel migration returned status=${MIGRATE_STATUS} — will retry next session" >&2
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] brain-kernel migration: WARN status=${MIGRATE_STATUS}" >> "${INSTALL_LOG}" 2>/dev/null || true
  fi
fi

# ── 5. First-run marker ─────────────────────────────────────────────────────
if [ ! -f "${INSTALL_LOG}" ]; then
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${NOW}] Co-Dialectic survival layer installed (state.json + resident statusline.sh + settings.json statusLine)" > "${INSTALL_LOG}"
fi

exit 0
