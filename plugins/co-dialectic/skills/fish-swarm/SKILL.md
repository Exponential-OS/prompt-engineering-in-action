---
name: codi-agents
description: >
  Whale-spawns-Codi-Agents orchestration dispatcher. Routes T0-T2 orchestration
  tasks (prompt sharpening, persona detection, calibration scanning, hallucination
  pre-flight, lightweight jury) AWAY from the active premium model (whale =
  Sonnet/Opus/Claude) and TO cheap Codi Agents (Gemini Flash via OAuth, GPT-5.4
  via codex CLI). Fixes the token-burn bug where premium reasoning capacity was
  being spent on mechanical orchestration. FAIL-HARD: if no Codi Agents are
  reachable, BLOCKS — never silently falls back to whale. Activate when the user
  says "codi agents", "spawn agents", "delegate to agents", "stop burning tokens",
  "cheap orchestration", or when any other skill needs a T0-T2 verdict on
  prompt-sharpen / persona-detect / calibration-scan / hallucination-preflight /
  t0t2-jury.
metadata:
  version: "4.12.0"
  author: "Anand Vallamsetla"
  tier: "core"
  plugin_number: 9
---
<!-- product-vs-solution: example -->


### BEGIN CODI-AGENTS ###
# Codi Agents — Whale-Spawns-Agents Orchestration Dispatcher

**Plugin #9, Core tier.** Operationalizes the Whale-and-Agents primitive: the
active premium model (whale) dispatches mechanical orchestration tasks to
cheap Codi Agents, never burns its own tokens on T0-T2 work. Constitution
anchors: 3D Execution Axiom (Optimal Cost), OPERATIONAL DISCIPLINE (right-size
by task class), FAIL-HARD invariant (no silent fallback to premium).

## Why this exists

Premium reasoning capacity is precious. The whale (Sonnet/Opus/Claude in the
active session) costs $0.01-$0.05 per turn. When it spends those tokens on
mechanical tasks — rewriting a vague prompt, classifying a domain, scanning
for sycophancy phrases, picking a risk label, deciding if a draft is
ship-ready at T0-T2 — every cycle is a waste of the partner's most valuable
capability. The user's directive 2026-04-27: *"I am also burning tokens, I
need small agent swarm to run without fail."*

Codi Agents fixes this by routing every T0-T2 orchestration task to a
cross-family cheap-agent cascade (the same harness `judge-panel` uses), with
FAIL-HARD discipline so the whale never silently absorbs the cost.

## What counts as a Codi Agent (and what does NOT)

| Tier | Status | Examples |
|---|---|---|
| **Local** (free) | Disabled — enable when local LLM installed | DeepSeek-R1 7B, Llama 3.1 8B, Mistral 7B, Phi-4 via Ollama |
| **Cheap OAuth CLI** | Primary | Gemini Flash Lite (`gemini` CLI), GPT-5.4 via codex CLI (OAuth) |
| **Premium API** | NEVER | gpt-4o, claude-* anything, gemini-pro |
| **Active session model (whale)** | NEVER for orchestration | Sonnet, Opus, Haiku |

Haiku is excluded — it's still Anthropic-tier, billed against the user's
Claude quota. The point of Codi Agents is to leave the Claude lane untouched
for T3-T4 work.

## The five orchestration tasks

Each task is one rubric in the existing judge-panel harness
(`scripts/judge_panel.ts`). The harness does the cross-family cheap-agent
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

## How the active model invokes Codi Agents

```
bun run plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.ts \
  --rubric <slug> \
  --artifact-file <path> \
  --silent
```

Or inline:

```
bun run plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.ts \
  --rubric prompt-sharpen \
  --artifact "make a thing that does the stuff" \
  --silent
```

The harness handles the cascade (≥2 cross-family small Codi Agents parallel;
one big-agent tiebreaker on disagreement / low confidence). The whale parses
the JSON `final_verdict` + `all_flags` and proceeds. The whale does NOT
re-reason about the orchestration task in its own context.

### Silent mode is the default for Codi Agents

When Codi Agents is invoked from another skill or from the active model's
orchestration path, ALWAYS pass `--silent`. Conversational framing is for
explicit user-invoked judge-panel runs, not background orchestration.

## Health check — fires at session start (and on demand)

When co-dialectic activates, Codi Agents probes the agent pool and reports
inline. The probe is two independent checks; all run in parallel.

```bash
# 1. Gemini OAuth CLI
command -v gemini >/dev/null && gemini --version >/dev/null 2>&1

# 2. Codex OAuth CLI (OpenAI via ChatGPT subscription)
command -v codex >/dev/null && codex --version >/dev/null 2>&1
```

The active model runs these directly via Bash (no separate script needed).
A passing probe is exit 0 + non-empty body. Tally the count.

Note: Local Ollama is excluded until a local LLM is installed. To re-enable,
add `curl -s --max-time 2 http://localhost:11434/api/tags` as check #3 and
restore the 3-agent status entries below.

## Status line (codi conversation surface)

The active model emits ONE line at session start, and on any health-state
transition during the session:

| Agent count | Status line |
|---|---|
| 2 (Gemini + codex) | `🤖 Codi Agents: full — Gemini Flash + GPT-5.4 active` |
| 1 (only one reachable) | `⚠ Codi Agents: degraded — only <which-one> active` |
| 0 (NONE reachable) | `❌ Codi Agents: unavailable — orchestration BLOCKED — see remediation` |

## FAIL-HARD contract

**Per the FAIL-HARD invariant (Constitution Ground Zero): if zero Codi Agents
are reachable, this dispatcher BLOCKS and surfaces remediation. It NEVER
silently routes the orchestration task back to the whale.** Soft fallback to
the active premium model is the exact failure mode this skill exists to fix.

When `agent_count == 0`, the active model emits this exact block to the user
and refuses to proceed with the orchestration task:

```
❌ Codi Agents: unavailable

Cannot dispatch orchestration tasks (prompt-sharpen, persona-detect,
calibration-scan, hallucination-preflight, t0t2-jury) — no cheap-agent
endpoint is reachable.

Remediation (any one restores the pool):

  1. Gemini OAuth CLI (free with Gemini Pro subscription):
       npm i -g @google/generative-ai-cli   # or vendor instructions
       gcloud auth login

  2. OpenAI Codex CLI (free with ChatGPT Plus / Pro subscription):
       brew install codex                   # or vendor install
       codex login

Re-run the same command after restoring the agent pool.
```

The active model does NOT proceed with the user's orchestration request
until at least one Codi Agent is back. T3-T4 work (architectural decisions,
irreversible artifacts) the whale handles directly — that's not what
Codi Agents gates.

## When the active model SHOULD invoke Codi Agents

**Per v4.1 Protocol 11a, Codi Agents is now the AUTO-ROUTING TARGET for
mechanical sub-tasks (when `codi agent-swarm on`, default). Activation surface
expanded from explicit-only to: explicit OR auto-routed by Protocol 11.**

**Dispatch mandate table — ALWAYS dispatch these patterns, NEVER absorb inline (Seam 3 fix — 2026-05-05):**

The whale absorbing these patterns inline is the #1 token-burn failure mode
(observed 2026-05-05: whale did 200-line Rumsfeld audits, gap analysis, prompt
sharpening all inline — zero Codi Agents dispatched). The mandate is structural:
if the task matches a row below, the whale MUST spawn an `Agent()` call with
the rubric, not inline-generate.

| Task pattern | Rubric | Spawn or inline? |
|---|---|---|
| User pasted vague prompt → whale about to ask clarifying questions | `prompt-sharpen` | **MUST spawn** — offer sharpened version from Codi Agent |
| User prompt spans clear domain | `persona-detect` | **MUST spawn** — adopt persona from agent verdict |
| Whale draft contains "great", "absolutely", "perfect", "amazing", "excellent" | `calibration-scan` | **MUST spawn** — strip flagged phrases, regenerate |
| User asks about a fact, citation, current date, recent event, legal/medical/financial claim | `hallucination-preflight` | **MUST spawn** — fire grounding action, THEN respond |
| T0-T2 artifact ready to ship | `t0t2-jury` | **MUST spawn** — one-line pass/fail before emitting |
| Audit/gap-analysis task ≤200 lines | `t0t2-jury` | **MUST spawn** — not an inline Rumsfeld audit |
| Pattern-match/scan across a document section | `t0t2-jury` | **MUST spawn** — mechanical scan, not whale reasoning |

**Whale-inline anti-pattern** (observed, from session 2026-05-05):
- ❌ Whale doing a 200-line Rumsfeld audit of content-flywheel.md inline — should have been `t0t2-jury` dispatch
- ❌ Whale doing gap analysis of social distribution engine inline — should have been `t0t2-jury` dispatch
- ❌ Whale absorbing prompt-sharpening turn without calling `prompt-sharpen` rubric
- ❌ Whale doing persona detection from topic keywords without calling `persona-detect`

**Litmus test before any inline analysis:** "Is this a pattern-match, scan, or mechanical judgment task? If yes — dispatch to Codi Agent, do NOT inline."

**Never, for these patterns** (T3-T4 — whale's job):

- Architectural decisions (system design, schema choices, irreversible plans)
- Outreach to real humans (cold emails, posts to subscribers)
- Code that ships to production
- Patent or legal artifacts
- Anything in the EMERGENT SYSTEM IMMUNITY T3-T4 tiers — those go through
  the full judge-panel cascade, not the lightweight Codi Agents dispatch

The boundary between Codi Agents and judge-panel is the stakes-tier:
Codi Agents = T0-T2 orchestration; judge-panel = T3-T4 verification. Same
harness, same cascade, different rubrics, different escalation thresholds.

## How to verify Codi Agents are healthy (one command)

```bash
( command -v gemini >/dev/null && echo "gemini: ✓" || echo "gemini: ✗" ) ; \
( command -v codex >/dev/null && echo "codex: ✓" || echo "codex: ✗" )
```

Two lines. Any one ✓ = Codi Agents operational. Zero ✓ = BLOCKED per
FAIL-HARD.

## Smoke test — verify the skill end-to-end

```bash
bun run plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.ts \
  --rubric prompt-sharpen \
  --artifact "make a thing that does stuff with the data" \
  --silent
```

Expected: JSON object with `final_verdict: "pass"` and `all_flags[0]`
containing a sharpened version of the prompt (specific input/output, named
data type, intent clear). Cost reported in `cost_usd_estimate` should be
< $0.001 — that's the whole point.

## Relationship to other skills

- **judge-panel (plugin #4):** Codi Agents REUSES the harness, adds five
  rubrics. T0-T2 dispatch goes through Codi Agents; T3-T4 verification goes
  through judge-panel. Same code path, same cascade discipline, different
  use-site.
- **hallucination-detector (plugin #3):** the `hallucination-preflight`
  rubric in Codi Agents runs BEFORE response generation; the full
  hallucination-detector runs AFTER. Pre-flight is cheap (T0-T2); post-flight
  is full verification (T3-T4) when stakes warrant.
- **calibration-auditor:** the `calibration-scan` rubric is the lightweight
  passive scan. Heavy calibration audits (cross-session sycophancy patterns)
  remain calibration-auditor's job.
- **co-dialectic core:** when the user enables Cruise or Drive mode,
  Codi Agents dispatch becomes the default for orchestration steps; whale
  handles only T3-T4. When Quiet mode, Codi Agents still fires but verdicts
  are silent.

## Anti-patterns

- ❌ Routing T3-T4 work to Codi Agents — use judge-panel's full cascade.
- ❌ Silently falling back to the whale when agent pool is down — FAIL-HARD
  violation, defeats the whole token-burn fix.
- ❌ Caching agent verdicts across sessions — verdicts are session-scoped;
  the underlying state may have changed.
- ❌ Adding new rubrics by writing a parallel harness — extend
  `judge_panel.ts`'s `RUBRICS` dict, never duplicate the cascade code.
- ❌ Using Haiku as a Codi Agent — it's still Anthropic-tier; defeats the
  cost separation.
- ❌ Skipping the health probe at session start — the user needs to know
  the agent pool is up BEFORE the first orchestration task fires, not after
  a silent failure.

### END CODI-AGENTS ###
