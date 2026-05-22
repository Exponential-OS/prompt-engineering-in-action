# Changelog — Co-Dialectic

## [4.19.0] — 2026-05-22 — concise by default (GH #10 tone reversal)

### Added
- `CodiState.verbosity: "concise" | "verbose"` field (optional for backward compat). Default for missing field = `"concise"` — flips the system-wide default from verbose to concise.
- `buildReminder()` Protocol 3 now branches on verbosity: concise mode tells Claude to lead with the answer and emit ONE LINE `Sharpen? Type 'cod sharpen' …` at the bottom; verbose mode renders the legacy eager IMPROVED / SOCRATIC / DIALECTIC three-tier output.
- 6 new tests in `tests/test_user_prompt_submit.ts` (18 total) covering default = concise, explicit concise, explicit verbose, T3+ inline-DIALECTIC escape hatch, verbosity-toggle hint always present, and write-back persistence of the verbosity field.

### Changed
- `skills/co-dialectic/SKILL-lite.md` Protocol 3 renamed to "Prompt Improvement (Verbosity-Aware)" — concise mode is explicitly the default. Verbose mode retains legacy Drive/Cruise behavior.
- `buildReminder()` write-back instruction now tells Claude to persist `verbosity` along with the other mutable fields.

### Why this exists
Guillaume De Smedt, GH issue #10, verbatim: *"I love reading — just not while in 'get things done' mode"* and *"I'm finding I'm ignoring everything above and just looking at this summary."* The system's verbose-by-default behavior was actively fighting the "get things done" user — they were already mentally bypassing the verbose scaffolding and looking for the summary. The fix inverts the default: summary-first; verbose is opt-in.

Concrete behavior change for a "prioritize this list" prompt:
- **Before (v4.18.0):** codi renders IMPROVED prompt + SOCRATIC questions + DIALECTIC synthesis, then asks user to choose y/n/e before answering. User must scroll past 3 blocks before reaching the prioritization output.
- **After (v4.19.0):** codi answers the prioritization directly. Bottom-of-response one-liner: `Sharpen? Type 'cod sharpen' …`. T3+ stakes (e.g., "prioritize for the board meeting") still get DIALECTIC inline.

### Caveats
- Caliber is unchanged. Concise output still channels the persona's 0.001% depth. The Pre-Output Caliber Audit + persona competency stack still apply.
- Verbose mode is preserved verbatim for users who want the original behavior. Toggle: `cod verbose`.
- This release is the SMALLEST MEANINGFUL UNIT for #10. Tone reversal at the prompt-engineering level (system prompts, sharpening templates) is deferred to v4.20.x.

### Source-of-truth
- GH issue: github.com/Exponential-OS/prompt-engineering-in-action/issues/10
- Handoff: WIP/prompt-engineering-in-action-product/feedback/2026-05-22-guillaume-de-smedt-handoff.md
- Test run: `bun test ./tests/test_user_prompt_submit.ts` → 18 pass, 0 fail
- Regression: `bun test ./tests/test_brain_kernel_bootstrap.ts` → 18 pass, 0 fail (unchanged)

## [4.18.0] — 2026-05-22 — task-first persona routing + onboarding hint (GH #8 + #9)

### Added
- `skills/co-dialectic/task-persona-map.md` — canonical task-verb → persona routing table. Users describe what they want done ("critique the UX", "prioritize this list", "debug this") and the system routes to the correct persona transparently. Resolves the "I can't remember Jony Ive's name" friction surfaced by Guillaume De Smedt (Principal PM, Bevy).
- `hooks/user-prompt-submit.ts → buildOnboardingHint()` — for the first 3 turns of a new user's interaction, the user-prompt-submit hook appends a `<codi-onboarding-hint>` block that explains (a) what the prompt-quality % means, (b) what the `Cal:` % means, (c) that the user does NOT need to memorize persona names — task language is enough. The hint auto-fades after `ONBOARDING_TURN_WINDOW` (3) turns. Gated on `growth_total_turns < 3`.
- `tests/test_user_prompt_submit.ts` — 12 new tests covering the onboarding-hint fade window (turn 0/1/2 show, turn 3+ hide), singular/plural wording, the task-persona-map reference in the reminder, and that the survival-reminder core block always renders.

### Changed
- `skills/co-dialectic/SKILL-lite.md` Protocol 2 — leads with "Task-first routing (default)" and points to `task-persona-map.md` before the legacy name-based roster. Status-line default is now task-first (`🎨 UX Critique` not `🎨 Design (Jony Ive)`).
- `hooks/user-prompt-submit.ts → buildReminder()` Protocol 11 line — now references `skills/co-dialectic/task-persona-map.md` and instructs Claude to increment `growth_total_turns` after each response (needed for the onboarding-hint fade).
- `hooks/user-prompt-submit.ts → main()` — gated behind `import.meta.main` so the test file can import helpers without triggering the hook's emit() side-effect.

### Why this exists
First PM-grade ICP user (Guillaume De Smedt, Principal PM at Bevy, ex-VP Global Community at Startup Grind) filed 4 structured GitHub issues 2026-05-22. Issues #8 and #9 ship together as the smallest meaningful unit. Verbatim user pain:

- #8: "I know these people, but I'd not normally state their name... I can't remember Jonny's name + I don't know who is best at 'prioritization'."
- #9: "one thing I am confused about — what are these scores? what do they mean?"

Fix shipped within hours of feedback to build trust with the first PM-grade non-academic user.

### Source-of-truth
- GH issues: github.com/Exponential-OS/prompt-engineering-in-action/issues/8, /9
- Handoff: WIP/prompt-engineering-in-action-product/feedback/2026-05-22-guillaume-de-smedt-handoff.md
- Test run: `bun test ./tests/test_user_prompt_submit.ts` → 12 pass, 0 fail
- Regression: `bun test ./tests/test_brain_kernel_bootstrap.ts` → 18 pass, 0 fail (no regression)

## [4.15.0] — 2026-05-17 — dev-cycle visibility (skill-version-banner hook)

### Added
- `hooks/skill-version-banner.ts` — PreToolUse hook on the `Skill` matcher. On every skill invocation:
  - Reads `~/.claude/plugins/installed_plugins.json`
  - Finds every installed plugin whose `<installPath>/skills/<skill>/SKILL.md` exists
  - Picks the install that WINS Claude Code's scope-resolution race (project-scope-matching-cwd > local > user)
  - Emits a one-line banner via `systemMessage` (visible to user) AND verbose context via `additionalContext` (visible to agent)
- `hooks.json` wires the new hook with a 2s timeout. Matcher `Skill` filters at the harness layer; the script also defensively checks `tool_name === "Skill"`.

### Why this exists
Tonight's BAE rename (Sep `social-distribution-plugin` → `brand-amplification-engine`) surfaced a debugging black hole: when 3 versions of `career-intelligence@xos` were installed across different project scopes (v0.59, v0.64, v0.65) AND an orphaned `social-distribution@xos` v0.49 was still lurking, `mission-control` produced garbage in a new session — and there was no way to tell which install had won. Hours of "why isn't this working" with no signal.

This hook eliminates that debug class permanently:
- The user immediately sees `[skill: career-intelligence@xos v0.65 · scope=user · mission-control]`
- The agent reasons about which version it's actually running
- Ambiguity warning surfaces if >1 install declares the same skill

Worked example output:
```
[skill: career-intelligence@xos v0.65.0 · scope=user · mission-control]
  path: ~/.claude/plugins/cache/xos/career-intelligence/0.65.0
```

When ambiguous (multiple installs declare the same skill):
```
[skill: career-intelligence@xos v0.65.0 · scope=user · mission-control ⚠ 3 installs found — scope race resolved]
  path: ~/.claude/plugins/cache/xos/career-intelligence/0.65.0
```

### Failure semantics
Hook ALWAYS exits 0. Never blocks tool execution. If resolution fails (skill not installed, cwd doesn't match any project scope, manifest corrupt), emits a "could not resolve" banner and lets the Skill tool proceed. No user can be locked out by this hook.

## [4.14.1] — 2026-05-17 — survival layer auto-install + macOS portability fix

### Added
- `hooks/scripts/install-survival-layer.sh` — fires on every SessionStart. Idempotent.
  Creates `~/.codialectic/state.json` if missing. Copies plugin's `statusline.sh` to fixed
  resident path `~/.codialectic/statusline.sh` (overwrites on every run — refresh on upgrade).
  Adds `statusLine` block to `~/.claude/settings.json` if missing, pointing at the resident path.
  New customers now get the full survival experience zero-friction.

### Fixed (caught by t0t2-jury cross-family judge)
- Initial draft used `ls -v ~/.claude/plugins/cache/xos/co-dialectic/*/hooks/statusline.sh | tail -1`.
  `-v` is a GNU extension; macOS BSD ls does NOT version-sort. On macOS this returned the
  WRONG version (lexically-sorted: "4.10.0" > "4.9.4" but tail -1 picked the wrong one).
  REDESIGN: install hook copies statusline.sh to a fixed path; settings.json points at that
  fixed path. No version resolution needed at runtime. Portable across BSD + GNU systems.

## [4.14.0] — 2026-05-17 — SURVIVAL LAYER (codi never dies)

The compaction-survival fix. Codi is now a persistent substrate, not a session skill.

### Why this exists
Codi was getting silently turned off after context compaction. Users (Anand + future customers) would install, use for 30 mins, hit compaction, lose codi, never know why their workflow degraded. Foundation-First Fix invariant says: when a load-bearing block fails, fix it before shipping more features.

### Added
- `hooks/user-prompt-submit.ts` (Bun) — runs on every user message. Reads `~/.codialectic/state.json` and emits BOTH `hookSpecificOutput.additionalContext` AND `systemMessage`. Tells Claude codi is active, which mode + persona is in effect, and to render Protocol 1 status line + Protocol 3 tiered output.
- `hooks/statusline.sh` — Claude Code statusLine script. Reads state.json and renders `📦 Product · 88% · Cal: 96% · 🤖 Codi: full · drive` in the IDE status bar. The user can SEE codi is alive even when the AI forgets.
- `~/.codialectic/state.json` — persistent source of truth. Schema: active, mode, honesty, persona, last_score, last_cal, wildcard, version, growth_total_turns. Updated by Protocol 1 after every response. Survives compaction, sessions, even plugin reinstall.

### Changed
- `hooks.json` UserPromptSubmit hook switched from the simple `inject-kernel.sh` (hardcoded systemMessage) to the new state-aware `user-prompt-submit.ts`.
- statusLine documentation added (Claude Code reads from user settings.json; install.sh wires the entry).

### Architecture
- The hook config is in plugin\'s hooks.json — fires regardless of skill activation state.
- The state.json is on disk — survives compaction, session end, restart.
- The statusLine is in user\'s settings.json — visible always.

Three persistent surfaces ⇒ codi cannot turn off invisibly. Only an explicit `codi off` command (sets active=false in state.json) disables it.

### Verified
- Hook smoke-test: `bun run hooks/user-prompt-submit.ts` emits valid JSON with both context + systemMessage.
- Status line smoke-test: `bash hooks/statusline.sh` renders correctly.
- settings.json: statusLine wired to dynamic-version cache resolver.

## [4.13.1] — 2026-05-17 — 8 more techniques + SHA correction

### Added
- 8 technique deep-dive markdown files at `skills/teachme/techniques/`:
  role-priming, audience-priming, constraint-injection, chain-of-thought,
  few-shot-by-example, flipped-interaction, meta-shortcut, alternative-approaches.
  Total of 11 techniques shipped (3 from v4.13.0 + 8 in v4.13.1).

### Fixed
- `growth.schema.json`: `prompt_hash` was `sha256(prompt)[:16]` (16 hex chars,
  64 bits). Corrected to full sha256 (64 hex chars, 256 bits). Clarification:
  SHA is cryptographically one-way — NOT reversible. Truncation was a privacy
  micro-optimization that lowered collision resistance unnecessarily. Full hash
  is the standard. Privacy property (prompt content unrecoverable from hash) is
  unchanged either way.

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
