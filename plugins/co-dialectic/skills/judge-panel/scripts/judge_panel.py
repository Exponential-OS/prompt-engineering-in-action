#!/usr/bin/env python3
"""Judge-panel cascade-then-jury harness.

Small-fish first: ≥2 cross-family cheap judges in parallel.
Escalate to one big-fish cross-family tiebreaker on disagreement or low confidence.

Reads model pins from ~/cyborg/.env. Shells out to `gemini` + `codex` CLIs.

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
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

VERSION = "3.0.0"

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
os.environ.setdefault("OPENAI_API_KEY", _ENV.get("OPENAI_API_KEY", ""))
os.environ.setdefault("GEMINI_API_KEY", _ENV.get("GEMINI_API_KEY", ""))
os.environ.setdefault("ANTHROPIC_API_KEY", _ENV.get("ANTHROPIC_API_KEY", ""))

SMALL_GEMINI = _ENV.get("GEMINI_CLI_DEFAULT_MODEL", "gemini-3.1-flash-lite-preview")
SMALL_OPENAI = _ENV.get("OPENAI_JUDGE_MODEL", "gpt-5.4-nano")
BIG_OPENAI = _ENV.get("OPENAI_BIG_JUDGE_MODEL", "gpt-5.4")
BIG_GEMINI = _ENV.get("GEMINI_CLI_PREMIUM_MODEL", "gemini-3.1-pro-preview")

CONFIDENCE_THRESHOLD = int(_ENV.get("JUDGE_PANEL_CONF_THRESHOLD", "80"))
CALL_TIMEOUT_S = int(_ENV.get("JUDGE_PANEL_TIMEOUT_S", "60"))

# Rough per-1M-token USD (published ~2026-04; refresh quarterly per P20).
# Used only for cost_usd_estimate — not dispatch logic.
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


def _run_gemini(model: str, prompt: str) -> JurorResult:
    start = time.time()
    try:
        proc = subprocess.run(
            ["gemini", "-m", model, "-p", prompt],
            capture_output=True, text=True, timeout=CALL_TIMEOUT_S, check=False,
            stdin=subprocess.DEVNULL,
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
    return _parse_verdict(
        raw, model=model, family="google",
        tokens_in=_estimate_tokens(prompt), tokens_out=_estimate_tokens(raw),
        latency_ms=latency_ms,
    )


def _run_openai(model: str, prompt: str) -> JurorResult:
    """Call OpenAI Chat Completions directly via urllib (no SDK dependency).

    We go direct because the bundled `codex` CLI is scoped to the user's
    ChatGPT-account auth, which does not permit nano/mini-tier models.
    Direct API with OPENAI_API_KEY works for all pricing tiers.
    """
    start = time.time()
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return JurorResult(
            model=model, family="openai", verdict="error", confidence=0,
            flags=[], latency_ms=0, error="OPENAI_API_KEY not set",
        )
    body = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_completion_tokens": 400,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=CALL_TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        return JurorResult(
            model=model, family="openai", verdict="error", confidence=0,
            flags=[], latency_ms=int((time.time() - start) * 1000),
            error=f"openai http {e.code}: {err_body}",
        )
    except urllib.error.URLError as e:
        return JurorResult(
            model=model, family="openai", verdict="error", confidence=0,
            flags=[], latency_ms=int((time.time() - start) * 1000),
            error=f"openai url: {e}",
        )
    except TimeoutError:
        return JurorResult(
            model=model, family="openai", verdict="timeout", confidence=0,
            flags=[], latency_ms=int((time.time() - start) * 1000),
            error=f"timeout after {CALL_TIMEOUT_S}s",
        )
    latency_ms = int((time.time() - start) * 1000)
    try:
        raw = payload["choices"][0]["message"]["content"] or ""
        usage = payload.get("usage", {}) or {}
        tokens_in = usage.get("prompt_tokens") or _estimate_tokens(prompt)
        tokens_out = usage.get("completion_tokens") or _estimate_tokens(raw)
    except (KeyError, IndexError, TypeError) as e:
        return JurorResult(
            model=model, family="openai", verdict="error", confidence=0,
            flags=[], latency_ms=latency_ms,
            error=f"openai payload shape: {e} — keys={list(payload.keys())}",
        )
    return _parse_verdict(
        raw, model=model, family="openai",
        tokens_in=tokens_in, tokens_out=tokens_out, latency_ms=latency_ms,
    )


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
        fut_gpt = ex.submit(_run_openai, SMALL_OPENAI, prompt)
        return [fut_gem.result(), fut_gpt.result()]


def _run_tiebreaker(prompt: str, tiebreaker_model: str) -> JurorResult:
    # Default tiebreaker: GPT-5.4 (OpenAI) — cross-family vs Claude author
    # and cross-family vs Gemini-Flash small judge.
    if tiebreaker_model.startswith("gemini"):
        return _run_gemini(tiebreaker_model, prompt)
    return _run_openai(tiebreaker_model, prompt)


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
                tiebreaker: str = BIG_OPENAI) -> dict:
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
    p.add_argument("--tiebreaker", default=BIG_OPENAI,
                   help=f"Escalation model (default {BIG_OPENAI})")
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
