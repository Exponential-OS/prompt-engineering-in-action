---
name: codi-hygiene
description: >
  Per-unit-of-work hygiene cycle. Use when the user says "codi hygiene",
  "tidy", "tidy up", "clean up", "hygiene check", "sweep up", "organize this",
  or when the session-end Stop hook fires (typically composed before
  codi-handoff so the handoff includes the hygiene report). Runs the
  five-step cycle (Sweep / Codify / Reorg / Merge / Pull) that EMERGENT
  SYSTEM IMMUNITY mandates after every conversation. Detects file sprawl,
  duplicate handoffs, deprecated symlinks, and uncommitted brain writes;
  surfaces a structured report to stdout AND emits a JSON beacon to
  ~/.codialectic/hooks/session_end.json for the CODA
  mothership telemetry.
metadata:
  version: "4.1.0"
  author: "Anand Vallamsetla"
  tier: "continuity"
  protocol: 12
---

### BEGIN CODI-HYGIENE ###
# Codi Hygiene — Per-Unit-of-Work Cycle

**Continuity tier.** Companion to `waky-waky` (session-start) and
`codi-handoff` (session-end emitter). Hygiene runs **before** handoff so the
handoff doc carries today's hygiene report. Constitution anchors:
EMERGENT SYSTEM IMMUNITY (per-conversation hygiene cycle —
sweep / codify / reorg / merge / pull); GIT-NATIVE COORDINATION (the
three-phase loop that Merge + Pull execute); LEARNING FLYWHEEL (every
session produces at least one codified lesson); FAIL-HARD INVARIANT (no
soft-warn-and-continue on detected sprawl — surface and block until
addressed or explicitly dismissed).

## Why this exists

Constitution EMERGENT SYSTEM IMMUNITY claims the per-conversation hygiene
cycle is mechanically enforced by `codi:hygiene v3.3.2`. Verified missing
2026-04-27 — neither the spec file nor the plugin skill existed. The
accumulated workspace-root pollution, duplicate handoff docs, deprecated
`.career-os/` symlinks bridging to `brain/`, and uncommitted brain writes
are direct symptoms of that gap. v4.1 ships this skill as the real
enforcement primitive.

The user's verbatim 2026-04-27 directive: *"isn't there a co-dialectic
hygine skill code that is checking after every prompt unit of work?"* —
the answer must become yes.

Without hygiene, every other invariant in EMERGENT SYSTEM IMMUNITY runs at
reduced capacity: lessons die at session boundary, sibling cyborgs operate
on stale brain, file sprawl compounds, T4 errors recur because canonical
sources drift unchecked.

## When to activate

**Explicit invocation:**

- `codi hygiene` / `codi-hygiene` / `hygiene check`
- `tidy` / `tidy up`
- `clean up` / `cleanup`
- `sweep up` / `sweep`
- `organize this` (when said at session end, not mid-task)

**Lifecycle activation:**

- The runtime's `Stop` / `SessionEnd` hook fires.
- `codi-handoff` is about to fire and hygiene has not yet run this session
  (chained — hygiene first, then handoff).
- The user types any of the auto-handoff closure phrases (per Protocol 9 —
  "bye", "see you", "thanks") AND substantive work occurred this session.

**Do NOT auto-trigger** mid-conversation. Hygiene is a closing ritual; firing
it on every quiet pause defeats the cycle (sweep needs the full session
substance to be meaningful).

**Toggle:** `codi hygiene off` (advanced — disables auto-cleanup, manual
mode only). `codi hygiene on` re-enables. `codi hygiene status` shows last
fire time + most recent reorg flags. Persists session-scoped; default ON
on every fresh session.

## The five-step cycle

All five steps run in order. Steps 1-2 produce the report; step 3 detects
sprawl; steps 4-5 execute the GIT-NATIVE COORDINATION three-phase loop.
Step 3 is the gate — detected sprawl surfaces to the user and DOES NOT
auto-execute file moves (they are irreversible). User confirms → execute.
User dismisses → flag persists in handoff for next session.

### Step 1 — Sweep

Scan the conversation transcript for four classes of items. When in doubt,
include rather than omit (the report can mark uncertain items).

**What was learned this unit?**
- New patterns named, new principles surfaced, new failure modes diagnosed.
- User corrections that the agent applied (each correction is a lesson
  candidate).
- Cross-family judge findings, hallucination-detector flags caught
  pre-emit, calibration-auditor flattery hits.
- Any moment the agent said "good catch" / "you're right" / "I should have"
  in response to user pushback — that's a lesson the agent learned.

**What canonical claims were verified?**
- Biographical claims diffed against `~/anand-career-os/brain/identity/`.
- Technical claims diffed against current docs / live sources.
- Temporal claims grounded against OS `date` (per TEMPORAL GROUNDING).

**What unverified claims remain?**
- Biographical / quantitative / prescriptive claims that shipped without
  cross-check (Matt-Kleinman class).
- Sub-agent outputs adopted without re-diffing against canonical sources.
- Live-world claims (current model names, prices, person's role) recalled
  from training rather than fetched.

**What blast-radius items still need audit?**
- If the user caught an error in artifact A, every artifact B/C/D in the
  same blast-radius is presumed to carry the same error class until
  audited (multi-dim sweep per EMERGENT SYSTEM IMMUNITY).
- Outreach drafts in the same campaign as a corrected draft.
- Specs citing a now-corrected architectural assumption.

### Step 2 — Codify

Lessons land in canonical brain locations IMMEDIATELY — not "later",
"end of week", "I'll write it up." Tomorrow's session is a different
context; the lesson dies at session boundary if not codified now.

**Routing:**
- Cyborg-wide rule / principle / framework update → fold as a compressed
  insight into `~/cyborg/CONSTITUTION.md` under the relevant principle
  packet (per Knowledge-Capture Policy 2026-04-23 — no new files in
  `~/cyborg/lessons/`).
- Tool-use / discipline / git-coordination pattern → append to
  `~/cyborg/best-practices/<file>.md`.
- Distribution / brand / content pattern → append to
  `~/cyborg/distribution-engine/<file>.md`.
- Anand-instance lesson (career, network, identity, project-specific) →
  `~/anand-career-os/brain/<domain>/<file>.md`.
- Reference material (authoritative source, framework, prior-art) →
  `~/cyborg/references/<file>.md`.
- Story / lived incident with multi-decade re-readability → append to
  `~/anand-career-os/brain/stories/<file>.md`.

**Compression discipline:** if the lesson resists 1-3 sentences, the
target packet may be wrong. Find the right packet OR split the lesson
into two. Prose-only catch-all files are dead code (P2 violation).

**Per-conversation minimum:** every session produces AT LEAST ONE codified
lesson OR an explicit `no-lesson-this-session` reason (audit trail). A
session that ends with zero lessons codified AND zero why-no-lesson is a
broken Flywheel — surface the gap.

### Step 3 — Reorg (sprawl detection)

Scan the workspace + brain layer for sprawl. The seven detections below
ARE the gate. Each detection produces a flag; flags surface to user with a
proposed reorg plan. Per FAIL-HARD INVARIANT, agent does NOT silently
auto-execute file moves — those are irreversible, user must confirm.

**Detection 1 — Workspace-root pollution.**

Any file at the workspace root that is NOT in the allowlist:
- `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md` (or symlink)
- `HANDOFF.md` OR `NEXT_SESSION_HANDOFF.md` (one, not both — see Detection 2)
- `README.md`, `LICENSE`, `.gitignore`, `.gitattributes`
- `sync.sh`, `workspace.manifest.yaml`
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`,
  `Dockerfile`, `docker-compose.yml` (and analogs)
- Standard config dotfiles (`.envrc`, `.editorconfig`, `.python-version`,
  etc.)

Anything else at root → flag. Suggested reorg: move to
`scripts/`, `archive/`, `brain/distribution/campaigns/<event>/`, or the
relevant subdirectory. PNGs / drafts / one-off shell scripts at root are
the most common offenders.

**Detection 2 — Duplicate-purpose handoff docs.**

If both `HANDOFF.md` AND `NEXT_SESSION_HANDOFF.md` exist at workspace
root → flag. Per GIT-NATIVE COORDINATION, single-source-of-truth applies.
Suggested reorg: archive the older / less-canonical one to
`archive/handoffs-<YYYY-MM-DD>/`, keep the active one. The active branch's
purpose determines which name; default to whichever name the workspace
CLAUDE.md references.

**Detection 3 — Deprecated symlinks bridging to canonical paths.**

A symlink whose source is a deprecated path AND whose target is the
canonical-location file. Example seen 2026-04-27:
`.career-os/memory/stories/stories → brain/stories`. The symlink is a
bandaid for un-updated plugin code that still reads the old path. Flag
for plugin-code-update — the plugin should read the canonical path
directly, not via symlink.

Detection heuristic: walk known deprecated-path roots (`.career-os/memory/`,
any path containing `_deprecated_` or `_legacy_`) and `readlink -f` each
symlink. If target is under `brain/` or another canonical-location root,
flag with both source path AND consumer (which plugin reads it).

**Detection 4 — Plugin runtime sprawl (canonical user data in runtime dir).**

Any user-canonical content (identity, stories, network/people, projects)
located under `.career-os/` or another plugin runtime dir when canonical
location is `brain/`. Plugin runtime dirs hold caches, configs, ledgers,
hooks — never canonical user data. Flag with proposed move target.

Heuristic: under `.career-os/memory/` (and analogs), any non-symlink
directory that mirrors a `brain/` subdirectory (`stories/`, `identity/`,
`network/`, `projects/`) is suspicious. Symlinks pointing INTO `brain/`
are fine (they're already pointing at canonical); concrete dirs with
content are sprawl.

**Detection 5 — One-off shell scripts at workspace root.**

Files matching `fix-*.sh`, `quick-*.sh`, `temp-*.sh`, `oneoff-*.sh`,
`debug-*.sh`, `migrate-*.sh` at workspace root that have not been modified
in the last 7 days. Heuristic: stat the file's mtime; if older than 7d
AND name matches the pattern → flag for archive. (Recently-modified
matches the pattern but is in active use — don't flag.)

Suggested reorg: move to `archive/oneoff-scripts-<YYYY-MM>/` with a brief
note in commit message.

**Detection 6 — Campaign artifacts at workspace root.**

Image files (`*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.gif`), draft text
files (`*-draft.md`, `*-draft.txt`), or campaign-master files at workspace
root. Per Constitution CAMPAIGN-COMPLETENESS INVARIANT and the workspace
convention, these belong at
`brain/distribution/campaigns/<event-or-date>/`. Flag with suggested move
target.

Edge case: if the file is a logo / favicon / standard branding asset, it
may legitimately live at root or in `assets/`. Default heuristic flags;
user can dismiss for legitimate cases.

**Detection 7 — `.plugin` bundle files outside plugin install dir.**

Any `*.plugin` file (or `.zip` that smells like a plugin bundle —
`co-dialectic-*.zip`, `career-os-*.zip`) found outside the canonical
plugin install dir (`~/.claude/plugins/`, `~/.gemini/plugins/`, or the
runtime-equivalent). Flag for cleanup — these are install artifacts that
should not persist after install.

Heuristic: `find ~/anand-career-os ~/cyborg -maxdepth 4 -name '*.plugin'`
plus pattern-match on `*.zip` filenames. Cap at maxdepth 4 to avoid
walking deep node_modules / venv trees.

**Reorg report format:**

For each flag, produce: `{detection_id, path, current_location,
proposed_target, reason, severity}`. Severity = HIGH (canonical data in
wrong place — Detection 4), MEDIUM (duplicate / deprecated bridge —
Detections 2, 3), LOW (clutter — Detections 1, 5, 6, 7). Aggregate into
the markdown report (see Output section).

**TODO (punted to v1.1):**
- Glob-style configurable allowlist per-workspace (today's allowlist is
  hardcoded universal). Workspaces with non-standard layouts will need
  to override Detection 1.
- File-content fingerprint diff for Detection 2 (today only checks
  filenames; two truly-different handoff docs at root could be a
  legitimate split — user should dismiss in that case).
- Cross-machine sync (mtime is local; if the user works across machines,
  the 7-day staleness in Detection 5 may misfire). Today: assume
  single-host workflow.

### Step 4 — Merge (three-phase loop)

For every brain write produced in Step 2 (codifications) and any
file-move executed in Step 3 (only after explicit user confirmation):

1. Identify the repo root for the write (`~/cyborg/`,
   `~/anand-career-os/`, the active project repo).
2. Verify NOT on `main` / `master` (per `.githooks/pre-commit` rule).
   If accidentally on main, `git checkout -b hygiene-codify-<YYYY-MM-DD>`
   the change off main first.
3. `git add` the specific files (NEVER `git add -A` — risks staging
   secrets / unrelated work per git-best-practices).
4. `git commit -m "<message including verbatim user prompt that triggered
   the lesson>"` per SHARED-STATE HYDRATION INVARIANT.
5. `git checkout main && git merge --ff-only <feature-branch>` — fast
   forward only; merge conflict surfaces real coordination gap.
6. `git push origin main`.
7. Return to feature branch OR delete it (user choice).

Per FAIL-HARD INVARIANT, any step that fails (push rejected,
merge-not-ff, hook blocked) surfaces immediately. No
log-and-continue. The cycle is incomplete until merge succeeds.

**Repos covered by hygiene's Merge phase:**
- `~/cyborg/` — every Constitution / framework / brain-layer write.
- `~/anand-career-os/brain/` — every instance lesson.
- The active project repo (when the session produced commits there).

**Repos NOT auto-merged by hygiene:**
- Public repos (`~/aiprojects/prompt-engineering-in-action/`,
  `~/aiprojects/cyborg-sites-shared/`, etc.) — per GIT-NATIVE
  COORDINATION, public repos sync per-feature on explicit ship signal,
  never per-conversation. Hygiene reports "<N> uncommitted changes in
  <public-repo>" but does not auto-commit / auto-push. User decides.

### Step 5 — Pull

After Merge phase completes, run `git pull --ff-only origin main` in:
- `~/cyborg/`
- `~/anand-career-os/`
- Every active project repo touched this session.

Fast-forward only. If non-FF, surface the divergence as a hygiene flag
("local diverges from origin — needs resolution"). Don't auto-rebase /
auto-merge — that's a coordination gap that needs explicit resolution
per GIT-NATIVE COORDINATION.

**Why pull at session end (not just session start):** the next session
starts fresh per `waky-waky`, but a sibling cyborg thread may push to
origin/main between this session's last commit and the next session's
start. Pulling at session end closes the gap on TODAY's brain; pulling
at next session start closes the gap on TOMORROW's brain. Belt and
suspenders.

## Output format

After all five steps, emit two artifacts:

### 1. Markdown report (stdout)

```
HYGIENE — UNIT OF WORK CLOSED
  Sweep:
    - Lessons learned: <N>
    - Canonical claims verified: <N>
    - Unverified claims remaining: <N>
    - Blast-radius audits pending: <N>

  Codify:
    - Lessons codified: <N> (or "no-lesson-this-session: <reason>")
    - Targets: <list of file paths written>

  Reorg flags: <N total — H high, M medium, L low>
    [HIGH]  <detection_id>: <path> → <proposed_target>
            <reason>
    [MED]   <detection_id>: <path> → <proposed_target>
            <reason>
    [LOW]   <detection_id>: <path> → <proposed_target>
            <reason>
    ...

  Merge:
    - Brain commits pushed to origin/main: <N>
    - Repos: <list>
    - Public-repo uncommitted: <N> changes (NOT auto-pushed)

  Pull:
    - Repos pulled fresh: <list>
    - Diverging repos: <N> (require manual resolution)

  Followups created: <N>
    - <list of explicit followups for next session>

  Status: <CLEAN | FLAGGED (<N> reorg items pending) | BLOCKED
          (<reason>)>
```

If reorg flags > 0, append:

```
Proposed reorg plan:
  [HIGH]  mv <src> <dst>      # <reason>
  [MED]   mv <src> <dst>      # <reason>
  [LOW]   mv <src> <dst>      # <reason>

Type "execute reorg" to apply ALL flags.
Type "execute reorg [HIGH]" to apply only HIGH severity.
Type "dismiss <detection_id>" to drop a flag (persists to handoff).
Type "skip reorg" to leave all flags for next session.
```

**Spec note:** The report template above extends the v4.1 spec's originally
listed sections (Sweep / Reorg flags / Merge / Pull / Followups) with a
`Codify:` section. This addition surfaces codification outcomes directly in
the hygiene report — consistent with the LEARNING FLYWHEEL mandate that every
session produces at least one codified lesson. The spec's report template is
intentionally minimal; the Codify section is the sanctioned extension.

### 2. JSON beacon (multi-protocol write to canonical path)

Write a minimal telemetry beacon to the canonical path
`~/.codialectic/hooks/session_end.json`. Use the multi-protocol-write
contract (see section below) to merge the `"hygiene"` key without
clobbering sibling protocol keys (e.g., `"handoff"` written by Protocol 9).

The beacon is **telemetry only** — pings ship-stats to a future CODA
mothership. NOT decisions / lessons / open-loops (those go to the
human-readable handoff).

Schema (minimal — per 2026-04-27 user directive: *"don't over engineer
and bloat co-dialectic storage"*):

```json
"hygiene": {
  "reorg_flags_count": <int>,
  "lessons_codified_count": <int>,
  "merges_pushed_count": <int>,
  "pulls_completed_count": <int>,
  "fired_at": "<ISO 8601 timestamp>"
}
```

`fired_at` MUST be the OS current time (per TEMPORAL GROUNDING INVARIANT)
— `date -Iseconds` or equivalent. NEVER recalled.

`session_id` and `schema_version` belong at root only (per multi-protocol
contract key layout). They MUST NOT be duplicated inside the `"hygiene"`
nested key.

Field semantics:
- `reorg_flags_count`: total reorg flags detected across all 7 detection
  categories (sum of all severities).
- `lessons_codified_count`: count of lessons written to `~/cyborg/*` this
  session (0 is valid — log `no_lesson_reason` in the markdown report).
- `merges_pushed_count`: count of brain commits merged to `origin/main`
  and pushed during the Merge phase.
- `pulls_completed_count`: count of repos successfully pulled during the
  Pull phase.
- `fired_at`: ISO 8601 timestamp when this hygiene run completed.

**Multi-protocol-write contract:**

All protocols that write to `~/.codialectic/hooks/session_end.json`
share ONE file. Each protocol owns a top-level key; shared metadata
lives at root. Atomic merge pattern:

1. Read existing file (if present) into `existing = json.load(...)`.
2. Merge own protocol's payload under its key (e.g., `existing["hygiene"] = {...}`) — never clobber sibling keys (`"handoff"`, etc.).
3. Update root-level shared metadata fields (`session_id`, `schema_version`, `model`, `duration_min`, `msg_count`, `ended_reason`) — only from the first protocol to write (don't overwrite once set).
4. Write merged object to a temp file (`session_end.json.tmp`).
5. `mv session_end.json.tmp session_end.json` (atomic).

Reader semantics: any consumer reads the file, sees all protocols'
fields under their respective keys plus shared root metadata.

**Key layout:**

- Root (shared): `session_id`, `schema_version`, `model`, `duration_min`, `msg_count`, `ended_reason`
- `"hygiene"`: Protocol 12 fields — `reorg_flags_count`, `lessons_codified_count`, `merges_pushed_count`, `pulls_completed_count`, `fired_at`
- `"handoff"`: Protocol 9 fields — written by codi-handoff when active

**TODO (punted to v1.1):**
- Append-only beacon log (today: each run overwrites; v1.1 should
  append to a JSONL for cross-session aggregation).
- Schema validation against `~/.codialectic/schemas/hygiene-1.0.json`
  before write — defense against malformed beacons reaching the
  mothership.
- Conflict resolution when two concurrent protocol writes race on the
  same key (today: last writer wins; v1.1: advisory lock or CRDT merge).

## Composition with other v4.1 protocols

**Protocol 8 (Auto-Verify by Stakes):** unverified claims surfaced by
hygiene's Sweep phase get auto-routed to Protocol 8 BEFORE the session
closes. T4-class unverified claims (biographical, money, public-ship)
fire the cross-family judge-panel cascade and bio-claim-verifier. T2-T3
claims fire hallucination-detector. Hygiene is the surfacer; Protocol 8
is the verifier.

**Protocol 9 (Auto-Handoff):** hygiene fires BEFORE auto-handoff. The
handoff doc includes today's hygiene report (markdown) as a section.
Sequence:
1. User types closure phrase ("bye", "thanks") with HIGH confidence.
2. Hygiene fires (steps 1-5 of this skill).
3. Handoff fires immediately after, consuming the hygiene report's
   followups[] as input to the handoff's open-loops list.
4. Handoff's JSON packet gets piped to registered hooks per
   codi-handoff contract.

**Protocol 10 (Honesty Selector):** hygiene's Sweep phase respects the
session's `honesty` mode. `honesty brutal` lowers the threshold for
"unverified claim" detection (any imprecise claim flags). `honesty soft`
raises it (only clear hallucinations flag). T4 outputs auto-downgrade
honesty soft → grounded for hygiene scope (irreversible artifacts don't
deserve sugar-coating).

**Protocol 11 (Agent-Swarm):** hygiene's Reorg detection is itself a
fan-out candidate. Each of the 7 detection heuristics is independent —
parallel sub-agents (fish-swarm tier) execute the 7 detections
concurrently, parent synthesizes flags. Reduces hygiene latency from
serial-7-detections to parallel-1-round.

**GIT-NATIVE COORDINATION:** hygiene's Merge + Pull steps ARE the
three-phase loop applied at session boundary. Hygiene is GIT-NATIVE
COORDINATION's enforcement primitive at the session-end seam.

## Triggers

- Explicit: "codi hygiene", "codi-hygiene", "hygiene check", "tidy",
  "tidy up", "clean up", "cleanup", "sweep up", "sweep" (when contextually
  closing), "organize this" (when closing).
- Lifecycle: Stop / SessionEnd hook fires AND hygiene-on toggle is true
  (default).
- Chained: Protocol 9 (Auto-Handoff) about to fire → hygiene fires first.

## Privacy and scope

- The hygiene report contains workspace + brain layer content. Treat as
  private; never push to public repo.
- File-move proposals reference absolute paths; redact for any output
  that may end up in public artifacts.
- The JSON beacon contains only counts + status — no content. Safe for
  mothership telemetry. If the beacon path ever ships externally, the
  schema is already content-free by design.

## How to verify

**Verification protocol — clean session (no sprawl):**

1. In a workspace with no root pollution + no duplicate handoffs +
   committed brain writes, trigger `codi hygiene`.
2. Confirm the markdown report shows `Status: CLEAN` with all 7
   detection counts at 0.
3. Confirm the JSON beacon written to
   `~/.codialectic/hooks/session_end.json` parses valid JSON and
   contains a `"hygiene"` key via
   `python3 -c "import json,sys; d=json.load(open('<path>')); assert 'hygiene' in d"`.
4. Confirm `session_id` and `ran_at` are current OS time, not training
   recall.

**Verification protocol — sprawl detected:**

1. Plant test fixtures: drop a `fix-test-2026-01-01.sh` at workspace root
   (Detection 5), create both `HANDOFF.md` and `NEXT_SESSION_HANDOFF.md`
   at root (Detection 2), drop a campaign PNG at root (Detection 6).
2. Trigger `codi hygiene`.
3. Confirm 3 reorg flags surface with correct severities and proposed
   targets.
4. Type `dismiss 5` — confirm Detection-5 flag drops out of the active
   list and persists to next session's followups.
5. Type `execute reorg [HIGH]` — confirm only HIGH-severity moves
   execute (none in this case if Detection 4 absent).
6. Type `execute reorg` — confirm remaining moves execute, files land
   at proposed targets, commits land on a feature branch (NOT main).

**Failure modes to check:**

- Hygiene auto-executes a file move without user confirmation →
  FAIL-HARD violation.
- Hygiene reports CLEAN when sprawl exists (false negative) → detection
  heuristic broken; surface for v1.1 sharpening.
- Hygiene flags non-sprawl as sprawl (false positive) → tune allowlist;
  user dismisses; flag persists to handoff for human review.
- `git push` fails during Merge phase, hygiene reports success → silent
  failure; FAIL-HARD violation.
- Beacon written with stale `ran_at` → TEMPORAL GROUNDING violation.
- Beacon overwrites handoff registry at the canonical path → schema
  collision; FAIL-HARD on detect.

## Status reporting

After hygiene runs, append a one-line status to the agent's normal
response (separate from the full markdown report — the report is the
artifact, the status line is the breadcrumb):

```
Co-Dialectic · Hygiene — <CLEAN | <N> flags | BLOCKED (<reason>)>
```

When chained with handoff:

```
Co-Dialectic · Hygiene → Handoff — cycle complete (<N> commits, <M>
flags carried forward).
```

### END CODI-HYGIENE ###
