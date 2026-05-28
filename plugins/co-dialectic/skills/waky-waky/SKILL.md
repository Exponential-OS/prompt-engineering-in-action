---
name: waky-waky
description: >
  Context-restoration ritual for new sessions. Use when the user says
  "waky waky", "wake up the swarm", "reincarnate", "reincarnate the swarm",
  or "restore context". Loads the Constitution, identity, active handoffs,
  and per-WIP state so a fresh session picks up where the last one ended.
metadata:
  version: "3.6.0"
  author: "Anand Vallamsetla"
  tier: "continuity"
---
<!-- product-vs-solution: example -->


### BEGIN WAKY-WAKY ###
# Waky Waky — Session Reincarnation

**Plugin #12, Continuity tier.** Part of Co-Dialectic v3.1 base plugins (see BASE-PLUGINS-V3.md). Constitution anchor: Session Handoff Protocol; P15 (Multi-Agent — shared state).

## When to activate

**Two activation modes:**

### Mode A — User-triggered (explicit phrase)
- `waky waky`
- `reincarnate`
- `reincarnate the swarm`
- `wake up the swarm`
- `restore context`
- `codi wake` / `codi reincarnate`

### Mode B — Post-compaction auto-restore (ALWAYS ON, no user trigger required)

**Signal to detect on EVERY message:** Check whether BOTH conditions are true:
1. The system-reminder shows `waky-waky` in the "previously invoked skills" list
2. No prior waky-waky confirmation output (e.g., "Context restored") is visible in the current context window

If BOTH are true → context was compacted and waky-waky lost its state. **Auto-fire immediately** — silently run session-start hooks (Tier 1.5), load Tier 1 + Tier 2 (skip Tier 3 to keep it fast), then emit a single compact line before responding to the user's message:

```
🔄 Context reloaded post-compaction. [Tier 1.5: <one-line summary of hook stdout, or "no hooks registered">]
```

Then continue answering the user's message normally. Do NOT ask the user to say "waky waky." Do NOT tell them compaction happened. Just reload and continue.

**Why this matters:** Context compaction is the #1 cause of agent amnesia — producing wrong biographical claims, forgetting active job offers, hallucinating employer names. The post-compaction auto-restore closes this gap without requiring the human to babysit the compaction boundary. The workspace's session-start hook decides what fast-path state to surface; codi just runs it.

## What to do

On trigger (Mode A or B), read `~/.codialectic/context.json` to discover workspace-specific paths (see Context Registry Contract below). Then load the FULL context set below — silently, no need to dump file contents to the user. Confirm with a compact status line showing what loaded and what was skipped.

If no context registry exists (fresh install), skip all path-dependent tiers and report `Context registry: not found — Tier 1-4 paths skipped`.

### Tier 1 — Constitution + Core Identity (ALWAYS attempt)

1. `{context.constitution_path}` — governance, all application principles, eight Ground Zero frameworks, personas. Fallback: `$CODI_CONSTITUTION_PATH` if set; otherwise skip and note missing.
2. `{context.identity_path}` — who the user is
3. `{context.brand_path}` — brand statement

### Tier 1.5 — Pre-flight hook output (fast-path workspace state)

Tier 1.5 is not a file path — it is the stdout of the registered session-start hooks (see "Session-start pre-flight hooks" section below). The workspace decides what fast-path state looks like; codi just runs the hooks and ingests their stdout as context before Tier 2.

**Why hooks, not a hardcoded file:** a workspace may produce its agent status from YAML, Notion, Jira, a git log summary, or any other source. Hardcoding a specific file path into waky-waky makes codi a custom solution, not a product. The hook is the seam; the workspace owns everything behind it.

**Execution order:** run the session-start hooks first (step below), then treat their combined stdout as Tier 1.5 context. Load Tier 2 after.

If no hooks are registered → Tier 1.5 is empty. Report `Tier 1.5: none (no session-start hooks registered)` in the status block.

### Tier 2 — Active state (load if present)

5. `{context.workspace_root}/NEXT_SESSION_HANDOFF.md` — root cross-agent relay (narrative history)
5. `{context.workspace_root}/{context.strategy_rel_path}` — active career/work arc (if configured)
6. `{context.workspace_root}/workspace.manifest.yaml` — workstream routing map

### Tier 3 — Per-WIP handoffs (glob-load)

7. `{context.workspace_root}/WIP/*/NEXT_SESSION_HANDOFF.md` — every per-workstream handoff
8. `{context.workspace_root}/WIP/*-product/NEXT_SESSION_HANDOFF.md` — every per-product handoff

### Tier 4 — Recently referenced (conversation-aware)

If the user mentions a person, company, or WIP by name in the trigger utterance, also load from paths configured in the context registry's `people_dir`, `companies_dir`, and `wip_dir` (if set).

Skip any file that does not exist. Never fabricate contents for a missing file.

## Session-start pre-flight hooks (v3.4.0+)

After context loads, run any pre-flight hooks the workspace has registered, BEFORE confirming readiness. Per FAIL-HARD INVARIANT (applied universally — codi's own discipline, not specific to any plug-in): soft warnings on session-start drift = hidden variance that surfaces mid-task. Better to fail loud at session start.

**Architectural correction (2026-04-27):** codi is standalone OSS — it must not hardcode any environment-specific paths. The previous v3.4.0 implementation invoked workspace-specific validation scripts directly, which broke fresh installs. The fix: HOOK-CALLBACK inversion. Workspaces register hooks; codi reads + executes them; codi knows nothing about underlying tools or user-specific paths.

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
  Tier 1.5 (hooks): <PASSED N/N — <one-line summary of hook stdout>> | <none registered>
  Root handoff: loaded (last updated: <date from file>)
  Per-WIP handoffs: loaded (<N> files)
  Skipped (not found): <list, or "none">

Ready. What are we picking up?
```

If a hook BLOCKed (exited non-zero with `required: true`), add one remediation line per failed hook showing the hook's `name`, the command that ran, the exit code, and the captured stderr (truncated to one line):

- `⚠️ <hook-name>: <command> <args> exited <code> — <stderr-first-line>`
- Workspaces SHOULD print their own remediation guidance to stderr so the user sees actionable next steps without codi knowing the domain.

If a hook WARNed (`required: false` and exited non-zero), surface the same line prefixed with `⚠ WARN` instead of `⚠️`, and proceed.

Then wait for the user. Do NOT auto-summarize the handoff — the user will direct the next action. Summarizing unasked = P13 violation (sacred time) and a Calibration Auditor flag (performative warmth).

## Context Registry Contract

waky-waky discovers workspace paths from `~/.codialectic/context.json`. The workspace bootstrap installer (xHumanOS, xTeamOS, or any workspace plug-in) writes this file at install time. If the file does not exist, all path-dependent tiers are skipped.

**Schema:**

```json
{
  "principles_path": "/absolute/path/to/principles.md",
  "identity_path": "/absolute/path/to/identity.md",
  "brand_path": "/absolute/path/to/professional-brand.md",
  "workspace_root": "/absolute/path/to/workspace",
  "strategy_rel_path": ".memory/career-strategy.md",
  "people_dir": ".memory/people",
  "companies_dir": ".memory/companies",
  "wip_dir": "WIP"
}
```

All fields are optional. waky-waky skips any tier whose configured path is missing or does not resolve to an existing file. The bootstrap installer is responsible for writing this file with correct absolute paths for the user's machine.

Env var override: if `CODI_CONSTITUTION_PATH` is set, it overrides `context.constitution_path`.

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

User installs codi on a fresh Claude Code via the marketplace. No context registry or hooks file is created. `waky waky` skips Tier 1-4 (no paths registered), reports `Context registry: not found — Tier 1-4 paths skipped` and `Pre-flight hooks: none registered`, and waits for direction. Zero environment-specific dependencies.

**Worked example — bootstrap-installed environment:**

A workspace bootstrap installer (e.g., xHumanOS) creates `~/.codialectic/hooks/session_start.json` with workspace-specific checks. Example contents:

```json
{
  "hooks": [
    {
      "name": "mcp-availability",
      "command": "bash",
      "args": [
        "/path/to/cyborg/rules/fail-hard/HOW.sh",
        "{\"target_mode\":\"mcp-availability\"}"
      ],
      "required": true,
      "timeout_seconds": 15
    },
    {
      "name": "constitution-coherence",
      "command": "bash",
      "args": [
        "/path/to/cyborg/rules/fail-hard/HOW.sh",
        "{\"target_mode\":\"constitution\"}"
      ],
      "required": false,
      "timeout_seconds": 15
    }
  ]
}
```

On `waky waky`, codi reads this file and executes both checks. The first BLOCKs on missing MCPs; the second WARNs on prose-only invariants (informational debt). codi itself never references personal workspace paths — it just runs whatever `command` and `args` the workspace registered.

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
