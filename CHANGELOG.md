# Changelog

<!-- product-vs-solution: example - changelog is historical record; author + path references are provenance. -->


All notable changes to this repository are tracked here. This project follows [Semantic Versioning](https://semver.org/).

---
## [4.24.4] — 2026-06-24 — unit-of-work-check: defer to the session-logger auto-committer (XOS-63)

Cross-plugin Stop-hook race fix: in a career-os workspace the session-logger auto-commits every Stop and this check also runs on Stop with undefined relative order, so it could nag about a file the session-logger commits milliseconds later. Now defers when an auto-committer is active (recent `session-log:` commits). Fires normally elsewhere.

## [4.24.3] — 2026-06-23 — unit-of-work-check: session-delta, not absolute dirty tree (XOS-60)

Fixed success-path terminal noise: the unit-of-work-check Stop hook counted the whole dirty tree and nagged every Stop in any workspace with standing ambient cruft. Now baselines the ambient dirty set per session and warns only about paths new since session start. Workspace gate + FAIL-HARD preserved.

## [4.24.2] — 2026-06-23 — judge-panel: migrate dead Gemini CLI → agy (XOS-58)

Fixed cross-family review: the `gemini` CLI became ineligible (IneligibleTierError → Antigravity), so judge-panel's Google lane returned verdict=error. Migrated the Google lane to the `agy` (Antigravity) CLI on Google AI Ultra; family=google preserved; OAuth env-strip kept.

## [4.24.1] — 2026-06-09 — Co-Education Flywheel substrate-decouple fix (XOS-25 follow-up)

Fixed Decision-2 violation in 4.24.0 (teachme hardcoded `brain/sessions/ledger/`, breaking the substrate-agnostic kernel + its own CI). Now reads the ledger via `$CO_DIALECTIC_SESSION_LEDGER_DIR` with graceful degrade. Also brings 4.24.0 Co-Education Flywheel (teachme tool-lesson domain + Protocol-3 productivity footer + handoff session-end micro-lesson + bidirectional cyborg-side fix).

## [4.23.0] — 2026-06-05 — FORAGE: Epistemic Foraging flywheel

### Added — skills/forage/SKILL.md (new soul-tier skill)
Codifies the Constitution's Epistemic Foraging principle ([NOT CODIFIED] → live) as a
weekly tool-discovery loop: FORAGE (marketplace diff + GitHub trending +
claude-automation-recommender + P20 authority-weighted web sweep) → SCORE against the
week's WORKSPACE session-ledger friction, not novelty (never a universal/shared brain's
ledger — that degenerates the flywheel into novelty-hunting) → VERIFY in a throwaway
worktree (never propose blind; FOUNDATION-FIRST) → PROPOSE (install is HUMAN-GATED —
no auto-install from any marketplace; each verify-passed keeper files its own approval
ticket with verification evidence + one-command rollback, max 3 proposals/run) →
CODIFY (pending/keepers/rejects/deferred + autoMemoryDirectory entry + summary audit
ticket). Autonomy contract locked by Anand 2026-06-05 00:53 PDT: forage/score/verify
autonomous, INSTALL human-gated per candidate — an earlier in-flight fully-autonomous-
install answer was REVOKED (P12: weekly auto-install of third-party plugins = untrusted
code whose hooks execute on this machine).
Substrate paths via $CO_DIALECTIC_SESSION_LEDGER_DIR / $CO_DIALECTIC_TOOLS_REGISTRY
with graceful OSS fallback (Decision-2 compliant). Brain contract: reads
sessions/ledger/**, writes references/tools-registry.md.

### Fixed
- Version drift: `skills/co-dialectic/SKILL.md`, `install.sh`, and `marketplace.json`
  description were stale vs `plugin.json` — all surfaces now 4.23.0.

## [4.22.0] — 2026-06-05 — VERSION SYNC

### Fixed
- Version strings aligned: `marketplace.json`, `SKILL.md` frontmatter, and `install.sh` bumped to `4.22.0` to match `plugin.json`.
- `CHANGELOG.md` entry added for `4.22.0` (previously missing, causing CI failures on version-consistency and changelog-consistency checks).

## [4.20.0] — 2026-05-22 — TRUST THESIS REPAIR (GH #11 CRITICAL)

### Added — named-person-claim-grounding semantic gate
- New cyborg rule (three-layer TS+Bun): PreToolUse hook on Write|Edit scans proposed content for biographical/logistical/relational claims about named people and BLOCKs unverified claims, fail-closed on error. Covers the 5 acceptance shapes from issue #11 (pronoun, geography, schedule, vague-they, voice attribution).
- Constitution Ground Zero stub: NAMED-PERSON-CLAIM-GROUNDING INVARIANT.

### Added — Protocol 3 referent-ambiguity detection
- `SKILL-lite.md` Protocol 3 gains a "Referent ambiguity" criterion: when a prompt contains a pronoun / possessive / vague subject with ≥2 candidate antecedents, do NOT infer — disambiguate or ask ONE clarify question first.

### Fixed — honesty:undefined cosmetic bug in survival reminder
- `buildReminder()` emitted the literal `"honesty:undefined"` when `state.json` lacked the `honesty` field. Now only appends the suffix when honesty is a non-empty, non-default string; same defensive treatment for `state.mode` and `state.wildcard`. 6 new tests added.

### Why this exists
- **Issue #11 CRITICAL** — 5 same-class named-person hallucinations shipped in one ~50-minute session. Pattern was structural (referent ambiguity → partial-signal inference → confident ship), not "be more careful." This release ships the structural fix.

See `plugins/co-dialectic/CHANGELOG.md` for the full per-file detail.

## [4.19.1] — 2026-05-22 — HOTFIX: Stop hook schema compliance (unit-of-work-check)

### Fixed
- `hooks/unit-of-work-check.ts` `emitReminder()` was emitting `hookSpecificOutput.additionalContext`, which is **not valid for Stop hooks** (that field is PreToolUse / UserPromptSubmit only). Every Stop hook fire was generating a "Hook JSON output validation failed — (root): Invalid input" error in the agent log, surfacing the validation error to the user instead of the intended commit-protocol reminder.
- Fix: fold the context block into `systemMessage` instead of `hookSpecificOutput.additionalContext`. Banner + context now ship together via the schema-valid `systemMessage` field.
- Same-class bug previously fixed in `~/cyborg/scripts/stop-hook-learning-flywheel.ts` (commit 6bf6a8a 2026-05-22) — that fix should have been swept across all Stop hooks at the time. Single-slot-learning failure: codified rule `feedback_single_slot_learning_structural.md` exists for exactly this case and was not applied.

### Verified
- File patched at canonical source `plugins/co-dialectic/hooks/unit-of-work-check.ts`.

## [4.19.0] — 2026-05-22 — CONCISE BY DEFAULT (tone reversal)

Default verbosity flipped from verbose to concise — codi now leads with the answer; sharpening becomes opt-in via `cod sharpen`. T3+ stakes (named human, public-facing, irreversible) still get inline DIALECTIC because the user is making a one-way-door call. Users can opt back into eager tiered sharpening with `cod verbose`. New `CodiState.verbosity` field. Carries forward v4.18.0 task-first persona routing + onboarding hint. Resolves GH issue #10 (Guillaume De Smedt feedback: "I love reading — just not while in get things done mode").

## [4.14.2] — 2026-05-17 — include skills/handoff in install

skills/handoff/SKILL.md was present in source and marketplace but missing from 4.14.1 cache; patch bump forces fresh install.

## [4.14.1] — 2026-05-17 — survival auto-install + macOS portability fix

SessionStart hook auto-creates ~/.codialectic/state.json + copies statusline.sh to fixed resident path + wires settings.json statusLine. macOS BSD ls -v bug fixed (caught by judge panel) — no more version-sort gymnastics; fixed path everywhere.

## [4.14.0] — 2026-05-17 — codi SURVIVAL LAYER (never dies on compaction)

UserPromptSubmit hook reads persistent ~/.codialectic/state.json on every turn. statusline.sh renders codi state in Claude Code IDE status bar. Three persistent surfaces (hook config + state file + status line) make codi survive compaction, session restart, and skill-activation lapses.

## [4.13.1] — 2026-05-17 — 8 more techniques + SHA correction

8 technique deep-dive files added to `skills/teachme/techniques/`: role-priming, audience-priming, constraint-injection, chain-of-thought, few-shot-by-example, flipped-interaction, meta-shortcut, alternative-approaches (11 total). `growth.schema.json` prompt_hash corrected to full sha256 (64 hex chars).

## [4.13.1] — 2026-05-17 — 8 more techniques + SHA correction

Shipped 8 additional technique deep-dives (11 total in teachme/techniques/). Corrected sha256 schema: now full hash (still one-way / irreversible — that's why it's used; truncation was an unnecessary collision-resistance trade).

## [4.13.0] — 2026-05-17 — teachme + tiered sharpening (Sapiens to Cyborg)

Co-Dialectic now lives up to its Platonic-dialectic name. Protocol 3 renders three tiers per turn (IMPROVED -> SOCRATIC -> DIALECTIC); new \`teachme\` skill explains techniques + tracks growth. growth.jsonl telemetry is xOS-hydratable per SHARED-STATE HYDRATION INVARIANT.

## [4.12.2] — 2026-05-17 — product-vs-solution sweep clean

Co-dialectic plugin: 83 BLOCK hits to 0. Anand-as-author attribution exempted via markers; no runtime contamination. Plugin ships clean.

## [4.12.1] — 2026-05-17 — HOTFIX: Agent tool crash from updatedInput field drop

### Fixed
- `fish/hooks/claude-code.ts` PreToolUse hook on Agent calls was constructing `updatedInput` with only `{model, run_in_background, prompt}`, dropping `description` and `subagent_type`. Per Claude Code hook contract, `updatedInput` REPLACES the original `tool_input` — so Agent spawns crashed with `Error: undefined is not an object (evaluating 'K.length')`.
- Fix: spread original `toolInput` into `updatedInput` first, then overlay model/bg/prompt overrides. All caller-provided fields are now preserved.

### Verified
- Hook smoke-test confirms `updatedInput` contains all 5 keys: `description`, `subagent_type`, `prompt`, `model`, `run_in_background`.

## [4.12.0] — 2026-05-16 — Rename fish → Codi Agents

### Changed
- Rename user-facing terminology: "fish" → "Codi Agents" throughout handler.ts, claude-code.ts, agent-lifecycle.ts, fish-swarm/SKILL.md
- SLUG: `"fish"` → `"codi-agents"`; agent ID prefix `fish-*` → `codi-agent-*`
- System messages: `[fish lifecycle]`/`[MiroFish]` → `[Codi Agents]`
- session-start.sh: lifecycle orphan sweep switched from dead `agent_lifecycle.py` to `agent-lifecycle.ts` via Bun
- fish-swarm/SKILL.md: skill renamed to `codi-agents`; all "fish school" → "agent pool" / "Codi Agents"
- CI 54/0 clean

---

## [4.11.0] — 2026-05-15 — Complete Python→TypeScript Migration

### Changed
- Migrate judge_panel.py → judge_panel.ts (TypeScript+Bun cross-family cascade harness)
- Update install.sh: fish hook wired as `bun run .../claude-code.ts`; fetch_skill_extras downloads .ts files
- Update test-plugin.sh: check judge_panel.ts in sandbox; exclude node_modules+venv from symlink scan
- Zero HOW.py files remain in co-dialectic. P4 three-layer fully compliant.

---

## [4.10.0] — 2026-05-15 — TypeScript Fish Swarm

### Changed
- Migrate fish swarm from Python to TypeScript+Bun (P4 three-layer architecture)
  - `handler.ts` replaces `HOW.py` — typed Invariant layer, `@anthropic-ai/sdk`
  - `hooks/claude-code.ts` replaces `hooks/claude-code.py` — completion cmd uses bun
  - `scripts/agent-lifecycle.ts` replaces `scripts/agent_lifecycle.py`
- Fix stuck background agents: completion detection via explicit `bun run agent-lifecycle.ts complete`
  injected into agent prompt (not broken file-path polling)
- Added `package.json` with `@anthropic-ai/sdk` dep; Bun 1.3.14 required

---

## [4.9.0] — 2026-05-10 — Wildcard Mode

### Added

- **🃏 Wildcard Mode** (`wildcard on` / `codi wildcard` / `wildcard off`): overlay toggle that appends a steel-man of the opposite position at the end of strategic and open-ended outputs. Fires on: strategy, architecture, product/career recommendations. Does not fire on mechanical tasks, factual lookups, or prompt-sharpening turns. Anti-pattern explicitly enforced: hedges and "of course there are tradeoffs" non-answers are rejected in favor of arguments the agent could defend for 60 seconds.

---

## [4.8.1] — 2026-05-10 — Ghost-Buster (fixup)

### Fixed

- **Session-start poll fallback bug:** `|| echo '{}'` fired when `poll` exited 2 (WARN = stuck agents found), replacing real output with `{}` and reporting 0 stuck. Changed to `; true` so POLL_OUT always carries the actual poll result.

---

## [4.8.0] — 2026-05-10 — Ghost-Buster

### Fixed

- **Fish lifecycle registration gap:** `claude-code.py` PreToolUse hook now calls `register` after every successful background spawn (previously only called `check-dedup`, so the registry stayed empty and stuck agents were never tracked). Each spawn gets a unique `fish_id` (UUID-based) injected into the agent's prompt as a completion contract: `python3 agent_lifecycle.py complete --agent-id <id>`.
- **Session-start orphan sweep:** `session-start.sh` now calls `agent_lifecycle.py poll --timeout-min 10` at session start and surfaces stuck agent count in the kernel `systemMessage`. Agents that timed out in a prior session are detected on the next `waky waky` / session open.
- **Root cause addressed:** the 2026-05-09 ghost agents (3 idle agents burning tokens with no task) were caused by this registration gap — agents were spawned as background, the registry was empty, `poll` never ran, and compaction dropped any notification handlers. These two changes close the loop.

---

## [4.7.0] — 2026-05-05

**Codename:** External-Ready — onboarding skill + personal-content clean for first external users.

### Added

- **Onboarding skill** (`skills/onboarding/SKILL.md`): self-explanatory first-time setup. Walks any new user through what Co-Dialectic does, Step 1-4 quickstart, daily command reference, and session personalization. No external docs required. Trigger: "onboard me", "codi setup", "get started", "/co-dialectic-onboarding".
- **Session-start hint:** kernel message now includes onboarding hint for new users.

### Fixed

- **I1 personal content:** removed `**Author:**` line from SKILL.md body (body copy must be generic; attribution belongs in frontmatter only).
- **I2 external refs:** 4 references to personal workspace paths removed from shipped SKILL.md files:
  - `waky-waky/SKILL.md`: `constitution_path` → `principles_path` in context registry schema
  - `waky-waky/SKILL.md`: `~/cyborg/` reference in boundary explanation
  - `unknown-unknown/SKILL.md`: `CONSTITUTION.md` → "your principles document"
  - `co-dialectic/SKILL.md`: `WIP/specs/` → "a local specs file"
- **Plugin product ship gate now passes** (`bash ~/cyborg/rules/plugin-product-ship-gate/HOW.sh`).

---

## [4.6.3] — 2026-05-05

**Codename:** Self-Healing Skill Sync — plugin keeps userSettings skill current automatically.

### Fixed

- **Stale userSettings skill:** `session-start.sh` now checks `~/.claude/skills/co-dialectic/SKILL.md` version against the plugin cache version. If stale (or missing), it overwrites from plugin cache. `claude plugin update` now fully propagates — `/co-dialectic` skill invocation always loads the current version.

---

## [4.6.2] — 2026-05-05

**Codename:** Compaction Immunity — P0 first, kernel hooks, no more silent disappearing.

### Fixed

- **Compaction survival:** SKILL.md reordered — P0 (init) is now line 22, Metadata moved to bottom. After context compaction, truncated SKILL.md still contains full P0-P3 protocols. Root cause: 700 chars of header/metadata was consuming the truncation budget before any protocol logic.
- **Spec/code gap closed:** "Protocol 0 post-compaction re-init" was claimed in plugin.json description but relied on Protocol 0 being present after compaction. Now structurally guaranteed by reorder.

### Added

- **`hooks/hooks.json`:** Native plugin hooks — `SessionStart` injects kernel systemMessage; `UserPromptSubmit` re-fires kernel stub every turn (belt + suspenders).
- **`hooks/scripts/session-start.sh`:** Injects compact kernel on session open.
- **`hooks/scripts/inject-kernel.sh`:** Fires every message — approves prompt + attempts systemMessage injection. Compaction-immune by construction.

---

## [4.6.1] — 2026-05-05

**Codename:** Emoji Color System — semantic color via emoji, Doshi + Ive merged.

### Changed

- **Verification signals:** `✓` → `🟢` for pass, `🟡` for pass-with-flags. Green = verified/success; Amber = attention needed.
- **Score lift:** `65% → ~88%` → `65% → 🟢 ~88%` — green on the destination, not the start.
- **Agent-swarm routing:** `💰 Routed` → `🔵 Routed` — blue = informational system signal (not financial).
- **Color system semantics:** 🟢 verified/pass/improvement · 🟡 metric/watch · 🔵 system/routing · 🔴 live/hold (existing) · no color = secondary/hints.

---

## [4.6.0] — 2026-05-05

**Codename:** Benefit-Forward UX — Doshi audit of all user-facing Protocol surfaces.

### Changed

- **Protocol 0 welcome** (`co-dialectic/SKILL.md`): rewritten benefit-forward. New tagline: "Sharper prompts. Grounded answers. Smarter cost routing — all automatic." Explicitly lists 3 user benefits (↑ Sharper prompts / ✓ Grounded answers / 💰 Cost routing). Explains prompt score (%) and Cal score for new users. Version reference corrected to 4.6.0. Replaces: "You sharpen the AI. The AI sharpens you." (tagline, no benefit statement).
- **Protocol 3 prompt improvement** (`co-dialectic/SKILL.md`): Drive mode now shows estimated score lift (e.g., `65% → ~88%`) alongside the rewritten prompt. Makes the gain visible, not just the mechanism.
- **Protocol 8 T2 footer** (`co-dialectic/SKILL.md`): `✓ checked` → `✓ Grounded — no hallucinations detected`. Outcome language replaces jargon.
- **Protocol 8 T3 footer** (`co-dialectic/SKILL.md`): `✓ reviewed by 2 models` → `✓ 2 independent models agreed — clean`. Outcome + agreement signal replaces process label.
- **Protocol 8 judge-panel parse signals** (`co-dialectic/SKILL.md`): matching language update for `final_verdict == "pass"` and pass-with-flag cases.
- **Hints footer new-user tier** (`co-dialectic/SKILL.md`): `(💡 "codi help" · "codi personas" · "Be Jony Ive")` → `(💡 Score improving. "codi help" to explore · "codi personas" to see all experts)`. Benefit-nudge replaces bare command list.
- **Protocol 11 agent-swarm status** (`co-dialectic/SKILL.md`): `agent-swarm:active` jargon removed → `💰 Routed` (user benefit language; fires once on fan-out, not every turn).

---

## [4.5.0] — 2026-05-05

**Codename:** P4 Four Failure Mode Fixes — semantic gates + agent lifecycle + product hygiene.

### Added

- **Semantic T3 classification** (`claude-code.py`): replaced keyword regex with Haiku API call (`claude-haiku-4-5-20251001`, max_tokens=5, timeout=8s). Keyword logic kept as fail-open fallback. Explicitly names canonical docs (BRIEF.md, CONSTITUTION.md, brain/identity/, campaign masters) as T3 in system prompt. Closes P4 weakness-seam: "Is this T3?" is a semantic question — keyword regex was the wrong gate type.
- **Background agent lifecycle manager** (`fish/scripts/agent_lifecycle.py`): new script. Commands: `register`, `check-dedup`, `poll`, `status`, `complete`. State: `~/.co-dialectic/agent-lifecycle.json` (atomic writes). Timeout ceiling 10 min → flags as stuck. Capacity error detection. File dedup: BLOCKs spawn when running agent owns overlapping target files.
- **Worktree isolation → force foreground** (`claude-code.py`): `isolation=worktree` agents now force `run_in_background=False`. Observed failure: worktree agents hung silently for 20+ min with no completion. Worktree git setup (branch creation, lock) can hang; foreground ensures immediate failure visibility.
- **Runtime-agnostic executor type registry** (`claude-code.py`): `CODI_EXECUTOR_TYPES` env var with three-way logic: unset=Claude Code defaults (`elite-code-writer`, `codex:codex-rescue`), `""`=disable executor special-casing, `"a,b"`=custom runtime list. Removes Claude Code hardcode from product definition.
- **Fish-swarm dispatch mandate table** (`fish-swarm/SKILL.md`): explicit MUST-spawn table for 7 task patterns. Added whale-inline anti-patterns section with 2026-05-05 observed examples (200-line Rumsfeld audit, gap analysis, prompt-sharpen absorbed inline). Litmus test codified.
- **Protocol 0 post-compaction re-init** (`co-dialectic/SKILL.md`): detects "previously invoked" in system-reminder, re-fires Protocol 0 + mandatory fish health probe. Fixes codi stopping mid-session after context compaction.
- **Plugin user-content gate** (`~/cyborg/rules/plugin-user-content-gate/HOW.sh`): structural gate scanning all `plugins/*/SKILL.md` for 10 forbidden user-specific patterns. Exempts legitimate attribution (frontmatter `author:`, `**Author:**`). Exit 0=PASS, 1=BLOCK.
- **Pre-commit hook** (`.githooks/pre-commit`): wires plugin-user-content-gate into `prompt-engineering-in-action` git commit lifecycle.

### Changed

- **waky-waky SKILL.md**: replaced `~/anand-career-os/` Tier 1-4 hardcoded load paths with Context Registry pattern (`~/.codialectic/context.json`). Added `Context Registry Contract` section with schema. Generalized worked examples to `/path/to/...` placeholders.
- **handoff SKILL.md**: replaced personal script paths and personal GitHub repo reference in hook JSON example with generic placeholders.
- **co-dialectic SKILL.md**: removed personal marketing "More from the Author" section from product definition.
- **Background dedup check** (`claude-code.py`): added file path extraction regex + `agent_lifecycle.py check-dedup` call before every background spawn.

---

## [4.4.8] — 2026-05-04

**Codename:** Revert OAuth hack — API key only, complexity not justified.

### Reverted

- **`judge_panel.py`**: removed `GOOGLE_BEARER_TOKEN` bearer token path — `generativelanguage.googleapis.com` does not accept ADC/user OAuth tokens (returns `ACCESS_TOKEN_SCOPE_INSUFFICIENT`). API key is the only supported path for this endpoint.
- **`co-dialectic-judge-panel-eval.yml`**: back to API key only (`GOOGLE_API_KEY`). Removed `GOOGLE_BEARER_TOKEN`. Cost ~$0.01/run; not worth the complexity.
- **`cyborg/scripts/check-oauth.py`** and **`git-push-token-refresh.py`**: deleted. Hook mechanism confirmed non-functional for this API.
- **`~/.claude/settings.json`**: removed SessionStart `check-oauth` hook and PreToolUse `git-push-token-refresh` hook.

---

## [4.4.7] — 2026-05-04

**Codename:** Hack-only CI — strip WIF scaffold, keep bearer-token hack clearly labeled.

### Changed

- **`co-dialectic-judge-panel-eval.yml`**: removed WIF/OIDC scaffold (dead weight — no cost saving vs API key). CI now has only the hack path: `GOOGLE_BEARER_TOKEN` (from push-time hook, subscription billing) with `GOOGLE_API_KEY` as fallback. `TODO` comment left in workflow pointing to WIF as the future keyless path.

---

## [4.4.6] — 2026-05-04

**Codename:** OAuth-first CI — OIDC/WIF primary path, bearer-token hack fallback.

### Added

- **`judge_panel.py` — OAuth bearer token support**: `_run_gemini_api()` now prefers `GOOGLE_BEARER_TOKEN` (OAuth bearer auth, subscription billing) over `GOOGLE_API_KEY` (pay-per-token). Token source is transparent to the code — works whether token came from OIDC/WIF (proper path) or from the local hook (hack).
- **`co-dialectic-judge-panel-eval.yml` — OIDC/WIF structure**: CI workflow now has `id-token: write` permission, a WIF auth step (activates when `WIF_IDENTITY_PROVIDER` + `WIF_SERVICE_ACCOUNT` secrets are set), and a bearer token extraction step. OIDC is the proper path; the `GOOGLE_BEARER_TOKEN` secret (from the hack) is the working fallback. `GOOGLE_API_KEY` kept as last resort.
- **`cyborg/scripts/check-oauth.py`** (SessionStart hook): warns at session start if ADC token is expired. Non-blocking.
- **`cyborg/scripts/git-push-token-refresh.py`** (PreToolUse/Bash hook, **labeled HACK**): intercepts `git push`, captures local ADC token, writes to `GOOGLE_BEARER_TOKEN` GitHub Secret. Lets CI use subscription billing instead of API billing. Non-blocking — push proceeds even if token unavailable.

### Architecture note

OIDC/WIF is the primary path (no stored secrets, proper keyless auth). The bearer-token hook is explicitly a hack — interim until WIF is configured. WIF setup instructions are inlined in the CI workflow. Once WIF is set up, delete `git-push-token-refresh.py` and the `GOOGLE_BEARER_TOKEN` secret for the Google lane.

---

## [4.4.5] — 2026-05-04

**Codename:** CI auto-escalate — judge panel eval fires automatically on judge panel code changes.

### Changed

- **`co-dialectic-judge-panel-eval.yml`**: auto-triggers on push/PR to `skills/judge-panel/**` or `tests/**` (not only on manual dispatch). Path-scoped so it doesn't run on every push — only when judge panel logic or eval corpus changes.
- **CI tiebreaker model**: uses `gemini-3.1-flash-lite-preview` as tiebreaker in CI (override via `GEMINI_CLI_PREMIUM_MODEL`) — `gemini-3.1-pro-preview` was timing out at 120s in headless runner. Timeout reduced to 30s (`JUDGE_PANEL_TIMEOUT_S=30`) to fail fast rather than hang.

---

## [4.4.4] — 2026-05-04

**Codename:** CI clean push — judge panel eval moved to on-demand workflow.

### Changed

- **CI restructure**: `co-dialectic-ci.yml` (push-triggered) no longer runs judge panel eval — keeps every push zero-cost. Judge panel eval moved to `co-dialectic-judge-panel-eval.yml` (`workflow_dispatch` only — run manually from Actions tab when needed). Separates "does it build?" from "does the cascade work?", which has API cost.

---

## [4.4.3] — 2026-05-04

**Codename:** CI judge panel green — API fallback for headless runner + ZeroDivisionError fix.

### Fixed

- **`judge_panel_eval.py` ZeroDivisionError** when `avg_cost_vs_naive_parallel_jury=0` (zero-cost run). Now prints `n/a (zero cost)` instead of crashing.
- **CI: judge panel eval now passes on GitHub Actions**. Added `pip install anthropic` step + `JUDGE_PANEL_API_FALLBACK_APPROVED=1` + `GOOGLE_API_KEY` / `OPENAI_API_KEY` secrets — enables API-fallback path when `gemini`/`codex` CLIs are not installed on the runner.

---

## [4.4.2] — 2026-05-04

**Codename:** CI full coverage — install smoke, fish tier breadth, judge panel corpus.

### Added

- **CI: install smoke test** (`--smoke-install`). Full `install.sh` run in a temp `$HOME`; verifies every skill lands at `~/.claude/skills/`, judge-panel hook present, hygiene skill correctly absent.
- **CI: fish gate tier coverage**. T0 (skip), T1, T2, T3 each exercised independently — confirms tier-routing code paths all return valid JSON verdicts.
- **CI: judge panel eval**. Runs `tests/judge_panel_eval.py` against the 8-case seeded-flaw corpus with `ANTHROPIC_API_KEY` secret. Catches cascade regressions.
- **CI: Claude CLI install step**. `npm install -g @anthropic-ai/claude-code` on ubuntu runner — enables section 17 (plugin install sandbox) which was previously warning/skipping.
- **GitHub Actions secret**: `ANTHROPIC_API_KEY` set on `Exponential-OS/prompt-engineering-in-action`.

---

## [4.4.1] — 2026-05-04

**Codename:** CI gate — co-dialectic ships its first GitHub Actions workflow.

### Added

- **`.github/workflows/co-dialectic-ci.yml`**. Triggered on push/PR to `plugins/co-dialectic/**`. Runs: `test-plugin.sh` (17-section suite: structure, JSON validity, SKILL.md format, version consistency across 4 files, marketplace sync, install sandbox), fish gate Python syntax compile checks (`HOW.py` + `hooks/claude-code.py`), fish gate stdin smoke-test with T1 payload. Zero CI → full coverage in one workflow.

---

## [4.4.0] — 2026-05-04

**Codename:** Self-contained fish — codi ships and wires its own fish gate. No cyborg dependency required.

### Added

- **`fish/` directory in plugin** (`plugins/co-dialectic/fish/`). HOW.py (Haiku pre-task gate engine) + `hooks/claude-code.py` (Claude Code PreToolUse adapter) now ship inside the plugin itself. Previously these lived only in `~/cyborg/rules/codi-fish-precheck/` — a cyborg-layer staging path not available on fresh installs.
- **`install.sh` fish gate wiring**. Both install paths (marketplace via `claude plugin install` and direct download) now call `install_fish_gate()` + `wire_agent_hook()` after skill install. Files land at `~/.claude/skills/co-dialectic/fish/`; the Agent PreToolUse hook is merged into `~/.claude/settings.json` via stdlib Python — no jq dependency.
- **`unwire_agent_hook()`** in uninstall path. Cleanly removes the fish gate hook from `~/.claude/settings.json` on uninstall.

### How it works

`install.sh` → downloads `fish/HOW.py` + `fish/hooks/claude-code.py` → wires `PreToolUse → Agent → python3 ~/.claude/skills/co-dialectic/fish/hooks/claude-code.py` into `~/.claude/settings.json`. Every subsequent `Agent()` spawn in Claude Code reads the actual task from `tool_input.prompt` (stdin JSON), infers stakes (T1/T2/T3), and runs Haiku as the fish before the sub-agent executes.

---

## [4.3.0] — 2026-05-04

**Codename:** Fish-mandatory-gate — codi fish-swarm is now a required pre-task gate, not an optional orchestration layer.

### Added

- **`codi-fish-precheck` cyborg rule** (`~/cyborg/rules/codi-fish-precheck/`). Tier router HOW.py fires Haiku as a lightweight fish before any Agent() spawn. T0 → skip. T1-T2 → Haiku pre-check (PASS/WARN/BLOCK). T3-T4 → escalate to Independent Verification Gate. Ships with AUDIT.py, WATCH.py, manifest.json, EXPERIMENTS/ledger.json.
- **PreToolUse hook on `Agent` tool** in `~/.claude/settings.json`. Every `Agent()` spawn in Claude Code now routes through `codi-fish-precheck` automatically — fish is mandatory, not opt-in.
- **`json-for-machine-files` cyborg rule** (`~/cyborg/rules/json-for-machine-files/`). BLOCK machine-pattern YAML in agent directories; enforce JSON (jq/jsonpath/stdlib-native) for all agent-managed configs. YAML acceptable only for human-authored configs (GitHub Actions, docker-compose).
- **`marketplace_managed` flag in workspace.manifest.yaml**. `co-dialectic` and `career-os-plugin` now carry `marketplace_managed: true` + `plugin:` fields, preventing skill-compiler.sh from overwriting marketplace installs from git repos.
- **skill-compiler.sh marketplace guard** (`~/anand-career-os/ci/skill-compiler.sh`). Checks `marketplace_managed` flag before copying from git repo; emits warning to use `claude plugin install` instead.

### Changed

- **`plugin.json` version** bumped `4.2.1` → `4.3.0`.
- **`install.sh` version** bumped `4.2.1` → `4.3.0`.
- **`co-dialectic/SKILL.md`** — frontmatter + Protocol 0 welcome banner bumped to `4.3.0`.

---

## [4.2.1] — 2026-04-30

**Codename:** Naming-collision fix — `claude plugin install co-dialectic@xos` now fully activates `codi on`.

### Fixed

- **Plugin naming-collision workaround.** Claude Code's plugin system does not register a skill whose directory name matches the plugin name. After `claude plugin install`, the main `co-dialectic/SKILL.md` was silently absent from `~/.claude/skills/`, causing `codi on` to fail. `install.sh` now curls the skill directly into `~/.claude/skills/co-dialectic/SKILL.md` immediately after a successful plugin install. The §17 smoke test validates this end-to-end.
- **`download_skills_direct()` helper.** New prompt-free fallback in `install.sh` for when `claude plugin install` is unavailable or the user opts out. Prevents the ANSWERS-stream token-consumption bug that caused skills to be silently skipped when falling back to direct download.
- **§17 CI check always-on.** Removed `--plugin-install` flag gate; §17 (plugin install sandbox) runs unconditionally with a `command -v claude` guard.

### Changed

- **`plugin.json` version** bumped `4.2.0` → `4.2.1`.
- **`install.sh` version** bumped `4.2.0` → `4.2.1`.
- **`co-dialectic/SKILL.md`** — frontmatter + Protocol 0 welcome banner bumped to `4.2.1`.

---

## [4.2.0] — 2026-04-30

**Codename:** Protocol 12 removal — clean boundary between codi kernel and workspace adapters.

### Removed

- **Protocol 12 — Hygiene Cycle** (`skills/hygiene/SKILL.md` + `example-session-end.json`) deleted.
  Root cause: Protocol 12 referenced `~/cyborg/*`, `~/anand-career-os/brain/`, and `git -C ~/cyborg` commands — all thewhyman-specific substrate paths inside a public open-source plugin. Violates Architecture Decision 2 (no cyborg substrate content inside co-dialectic SKILL.md).
  Hygiene (sweep/codify/reorg/merge/pull) is a workspace-adapter responsibility. Codi emits the `session_end.json` beacon; workspace adapters consume it and run their own hygiene. Codi does not prescribe the substrate.

### Changed

- **Protocol 8 — UX vocabulary cleanup.** Tier labels renamed from raw `T0-T4` notation to plain-English (`Safe → Private → Shared → Significant → Live`) at the user-facing surface. Internal tier classifier unchanged; only the user-visible language updated.
- **`plugin.json` version** bumped `4.1.0` → `4.2.0`. Description updated to remove hygiene cycle reference and adopt plain-English tier labels.
- **`install.sh` version** bumped `4.1.0` → `4.2.0`.
- **`handoff/SKILL.md`** — removed Protocol 12 hygiene-key from multi-protocol-write contract; schema note simplified.
- **`co-dialectic/SKILL.md` Protocol 4 forward-ref** — removed Protocol 12 hygiene pointer.
- **`ARCHITECTURE-DECISIONS.md`** — Decision 5 added: documents the removal, the principled boundary, anti-patterns, and the workspace-adapter pattern for future hygiene implementations.

### Architecture

- **Decision 5** codifies the kernel/adapter split: codi captures and emits (Protocol 9 beacon); workspace adapters decide how and where to persist. Any hygiene implementation ships as a workspace-registered hook consuming `session_end.json` — zero codi changes needed.

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
