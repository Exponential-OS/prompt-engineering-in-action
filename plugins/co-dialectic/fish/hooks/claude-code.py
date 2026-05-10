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
import os
import pathlib
import re
import subprocess
import sys
import time
import uuid


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

# ── Runtime-agnostic executor type registry ─────────────────────────────────
# "Executor" agents are pure mechanical code/task runners that the whale has
# already decomposed — they should always run in background so parallel
# spawns don't serialize. Defaults are Claude Code-specific subagent types.
#
# OTHER RUNTIMES: set CODI_EXECUTOR_TYPES to a comma-separated list of your
# runtime's equivalent executor agent type names, or "" to disable.
# Examples:
#   ChatGPT plugin:  CODI_EXECUTOR_TYPES="code_interpreter,tool_executor"
#   Gemini CLI:      CODI_EXECUTOR_TYPES="code-runner"
#   Generic API:     CODI_EXECUTOR_TYPES=""   (disables; stakes-based logic only)
#
# This env var is the only runtime-specific configuration point in this hook.
_DEFAULT_EXECUTOR_TYPES: frozenset[str] = frozenset(["elite-code-writer", "codex:codex-rescue"])
_env_executor_types = os.environ.get("CODI_EXECUTOR_TYPES")  # None = not set
if _env_executor_types is None:
    EXECUTOR_TYPES: frozenset[str] = _DEFAULT_EXECUTOR_TYPES   # unset → Claude Code defaults
elif _env_executor_types == "":
    EXECUTOR_TYPES = frozenset()                                # "" → disable executor special-casing
else:
    EXECUTOR_TYPES = frozenset(
        t.strip() for t in _env_executor_types.split(",") if t.strip()
    )                                                           # "a,b" → custom runtime list

# P4 Weakness-Seam Descent (2026-05-05): keyword regex is a structural gate
# for a semantic violation. "Is this T3?" requires semantic judgment — keyword
# matching produces false negatives on architectural docs with no T3 keywords
# (content-flywheel.md rewrites, BRIEF.md additions, ADR edits). Replace with
# a focused Haiku semantic call. Keyword logic kept as fail-open fallback.
SEMANTIC_TIER_CLASSIFICATION = True

_SEMANTIC_SYSTEM = (
    "You classify AI agent task prompts by stakes tier. "
    "Reply with exactly one of: T1, T2, or T3. No other output.\n"
    "T1 = read-only, exploratory, fully reversible: grep, read, research, summarize, explain.\n"
    "T2 = writes to regular code/config files, non-canonical edits, internal notes.\n"
    "T3 = ANY of: (a) write/edit/add to strategy or architecture documents "
    "(content-flywheel.md, BRIEF.md, CONSTITUTION.md, SKILL.md, ADR files, "
    "brain/identity/ files, campaign masters, schema files); "
    "(b) architectural or schema decisions; "
    "(c) outreach to real humans (email, DM, post); "
    "(d) publishing or deploying; "
    "(e) irreversible or hard-to-undo actions; "
    "(f) canonical documents that multiple agents read and act on. "
    "When uncertain between T2 and T3, choose T3."
)
_SEMANTIC_MODEL = "claude-haiku-4-5-20251001"
_SEMANTIC_MAX_TOKENS = 5
_SEMANTIC_TIMEOUT = 8


def _infer_stakes_semantic(prompt: str) -> str | None:
    """
    Semantic tier classification via Haiku. Returns T1/T2/T3 or None on failure.
    Fail-open: any error returns None, caller falls back to keyword logic.
    """
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic  # type: ignore
        client = anthropic.Anthropic(timeout=_SEMANTIC_TIMEOUT)
        resp = client.messages.create(
            model=_SEMANTIC_MODEL,
            max_tokens=_SEMANTIC_MAX_TOKENS,
            system=_SEMANTIC_SYSTEM,
            messages=[{"role": "user", "content": prompt[:400]}],
        )
        text = ""
        for block in getattr(resp, "content", []) or []:
            t = getattr(block, "text", None)
            if isinstance(t, str):
                text += t
        text = text.strip().upper()[:10]
        for tier in ("T3", "T2", "T1"):
            if tier in text:
                return tier
        return None
    except Exception:  # noqa: BLE001
        return None


def _infer_stakes_keyword(prompt: str) -> str:
    """Keyword-based fallback. Used when semantic call is disabled or fails."""
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


def _infer_stakes(prompt: str) -> str:
    if SEMANTIC_TIER_CLASSIFICATION:
        result = _infer_stakes_semantic(prompt)
        if result is not None:
            return result
    return _infer_stakes_keyword(prompt)


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
    isolation = tool_input.get("isolation", "")

    if not prompt:
        return 0

    stakes = _infer_stakes(prompt)
    recommended_tier = _recommend_tier(prompt, stakes)

    # Respect explicit caller overrides — only inject when caller left them unset.
    apply_model = not bool(existing_model)
    apply_bg = existing_bg is None

    # ── Worktree isolation → force foreground (2026-05-05) ─────────────────
    # Worktree agents that run in the background hang silently with no
    # completion notification — observed failure: both agents stuck at 08:50
    # with no update for 20+ minutes. Worktree setup (branch creation, git
    # checkout) can hit permission/lock issues that cause silent hangs.
    # Force foreground so the whale sees failure immediately.
    worktree_forced_fg = False
    if isolation == "worktree" and apply_bg:
        auto_bg = False
        apply_bg = True  # we ARE setting it — to False
        worktree_forced_fg = True
    else:
        # Background policy: fire-and-forget for mechanical/synthesis work;
        # whale waits for architectural decisions and irreversible actions.
        # Executor agents (already-decomposed mechanical runners) always bg
        # so parallel spawns don't serialize. Executor type list is runtime-
        # configurable via CODI_EXECUTOR_TYPES env var (see module top).
        is_code_executor = bool(subagent_type) and subagent_type in EXECUTOR_TYPES
        auto_bg = (
            is_code_executor
            or (stakes not in ("T3", "T4") and recommended_tier != "opus")
        )

    # ── Background agent registration + dedup check (2026-05-10) ──────────
    # When auto_bg=True:
    #   1. Check for file conflicts (check-dedup) — BLOCK if another agent owns same files.
    #   2. If no conflict, generate a fish_id and register the agent (register).
    #      fish_id is injected into the agent's prompt as a completion contract so the
    #      agent knows its own ID and session-start sweeps can find stuck agents.
    # Fail-open: lifecycle script missing or erroring never blocks real work.
    _effective_bg = auto_bg if apply_bg else bool(existing_bg)
    lifecycle_block_msg: str = ""
    fish_id: str = ""
    _lifecycle_script: pathlib.Path | None = None
    if _effective_bg:
        lifecycle_script = HOOK_DIR.parent / "scripts" / "agent_lifecycle.py"
        if lifecycle_script.exists():
            _lifecycle_script = lifecycle_script
            # Extract file paths from prompt (simple regex — structural check)
            file_pattern = re.compile(
                r"(?:/[\w.\-]+)+\.(?:py|md|json|yaml|sh|ts|js|txt|csv)"  # any absolute path
                r"|~(?:/[\w.\-]+)+"  # tilde paths
                r"|[\w.\-]+\.(?:py|md|json|yaml|sh|ts|js|txt)"  # relative filenames
            )
            extracted_files = list(dict.fromkeys(file_pattern.findall(prompt)))[:10]

            try:
                # Step 1: dedup — only check when files are identifiable
                if extracted_files:
                    dedup_result = subprocess.run(
                        [sys.executable, str(lifecycle_script), "check-dedup",
                         "--files"] + extracted_files,
                        text=True, capture_output=True, timeout=5,
                    )
                    dedup_out = json.loads(dedup_result.stdout.strip() or "{}")
                    if dedup_out.get("verdict") == "BLOCK":
                        conflicts = dedup_out.get("conflicting_agents", [])
                        conflict_ids = ", ".join(
                            c.get("agent_id", "?") for c in conflicts
                        )
                        lifecycle_block_msg = (
                            f"[fish lifecycle] BLOCK — file conflict with running agent(s): "
                            f"{conflict_ids}. Files: {extracted_files}. "
                            f"Wait for those agents to complete or call "
                            f"`python3 {lifecycle_script} complete --agent-id <id>` to clear."
                        )

                # Step 2: register — only when no block was raised
                if not lifecycle_block_msg:
                    fish_id = f"fish-{uuid.uuid4().hex[:8]}-{int(time.time())}"
                    reg_files = extracted_files or [f"agent-{fish_id}"]
                    subprocess.run(
                        [sys.executable, str(lifecycle_script), "register",
                         "--agent-id", fish_id,
                         "--files"] + reg_files +
                        ["--description", prompt[:200]],
                        text=True, capture_output=True, timeout=5,
                    )
            except Exception:  # noqa: BLE001
                pass  # fail-open

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
    if worktree_forced_fg:
        tier_note += " [worktree→foreground: isolation=worktree forces run_in_background=False to prevent silent hangs]"
    if lifecycle_block_msg:
        tier_note = lifecycle_block_msg + "\n" + tier_note

    existing_msg = payload.get("systemMessage", "")
    payload["systemMessage"] = (
        f"{existing_msg}\n{tier_note}" if existing_msg else tier_note
    )

    # Surface lifecycle BLOCK as exit 1 so PreToolUse can halt the spawn.
    if lifecycle_block_msg:
        exit_code = 1

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
        # Delivery contract: append fish_id to prompt so the agent knows its
        # lifecycle ID and session-start sweeps can detect it if it goes silent.
        if fish_id and _lifecycle_script:
            complete_cmd = f"python3 {_lifecycle_script} complete --agent-id {fish_id}"
            updated_input["prompt"] = (
                prompt
                + f"\n\n[fish:{fish_id}] On task completion, signal the lifecycle manager: "
                + complete_cmd
            )
        hook_specific["updatedInput"] = updated_input
        payload["hookSpecificOutput"] = hook_specific

    print(json.dumps(payload, separators=(",", ":"), default=str))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
