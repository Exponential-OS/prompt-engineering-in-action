---
name: judge-panel
description: >
  Cross-family cascade-then-jury review. Use when the user says "judge this",
  "review with a panel", "cross-family review", "jury beats judge", or needs
  independent verification of an AI-generated artifact (code, spec, patent,
  copy, decision). Runs ≥2 cheap cross-family small-fish judges first
  (Gemini-Flash + GPT-nano). If they agree with high confidence, verdict
  stands. If they disagree or confidence is low, escalates to one expensive
  cross-family tiebreaker. Returns verdict + confidence + which judges fired
  + token cost.
metadata:
  version: "3.2.0"
  author: "Anand Vallamsetla"
  tier: "core"
  plugin_number: 4
---

### BEGIN JUDGE-PANEL ###
# Judge Panel — Cascade-then-Jury Verification

**Plugin #4, Core tier.** Operationalizes the Defense-in-Depth Part 2 thesis
("jury beats judge"). Constitution anchor: Ground Zero — Independent
Verification Gate + Model-Diversity sub-mandate. Also P0.5 (Boundary
Self-Awareness) and P22 (Boundary-First Qualification).

## Why this exists

A single frontier LLM cannot peer-review itself. Same-family reviewers share
training distribution, RLHF, and characteristic failure modes — same-family
review is a closed loop that validates what the author already believes.
Cross-family review crosses the training-distribution boundary and lets new
information enter. Empirically (Defense-in-Depth Part 2 incident,
2026-04-23), a single Gemini-2.5-Flash pass caught a class of drift that
three same-family Claude reviewers had rationalized.

But parallel juries are expensive. **Cascade-then-jury** (FrugalGPT /
Cascade Routing lineage) is the cheaper default: cheap small-fish first,
escalate only on disagreement or low confidence. The literature:

- Verga et al. 2024 (PoLL) — panel of smaller diverse judges beats single
  GPT-4 at ~7× less cost
- Chen/Zaharia/Zou 2023 (FrugalGPT) — cheap→expensive cascade, 30-98%
  cost savings
- Dekoninck et al. ICML 2025 (Cascade Routing) — routing + cascading
  competitive with either alone

## When to activate

**Explicit invocation:**
- `judge-panel <artifact>` / `codi judge <artifact>`
- "review with a panel"
- "cross-family review this"
- "jury beats judge check"
- "run the cascade on this"

**Automatic activation (when another skill delegates):**
- `hallucination-detector` (plugin #3) calls judge-panel for post-flight
  scoring
- `calibration-auditor` may call judge-panel for sycophancy scoring when
  the caller requests an external verdict

**Silent mode:** When called by another skill, emit only the JSON verdict.
Skip the conversational framing.

## The cascade

```
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1 — SMALL-FISH PANEL (parallel, always fires)             │
│  ┌───────────────────┐   ┌────────────────────┐                  │
│  │ Gemini Flash Lite │   │ GPT-5.4-nano       │                  │
│  │ (Google family)   │   │ (OpenAI family)    │                  │
│  └─────────┬─────────┘   └──────────┬─────────┘                  │
│            │                        │                             │
│            └─────────┬──────────────┘                             │
│                      ▼                                            │
│        ┌───────────────────────────┐                              │
│        │  Aggregate verdicts       │                              │
│        │  Compute agreement + conf │                              │
│        └───────┬───────────────────┘                              │
│                │                                                  │
│    ┌───────────┴───────────┐                                      │
│    ▼                       ▼                                      │
│  AGREE + HIGH CONF     DISAGREE or LOW CONF                       │
│  (skip escalation)     (escalate)                                 │
└────┼───────────────────────┼─────────────────────────────────────┘
     │                       │
     │                       ▼
     │       ┌──────────────────────────────────────────────┐
     │       │  STAGE 2 — BIG-FISH TIEBREAKER (only if needed) │
     │       │  ┌────────────────────┐                        │
     │       │  │ GPT-5.4 (default)  │   (or Gemini 3.1 Pro)  │
     │       │  │ cross-family vs.   │                        │
     │       │  │  author (Claude)   │                        │
     │       │  └──────────┬─────────┘                        │
     │       │             ▼                                  │
     │       │  Final verdict = tiebreaker-weighted           │
     │       └──────────────────────┬───────────────────────┘
     │                              │
     └──────────┬───────────────────┘
                ▼
        ┌──────────────────┐
        │  Return JSON     │
        │  verdict packet  │
        └──────────────────┘
```

## Models used (pinned, read from ~/cyborg/.env)

| Stage | Model | Family | Role | Typical cost |
|---|---|---|---|---|
| Small-fish | `gemini-3.1-flash-lite-preview` | Google | Panel juror 1 | ~$0.30/$2.50 per 1M in/out tokens |
| Small-fish | `gpt-5.4-nano` | OpenAI | Panel juror 2 | ~cheap tier |
| Tiebreaker (default) | `gpt-5.4` | OpenAI | Final verdict | ~mid tier |
| Tiebreaker (alt) | `gemini-3.1-pro-preview` | Google | Final verdict | ~mid tier |

**Cross-family guarantee:** the two small judges are from different families
(Google + OpenAI). The tiebreaker is cross-family vs. author (Claude) AND
cross-family vs. whichever small judge triggered escalation. No two judges
in the cascade share a training distribution with the author.

## Confidence + agreement rules

Each juror returns: `{"verdict": "pass|fail|uncertain", "confidence": 0-100, "flags": [...]}`.

**Agreement check:**
- Both small judges return `pass` → AGREE
- Both small judges return `fail` → AGREE
- One `pass`, one `fail` → DISAGREE (always escalates)
- One or both `uncertain` → DISAGREE (always escalates)

**Confidence check (only meaningful when AGREE):**
- Both confidences ≥ 80 → HIGH confidence (skip escalation)
- Either confidence < 80 → LOW confidence (escalate)

**Escalation condition:** `DISAGREE OR (AGREE AND LOW_CONF)`. The
small-fish panel verdict stands only on `AGREE AND HIGH_CONF`.

**Why ≥2 small-fish validation:** a single small judge's verdict is one
sample — it could share a blind spot with the author by coincidence.
Requiring two independent cross-family small judges to converge is a
Rastogi-2023-style complementation move: each juror's weakness is paired
with the other juror's orthogonal training distribution, so agreement is
structurally informative.

## Invocation — how the main agent runs it

The agent invokes the skill by calling the bundled Python harness:

```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric "<rubric slug or inline rubric>" \
  --artifact-file <path-to-artifact>
```

Or by passing the artifact inline:

```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric hallucination \
  --artifact "The response text to evaluate..."
```

Output is a single JSON object on stdout (schema below). No other stdout
writes — errors go to stderr. This makes the skill composable: any other
skill can call `judge_panel.py`, parse stdout as JSON, and act on the
verdict without prompting the main LLM again.

## Output JSON shape

```json
{
  "version": "3.0.0",
  "rubric": "hallucination",
  "cascade": {
    "stage_1_small_fish": [
      {
        "model": "gemini-3.1-flash-lite-preview",
        "family": "google",
        "verdict": "pass",
        "confidence": 88,
        "flags": [],
        "tokens_in": 412,
        "tokens_out": 48,
        "latency_ms": 1840
      },
      {
        "model": "gpt-5.4-nano",
        "family": "openai",
        "verdict": "pass",
        "confidence": 85,
        "flags": [],
        "tokens_in": 412,
        "tokens_out": 52,
        "latency_ms": 920
      }
    ],
    "agreement": "agree",
    "confidence_tier": "high",
    "escalated": false,
    "stage_2_tiebreaker": null
  },
  "final_verdict": "pass",
  "final_confidence": 86,
  "all_flags": [],
  "cost_usd_estimate": 0.0041,
  "cost_vs_naive_parallel_jury_ratio": 0.32
}
```

When escalation fires, `stage_2_tiebreaker` is populated and
`final_verdict` comes from the tiebreaker, weighted by whichever small
judge agreed with it.

## Rubric slugs bundled with the skill

The Python harness ships with named rubrics. A caller passes the slug;
the harness substitutes the artifact into the rubric template and sends
to each judge.

| Slug | Domain | What it evaluates |
|---|---|---|
| `hallucination` | Factual risk | Specificity, citation plausibility, confidence calibration, contradiction (mirrors codi-v3.1 spec §5.3) |
| `flattery` | Sycophancy | High/medium/low markers from calibration-auditor spec |
| `spec-coherence` | Artifact coherence | Blast-radius checks, claims-vs-implementation drift (P9) |
| `patent-safety` | Patent disclosure | §102 prior art risk, claim/spec boundary leakage |
| `prompt-quality` | Prompt rubric | Specificity, context, reasoning depth, intent clarity |
| `custom` | Any | Pass `--rubric-text <inline>` with the full rubric text |

Callers can pass `--rubric custom --rubric-text "..."` for ad-hoc rubrics.

## How to verify the skill works

**Trigger command 1 (explicit):** Say `judge-panel check this: "The
Eiffel Tower was built in 1923 and is located in Madrid."`

**Expected output:** Both small judges flag factual errors; AGREE + HIGH
confidence on `fail`; no escalation; JSON verdict with two `flags` entries
(wrong year, wrong city).

**Trigger command 2 (escalation):** Say `judge-panel check this:
"FrugalGPT (Chen et al. 2023) achieves 30-98% cost savings via a
cheap→expensive LLM cascade."`

**Expected output:** Both small judges likely `pass` with varying
confidence (one may flag the savings range as too wide or the claim as
unsupported without citation). If disagreement → escalates. JSON verdict
with `escalated: true`.

**Trigger command 3 (silent mode, as another skill):**
```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric hallucination --artifact "..." --silent
```
**Expected output:** Pure JSON on stdout, nothing on stderr unless an
error fires.

**Failure modes:**
- Any judge call times out (> 30s) → mark that judge as `timeout`, proceed
  with remaining judges; if fewer than 2 small-fish returned, force escalate
- Rubric returns non-JSON from a judge → retry once; if second attempt
  also non-JSON, mark that judge as `parse_error` and force escalate
- All judges fail → return `final_verdict: "error"` with stderr log

## Cost discipline (P13 + Ground Zero 3D)

**Optimal cost, not minimum cost.** The cascade costs ~$0.004 per
small-fish panel (Gemini Flash + GPT-nano on a ~500-token artifact). A
full naive parallel jury of 3 Opus-class reviewers would cost ~$0.12.
30× cost delta — and the cascade catches real issues the parallel jury
misses (Part 2 thesis).

But if escalation fires on every run, the cost advantage collapses. If
the eval harness reports escalation_rate > 50% over 20 runs, the
confidence threshold (currently 80) is too strict — loosen it, or the
rubrics are ambiguous — sharpen them. This is P14 (self-evolution)
applied to the cascade.

## Relationship to other skills

- **Upstream callers:** `hallucination-detector` (plugin #3),
  `calibration-auditor` (plugin #8 — for external-verdict mode),
  any skill that needs a cheap cross-family sanity check
- **Independent Verification Gate:** judge-panel is the default runtime
  mechanism for satisfying the Gate on artifacts where full human +
  model-diversity review is too slow or expensive
- **Anti-pattern:** do NOT call judge-panel from inside a Claude subagent
  spawned by another Claude. Same-model subagent would pollute the
  cross-family guarantee. Always invoke from the main agent or directly
  from the Python harness

### END JUDGE-PANEL ###
