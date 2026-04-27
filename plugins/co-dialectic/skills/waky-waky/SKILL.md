---
name: waky-waky
description: >
  Context-restoration ritual for new sessions. Use when the user says
  "waky waky", "wake up the swarm", "reincarnate", "reincarnate the swarm",
  or "restore context". Loads the Constitution, identity, active handoffs,
  and per-WIP state so a fresh session picks up where the last one ended.
metadata:
  version: "3.1.0"
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

## Session-start fail-hard checks (NEW v3.4.0+)

After context loads, run two fail-hard checks BEFORE confirming readiness. Per FAIL-HARD INVARIANT (Constitution Ground Zero, 2026-04-27): soft warnings on session-start drift = hidden variance that surfaces mid-task. Better to fail loud at session start.

**Check 1 — MCP availability** (workspace manifest declares the contract; reality must match):

```bash
bash ~/cyborg/rules/fail-hard/HOW.sh '{"target_mode":"mcp-availability"}'
```

If verdict = `BLOCK`, surface the unresolved MCPs in the status block (see below) and prompt the user to install before continuing. Each unresolved MCP is a workspace-discipline drift the rule catches mechanically. Common causes: a manifest-declared CLI was uninstalled, a binary was renamed, a new dev machine doesn't have the tool yet.

**Check 2 — Constitution coherence** (every invariant has its rule directory):

```bash
bash ~/cyborg/rules/fail-hard/HOW.sh '{"target_mode":"constitution"}'
```

This is informational at session-start (will surface the Phase 6 retrofit count, currently ~17 prose-only invariants). Don't BLOCK on this — surface the count in the status block as a known-debt indicator.

## Confirmation output

After loading + fail-hard checks, print this compact status block (no fluff, no recap of file contents):

```
Co-Dialectic · Waky Waky — context restored.
  Constitution: loaded (all application principles, eight frameworks, personas)
  Identity: loaded
  Root handoff: loaded (last updated: <date from file>)
  Per-WIP handoffs: loaded (<N> files)
  MCP availability: <PASS — N stdio MCPs resolve> | <BLOCK — list unresolved>
  Constitution coherence: <N of M invariants have rule directories — Phase 6 retrofit progress>
  Skipped (not found): <list, or "none">

Ready. What are we picking up?
```

If MCP-availability BLOCKed, add a remediation line per unresolved MCP:
- `⚠️ gitkraken-mcp: command "gk" not on PATH — install: npm install -g @gitkraken/gk`
- `⚠️ <name>: command "<binary>" not found — see workspace.manifest.yaml line N`

Then wait for the user. Do NOT auto-summarize the handoff — the user will direct the next action. Summarizing unasked = P13 violation (sacred time) and a Calibration Auditor flag (performative warmth).

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
