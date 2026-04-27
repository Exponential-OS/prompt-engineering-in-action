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
  version: "3.3.0"
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

## Auth model — OAuth local CLIs (v3.3.0+)

**As of v3.3.0, both jurors invoke OAuth-authenticated local CLIs over the
user's paid Pro subscriptions — no API keys required.**

| Family | CLI | OAuth source | Pre-condition |
|---|---|---|---|
| Google | `gemini` | `gcloud auth login` → `~/.gemini/oauth_creds.json` | Gemini Pro / Advanced subscription |
| OpenAI | `codex exec` | `codex login` → `~/.codex/auth.json` | ChatGPT Plus / Pro subscription |

The script strips `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` from
the subprocess env to force the CLIs onto the OAuth path (otherwise they
silently fall back to API billing).

### API fallback (v3.2.0+) — opt-in, CLI-not-installed only

The cascade does NOT silently fall back to paid API billing. Fallback is
**off by default** and gated by a tightened approval semantic:

| CLI binary state | Approval flag set? | Behavior |
|---|---|---|
| Not on PATH (binary missing) | No | `verdict=error, flags=[CLI_NOT_INSTALLED]` |
| Not on PATH (binary missing) | Yes | API fallback fires; `flags=[API_FALLBACK_USED, ...]` |
| On PATH but auth fails / runtime error / non-zero exit | Either | `verdict=error` with the specific CLI error. **No fallback.** |
| On PATH and runs successfully | N/A | CLI used (existing OAuth path) |

The principle: API fallback exists only for the case where the user has
genuinely not installed the CLI yet (e.g., a fresh machine, or running
from CI). CLI installed but failing means the CLI setup is broken — fix
that, do not silently mask via paid API.

**Approval can be set via:**
- CLI flags on `python3 judge_panel.py`:
  - `--api-fallback-approved` (master gate — both lanes)
  - `--api-fallback-approved-gemini` (Gemini lane only)
  - `--api-fallback-approved-openai` (OpenAI lane only)
- Environment variables (programmatic / skill activation):
  - `JUDGE_PANEL_API_FALLBACK_APPROVED=1`
  - `JUDGE_PANEL_API_FALLBACK_APPROVED_GEMINI=1`
  - `JUDGE_PANEL_API_FALLBACK_APPROVED_OPENAI=1`

When approved, the relevant API key must also be set
(`GEMINI_API_KEY` / `GOOGLE_API_KEY` / `OPENAI_API_KEY`); otherwise the
juror returns `flags=[API_FALLBACK_NO_KEY]`. **API fallback bills the
user's pay-per-token API account, not the flat-fee Pro subscription** —
this is why approval is explicit and per-lane.

### Models used (pinned, read from `~/cyborg/.env`)

| Stage | Model | Family | Role | Notes |
|---|---|---|---|---|
| Small-fish | `gemini-3.1-flash-lite-preview` | Google | Panel juror 1 | OAuth-permitted everywhere |
| Small-fish | `gpt-5.4` | OpenAI | Panel juror 2 | See OAuth-tier caveat below |
| Tiebreaker (default) | `gemini-3.1-pro-preview` | Google | Final verdict | Cross-tier vs. Flash-Lite |
| Tiebreaker (alt) | `gpt-5.4` | OpenAI | Final verdict | Pass via `--tiebreaker gpt-5.4` |

**OAuth-tier caveat (the small/big cascade collapses on the OpenAI lane).**
ChatGPT-account-auth Codex rejects `gpt-5.4-nano` and other API-only
nano/mini-tier models with: `"The 'gpt-5.4-nano' model is not supported
when using Codex with a ChatGPT account."` So the small-fish OpenAI juror
defaults to `gpt-5.4` (the cheapest ChatGPT-Plus-permitted tier). On the
OpenAI lane, small=big in tier — but the cross-FAMILY cascade still holds
(Gemini-Flash-Lite vs. GPT-5.4 are different training distributions).
The default tiebreaker is therefore `gemini-3.1-pro-preview` — crossing
the tier boundary inside Google AND remaining cross-family vs. both small
judges and the Claude author.

**Override the small-OpenAI model** via `JUDGE_PANEL_OPENAI_OAUTH_MODEL`
(in `~/cyborg/.env` or shell env). When OpenAI ships a ChatGPT-permitted
mini/nano tier, set the pin and the small-OpenAI cost drops automatically.

**Cross-family guarantee:** the two small judges are from different
families (Google + OpenAI). The tiebreaker is cross-family vs. author
(Claude) AND cross-family vs. whichever small judge triggered escalation.
No two judges in the cascade share a training distribution with the author.

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
  "version": "3.1.0",
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
        "model": "gpt-5.4",
        "family": "openai",
        "verdict": "pass",
        "confidence": 85,
        "flags": [],
        "tokens_in": 412,
        "tokens_out": 52,
        "latency_ms": 8200
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

**Optimal cost, not minimum cost — and on OAuth, "cost" is bounded by
the user's flat subscription fee.** The `cost_usd_estimate` field still
reports what the run WOULD have cost on the pay-per-token API
(useful for cascade-vs-naive-jury comparison), but actual marginal cost
to the user is zero per call up to subscription quota.

OAuth tradeoffs the user is consciously accepting:
1. **Latency:** local-CLI calls add ~3-10s of process startup per call
   (codex spins up a session, gemini parses MCP config). Wall-clock
   per cascade is ~10-20s vs. ~2-5s for the API path. Cross-family
   verification is still in P11 / P21 budget.
2. **Subscription rate-limits:** ChatGPT Plus and Gemini Pro have
   per-day or per-hour usage caps. A judge-panel campaign that fires
   the cascade on hundreds of artifacts in a session can exhaust the
   cap. If a juror returns `verdict="error"` with `rate_limit` in the
   message, throttle the cascade or fall back to a different rubric.
3. **Tier collapse on OpenAI lane** (see Auth model section above).

If escalation fires on every run, the cost advantage collapses. If
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
