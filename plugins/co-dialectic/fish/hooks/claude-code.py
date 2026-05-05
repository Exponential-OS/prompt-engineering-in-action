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

This adapter:
  1. Infers stakes tier (T1/T2/T3) from prompt keywords.
  2. Recommends a MiroFish model tier (haiku/sonnet/opus) via pre-spawn
     classification — the advisor-model routing layer.
  3. Calls HOW.py for approach pre-flight (PASS/WARN/BLOCK).
  4. Merges the model recommendation into HOW.py's JSON output and
     injects updatedInput.model so Claude Code auto-sets the right model
     on every Agent() spawn — no manual selection required.

Fail-open on any error — adapter bugs must never block real work.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys


HOOK_DIR = pathlib.Path(__file__).resolve().parent
HOW_PY = HOOK_DIR.parent / "HOW.py"

# ── Stakes inference ────────────────────────────────────────────────────────
_T3_SIGNALS = frozenset([
    "publish", "send", "deploy", "delete", "remove", "drop", "push to",
    "email", "linkedin", "substack", "tweet", "post to", "notify",
    "production", "irreversible", "migrate", "overwrite", "force",
])
_T1_SIGNALS = frozenset([
    "read", "research", "search", "analyze", "summarize", "explain",
    "list", "show", "find", "grep", "check", "look", "review",
])

# ── MiroFish model-tier classification (Python port of pre-spawn-check.sh) ──
# Same keyword sets as the shell script so tier recommendations are consistent.
_HAIKU_KW = [
    "read ", "grep", "find ", "surgical", "preserve", "mechanical",
    "pattern match", "move ", "rename", " cp ", " mv ", "chmod", " rm ",
    "backfill", "patch", "edit ", "inventory", "list ", " ls ", "scan",
    "sed ", " wc ", "head ", "tail ", "concat", "append", "truncate", "cleanup",
]
_SONNET_KW = [
    "synthesize", "analyze", "extract", "identify pattern", "summarize",
    "audit", "review", "critique", "evaluate", "classify", "consolidat",
    "reorganize", "refactor", "spec", "plan", "design", "draft",
]
_OPUS_KW = [
    "architect", "architecture", "constitution", "multi-domain", "tradeoff",
    "governance", "invariant", "principle", "framework", "cross-cutting",
    "long-form", "jurisprudence", "policy",
]

# Model names Claude Code accepts in the Agent tool's `model` field.
_TIER_MODEL = {
    "haiku": "haiku",
    "sonnet": "sonnet",
    "opus": "opus",
}


def _infer_stakes(prompt: str) -> str:
    lower = prompt.lower()
    if len(prompt.split()) > 300:
        return "T3"
    for sig in _T3_SIGNALS:
        if sig in lower:
            return "T3"
    for sig in _T1_SIGNALS:
        if sig in lower:
            return "T1"
    return "T2"


def _recommend_tier(prompt: str, stakes: str) -> str:
    """
    MiroFish advisor-model routing: classify task complexity and return
    the cheapest model tier that can handle it competently.

    Mirrors pre-spawn-check.sh keyword scoring in Python so the two
    systems stay in sync without a subprocess call.
    """
    # T3+ is architectural / irreversible — escalate, don't downgrade.
    if stakes in ("T3", "T4"):
        return "sonnet"  # minimum for complex / risky work

    desc_lc = prompt.lower()
    haiku_hits = sum(1 for kw in _HAIKU_KW if kw in desc_lc)
    sonnet_hits = sum(1 for kw in _SONNET_KW if kw in desc_lc)
    opus_hits = sum(1 for kw in _OPUS_KW if kw in desc_lc)

    if opus_hits > 0:
        return "opus"
    if sonnet_hits > 0:
        return "sonnet"
    if haiku_hits > 0:
        return "haiku"
    # No match — safe default is sonnet (mirrors pre-spawn-check.sh default).
    return "sonnet"


def main() -> int:
    raw = sys.stdin.read().strip()

    if not raw:
        return 0  # fail open

    try:
        hook_ctx = json.loads(raw)
    except json.JSONDecodeError:
        return 0  # malformed — fail open

    if hook_ctx.get("tool_name", "") != "Agent":
        return 0

    tool_input = hook_ctx.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return 0

    prompt = (tool_input.get("prompt") or "").strip()
    subagent_type = tool_input.get("subagent_type", "")
    existing_model = tool_input.get("model", "")  # respect explicit caller override

    if not prompt:
        return 0

    stakes = _infer_stakes(prompt)
    recommended_tier = _recommend_tier(prompt, stakes)

    # If caller already specified a model, respect it — don't override.
    # Advisor routing only fires when the caller left model unset.
    apply_model = not bool(existing_model)

    # ── Run HOW.py (approach pre-flight) ───────────────────────────────────
    fish_input = json.dumps(
        {
            "task": prompt[:600],
            "stakes": stakes,
            "context": f"subagent_type={subagent_type}" if subagent_type else "",
        },
        ensure_ascii=False,
    )

    if not HOW_PY.exists():
        return 0  # HOW.py missing — fail open

    # Capture HOW.py stdout so we can enrich it before passing to Claude Code.
    result = subprocess.run(
        [sys.executable, str(HOW_PY), "-"],
        input=fish_input,
        text=True,
        capture_output=True,
    )
    exit_code = result.returncode

    # ── Parse and enrich HOW.py output ────────────────────────────────────
    how_out = result.stdout.strip()
    try:
        payload = json.loads(how_out) if how_out else {}
    except json.JSONDecodeError:
        payload = {}

    # Build the advisor routing annotation.
    tier_note = (
        f"[MiroFish] recommended model: {recommended_tier} "
        f"(stakes={stakes}, apply={apply_model}). "
        f"Whale decompose → fish execute at {recommended_tier} tier."
    )

    # Merge tier note into systemMessage.
    existing_msg = payload.get("systemMessage", "")
    payload["systemMessage"] = (
        f"{existing_msg}\n{tier_note}" if existing_msg else tier_note
    )

    # Inject updatedInput.model so Claude Code auto-sets the model on the
    # Agent() call — the advisor-model dispatch that makes MiroFish automatic.
    if apply_model:
        hook_specific = payload.get("hookSpecificOutput") or {}
        if not isinstance(hook_specific, dict):
            hook_specific = {}
        hook_specific["hookEventName"] = "PreToolUse"
        updated_input = hook_specific.get("updatedInput") or {}
        if not isinstance(updated_input, dict):
            updated_input = {}
        updated_input["model"] = _TIER_MODEL[recommended_tier]
        hook_specific["updatedInput"] = updated_input
        payload["hookSpecificOutput"] = hook_specific

    print(json.dumps(payload, separators=(",", ":"), default=str))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
