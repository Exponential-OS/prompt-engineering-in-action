#!/usr/bin/env bash
# statusline.sh — Co-Dialectic persistent status line for Claude Code.
#
# Reads ~/.codialectic/state.json and renders a compact one-line status.
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
# Protocol 1/3 executed in this session and within CODI_STALE_SECS.
#
# Falls back to bare "🧠 Co-Dialectic active" if state.json is unparseable.

set -u

STATE_PATH="${HOME}/.codialectic/state.json"
STALE_SECS="${CODI_STALE_SECS:-900}"

if [ ! -f "$STATE_PATH" ]; then
  echo "🧠 Co-Dialectic · not initialized"
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
    (.active // false),
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
    (.last_protocol_ts // "_")
  ] | @tsv' "$STATE_PATH" 2>/dev/null) || {
    echo "🧠 Co-Dialectic active"
    exit 0
  }
  IFS=$'\t' read -r ACTIVE MODE PERSONA PERSONA_ICON LAST_SCORE LAST_CAL HONESTY WILDCARD INSTALLED_VERSION STATE_VERSION LAST_SESSION_START_TS LAST_PROTOCOL_TS <<< "$STATE_FIELDS"
elif command -v python3 >/dev/null 2>&1; then
  IFS=$'\t' read -r ACTIVE MODE PERSONA PERSONA_ICON LAST_SCORE LAST_CAL HONESTY WILDCARD INSTALLED_VERSION STATE_VERSION LAST_SESSION_START_TS LAST_PROTOCOL_TS < <(STATE_PATH="$STATE_PATH" python3 - <<'PYEOF'
import json
import os
try:
    with open(os.environ['STATE_PATH']) as f:
        d = json.load(f)
    fields = [
        d.get('active', False),
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

NOW_EPOCH=$(date -u +%s)
SESSION_EPOCH=$(iso_to_epoch "$LAST_SESSION_START_TS")
PROTOCOL_EPOCH=$(iso_to_epoch "$LAST_PROTOCOL_TS")

STALE=false
if [ "$PROTOCOL_EPOCH" -le 0 ]; then
  STALE=true
elif [ "$SESSION_EPOCH" -gt 0 ] && [ "$PROTOCOL_EPOCH" -lt "$SESSION_EPOCH" ]; then
  STALE=true
elif [ $((NOW_EPOCH - PROTOCOL_EPOCH)) -gt "$STALE_SECS" ]; then
  STALE=true
fi

VERSION_SKEW=false
if [ "$STATE_VERSION" != "$INSTALLED_VERSION" ]; then
  VERSION_SKEW=true
fi

if [ "$ACTIVE" != "true" ] && [ "$ACTIVE" != "True" ] || \
   [ "$STALE" = "true" ] || \
   [ "$VERSION_SKEW" = "true" ]; then
  echo "⚠ Codi DEGRADED · v${INSTALLED_VERSION} · protocols stale — type 'codi on' to re-activate"
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
