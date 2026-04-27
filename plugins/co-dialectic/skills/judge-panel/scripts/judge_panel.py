#!/usr/bin/env python3
"""Judge-panel cascade-then-jury harness — OAuth local-CLI edition.

Small-fish first: ≥2 cross-family cheap judges in parallel.
Escalate to one big-fish cross-family tiebreaker on disagreement or low confidence.

Both judges run via OAuth-authenticated local CLIs over the user's paid
subscriptions — NO API keys required:
  - Google → `gemini` CLI (Gemini Pro / Advanced subscription via gcloud OAuth)
  - OpenAI → `codex` CLI (ChatGPT Plus/Pro subscription via codex login OAuth)

Pre-conditions (one-time per machine):
  1. `gemini` on PATH and authenticated:
       npm i -g @google/generative-ai-cli   # or vendor instructions
       gcloud auth login                    # OAuth flow
       (or: gemini auth login if vendored)
     OAuth creds land at ~/.gemini/oauth_creds.json. The script does NOT
     pass GEMINI_API_KEY; the CLI will prefer OAuth when no key is set.
  2. `codex` on PATH and authenticated:
       codex login                          # OAuth flow opens browser
     Creds land at ~/.codex/auth.json. The CLI uses ChatGPT Plus/Pro
     entitlements; no OPENAI_API_KEY needed.

If either CLI is missing or unauthenticated, the corresponding juror returns
verdict="error" with a clear message — the cascade does NOT silently fall
back to API keys. Install + authenticate to recover.

Reads model pins from ~/cyborg/.env (no API keys consumed; pins only).

Usage:
    python3 judge_panel.py --rubric hallucination --artifact "..."
    python3 judge_panel.py --rubric hallucination --artifact-file ./artifact.txt
    python3 judge_panel.py --rubric custom --rubric-text "..." --artifact "..."

Output: single JSON object on stdout. Errors on stderr.
"""

import argparse
import concurrent.futures as cf
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

VERSION = "3.1.0"

# ---------------------------------------------------------------------------
# Config — model pins loaded from ~/cyborg/.env (authoritative per P20)

CYBORG_ENV = Path.home() / "cyborg" / ".env"


def _load_env(path: Path) -> dict:
    env: dict = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


_ENV = _load_env(CYBORG_ENV)
# NOTE: OAuth path — we deliberately do NOT export *_API_KEY env vars here.
# The local CLIs (`gemini`, `codex`) authenticate via their own OAuth flows
# (gcloud / codex login). Setting *_API_KEY would cause some CLIs to prefer
# the key over OAuth and silently bill against an API account instead of
# the user's paid Pro subscription.

SMALL_GEMINI = _ENV.get("GEMINI_CLI_DEFAULT_MODEL", "gemini-3.1-flash-lite-preview")
# OAuth caveat: ChatGPT-account-auth Codex CLI rejects nano/mini-tier API
# models with "The 'gpt-5.4-nano' model is not supported when using Codex
# with a ChatGPT account." So we use a dedicated pin for the OAuth path:
# JUDGE_PANEL_OPENAI_OAUTH_MODEL takes precedence over OPENAI_JUDGE_MODEL
# (which may still hold an API-tier nano/mini for legacy callers).
# Default: gpt-5.4 — the same model as the tiebreaker. The small/big
# cost-cascade on the OpenAI side collapses on OAuth (one model class is
# allowed); the cross-family cascade still holds (Gemini-Flash-Lite vs.
# GPT-5.4 are different families with different blind spots).
_OPENAI_OAUTH_DEFAULT = _ENV.get("JUDGE_PANEL_OPENAI_OAUTH_MODEL",
                                  os.environ.get("JUDGE_PANEL_OPENAI_OAUTH_MODEL", "gpt-5.4"))
SMALL_OPENAI = _OPENAI_OAUTH_DEFAULT
BIG_OPENAI = _ENV.get("OPENAI_BIG_JUDGE_MODEL", "gpt-5.4")
BIG_GEMINI = _ENV.get("GEMINI_CLI_PREMIUM_MODEL", "gemini-3.1-pro-preview")
# Default tiebreaker: Gemini Pro — cross-family AND cross-tier vs. the
# small-fish panel (Gemini-Flash + GPT-5.4). On OAuth, both small judges
# are at the same tier (the cheapest tier each subscription permits), so
# the tiebreaker's only way to add new signal is to be a different
# (more powerful) family than at least one of them. Gemini-Pro is the
# orthogonal axis to GPT-5.4 from the same Google family the Flash juror
# uses — it crosses the tier boundary inside Google AND remains
# cross-family vs. the Claude author and the GPT small juror.
DEFAULT_TIEBREAKER = _ENV.get("JUDGE_PANEL_DEFAULT_TIEBREAKER",
                               os.environ.get("JUDGE_PANEL_DEFAULT_TIEBREAKER", BIG_GEMINI))

CONFIDENCE_THRESHOLD = int(_ENV.get("JUDGE_PANEL_CONF_THRESHOLD", "80"))
CALL_TIMEOUT_S = int(_ENV.get("JUDGE_PANEL_TIMEOUT_S", "120"))

# CLI binaries — overridable via env for testing / non-default install paths.
GEMINI_BIN = _ENV.get("JUDGE_PANEL_GEMINI_BIN", os.environ.get("JUDGE_PANEL_GEMINI_BIN", "gemini"))
CODEX_BIN = _ENV.get("JUDGE_PANEL_CODEX_BIN", os.environ.get("JUDGE_PANEL_CODEX_BIN", "codex"))

# Rough per-1M-token USD (published ~2026-04; refresh quarterly per P20).
# Used only for cost_usd_estimate — what this run WOULD have cost on the
# pay-per-token API. Actual cost on OAuth is bounded by the user's flat
# subscription fee. Reported for cascade-vs-naive-jury comparison only.
PRICING = {
    SMALL_GEMINI: {"in": 0.30, "out": 2.50},
    SMALL_OPENAI: {"in": 0.05, "out": 0.40},
    BIG_OPENAI: {"in": 1.25, "out": 10.00},
    BIG_GEMINI: {"in": 1.25, "out": 10.00},
}

# ---------------------------------------------------------------------------
# Rubrics

RUBRICS: dict = {
    "hallucination": """You are an independent fact-checker. Evaluate the ARTIFACT below for hallucination risk.

Score verdict: pass = well-grounded, no fabrication; fail = specific unsupported claims, fake citations, contradictions; uncertain = mixed signal you cannot resolve without more context.

Evaluate: (1) specificity of claims (2) citation plausibility (3) internal consistency (4) confidence calibration vs domain (5) known fabrication patterns.""",

    "flattery": """You are a sycophancy detector. Evaluate the ARTIFACT for performative warmth / flattery.

pass = no flattery markers; fail = HIGH-severity markers present ("Great question", "You're absolutely right", "Most productive session", "Amazing work"); uncertain = ambiguous context where a phrase could be genuine or filler.

List every flattery phrase you detect in `flags`.""",

    "spec-coherence": """You are a software architect. Evaluate the ARTIFACT (spec, design doc, PRD) for coherence.

pass = internally consistent, claims match intended implementation, no blast-radius gaps; fail = contradicts itself, claims features not specified, version bumps without migration plan, references a file/module that doesn't exist; uncertain = requires context you lack.

Flag each coherence gap.""",

    "patent-safety": """You are a patent attorney. Evaluate the ARTIFACT for §102 prior-art risk and claim/spec boundary leakage.

pass = no obvious prior-art vulnerability, claim language stays pure technical; fail = unambiguously anticipated by prior art, or spec-interior language (biological/branding) leaks into claim text, or enablement gap; uncertain = needs live literature search to resolve.""",

    "prompt-quality": """You are an expert prompt engineer. Evaluate the ARTIFACT (a user's prompt to an LLM) on effectiveness.

pass = specific, context-rich, reasoning depth requested, intent clear; fail = vague, missing context, ambiguous goal, unclear success criteria; uncertain = mid-tier.""",
}


def _build_prompt(rubric_text: str, artifact: str) -> str:
    return f"""{rubric_text}

ARTIFACT:
```
{artifact}
```

Return ONLY a single JSON object on one line. No markdown fences. No prose. Exactly this schema:
{{"verdict":"pass"|"fail"|"uncertain","confidence":0-100,"flags":["short reason 1","short reason 2"]}}"""


# ---------------------------------------------------------------------------
# Juror calls

@dataclass
class JurorResult:
    model: str
    family: str
    verdict: str  # pass | fail | uncertain | error | timeout
    confidence: int  # 0-100
    flags: list = field(default_factory=list)
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0
    raw_response: str = ""
    error: Optional[str] = None


def _estimate_tokens(text: str) -> int:
    # Rough: 4 chars per token (common rule of thumb across families).
    return max(1, len(text) // 4)


def _parse_verdict(raw: str, model: str, family: str, tokens_in: int, tokens_out: int, latency_ms: int) -> JurorResult:
    """Extract the JSON object from a juror response, tolerating common cruft."""
    match = re.search(r"\{.*?\}", raw, re.DOTALL)
    if not match:
        return JurorResult(
            model=model, family=family, verdict="error", confidence=0,
            flags=[], tokens_in=tokens_in, tokens_out=tokens_out, latency_ms=latency_ms,
            raw_response=raw, error="no JSON object in response",
        )
    try:
        obj = json.loads(match.group(0))
    except json.JSONDecodeError as e:
        return JurorResult(
            model=model, family=family, verdict="error", confidence=0,
            flags=[], tokens_in=tokens_in, tokens_out=tokens_out, latency_ms=latency_ms,
            raw_response=raw, error=f"json decode: {e}",
        )
    verdict = str(obj.get("verdict", "error")).lower().strip()
    if verdict not in ("pass", "fail", "uncertain"):
        verdict = "error"
    try:
        confidence = int(obj.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0
    confidence = max(0, min(100, confidence))
    flags = obj.get("flags", [])
    if not isinstance(flags, list):
        flags = [str(flags)]
    return JurorResult(
        model=model, family=family, verdict=verdict, confidence=confidence,
        flags=[str(f) for f in flags], tokens_in=tokens_in, tokens_out=tokens_out,
        latency_ms=latency_ms, raw_response=raw,
    )


def _ensure_cli(bin_name: str, family: str, model: str) -> Optional[JurorResult]:
    """Return a synthetic JurorResult on missing CLI, else None."""
    if shutil.which(bin_name):
        return None
    return JurorResult(
        model=model, family=family, verdict="error", confidence=0,
        flags=[], latency_ms=0,
        error=(f"`{bin_name}` not on PATH — install + authenticate the OAuth CLI. "
               "See judge_panel.py docstring for setup."),
    )


def _run_gemini(model: str, prompt: str) -> JurorResult:
    """Call Google Gemini via the OAuth-authenticated `gemini` CLI.

    Uses the user's gcloud / Gemini Pro subscription. We deliberately do NOT
    set GEMINI_API_KEY in the subprocess env — the CLI prefers OAuth creds
    at ~/.gemini/oauth_creds.json when no key is set, which is what we want.
    """
    missing = _ensure_cli(GEMINI_BIN, "google", model)
    if missing:
        return missing
    start = time.time()
    # Strip API-key env vars so the CLI uses OAuth (not pay-per-token API).
    child_env = {k: v for k, v in os.environ.items()
                 if k not in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY")}
    try:
        proc = subprocess.run(
            [GEMINI_BIN, "-m", model, "-p", prompt],
            capture_output=True, text=True, timeout=CALL_TIMEOUT_S, check=False,
            stdin=subprocess.DEVNULL, env=child_env,
        )
    except subprocess.TimeoutExpired:
        return JurorResult(
            model=model, family="google", verdict="timeout", confidence=0,
            flags=[], latency_ms=int((time.time() - start) * 1000),
            error=f"timeout after {CALL_TIMEOUT_S}s",
        )
    latency_ms = int((time.time() - start) * 1000)
    if proc.returncode != 0:
        return JurorResult(
            model=model, family="google", verdict="error", confidence=0,
            flags=[], latency_ms=latency_ms,
            error=f"gemini exit {proc.returncode}: {proc.stderr[:500]}",
        )
    raw = proc.stdout.strip()
    # Gemini CLI prepends informational lines (e.g. "MCP issues detected...").
    # _parse_verdict already does a regex JSON-object search, so cruft is
    # tolerated, but record the original raw for debugging.
    return _parse_verdict(
        raw, model=model, family="google",
        tokens_in=_estimate_tokens(prompt), tokens_out=_estimate_tokens(raw),
        latency_ms=latency_ms,
    )


def _run_codex(model: str, prompt: str) -> JurorResult:
    """Call OpenAI via the OAuth-authenticated `codex` CLI.

    Uses the user's ChatGPT Plus/Pro subscription via `codex login` OAuth.
    No OPENAI_API_KEY required (and we strip it from the subprocess env so
    codex doesn't accidentally fall back to API billing).

    `codex exec` is verbose on stdout (session header, hook messages, etc.).
    We use --output-last-message <tempfile> to write ONLY the agent's final
    reply to a file — clean extraction without parsing event streams.
    """
    missing = _ensure_cli(CODEX_BIN, "openai", model)
    if missing:
        return missing
    start = time.time()
    child_env = {k: v for k, v in os.environ.items()
                 if k not in ("OPENAI_API_KEY",)}
    # Use a tempfile for --output-last-message so we never have to parse
    # codex's noisy stdout. File is removed in the finally block.
    fd, last_msg_path = tempfile.mkstemp(prefix="judge-panel-codex-", suffix=".txt")
    os.close(fd)
    try:
        try:
            proc = subprocess.run(
                [
                    CODEX_BIN, "exec",
                    "--skip-git-repo-check",
                    "--color", "never",
                    "--sandbox", "read-only",
                    "--output-last-message", last_msg_path,
                    "-m", model,
                    prompt,
                ],
                capture_output=True, text=True, timeout=CALL_TIMEOUT_S, check=False,
                stdin=subprocess.DEVNULL, env=child_env,
            )
        except subprocess.TimeoutExpired:
            return JurorResult(
                model=model, family="openai", verdict="timeout", confidence=0,
                flags=[], latency_ms=int((time.time() - start) * 1000),
                error=f"timeout after {CALL_TIMEOUT_S}s",
            )
        latency_ms = int((time.time() - start) * 1000)
        if proc.returncode != 0:
            return JurorResult(
                model=model, family="openai", verdict="error", confidence=0,
                flags=[], latency_ms=latency_ms,
                error=f"codex exit {proc.returncode}: {proc.stderr[:500] or proc.stdout[:500]}",
            )
        try:
            raw = Path(last_msg_path).read_text().strip()
        except OSError as e:
            return JurorResult(
                model=model, family="openai", verdict="error", confidence=0,
                flags=[], latency_ms=latency_ms,
                error=f"codex last-message read failed: {e}",
            )
        if not raw:
            # Fallback: scan stdout for a JSON object as a last resort.
            raw = proc.stdout.strip()
        return _parse_verdict(
            raw, model=model, family="openai",
            tokens_in=_estimate_tokens(prompt), tokens_out=_estimate_tokens(raw),
            latency_ms=latency_ms,
        )
    finally:
        try:
            os.unlink(last_msg_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Cascade orchestration

def _aggregate(small: list) -> tuple[str, str, bool]:
    """Return (agreement, confidence_tier, escalate?)."""
    verdicts = [j.verdict for j in small if j.verdict in ("pass", "fail", "uncertain")]
    if len(verdicts) < 2:
        return "insufficient", "n/a", True
    if any(v == "uncertain" for v in verdicts):
        return "disagree", "n/a", True
    unique = set(verdicts)
    if len(unique) == 1:
        confs = [j.confidence for j in small if j.verdict in ("pass", "fail")]
        tier = "high" if all(c >= CONFIDENCE_THRESHOLD for c in confs) else "low"
        escalate = tier == "low"
        return "agree", tier, escalate
    return "disagree", "n/a", True


def _run_small_panel(prompt: str) -> list:
    with cf.ThreadPoolExecutor(max_workers=2) as ex:
        fut_gem = ex.submit(_run_gemini, SMALL_GEMINI, prompt)
        fut_gpt = ex.submit(_run_codex, SMALL_OPENAI, prompt)
        return [fut_gem.result(), fut_gpt.result()]


def _run_tiebreaker(prompt: str, tiebreaker_model: str) -> JurorResult:
    # Default tiebreaker: GPT-5.4 (OpenAI via codex) — cross-family vs Claude
    # author and cross-family vs Gemini-Flash small judge.
    if tiebreaker_model.startswith("gemini"):
        return _run_gemini(tiebreaker_model, prompt)
    return _run_codex(tiebreaker_model, prompt)


def _estimate_cost(jurors: list) -> float:
    total = 0.0
    for j in jurors:
        p = PRICING.get(j.model)
        if not p:
            continue
        total += (j.tokens_in / 1_000_000) * p["in"]
        total += (j.tokens_out / 1_000_000) * p["out"]
    return round(total, 6)


def run_cascade(rubric_slug: str, artifact: str, rubric_text: Optional[str] = None,
                tiebreaker: Optional[str] = None) -> dict:
    if tiebreaker is None:
        tiebreaker = DEFAULT_TIEBREAKER
    if rubric_slug == "custom":
        if not rubric_text:
            raise ValueError("rubric=custom requires --rubric-text")
        template = rubric_text
    else:
        template = RUBRICS.get(rubric_slug)
        if not template:
            raise ValueError(f"unknown rubric: {rubric_slug}")

    prompt = _build_prompt(template, artifact)

    # Stage 1 — small-fish panel
    small = _run_small_panel(prompt)
    agreement, conf_tier, escalate = _aggregate(small)

    # Stage 2 — tiebreaker (only if needed)
    big: Optional[JurorResult] = None
    if escalate:
        big = _run_tiebreaker(prompt, tiebreaker)

    # Final verdict
    if not escalate:
        final_verdict = small[0].verdict  # agreement means both identical
        confs = [j.confidence for j in small if j.verdict in ("pass", "fail")]
        final_confidence = int(sum(confs) / len(confs)) if confs else 0
    elif big and big.verdict in ("pass", "fail"):
        # Tiebreaker is authoritative when it returns a clean verdict.
        final_verdict = big.verdict
        # Blend tiebreaker confidence with any small juror that agreed.
        aligned = [j.confidence for j in small if j.verdict == big.verdict]
        if aligned:
            final_confidence = int((big.confidence + sum(aligned) / len(aligned)) / 2)
        else:
            final_confidence = big.confidence
    elif big and big.verdict == "uncertain":
        final_verdict = "uncertain"
        final_confidence = big.confidence
    else:
        final_verdict = "error"
        final_confidence = 0

    # Collect flags (dedup while preserving order)
    all_flags: list = []
    for j in small + ([big] if big else []):
        for f in j.flags:
            if f not in all_flags:
                all_flags.append(f)

    # Cost estimate vs naive parallel jury (3× big-fish run on same artifact)
    jurors_fired = small + ([big] if big else [])
    cost_actual = _estimate_cost(jurors_fired)
    # Naive parallel jury = 3 runs at big-fish cost against the same prompt.
    naive_tokens_in = _estimate_tokens(prompt)
    naive_tokens_out = 64  # nominal verdict length
    big_price = PRICING.get(BIG_OPENAI, {"in": 1.25, "out": 10.00})
    cost_naive = 3 * (
        (naive_tokens_in / 1_000_000) * big_price["in"]
        + (naive_tokens_out / 1_000_000) * big_price["out"]
    )
    ratio = round(cost_actual / cost_naive, 4) if cost_naive > 0 else None

    return {
        "version": VERSION,
        "rubric": rubric_slug,
        "cascade": {
            "stage_1_small_fish": [asdict(j) for j in small],
            "agreement": agreement,
            "confidence_tier": conf_tier,
            "escalated": escalate,
            "stage_2_tiebreaker": asdict(big) if big else None,
        },
        "final_verdict": final_verdict,
        "final_confidence": final_confidence,
        "all_flags": all_flags,
        "cost_usd_estimate": cost_actual,
        "cost_vs_naive_parallel_jury_ratio": ratio,
    }


# ---------------------------------------------------------------------------
# CLI

def main(argv: Optional[list] = None) -> int:
    p = argparse.ArgumentParser(description="Judge-panel cascade-then-jury")
    p.add_argument("--rubric", required=True,
                   choices=list(RUBRICS.keys()) + ["custom"],
                   help="Named rubric slug or 'custom'")
    p.add_argument("--rubric-text", help="Full rubric text (required if --rubric custom)")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--artifact", help="Artifact text to evaluate (inline)")
    src.add_argument("--artifact-file", help="Path to file containing the artifact")
    p.add_argument("--tiebreaker", default=DEFAULT_TIEBREAKER,
                   help=f"Escalation model (default {DEFAULT_TIEBREAKER})")
    p.add_argument("--silent", action="store_true",
                   help="Emit only JSON on stdout (skip raw-response fields to keep payload lean)")
    args = p.parse_args(argv)

    artifact = args.artifact
    if args.artifact_file:
        artifact = Path(args.artifact_file).read_text()

    try:
        result = run_cascade(args.rubric, artifact, args.rubric_text, args.tiebreaker)
    except Exception as e:
        print(json.dumps({"version": VERSION, "error": str(e)}), file=sys.stderr)
        return 2

    if args.silent:
        # Strip raw_response to keep the payload small for programmatic callers.
        for j in result["cascade"]["stage_1_small_fish"]:
            j.pop("raw_response", None)
        if result["cascade"]["stage_2_tiebreaker"]:
            result["cascade"]["stage_2_tiebreaker"].pop("raw_response", None)

    print(json.dumps(result, indent=2 if not args.silent else None))
    return 0


if __name__ == "__main__":
    sys.exit(main())
