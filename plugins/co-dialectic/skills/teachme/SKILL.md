---
name: teachme
description: >
  Co-Dialectic's teaching surface. Activates on user invitation to explain
  the last sharpening, deep-dive on a prompt technique, teach the highest-yield
  tool-usage lesson from the user's own logs, or surface a growth report.
  Closes the second half of the Co-Dialectic name's promise: the AI doesn't
  just sharpen your prompts — it teaches you to think dialectically and use
  the installed environment at higher leverage, so you climb the language
  ladder over weeks and compound the tool landscape instead of falling behind it.
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
  - learning time
  - teach me today
metadata:
  version: "1.0.0"
  author: "Anand Vallamsetla"
  plugin_number: 14
  tier: "language-ladder"
---

<!-- product-vs-solution: example -->

### BEGIN TEACHME ###

# Teachme — The Language Ladder + Co-Education Flywheel

The user-invited teaching surface that closes the second half of Co-Dialectic's name. Protocol 3 SHOWS the three tiers (improved → Socratic → dialectic) on every turn; this skill EXPLAINS them on request and tracks the user's progression over time. It also teaches the single highest-yield tool-usage lesson proven by the user's own local logs.

## When to activate

Triggers (any one) — see frontmatter. Most common entry points:

- `teachme` — bare command, explain the last sharpening
- `teachme growth` — pull up the growth report
- `teach me <technique>` — deep-dive on a named technique
- `why dialectic` — explain when dialectic is worth the 3x cost
- `learning time` / `teach me today` — teach today's highest-yield tool-usage lesson from local logs

Session-end trigger and deferred weekly digest instruction:

- `codi-handoff` appends `📚 Today's 1%: <headline> — say 'learning time' for the 60-sec version.`
- Sunday `/schedule` digest instruction is defined for future cron wiring: report the top-3 inefficiencies, adoption scorecard, and two-strikes escalations. No cron infrastructure lives in this skill.

## Origin

Co-Dialectic is named for **Plato's dialectic** — the two-sided thesis-antithesis-synthesis form Plato (428-348 BCE) extended from his teacher Socrates' one-sided questioning method. The plugin's promise is not just to sharpen prompts in the moment, but to TEACH the user the techniques so they:

1. Internalize prompt-engineering patterns and apply them without the AI's help
2. Climb from improved → Socratic → full dialectic over weeks
3. Eventually carry dialectical reasoning into every human conversation (family, team, community)

This skill is the explicit teaching loop. Without it, Co-Dialectic delivers only the first half of its name (Socratic prompt-rewrites). With it, the plugin lives up to the Platonic dialectic the name promises.

## Lesson domains

Teachme owns two lesson domains:

1. **Prompt techniques** — existing language-ladder lessons: explain the last sharpening, deep-dive on a named technique, growth report, and recurring weak-pattern micro-lessons.
2. **Tool usage** — new co-education lessons: audit the user's own local session evidence, find where an installed capability would have created more leverage, teach one 60-second lesson, then track adoption.

Do not create a separate skill for tool usage. It is the same learning loop: evidence → rank → teach → practice → adoption tracking.

## Five behaviors

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

### 5. Co-Education tool lesson (`learning time` / `teach me today`)

Teach the highest-yield tool-usage lesson from the user's own local logs. This is the inward-facing counterpart to `/forage`: `/forage` discovers new tools; this mode detects underuse of tools already installed.

**Cost posture:** run the AUDIT and RANK steps at fish/cheap-tier or inline T1 mechanical reasoning. Only the final TEACH synthesis is whale-worthy, and only for one lesson.

**Inputs (all local, privacy-preserving):**

- `brain/sessions/ledger/<today>.md` for both sides of the session ledger when present (v0.68.0+). If `$CO_DIALECTIC_SESSION_LEDGER_DIR` is configured, read that first; otherwise use the workspace `brain/sessions/ledger/` path; if unavailable, degrade to conversation context + git history.
- Git history for the session: commits, changed files, repeated fix/retry patterns, and unfinished work visible from `git log` / `git status`.
- Installed-tool inventory already available in the environment: Claude Code natives (`Workflow`, agent teams, `/schedule`, `/dream`), loaded skill inventory, `claude plugin list`, MCP list, agent/preset configs, fish/presets, YOLO/containment presets, and skill-version-banner traces.
- Existing agent-side warning streams as signals only: `flywheel-capture` (`UserPromptSubmit`), `fish-dispatch` Stop audit, and `codify-or-mark-uncodified` (`PreToolUse`). Route their signals into this RANK→one-lesson pipeline; do not rebuild their hooks here.

**AUDIT — detect the five human-side inefficiency classes:**

| Class | Detect from logs |
|---|---|
| `manual-where-tool-exists` | User or agent manually orchestrated work that an installed workflow/skill/native tool already handles. |
| `base-use-of-power-tool` | A power tool was used at its least-leveraged mode, e.g. interactive/manual path where batch, headless, agent-team, or preset mode existed. |
| `repeated-friction` | Same failed open, same lookup, same question, same approval, or same remedial step repeats within or across sessions. |
| `installed-never-invoked` | Installed capability appears in inventory but not in session traces despite matching the work pattern. |
| `approval-grind` | Long runs of approval clicks or permission prompts where an allowlist, preset, contained worktree, or YOLO mode would have been appropriate. |

**BIDIRECTIONAL — same audit, two students:**

The same audit also detects one cyborg-side lesson candidate:

- Agent re-derived a known fact.
- Agent violated a codified lesson.
- Agent burned whale tokens on T0-T2 mechanical work.
- Agent asked the human something logs/config/git could answer.
- Same agent failure class appeared twice.

Rank cyborg-side candidates with the same yield rule. Emit exactly ONE codified cyborg-side fix per session: memory entry, hookify rule, `CLAUDE.md` line, or Constitution stub. Auto-apply when local and reversible; propose when not. Do not auto-apply the human's config changes — the human lesson changes configs only via the practice prompt with the user's hands on it.

Litmus: did BOTH partners leave this session one codified lesson better?

**RANK:**

Compute `yield = time_burned × recurrence`. Pick the SINGLE highest-yield human-side tool lesson. A list is homework; one lesson is the gift. If no cited evidence exists, say no tool-usage lesson is available yet and do not invent one.

**TEACH format:**

```
━━━ Co-Dialectic · Teachme · Today's 1% ━━━

What happened:
  {one concrete observation from the user's own cited local log: file/line, git commit, hook signal, or inventory trace; no raw prompt content}

The tool that existed:
  {installed tool/capability} — {why it matched this intent}

60-sec how:
  {short operating pattern the user can remember next time}

Practice prompt:
  "{one prompt the user can type right now to use the tool themselves}"

Adoption tracking:
  Recorded as `tool_lesson` in `~/.codialectic/growth.jsonl`.
  If this same lesson needs two teaches without adoption, escalate to a hookify-candidate nudge at point of use.

Cyborg-side fix:
  {one codified fix applied or proposed from the same audit}
```

**TRACK:**

Append a `tool_lesson` event to `~/.codialectic/growth.jsonl` using `skills/teachme/growth.schema.json`. Required fields for this event: cited log evidence, `inefficiency_class`, `tool`, `yield_estimate`, `taught_at`, `adopted` (`true` / `false` / `null`), and `teach_count`.

Adoption check on the next audit:

- Adopted → mark `adopted: true`; stop surfacing this lesson.
- Not adopted after first teach → increment `teach_count`; one more teach allowed.
- Not adopted after two teaches → emit `hookify-candidate` for a point-of-use nudge.

**Weekly digest instruction:**

When cron infrastructure is built, the Sunday `/schedule` digest reads the same `tool_lesson` records and reports: top-3 inefficiencies, adoption scorecard, and two-strikes escalations. This skill only defines the instruction; v1 does not build cron infrastructure.

## Telemetry — xOS-hydration-compatible

Every Protocol 3 turn appends one line to `~/.codialectic/growth.jsonl`; every tool-usage lesson appends a `tool_lesson` line. The schema is **self-describing per line** so a future xOS consumer can ingest the file without needing co-dialectic source code (per the SHARED-STATE HYDRATION INVARIANT).

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
  "prompt_hash": "{full sha256 (64 hex chars, one-way)}",
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

Privacy: `prompt_hash` is sha256(prompt) — **prompt content is never stored**. Only the hash for deduplication and the metadata for growth tracking.

**Tool lesson record shape** (no prompt content; cited evidence is by local source reference + hash/signal):

```json
{
  "schema_version": "1.0.0",
  "schema_url": "https://github.com/Exponential-OS/co-dialectic/raw/main/plugins/co-dialectic/skills/teachme/growth.schema.json",
  "event_type": "tool_lesson",
  "ts": "2026-06-09T22:35:00Z",
  "session_id": "{8-char hash}",
  "cited_log_evidence": [
    {
      "source_type": "ledger",
      "source_ref": "brain/sessions/ledger/2026-06-09.md:42",
      "signal": "manual review agents spawned while Workflow was installed",
      "evidence_hash": "{sha256 of cited local snippet}"
    }
  ],
  "inefficiency_class": "manual-where-tool-exists",
  "tool": "Workflow",
  "yield_estimate": {
    "time_burned_minutes": 20,
    "recurrence_count": 3,
    "score": 60
  },
  "taught_at": "2026-06-09T22:35:00Z",
  "adopted": null,
  "teach_count": 1
}
```

**xOS hydration contract**: when xOS activates and ingests `~/.codialectic/growth.jsonl`, it can:

1. Parse each line as JSON (every line is self-contained)
2. Resolve `schema_url` to fetch the schema definition (or fall back to embedded `schema_version`)
3. Aggregate by `session_id`, `persona`, `technique` to populate xOS dashboards
4. Cross-reference with other co-intelligence telemetry without needing co-dialectic source

`growth.jsonl` is append-only and lives at `~/.codialectic/growth.jsonl`. Rotate at 100MB to `growth-YYYY-MM.jsonl.gz`.

## Storage

| File | Owner | Purpose |
|---|---|---|
| `~/.codialectic/growth.jsonl` | Protocol 3 (writer) + teachme (reader) | Per-turn telemetry and `tool_lesson` adoption records. xOS-hydration-compatible. |
| `~/.codialectic/growth.schema.json` | Plugin install hook | Schema definition. Sidecar so a future consumer can validate without co-dialectic source. |
| `~/.codialectic/teachme-state.json` | teachme skill | Dismissed micro-lessons, mute flags. |
| `${CLAUDE_PLUGIN_ROOT}/skills/teachme/techniques/*.md` | Plugin (read-only) | Per-technique deep-dive content. |

## What this skill does NOT do

- Never writes the user's prompt content (privacy)
- Never modifies the original Protocol 3 sharpening output (read-only on past turns)
- Never re-invokes the LLM to re-sharpen a past turn — only explains what was already produced
- Never reaches out over the network — all data is local
- Never auto-applies the human's tool/config changes — it teaches via a practice prompt

## v1.1 (not yet built)

- Weekly `/schedule` digest cron.
- Cross-machine aggregation (laptop + Mac-mini, post hardware-split).

### END TEACHME ###
