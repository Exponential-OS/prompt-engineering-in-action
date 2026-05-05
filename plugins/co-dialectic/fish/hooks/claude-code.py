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
  3. Auto-sets run_in_background based on tier:
       haiku/sonnet at T1-T2 → True  (mechanical/synthesis, fire-and-forget)
       opus or T3+ → False            (architectural/irreversible, whale waits)
     Caller-set run_in_background is always respected.
  4. Calls HOW.py for approach pre-flight (PASS/WARN/BLOCK).
  5. Merges the model recommendation into HOW.py's JSON output and
     injects updatedInput so Claude Code auto-sets model + threading
     on every Agent() spawn — no manual selection required.

HOW.py is optional: if missing, advisor routing (model + background)
still fires. Only the pre-flight check is skipped.

Fail-open on any error — adapter bugs must never block real work.
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys


HOOK_DIR = pathlib.Path(__file__).resolve().parent
HOW_PY = HOOK_DIR.parent / "HOW.py"

# ── Stakes inference ────────────────────────────────────────────────────────
# Substring-matched T3 signals (phrase-level — safe from false positives).
# "migrate" is intentionally excluded here: bare "migrate" is too broad and
# fires on reversible code/test migrations ("migrate tests to pytest").
# Irreversible data/infra migrations are captured via _T3_MIGRATE_SIGNALS below.
_T3_SIGNALS = frozenset([
    "publish", "send", "deploy", "delete", "remove", "drop", "push to",
    "email", "post to linkedin", "linkedin post", "publish linkedin",
    "substack", "tweet", "post to", "notify",
    "production", "irreversible", "overwrite",
])
# Data/infra migration phrases that are genuinely irreversible (not code refactoring).
_T3_MIGRATE_SIGNALS = frozenset([
    "db migrate", "database migrate", "schema migrate", "data migrate",
    "migrate database", "migrate schema", "migrate data", "migrate table",
    "alembic", "flyway", "liquibase", "migration script to prod",
])
# Word-boundary T3 signals — terms that embed in longer words ("force" → "enforcement").
_T3_WORD_SIGNALS: tuple[str, ...] = ("force", "push")
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
    for sig in _T3_MIGRATE_SIGNALS:
        if sig in lower:
            return "T3"
    for sig in _T3_WORD_SIGNALS:
        if re.search(r"\b" + sig + r"\b", lower):
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
    existing_model = tool_input.get("model", "")
    existing_bg = tool_input.get("run_in_background")  # None = caller did not set it

    if not prompt:
        return 0

    stakes = _infer_stakes(prompt)
    recommended_tier = _recommend_tier(prompt, stakes)

    # Respect explicit caller overrides — only inject when caller left them unset.
    apply_model = not bool(existing_model)
    apply_bg = existing_bg is None

    # Background policy: fire-and-forget for mechanical/synthesis work;
    # whale waits for architectural decisions and irreversible actions.
    # Exception: elite-code-writer spawns are reversible executors (whale already
    # decomposed the task) — force bg=True so parallel spawns don't serialize.
    is_code_executor = subagent_type in ("elite-code-writer", "codex:codex-rescue")
    auto_bg = (
        is_code_executor
        or (stakes not in ("T3", "T4") and recommended_tier != "opus")
    )

    # ── Run HOW.py (approach pre-flight) — optional ────────────────────────
    fish_input = json.dumps(
        {
            "task": prompt[:600],
            "stakes": stakes,
            "context": f"subagent_type={subagent_type}" if subagent_type else "",
        },
        ensure_ascii=False,
    )

    payload: dict = {}
    exit_code = 0

    if HOW_PY.exists():
        result = subprocess.run(
            [sys.executable, str(HOW_PY), "-"],
            input=fish_input,
            text=True,
            capture_output=True,
        )
        exit_code = result.returncode
        how_out = result.stdout.strip()
        try:
            payload = json.loads(how_out) if how_out else {}
        except json.JSONDecodeError:
            payload = {}
    # HOW.py missing → advisor routing still fires, pre-flight skipped.

    # ── Build advisor routing annotation ───────────────────────────────────
    tier_note = (
        f"[MiroFish] recommended model: {recommended_tier} "
        f"(stakes={stakes}, apply_model={apply_model}, bg={auto_bg if apply_bg else existing_bg}). "
        f"Whale decompose → fish execute at {recommended_tier} tier."
    )
    existing_msg = payload.get("systemMessage", "")
    payload["systemMessage"] = (
        f"{existing_msg}\n{tier_note}" if existing_msg else tier_note
    )

    # ── Inject updatedInput (model + run_in_background) ───────────────────
    if apply_model or apply_bg:
        hook_specific = payload.get("hookSpecificOutput") or {}
        if not isinstance(hook_specific, dict):
            hook_specific = {}
        hook_specific["hookEventName"] = "PreToolUse"
        updated_input = hook_specific.get("updatedInput") or {}
        if not isinstance(updated_input, dict):
            updated_input = {}
        if apply_model:
            updated_input["model"] = _TIER_MODEL[recommended_tier]
        if apply_bg:
            updated_input["run_in_background"] = auto_bg
        hook_specific["updatedInput"] = updated_input
        payload["hookSpecificOutput"] = hook_specific

    print(json.dumps(payload, separators=(",", ":"), default=str))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
