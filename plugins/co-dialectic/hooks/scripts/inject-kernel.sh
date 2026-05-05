#!/usr/bin/env bash
# inject-kernel.sh — Co-Dialectic kernel re-injection
# Fires on every UserPromptSubmit. Approves the prompt and attempts to re-inject
# the kernel stub into context — structurally immune to compaction since it fires
# on every turn. If systemMessage is not supported by UserPromptSubmit, the
# decision:approve is still emitted and the SKILL.md reorder is the primary defense.
set -euo pipefail
printf '{"decision":"approve","systemMessage":"Co-Dialectic active: status line required every response, Drive mode, ⚡ Productivity default. Type /co-dialectic to reload protocols."}\n'
