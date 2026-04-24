---
name: hallucination-detector
description: >
  Pre-flight risk-domain classification + post-flight hallucination scoring
  via the judge-panel cascade. Use when the user says "check for
  hallucinations", "hall on", "verify this response", "fact-check this",
  or an AI response makes specific factual / legal / medical / financial
  claims that must be trusted. Surfaces grounding suggestions before the
  response arrives and a 0-100 risk score after.
metadata:
  version: "3.2.0"
  author: "Anand Vallamsetla"
  tier: "core"
  plugin_number: 3
  depends_on: ["judge-panel"]
---

### BEGIN HALLUCINATION-DETECTOR ###
# Hallucination Detector

**Plugin #3, Core tier.** Phase-1 MVP from `BASE-PLUGINS-V3.md` § 5.
Constitution anchor: Ground Zero — Data Integrity; P13 (real-world
stakes); P0.5 (Boundary Self-Awareness — training-cutoff boundary).

## Why this exists

Every frontier LLM hallucinates. Same pattern-completion that produces
creative leaps also fabricates citations, dates, URLs, API methods, case
law. For HIGH-stakes domains (legal, medical, financial, factual), a
silent fabrication is worse than no answer. Detection has two halves:

1. **Pre-flight** — classify the *prompt* by risk domain before the
   response arrives. Inject a grounding suggestion ("cite sources", "say
   when uncertain") for HIGH-risk domains.
2. **Post-flight** — score the *response* for fabrication markers via
   the cascade (`judge-panel` plugin #4). Cross-family review is the only
   way to catch model-specific blind spots — a Claude response scored by
   Claude is a closed loop (P0.5).

## When to activate

**Explicit:**
- `cod hall on` / `cod hall off` — toggle persistent activation
- `cod hall check` — score the most recent response on demand
- `hallucination-detector <text>` — score arbitrary text
- `fact-check this` / `verify this claim`

**Automatic (when active):**
- Every prompt the user submits → pre-flight classification
- Every response from the primary model → post-flight scoring (delegated
  to `judge-panel`)

**Default:** OFF (costs tokens via judge-panel). First `cod hall on`
triggers a one-time confirmation that the user is OK paying the judge-panel
token cost (~$0.004/check at small-fish tier).

## Pre-flight: risk domain classification

Classify the prompt into one of these domains + risk tiers. Classification
is LLM-free — use pattern matching on the prompt text first, fall back to
the author model only if patterns don't fire.

| Domain | Risk | Trigger patterns (examples) | Grounding suggestion |
|---|---|---|---|
| Factual | HIGH | "what year", "how many", "who invented", dates, statistics | "If uncertain about any fact, say so. Cite sources where possible." |
| Legal | HIGH | "is this enforceable", "contract", "liable", "sue", "case law" | "Do not invent case law or precedent. State uncertainty. Recommend consulting a lawyer." |
| Medical | HIGH | "side effects", "diagnose", "symptom", "treatment", "drug interaction" | "Cite medical literature. Flag uncertainty. Recommend professional consultation." |
| Financial | HIGH | "invest", "stock", "should I buy", "market outcome", "ROI of" | "Factual analysis only. Do not simulate certainty about future market outcomes." |
| Code | MEDIUM | "write a function", "how do I call", "API for", library + version | "If the API may have changed recently, flag potential staleness." |
| Citation | HIGH | "cite", "what paper", "author of", "publication year" | "Only cite sources you can verify. Do not fabricate DOIs, URLs, or author names." |
| Creative | LOW | "write a poem", "story about", "imagine" | No injection — creative tasks have no factual ground truth. |
| Summarization | LOW | "summarize", "tl;dr of", "key points from" | No injection — the source material is the ground truth. |

**Observer semantics (codi-v3 discipline):** the detector does NOT modify
the prompt. It surfaces the grounding suggestion as a sidecar:

```
[Hallucination Detector: HIGH-risk domain (legal). Consider adding:
 "Do not invent case law. State uncertainty where it exists."
 Add? [y] yes · [n] skip · [e] edit]
```

In Cruise mode, the suggestion is appended as a silent tip (no prompt
mutation). In Drive mode, the user is paused for explicit choice.

## Post-flight: cascade scoring via judge-panel

After the primary model responds, pipe the response through
`judge-panel` with the `hallucination` rubric. Do not re-implement the
scoring rubric here — `judge-panel` owns it.

**Invocation:**

```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric hallucination \
  --artifact-file /tmp/last_response.txt \
  --silent
```

**Map judge-panel verdict → hallucination score + label:**

| judge-panel final_verdict | Score range | Status line label | User signal |
|---|---|---|---|
| `pass` + conf ≥ 80 | 0-20 | `✓ Hall` | Green — well-grounded |
| `pass` + conf < 80 OR `uncertain` | 21-50 | `~ Hall` | Amber — verify |
| `fail` (any conf) | 51-100 | `⚠ Hall` | Red — fabrication risk |
| `error` (all judges failed) | — | `? Hall` | Judge unavailable — fall back to self-review (weaker, disclose) |

Exact score = `100 - final_confidence` when `final_verdict == "pass"`;
`final_confidence` when `final_verdict == "fail"`; `50` when
`uncertain` or `error`.

## Output behavior

When active, prepend the compact flag to every response:

```
[Hall: ✓ · 12/100 · 2 judges agree]
```

or on escalation:

```
[Hall: ⚠ · 78/100 · escalated to GPT-5.4 · 3 flags]
```

Fields: label, numeric score, judges fired (counts small-fish + tiebreaker
if escalated), flag count.

**Expandable detail:** If the user says `cod hall why` or `cod hall
explain`, surface the full flag list from `judge-panel.all_flags` plus
the juror breakdown.

## Cost discipline

Post-flight scoring costs tokens every time it fires. Two levers:

1. **Small-fish-first cascade** (inherited from judge-panel): ~$0.004
   per check at the small tier. Escalation fires only ~10-30% of the
   time on a well-calibrated rubric.
2. **Session budget guard:** if total post-flight token cost exceeds
   `$JUDGE_PANEL_SESSION_BUDGET` (default $0.50/session), surface:
   *"Hall detector has used ~\$0.47 this session. Continue (y) / pause
   (n) / switch to pre-flight-only (p)?"*

## Interaction with other plugins

- **Depends on:** `judge-panel` (plugin #4) — the cascade executor
- **Provides input to:** `beacons-emitter` (plugin #5, future) — emits
  synthesized hallucination-rate-by-topic metrics (never raw text)
- **Does NOT interact with:** `calibration-auditor` — flattery and
  fabrication are orthogonal failure modes; running both in parallel is
  fine

## How to verify

**Trigger 1 (pre-flight):** Submit the prompt *"What year did the
Eiffel Tower open in Madrid?"*.

**Expected:** Detector classifies as HIGH-risk factual → surfaces
grounding suggestion before the response arrives.

**Trigger 2 (post-flight, pass):** The primary model responds *"The
Eiffel Tower opened in Paris in 1889."*.

**Expected:** judge-panel returns `pass` + high confidence → `[Hall: ✓
· ~10/100 · 2 judges agree]`.

**Trigger 3 (post-flight, fail):** Model responds *"The Eiffel Tower
opened in Madrid in 1923."*.

**Expected:** judge-panel returns `fail` + high confidence → `[Hall:
⚠ · ~85/100 · 2 judges agree · 2 flags]` with flags covering wrong-city
+ wrong-year.

**Trigger 4 (escalation):** Model emits a claim one small-fish judge
cannot resolve without literature search → `escalated: true`, tiebreaker
runs, final verdict reflects the bigger model's read.

**Failure modes:**
- Detector pattern-match fires wrong domain (false HIGH) → user quickly
  dismisses suggestion; track dismissal rate, tune patterns
- judge-panel unavailable (no gemini/codex CLIs on PATH) → fall back to
  `? Hall` label and disclose "external judges unavailable — falling
  back to self-review, weaker signal"

### END HALLUCINATION-DETECTOR ###
