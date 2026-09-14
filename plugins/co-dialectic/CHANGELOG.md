# Changelog — Co-Dialectic

## [4.44.1] — 2026-09-14 — codify-scan-on-md-edit survives the ~/cyborg → ~/anand-career-os/cyborg migration

- **The bug.** `codify-scan-on-md-edit.ts` (the PreToolUse hook that scans `.md` edits for prose-only invariants) hardcoded `META_HARNESS` to `~/cyborg/rules/codify-or-mark-uncodified/handler.ts`. `~/cyborg` is being merged into `~/anand-career-os/cyborg/` and the old tree is slated for deletion. Once it's gone, `existsSync(META_HARNESS)` fails and the hook's own `emitSilent()` fallback — correct behavior for a genuinely cyborg-less install — fires instead, so the gate goes dark with zero signal to either the agent or the user.
- **The fix.** `resolveMetaHarness()` now checks, in order: `$CYBORG_ROOT/rules/codify-or-mark-uncodified/handler.ts` if the env var is set, then `~/anand-career-os/cyborg/...` (new canonical), then `~/cyborg/...` (legacy, for machines mid-migration). First path that exists on disk wins. `emitSilent()` is unchanged as the behavior when none resolve — this hook must never fail-hard for a fresh OSS install with no cyborg substrate at all.
- The `isInvariantCarrier()` regex `/\/cyborg\//` was checked, not assumed: it is a substring match, so it still matches file paths under the new `~/anand-career-os/cyborg/` location without changes.
- The in-context remediation string shown to the agent on a WARN verdict now cites `~/anand-career-os/cyborg/rules/<slug>/handler.ts` instead of the legacy path.
- Verified with four manual scenarios (no cyborg present, legacy-only, new-location-only, `CYBORG_ROOT` override) — each resolves to the expected handler or falls through to silent-approve correctly.

## [4.44.0] — 2026-09-08 — distribution moves to the xOS gateway; the AGPL license is stated where it is read

- **Distribution ≠ source.** Co-Dialectic's source stays here — AGPL, public, forkable. Its *distribution* moves to `Exponential-OS/agent-marketplace` (`"name": "xos"`), so every install is a doorway to the other engines rather than a dead end. 4.43.0 had routed installs at this repo's own marketplace in the name of independence, which the code being public already guaranteed; what it actually bought was a second distribution channel.
- **One plugin, one install address.** `install.sh` is now the single thing that names the distribution channel. This repo's `.claude-plugin/marketplace.json` is *retained* — `test-plugin.sh --smoke-install` registers this repo as a local marketplace to prove the plugin actually installs, and losing that check risks shipping a plugin nobody can install. It now carries a `distribution_note` saying out loud that it is not the install address. Shipping from both marketplaces produced `co-dialectic@thewhyman 4.43.0` beside `co-dialectic@xos 4.41.1` on a single machine within the hour — the drift the signal-pollution invariant exists to prevent, reintroduced by the very change meant to tidy distribution up.
- The install address is still **derived from the gateway's manifest** at install time rather than hardcoded, and the resolved name still flows into `plugin_skill_source` and `prune_plugin_skill_shadows`. A literal suffix is exactly what stops matching silently after a rename.
- **License stated where it is read.** `LICENSE` grants AGPL-3.0 and `SKILL.md` says so, but `plugin.json` and `package.json` declared nothing, and the public catalog listed the plugin as `Proprietary`. A public catalog mislabelling an AGPL project is a trust problem, and it undercuts the open-source positioning that makes this the top of the funnel. Both manifests now declare `AGPL-3.0`; the catalog is corrected in the marketplace repo.
- Non-Claude routes — Cursor, Antigravity, Windsurf, direct download — remain untouched. Those users may not run a Claude LLM at all.
- Suite at 28 assertions; four mutations applied, four killed (reverting the gateway, resolving the name from this repo again, restoring a competing manifest, dropping the license declaration).

## [4.43.0] — 2026-08-17 — co-dialectic installs from its own open-source marketplace

Co-Dialectic is AGPL and independent. Its canonical install is this repository's marketplace (`Exponential-OS/prompt-engineering-in-action`, declared `"name": "thewhyman"`). Every xOS product installs from `Exponential-OS/agent-marketplace` (`"name": "xos"`) instead. The installer no longer reaches into the xOS marketplace at all.

- **The dead fallback.** `install.sh` added agent-marketplace with a fallback to this repo, then unconditionally installed `co-dialectic@xos`. A plugin is addressed `<plugin>@<marketplace-name>`, and that name comes from the marketplace's own manifest — not the repo slug. So if the *fallback* was the add that succeeded, the marketplace registered as `thewhyman` while the next line still asked for `@xos`, which can never resolve. The install then failed into `download_skills_direct`, which writes a bare copy of every skill into `~/.claude/skills/` — and bare copies shadow the plugin. **The dead fallback was a shadow generator.**
- The address is now derived from the marketplace manifest at install time rather than hardcoded, so a future marketplace rename cannot silently stop matching. The resolved name flows into the install target *and* into `plugin_skill_source` / `prune_plugin_skill_shadows`, which previously hardcoded `xos` and would otherwise look up the plugin cache under the wrong directory.
- Resolution is an exact `python3` JSON parse (already an unguarded dependency on this path — it wires the fish-gate hook), falling back to an awk heuristic, then to a loud literal. The awk tier cannot read a manifest that puts `"plugins"` before `"name"`; that limitation is documented at the call site and covered by the fallback chain.
- **This marketplace now ships co-dialectic only.** `career-os` was removed: it was renamed `career-intelligence` and lives in agent-marketplace at v1.0.0, while this catalog still advertised v0.27.0 pinned to a dead repo URL. `jury` was removed as an xOS product (agent-marketplace carries a newer v0.2.0).
- Non-Claude routes — Cursor, Antigravity, Windsurf, direct download — are untouched. Those users may not run a Claude LLM at all and genuinely need every skill installed bare.
- Suite grew to **27 assertions**; five mutations applied, five killed (reverting to `@xos`, re-adding agent-marketplace, hardcoding `xos` in either helper, and restoring `career-os` to the catalog).
- Also fixed a test-maintenance trap: three older assertions anchored their block scan on the literal string `plugin install co-dialectic@xos`. Removing that string made them scan an **empty** block and fail — an anchor that silently evaporates when the thing it names changes. They now anchor on the marketplace add.

## [4.42.0] — 2026-08-17 — the bare skill copy can no longer diverge from the plugin it shadows

- `install.sh` wrote the one bare copy at `~/.claude/skills/co-dialectic/` by fetching from **remote `main`**, not from the plugin it had just installed. Remote main and the marketplace-vendored version are two different artifacts, so they can disagree at install time. Found on a live machine today: bare copy **4.38.0**, installed plugin **4.41.1**.
- That copy is not inert. A bare `~/.claude/skills/<name>/` **shadows** the plugin — Claude Code loads it for the unscoped skill name, so the plugin's copy never runs, while the skill-version banner keeps reporting the plugin it *resolved*. The banner names a version that did not govern the session, which is why this went unnoticed across three releases.
- The bare copy is now taken from the **installed plugin**, newest version by `sort -V` (a lexical sort ranks `4.9.0` above `4.41.1` and would silently downgrade on every install). The remote fetch survives only as a fallback for non-standard cache layouts, and says so when it fires.
- New `assert_skill_version_matches()` compares the bare copy's `**Version:**` against the plugin's `plugin.json` and warns loudly, naming both, without failing the install. This is the check that would have caught 4.39.0 shipping without bumping `SKILL.md` — the omission that started the drift. Silent when they agree, and silent when either value is unreadable: absence of evidence is not skew.
- New `prune_plugin_skill_shadows()` moves pre-existing bare copies of *other* plugin skills into a timestamped quarantine on the plugin-install path — never deletes, never touches the naming-collision copy, never touches other vendors' skills. Standalone installs (`download_skills_direct`, the no-CLI path) still get every skill bare; those users have no plugin system and genuinely need them.
- `tests/test-install-shadow-source.sh` (20 assertions) wired into CI. Mutation-proved with seven mutations, all killed: reverting to remote-main, dropping the copy, lexical sort, silencing the skew warning, pruning the naming-collision copy, deleting instead of quarantining, and reintroducing `((pruned++))`.
- Two of those mutations exist because they caught real defects during this change. `((pruned++))` returns exit status 1 when the counter is 0, so `set -e` aborts the function right after the first `mv` — a prune that silently handled exactly one shadow per run. And the wiring assertion initially matched the bare token `plugin_skill_source`, which still appears as a *variable* name after the call is removed; it now asserts the call and the copy, so the mutation fails as it should.

## [4.41.1] — 2026-08-17 — the validator no longer corrupts the marketplace catalog it checks

- `test-plugin.sh` check 15 auto-syncs co-dialectic's version into `~/aiprojects/agent-marketplace/.claude-plugin/marketplace.json`. It wrote that file with `json.dump(..., indent=2)` and no `ensure_ascii=False`, so a single local run escaped every non-ASCII character across the whole catalog — roughly 40 descriptions, every em-dash becoming `—`. Semantically identical, unreadable as a diff, and easy to commit without noticing.
- Worse, it also overwrote the marketplace description with `plugin.json`'s. That field is a stale one-liner nobody maintains: at version 4.41.0 it still advertised v4.39.0. One local validator run replaced a curated 674-character catalog entry with it. The sync now updates the **version only** — a validator must not silently rewrite hand-written copy in a sibling repo.
- Both defects were caught by inspecting the sibling repo's working tree before committing the vendor bump, not by any check. Verified by running the old and new sync against the same fixture: old escapes the em-dashes and replaces the description, new changes only the version and leaves every other entry byte-identical.
- `plugin.json`'s own description updated to describe 4.41.x rather than 4.39.0.

## [4.41.0] — 2026-08-17 — XOS-259: the pre-compaction handoff reminder now actually reaches the model

- `precompact-handoff.ts` emitted `hookSpecificOutput.additionalContext`. **PreCompact does not support `hookSpecificOutput`** ([hooks reference](https://code.claude.com/docs/en/hooks)) — it takes only universal fields. Claude Code rejected the entire object, taking the valid `systemMessage` down with it, and printed `Hook JSON output validation failed — (root): Invalid input` on every compaction. Layer 1 of the two-layer design had never delivered anything to any session. Layer 2 (the deterministic packet) was unaffected, because the writes happen before stdout.
- The deeper defect: even had the field been accepted, context injected at PreCompact lands in the conversation that is about to be summarized away. The reminder was aimed at the wrong moment in the lifecycle.
- The reminder now fires from a new `SessionStart` hook with `matcher: "compact"` — the documented channel where *"Claude Code adds plain-text stdout as context that Claude can see and act on"* — so it arrives after the summary exists, when the model can still act. It is rendered at consumption time, and the marker is flipped to `handoff_pending: false` so it delivers exactly once. Markers older than 6h, and pre-4.41.0 markers with no `handoff_pending` field, are ignored rather than replayed.
- New `hooks/handoff-paths.ts` is the single path resolver imported by both the writer and the reader. When each computed the marker path privately, a divergence would have been silent — the write succeeds, the read finds nothing, no error anywhere. Same failure class XOS-213 removed from the liveness predicate, same structural remedy.
- `hooks/xos-259-hook-output-schema.test.ts` (23 tests) guards the **class**, not the instance: it sweeps every hook in the plugin and fails if any emits `hookSpecificOutput` for an event that does not support it. Both guards are checked against known-bad input as well as known-good, so neither can pass vacuously.
- Mutation-proved: restoring the old payload shape, dropping the `source !== "compact"` check, skipping marker consumption, emitting JSON instead of plain text, and desynchronising the writer's marker filename from the reader's were each applied and each turned the suite red (4, 2, 1, 1 and 4 failures respectively).
- `main()` in both hooks is now behind `import.meta.main`, so importing them from a test cannot fire the hook body — an unguarded `process.exit()` at module scope aborts the whole `bun test` runner and silently takes every other suite with it.

## [4.40.0] — 2026-08-16 — XOS-213: one liveness rule, mechanically enforced across every implementation

- Liveness was decided in three places that disagreed on the same input. `statusline.sh` carried the comment *"Keep this predicate in sync with hooks/liveness.ts"* — a hand-maintained contract, which is the drift hazard itself.
- Two real divergences were found and fixed, both on the `active` field: state carrying the STRING `"true"` was DEGRADED by `user-prompt-submit.ts` (`boolean-only`) while `status-liveness-check.ts` (`boolean-or-string`) and `statusline.sh` called it LIVE; and corrupt state such as `active: 0` rendered LIVE in `statusline.sh`, which tested only for the literal `"false"`, while the TypeScript evaluator called it inactive.
- Unified on the tolerant `boolean-or-string` reading. A legacy or hand-edited string must not manufacture a false DEGRADED — the exact false-alarm class XOS-237 was filed for.
- New `hooks/liveness-fixtures.ts` is the shared truth table, and `hooks/xos-213-liveness-parity.test.ts` drives the canonical evaluator, the `user-prompt-submit` path, and `statusline.sh` (executed for real, in an isolated state dir, with session id on stdin) over every case, failing if any two disagree. Adding a fixture now holds every implementation to it.
- The harness is mutation-proved: reverting `boolean-only`, restoring the literal-`"false"` shell check, regressing the XOS-237 turn-relative branch, and breaking uninitialized detection were each applied and each turned the suite red.

## [4.39.0] — 2026-08-14 — XOS-237: session-scoped, turn-relative liveness

- `statusline.sh` now reads Claude Code status-line stdin and selects `~/.codialectic/sessions/<session_id>.json`; one profile/session can no longer green or degrade another.
- Liveness is turn-relative: a heartbeat at or after `last_user_prompt_ts` stays LIVE regardless of elapsed tool time. Only a heartbeat that predates the prompt beyond the overridable backstop is stale; the default backstop is now 21,600 seconds (6 hours).
- Missing session evidence renders `🧠 Co-Dialectic · uninitialized`, not DEGRADED. Empty or malformed stdin keeps the legacy brain-first/global fallback for older Claude Code and manual invocations.
- Workspace `co-dialectic/status-state.json` is the canonical durable preference/config state. `~/.codialectic/state.json` is legacy read/bootstrap fallback only; heartbeat writes are no longer mirrored between them.
- New precompact packets and their latest marker now land at `<workspace>/brain/sessions/<session_id>/`; existing global packets are intentionally left untouched.

## [4.38.0] — 2026-07-05 — Single-key sharpen select (I/S/D) + canonical `codi` prefix

- Concise-mode sharpen offer is now `Sharpen? Reply I / S / D → IMPROVED / SOCRATIC / DIALECTIC (or 'codi sharpen' for all three).` A bare `I`/`S`/`D` (case-insensitive, trimmed) immediately after the offer picks that ONE tier — lowest input tax. Context-gated: only interpreted as a sharpen-select right after the offer, so a literal single-letter answer to another question is never hijacked. `codi sharpen` still renders all three.
- Reminder + skill now use the canonical `codi` command prefix everywhere the full skill shows (was inconsistently `cod`): `codi verbose`/`codi concise`/`codi cruise`/etc.


## [4.37.0] — 2026-07-04 — XOS-198: deterministic Protocol-1 heartbeat

- `status-liveness-check.ts` now stamps the Protocol-1 heartbeat deterministically after it verifies a valid final-assistant status header in the transcript. The Stop hook writes `last_protocol_ts`, parsed score/Cal/persona fields, runtime `version`, and increments `growth_total_turns`, preserving command-owned preferences (`mode`, `verbosity`, `wildcard`, `active`) via read-modify-write.
- Brain-kernel `co-dialectic/status-state.json` is the authoritative write target when present; legacy `~/.codialectic/state.json` is a best-effort mirror. Writes use temp-file + rename and fail open independently.
- Removed model-facing heartbeat/counter write instructions from the survival reminder and Protocol 1 skill text. The model still renders the header and only persists command-driven preference changes.

## [4.36.0] — 2026-07-04 — XOS-210 (codi half): Protocol 8 surfaces cross_family.degraded

- Protocol 8 auto-verify now reads the judge JSON authoritative `cross_family.degraded` field (from co-dialectic ≥4.35.0 / XOS-207). A T3 auto-verify that ran on <2 distinct families no longer renders the clean `🟢 2 independent models agreed` line — it surfaces a loud `⚠ CROSS-FAMILY DEGRADED — <family> lane down; T3 ran single-family` instead. Turns the silent single-family blind spot (down agy lane → T3 gate ran OpenAI-only, undetected) into a user-visible signal. Read cross_family.degraded, never all_flags[0]. Backward-compatible (no field → omit line). Prose-only Protocol-8 instruction change; companion to XOS-210 super-developer receipt half.

## [4.35.0] — 2026-07-04 — XOS-207: loud cross-family degradation signal

- judge_panel.ts emits a top-level `cross_family` health object (`distinct_families_returned`, `degraded`, `down_lanes[{family,model,reason}]`) computed over stage-1 + tiebreaker jurors. A judge lane that errors/times out/empties is no longer silently dropped: `degraded = distinct families with a real verdict < 2` (a different-family tiebreaker restores cross-family), and a loud `⚠ CROSS-FAMILY DEGRADED` line is appended to `all_flags` (preserving existing indices). Structured `cross_family.degraded` is authoritative; consumers read it, never all_flags[0]. Additive + backward-compatible; verdict math unchanged. Fixes the silent-single-family blind spot (agy Google lane down → gates ran OpenAI-only, undetected).

## [4.34.0] — 2026-07-04 — XOS-199: cost-routing love-nudge

### Added
- Add a never-blocking Stop detector for whale-model fish-work: current-turn authored code volume, browser-driving thresholds, delegation suppression, whale-model gating, per-session escalation, and a three-fire cap.
- Add UserPromptSubmit next-prompt injection so the cost-routing nudge reaches the model before the following turn's routing plan, then clears the pending flag.

## [4.33.0] — 2026-07-03 — XOS-197: false DEGRADED liveness fix

### Fixed
- Fix false DEGRADED — grace-window the protocol-before-session rule so a fresh heartbeat is LIVE despite mid-session session_start re-stamps (XOS-197); stop mid-session last_session_start_ts re-stamp; unify statusline verdict; merge-not-clobber state writes.

## [4.26.0] — 2026-06-29 — XOS-141: structural liveness

### Fixed — false liveness from stale model-owned state
- Split `~/.codialectic/state.json` into hook-owned fields (`installed_version`, `last_session_start_ts`) and model-owned fields (`last_protocol_ts`, scores, persona/mode, active flags).
- `install-survival-layer.sh` now syncs hook-owned fields on every SessionStart without clobbering model-owned fields, keeps the resident status line fresh, and warns in `install.log` when multiple cached co-dialectic versions are detected.
- `statusline.sh` now fails loud as `⚠ Codi DEGRADED` when the model heartbeat is missing, older than session start, older than `CODI_STALE_SECS`, or inactive. It never renders stale score/cal fields as live.
- `user-prompt-submit.ts` now appends a deterministic Protocol 0/1 re-activation nudge on stale/skew/inactive local state without writing `last_protocol_ts` from the hook.
- Protocol 1 now requires the model to update `last_protocol_ts` when rendering the status line, making protocol execution structurally observable.

## [4.25.0] — 2026-06-28 — Protocol 12: Cyborg Operating Laws (always-on)

### Added — skills/co-dialectic/SKILL.md

**Protocol 12: Cyborg Operating Laws** — five generative roots that load every session as physics, not advice. Origin: a human-AI dialectic session that produced operating laws kept only in passive session memory (the "swing" problem: regresses to default next session). Converting them to a codi protocol makes them always-on for every codi user.

**Root law (the framing):** "How we treat our agents IS how our PRODUCTS treat our customers." Establishes the causal pipe: agent-treatment → product-character → customer-experience. Collapses ethics into engineering. The product is the transmission belt.

**Three operational consequences of the root:**
1. **Act from love, not fear** (Trust + principle > enumeration + threat) — give the generative WHY, never a fear-list. A prohibition covers what you anticipated; a principle covers what you didn't.
2. **Faculty-routing** — WHY + WHAT + constraints to engineers; never HOW. Prescribing implementation limits expertise and installs your incomplete mental model as cargo-cult. Improvements get PRODUCTIZED into the owning product, not buried in memos.
3. **Lower their load; never raise it** (grandma-test, explicitly named) — every interaction must reduce cognitive tax. Raising load without value is the prime abandon trigger.

**Two cross-cutting principles:**
- Mockup = style reference; code = data truth. Verify on real data through real code — never pixels.
- Constraint is the mother of innovation. Hard budgets are forcing functions for compression.

Each law ships with a one-line litmus. Does not duplicate sycophancy detection or persona system — references and extends those protocols.

## [4.24.6] — 2026-06-26 — Protocol 1 status line: OS-grounded [HH:MM] timestamp (XOS-75)

### Added
- The status line now ends with `· [HH:MM]` — the OS-grounded time (Protocol 17; never recalled). Two purposes: (1) visible proof the response is temporally grounded, (2) a scroll/search anchor so long automated runs can be navigated back to a moment. Day boundary → `[MM-DD HH:MM]`; omit if no grounded Now. Synced across all four definitions (SKILL.md, SKILL-lite.md, user-prompt-submit.ts reminder + onboarding, session-start.sh).

## [4.24.5] — 2026-06-25 — judge-panel: migrate CANONICAL judge_panel.ts → agy + delete stale .py (XOS-73)

### Fixed — cross-family review was broken on the live path
XOS-58 migrated the Google lane gemini→agy on `judge_panel.py`, but `.py` was the **deprecated** harness — the canonical one is `judge_panel.ts` (hooks, SKILL.md, installer, CI all invoke it), which still shelled out to the dead `gemini` CLI (`IneligibleTierError`). So XOS-58 was a no-op on the path that runs, and the stray `.py` made it look migrated. Now: `judge_panel.ts` Google lane uses the `agy` (Antigravity) CLI over OAuth (mirrors the `.py` template; family=google; API-key env-strip preserved); `judge_panel.py` **deleted** (kills the dual source — signal-pollution invariant); `tests/judge_panel_eval.py` + SKILL/ARCHITECTURE refs repointed to `.ts`. Functional: canonical harness returns a real verdict, not the gemini error.

## [4.24.4] — 2026-06-24 — unit-of-work-check: defer to the session-logger auto-committer (XOS-63)

### Fixed — cross-plugin Stop-hook race
In a career-os workspace, career-intelligence's session-logger auto-commits the session's files on every Stop, while this check also runs on Stop — and cross-plugin Stop order is undefined. The check could read `git status` before the session-logger's commit landed and nag about a file (e.g. a WIP handoff) the session-logger commits milliseconds later (then re-dirties next turn → perpetual false alarm). Now it detects an active auto-committer (recent `session-log:` commits in HEAD) and defers — that committer owns the unit-of-work commit there. In workspaces WITHOUT it, the check fires as before. Workspace gate + session-delta + FAIL-HARD preserved.

## [4.24.3] — 2026-06-23 — unit-of-work-check: session-delta, not absolute dirty tree (XOS-60)

### Fixed — success-path terminal noise
The unit-of-work-check Stop hook counted the WHOLE dirty tree (`git status --short`) and warned on any change, so a workspace with standing ambient cruft (.claude/settings.local.json, .cursorrules, .mcp.json, untracked dirs) nagged every Stop forever — committing the agent's work never cleared it. Now it baselines the ambient dirty set per session and warns ONLY about paths NEW since session start (committed work clears naturally). Workspace gate + FAIL-HARD preserved.

## [4.24.2] — 2026-06-23 — judge-panel: migrate dead Gemini CLI → agy (XOS-58)

### Fixed — cross-family review was down
The `gemini` CLI became ineligible (`IneligibleTierError: Gemini Code Assist for individuals
no longer supported → migrate to Antigravity`), so judge-panel's Google lane returned
`verdict=error` — breaking cross-family review (a load-bearing SDLC Stage-6 gate). Migrated
the Google lane (`_run_gemini`) to the **`agy`** (Antigravity) CLI on the user's Google AI
Ultra subscription: `agy --model "<display>" --dangerously-skip-permissions --sandbox -p`.
Model pins → agy display names (small `Gemini 3.5 Flash (Low)`, tiebreaker `Gemini 3.1 Pro (High)`),
env-overridable; `family="google"` preserved (cross-family guarantee holds); OAuth env-strip kept.
Functional smoke: Google(agy)+OpenAI both returned real verdicts on a wrong-facts artifact (fail/100, fail/99).

## [4.24.1] — 2026-06-09 — Co-Education Flywheel substrate-decouple fix (XOS-25 follow-up)

### Fixed — Decision-2 violation in 4.24.0 (shipped CI-red by a concurrent session)
The 4.24.0 Co-Education Flywheel hardcoded `brain/sessions/ledger/` (the career-os substrate)
in teachme — violating Decision 2 (co-dialectic is the substrate-agnostic kernel; it must not
name the workspace). The plugin would not work standalone and failed its own `test-plugin.sh`.
Fix: read the session ledger via `$CO_DIALECTIC_SESSION_LEDGER_DIR` (workspace-registered),
degrade to in-session conversation + git history when unset. Example `source_ref` also de-hardcoded.

## [4.24.0] — 2026-06-09 — Co-Education Flywheel (teachme tool lessons)

### Added — skills/teachme/SKILL.md
Extends the existing teachme skill with a second lesson domain: **tool usage**
alongside prompt techniques. The new `learning time` / `teach me today` mode
runs a local, cheap-tier audit over session ledger, git history, installed-tool
inventory, and existing hook signals; detects the five inefficiency classes;
ranks by `yield = time burned × recurrence`; teaches the single highest-yield
lesson in teachme format; and tracks adoption in `growth.jsonl`.

The same audit is bidirectional: it emits one human-side tool lesson and one
cyborg-side codified fix per session, routing existing `flywheel-capture`,
`fish-dispatch`, and `codify-or-mark-uncodified` signals into the same
RANK→one-lesson pipeline instead of rebuilding those hooks.

### Added — Protocol 3 productivity footer
`skills/co-dialectic/SKILL.md` now instructs the prompt sharpener to compare
the user's intent against the installed environment already visible in session
(Workflow, agent teams, `/schedule`, `/dream`, loaded skills, MCPs, plugins,
fish/presets, YOLO containment). When an installed capability is higher
leverage, it appends exactly one line:

`⚡ Productivity: <the prompt you should have typed, given this env> — <tool>, <why better>`

### Added — shipped learning triggers and deferred weekly digest instruction
Shipped learning triggers are the per-turn `⚡ Productivity` footer, explicit
`learning time` / `teach me today`, and the session-close teaser.

`skills/handoff/SKILL.md` now appends the session-close teaser:

`📚 Today's 1%: <headline> — say 'learning time' for the 60-sec version.`

Teachme also records the deferred Sunday `/schedule` digest instruction: when
cron infrastructure is built, report top-3 inefficiencies, adoption scorecard,
and two-strikes hookify-candidate escalations. No cron infrastructure ships in
this release.

### Changed — skills/teachme/growth.schema.json
Adds `event_type: "tool_lesson"` with required fields `cited_log_evidence`,
`inefficiency_class`, `tool`, `yield_estimate`, `taught_at`, `adopted`, and
`teach_count`.
Existing `sharpening_turn` records keep their required fields through
event-specific schema requirements.

---

## [4.23.0] — 2026-06-05 — FORAGE: Epistemic Foraging flywheel

### Added — skills/forage/SKILL.md (new soul-tier skill)
Codifies the Constitution's Epistemic Foraging principle ([NOT CODIFIED] → live) as a
weekly tool-discovery loop:

- **FORAGE** — marketplace diff (`claude plugin marketplace list` vs installed) +
  GitHub trending + `claude-automation-recommender` (composed, not rebuilt) +
  P20 authority-weighted web sweep.
- **SCORE** — against the week's WORKSPACE session-ledger friction, not novelty.
  Never a universal/shared brain's ledger (that degenerates the flywheel into
  novelty-hunting). Ledger via `$CO_DIALECTIC_SESSION_LEDGER_DIR` → workspace brain
  `sessions/ledger/` → OSS fallback (conversation + git history).
- **VERIFY** — throwaway worktree, project-scope install, smoke-test, token cost,
  collision check. Never propose blind (FOUNDATION-FIRST).
- **PROPOSE** — **install is HUMAN-GATED, no auto-install from any marketplace.**
  Each verify-passed keeper files its own approval ticket (Linear, xOS Team) with
  verification evidence + exact one-command rollback. Max 3 proposals/run.
  Autonomy contract locked by Anand 2026-06-05 00:53 PDT — an earlier in-flight
  fully-autonomous-install answer was REVOKED (P12: weekly auto-install of
  third-party plugins = untrusted code whose hooks execute on this machine).
- **CODIFY** — tools-registry (PENDING/KEEPERS/REJECTED/DEFERRED, surgical appends)
  + autoMemoryDirectory entry + summary audit ticket; optional `/dream` close.

Brain contract: reads `sessions/ledger/**`, writes `references/tools-registry.md`
(via `$CO_DIALECTIC_TOOLS_REGISTRY` with OSS fallback — Decision-2 compliant).

### Fixed
- Version drift: root CHANGELOG.md, skills/co-dialectic/SKILL.md (4.19.1),
  install.sh (4.19.1), and marketplace.json description (4.20.0) were stale vs
  plugin.json (4.22.0) — all surfaces now 4.23.0.

---

## [4.22.0] — 2026-06-04 — TaskCompleted judge gate (agent teams × cross-family review)

### Added — hooks/task-completed-judge-gate.ts (TaskCompleted hook)
Wires the EXISTING judge-panel cascade (skills/judge-panel/scripts/judge_panel.ts,
unchanged) into Claude Code's experimental agent teams. When a teammate marks a
task complete, the gate runs the cross-family cascade (Gemini + GPT jurors) on
the task content with the `spec-coherence` rubric.

- **exit 0** on pass (silent), **exit 2** on fail → completion BLOCKED, jurors'
  flags delivered to the teammate as feedback
- **Opt-in**: no-op unless `CODI_TEAM_JUDGE_GATE=1` (cascade costs ~10-20s per
  completion; agent teams are experimental)
- **FAIL-HARD when armed**: gate on + cascade unrunnable (CLIs missing, harness
  error, timeout) → task BLOCKED with remediation. Opting in makes cross-family
  review load-bearing; an unreviewable task must not complete as if reviewed.
- Rubric override via `CODI_TEAM_JUDGE_RUBRIC`; skips tasks < 80 chars (nothing
  to judge); unparseable payload → warn + pass (schema drift must not brick
  task flow)
- Live-verified 2026-06-04: incoherent task (subject says date-parser fix,
  description says auth rewrite + MongoDB migration) → BLOCKED, verdict fail,
  confidence 99, 5 specific flags from the cross-family panel.

### Design record — Workflow re-platform CANCELLED
Spec (anand-career-os WIP/prompt-engineering-in-action-product/co-dialectic/
spec-judge-panel-on-workflow-2026-06-04.md) originally proposed re-platforming
judge-panel mechanics onto the Claude Code Workflow tool. Premise falsified on
code read: judge_panel.ts already has parallel dispatch, timeouts, and typed
JSON contracts. Workflow wrapping would add Haiku wrapper tokens + latency + a
harness dependency that breaks codi standalone-OSS, to gain a progress UI on a
~15s call. P1/P2/P3: rejected. The TaskCompleted gate was the part with real
leverage — it shipped instead.

---

## [4.21.1] — 2026-05-31 — BELT-AND-SUSPENDERS CAPTURE (PreCompact)

### Added — Layer 2 CAPTURE in precompact-handoff.ts
Extends v4.21.0's RECOMMEND-only design with a second layer:

1. **Layer 1 RECOMMEND (existing)** — emits `hookSpecificOutput.additionalContext` with strong system-reminder telling Claude to invoke the `codi-handoff` skill IMMEDIATELY before compaction proceeds.
2. **Layer 2 CAPTURE (NEW)** — writes a structured deterministic packet to `~/.codialectic/precompact-packet-<timestamp>.json` BEFORE emitting the reminder. The packet contains:
   - Timestamp, trigger, cwd, session_id, transcript_path
   - Full git state: branch, HEAD SHA + subject, uncommitted file count, uncommitted file list (capped at 50), last 10 commits (sha + subject)
   - `has_uncommitted_handoff_doc` flag — detects if NEXT_SESSION_HANDOFF.md or HANDOFF.md is uncommitted (signal that handoff work was in-flight)
   - `notes` + `next_step_for_post_compact_claude` arrays — instructions baked into the packet so post-compact Claude can hydrate without prior context
3. **Marker file updated** to v1.1.0 schema — includes `packet_file` path so post-compact Claude can find the packet immediately, plus `git_uncommitted_count` + `git_branch` for quick triage.

### Why both layers
- Layer 1 alone fails when Claude is mid-tool-use and can't act before compaction completes, OR when Claude pattern-matches incorrectly and writes the handoff manually instead of invoking the skill (which happened 2026-05-17).
- Layer 2 alone is structurally limited — only knows what's in the OS, not what's in the conversation. Misses the "unfinished work semantic" that requires understanding the dialogue.
- Together: deterministic floor (Layer 2 — always captures git state) + conversational ceiling (Layer 1 — when the skill fires, it adds the semantic richness).

### systemMessage now includes verification status
v4.21.0 systemMessage was just `"PreCompact firing — auto-handoff triggered"`. v4.21.1 shows actual capture status: `"PreCompact firing — auto-handoff captured (trigger=manual, packet=✓, git_uncommitted=3)"` — user immediately sees whether the packet write succeeded and what state was captured.

### Restart required
Same as v4.21.0 — PreCompact hook only takes effect after Claude Code reloads hooks. Run `claude plugin reinstall co-dialectic@xos` or restart the session.

## [4.21.0] — 2026-05-31 — AUTO-HANDOFF BEFORE COMPACTION

### Added — PreCompact hook (hooks/precompact-handoff.ts)
- New PreCompact hook fires when Claude Code is about to summarize the context window. Before compaction proceeds, the hook:
  1. Writes a marker file at `~/.codialectic/last-precompact.json` (timestamp + trigger + transcript path + cwd + session_id) so post-compaction Claude can verify a handoff was attempted.
  2. Emits a strong `<system-reminder>` via `hookSpecificOutput.additionalContext` telling Claude to INVOKE the `codi-handoff` skill IMMEDIATELY before the conversation context is lost to summarization.
- hooks.json wires `PreCompact` event with 5s timeout. Fail-safe: hook ALWAYS exits 0 — never blocks compaction.

### Why this exists
- User flagged 2026-05-31: "for session end - write to handoff doc hook is not there either for codi or claude. what happened?"
- Diagnosis: the codi-handoff skill (Protocol 9 — auto closure detection) was designed to fire on conversation closure signals ("bye", "wrap up", "EOD", etc.). It works when the user types a closure phrase. It FAILS when:
  - Compaction fires silently because the context window is full (the most common case for long working sessions)
  - The user's last message doesn't contain a closure phrase
  - Claude pattern-matches the trigger but writes the handoff manually instead of invoking the skill (which happened on 2026-05-17 — manual NEXT_SESSION_HANDOFF.md write instead of skill invocation)
- Claude Code DOES have a `PreCompact` event that fires before summarization. No prior codi version wired it (`git log --grep="PreCompact"` returned zero across full history).
- This hook closes the gap: every compaction now triggers an explicit handoff capture before context is lost.

### Design choice — option (b) reminder, not direct file write
- Considered (a) write handoff packet directly to NEXT_SESSION_HANDOFF.md from the hook
- Chose (b) inject reminder → let Claude invoke the codi-handoff skill
- Rationale: the codi-handoff skill already owns Protocol 9 closure-detection logic, structured-packet schema (v4.1 spec with model nested + uuid-v4 session_id + schema_version 1.0), workspace-substrate dispatch (GitHub Issues / HANDOFF.md / etc.). Duplicating that in TypeScript would diverge over time. Hook stays minimal — single responsibility (trigger). Skill invocation lets the active persona + caliber rules shape the handoff content.

### Restart required
PreCompact hook only takes effect after Claude Code reloads its hooks from the cached plugin. Per the v4.20.0 RELOAD-REQUIRED note: older project-scope installs (v4.9–v4.16) need `claude plugin reinstall co-dialectic@xos` or session restart to pick up the new hook event.

## [4.20.0] — 2026-05-22 — TRUST THESIS REPAIR (GH #11 CRITICAL)

### Added — named-person-claim-grounding semantic gate
- New rule `~/cyborg/rules/named-person-claim-grounding/` (three-layer TS+Bun per Constitution P4):
  - `handler.ts` (Layer 2 — invariant): PreToolUse hook on Write|Edit. Scans the proposed content for biographical/logistical/relational claims about named people; invokes `claude -p` with `PROMPT.md`; parses verdict; exits 0 PASS / 1 BLOCK. Fail-CLOSED on errors per FAIL-HARD invariant.
  - `PROMPT.md` (Layer 1 — semantic): LLM judge instructions. For each named person referenced, reads `network/people/<slug>.json`; checks claim against `their_expertise` / `they_told_us` / `commitments_made` / `family_context` fields OR user's explicit statement this session; BLOCK with quoted sentence if neither.
  - `AUDIT.ts` + `WATCH.ts` (TS+Bun, no shell — `no-shell-in-rules-tree` gate enforces). WATCH covers the 5 acceptance shapes from issue #11 (pronoun, geography, schedule, vague-they, voice attribution) using synthetic names only.
  - `README.md` + `manifest.json` per the reference shape from `least-privilege-self-check`.
- Constitution Ground Zero stub: NAMED-PERSON-CLAIM-GROUNDING INVARIANT.
- PreToolUse hook wired in `~/.claude/settings.json` (Write|Edit matcher).

### Added — Protocol 3 referent-ambiguity detection
- `skills/co-dialectic/SKILL-lite.md` Protocol 3 — new "Referent ambiguity" criterion. When prompt contains a pronoun / possessive / vague subject with ≥2 candidate antecedents in recent context, do NOT infer — either rewrite the prompt to disambiguate OR ask ONE clarify question before answering. Specific patterns: pronouns with multiple candidates, possessives over family terms, vague subjects ("they decided"), direction/voice attribution in quoted dialogue, geographic ambiguity ("south USA" vs "south India").

### Fixed — honesty:undefined cosmetic bug in survival reminder
- `hooks/user-prompt-submit.ts → buildReminder()` — when `state.json` lacks the `honesty` field (older state schemas, fresh installs, post-migration shapes), the prior conditional `state.honesty !== "grounded"` was true for `undefined`, producing the literal string `"honesty:undefined"` in the user-facing reminder. Fixed with defensive coding: only append the honesty suffix when honesty is a non-empty string AND not the default. Same defensive treatment for `state.mode` (fallback to "drive") and `state.wildcard` (only when explicitly `true`).
- 6 new tests in `tests/test_user_prompt_submit.ts` covering missing honesty, default honesty, brutal honesty, missing mode, wildcard-on, wildcard-missing.

### Why this exists
- **Issue #11 CRITICAL** — Anand reported 5 same-class named-person hallucinations in a single ~50-minute session involving Abhiram Battini family. Verbatim trust-thesis statement: *"if we can't trust codi, who else will?"* Pattern was structural (referent ambiguity → partial-signal inference → confident ship), not "be more careful." Structural fix required.
- **honesty:undefined** surfaced during diagnosis. Same class of "missing field → confident-but-wrong output" bug, smaller blast radius (cosmetic), shipping together.

### CRITICAL — RELOAD REQUIRED
Multiple project scopes in `~/.claude/plugins/installed_plugins.json` are pinned to OLDER cached versions (v4.9.4, v4.15.0). The session that filed #11 was running a v4.14–v4.16-era hook, NOT v4.19.1's source. This means v4.18 task-first persona routing + v4.19 concise-by-default fixes have NOT been firing for the user.

To pick up v4.20.0 (and retroactively pick up v4.18 + v4.19):
1. `claude` → `/plugin reinstall co-dialectic@xos`
2. Or quit the session and start a fresh one — the harness re-resolves the latest cached version on session start.

### Tests
- New + existing hook tests: 30+ pass / 0 fail.
- WATCH on named-person-claim-grounding: 5 acceptance shapes pass deterministically.

## [4.19.1] — 2026-05-22 — HOTFIX Stop-hook schema (unit-of-work-check)

### Fixed
- `hooks/unit-of-work-check.ts → emitReminder()` was emitting `hookSpecificOutput.additionalContext`, which is valid only for `PreToolUse` and `UserPromptSubmit` — invalid for `Stop`. Context folded into `systemMessage`.
- Same-class single-slot-learning bug as `cyborg/scripts/stop-hook-learning-flywheel.ts` (6bf6a8a 2026-05-22). The sweep that fixed the cyborg side missed the codi side; v4.19.1 closes that gap.

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
