#!/usr/bin/env python3
"""
hooks/claude-code.py — Claude Code PreToolUse adapter for codi-fish-precheck.

Claude Code passes the full hook context as JSON on stdin:
  {
    "hook_event_name": "PreToolUse",
    "tool_name": "Agent",
    "tool_input": {
      "prompt": "actual agent task description",
      "subagent_type": "general-purpose",
      ...
    }
  }

This adapter extracts the real task, infers stakes, and pipes to HOW.py.
Fail-open on any error — adapter bugs must never block real work.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys


HOOK_DIR = pathlib.Path(__file__).resolve().parent
HOW_PY = HOOK_DIR.parent / "HOW.py"

# Keywords that signal higher/lower stakes — used to refine the T2 default.
_T3_SIGNALS = frozenset(
    [
        "publish", "send", "deploy", "delete", "remove", "drop", "push to",
        "email", "linkedin", "substack", "tweet", "post to", "notify",
        "production", "irreversible", "migrate", "overwrite", "force",
    ]
)
_T1_SIGNALS = frozenset(
    [
        "read", "research", "search", "analyze", "summarize", "explain",
        "list", "show", "find", "grep", "check", "look", "review",
    ]
)


def _infer_stakes(prompt: str) -> str:
    """
    Heuristic tier classification from the agent prompt text.

    T1 — clearly read-only / research tasks (cheap fish, low overhead)
    T2 — default; write/edit/build tasks of moderate complexity
    T3 — irreversible-signal keywords detected; escalate to IVG instead
    """
    lower = prompt.lower()
    word_count = len(prompt.split())

    # Long prompts are more likely complex / multi-step → T3 escalate.
    if word_count > 300:
        return "T3"

    # Keyword sweep — T3 signals take priority over T1.
    for sig in _T3_SIGNALS:
        if sig in lower:
            return "T3"

    for sig in _T1_SIGNALS:
        if sig in lower:
            return "T1"

    return "T2"


def main() -> int:
    raw = sys.stdin.read().strip()

    if not raw:
        # Claude Code passed empty stdin — fail open.
        return 0

    try:
        hook_ctx = json.loads(raw)
    except json.JSONDecodeError:
        return 0  # malformed hook context — fail open

    # Only handle Agent tool spawns from this adapter.
    tool_name = hook_ctx.get("tool_name", "")
    if tool_name != "Agent":
        return 0

    tool_input = hook_ctx.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return 0

    prompt = (tool_input.get("prompt") or "").strip()
    subagent_type = tool_input.get("subagent_type", "")

    if not prompt:
        # Agent spawn with no prompt — nothing to evaluate; skip.
        return 0

    stakes = _infer_stakes(prompt)

    fish_input = json.dumps(
        {
            "task": prompt[:600],
            "stakes": stakes,
            "context": f"subagent_type={subagent_type}" if subagent_type else "",
        },
        ensure_ascii=False,
    )

    if not HOW_PY.exists():
        # HOW.py missing — fail open.
        return 0

    result = subprocess.run(
        [sys.executable, str(HOW_PY), "-"],
        input=fish_input,
        text=True,
    )
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
