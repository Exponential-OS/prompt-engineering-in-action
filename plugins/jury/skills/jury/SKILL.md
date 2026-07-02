---
name: jury
description: >
  Standalone cross-family cascade-then-jury reviewer. Use when the user says
  "jury", "cross-family review", "judge this", "jury beats judge", or
  "review with a panel". Runs a free OAuth-local-CLI jury core:
  Gemini-Flash + GPT small-fish first, then one cross-family tiebreaker only
  when needed.
metadata:
  version: "0.1.0"
  author: "Anand Vallamsetla"
  tier: "core"
---

### BEGIN JURY ###
# Jury — Cross-Family Cascade Review

**Version:** 0.1.0

Jury is a standalone cross-family reviewer. It exists for the "jury beats
judge" base case: use independent model families to review an artifact instead
of asking the authoring model to self-review.

Jury-core is intentionally plain: pass/fail/uncertain review, two cheap
cross-family small-fish judges first, and one cross-family tiebreaker only when
the first stage disagrees or has low confidence. It uses OAuth-authenticated
local CLIs by default, so no API keys are required and the marginal API cost is
zero under the user's local subscriptions.

## When To Activate

Use this skill when the user says:

- `jury`
- `cross-family review`
- `judge this`
- `jury beats judge`
- `review with a panel`

Also use it when an artifact needs independent verification across model
families: code, specs, claims, copy, release notes, product decisions, patent
drafts, or any other generated output where same-family self-review is not
enough.

## The Cascade

Stage 1 always runs the small-fish panel:

- Gemini Flash lane: Google family via `agy`
- GPT lane: OpenAI family via `codex exec`

Each juror returns:

```json
{"verdict":"pass|fail|uncertain","confidence":0,"flags":[]}
```

Agreement rules:

- Both small judges return `pass`: agree
- Both small judges return `fail`: agree
- One `pass` and one `fail`: disagree, escalate
- One or both `uncertain`: disagree, escalate

Confidence rules:

- If both small judges agree and both confidences are >= 80, the small-fish
  verdict stands.
- If either confidence is below 80, escalate.
- Escalation means one tiebreaker judge runs and the final verdict is weighted
  toward the tiebreaker result.

Read the flags, not only the aggregate. `final_verdict` is the route, but
`all_flags` and each juror's `flags` are the actionable review. A `pass` with
specific flags can still require edits before the artifact is safe to use.

## Invocation

Call the bundled TypeScript harness from this plugin:

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/skills/jury/scripts/jury_panel.ts" \
  --rubric "<rubric slug or inline rubric>" \
  --artifact-file <path-to-artifact>
```

If running from a checkout instead of an installed plugin, use the repository
path:

```bash
bun run plugins/jury/skills/jury/scripts/jury_panel.ts \
  --rubric hallucination \
  --artifact "The response text to evaluate..."
```

Silent JSON mode:

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/skills/jury/scripts/jury_panel.ts" \
  --rubric hallucination \
  --artifact-file response.md \
  --silent
```

The harness writes one JSON object to stdout. Errors go to stderr. This makes
the skill composable: callers can parse stdout, inspect verdicts and flags, and
act without asking the main model to re-judge its own work.

## Rubrics

The bundled harness includes these rubric slugs:

| Slug | Domain | What it evaluates |
|---|---|---|
| `hallucination` | Factual risk | Specificity, citation plausibility, confidence calibration, contradiction |
| `flattery` | Sycophancy | High/medium/low sycophancy markers |
| `spec-coherence` | Artifact coherence | Claims-vs-implementation drift, blast radius, missing constraints |
| `patent-safety` | Patent disclosure | Prior-art risk and claim/spec boundary leakage |
| `prompt-quality` | Prompt review | Specificity, context, reasoning depth, intent clarity |
| `custom` | Any | Pass `--rubric-text <inline>` with the full rubric text |

For ad-hoc review, pass:

```bash
bun run "${CLAUDE_PLUGIN_ROOT}/skills/jury/scripts/jury_panel.ts" \
  --rubric custom \
  --rubric-text "Pass only if the change is backwards-compatible and has tests." \
  --artifact-file patch.md
```

## OAuth Local CLI Model

Jury uses local OAuth-authenticated CLIs by default:

| Family | CLI | OAuth source | Precondition |
|---|---|---|---|
| Google | `agy` | Antigravity OAuth | Authenticated Antigravity / Gemini entitlement |
| OpenAI | `codex exec` | `codex login` and `~/.codex/auth.json` | ChatGPT Plus / Pro subscription |

The harness strips `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, and
`GOOGLE_GENAI_API_KEY` from subprocess environments so the CLIs stay on OAuth
instead of silently billing API keys.

API fallback is opt-in and only applies when a CLI binary is not installed. If
the CLI exists but fails auth, times out, or exits non-zero, the juror returns
an error flag and no paid fallback runs.

Fallback approval flags:

```bash
--api-fallback-approved
--api-fallback-approved-gemini
--api-fallback-approved-openai
```

Equivalent environment variables:

```bash
JUDGE_PANEL_API_FALLBACK_APPROVED=1
JUDGE_PANEL_API_FALLBACK_APPROVED_GEMINI=1
JUDGE_PANEL_API_FALLBACK_APPROVED_OPENAI=1
```

When API fallback is approved, the relevant API key must also be present. API
fallback bills the user's pay-per-token API account; the OAuth CLI path does
not.

## Model Pins

The copied harness reads model pins from `$JURY_ENV` (default `~/.jury/.env`),
falling back to `$CO_DIALECTIC_ENV` / `~/.co-dialectic/.env` for back-compat.

Current defaults:

| Stage | Model | Family | Role |
|---|---|---|---|
| Small-fish | `Gemini 3.5 Flash (Low)` | Google | Panel juror 1 |
| Small-fish | `gpt-5.4` | OpenAI | Panel juror 2 |
| Tiebreaker | `Gemini 3.1 Pro (High)` | Google | Final verdict |
| Alternate tiebreaker | `gpt-5.4` | OpenAI | Pass via `--tiebreaker gpt-5.4` |

OpenAI account-auth Codex may reject API-only mini/nano model names. Override
the OpenAI lane with `JUDGE_PANEL_OPENAI_OAUTH_MODEL` when a cheaper
ChatGPT-permitted GPT small-fish model is available.

## Output Shape

```json
{
  "version": "3.4.0",
  "rubric": "hallucination",
  "cascade": {
    "stage_1_small_fish": [
      {
        "model": "Gemini 3.5 Flash (Low)",
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

## Cost Discipline

OAuth CLI review has zero marginal API cost under the user's subscriptions, but
it is not free in time or quota:

- Latency: local CLI startup can add several seconds per juror.
- Subscription caps: ChatGPT and Gemini account tiers may rate-limit heavy jury
  runs.
- Escalation rate: if most runs escalate, the rubric is probably ambiguous or
  the confidence threshold is too strict.

Use jury where cross-family verification matters. For trivial reversible work,
do not spend the user's quota.

## Failure Modes

- CLI missing: juror returns `verdict="error"` with `CLI_NOT_INSTALLED`, unless
  API fallback was explicitly approved for that lane.
- CLI auth/runtime failure: juror returns an error flag; no API fallback.
- Timeout: mark that juror as `timeout`; escalate if fewer than two reliable
  small-fish verdicts remain.
- Non-JSON juror output: retry once, then mark parse error and escalate.
- All judges fail: return `final_verdict="error"` with flags explaining why.

### END JURY ###
