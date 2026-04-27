# Co-Dialectic — Architecture Decisions

> Read this BEFORE editing any co-dialectic skill, script, or doc.
> This is the PRD-equivalent for agents working on co-dialectic.

---

## Audience

Every agent — Claude / Gemini / Codex / Cursor / future-runtime / OSS contributor — touching co-dialectic source. If you are about to edit a `SKILL.md`, a script under `skills/*/scripts/`, a test, or any doc in this plugin: read the three decisions below first. They are not suggestions. They are the architectural contract that keeps co-dialectic shippable as a standalone open-source product while letting thewhyman compose premium tiers on top.

---

## Decisions

### Decision 1 — Constitution Principles ARE Applied (Universal How-We-Build)

The Cyborg's Constitution describes HOW thewhyman builds reliable software. Co-dialectic, even when shipped as standalone open-source AGPL-3.0 product, MUST follow these principles in its own internals. The principles are universal patterns — fail-hard semantics, mechanical enforcement, cross-family verification — that apply regardless of whether the consumer is the thewhyman Cyborg or a fresh OSS install on someone else's laptop.

**The principles co-dialectic implements internally:**

| Principle | What co-dialectic owes |
|---|---|
| **FAIL-HARD INVARIANT** | Every gate, hook, validator exits non-zero on detected violation. No soft warnings. No log-and-continue. No silent skip. Tests assert hard. Migrations walk OR fail. |
| **VARIANCE-IS-EVIL** | Code over prose. Mechanical enforcement over agent-recall. Standardize at every surface so Claude / Gemini / Codex / Cursor produce the same verdict shape. |
| **OBJECTIVE-CODIFICATION** | Every rule co-dialectic ships ships with its enforcement primitive (script, hook, test, gate). A SKILL.md that says "agents should X" without a script that fires X is half-shipped. |
| **EMERGENT SYSTEM IMMUNITY (T0-T4 cascade)** | Verification depth scales with stakes. T3+ artifacts get cross-family review. `judge-panel` is the canonical surface; `hallucination-detector` is the pre/post-flight gate. |
| **PRIOR-ART-FRESHNESS** | Novelty claims in co-dialectic docs verified against live arxiv / web search, not training recall. Anything claimed "no prior system does this" requires citation freshness ≤30 days. |
| **TEMPORAL GROUNDING** | Time-referential output anchored to OS-fetched current time. No "today is" claims from training cutoff. |
| **Independent Verification Gate + Model-Diversity** | Judge-panel cascade fires on T4 artifacts. Cross-family review is structural, not optional. Same-family consensus is a shared blind spot, not a verdict. |
| **SHIP-FAST CADENCE** | Small commits, fast pushes, no batched mega-merges. Each skill ships independently when ready. No "wait for the v4 release train" batching. |

These are HOW-WE-BUILD principles. They apply regardless of whether co-dialectic is the open-source kernel or the premium plug-ins. A fail-hard hook is fail-hard whether the consumer is xHumanOS or an indie dev on a fresh Claude Code.

**Litmus test:** "Does this co-dialectic edit follow the Constitution's HOW-WE-BUILD principles?" If the edit adds a soft-warning gate, swallows an exit code, ships a rule without enforcement, or skips cross-family review on a T3+ artifact — it violates Decision 1. Refactor.

---

### Decision 2 — Cyborg Substrate is NOT Imported (Decoupling)

Co-dialectic ships standalone. A user installs co-dialectic via `/plugin install co-dialectic@thewhyman` (or future open-source marketplace) on a fresh Claude Code with NO `~/cyborg/`, NO `~/anand-career-os/`, NO `WIP/`, NO brain layer, NO GitHub Issues at thewhyman, and NO thewhyman-specific path. Co-dialectic must work end-to-end in that environment.

The principles from Decision 1 are universal. The thewhyman *substrate* that implements them on Anand's machine is not. Co-dialectic source must never reach into that substrate.

**Forbidden in co-dialectic source / SKILL.md / scripts:**

- ❌ Hardcoded paths: `~/cyborg/`, `~/anand-career-os/`, `WIP/`, `brain/`, `INPUT/`
- ❌ References to Cyborg-specific rule directories: `bash ~/cyborg/rules/fail-hard/HOW.sh` invocations from inside a co-dialectic skill
- ❌ References to Cyborg-specific Constitution: `bash ~/cyborg/CONSTITUTION.md` reads, `cat ~/cyborg/CONSTITUTION.md` greps
- ❌ References to thewhyman-specific data: `experience-history.md`, `handles.md`, `content-distribution-flywheel.md`, `identity.md`
- ❌ Workspace-specific task substrates: `gh issue create --repo thewhyman/anand-career-os` from co-dialectic kernel skill
- ❌ Implicit assumptions that brain layer files exist (e.g., reading from `~/cyborg/people/` to compose a persona)

**Allowed:**

- ✅ Constitution PRINCIPLES applied in co-dialectic's own design (fail-hard, variance-is-evil, OBJECTIVE-CODIFICATION, etc. — these are universal patterns, not substrate references)
- ✅ Hooks / slot-based extension points the workspace registers callbacks against
- ✅ Env-var indirection: `${CO_DIALECTIC_HOOK_DIR}` reads from `~/.codialectic/hooks/` with safe defaults; workspace overrides the env var to point at its own hooks
- ✅ Optional integrations: `if command -v gh; then ... else graceful_skip; fi`
- ✅ Workspace-supplied callbacks: co-dialectic exposes `on-session-start`, `on-session-end`, `on-codification`; the workspace registers what to do; co-dialectic doesn't know what GitHub Issues even is

**The decoupling architecture principle (per user directive 2026-04-27):**
*"Codi shouldn't know where the tasks are coming from and where the tasks should be added. The career skill should bring it from git and add to git. This is the decoupling arch principle."*

Co-dialectic is the kernel. The workspace is the substrate. Tasks, brain layer, GitHub Issues, the Constitution.md file — those all live in the workspace. Co-dialectic invokes registered callbacks; it does not name the substrate.

**Currently identified violation:**

`waky-waky` skill hardcodes `bash ~/cyborg/rules/fail-hard/HOW.sh` invocation. This is a P1 bug tracked at `anand-career-os#27`. Must extract via hook-callback pattern before next open-source release. The fix shape: co-dialectic's `waky-waky` calls `${CO_DIALECTIC_PRE_FLIGHT_HOOK:-noop}`; the thewhyman workspace registers the hook to point at `~/cyborg/rules/fail-hard/HOW.sh`; a fresh OSS install gets the noop default and works.

**Litmus test:** "If a fresh OSS user installed co-dialectic on a clean machine with no thewhyman files, would this skill work?" If YES → ship. If NO → refactor to hook-callback or env-var indirection.

---

### Decision 3 — Spring/Red-Hat Composition Pattern (Premium = Plug-Ins)

Co-dialectic ships as a pure independent open-source product. Premium features compose on top via the open-source extension surfaces — same pattern Red Hat uses with RHEL on top of upstream Linux, same pattern Spring uses with Spring framework as the core and commercial extensions as plug-ins.

**Open-source tier (free, AGPL-3.0):**

- `judge-panel` — cross-family cascade-then-jury review
- `hallucination-detector` — pre/post-flight risk classification
- `calibration-auditor` — Zero-Flattery passive scanner
- `co-dialectic` (core) — protocols (Drive/Cruise/Quiet/Tone toggles), persona system, prompt sharpening, status line
- `waky-waky` — context-restoration ritual with workspace hook callbacks (post-decoupling fix per Decision 2)
- `unknown-unknown` — Rumsfeld-Matrix surveillance
- `judge_panel.py` — Python harness (stdlib only); OAuth CLI default; API fallback gated to CLI-not-installed

**Premium / paid plug-in tier (the Red Hat parallel):**

- Domain-specific plug-ins shipped as separate paid products
- Domain-specific premium personas
- Pre-built workspace integrations (substrate adapters that bridge to a workspace's task store, knowledge layer, etc.)
- Advanced rule-enforcement scaffolding (mechanical gates beyond the open-source defaults)
- Pro features (cross-family ensembles beyond cascade defaults, custom rubrics, fine-tuned judges)

**Composition mechanism — what the open-source kernel exposes:**

| Surface | Purpose |
|---|---|
| Skill-activation triggers | Premium skills can hook the same trigger phrases via the standard SKILL.md activation grammar |
| Verdict JSON shapes | `judge-panel` and `hallucination-detector` emit stable JSON; premium consumers parse and extend |
| Session-start / session-end hooks | Workspace registers callbacks at standard lifecycle points |
| Persona system + tone selector | Premium plug-ins register additional personas without forking the core |
| Rubric registry | `judge-panel` accepts external rubric files; premium ships domain-specific rubrics |

**Premium plug-ins extend by:**

- Registering session-start hooks (e.g., environment availability checks, pre-flight discipline)
- Registering session-end hooks (e.g., per-conversation hygiene cycle: sweep, codify, persist)
- Adding domain-specific personas
- Adding domain-specific rubrics for `judge-panel`
- Bringing the workspace's substrate (task store, knowledge layer) — co-dialectic doesn't know about it

**Test discipline:** for every co-dialectic ship, run a clean-install test on a workspace with no workspace-specific files. End-to-end works. Premium features just won't activate (graceful absence). The test is mechanical (per Decision 1 OBJECTIVE-CODIFICATION) — it lives in `tests/clean-install/` and runs in CI.

**Litmus test:** "Could a third-party (not thewhyman) ship a premium plug-in that composes with co-dialectic, without forking co-dialectic source?" If YES → the composition surface is healthy. If NO → the kernel is leaking substrate; refactor a surface into the open-source kernel.

---

### Decision 4 — Operational Modes

Co-dialectic supports two operational modes, runtime-toggleable, within a single codebase:

| Mode | When | What's active |
|---|---|---|
| **Human-AI mode (default)** | Human user in a chat / IDE / interface | Full UX: status line, persona detection, prompt sharpening (Drive/Cruise toggle), tone selector, calibration audit |
| **AI-AI mode** | Sub-agent / multi-agent / orchestration flow | Lean: message routing + verification only; UX surfaces (status line, tone selector) suppressed |

In multi-agent flows, codi instances at different nodes can run in different modes — orchestrator at the user edge in human-AI mode, workers in AI-AI mode for agent-to-agent legs.

**Currently shipping surface (v3.5.0):** the marketplace plug-in for IDE / CLI runtimes (Claude Code, Cursor, Cowork, and any LLM runtime that consumes Claude Code-shape skill manifests). The web surface is already supported today via copy-paste: a user on any web AI chat app can paste the `co-dialectic` SKILL.md content as a system prompt and the codi behaviors operate inside the conversation that follows. The SKILL.md format IS the cross-LLM portability mechanism.

**Litmus tests:**

1. *"In a multi-agent flow, can codi instances run in different modes simultaneously?"* → must be YES.
2. *"Can a power user paste the SKILL.md content as a system prompt on a web AI chat surface and get codi behavior?"* → must be YES (the web path that exists today, no extension needed).

---

## Litmus Tests (Quick Reference)

Three tests, applied in order, to every co-dialectic edit:

1. **Decision 1 — Principles applied?** "Does this co-dialectic edit follow the Constitution's HOW-WE-BUILD principles (fail-hard, variance-is-evil, OBJECTIVE-CODIFICATION, EMERGENT IMMUNITY, etc.)?" If YES → keep going.
2. **Decision 2 — Substrate not imported?** "Does this co-dialectic edit reach into Cyborg substrate (`~/cyborg/`, `~/anand-career-os/`, etc.)?" If YES → STOP. Refactor to hook-callback or env-var indirection.
3. **Decision 3 — Clean install works?** "If a fresh OSS user installed co-dialectic on a clean machine with no thewhyman files, would this skill work?" If YES → ship. If NO → refactor.

A change that passes all three is shippable. A change that fails any one is not.

---

## Anti-Patterns (Co-located)

- ❌ Soft-warning gate that logs and continues — violates Decision 1 (FAIL-HARD).
- ❌ SKILL.md that says "agents should run X" without a script that mechanically fires X — violates Decision 1 (OBJECTIVE-CODIFICATION); rule is half-shipped.
- ❌ T4 artifact published without cross-family review — violates Decision 1 (EMERGENT IMMUNITY + Model-Diversity).
- ❌ `bash ~/cyborg/...` or `cat ~/anand-career-os/...` inside a co-dialectic SKILL.md or script — violates Decision 2.
- ❌ Reading `experience-history.md`, `handles.md`, or any thewhyman-specific brain artifact from co-dialectic kernel — violates Decision 2.
- ❌ `gh issue create --repo thewhyman/anand-career-os` from co-dialectic kernel — violates Decision 2 (substrate-specific task creation).
- ❌ Premium feature smuggled into the open-source tier without a corresponding extension surface — violates Decision 3 (kernel bloat; OSS users pay for unused weight, premium consumers can't customize).
- ❌ Hard-fork required to add a domain persona — violates Decision 3; persona registration must be a plug-in surface, not a core edit.
- ❌ Skipping the clean-install test before a release — violates Decision 3 (test discipline); the next OSS user is the QA channel.

---

## Future Considerations

Beyond v3.5.0, evolution is driven by user demand signal, not internal speculation. New surface areas (e.g. browser extensions, IDE-specific extensions, mobile share extensions, messaging bridges) are evaluated when beta-tester signal justifies the engineering cost. No architectural commitments beyond what's described in Decisions 1–4 above. To request or vote on a direction, open an issue at `thewhyman/anand-career-os`.

---

## Origin

Codified 2026-04-27 per user directive:

> *"Constitution dictates that we ship all products with fail hard and etc. Codi should implement those, but should remain independent. Codify this in codi PRD/spec or arch decisions so that every agent working on it knows."*

Plus prior context:

> *"Codi shouldn't know where the tasks are coming from and where the tasks should be added. The career skill should bring it from git and add to git. This is the decoupling arch principle."*

> *"We will ship codi as a pure independent open-source product with premium version with our features like Red Hat does. xOS plugs into it like Spring."*

Captured in workspace memory at `~/.claude/projects/-Users-anandvallam-anand-career-os/memory/feedback_decoupling_kernel_workspace_separation.md`. Pairs with `anand-career-os#27` (waky-waky decoupling P1 bug fix) and `anand-career-os#28` (Plugin Decoupling Architecture invariant — Constitution codification).

---

## Related

- `~/cyborg/CONSTITUTION.md` — universal how-we-build principles applied (Decision 1)
- `WIP/prompt-engineering-in-action-product/co-dialectic/01_SPECS/codi-v3.1-spec.md` — feature spec
- `anand-career-os#27` — `waky-waky` decoupling fix (current Decision-2 violation tracked)
- `anand-career-os#28` — Constitution Plugin Decoupling Architecture invariant
- `anand-career-os#29` — Open-source vs premium tier product strategy
- `tests/clean-install/` — mechanical test that enforces Decision 3
