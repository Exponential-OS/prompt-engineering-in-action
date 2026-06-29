#!/usr/bin/env bash
# install-survival-layer.sh — Co-Dialectic auto-install on first SessionStart.
#
# Idempotent. Runs on every SessionStart. Five responsibilities:
#   1. Create or sync ~/.codialectic/state.json:
#        - hook-owned fields refreshed every session:
#          installed_version, last_session_start_ts
#        - model-owned fields preserved:
#          last_protocol_ts, last_score, last_cal, persona, mode, honesty,
#          wildcard, active
#   2. Copy the current plugin's statusline.sh to ~/.codialectic/statusline.sh
#      (overwrite — keeps the canonical copy fresh on plugin upgrade). The settings.json
#      statusLine entry points at the fixed path, so no version-sort gymnastics.
#   3. Add statusLine block to ~/.claude/settings.json if missing — pointing at the
#      fixed ~/.codialectic/statusline.sh path.
#   4. Warn if multiple cached co-dialectic plugin versions are detected.
#   5. (v4.17.0) Trigger one-shot migration of ~/.codialectic/state.json to
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

read_plugin_version() {
  PLUGIN_JSON="${CLAUDE_PLUGIN_ROOT:-}/.claude-plugin/plugin.json"
  if [ ! -f "${PLUGIN_JSON}" ]; then
    echo "unknown"
    return
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r '.version // "unknown"' "${PLUGIN_JSON}" 2>/dev/null || echo "unknown"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    PLUGIN_JSON="${PLUGIN_JSON}" python3 - <<'PYEOF' 2>/dev/null || echo "unknown"
import json
import os

try:
    with open(os.environ["PLUGIN_JSON"]) as f:
        print(json.load(f).get("version", "unknown"))
except Exception:
    print("unknown")
PYEOF
    return
  fi

  echo "unknown"
}

backup_corrupt_state_json() {
  TS=$(date -u +"%Y%m%dT%H%M%SZ")
  BACKUP_FILE="${STATE_FILE}.corrupt-${TS}"
  SUFFIX=1
  while [ -e "${BACKUP_FILE}" ]; do
    BACKUP_FILE="${STATE_FILE}.corrupt-${TS}.${SUFFIX}"
    SUFFIX=$((SUFFIX + 1))
  done

  cp -p "${STATE_FILE}" "${BACKUP_FILE}"
  WARN_LINE="WARN: state.json was corrupt — backed up to ${BACKUP_FILE}, recreated"
  echo "[install-survival-layer] ${WARN_LINE}" >&2
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] ${WARN_LINE}" >> "${INSTALL_LOG}" 2>/dev/null || true
}

sync_state_json() {
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  CODI_VERSION=$(read_plugin_version)

  if command -v python3 >/dev/null 2>&1; then
    STATE_FILE="${STATE_FILE}" INSTALL_LOG="${INSTALL_LOG}" CODI_VERSION="${CODI_VERSION}" NOW="${NOW}" python3 - <<'PYEOF'
import datetime
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

state_path = Path(os.environ["STATE_FILE"])
install_log = Path(os.environ["INSTALL_LOG"])
version = os.environ["CODI_VERSION"]
now = os.environ["NOW"]
created = not state_path.exists()
recreated = False

defaults = {
    "schema_version": "1.0.0",
    "active": True,
    "mode": "drive",
    "honesty": "grounded",
    "persona": None,
    "persona_icon": None,
    "last_score": None,
    "last_cal": None,
    "wildcard": False,
    "last_protocol_ts": None,
    "session_start_ts": now,
    "version": version,
    "growth_total_turns": 0,
    "last_updated_ts": now,
}

def backup_corrupt_state():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = state_path.with_name(f"{state_path.name}.corrupt-{ts}")
    suffix = 1
    while backup_path.exists():
        backup_path = state_path.with_name(f"{state_path.name}.corrupt-{ts}.{suffix}")
        suffix += 1

    shutil.copy2(state_path, backup_path)
    warning = f"WARN: state.json was corrupt — backed up to {backup_path}, recreated"
    try:
        install_log.parent.mkdir(parents=True, exist_ok=True)
        with install_log.open("a") as log:
            log.write(f"[{now}] {warning}\n")
    except Exception:
        pass
    print(f"[install-survival-layer] {warning}", file=sys.stderr)
    return {}

if state_path.exists():
    try:
        with state_path.open() as f:
            loaded_state = json.load(f)
    except Exception:
        state = backup_corrupt_state()
        recreated = True
    else:
        if isinstance(loaded_state, dict):
            state = loaded_state
        else:
            state = backup_corrupt_state()
            recreated = True
else:
    state = {}

for key, value in defaults.items():
    state.setdefault(key, value)

# XOS-141 hook-owned fields: refresh every SessionStart.
state["installed_version"] = version
state["last_session_start_ts"] = now

state_path.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile("w", dir=state_path.parent, delete=False) as tmp:
    json.dump(state, tmp, indent=2)
    tmp.write("\n")
    tmp_name = tmp.name
os.replace(tmp_name, state_path)

verb = "Created" if created else "Recreated" if recreated else "Synced"
print(f"[install-survival-layer] {verb} {state_path} (installed_version {version})", file=sys.stderr)
PYEOF
    return
  fi

  if command -v jq >/dev/null 2>&1; then
    CREATED=false
    RECREATED=false
    if [ ! -f "${STATE_FILE}" ]; then
      CREATED=true
      printf '{}\n' > "${STATE_FILE}"
    elif ! jq -e 'type == "object"' "${STATE_FILE}" >/dev/null 2>&1; then
      backup_corrupt_state_json
      RECREATED=true
      printf '{}\n' > "${STATE_FILE}"
    fi
    TMP_FILE=$(mktemp "${STATE_FILE}.XXXXXX")
    if jq --arg version "${CODI_VERSION}" --arg now "${NOW}" '
      (if type == "object" then . else {} end)
      | .schema_version = (.schema_version // "1.0.0")
      | .active = (if has("active") then .active else true end)
      | .mode = (.mode // "drive")
      | .honesty = (.honesty // "grounded")
      | .persona = (if has("persona") then .persona else null end)
      | .persona_icon = (if has("persona_icon") then .persona_icon else null end)
      | .last_score = (if has("last_score") then .last_score else null end)
      | .last_cal = (if has("last_cal") then .last_cal else null end)
      | .wildcard = (if has("wildcard") then .wildcard else false end)
      | .last_protocol_ts = (if has("last_protocol_ts") then .last_protocol_ts else null end)
      | .session_start_ts = (.session_start_ts // $now)
      | .version = (.version // $version)
      | .growth_total_turns = (.growth_total_turns // 0)
      | .last_updated_ts = (.last_updated_ts // $now)
      | .installed_version = $version
      | .last_session_start_ts = $now
    ' "${STATE_FILE}" > "${TMP_FILE}"; then
      mv "${TMP_FILE}" "${STATE_FILE}"
      if [ "${CREATED}" = "true" ]; then
        echo "[install-survival-layer] Created ${STATE_FILE} (installed_version ${CODI_VERSION})" >&2
      elif [ "${RECREATED}" = "true" ]; then
        echo "[install-survival-layer] Recreated ${STATE_FILE} (installed_version ${CODI_VERSION})" >&2
      else
        echo "[install-survival-layer] Synced ${STATE_FILE} (installed_version ${CODI_VERSION})" >&2
      fi
    else
      rm -f "${TMP_FILE}"
      echo "[install-survival-layer] WARN: cannot parse ${STATE_FILE}; hook-owned state sync skipped" >&2
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARN: cannot parse ${STATE_FILE}; hook-owned state sync skipped" >> "${INSTALL_LOG}" 2>/dev/null || true
    fi
    return
  fi

  if [ ! -f "${STATE_FILE}" ]; then
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
  "last_protocol_ts": null,
  "session_start_ts": "${NOW}",
  "version": "${CODI_VERSION}",
  "installed_version": "${CODI_VERSION}",
  "last_session_start_ts": "${NOW}",
  "growth_total_turns": 0,
  "last_updated_ts": "${NOW}"
}
EOF
    echo "[install-survival-layer] Created ${STATE_FILE} (installed_version ${CODI_VERSION})" >&2
  else
    echo "[install-survival-layer] WARN: jq/python3 missing; hook-owned state sync skipped" >&2
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARN: jq/python3 missing; hook-owned state sync skipped" >> "${INSTALL_LOG}" 2>/dev/null || true
  fi
}

# ── 1. Create/sync state.json on every SessionStart ─────────────────────────
sync_state_json

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

# ── 4. Install-sprawl warning (detect only; never delete plugin cache) ───────
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  CACHE_PARENT=$(dirname "${CLAUDE_PLUGIN_ROOT}")
  if [ "$(basename "${CACHE_PARENT}")" = "co-dialectic" ] && [ -d "${CACHE_PARENT}" ]; then
    CACHE_COUNT=$(find "${CACHE_PARENT}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    if [ "${CACHE_COUNT:-0}" -gt 1 ]; then
      CACHE_VERSIONS=$(find "${CACHE_PARENT}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sort | tr '\n' ' ')
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] WARN: multiple cached co-dialectic versions found under ${CACHE_PARENT}: ${CACHE_VERSIONS}" >> "${INSTALL_LOG}" 2>/dev/null || true
    fi
  fi
fi

# ── 5. One-shot migration to brain-kernel (v4.17.0) ──────────────────────────
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
# H3: resolve kernel path via BRAIN_KERNEL_ROOT env var with documented fallback.
# Set BRAIN_KERNEL_ROOT when the kernel is installed outside the sibling-repo layout.
BRAIN_KERNEL_ROOT="${BRAIN_KERNEL_ROOT:-${WORKSPACE_ROOT}/../xos/plugins/brain-kernel}"
BRAIN_KERNEL_TS="${BRAIN_KERNEL_ROOT}/kernel.ts"

if [ -n "${WORKSPACE_ROOT}" ] && \
   [ -f "${STATE_FILE}" ] && \
   [ ! -f "${WORKSPACE_ROOT}/co-dialectic/status-state.json" ] && \
   [ -f "${BOOTSTRAP_TS}" ] && \
   [ -x "${BUN_BIN}" ]; then

  MIGRATE_OUT=$(
    "${BUN_BIN}" run - <<MIGRATE_SCRIPT 2>&1 || true
import { createBrain } from "${BRAIN_KERNEL_TS}";
import { migrateLocalState } from "${BOOTSTRAP_TS}";

const brain = createBrain("${WORKSPACE_ROOT}");
const result = await migrateLocalState(brain);
process.stdout.write(JSON.stringify(result) + "\n");
MIGRATE_SCRIPT
  )

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
