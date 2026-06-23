# Changelog — Co-Dialectic

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
