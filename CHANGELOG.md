# Changelog

All notable changes to this repository are tracked here. This project follows [Semantic Versioning](https://semver.org/).

---

## [4.1.0] — 2026-04-27

**Codename:** Five-protocol release — Auto-Verify · Auto-Handoff · Honesty Selector · Agent-Swarm · Hygiene.

### Added — five new protocols (build → judge → revise → re-judge cycle)

- **Protocol 8 — Auto-Verify by Stakes** (`co-dialectic/SKILL.md` + `hallucination-detector/SKILL.md` + `judge-panel/SKILL.md` + `unknown-unknown/SKILL.md`). T0-T4 stakes-tier classifier (LLM-inferred, not regex) with auto-fire cascade: T2 = passive hallucination scan, T3 = cross-family judge-panel (Gemini Flash Lite + GPT-5.4 via fish-swarm; FAIL-HARD if no fish reachable), T4 = full cascade + canonical-claim verifier (dispatches to `career-os.outreach-fact-check` for biographical claims) + unknown-unknown adjacency surfacer + **explicit human "send"/"ship it"/"verified" confirmation REQUIRED before emit**. Plain-English status surface — user never sees raw tier labels. Default: ON every fresh session. Toggle: `codi verify on/off/status/why`. Advanced opt-out for T4: `codi t4-auto on` (session-scoped, RED warning). Closes the biographical-outreach near-miss class via auto-T4 on any career-claim artifact.

- **Protocol 9 — Auto-Handoff on Closure Detection** (`co-dialectic/SKILL.md` + `handoff/SKILL.md`). Auto-fires on session-closing words ("bye", "see you", "thank you", "handoff", "close session" — and natural-language equivalents). Writes a canonical session-end beacon at `~/.codialectic/hooks/session_end.json` (single multi-protocol JSON; per-protocol top-level keys: `"hygiene": {...}`, `"handoff": {...}`). Schema v1.0 — uuid-v4 session_id, model nested, honesty enum (`brutal`/`grounded`/`soft`).

- **Protocol 10 — Honesty Selector** (`co-dialectic/SKILL.md` + `calibration-auditor/SKILL.md`). Three postures: `honesty grounded` (default, session start), `honesty brutal` (maximum challenge, no softening), `honesty soft` (momentum-first, minor concerns held). Status-line indicator appended for non-default postures (`🔪 honesty:brutal`, `🤝 honesty:soft`). T3+ auto-downgrade: when `honesty soft` is active and the output is a high-stakes artifact, silently upgrades to grounded for that single response. Backwards-compat alias policy for one minor version: `tone:brutal` / `tone:soft` / `tone:grounded` accepted and remapped.

- **Protocol 11 — Agent-Swarm Default-On** (`co-dialectic/SKILL.md` + `fish-swarm/SKILL.md`). Replaces "fish swarm" terminology with "agent swarm" at the user surface. Auto-on at session start; user can disable with `codi swarm off` if too many parallel outputs are annoying. Sub-agent outputs skip Verify (Protocol 8); parent runs Verify ONCE on the synthesized top-level output at the seam where it meets the user/world (T4 fires at the seam, not inside sub-agents).

- **Protocol 12 — Hygiene Cycle** (`co-dialectic/SKILL.md` + `hygiene/SKILL.md`). Per-conversation immune cycle: **sweep + codify + reorg + merge + pull**. Operationalizes Constitution EMERGENT SYSTEM IMMUNITY invariant per unit-of-work. Closes the conversation by ensuring lessons land in `~/cyborg/*`, file sprawl is checked, brain-writes are merged + pushed, and the next conversation starts on fresh brain. Minimal 5-field schema in the session_end.json beacon; multi-protocol context note in example.

### Changed

- **Welcome banner version** bumped `v3.5.1` → `v4.1.0` across all SKILL.md files.
- **`hallucination-detector` / `judge-panel` / `unknown-unknown` skills** integrated as Protocol 8 dispatch targets (toggle controls applied at the protocol layer, not per-skill).
- **`calibration-auditor/SKILL.md`** (`3.1.0` → `3.1.1`): T3+ auto-downgrade interaction codified; LOW threshold tightened on brutal posture.
- **Plugin version** bumped: `4.0.0` → `4.1.0`.

### Discipline

All five protocols shipped through the build → judge → revise → re-judge cycle:
- P8: APPROVE 87/100 · P9: APPROVE 91/100 · P10: APPROVE 91/100 · P11: APPROVE 84/100 · P12: APPROVE 91/100.
- Post-merge: P10 had a v3.5.1 banner remnant (line 38 SKILL.md) — fixed in `e612afb`.
- Spec contradictions on Protocol 11 sub-agent verification reconciled in `cef3aa0` (pre-merge spec cleanup).

---

## [3.3.0] — 2026-04-24

**Codename:** Anti-drift. Command rename + swarm reasoning primitive.

### Added

- **Protocol 6 — Internal Swarm Escalation (AI-to-AI / AI-to-Self)** added to the core Co-Dialectic skill. Three rules: (1) self-correction via internal dialectic before touching Ground Zero invariants, (2) swarm escalation to Human Cyborg on stalemate instead of silent failure, (3) misunderstanding-as-growth (Platonic dialectic applied — extract generative value from API failures, peer surprises, user rejections). Merged from the Antigravity thread's swarm-reasoning spec (`WIP/career-os-product/feature-specs/co-dialectic-v3-mem0-integration-SPEC.md`). Forward-compatible: runs today via in-context recall; binds to Mem0 / Neo4j when the Docker swarm architecture is deployed.
- **Spec-first ownership contract.** `WIP/prompt-engineering-in-action-product/co-dialectic/01_SPECS/v3.3.0-SPEC.md` (private) defines: only the Co-Dialectic thread edits canonical SKILL.md files. Other threads propose via specs. Target-location skill files are auto-generated artifacts.

### Changed

- **Command prefix renamed `cod` → `codi`** across all six SKILL.md files. Four-letter prefix, phonetically unambiguous. Description still accepts `cod` as a trigger keyword for backward-compatibility; user-facing commands use `codi`. Brand name stays Co-Dialectic (the plugin registered as `co-dialectic` in the marketplace; unchanged).
- Plugin version: `3.2.1` → `3.3.0` (user-facing command surface changed).

### Infrastructure — anti-drift (workspace-level)

This ships on the **workspace** side (`anand-career-os`), not in the plugin repo:

- **`ci/skill-compiler.sh` NEW** — reads `workspace.manifest.yaml`, iterates `(skill, agent)` pairs, runs per-agent transformer, writes target with auto-generated banner + canonical-SHA stamp. Same pattern as `ci/mcp-compiler.sh`. Two transformers today: `claude-code` (identity copy) + `antigravity` (identity copy). Stubs for cursor / gemini-cli / codex / cowork / windsurf / cline / aider / roo warn pending v3.4.0 without silently failing.
- **`workspace.manifest.yaml` updated** — `antigravity` added to `distribute_to` enum for the co-dialectic skill. Ownership note inlined: only Co-Dialectic thread edits canonical.
- **Banner discipline** — generated target files carry `<!-- AUTO-GENERATED from <canonical> @<sha>. DO NOT EDIT. Edits overwritten on next sync. Propose changes via spec in WIP/... or edit canonical if you own it. -->`. Banner placed AFTER YAML frontmatter (not before — Claude Code's frontmatter parse requires `---` on line 1).
- **Drift problem resolved**: as of v3.3.0 compile, canonical content at `~/aiprojects/prompt-engineering-in-action/plugins/co-dialectic/skills/co-dialectic/SKILL.md` is mirrored to both `~/.claude/skills/co-dialectic/SKILL.md` (Claude Code) and `~/.gemini/antigravity/skills/co-dialectic/SKILL.md` (Antigravity) on every sync. Local edits at target locations die on next compile; banner warns.

### Deferred to v3.3.1 (docs-only, no skill behavior change)

- Main README "Try Now" install-prompt rewrite (two-path CDN URL + inline fallback + user-consent ask)
- "For Agents" CDN section restructured as per-runtime branch tree
- `docs/PROTOCOL.md` addendum documenting Protocol 6 + Mem0/Neo4j-on-Docker reference
- Chrome-extension teaser in web-AI path

Shipping docs separately so v3.3.0 lands today with the anti-drift infrastructure + command rename + Protocol 6 merge — user's stated top-priority value.

---

## [3.2.1] — 2026-04-24

**Docs + install fixes on top of v3.2.0.** Backwards compatible. No skill-level behavior changes.

### Fixed

- `install.sh`: the curl-one-line installer previously copied only the core `co-dialectic/SKILL.md` into directory-based tools (Claude Code, Antigravity). Users who did NOT go through the plugin marketplace were silently missing 5 of 6 skills (calibration-auditor, hallucination-detector, judge-panel, unknown-unknown, waky-waky). Rewrote install/uninstall flow around a shared `PLUGIN_SKILLS` inventory — all 6 skills now install together; judge-panel's `scripts/judge_panel.py` downloads and chmod+x's automatically.
- `install.sh` `--bg-check`: the background update checker greps `**Version:**` in SKILL.md, but v3+ SKILL files use YAML frontmatter (`version: "X.Y.Z"`). The check silently never fired. Now parses frontmatter first, legacy format as fallback.
- Main README: stale "Co-Dialectic v2.2.0" in the "Version and Update Nudges" section (3 minor versions behind) corrected to v3.2.0.
- Plugin README: license mis-stated as MIT (repo is AGPL-3.0), corrected. Files table expanded to list all 6 skills + the eval harness. "Architecture (v2.2+)" section rewritten for v3.
- Main README "Try Now" section: previously led with the gift-prompt path only — Claude Code users reading top-down ran `install.sh` instead of `/plugin install co-dialectic@thewhyman` and got the partial install described above. Now distinguishes three install paths by environment (Claude Code plugin / one-line curl / web-AI gift-prompt).

### Added

- `docs/PROTOCOL.md` — Phase 2 (Signal Phase) portable-contract spec. Canonical JSON shape for `judge-panel` output, the six-skill composition diagram, the minimum surfaces any agent runtime needs to expose to claim "Co-Dialectic-compatible." Published so the architecture — not just the code — becomes the durable artifact.

---

## [3.2.0] — 2026-04-24

**Codename:** Jury Beats Judge. Defense-in-Depth Part 2 thesis shipped as a runnable skill.

### Added — 2 base plugins (Scope D)

- **Plugin #4 — Judge Panel** (Core tier). Cross-family cascade-then-jury review. Two cheap cross-family small-fish judges (Gemini Flash + GPT-nano) run in parallel; if they agree with high confidence, the verdict stands. If they disagree or confidence is low, escalates to one expensive cross-family tiebreaker (default GPT-5.4). Returns JSON verdict + confidence + flags + juror breakdown + cost. Stdlib Python only (`urllib`) — no SDK dependency. Triggers: `judge-panel`, `jury beats judge`, `cross-family review`, `review with a panel`. Ships with reproducible eval harness (`tests/judge_panel_eval.py`) and 8-case seeded-flaw corpus. Constitution anchor: Ground Zero — Independent Verification Gate + Model-Diversity sub-mandate; P0.5 (Boundary Self-Awareness); P22 (Boundary-First Qualification).
- **Plugin #3 — Hallucination Detector** (Core tier). Pre-flight risk-domain classification (factual / legal / medical / financial / code / citation / creative / summarization) + post-flight hallucination scoring that delegates to `judge-panel`. Surfaces grounding suggestions before HIGH-risk prompts ship; maps the cascade verdict onto a 0-100 hallucination risk score with `✓/~/⚠ Hall` status-line label. Constitution anchor: Ground Zero — Data Integrity; P13 (real-world stakes); P0.5 (Boundary Self-Awareness — training-cutoff boundary).

### Eval results (empirical receipts)

`tests/RESULTS.md`, 8-case seeded-flaw corpus, real cross-family API calls:
- Accuracy: **100% (8/8)** · F1 (fail class): **1.000** (P=1.000, R=1.000)
- Panel agreement rate: 75% · escalation rate: 25%
- Total eval cost: **$0.00295** · ~0.037¢ per check · **7.5× cheaper** than a naive parallel Opus jury

### Changed

- Plugin manifest version: `3.1.0` → `3.2.0` (`plugins/co-dialectic/.claude-plugin/plugin.json`) + marketplace manifest.
- `install.sh`: `VERSION="3.0.0"` → `VERSION="3.2.0"`; background update-check now parses the YAML-frontmatter `version:` field (v3+ format) with legacy-`**Version:**` fallback.
- Plugin README (`plugins/co-dialectic/README.md`): lists all 6 skills; license corrected MIT → AGPL-3.0.
- Main README: `Try Now` section now distinguishes three install paths (Claude Code `/plugin install`, one-line curl, gift-prompt for web-AI); `What's New in v3.2.0` callout; `Version and Update Nudges` v2.2.0 → v3.2.0.

### Public artifacts

- Release tag: `v3.2.0` on `origin/main`
- Public repo: `github.com/thewhyman/prompt-engineering-in-action`
- Accompanying article: Defense in Depth, Part 2 — "Jury Beats Judge" (shipped 2026-04-23 on Substack)

---

## [3.1.0] — 2026-04-19

**Codename:** Observer. First release of the Co-Dialectic **wire protocol** base plugins.

v3.1 re-frames Co-Dialectic from a single SKILL into the open wire protocol for human-AI interaction — the HTTP of AI. Conversations flow through a pluggable middleware chain of observers. See the xOS architecture taxonomy (`xOS-product/ARCHITECTURE-TAXONOMY.md`) for the full layer stack: Constitution → Co-Dialectic wire → AgencyOS specialist library → xOS audience-scoped products.

This release ships the first three Soul + Continuity tier base plugins on top of the existing prompt-sharpening core.

### Added — 3 base plugins (Scope C)

- **Plugin #12 — Waky Waky** (Continuity tier). Session-reincarnation ritual. Triggers: `waky waky`, `reincarnate`, `wake up the swarm`, `restore context`. Loads Constitution, identity, root handoff, per-WIP handoffs, and conversation-relevant people/company files in a single invocation. Confirms with a compact status block — never auto-summarizes context. Honors scope boundaries (P12). Constitution anchor: Session Handoff Protocol; P15.
- **Plugin #8 — Calibration Auditor** (Soul tier). Passive observer that enforces the Zero-Flattery Ground-Zero invariant. Scans draft responses for HIGH-severity sycophancy ("Great question", "You're absolutely right", "Most productive session"), MEDIUM-severity filler ("Happy to help", "Of course"), and LOW-severity overuse ("Totally", "For sure"). Strips flattery inline, surfaces a compact audit flag, preserves substance. Interacts with `cod tone` settings. Constitution anchor: Ground Zero — Zero Flattery.
- **Plugin #7 — Unknown Unknown** (Soul tier). Rumsfeld Matrix agent. Triggers: `unknown unknowns`, `cross-pollinate`, `N-dimensional extraction`, `what am I missing`. Scans MEMORY indices, `workspace.manifest.yaml`, active WIPs, and conversation context to enumerate 5-7 named adjacency slots (brand, framework, ritual trigger, hiring filter, marketing hook, product feature, IP, Constitution principle, persona, relationship). Surfaces — never auto-writes. Constitution anchor: Meta-Learning; Epistemic Foraging; Co-Education Flywheel.

Each plugin ships as a single SKILL.md under `plugins/co-dialectic/skills/<plugin-name>/` with an embedded "How to verify" section — concrete trigger commands and expected outputs for post-merge verification.

### Changed

- Plugin manifest version: `3.0.0` → `3.1.0` (`plugins/co-dialectic/.claude-plugin/plugin.json`).
- Marketplace manifest version: `3.0.0` → `3.1.0` (`.claude-plugin/marketplace.json`).

### Roadmap context

v3.1 Scope C ships the 3 plugins above. Plugins #1 (Prompt Improver), #2 (Persona Detector), and #6 (Status Line Renderer) already exist in the core `co-dialectic` SKILL. Plugins #3 (Hallucination Detector), #4 (Judge Selector), #5 (Beacons Emitter) are spec'd in `codi-v3.1-spec.md` and ship as their implementations stabilize. See `BASE-PLUGINS-V3.md` for the full 17-plugin roadmap across 5 tiers (Core 6 · Soul 5 · Continuity 3 · Kinetic 2 · Privacy 1).

---

## [3.0.0] — 2026-04-14

Tagged release of Co-Dialectic v3 foundation — prompt-sharpening core with persona system, context health monitoring, gamification, tone selector, and SKILL.md thin-core / README CDN architecture. This was the last release before the wire-protocol re-framing.

---

## Older

Pre-3.0 history lives in git tags and commit log. `git log --oneline --tags` for the timeline.
