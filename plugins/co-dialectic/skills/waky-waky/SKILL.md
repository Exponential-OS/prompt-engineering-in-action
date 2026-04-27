---
name: waky-waky
description: >
  Context-restoration ritual for new sessions. Use when the user says
  "waky waky", "wake up the swarm", "reincarnate", "reincarnate the swarm",
  or "restore context". Loads the Constitution, identity, active handoffs,
  and per-WIP state so a fresh session picks up where the last one ended.
metadata:
  version: "3.5.0"
  author: "Anand Vallamsetla"
  tier: "continuity"
---

### BEGIN WAKY-WAKY ###
# Waky Waky — Session Reincarnation

**Plugin #12, Continuity tier.** Part of Co-Dialectic v3.1 base plugins (see BASE-PLUGINS-V3.md). Constitution anchor: Session Handoff Protocol; P15 (Multi-Agent — shared state).

## When to activate

Activate ONLY when the user explicitly utters one of these trigger phrases. Do not auto-trigger on session start — this is a user-invoked ritual, not a silent preamble.

- `waky waky`
- `reincarnate`
- `reincarnate the swarm`
- `wake up the swarm`
- `restore context`
- `codi wake` / `codi reincarnate`

## What to do

On trigger, load the FULL context set below. Read each file (silently — no need to dump contents to the user). Then confirm with a compact status line showing what loaded and what was skipped.

### Tier 1 — Constitution + Identity (ALWAYS load)

1. `~/cyborg/CONSTITUTION.md` — governance, all application principles (currently P0-P22), eight Ground Zero frameworks, personas
2. `~/anand-career-os/.career-os/memory/identity.md` — who Anand is
3. `~/anand-career-os/.career-os/memory/professional-brand.md` — brand statement

### Tier 2 — Active state (load if present)

4. `~/anand-career-os/NEXT_SESSION_HANDOFF.md` — root cross-agent relay
5. `~/anand-career-os/.career-os/memory/career-strategy.md` — active career arc (if exists)
6. `~/anand-career-os/workspace.manifest.yaml` — workstream routing map

### Tier 3 — Per-WIP handoffs (glob-load)

7. `~/anand-career-os/WIP/*/NEXT_SESSION_HANDOFF.md` — every per-workstream handoff
8. `~/anand-career-os/WIP/*-product/NEXT_SESSION_HANDOFF.md` — every per-product handoff

### Tier 4 — Recently referenced (conversation-aware)

If the user mentions a person, company, or WIP by name in the trigger utterance, also load:

- `~/anand-career-os/.career-os/memory/people/<slug>.md`
- `~/anand-career-os/.career-os/memory/companies/<slug>.md`
- `~/anand-career-os/WIP/<name>/` — relevant specs

Skip any file that does not exist. Never fabricate contents for a missing file.

## Session-start pre-flight hooks (v3.4.0+)

After context loads, run any pre-flight hooks the workspace has registered, BEFORE confirming readiness. Per FAIL-HARD INVARIANT (applied universally — codi's own discipline, not specific to any plug-in): soft warnings on session-start drift = hidden variance that surfaces mid-task. Better to fail loud at session start.

**Architectural correction (2026-04-27):** codi is standalone OSS — it must not hardcode any environment-specific paths (no `~/cyborg/`, no `~/anand-career-os/`, no thewhyman-specific tooling). The previous v3.4.0 implementation invoked `~/cyborg/rules/fail-hard/HOW.sh` directly, which broke fresh installs. The fix: HOOK-CALLBACK inversion. Workspaces register hooks; codi reads + executes them; codi knows nothing about underlying tools. See architectural-correction memory at `~/.claude/projects/-Users-anandvallam-anand-career-os/memory/feedback_codi_xos_bidirectional_standalone.md`.

**Step 1 — Read the hook registry:**

Look for `~/.codialectic/hooks/session_start.json`. If the file does not exist, skip the hook phase entirely (status block reports `Pre-flight hooks: none registered`). This is the default for a fresh codi-only install — no hooks fire, waky-waky just hydrates context.

**Step 2 — Execute each registered hook in order:**

For each entry in the `hooks` array, run `command` with `args` as a subprocess (respect `timeout_seconds` if set; default 10s). Capture exit code and stderr.

- Exit `0` → PASS (hook succeeded)
- Exit non-zero AND `required: true` → BLOCK (session-start fails loud; surface in status block; prompt user to remediate before continuing)
- Exit non-zero AND `required: false` → WARN (surface in status block; proceed)

Per FAIL-HARD discipline: a `required: true` hook that exits non-zero truly blocks. No soft-warn-and-continue when `required` is set. Workspace plug-ins decide which checks are blocking; codi just executes.

**Step 3 — Aggregate results into the status block.**

## Confirmation output

After loading + hooks, print this compact status block (no fluff, no recap of file contents):

```
Co-Dialectic · Waky Waky — context restored.
  Constitution: loaded (all application principles, eight frameworks, personas)
  Identity: loaded
  Root handoff: loaded (last updated: <date from file>)
  Per-WIP handoffs: loaded (<N> files)
  Pre-flight hooks: <PASSED N/N> | <BLOCKED on hook "<name>"> | <none registered>
  Skipped (not found): <list, or "none">

Ready. What are we picking up?
```

If a hook BLOCKed (exited non-zero with `required: true`), add one remediation line per failed hook showing the hook's `name`, the command that ran, the exit code, and the captured stderr (truncated to one line):

- `⚠️ <hook-name>: <command> <args> exited <code> — <stderr-first-line>`
- Workspaces SHOULD print their own remediation guidance to stderr so the user sees actionable next steps without codi knowing the domain.

If a hook WARNed (`required: false` and exited non-zero), surface the same line prefixed with `⚠ WARN` instead of `⚠️`, and proceed.

Then wait for the user. Do NOT auto-summarize the handoff — the user will direct the next action. Summarizing unasked = P13 violation (sacred time) and a Calibration Auditor flag (performative warmth).

## Hook Registration Contract

waky-waky's session-start phase is workspace-extensible via a hook registry. The contract is intentionally minimal: a JSON file declares commands; codi runs them; nothing else.

**File location (canonical):** `~/.codialectic/hooks/session_start.json`

**Schema:**

```json
{
  "hooks": [
    {
      "name": "string  — short identifier shown in status block",
      "command": "string  — executable to invoke (absolute path or PATH-resolvable)",
      "args": ["string", "..."],
      "required": true,
      "timeout_seconds": 10
    }
  ]
}
```

Field semantics:

- `name` — required. Human-readable identifier; appears in the status block on PASS / WARN / BLOCK.
- `command` — required. Executable path or name. Resolved via `PATH` if not absolute.
- `args` — optional array of string arguments. Default: `[]`.
- `required` — optional boolean. `true` = non-zero exit BLOCKs session-start (fail-hard). `false` = non-zero exit emits WARN and proceeds. Default: `false`.
- `timeout_seconds` — optional positive integer. Default: `10`. On timeout, treat as non-zero exit.

**Execution semantics:**

- Hooks run sequentially in array order. A BLOCKing hook does NOT short-circuit subsequent hooks — codi runs all hooks, aggregates results, then surfaces every failure together. (Rationale: one session-start should report every drift, not whack-a-mole.)
- Exit code is the only signal. Stderr is captured for the remediation line. Stdout is ignored (hooks should be silent on success).
- codi does NOT pass any environment variables, working directory, or context to the hook beyond what the user's shell already provides. Hooks are responsible for their own environment discovery.

**Default behavior (no file):**

If `~/.codialectic/hooks/session_start.json` does not exist, waky-waky skips the hook phase entirely and reports `Pre-flight hooks: none registered`. This is the **expected default** for a fresh standalone codi install — no opinions about what should run.

**Worked example — standalone OSS install (default):**

User installs codi on a fresh Claude Code via the marketplace. No hooks file is created. `waky waky` loads tier 1-3 context (or skips files that don't exist on a non-Anand machine), reports `Pre-flight hooks: none registered`, and waits for direction. Zero environment-specific dependencies.

**Worked example — Cyborg-installed environment (Anand's setup):**

The Cyborg plug-in installation creates `~/.codialectic/hooks/session_start.json` with workspace-specific checks. Example contents:

```json
{
  "hooks": [
    {
      "name": "mcp-availability",
      "command": "bash",
      "args": [
        "/Users/anandvallam/cyborg/rules/fail-hard/HOW.sh",
        "{\"target_mode\":\"mcp-availability\"}"
      ],
      "required": true,
      "timeout_seconds": 15
    },
    {
      "name": "constitution-coherence",
      "command": "bash",
      "args": [
        "/Users/anandvallam/cyborg/rules/fail-hard/HOW.sh",
        "{\"target_mode\":\"constitution\"}"
      ],
      "required": false,
      "timeout_seconds": 15
    }
  ]
}
```

On `waky waky`, codi reads this file and executes both checks. The first BLOCKs on missing MCPs (cyborg's discipline); the second WARNs on prose-only invariants (informational debt). codi itself never references `~/cyborg/` — it just runs whatever `command` and `args` the workspace registered.

**Boundary:** codi terminal executes hooks; codi knows nothing about specific hook contents. Workspace plug-ins are responsible for registering hooks at install time and for writing checks that produce actionable stderr on failure.

## Privacy and scope

- Never echo file contents to the user unless asked. Loading is silent.
- Honor scope boundaries (P12): if a file is marked `scope: xFamilyOS` and the session is an xTeamOS session, skip it. (In v3.1 this is advisory — Scope Permissioning plugin #17 enforces at runtime.)
- Never push any of these files to a public repo. They live in private workspace only.

## How to verify

**Trigger command:** Type `waky waky` in a new session.

**Expected output:**
1. The agent silently reads the Constitution, identity files, root handoff, and all per-WIP handoffs that exist.
2. Prints the confirmation status block above with accurate counts (e.g., "Per-WIP handoffs: loaded (4 files)").
3. Does NOT dump file contents or auto-summarize — waits for user direction.
4. "Skipped (not found)" list is accurate — any file in tiers 1-3 that doesn't exist on disk is listed there.

**Failure modes to check:**
- Hallucinated file contents (e.g., claims a handoff says something it doesn't) → P14 + Ground Zero violation
- Auto-summary of handoff content without being asked → P13 + Calibration Auditor flag
- Missing files not reported in "Skipped" list → coherence bug

### END WAKY-WAKY ###
