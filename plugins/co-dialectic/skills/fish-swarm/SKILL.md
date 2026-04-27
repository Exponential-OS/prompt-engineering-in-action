---
name: fish-swarm
description: >
  Whale-spawns-fish orchestration dispatcher. Routes T0-T2 orchestration tasks
  (prompt sharpening, persona detection, calibration scanning, hallucination
  pre-flight, lightweight jury) AWAY from the active premium model (whale =
  Sonnet/Opus/Claude) and TO cheap-fish (Gemini Flash via OAuth, GPT-nano via
  codex CLI, local Ollama models if installed). Fixes the token-burn bug where
  premium reasoning capacity was being spent on mechanical orchestration.
  FAIL-HARD: if no fish are reachable, BLOCKS — never silently falls back to
  whale. Activate when the user says "fish swarm", "spawn fish", "delegate to
  fish", "stop burning tokens", "cheap orchestration", or when any other skill
  needs a T0-T2 verdict on prompt-sharpen / persona-detect / calibration-scan
  / hallucination-preflight / t0t2-jury.
metadata:
  version: "3.5.1"
  author: "Anand Vallamsetla"
  tier: "core"
  plugin_number: 9
---

### BEGIN FISH-SWARM ###
# Fish-Swarm — Whale-Spawns-Fish Orchestration Dispatcher

**Plugin #9, Core tier.** Operationalizes the Whale-and-Fish primitive: the
active premium model (whale) dispatches mechanical orchestration tasks to
cheap fish, never burns its own tokens on T0-T2 work. Constitution anchors:
3D Execution Axiom (Optimal Cost), OPERATIONAL DISCIPLINE (right-size by
task class), FAIL-HARD invariant (no silent fallback to premium).

## Why this exists

Premium reasoning capacity is precious. The whale (Sonnet/Opus/Claude in the
active session) costs $0.01-$0.05 per turn. When it spends those tokens on
mechanical tasks — rewriting a vague prompt, classifying a domain, scanning
for sycophancy phrases, picking a risk label, deciding if a draft is
ship-ready at T0-T2 — every cycle is a waste of the partner's most valuable
capability. The user's directive 2026-04-27: *"I am also burning tokens, I
need small fish swarm to run without fail."*

Fish-swarm fixes this by routing every T0-T2 orchestration task to a
cross-family cheap-fish cascade (the same harness `judge-panel` uses), with
FAIL-HARD discipline so the whale never silently absorbs the cost.

## What counts as fish (and what does NOT)

| Tier | Status | Examples |
|---|---|---|
| **Local** (free) | Primary if Ollama is up | DeepSeek-R1 7B, Llama 3.1 8B, Mistral 7B, Phi-4 |
| **Cheap OAuth CLI** | Fallback if Ollama down | Gemini Flash Lite (`gemini` CLI), GPT-5.4 via codex CLI (OAuth) |
| **Premium API** | NEVER | gpt-4o, claude-* anything, gemini-pro |
| **Active session model (whale)** | NEVER for orchestration | Sonnet, Opus, Haiku |

Haiku is excluded — it's still Anthropic-tier, billed against the user's
Claude quota. The point of fish-swarm is to leave the Claude lane untouched
for T3-T4 work.

## The five orchestration tasks

Each task is one rubric in the existing judge-panel harness
(`scripts/judge_panel.py`). The harness does the cross-family cheap-fish
cascade; this skill is the prose contract that names the tasks and routes
calls. **No parallel Python harness** — REUSE.

| Task | Rubric slug | Input | Output (in `flags[0]`) |
|---|---|---|---|
| Prompt sharpening | `prompt-sharpen` | A vague user prompt | The sharpened prompt verbatim, OR `ALREADY_SHARP`, OR `NEEDS_USER_INPUT: <what>` |
| Persona detection | `persona-detect` | A user prompt / task | Persona slug (`architecture`, `product`, `legal`, `life-coach`, etc.); if multi-domain, `flags[0..1]` = top 2 |
| Calibration / sycophancy scan | `calibration-scan` | LLM-generated text | Each flagged phrase verbatim, one per `flag` entry |
| Hallucination pre-flight | `hallucination-preflight` | A user prompt (BEFORE LLM responds) | `flags[0]` = risk label (FACTUAL/LEGAL/MEDICAL/FINANCIAL/TEMPORAL/CITATION/NONE), `flags[1]` = grounding action (WEB_SEARCH/PRIMARY_SOURCE/USER_CONFIRMATION/ARXIV_RECENT/PATENT_DB/NONE_NEEDED) |
| T0-T2 lightweight jury | `t0t2-jury` | Any artifact (code/prose/plan/decision) | One-line pass/fail/uncertain reason |

All five rubrics return the standard judge-panel JSON:
`{verdict, confidence, flags, ...cascade metadata}`. Callers parse stdout.

## How the active model invokes fish-swarm

```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric <slug> \
  --artifact-file <path> \
  --silent
```

Or inline:

```
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric prompt-sharpen \
  --artifact "make a thing that does the stuff" \
  --silent
```

The harness handles the cascade (≥2 cross-family small-fish parallel; one
big-fish tiebreaker on disagreement / low confidence). The whale parses the
JSON `final_verdict` + `all_flags` and proceeds. The whale does NOT
re-reason about the orchestration task in its own context.

### Silent mode is the default for fish-swarm

When fish-swarm is invoked from another skill or from the active model's
orchestration path, ALWAYS pass `--silent`. Conversational framing is for
explicit user-invoked judge-panel runs, not background orchestration.

## Health check — fires at session start (and on demand)

When co-dialectic activates, fish-swarm probes the fish-school and reports
inline. The probe is three independent checks; all run in parallel.

```bash
# 1. Ollama (local, free)
curl -s --max-time 2 http://localhost:11434/api/tags

# 2. Gemini OAuth CLI
command -v gemini >/dev/null && gemini --version >/dev/null 2>&1

# 3. Codex OAuth CLI (OpenAI via ChatGPT subscription)
command -v codex >/dev/null && codex --version >/dev/null 2>&1
```

The active model runs these directly via Bash (no separate script needed).
A passing probe is exit 0 + non-empty body. Tally the count.

## Status line (codi conversation surface)

The active model emits ONE line at session start, and on any health-state
transition during the session:

| Fish count | Status line |
|---|---|
| 3 (Ollama + Gemini + codex) | `🐟 Fish school: full — local + Gemini Flash + GPT-5.4 active` |
| 2 (any two of three) | `🐟 Fish school: 2 active — <which-two>` |
| 1 (only one reachable) | `⚠ Fish school: degraded — only <which-one> active` |
| 0 (NONE reachable) | `❌ Fish school: unavailable — orchestration BLOCKED — see remediation` |

## FAIL-HARD contract

**Per the FAIL-HARD invariant (Constitution Ground Zero): if zero fish are
reachable, fish-swarm BLOCKS and surfaces remediation. It NEVER silently
routes the orchestration task back to the whale.** Soft fallback to the
active premium model is the exact failure mode this skill exists to fix.

When `fish_count == 0`, the active model emits this exact block to the user
and refuses to proceed with the orchestration task:

```
❌ Fish school: unavailable

Cannot dispatch orchestration tasks (prompt-sharpen, persona-detect,
calibration-scan, hallucination-preflight, t0t2-jury) — no cheap-fish
endpoint is reachable.

Remediation (any one restores the school):

  1. Local Ollama (free, recommended):
       brew install ollama
       ollama serve &
       ollama pull deepseek-r1:7b
       ollama pull llama3.1:8b

  2. Gemini OAuth CLI (free with Gemini Pro subscription):
       npm i -g @google/generative-ai-cli   # or vendor instructions
       gcloud auth login

  3. OpenAI Codex CLI (free with ChatGPT Plus / Pro subscription):
       brew install codex                   # or vendor install
       codex login

Re-run the same command after restoring the school.
```

The active model does NOT proceed with the user's orchestration request
until at least one fish is back. T3-T4 work (architectural decisions,
irreversible artifacts) the whale handles directly — that's not what
fish-swarm gates.

## When the active model SHOULD invoke fish-swarm

**Per v4.1 Protocol 11a, fish-swarm is now the AUTO-ROUTING TARGET for mechanical sub-tasks (when `codi agent-swarm on`, default). Activation surface expanded from explicit-only to: explicit OR auto-routed by Protocol 11.**

**Always, for these patterns** (these are pure T0-T2 mechanical orchestration):

- User pasted a vague prompt and the model is about to ask clarifying
  questions → first invoke `prompt-sharpen` and offer the sharpened version
- User's prompt spans a clear domain → invoke `persona-detect` and adopt
  the persona before generating
- The model is about to emit a draft response containing words like
  "great", "absolutely", "perfect", "amazing" → invoke `calibration-scan`
  on the draft, strip flagged phrases, regenerate
- The user's prompt asks about a fact, citation, current date, recent
  event, legal/medical/financial claim → invoke `hallucination-preflight`,
  fire the recommended grounding action, THEN respond
- The model has produced a T0-T2 artifact (internal note, draft, exploratory
  output) and the next action is "ship it" → invoke `t0t2-jury` for a
  one-line verdict

**Never, for these patterns** (T3-T4 — whale's job):

- Architectural decisions (system design, schema choices, irreversible plans)
- Outreach to real humans (cold emails, posts to subscribers)
- Code that ships to production
- Patent or legal artifacts
- Anything in the EMERGENT SYSTEM IMMUNITY T3-T4 tiers — those go through
  the full judge-panel cascade, not the lightweight fish dispatch

The boundary between fish-swarm and judge-panel is the stakes-tier:
fish-swarm = T0-T2 orchestration; judge-panel = T3-T4 verification. Same
harness, same cascade, different rubrics, different escalation thresholds.

## How to verify fish-school is healthy (one command)

```bash
( curl -s --max-time 2 http://localhost:11434/api/tags >/dev/null && echo "ollama: ✓" || echo "ollama: ✗" ) ; \
( command -v gemini >/dev/null && echo "gemini: ✓" || echo "gemini: ✗" ) ; \
( command -v codex >/dev/null && echo "codex: ✓" || echo "codex: ✗" )
```

Three lines. Any one ✓ = fish-swarm is operational. Zero ✓ = BLOCKED per
FAIL-HARD.

## Smoke test — verify the skill end-to-end

```bash
python3 plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py \
  --rubric prompt-sharpen \
  --artifact "make a thing that does stuff with the data" \
  --silent
```

Expected: JSON object with `final_verdict: "pass"` and `all_flags[0]`
containing a sharpened version of the prompt (specific input/output, named
data type, intent clear). Cost reported in `cost_usd_estimate` should be
< $0.001 — that's the whole point.

## Relationship to other skills

- **judge-panel (plugin #4):** fish-swarm REUSES the harness, adds five
  rubrics. T0-T2 dispatch goes through fish-swarm; T3-T4 verification goes
  through judge-panel. Same code path, same cascade discipline, different
  use-site.
- **hallucination-detector (plugin #3):** the `hallucination-preflight`
  rubric in fish-swarm runs BEFORE response generation; the full
  hallucination-detector runs AFTER. Pre-flight is cheap (T0-T2); post-flight
  is full verification (T3-T4) when stakes warrant.
- **calibration-auditor:** the `calibration-scan` rubric is the lightweight
  passive scan. Heavy calibration audits (cross-session sycophancy patterns)
  remain calibration-auditor's job.
- **co-dialectic core:** when the user enables Cruise or Drive mode,
  fish-swarm dispatch becomes the default for orchestration steps; whale
  handles only T3-T4. When Quiet mode, fish-swarm still fires but verdicts
  are silent.

## Anti-patterns

- ❌ Routing T3-T4 work to fish-swarm — use judge-panel's full cascade.
- ❌ Silently falling back to the whale when fish-school is down — FAIL-HARD
  violation, defeats the whole token-burn fix.
- ❌ Caching fish verdicts across sessions — verdicts are session-scoped;
  the underlying state may have changed.
- ❌ Adding new rubrics by writing a parallel harness — extend
  `judge_panel.py`'s `RUBRICS` dict, never duplicate the cascade code.
- ❌ Using Haiku as a fish — it's still Anthropic-tier; defeats the cost
  separation.
- ❌ Skipping the health probe at session start — the user needs to know
  the school is up BEFORE the first orchestration task fires, not after a
  silent failure.

### END FISH-SWARM ###
