# Co-Dialectic Protocol — Phase 2 (Signal Phase)

**Status:** Phase 2 of the Anti-Bubble Architecture. Published 2026-04-24 with the v3.2.0 release.
**Audience:** agent authors, eval engineers, and anyone writing about how Co-Dialectic works as an implementation (not as a pitch).
**Version:** 3.2.0

---

## What "Phase 2" means

The VISION document lays out a four-phase evolution:

| Phase | What | Where it runs |
|---|---|---|
| 1. Skill | Single SKILL.md paste-in | Server-side (inside the LLM's context) |
| **2. Protocol (this doc)** | **Agent-agnostic spec — a portable standard** | **Any AI runtime that accepts system instructions + can shell out** |
| 3. Local application | Edge/local LLM runtime on the user's device | Client-side, zero vendor dependency |
| 4. Platform | humOS / xHumanOS quality-control layer | Edge + cloud hybrid |

Phase 2 is **a protocol-level spec**, not a product launch. It describes how the six composable skills shipped in v3.2.0 form a portable contract that any agent runtime — Claude Code, Cursor, Windsurf, Cline, Aider, custom LangChain / OpenAI Assistants / in-house agent — can implement. The moat is the protocol shape; the implementation is a reference implementation, not the exclusive surface.

**Why this matters for anyone writing about how we implemented it:** the cascade, the session-awareness, the cross-family independence, the confidence-routing — these are architectural primitives, not features. They are reproducible by anyone who honors the protocol. That is the signal phase: the architecture becomes the durable artifact, not the code.

---

## The six-skill surface

Each skill is a SKILL.md file with a stable frontmatter schema, a stable activation-trigger set, and (for `judge-panel`) a stable output JSON contract. An agent runtime "implements Co-Dialectic" by honoring the six surfaces below.

| # | Skill | Role | Portable contract |
|---|---|---|---|
| 1 | `co-dialectic` | Prompt sharpening + persona detection + status line + context health + auto-codification | `### BEGIN CO-DIALECTIC ###` marker block. YAML frontmatter with `version`, `author`. Status-line format `{icon} {domain} ({name}) · {X}% · Cal: {Y}%`. |
| 2 | `calibration-auditor` | Zero-flattery scanner (passive) | High/Medium/Low severity marker lists. Inline rewrite + compact audit flag. Does not block. |
| 3 | `hallucination-detector` | Pre-flight risk-domain classifier + post-flight score | 8 domain tiers (factual · legal · medical · financial · code · citation · creative · summarization). Compact flag `[Hall: {✓|~|⚠} · {N}/100 · {M} judges agree]`. Delegates post-flight scoring to `judge-panel`. |
| 4 | `judge-panel` | Cross-family cascade-then-jury | **Named rubric + artifact text IN; single JSON object OUT.** See JSON schema below. |
| 5 | `unknown-unknown` | Rumsfeld-Matrix adjacency surfacer | On request, enumerates 5–7 adjacency slots (brand / framework / ritual / hiring filter / marketing hook / IP / product feature / principle / persona / relationship). Surfaces only — never auto-writes. |
| 6 | `waky-waky` | Session-resurrection context loader | On trigger phrases (`waky waky`, `reincarnate`, `wake up the swarm`, `restore context`), loads Constitution + identity + handoff + per-WIP state. Honors scope boundaries. |

Any runtime that exposes these six surfaces — with their frontmatter + trigger sets + contracts — **is** Co-Dialectic-compliant. You do not need our code; you need our shape.

---

## The judge-panel JSON contract (canonical)

The cascade is the most-important portable surface because it composes across skills (hallucination-detector, calibration-auditor, and any future runtime guardrail can call it). Its input + output contract is fixed at v3.2.0.

### Input

```
python3 judge_panel.py \
  --rubric <slug>                \  # named rubric OR "custom"
  --rubric-text <text>           \  # required if --rubric custom
  --artifact <text>              \  # inline
  --artifact-file <path>         \  # OR file path (mutually exclusive with --artifact)
  --tiebreaker <model-id>        \  # default: OPENAI_BIG_JUDGE_MODEL from env
  --silent                          # strip raw_response for programmatic callers
```

### Named rubrics (v3.2.0)

| Slug | Evaluates |
|---|---|
| `hallucination` | Specificity, citation plausibility, confidence calibration, self-consistency, known fabrication patterns |
| `flattery` | Sycophancy / performative warmth markers |
| `spec-coherence` | Internal consistency, claims-vs-implementation drift, blast-radius gaps |
| `patent-safety` | §102 prior-art risk, claim/spec boundary leakage |
| `prompt-quality` | Specificity, context, reasoning depth, intent clarity |
| `custom` | Pass `--rubric-text` with full rubric text inline |

### Output — stable JSON contract

```json
{
  "version": "3.2.0",
  "rubric": "hallucination",
  "cascade": {
    "stage_1_small_fish": [
      {
        "model": "gemini-3.1-flash-lite-preview",
        "family": "google",
        "verdict": "pass | fail | uncertain | error | timeout",
        "confidence": 0-100,
        "flags": ["short reason 1", "short reason 2"],
        "tokens_in": int,
        "tokens_out": int,
        "latency_ms": int,
        "error": "string or null"
      },
      { "...juror 2..." }
    ],
    "agreement": "agree | disagree | insufficient",
    "confidence_tier": "high | low | n/a",
    "escalated": true | false,
    "stage_2_tiebreaker": { "...juror shape as above, or null..." }
  },
  "final_verdict": "pass | fail | uncertain | error",
  "final_confidence": 0-100,
  "all_flags": ["deduped union of juror flags"],
  "cost_usd_estimate": 0.0041,
  "cost_vs_naive_parallel_jury_ratio": 0.13
}
```

Two guarantees:
1. **Shape stability.** Fields at v3.2.0 remain at v4.0.0 as a superset. New fields may be added; existing fields will not be removed or renamed without a major version bump.
2. **One JSON object on stdout.** Errors go to stderr. No markdown fences, no prose. This makes the cascade a primitive that any skill, script, or runtime can invoke and parse without brittle regex.

### Cascade decision rules (canonical)

```
stage_1_small_fish = run (Gemini Flash, GPT-nano) in parallel

if both juror verdicts in {pass, fail} and identical:
    agreement = "agree"
    if all confidences >= CONFIDENCE_THRESHOLD (default 80):
        confidence_tier = "high"  → DO NOT escalate
    else:
        confidence_tier = "low"   → escalate
elif any juror verdict == "uncertain" or they disagree:
    agreement = "disagree"         → escalate
elif fewer than 2 jurors returned a valid verdict:
    agreement = "insufficient"     → escalate

if escalated:
    stage_2_tiebreaker = run (GPT-5.4 by default; any cross-family big-fish)
    final_verdict = tiebreaker.verdict (if pass/fail) else "uncertain"
else:
    final_verdict = small_fish[0].verdict
```

Any implementation that routes escalations by this logic is cascade-protocol compliant regardless of which specific models it uses. The **two structural requirements** are:

1. The two small-fish judges MUST be from distinct model families (different training distributions). Two Claude judges, or two GPT judges, do not count.
2. The tiebreaker MUST be cross-family with respect to both the author model AND at least one of the small-fish judges. Same-family tiebreaker collapses back into monoculture review.

Everything else (threshold tuning, rubric text, extra judges, confidence-scoring heuristics) is implementation-local.

---

## How the six skills compose

```
┌──────────────────────────────────────────────────────────┐
│                  USER ↔ primary AI session               │
└────────┬────────────────────────────────────────┬────────┘
         │                                        │
         ▼                                        ▼
  ┌────────────────────┐                 ┌─────────────────────┐
  │ waky-waky          │                 │ co-dialectic (core) │
  │ (on session start) │                 │ status line,        │
  │ loads Constitution │                 │ personas, sharpening │
  │ + identity + WIPs  │                 └──────────┬──────────┘
  └────────────────────┘                            │
                                                    ▼
                                      ┌────────────────────────────┐
                                      │ calibration-auditor         │
                                      │ (passive on every draft)    │
                                      └──────────┬─────────────────┘
                                                 │
                                                 ▼
                                      ┌────────────────────────────┐
                                      │ hallucination-detector      │
                                      │ pre-flight: risk domain     │
                                      │ post-flight: delegates to → │
                                      └──────────┬─────────────────┘
                                                 │
                                                 ▼
                                      ┌────────────────────────────┐
                                      │ judge-panel                 │
                                      │ cascade-then-jury           │
                                      │ cross-family by construction│
                                      └──────────┬─────────────────┘
                                                 │
                                                 ▼
                                          verdict JSON
                                          (used by caller)

             Running alongside, on request:
             ┌─────────────────────────┐
             │ unknown-unknown          │
             │ adjacency slots when user │
             │ says "cross-pollinate",   │
             │ "what am I missing", etc. │
             └─────────────────────────┘
```

Four composition properties fall out of this shape:

1. **Session-aware by default.** Because the skills run *inside* the primary session, they see the full conversation trace — prior turns, tool calls, corrections, claim trajectories — not just an `(input, output)` pair. A test-harness architecture cannot see this without ingesting conversation logs off-device.
2. **Cost-asymmetric.** The cheap small-fish pair runs on every significant output (~0.04¢). The expensive tiebreaker fires only on genuine disagreement (typically 10–30% of cases on a well-calibrated rubric). The cost of running Co-Dialectic on every artifact is strictly less than the cost of any rework caused by missing one.
3. **Cross-family by construction.** The cascade's two-small-fish + tiebreaker triple structurally spans three model families by default (Google + OpenAI + the author's family). Same-family consensus is architecturally impossible; the cascade cannot degrade into monoculture review without code changes.
4. **Independently composable.** Each skill has a standalone SKILL.md and its own activation triggers. A user can enable `calibration-auditor` + `judge-panel` without `waky-waky`, or vice versa. Turning a skill off does not affect the others.

---

## The portable contract (for anyone implementing the protocol in another runtime)

If you are building an agent runtime and want to be Co-Dialectic-compliant, implement these minimum surfaces:

1. **Accept SKILL.md files with YAML frontmatter.** The `name`, `description`, `metadata.version`, and `metadata.author` fields are stable. Trigger phrases live in the description.
2. **Honor the `### BEGIN CO-DIALECTIC ###` / `### END CO-DIALECTIC ###` markers.** These are the delimiter pattern that lets a co-dialectic block live safely inside a rules file that other systems also write to.
3. **Implement `judge_panel.py` or an equivalent.** Two cross-family judges in parallel; confidence-routed escalation to one cross-family tiebreaker; single-JSON-object stdout. The 250-line reference implementation is in `plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py` — stdlib-only Python; no pip dependencies.
4. **Emit synthesized beacons, not raw content.** (Spec in `BASE-PLUGINS-V3.md` plugin #5 — aspirational for v3.2.0, required for v4.0 compliance.) Raw prompts, raw responses, and raw conversation traces never leave the user's device. Synthesized metrics (learning curves, retry rates, hallucination rates by topic, judge-agreement rates) do.
5. **Preserve the status-line shape.** `{icon} {domain} ({name}) · {X}% · Cal: {Y}% | 🛡️ {JudgeMode} · {HallIndicator} · {DriveMode} · {Tone}`. Progressive disclosure — show only what's changed or is relevant.
6. **Follow the observer pattern.** Co-Dialectic *observes, suggests, scores*. It does not modify user input without consent. The SuperWhisper lesson: users reject tools that modify input silently. Every modification gets `y/n/e`.

Any runtime that exposes these six surfaces can claim "Co-Dialectic-compatible." The AGPL license preserves the moat: anyone can implement, no one can absorb-and-close.

---

## Reference implementation inventory (v3.2.0)

| Path | Role |
|---|---|
| `plugins/co-dialectic/skills/co-dialectic/SKILL.md` | Core skill (full, ~2500 tokens) |
| `plugins/co-dialectic/skills/co-dialectic/SKILL-lite.md` | Core skill (lite, ~1500 tokens — for free tiers) |
| `plugins/co-dialectic/skills/calibration-auditor/SKILL.md` | Flattery scanner |
| `plugins/co-dialectic/skills/hallucination-detector/SKILL.md` | Risk-domain classifier + post-flight scoring hook |
| `plugins/co-dialectic/skills/judge-panel/SKILL.md` | Cascade-then-jury protocol spec |
| `plugins/co-dialectic/skills/judge-panel/scripts/judge_panel.py` | Reference cascade implementation (stdlib Python) |
| `plugins/co-dialectic/skills/unknown-unknown/SKILL.md` | Rumsfeld-Matrix adjacency surfacer |
| `plugins/co-dialectic/skills/waky-waky/SKILL.md` | Session-resurrection loader |
| `plugins/co-dialectic/tests/corpus/*.json` | 8-case seeded-flaw corpus |
| `plugins/co-dialectic/tests/judge_panel_eval.py` | Eval harness — runs the cascade, reports agreement / escalation / F1 / cost |
| `plugins/co-dialectic/tests/RESULTS.md` | v3.2.0 eval results (100% accuracy on 8 cases, 7.5× cheaper than parallel Opus) |
| `.claude-plugin/marketplace.json` | Plugin marketplace registration — points Claude Code + Cowork at the plugin |
| `plugins/co-dialectic/.claude-plugin/plugin.json` | Plugin manifest — version, description, author |
| `install.sh` · `install.ps1` | One-line installers for non-plugin runtimes (Cursor, Windsurf, Antigravity, Cline, Aider, Roo) |

---

## What Phase 2 does NOT include (on purpose)

- **No proprietary eval dataset.** The 8-case seeded-flaw corpus is tiny by design — a pilot, not a paper. The 50-case controlled experiment is the forthcoming Defense-in-Depth Part 3 publication.
- **No telemetry beyond opt-in install metrics.** Beacons-emitter (plugin #5 in the BASE-PLUGINS-V3 spec) is scoped for v4.0. Until then, nothing leaves the device except the Scarf pixel on install (OS + tool choice, tied to the user's consent in the installer).
- **No single-vendor lock-in.** The judge-panel's model pins come from `~/cyborg/.env`. Change the two small-fish judges to any cross-family pair (Mistral + Llama, Gemini + Mistral, etc.); the cascade logic doesn't care.
- **No Chrome extension / local LLM yet.** Those are Phase 3 — client-side, edge-compute, zero-token-cost. Phase 2 leaves the hooks in place (judge-panel already runs stdlib Python with no cloud assumption beyond the two API calls); Phase 3 swaps the two API calls for local Ollama/llama.cpp invocations without changing the cascade logic.

---

## References (what this protocol stands on)

- Verga et al. 2024 — *Replacing Judges with Juries: Panel-of-LLM-evaluators* ([arXiv:2404.18796](https://arxiv.org/abs/2404.18796))
- Chen, Zaharia, Zou 2023 — *FrugalGPT* (cost-aware cheap→expensive cascade)
- Dekoninck et al., ICML 2025 — *Cascade Routing* (routing + cascading combined)
- Wataoka et al., 2024 — *Self-Preference Bias in LLM-as-Judge* ([arXiv:2410.21819](https://arxiv.org/abs/2410.21819))
- Li et al., 2025 / ICLR 2026 — *Preference Leakage in LLM-as-Judge* ([arXiv:2502.01534](https://arxiv.org/abs/2502.01534))
- Haldar & Hockenmaier, EMNLP 2025 — *Rating Roulette* — intra-rater variance
- Defense in Depth, Part 2 — *Jury Beats Judge* (Substack, 2026-04-23) — the thesis this protocol operationalizes
- Defense in Depth, Part 3 — *The Eval Harness Before the Numbers* (Substack, 2026-04-28 target) — controlled experiment using this protocol

---

*This document is the canonical Phase 2 spec. It is referenced by the main repo README, the plugin README, the `judge-panel` SKILL.md, the `hallucination-detector` SKILL.md, and by forthcoming articles about Co-Dialectic v3. Updates to the portable contract (§"The portable contract") require a major version bump.*
