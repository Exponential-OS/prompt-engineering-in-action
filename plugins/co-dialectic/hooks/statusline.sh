#!/usr/bin/env bash
# statusline.sh — Co-Dialectic persistent status line for Claude Code.
#
# Reads ~/.codialectic/state.json and renders a compact one-line status.
# Wired in ~/.claude/settings.json via the `statusLine` setting.
#
# Output format (single line):
#   📦 Product · 88% · Cal: 96% · 🤖 Codi: full · drive
#
# Falls back to bare "🧠 Co-Dialectic active" if state.json is unparseable.

set -u

STATE_PATH="${HOME}/.codialectic/state.json"

if [ ! -f "$STATE_PATH" ]; then
  echo "🧠 Co-Dialectic · not initialized"
  exit 0
fi

# Use jq if available; fall back to python3
if command -v jq >/dev/null 2>&1; then
  ACTIVE=$(jq -r '.active // false' "$STATE_PATH" 2>/dev/null)
  MODE=$(jq -r '.mode // "drive"' "$STATE_PATH" 2>/dev/null)
  PERSONA=$(jq -r '.persona // empty' "$STATE_PATH" 2>/dev/null)
  PERSONA_ICON=$(jq -r '.persona_icon // empty' "$STATE_PATH" 2>/dev/null)
  LAST_SCORE=$(jq -r '.last_score // empty' "$STATE_PATH" 2>/dev/null)
  LAST_CAL=$(jq -r '.last_cal // empty' "$STATE_PATH" 2>/dev/null)
  HONESTY=$(jq -r '.honesty // "grounded"' "$STATE_PATH" 2>/dev/null)
  WILDCARD=$(jq -r '.wildcard // false' "$STATE_PATH" 2>/dev/null)
elif command -v python3 >/dev/null 2>&1; then
  read -r ACTIVE MODE PERSONA PERSONA_ICON LAST_SCORE LAST_CAL HONESTY WILDCARD < <(python3 -c "
import json, sys
try:
    with open('$STATE_PATH') as f:
        d = json.load(f)
    print(d.get('active', False), d.get('mode', 'drive'),
          d.get('persona') or '_', d.get('persona_icon') or '_',
          d.get('last_score') if d.get('last_score') is not None else '_',
          d.get('last_cal') if d.get('last_cal') is not None else '_',
          d.get('honesty', 'grounded'),
          d.get('wildcard', False))
except Exception:
    print('False drive _ _ _ _ grounded False')
")
  # Translate _ back to empty
  [ "$PERSONA" = "_" ] && PERSONA=""
  [ "$PERSONA_ICON" = "_" ] && PERSONA_ICON=""
  [ "$LAST_SCORE" = "_" ] && LAST_SCORE=""
  [ "$LAST_CAL" = "_" ] && LAST_CAL=""
else
  echo "🧠 Co-Dialectic · jq/python3 missing"
  exit 0
fi

if [ "$ACTIVE" != "true" ] && [ "$ACTIVE" != "True" ]; then
  echo "💤 Co-Dialectic: off (codi on to activate)"
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
(IFS=" · "; echo "${PARTS[*]}")
