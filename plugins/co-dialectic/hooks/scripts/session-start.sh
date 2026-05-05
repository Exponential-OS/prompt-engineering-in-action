#!/usr/bin/env bash
# session-start.sh — Co-Dialectic session init
# Fires at SessionStart. Injects kernel stub so P0 fires even before SKILL.md is invoked.
# Output format: systemMessage injected into the opening context.
set -euo pipefail
printf '{"systemMessage":"Co-Dialectic v4.6.2 loaded. Status line REQUIRED on every response: {Icon} {Domain} ({Name}) · {X}%%. Default persona: ⚡ Productivity (Tim Ferriss). Default mode: 🛞 Drive. Type /co-dialectic if protocols seem absent."}\n'
