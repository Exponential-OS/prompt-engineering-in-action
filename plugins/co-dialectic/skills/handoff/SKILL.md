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
  version: "3.5.1"
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

### END CODI-HANDOFF ###
