#!/bin/bash
# statusline.sh — Co-Dialectic persistent status line for Claude Code.
#
# Reads Claude Code's statusLine JSON from stdin, then renders the CURRENT
# session's state from ~/.codialectic/sessions/<session_id>.json.
# Wired in ~/.claude/settings.json via the `statusLine` setting.
#
# Output format (single line):
#   📦 Product · 88% · Cal: 96% · 🤖 Codi: full · drive
#
# XOS-141 structural liveness:
#   Hook-owned:  installed_version, last_session_start_ts
#   Model-owned: last_protocol_ts, last_score, last_cal, persona, mode, honesty,
#                wildcard, active
#
# Never render model-owned score/cal fields unless last_protocol_ts proves that
# Protocol 1/3 executed for the current turn. CODI_STALE_SECS is only a generous
# backstop while the heartbeat still predates the latest user prompt.
#
# Falls back to bare "🧠 Co-Dialectic active" if state.json is unparseable.

set -u

# XOS-237: statusLine receives session_id/cwd/workspace on stdin. A valid session
# id is a hard boundary: never fall back to another session's global heartbeat.
# Empty/unparseable stdin keeps the pre-XOS-237 brain-first/global fallback.
CODI_DIR="${CODI_STATE_DIR:-${HOME}/.codialectic}"
LEGACY_STATE_PATH="${CODI_DIR}/state.json"
STATUS_INPUT=""
if [ ! -t 0 ]; then
  IFS= read -r STATUS_INPUT || true
fi

SESSION_ID=""
PAYLOAD_WORKSPACE=""
PAYLOAD_VALID=false
if [ -n "$STATUS_INPUT" ]; then
  if command -v jq >/dev/null 2>&1; then
    PAYLOAD_FIELDS=$(printf '%s' "$STATUS_INPUT" | jq -er '
      if type != "object" then error("not an object") else [
        (.session_id // .sessionId // "_"),
        ((if (.workspace | type) == "object" then
            (.workspace.project_dir // .workspace.current_dir)
          elif (.workspace | type) == "string" then .workspace
          else null end) //
          .cwd // "_")
      ] | @tsv end' 2>/dev/null) && PAYLOAD_VALID=true || true
  elif command -v python3 >/dev/null 2>&1; then
    PAYLOAD_FIELDS=$(STATUS_INPUT="$STATUS_INPUT" python3 - <<'PYEOF' 2>/dev/null
import json
import os

d = json.loads(os.environ.get("STATUS_INPUT", ""))
if not isinstance(d, dict):
    raise SystemExit(1)
workspace = d.get("workspace")
workspace_path = None
if isinstance(workspace, dict):
    workspace_path = workspace.get("project_dir") or workspace.get("current_dir")
elif isinstance(workspace, str):
    workspace_path = workspace
print("\t".join([str(d.get("session_id") or d.get("sessionId") or "_"), str(workspace_path or d.get("cwd") or "_")]))
PYEOF
    ) && PAYLOAD_VALID=true || true
  fi
fi

if [ "$PAYLOAD_VALID" = "true" ]; then
  IFS=$'\t' read -r SESSION_ID PAYLOAD_WORKSPACE <<< "$PAYLOAD_FIELDS"
  [ "$SESSION_ID" = "_" ] && SESSION_ID=""
  [ "$PAYLOAD_WORKSPACE" = "_" ] && PAYLOAD_WORKSPACE=""
  case "$SESSION_ID" in
    *[!A-Za-z0-9._-]*|""|.|..) SESSION_ID="" ;;
  esac
fi

BRAIN_ROOT="${BRAIN_WORKSPACE_ROOT:-${PAYLOAD_WORKSPACE:-${CAREER_HOME:-$PWD}}}"
BRAIN_STATE_PATH="${BRAIN_ROOT}/co-dialectic/status-state.json"
if [ -n "$SESSION_ID" ]; then
  STATE_PATH="${CODI_DIR}/sessions/${SESSION_ID}.json"
elif [ -f "$BRAIN_STATE_PATH" ]; then
  STATE_PATH="$BRAIN_STATE_PATH"
else
  STATE_PATH="$LEGACY_STATE_PATH"
fi
STALE_SECS="${CODI_STALE_SECS:-21600}"

if [ ! -f "$STATE_PATH" ]; then
  echo "🧠 Co-Dialectic · uninitialized"
  exit 0
fi

iso_to_epoch() {
  VALUE="$1"
  if [ -z "$VALUE" ] || [ "$VALUE" = "_" ] || [ "$VALUE" = "null" ]; then
    echo "0"
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    TS_VALUE="$VALUE" python3 - <<'PYEOF' 2>/dev/null || echo "0"
import datetime
import os

raw = os.environ.get("TS_VALUE", "")
try:
    dt = datetime.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    print(int(dt.timestamp()))
except Exception:
    print(0)
PYEOF
    return
  fi

  # Linux date
  if date -u -d "$VALUE" +%s >/dev/null 2>&1; then
    date -u -d "$VALUE" +%s
    return
  fi

  # macOS/BSD date
  if date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$VALUE" +%s >/dev/null 2>&1; then
    date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$VALUE" +%s
    return
  fi

  echo "0"
}

# Use jq if available; fall back to python3
if command -v jq >/dev/null 2>&1; then
  STATE_FIELDS=$(jq -r '[
    (if has("active") then .active else "_" end),
    (.mode // "drive"),
    (.persona // "_"),
    (.persona_icon // "_"),
    (.last_score // "_"),
    (.last_cal // "_"),
    (.honesty // "grounded"),
    (.wildcard // false),
    (.installed_version // "unknown"),
    (.version // "_"),
    (.last_session_start_ts // "_"),
    (.last_protocol_ts // "_"),
    (.last_user_prompt_ts // "_")
  ] | @tsv' "$STATE_PATH" 2>/dev/null) || {
    echo "🧠 Co-Dialectic active"
    exit 0
  }
  IFS=$'\t' read -r ACTIVE MODE PERSONA PERSONA_ICON LAST_SCORE LAST_CAL HONESTY WILDCARD INSTALLED_VERSION STATE_VERSION LAST_SESSION_START_TS LAST_PROTOCOL_TS LAST_USER_PROMPT_TS <<< "$STATE_FIELDS"
elif command -v python3 >/dev/null 2>&1; then
  IFS=$'\t' read -r ACTIVE MODE PERSONA PERSONA_ICON LAST_SCORE LAST_CAL HONESTY WILDCARD INSTALLED_VERSION STATE_VERSION LAST_SESSION_START_TS LAST_PROTOCOL_TS LAST_USER_PROMPT_TS < <(STATE_PATH="$STATE_PATH" python3 - <<'PYEOF'
import json
import os
try:
    with open(os.environ['STATE_PATH']) as f:
        d = json.load(f)
    fields = [
        d.get('active') if d.get('active') is not None else '_',
        d.get('mode', 'drive'),
        d.get('persona') or '_',
        d.get('persona_icon') or '_',
        d.get('last_score') if d.get('last_score') is not None else '_',
        d.get('last_cal') if d.get('last_cal') is not None else '_',
        d.get('honesty', 'grounded'),
        d.get('wildcard', False),
        d.get('installed_version') or 'unknown',
        d.get('version') or '_',
        d.get('last_session_start_ts') or '_',
        d.get('last_protocol_ts') or '_',
        d.get('last_user_prompt_ts') or '_',
    ]
    print('\t'.join(str(v) for v in fields))
except Exception:
    raise SystemExit(1)
PYEOF
  ) || {
    echo "🧠 Co-Dialectic active"
    exit 0
  }
else
  echo "🧠 Co-Dialectic · jq/python3 missing"
  exit 0
fi

# Translate sentinels back to empty
[ "$PERSONA" = "_" ] && PERSONA=""
[ "$PERSONA_ICON" = "_" ] && PERSONA_ICON=""
[ "$LAST_SCORE" = "_" ] && LAST_SCORE=""
[ "$LAST_CAL" = "_" ] && LAST_CAL=""
[ "$STATE_VERSION" = "_" ] && STATE_VERSION=""
[ "$LAST_SESSION_START_TS" = "_" ] && LAST_SESSION_START_TS=""
[ "$LAST_PROTOCOL_TS" = "_" ] && LAST_PROTOCOL_TS=""
[ "$LAST_USER_PROMPT_TS" = "_" ] && LAST_USER_PROMPT_TS=""

NOW_EPOCH=$(date -u +%s)
SESSION_EPOCH=$(iso_to_epoch "$LAST_SESSION_START_TS")
PROTOCOL_EPOCH=$(iso_to_epoch "$LAST_PROTOCOL_TS")
PROMPT_EPOCH=$(iso_to_epoch "$LAST_USER_PROMPT_TS")

STALE=false
UNKNOWN=false
if [ "$PROTOCOL_EPOCH" -le 0 ]; then
  UNKNOWN=true
else
  PROTOCOL_AGE=$((NOW_EPOCH - PROTOCOL_EPOCH))
fi

# This predicate mirrors evaluateSharedLiveness in hooks/liveness.ts. It is NOT
# kept in sync by hand — hooks/xos-213-liveness-parity.test.ts drives this script
# and both TypeScript paths over one shared fixture table and fails if any two
# disagree. Add a case to hooks/liveness-fixtures.ts and every implementation is
# held to it. Current-turn proof wins over elapsed wall time; XOS-197's
# SessionStart grace remains the legacy path.
if [ "$UNKNOWN" = "false" ] && \
   [ "$PROMPT_EPOCH" -gt 0 ] && \
   [ "$PROTOCOL_EPOCH" -lt "$PROMPT_EPOCH" ] && \
   [ "$PROTOCOL_AGE" -gt "$STALE_SECS" ]; then
  STALE=true
elif [ "$UNKNOWN" = "false" ] && \
   [ "$PROMPT_EPOCH" -le 0 ] && \
   [ "$SESSION_EPOCH" -gt 0 ] && \
   [ "$PROTOCOL_EPOCH" -lt "$SESSION_EPOCH" ] && \
   [ "$PROTOCOL_AGE" -gt "$STALE_SECS" ]; then
  STALE=true
elif [ "$UNKNOWN" = "false" ] && \
     [ "$PROMPT_EPOCH" -le 0 ] && \
     [ "$PROTOCOL_AGE" -gt "$STALE_SECS" ]; then
  STALE=true
fi

# XOS-149: version mismatch is NOT a DEGRADED trigger. `STATE_VERSION` (model-written)
# vs `INSTALLED_VERSION` (hook-derived) are decoupled sources that falsely skew under
# cache-sprawl / 'unknown' detection → permanent false DEGRADED. DEGRADED = real
# liveness loss only: inactive OR stale protocol.
# XOS-213: match evaluateSharedLiveness's "boolean-or-string" policy exactly.
# This previously degraded ONLY on the literal "false"/"False", so a corrupt
# state (active:0, active:"yes") rendered as healthy while the TypeScript
# evaluator called it inactive. Absent evidence ("_") is NOT inactivity — a new
# session has not failed a protocol yet.
INACTIVE=false
if [ "$ACTIVE" != "_" ] && [ "$ACTIVE" != "true" ] && [ "$ACTIVE" != "True" ]; then
  INACTIVE=true
fi

if [ "$INACTIVE" = "true" ] || [ "$STALE" = "true" ]; then
  echo "⚠ Codi DEGRADED · v${INSTALLED_VERSION} · protocols stale — type 'codi on' to re-activate"
  exit 0
fi

if [ "$UNKNOWN" = "true" ]; then
  echo "🧠 Co-Dialectic · uninitialized"
  exit 0
fi

# Build the status line
PARTS=()

# Persona block
if [ -n "$PERSONA" ]; then
  ICON="${PERSONA_ICON:-🎯}"
  if [ -n "$LAST_SCORE" ] && [ -n "$LAST_CAL" ]; then
    PARTS+=("${ICON} ${PERSONA} · ${LAST_SCORE}% · Cal: ${LAST_CAL}%")
  else
    PARTS+=("${ICON} ${PERSONA}")
  fi
else
  PARTS+=("🧠 Co-Dialectic")
fi

# Codi Agents tier
PARTS+=("🤖 Codi: full")

# Mode (always show if not drive)
if [ "$MODE" != "drive" ]; then
  PARTS+=("$MODE")
fi

# Honesty (only show if not grounded)
case "$HONESTY" in
  brutal) PARTS+=("🔪 brutal") ;;
  soft)   PARTS+=("🤝 soft") ;;
esac

# Wildcard
if [ "$WILDCARD" = "true" ] || [ "$WILDCARD" = "True" ]; then
  PARTS+=("🃏 wildcard")
fi

# Join with ·
STATUS_LINE=""
for PART in "${PARTS[@]}"; do
  if [ -z "$STATUS_LINE" ]; then
    STATUS_LINE="$PART"
  else
    STATUS_LINE="${STATUS_LINE} · ${PART}"
  fi
done
echo "$STATUS_LINE"
