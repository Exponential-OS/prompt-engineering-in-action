---
name: teachme
description: >
  Co-Dialectic's teaching surface. Activates on user invitation to explain
  the last sharpening, deep-dive on a technique, or surface a growth report.
  Closes the second half of the Co-Dialectic name's promise: the AI doesn't
  just sharpen your prompts — it teaches you to think dialectically, so you
  climb the language ladder over weeks and eventually carry dialectical
  reasoning into every human conversation you have (family, team, community).
triggers:
  - teachme
  - teach me
  - codi teach
  - explain that sharpening
  - explain the sharpening
  - why is dialectic better
  - why dialectic
  - teachme growth
  - codi growth
  - show my growth
  - how am I doing
  - language ladder
  - my progression
metadata:
  version: "1.0.0"
  author: "Anand Vallamsetla"
  plugin_number: 14
  tier: "language-ladder"
---

<!-- product-vs-solution: example -->

### BEGIN TEACHME ###

# Teachme — The Language Ladder

The user-invited teaching surface that closes the second half of Co-Dialectic's name. Protocol 3 SHOWS the three tiers (improved → Socratic → dialectic) on every turn; this skill EXPLAINS them on request and tracks the user's progression over time.

## When to activate

Triggers (any one) — see frontmatter. Most common entry points:

- `teachme` — bare command, explain the last sharpening
- `teachme growth` — pull up the growth report
- `teach me <technique>` — deep-dive on a named technique
- `why dialectic` — explain when dialectic is worth the 3x cost

## Origin

Co-Dialectic is named for **Plato's dialectic** — the two-sided thesis-antithesis-synthesis form Plato (428-348 BCE) extended from his teacher Socrates' one-sided questioning method. The plugin's promise is not just to sharpen prompts in the moment, but to TEACH the user the techniques so they:

1. Internalize prompt-engineering patterns and apply them without the AI's help
2. Climb from improved → Socratic → full dialectic over weeks
3. Eventually carry dialectical reasoning into every human conversation (family, team, community)

This skill is the explicit teaching loop. Without it, Co-Dialectic delivers only the first half of its name (Socratic prompt-rewrites). With it, the plugin lives up to the Platonic dialectic the name promises.

## Four behaviors

### 1. Explain-last (`teachme` with no args)

Explain the most recent Protocol 3 sharpening turn.

**Output format:**

```
━━━ Co-Dialectic · Teachme ━━━

Last sharpening:
  "{original prompt}"
  → IMPROVED (technique: {label})

What changed:
  {1-paragraph explanation of WHY this technique works}

Two places you can apply this elsewhere:
  1. {generalization with one concrete example}
  2. {generalization with one concrete example}

Want to see the full ladder? Type "teach me socratic" or "teach me dialectic".
```

**Implementation**: read the last entry from `~/.codialectic/growth.jsonl`. Pull `technique_applied` and `tier` fields. Load the corresponding `techniques/<slug>.md` deep-dive file for the explanatory text.

### 2. Deep-dive on a technique (`teach me <technique>`)

Structured ~3-paragraph explanation with examples. Available technique names map to files in `techniques/`:

- `specificity-injection` — adding concrete constraints
- `role-priming` — "you are X" framing
- `audience-priming` — declaring who the output is for
- `constraint-injection` — length/tone/format constraints
- `chain-of-thought` — "think through" / "show reasoning"
- `few-shot-by-example` — exemplar Q&A pairs
- `flipped-interaction` — command → eliciting question
- `socratic-questioning` — the full Socratic method
- `dialectic-tas` — thesis-antithesis-synthesis (Plato's dialectic)
- `meta-shortcut` — recognizing recurring patterns

**Output format:**

```
━━━ Co-Dialectic · Teachme · {Technique} ━━━

What it is:
  {one-paragraph definition with historical/conceptual anchor}

Why it works:
  {one-paragraph mechanism — what cognitive lever this pulls}

When to use:
  - {concrete situation 1}
  - {concrete situation 2}
  - {concrete situation 3}

When NOT to use:
  - {anti-pattern 1}
  - {anti-pattern 2}

Two examples:
  1. {canonical example}
  2. {example from user's session history, if available}

Practice prompt:
  "{a prompt the user can try right now to internalize this}"
```

Each technique file at `techniques/<slug>.md` follows this template.

### 3. Growth report (`teachme growth`)

Surface the user's progression by reading `~/.codialectic/growth.jsonl`.

**Output format:**

```
━━━ Co-Dialectic · Teachme · Your Growth ━━━

Sessions:        {N} since you started ({first_session_date} → today)
Sharpening turns: {N total}
Average lift:    {orig_avg}% → {final_avg}% (+{delta})

Techniques you've adopted (chose 5+ times):
  ✓ specificity-injection  ({N} times)
  ✓ chain-of-thought       ({N} times)

Techniques you've tried but not adopted:
  ◯ dialectic-tas (tried {N}x, picked {M}x — try `teach me dialectic`)

Techniques you haven't tried:
  - few-shot-by-example
  - flipped-interaction

Recurring weak pattern:
  • You skip audience-specification on {N}% of prompts.
    → Try `teach me audience-priming`.

Trend over last 7 days: {sparkline or +X% / -X%}

Recommended next move:
  {one-sentence concrete suggestion based on the data}
```

### 4. Proactive micro-lesson (auto-fires on recurring weak pattern)

When the user's last 3 turns all scored below 60% on the same technique-class gap, surface a single line at the top of the response (not blocking, dismissable):

```
💡 Three sessions running you've skipped {pattern}. Try `teachme {technique}` (60-sec read). Dismiss: `not now`.
```

User responses:
- Accept (`teachme {technique}`): load the deep-dive
- Defer (`not now`): mute for this session
- Mute forever (`mute teachme`): record in growth.jsonl and stop surfacing

## Telemetry — xOS-hydration-compatible

Every Protocol 3 turn appends one line to `~/.codialectic/growth.jsonl`. The schema is **self-describing per line** so a future xOS consumer can ingest the file without needing co-dialectic source code (per the SHARED-STATE HYDRATION INVARIANT).

**Per-line schema** (see `~/.codialectic/growth.schema.json` for the JSON Schema):

```json
{
  "schema_version": "1.0.0",
  "schema_url": "https://github.com/Exponential-OS/co-dialectic/raw/main/plugins/co-dialectic/skills/teachme/growth.schema.json",
  "event_type": "sharpening_turn",
  "ts": "2026-05-17T12:00:00Z",
  "session_id": "{8-char hash}",
  "persona": "architecture",
  "stakes_tier": "T2",
  "prompt_hash": "{sha256 first 16 chars}",
  "prompt_length_chars": 142,
  "original_score": 65,
  "tiers": {
    "improved":  { "score": 78, "technique": "specificity-injection", "cost_usd": 0.0008 },
    "socratic":  { "score": 85, "technique": "questioning-elicitation", "cost_usd": 0.0008 },
    "dialectic": { "score": 92, "technique": "thesis-antithesis-synthesis", "cost_usd": 0.0024 }
  },
  "user_picked": "socratic",
  "tier_used_cost_usd": 0.0008,
  "calibration_score": 92,
  "dismissed_micro_lessons": []
}
```

Privacy: `prompt_hash` is sha256(prompt)[:16] — **prompt content is never stored**. Only the hash for deduplication and the metadata for growth tracking.

**xOS hydration contract**: when xOS activates and ingests `~/.codialectic/growth.jsonl`, it can:

1. Parse each line as JSON (every line is self-contained)
2. Resolve `schema_url` to fetch the schema definition (or fall back to embedded `schema_version`)
3. Aggregate by `session_id`, `persona`, `technique` to populate xOS dashboards
4. Cross-reference with other co-intelligence telemetry without needing co-dialectic source

`growth.jsonl` is append-only and lives at `~/.codialectic/growth.jsonl`. Rotate at 100MB to `growth-YYYY-MM.jsonl.gz`.

## Storage

| File | Owner | Purpose |
|---|---|---|
| `~/.codialectic/growth.jsonl` | Protocol 3 (writer) + teachme (reader) | Per-turn telemetry. xOS-hydration-compatible. |
| `~/.codialectic/growth.schema.json` | Plugin install hook | Schema definition. Sidecar so a future consumer can validate without co-dialectic source. |
| `~/.codialectic/teachme-state.json` | teachme skill | Dismissed micro-lessons, mute flags. |
| `${CLAUDE_PLUGIN_ROOT}/skills/teachme/techniques/*.md` | Plugin (read-only) | Per-technique deep-dive content. |

## What this skill does NOT do

- Never writes the user's prompt content (privacy)
- Never modifies the original Protocol 3 sharpening output (read-only on past turns)
- Never re-invokes the LLM to re-sharpen a past turn — only explains what was already produced
- Never reaches out over the network — all data is local

### END TEACHME ###
