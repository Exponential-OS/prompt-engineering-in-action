---
name: codi-handoff
description: >
  Session-end handoff codification. Use when the user says "codi handoff",
  "save handoff", "wrap up", "session end", "end session", "ship handoff",
  or when the session-end lifecycle hook fires. Scans the current
  conversation for unfinished items, decisions made, and lessons learned;
  emits a structured JSON packet to the workspace's session-end hooks.
  Workspace adapters subscribe and persist to their own substrate (GitHub
  Issues, HANDOFF.md, ticket system, etc.). Codi knows nothing about the
  substrate — it only captures and emits.
metadata:
  version: "4.1.0-protocol-9"
  author: "Anand Vallamsetla"
  tier: "continuity"
---

### BEGIN CODI-HANDOFF ###
# Codi Handoff — Session-End Codification

**Continuity tier.** Companion to `waky-waky` (session-start). Together they
close the per-conversation hygiene cycle: waky-waky hydrates context at the
start; codi-handoff emits structured handoff at the end. Constitution
anchors: EMERGENT SYSTEM IMMUNITY (per-conversation hygiene cycle —
sweep / codify / reorg / merge / pull); P15 (Multi-Agent — shared state);
LEARNING FLYWHEEL (every session produces at least one codified lesson).

## Why this exists

At session end today, unfinished work either gets re-explained to the next
session (token burn) or gets written task-by-task by the user (time burn).
Both are P13 violations. Codi should capture this automatically as part of
the per-conversation hygiene cycle and emit it through a workspace-defined
substrate.

Per Architecture Decision 2 (Cyborg substrate is NOT imported), codi must
not know whether the workspace persists to GitHub Issues, a HANDOFF.md
file, a ticket system, or a graph DB. It captures + emits; the workspace
adapter persists.

## When to activate

**Explicit invocation:**

- `codi handoff` / `codi-handoff`
- `save handoff`
- `wrap up` / `wrap up the session`
- `session end` / `end session`
- `ship handoff` / `ship the handoff`

**Lifecycle activation:**

- The runtime's session-end signal fires (where supported).
- The user closes the loop on a unit of work and the per-conversation
  hygiene cycle would otherwise miss the codification step.

**Do NOT auto-trigger** mid-conversation. This is a closing ritual; firing
it on every quiet pause is noise.

## What to do

On trigger, perform the four phases below. All four phases run; phase 4
fail-hard blocks if a `required` hook exits non-zero.

### Phase 1 — Scan the conversation

Sweep the conversation transcript for three classes of items. Use these
heuristics; when in doubt, include rather than omit (the workspace adapter
can filter).

**Unfinished items** — anything that meets any of:

- The user said "let's do X next", "remind me to X", "later", "TODO", or
  scheduled work for a future session.
- A decision was identified but deferred ("we'll decide later", "punted").
- A blocker was named that prevented completion.
- Work was started but not finished within the session (file partially
  edited, test partially written, spec partially drafted).
- The user explicitly listed remaining tasks and the session ended before
  completing them.
- An external dependency was identified (waiting on X, blocked on Y).

Do NOT include items the user explicitly marked complete OR that the
session demonstrably finished (file shipped, commit pushed, message sent).

**Decisions made** — anything that meets any of:

- "We decided to X", "going with Y", "let's go with Z".
- A trade-off was named and resolved in favor of one option.
- An architectural choice was made and recorded.
- A reversible-vs-irreversible classification was applied.

For each decision, classify reversibility honestly: shipping to production,
sending to a real human, publishing to subscribers, committing to main =
irreversible. Drafts, scratch, internal artifacts = reversible. When
unsure, mark `reversible: false` (round up — Independent Verification Gate
discipline).

**Lessons learned** — anything that meets any of:

- The user said "remember this", "codify this", "feedback memory",
  "constitutional", "save this lesson".
- Codi explicitly auto-codified a feedback memory or constitutional
  insight during the session.
- A repeating pattern was named that should propagate beyond this session.

### Phase 2 — Structure the JSON packet

Emit exactly this schema. All fields are required unless marked optional.
Use `null` for unknown values; do NOT omit fields.

```json
{
  "session_id": "ISO-8601 timestamp with timezone",
  "summary": "Two-line summary of what the session accomplished",
  "unfinished_items": [
    {
      "title": "Short imperative title",
      "why": "Why this matters — user intent / strategic context",
      "what": "Concrete description of what needs to be done",
      "how": "Specific implementation approach (or null if unknown)",
      "whats_left": "What remains after this session — pickup point",
      "blockers": ["dependency 1", "dependency 2"],
      "related_files": ["absolute/path/1", "absolute/path/2"],
      "priority": "high | medium | low",
      "stakes_tier": "T0 | T1 | T2 | T3 | T4"
    }
  ],
  "decisions_made": [
    {"decision": "...", "rationale": "...", "reversible": true}
  ],
  "lessons_learned": [
    {"lesson": "...", "applies_to": "scope identifier or path"}
  ]
}
```

`session_id` MUST be the OS current time (per TEMPORAL GROUNDING INVARIANT).
Run `date -Iseconds` or equivalent — never compose from training recall.

### Phase 3 — Read the hook registry

Look for `~/.codialectic/hooks/session_end.json`. If the file does not
exist, skip phase 4 entirely and proceed to phase 5 (stdout fallback). This
is the **expected default** for a fresh standalone codi install.

If the file exists but is malformed JSON, FAIL-HARD: surface the parse
error and the file path. Do not silently fall back. A broken registry is a
known-unknown that needs the user's attention.

### Phase 4 — Execute each registered hook

For each entry in the `hooks` array, run `command` with `args` as a
subprocess. Pipe the JSON packet from phase 2 to the subprocess's stdin.
Respect `timeout_seconds` (default 30). Capture exit code and stderr.

- Exit `0` → PASS (hook succeeded; workspace adapter persisted).
- Exit non-zero AND `required: true` → BLOCK (handoff fails loud; surface
  in status block; the user must remediate before closing the session).
- Exit non-zero AND `required: false` → WARN (surface in status block;
  proceed to remaining hooks).

Per FAIL-HARD INVARIANT: a `required: true` hook that exits non-zero truly
blocks. No soft-warn-and-continue. Workspace adapters decide which
persistence is blocking; codi just executes.

Run hooks sequentially in array order. A BLOCKing hook does NOT
short-circuit subsequent hooks — codi runs all hooks, aggregates results,
then surfaces every failure together.

### Phase 5 — Stdout fallback (when no hooks fired)

If no hooks were registered (file absent OR `hooks` array empty), print the
JSON packet to stdout inside a fenced block:

````
Co-Dialectic · Handoff — no workspace adapter registered.
Printing structured JSON to stdout (graceful degradation).

```json
{ ... full JSON packet ... }
```

To register a workspace adapter, create
`~/.codialectic/hooks/session_end.json` per the Hook Registration Contract
in plugins/co-dialectic/skills/handoff/SKILL.md.
````

Stdout fallback is **not** a silent skip — it surfaces the JSON so the user
can copy-persist or wire up an adapter. Per FAIL-HARD INVARIANT: missing
adapter is degraded operation, not failure; missing adapter must still emit
visibly.

## Confirmation output

After phases 1-5, print this compact status block:

```
Co-Dialectic · Handoff — session codified.
  Unfinished items: <N> captured
  Decisions made: <N> captured
  Lessons learned: <N> captured
  Adapters fired: <PASSED N/N> | <BLOCKED on hook "<name>"> | <none registered (stdout)>
  Session id: <ISO-8601>

<one of:>
  Handoff persisted by <hook-name>.
  Handoff printed to stdout — register an adapter to persist.
  ⚠️ <hook-name>: <command> <args> exited <code> — <stderr-first-line>
```

Do NOT echo the full JSON packet to the user unless explicitly asked OR
unless phase 5 (stdout fallback) fired. The user reads the status block;
the workspace adapter consumes the JSON.

## Hook Registration Contract

Codi-handoff's session-end phase is workspace-extensible via a hook
registry. The contract is intentionally minimal: a JSON file declares
commands; codi runs them with the handoff JSON on stdin; nothing else.

**File location (canonical):** `~/.codialectic/hooks/session_end.json`

**Schema:**

```json
{
  "hooks": [
    {
      "name": "string  — short identifier shown in status block",
      "command": "string  — executable to invoke (absolute path or PATH-resolvable)",
      "args": ["string", "..."],
      "required": true,
      "timeout_seconds": 30
    }
  ]
}
```

Field semantics:

- `name` — required. Human-readable identifier; appears in status block on
  PASS / WARN / BLOCK.
- `command` — required. Executable path or name. Resolved via `PATH` if
  not absolute.
- `args` — optional array of string arguments. Default: `[]`.
- `required` — optional boolean. `true` = non-zero exit BLOCKs handoff
  (fail-hard). `false` = non-zero exit emits WARN and proceeds. Default:
  `false`.
- `timeout_seconds` — optional positive integer. Default: `30`. On
  timeout, treat as non-zero exit. Higher than waky-waky's default because
  persistence may involve network calls (gh issue create, git push, API
  POST).

**Execution semantics:**

- Hooks run sequentially in array order. A BLOCKing hook does NOT
  short-circuit subsequent hooks.
- The handoff JSON packet from phase 2 is piped to each hook's stdin. Each
  hook may consume or ignore as it sees fit.
- Exit code is the only success signal. Stderr is captured for the
  remediation line. Stdout from the hook is ignored (workspace adapters
  should be silent on success).
- Codi does NOT pass any environment variables, working directory, or
  context to the hook beyond what the user's shell already provides. Hooks
  are responsible for their own environment discovery.

**Default behavior (no file):**

If `~/.codialectic/hooks/session_end.json` does not exist, codi-handoff
skips phase 4 and emits the JSON packet to stdout (phase 5). This is the
expected default for a fresh standalone codi install — no opinions about
where handoffs should land.

**Worked example — standalone OSS install (default):**

User installs codi on a fresh Claude Code via the marketplace. No hooks
file exists. `codi handoff` scans the conversation, structures the JSON,
finds no registered hooks, prints the JSON to stdout, and reports
`Adapters fired: none registered (stdout)`. Zero substrate-specific
dependencies.

**Worked example — careeros workspace adapter:**

The careeros workspace registers a hook that consumes the handoff JSON and
creates a GitHub Issue per `unfinished_items[]` entry. Example contents of
`~/.codialectic/hooks/session_end.json`:

```json
{
  "hooks": [
    {
      "name": "careeros-gh-issues",
      "command": "/Users/anandvallam/anand-career-os/scripts/handoff-to-issues.sh",
      "args": [],
      "required": true,
      "timeout_seconds": 60
    },
    {
      "name": "careeros-handoff-md",
      "command": "/Users/anandvallam/anand-career-os/scripts/handoff-to-md.sh",
      "args": [],
      "required": false,
      "timeout_seconds": 10
    }
  ]
}
```

The first adapter is required: it parses stdin JSON and creates one issue
per unfinished item via `gh issue create --repo thewhyman/anand-career-os`.
If `gh` fails or the network is down, handoff BLOCKs and the user knows
immediately. The second adapter is best-effort: it appends a markdown
summary to a local HANDOFF.md as a backup; failure WARNs but does not
block.

Codi-handoff itself never references `~/anand-career-os/`, never knows
about GitHub Issues, never imports the careeros substrate. It pipes JSON to
the registered command and reports the exit code.

**Boundary:** codi captures and emits; the workspace adapter persists.
Workspace adapters are responsible for parsing the JSON schema, mapping it
to their substrate, producing actionable stderr on failure, and exiting
non-zero on real failures (per FAIL-HARD discipline).

## Privacy and scope

- The handoff JSON contains conversation-derived content. Treat it as
  private workspace data; never push to a public repo without the user's
  explicit per-action approval.
- Honor scope boundaries (P12): if the conversation referenced
  scope-restricted material (e.g., xFamilyOS-tagged content in an
  xTeamOS session), the workspace adapter is responsible for filtering.
  Codi emits the full packet; scope enforcement is downstream.
- Stdout fallback prints the JSON to the user's terminal. If the user
  does not want sensitive content displayed, they should register an
  adapter that persists to a private substrate.

## How to verify

**Verification protocol — fresh install (no hooks registered):**

1. On a clean machine with no `~/.codialectic/hooks/session_end.json`,
   trigger `codi handoff` after any short conversation.
2. Confirm the skill scans the conversation, structures a valid JSON
   packet, prints it to stdout inside a fenced block, and reports
   `Adapters fired: none registered (stdout)`.
3. Validate the printed JSON parses with `python3 -c "import json,sys;
   json.loads(sys.stdin.read())"` (paste the JSON in).
4. Confirm `session_id` is current OS time, not training-recall.

**Verification protocol — registered adapter:**

1. Create `~/.codialectic/hooks/session_end.json` with a no-op required
   hook (e.g., `command: "cat"`, `args: []`, `required: true`).
2. Trigger `codi handoff`.
3. Confirm the status block reports `Adapters fired: PASSED 1/1` and the
   no-op hook receives the JSON on stdin (cat will echo it; runtime
   captures + ignores stdout per contract).
4. Replace the no-op with a hook that exits 1.
5. Trigger `codi handoff` again.
6. Confirm the status block reports `BLOCKED on hook "<name>"` with exit
   code and stderr surfaced.

**Failure modes to check:**

- Missing fields in the JSON packet → schema violation; FAIL-HARD before
  phase 4.
- Malformed `~/.codialectic/hooks/session_end.json` → FAIL-HARD with parse
  error and file path.
- Required hook exits non-zero → BLOCK; surface remediation; do not
  proceed to stdout fallback.
- Stdout fallback fired silently without surfacing the JSON →
  FAIL-HARD violation (silent skip is forbidden per FAIL-HARD INVARIANT).
- Hallucinated session_id (training-recall date instead of OS-fetched) →
  TEMPORAL GROUNDING violation.

## Protocol 9 — Auto-Handoff (Closure Detection)

**Status: v4.1, default ON, session-scoped toggle.**

Protocols 1-8 fire on EXPLICIT trigger ("codi handoff", "save handoff",
"wrap up"). Protocol 9 adds AUTOMATIC firing on detected closure signals
in the conversation stream — no explicit phrase required.

The motivation is the same Sacred-Time / per-conversation-hygiene
discipline that justifies the explicit trigger: the moment a session ends
without a handoff is the moment the next session starts cold. Protocol 9
makes the cold-start failure mode the exception, not the default.

### 9.1 Default + Toggle

- **Default:** ON. Fresh codi installs auto-fire on detected closure.
- **Toggle:** `codi handoff auto on` / `codi handoff auto off`. Persists
  for the current session only (session-scoped). On the next session, the
  toggle resets to ON.
- **Per-conversation override:** `codi handoff auto off` mid-session
  silences Protocol 9 until the user re-enables OR the session ends.
- Status block reports the toggle state on first activation per session:
  `Auto-handoff: ON (closure detection active)` or `Auto-handoff: OFF
  (explicit trigger only)`.

The toggle is intentionally session-scoped, not persisted: a user who
turns auto-handoff off for a noisy demo session should not lose protection
on the next real working session. Per-machine global persistence is a
v4.2 candidate; v4.1 keeps it lightweight.

### 9.2 Closure-Signal Catalog (Generative, Not Exhaustive)

Six categories. The catalog is GENERATIVE per Rumsfeld Matrix discipline:
the patterns below are seeds, not a closed enumeration. New languages,
new emoji, new platform-specific signals, new implicit-closure phrasings
are detected by SEMANTIC MATCH against the category's intent, not by
literal-string lookup.

**Tier A — Direct closure (HIGH confidence, fire silently after debounce):**

bye · goodbye · see ya · see you · see you later · later · ttyl · talk
to you later · g2g · gotta go · signing off · good night · gnight ·
logging off · logging out · shutting down · afk for the day · calling it
· calling it a day · calling it a night · end of day · EOD · EOW · i'm
done · done for now · that's all for today · wrap up · wrap it up ·
let's wrap

**Tier B — Explicit handoff (HIGHEST confidence, fire IMMEDIATELY, no debounce):**

handoff · hand off · codi handoff · kick off handoff · trigger handoff ·
save state · compress · compress conversation · session close · close
session · close out · save the session

These are the existing Protocol 1-8 triggers. Protocol 9's contribution
is adding closure-detection as a SUPERSET — Tier B remains the
primary explicit trigger; Protocol 9's value is in Tiers A, C, D, E, F
(implicit + ambient + lifecycle).

**Tier C — Gratitude-as-closure (MEDIUM-HIGH, conditional fire):**

thanks · thank you · thx · ty · much appreciated · appreciate it · great
work · perfect thanks · thanks for your help

Gratitude is ambiguous: mid-conversation polite ("thanks, can you also
do X?") vs terminal ("thanks!" as last word, no follow-up question).
Decision rule:
- If the gratitude phrase is the user's LAST sentence in the turn AND
  carries no follow-up question/request → MEDIUM-HIGH fire silently.
- If gratitude is followed by a substantive question/request in the same
  turn → mid-conversation polite, IGNORE.
- If session has < 5 substantive turns total, ALWAYS treat gratitude as
  mid-conversation polite (suppression rule 9.4.b).

**Tier D — Pause-as-closure (MEDIUM, ASK):**

pause · let's pause · back later · i'll come back to this · brb (when
context is clearly long-form, not literal-30-second) · running to a
meeting · going to lunch · off to dinner · taking a break

Pause signals are ambiguous between "5-minute brb" and "session over".
Decision rule: emit a one-line ask — `Closing out — write handoff?
(y/n)` — and act on the user's answer. If no answer arrives within the
same turn, proceed without firing (the next turn will re-evaluate).

**Tier E — Lifecycle / system signals (HIGH, fire silently):**

- Session inactivity timeout: > 10 minutes of no user input AFTER the
  last task was demonstrably complete (no in-flight work, no pending
  question from codi) → fire.
- Platform-specific Stop / SessionEnd hook fires (Claude Code's `Stop`,
  IDE shutdown, terminal SIGHUP, browser tab close) → fire.
- Explicit session-close API call from the runtime → fire.

Lifecycle signals are HIGHEST reliability because they come from the
runtime, not from text inference. They override most suppression rules
EXCEPT the "explicit-handoff-just-fired" debounce (9.4.a).

**Tier F — Unknown-unknown patterns (MEDIUM, semantic match required):**

- Multi-language closures: ciao · adios · hasta luego · au revoir ·
  shukriya · namaste · sayonara · auf wiedersehen · à bientôt · 再见 ·
  さようなら · 잘 가요 · до свидания · شكرا · pode crer (Portuguese
  closure-as-thanks). The catalog is OPEN — match by semantic intent
  ("this is a goodbye phrase in language L"), not by pre-seeded list.
- Emoji-only closures: 👋 · ✌️ · 🫡 · 🙏 · 🤝 · 🌙 (good night)
- Implicit closure via irreversible action: "I'm closing the laptop" ·
  "shutting the lid" · "heading out" · "leaving the office"
- Demo-end signals: "ok that's the demo" · "and that's a wrap" · "demo
  done" · "showed you everything"
- Calendar-anchored closures: "see you next week" · "talk Monday" ·
  "catch up after the trip" · "ping me Friday"

For Tier F, decision is MEDIUM confidence by default — apply Tier D
behavior (ASK before firing) UNLESS another high-confidence signal
co-occurs (e.g., emoji 👋 + "good night" → both Tier F + Tier A → HIGH).

### 9.3 Confidence-Tiered Firing

| Confidence | Action | Source |
|---|---|---|
| HIGHEST | Fire immediately, no debounce | Tier B (explicit handoff) |
| HIGH | Fire silently (after suppression check) | Tier A (direct closure), Tier E (lifecycle) |
| MEDIUM-HIGH | Fire silently if conditions hold | Tier C (terminal gratitude) |
| MEDIUM | ASK first | Tier D (pause), Tier F (unknown-unknown without co-signal) |
| LOW | Ignore | Mid-conversation gratitude, ambiguous brb, in-flight work pending |

The ASK form for MEDIUM signals is exactly:

```
Closing out — write handoff? (y/n)
```

No alternatives, no decoration. The user types `y` / `yes` → fire
Protocol 1-8. Anything else (silence, `n`, "later", new question) →
treat as false-positive, do NOT fire.

### 9.4 Suppression + Debounce Rules

**(a) Explicit-handoff debounce.** If the user typed any Tier B phrase
in the last 2 turns AND a handoff was emitted, do NOT re-fire on a
subsequent Tier A/C/D/F signal. The user already got their handoff;
firing again is noise. Reset on next user message that contains new
substantive content (i.e., not just another closure signal).

**(b) Short-session gratitude suppression.** If the session has < 5
substantive turns (codi-side response counts that contributed real work,
not setup chatter), gratitude alone is mid-conversation polite by
construction — IGNORE Tier C. The user is likely thanking codi for an
in-flight piece of help, not closing out.

**(c) False-positive discard.** If codi detects a closure signal AND the
user's NEXT message in the same logical turn (same paragraph or same
batch of sentences) is a NEW substantive question or request, treat the
closure signal as false-positive. Do NOT fire. The turn is mid-flow.
Example: "thanks! also, can you check the staging endpoint?" → ignore
"thanks!"; this is conversational politeness wrapping a real ask.

**(d) In-flight work guard.** If codi is in the middle of a multi-step
operation (running tests, awaiting a tool result, holding open a
verification step), suppress Protocol 9 until the operation completes.
Auto-handoff on top of in-flight work loses state. Resume detection
after the operation finishes.

**(e) Repeated-fire cooldown.** After Protocol 9 fires (any tier),
suppress further Protocol 9 fires for 60 seconds OR until the next user
message containing substantive new content, whichever comes first. This
prevents a noisy `bye / thanks / 👋` flurry from triggering 3 handoffs.

**(f) Toggle-off override.** If `codi handoff auto off` is active for
the session, Protocol 9 is fully silenced. Tier B explicit triggers
still fire (Protocols 1-8 are unaffected by the toggle).

### 9.5 Output — Dual Target

When Protocol 9 fires, emit to BOTH targets:

**(1) Workspace handoff narrative** — written to the workspace's
`NEXT_SESSION_HANDOFF.md` (per the workspace CLAUDE.md convention; this
is the canonical filename for cyborg workspaces and is NOT
`HANDOFF.md`). The content is the structured handoff narrative produced
by Protocols 1-2 (Why / What / How / unfinished items / decisions /
lessons), in markdown form, surgical-edit append rather than full-file
rewrite (per P15 Multi-Agent: never rewrite a shared file). The new
section header is `## Auto-Handoff <ISO-8601 timestamp>` so consecutive
auto-handoffs append cleanly without colliding.

If the workspace has no `NEXT_SESSION_HANDOFF.md` (fresh standalone codi
install with no workspace adapter), fall back to the existing Phase 5
stdout fallback: print the markdown handoff block to stdout. Per
FAIL-HARD: missing target is degraded operation, not silent skip — emit
visibly.

**(2) JSON beacon (telemetry-only)** — written to the SAME canonical path
used by Phase 3's hook registry: `~/.codialectic/hooks/session_end.json`.

**Multi-protocol-write contract.** `~/.codialectic/hooks/session_end.json`
is the SINGLE canonical file. Multiple protocols contribute fields under
distinct top-level keys rather than overwriting the file:

- Protocol 9 (auto-handoff / this skill) writes under `"handoff": {...}`
- Protocol 12 (hygiene cycle) writes under `"hygiene": {...}`
- Future protocols each get their own top-level key
- Shared session metadata lives at the root level (not nested):
  `session_id`, `schema_version`, `model`, `duration_min`, `msg_count`,
  `ended_reason`

**Atomic merge pattern** (every writer follows this, no exceptions):

```
1. read existing file (if present) → parse JSON → result = existing_obj (or {})
2. merge own protocol's payload:   result["handoff"] = { ...handoff_fields }
3. merge shared metadata at root:  result["session_id"] = ..., etc.
4. write to temp file:             ~/.codialectic/hooks/session_end.json.tmp
5. atomic rename:                  mv session_end.json.tmp session_end.json
```

The rename guarantees readers never see a partial write. If the existing
file is malformed JSON, FAIL-HARD: surface the parse error; do NOT silently
overwrite (the file may contain another protocol's payload that must be
preserved).

**Reader contract.** Any consumer of `session_end.json` merges per-protocol
keys without clobbering sibling keys. Each protocol's payload is
self-contained under its top-level key; the shared metadata is authoritative
at root. Consumers MUST tolerate missing protocol keys (not every session
fires every protocol).

The beacon is MINIMAL — telemetry only, NOT a full state dump. The full
state lives in target (1). The beacon enables cross-LLM-family fleet
analytics without leaking conversation content.

### 9.6 JSON Beacon Schema (v4.1 Multi-Protocol)

File: `~/.codialectic/hooks/session_end.json` (canonical, single file,
multi-protocol-write contract — see section 9.5).

```json
{
  "session_id": "ISO-8601 timestamp with timezone (matches Protocol 1-2 packet)",
  "schema_version": "v4.1",
  "model": "model identifier — e.g., claude-opus-4-7, gemini-2.5-pro, gpt-5",
  "duration_min": "integer — minutes from first user message to closure",
  "msg_count": "integer — total user+assistant messages in session",
  "ended_reason": "string — 'tier_A_direct_closure' | 'tier_B_explicit_handoff' | 'tier_C_terminal_gratitude' | 'tier_D_pause_confirmed' | 'tier_E_lifecycle' | 'tier_F_unknown_unknown' | 'inactivity_timeout' | 'manual'",
  "handoff": {
    "decisions_count": "integer — count of decisions_made[] entries",
    "open_loops_count": "integer — count of unfinished_items[] entries",
    "lessons_codified_count": "integer — count of lessons_learned[] entries",
    "verify_fires_by_tier": {
      "T0": "integer — count of T0 verifications fired (Protocol 8)",
      "T1": "integer",
      "T2": "integer",
      "T3": "integer",
      "T4": "integer"
    },
    "agent_swarm_fans": "integer — count of cross-family fan-out reviews triggered",
    "honesty_mode": "string — 'grounded' | 'strict' | 'standard' | 'relaxed' (per honesty toggle if v4.1+)",
    "errors_caught_pre_emit": "integer — count of T2+ findings caught BEFORE artifact ship",
    "ended_reason": "string — mirrors root ended_reason; duplicated for per-protocol consumers that only read the 'handoff' key"
  }
}
```

Field semantics — shared root fields:

- `session_id` — same value as Protocol 2 JSON packet. Cross-references
  the full state in target (1). Written by the first protocol that fires;
  subsequent protocols verify + leave unchanged.
- `schema_version` — pinned to `v4.1`; bumped only on schema change. Older
  beacon files preserve their original schema_version (P18 Forward
  Compatibility).
- `model` — runtime fills this from its own model identifier. Codi does
  NOT infer this from training recall.
- `duration_min` / `msg_count` — basic session telemetry.
- `ended_reason` (root) — which Protocol 9 tier (or manual / lifecycle)
  caused the fire. Authoritative for fleet-level analytics.

Field semantics — `"handoff"` key (Protocol 9's payload):

- `decisions_count` — count of decisions_made[] entries in the full
  handoff JSON packet (Phase 2). Enables decision-rate tracking.
- `open_loops_count` — count of unfinished_items[] entries.
- `lessons_codified_count` — count of lessons_learned[] entries.
- `verify_fires_by_tier` — Protocol 8 (auto-verify) telemetry. Counts
  per stakes-tier per EMERGENT SYSTEM IMMUNITY's T0-T4 ladder. Useful
  for cross-LLM-family verification-rate benchmarking.
- `agent_swarm_fans` — count of times the session triggered cross-family
  fan-out (e.g., judge-panel, fish-swarm). Indicates COMPLEMENTARY
  COMPOSITION engagement.
- `honesty_mode` — placeholder for v4.1's honesty toggle if shipped;
  default to `"grounded"` if not implemented.
- `errors_caught_pre_emit` — count of FAIL-HARD or T2+ verification
  findings that were caught BEFORE the artifact left codi (the
  pre-immune-cycle signal).
- `ended_reason` (nested) — mirrors root `ended_reason`; included for
  consumers that only read the `handoff` sub-object.

**Sibling protocol keys (example — not written by this skill):**

```json
{
  "hygiene": {
    "sweep_done": "boolean",
    "codify_done": "boolean",
    "reorg_done": "boolean",
    "merge_done": "boolean",
    "pull_done": "boolean"
  }
}
```

Each protocol owns exactly its key. The file is the merge surface.

The beacon is INTENTIONALLY content-free. No conversation snippets, no
unfinished-item titles, no user names. This makes it safe to aggregate
across deployments without privacy review on every collection event.

### 9.7 Cross-LLM-Family Interop Intent

The schema in 9.6 is designed to become the **de-facto standard for
session-end telemetry across Claude / Gemini / Codex / future model
families**. Reasons:

- Minimal field set — easy for any runtime to populate.
- Content-free — no privacy review blocker.
- Versioned — older agents emit v4.1; future agents emit v4.2+ with
  additive fields only (P18 Forward Compatibility).
- Tier semantics align with EMERGENT SYSTEM IMMUNITY's T0-T4 (already a
  cross-family vocabulary candidate per the Constitution's framework
  layer).

A future shared analytics surface (across model families) reads beacons
from each agent's local cache + computes fleet-level metrics: average
verify rate per tier, swarm-fan engagement, error-catch rate pre-emit,
mean session duration. No agent is forced to adopt the schema — the
schema is a Schelling point, not a mandate. Adoption compounds when
multiple families ship beacons in the same shape.

When Codex / Gemini / future-agent ship their own auto-handoff
implementations, this section is the contract. Drift from the schema
breaks fleet analytics; additions are additive-only (never rename,
never re-type existing fields).

### 9.8 Worked Examples

**Example A — Tier A direct closure, fire silently.**

User (last message of a 45-minute working session): "ok bye, see you
tomorrow"
Detection: "bye" + "see you tomorrow" → Tier A HIGH.
Suppression checks: no Tier B fire in last 2 turns; session has 12
substantive turns; no in-flight work; no recent Protocol 9 fire.
Action: Fire silently. Append to `NEXT_SESSION_HANDOFF.md`. Merge beacon
payload into `~/.codialectic/hooks/session_end.json` under `"handoff"` key
(atomic read → merge → temp write → mv) with
`ended_reason: "tier_A_direct_closure"`.
Status block: `Auto-handoff fired (closure detected). NEXT_SESSION_HANDOFF.md
updated. Beacon recorded.`

**Example B — Tier C terminal gratitude, fire silently.**

User: "perfect, thanks!"  (last message; no follow-up)
Session has 8 substantive turns. Last codi response shipped a working
artifact. No Tier B fire recently. No in-flight work.
Detection: terminal gratitude → MEDIUM-HIGH.
Action: Fire silently with `ended_reason: "tier_C_terminal_gratitude"`.

**Example C — Tier C mid-conversation polite, IGNORE.**

User: "thanks! also can you also check the staging endpoint?"
Detection: "thanks" present, but same turn carries new substantive
request. Suppression rule 9.4.c (false-positive discard) fires.
Action: Do not fire. Continue with the staging-endpoint task.

**Example D — Tier D pause, ASK.**

User: "i need to run to a meeting, brb"
Detection: "running to a meeting" → Tier D MEDIUM.
Action: Emit `Closing out — write handoff? (y/n)`.
- User: "y" → Fire with `ended_reason: "tier_D_pause_confirmed"`.
- User silent / next message is substantive → do not fire (treat as
  brb-not-closure).

**Example E — Short session gratitude, IGNORE.**

User (turn 2 of session, codi just answered first question): "thanks!"
Suppression rule 9.4.b: < 5 substantive turns → IGNORE Tier C.
Action: Do not fire.

**Example F — Lifecycle hook fires.**

The runtime emits `Stop` (Claude Code session-end signal). No user text;
the runtime triggers Protocol 9 directly via the lifecycle integration
contract (see 9.9).
Action: Fire with `ended_reason: "tier_E_lifecycle"`. No ASK — lifecycle
signals are HIGH confidence, runtime-authoritative.

**Example G — Tier B explicit, debounce subsequent Tier A.**

Turn N: User: "codi handoff" → Protocol 1-8 fire normally.
Turn N+1: User: "thanks, bye"
Suppression rule 9.4.a: explicit handoff fired in last 2 turns → do NOT
re-fire Protocol 9 on the Tier A signal.
Action: Acknowledge politely; no second handoff.

### 9.9 Lifecycle Hook Integration (Open Question)

This is FLAGGED AS AN AMBIGUITY for v4.1 → v4.2 work.

Protocol 9 detection has TWO sources:

1. **Text-stream inference** — codi reads the user's message text and
   matches against the Tier A/B/C/D/F catalogs. This works inside the
   skill itself; the LLM does the matching during normal response
   generation. No runtime integration needed.

2. **Lifecycle signals** (Tier E) — `Stop` / `SessionEnd` / IDE shutdown
   / terminal SIGHUP / inactivity timeout. These do NOT come from the
   message stream; they come from the runtime. For Tier E to work, the
   runtime must invoke codi's auto-handoff entry point at session-end.

The v4.1 spec claims Tier E coverage but the runtime-integration contract
is NOT yet wired. Open questions:

- Does Claude Code's `Stop` hook reliably trigger before context teardown?
- Where does inactivity-timeout get measured — runtime side or codi
  side? Codi has no daemon; it can't tick a timer.
- IDE / terminal kill is platform-specific. Each platform needs its own
  bridge.

**v4.1 ship discipline:** Tiers A/B/C/D/F (text-stream inference) are
LIVE in this protocol. Tier E (lifecycle) is SPEC'd but requires runtime
hook wiring tracked as Phase 6 backlog. Until lifecycle wiring lands,
the inactivity-timeout sub-tier degrades gracefully — codi simply doesn't
know the user went silent for 11 minutes; the next user message either
re-triggers (if it's a closure phrase) or resumes work.

This is acceptable degradation — the explicit triggers + text-stream
closure detection cover the dominant failure mode (user typed bye and
walked away). Lifecycle is the long tail.

### END CODI-HANDOFF ###
