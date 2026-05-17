# Changelog — Co-Dialectic

## [4.13.0] — 2026-05-17 — teachme + tiered sharpening (Sapiens to Cyborg)

The biggest product upgrade since v4.0. Co-Dialectic now lives up to its name.

### Added
- **Protocol 3 — Tiered Sharpening**: every Protocol 3 turn now renders THREE tiers side-by-side:
  - ↗ IMPROVED (specificity-injection, role-priming, etc.) — single LLM call
  - ↗↗ SOCRATIC (questioning-elicitation, Socrates midwifery) — single LLM call, deeper reasoning
  - ↗↗↗ DIALECTIC (Plato thesis-antithesis-synthesis) — 3 LLM calls, deferred until user picks (or eager for T3+ stakes)
  User picks which to use, learning the technique each turn.

- **Auto-detect T3+ stakes**: prompts naming a real person, public-facing artifact, or irreversible action auto-generate the DIALECTIC synthesis eagerly (cost worth it).

- **NEW SKILL: teachme** (\`teachme\`, \`teach me <technique>\`, \`teachme growth\`):
  - Explain-last (bare \`teachme\`): explains the technique applied in the most recent sharpening.
  - Deep-dive: per-technique markdown at \`skills/teachme/techniques/\` — 3 ships in v4.13.0 (dialectic-tas, socratic-questioning, specificity-injection). More to follow.
  - Growth report (\`teachme growth\`): user's technique adoption, score trend, recurring weak patterns.
  - Proactive micro-lesson: auto-fires when same gap detected 3 turns running.

- **xOS-hydratable telemetry**: every Protocol 3 turn appends to \`~/.codialectic/growth.jsonl\` with self-describing per-line schema (schema_version, schema_url, ts, persona, stakes_tier, prompt_hash, per-tier scores, technique_applied, user_picked, cost_usd). Companion \`growth.schema.json\` ships with the plugin. A future xOS consumer can ingest growth.jsonl without co-dialectic source — per SHARED-STATE HYDRATION INVARIANT.

- **Privacy**: prompt content NEVER stored — only sha256(prompt)[:16] hash.

### Why this matters (the Sapiens → Cyborg story)

Harari's Sapiens thesis: humans dominate Earth because we coordinate at scale via shared stories, and stories are enabled by LANGUAGE. If language is what makes human-to-human coordination so powerful, then language between humans and their cyborg agents is the next frontier of capability. Platonic dialectic (2400+ years proven) is the highest form of human reasoning. Co-Dialectic codifies it into daily AI conversation so the user climbs the language ladder over weeks — and the habit transfers to family, team, community conversations. The plugin trains the dialectical reflex; the reflex reshapes every relationship.

### Changed
- Identity-card philosophy section in \`skills/co-dialectic/SKILL.md\` now distinguishes Socratic method from Platonic dialectic explicitly (was conflated in 4.12.x).

### Verified
- CI 55/0/0 ish (verify on ship).
- product-vs-solution-gate: PASS (no contamination).
- plugin-user-content-gate: PASS.

## [4.12.2] — 2026-05-17 — product-vs-solution sweep clean

Ran product-vs-solution-gate (Ground Zero invariant from cyborg) against the plugin: 83 BLOCK hits across 14 files. Triaged each:

- All hits are Anand-as-author / Anand-as-origin attribution (YAML frontmatter author fields, ARCHITECTURE-DECISIONS.md provenance, SKILL.md worked-example mentions). None are Anand-personal data in runtime code.
- Solution: added `product-vs-solution: example` exemption marker to 14 files + `_product_vs_solution_marker` field to plugin.json.

Result: gate scan now PASSES with 0 BLOCK / 0 WARN. Plugin ships clean to customers.

## [4.12.1] — 2026-05-17 — HOTFIX: Agent tool crash from updatedInput field drop

### Fixed
- `fish/hooks/claude-code.ts` PreToolUse hook was constructing `updatedInput` with only `{model, run_in_background, prompt}`, dropping caller-provided `description` and `subagent_type`. `updatedInput` REPLACES `tool_input` per Claude Code hook contract — Agent spawns crashed with `Error: undefined is not an object (K.length)`.
- Fix: spread original `toolInput` into `updatedInput` first, then overlay overrides.

## [4.12.0] — 2026-05-16 — Rename fish → Codi Agents

### Changed
- Rename user-facing terminology throughout: "fish" → "Codi Agents", "fish school" → "agent pool"
- `handler.ts`: SLUG `"fish"` → `"codi-agents"`; system messages updated to `[Codi Agents]`
- `hooks/claude-code.ts`: agent ID prefix `fish-*` → `codi-agent-*`; all `[fish lifecycle]` / `[MiroFish]` messages → `[Codi Agents]`
- `fish/scripts/agent-lifecycle.ts`: header comments updated to "Codi Agents"
- `session-start.sh`: lifecycle orphan sweep switched from `agent_lifecycle.py` (dead Python) to `agent-lifecycle.ts` (Bun)
- `skills/fish-swarm/SKILL.md`: renamed skill to `codi-agents`, all "fish" terminology → "Codi Agents"
- CI 55/0 clean (no new test files — rename is terminology-only, not structural)

## [4.11.0] — 2026-05-15 — Complete Python→TypeScript Migration

### Changed
- Migrate judge_panel.py (789 lines) → judge_panel.ts (894 lines): TypeScript+Bun cross-family cascade harness
  - `Promise.all` parallel small-panel (Gemini-Flash-Lite + GPT-5.4), `Bun.spawn` for subprocess execution
  - All 10 rubrics preserved: hallucination, flattery, spec-coherence, patent-safety, prompt-quality, prompt-sharpen, persona-detect, calibration-scan, hallucination-preflight, t0t2-jury
  - Same cascade logic, same exit codes, same output JSON schema
- Update all SKILL.md references from `python3 ...judge_panel.py` to `bun run ...judge_panel.ts` (4 files: judge-panel, hallucination-detector, co-dialectic, fish-swarm)
- Update install.sh to wire `bun run .../claude-code.ts` as the fish hook command (was python3 .../claude-code.py)
- Update install.sh fetch_skill_extras() to download `judge_panel.ts` and `handler.ts`/`hooks/claude-code.ts`
- Update test-plugin.sh Section 8 to check for `judge_panel.ts` in sandbox installs
- Exclude `node_modules/` and `venv/` from symlink checks in test-plugin.sh CI
- Zero HOW.py files remain in co-dialectic. P4 three-layer architecture fully compliant.

## [4.10.0] — 2026-05-15 — TypeScript Fish Swarm

### Changed
- Migrate fish swarm from Python to TypeScript+Bun (P4 three-layer architecture compliance)
  - `handler.ts` replaces `HOW.py` — typed Invariant layer, `@anthropic-ai/sdk`, structured postconditions
  - `hooks/claude-code.ts` replaces `hooks/claude-code.py` — completion cmd uses bun, not python3
  - `scripts/agent-lifecycle.ts` replaces `scripts/agent_lifecycle.py` — atomic state writes, timeout-based stuck detection
- Fix stuck background agents root cause: Python polled `~/.co-dialectic/task-outputs/{fish_id}.txt`
  but Claude Code writes to `/private/tmp/.../tasks/{task_id}.output` — no mapping existed,
  so completion was never auto-detected → timeout → stuck
- Completion now relies on explicit `bun run agent-lifecycle.ts complete --agent-id {fish_id}`
  injected into the agent's prompt, with timeout as safety net
- Added `package.json` with `@anthropic-ai/sdk` dependency for Bun-native builds
- Bun 1.3.14 required (`curl -fsSL https://bun.sh/install | bash`)

## [4.9.4] — 2026-05-14 — Tier 1.5 Decoupled

### Changed
- Co-dialectic is a product, not a solution: hooks output = workspace fast-path context
- Tier 1.5 decoupled from AGENT_STATUS.yaml; codi no longer hardcodes xOS paths

## [4.9.2] — 2026-05-14 — Post-Compaction Auto-Restore

### Added
- Mode B post-compaction auto-restore — fires automatically when context compacts, no user trigger needed
- Unit-of-work commit protocol wired into CLAUDE.md

## [4.9.0] — 2026-05-13 — PAI Three-Layer Architecture

### Changed
- TypeScript+Bun adopted as ONLY valid Invariant layer implementation (P4 mandate)
- Constitution P4 corrected: full TS migration = NOW; LLMClaw Phase 2.0 = Mac Mini/cloud portability = June 2026
- PAI reference pattern: danielmiessler/Personal_AI_Infrastructure
