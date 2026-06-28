---
name: forage
description: >
  Epistemic Foraging flywheel. Weekly tool-discovery loop that reaches
  OUTWARD into the live tool landscape (marketplaces, GitHub trending,
  web) for new plugins/MCPs/skills, scores candidates against the week's
  ACTUAL session friction, verifies in a throwaway worktree, files a
  human-approval ticket per verify-passed keeper (install is HUMAN-GATED —
  never automatic), and codifies the outcome. Use when the
  user says "forage", "/forage", "epistemic foraging", "tool discovery",
  "what new tools", "scan the tool landscape", or when the weekly forage
  cron fires.
metadata:
  version: "1.0.0"
  author: "Anand Vallamsetla"
  tier: "soul"
---
<!-- product-vs-solution: example -->


### BEGIN FORAGE ###
# Forage — Epistemic Foraging Flywheel

**Soul tier.** Constitution anchor: Epistemic Foraging ("the tool landscape
shifts logarithmically; actively discover unknown-unknown toolchains — don't
wait for the human"); P20 Signal Curation; P3 Platform.

## Why this exists

The tool landscape moves in weeks; human attention doesn't scale to track it.
2026-06-04 proved the value ad-hoc: context7, hookify, agent-teams, playground,
skill-creator, plugin-dev — each found manually, each matched to live friction.
This skill makes that loop repeatable and autonomous.

**Foraging vs Dreaming:** `/dream` consolidates EXISTING memory inward/backward.
`/forage` reaches OUTWARD/forward for NEW capability. Cousins, opposite
directions. Dreaming is the final CODIFY step here, not the engine.

## When to activate

- Trigger phrases: `forage`, `/forage`, `epistemic foraging`, `tool discovery`,
  `what new tools`, `scan the tool landscape`, `codi forage`
- Optional weekly scheduled cron (see Cadence below). **Default invocation is
  MANUAL** — run `/forage` by hand at whatever cadence fits. The cron is an
  opt-in convenience, not a requirement; the loop is identical either way.

## Autonomy contract (locked 2026-06-05 00:53 PDT, Anand — supersedes any earlier answer)

Forage → score → verify-in-throwaway-worktree run **autonomously**.
**INSTALL IS HUMAN-GATED — NO AUTO-INSTALL, from any marketplace.** An earlier
in-flight answer chose fully-autonomous install; THAT ANSWER IS REVOKED.

Why: a weekly auto-install of third-party plugins is untrusted code whose hooks
execute on this machine (P12 Security; P20 composite trust). The human reviews
every candidate before it touches the live env.

Non-negotiable bounds:

1. **Verify before propose.** A candidate may be proposed for install ONLY
   after it passed smoke-test in a throwaway worktree. Never propose blind
   (FOUNDATION-FIRST: a bad tool in the live env compounds).
2. **Ticket per candidate, not per batch.** Each verify-passed keeper files
   its own approval ticket (Linear, xOS Team) carrying the verification
   evidence (smoke-test result, token cost, collision check) AND the exact
   one-command rollback (`claude plugin uninstall <name>@<marketplace>`).
   The human approves or rejects each candidate individually.
3. **Install only on explicit approval.** After approval, install at the
   appropriate scope, append the KEEPER registry entry with rollback, and
   close the ticket. No approval → candidate stays PENDING; never install
   "while waiting."
4. **Surface what's pending.** Emit a memory entry into autoMemoryDirectory so
   the next session's SessionStart surfaces "forage proposed X, Y — awaiting
   approval; evidence in the tickets."
5. **Cap: max 3 proposals per run.** More is noise and review burden.

## The loop

### 1. FORAGE — diff what's new since last run

Scan sources in parallel; P20 authority-weight everything (stars × maintainer
× recency — primary sources only, never training recall):

- **Marketplace diff:** `claude plugin marketplace list` (official + added
  marketplaces) vs `claude plugin list` (installed). New/updated entries are
  candidates.
- **GitHub trending:** web-search "claude code plugin/MCP/skill" repos created
  or trending in the last ~30 days. Weight by stars + maintainer authority.
- **Repo-gap analysis:** invoke the `claude-automation-recommender` skill on
  the primary workspace (COMPOSE, don't rebuild — it analyzes the repo for
  hook/skill/MCP gaps).
- **Web sweep:** search "new Claude Code plugin <current month/year>",
  "best MCP servers <current month/year>". Discard listicles; keep primary
  repos and official announcements.

Skip anything already in the REJECTED section of the tools-registry (no
re-evaluation churn week over week).

### 2. SCORE — against actual friction, not novelty

This is the flywheel's flywheel:

- Read the last 7 days of the session ledger. Resolve the directory via
  `$CO_DIALECTIC_SESSION_LEDGER_DIR` if the workspace adapter sets it;
  otherwise use the brain-kernel primitive path `sessions/ledger/` under the
  **WORKSPACE brain root** (daily `YYYY-MM-DD.md` files) — the ledger that
  records the human's actual day-to-day work. NEVER a universal/shared brain's
  ledger (e.g. a cyborg-wide brain): scoring against infrastructure-work
  signal degenerates the flywheel into novelty-hunting. On a fresh OSS install
  with no ledger, fall back to the current conversation + recent git history
  as the friction signal. Extract: what tasks were painful, repeated, manual,
  or token-expensive this week?
- Match candidate → unmet need. Pattern: "we kept doing X by hand → candidate
  C automates X."
- Rank by **(friction relieved × authority × recency)**.
- **Drop novelty-only finds.** A shiny tool with no matching friction scores
  zero this week — log it as `DEFERRED (no friction match)`, it may match
  next week's ledger.
- Take the top ≤3 candidates forward.

### 3. VERIFY — the OMC discipline (non-negotiable)

For each top candidate:

- Create a throwaway git worktree (or empty temp dir for non-repo tools).
- Install there at **project scope only** (`claude plugin install <name> --scope project`
  inside the worktree) — never user/global scope during verification.
- Smoke-test: does it load, does its primary trigger respond, does it collide
  with installed skills (trigger-phrase overlap, hook conflicts)?
- Measure rough token cost (context size it injects at SessionStart).
- Tear the worktree down afterward. PASS/FAIL with one-line reason.

### 4. PROPOSE — human-gated install (NO auto-install)

For each PASS candidate (max 3):

- File one approval ticket per candidate (Linear, xOS Team) containing: the
  friction it relieves (with ledger dates), the worktree verification evidence
  (smoke-test result, token cost, collision check), and the **exact rollback
  command**.
- Append a PENDING entry to the tools-registry (format below).
- **Do NOT install.** Install happens only after the human approves the
  ticket — then install at the appropriate scope, move the registry row
  PENDING → KEEPERS, and close the ticket. If an approved install errors
  mid-way: stop, roll back, log FAIL on the ticket.

### 5. CODIFY — the dreaming step

- **Pending proposals** → tools-registry PENDING section + a memory entry in
  autoMemoryDirectory (`type: project`) naming the tool, the friction it
  relieves, the ticket, and the rollback command.
- **Approved installs** (from earlier runs' tickets) → move to KEEPERS.
- **Rejects/fails** → REJECTED section with one-line reason (prevents
  re-evaluation next week).
- **Deferred** → DEFERRED section (re-scored next run against the new ledger).
- File one summary ticket (Linear, xOS Team): "forage <date>: proposed N,
  rejected M, deferred K" with the slate — run-level audit trail.
- Optionally end with `/dream` to consolidate.

## Registry — single source of truth

Path: resolve via `$CO_DIALECTIC_TOOLS_REGISTRY` if the workspace adapter
sets it; otherwise `references/tools-registry.md` under the workspace brain
root. Create on first run with frontmatter (shared-state hydration invariant):

```markdown
---
name: tools-registry
type: registry
scope: cyborg-wide tool adoption ledger (written by /forage, read by all agents)
created: <first-run ISO date>
who: /forage skill (co-dialectic)
why: codifies Epistemic Foraging — keepers, rejects, deferred, with rollback
---

# Tools Registry

## PENDING (verify-passed, awaiting human approval — do NOT install)
| Date | Tool | Source | Friction relieved | Verify result | Ticket | Rollback |
|---|---|---|---|---|---|---|

## KEEPERS (human-approved + installed)
| Date | Tool | Source | Friction relieved | Verify result | Rollback |
|---|---|---|---|---|---|

## REJECTED (do not re-evaluate)
| Date | Tool | Reason |
|---|---|---|

## DEFERRED (re-score next run)
| Date | Tool | Why deferred |
|---|---|---|
```

Append rows; never rewrite the file wholesale (P15 surgical edits).

## Cadence

**Weekly is the target rhythm** — the tool landscape moves in weeks; faster
burns tokens on a slow-moving landscape, slower misses adoption windows.

**Invocation is MANUAL by default** (decided 2026-06-23): run `/forage` by hand
~weekly. An automatic cron is optional and currently NOT wired — a prior
claude.ai-routine attempt was unreliable (account-scoped triggers + auto-disable
on repo-access loss). If/when a cron is added it simply passes `/forage` as the
prompt; the loop is identical to a manual run.

## Rules

- **Never auto-install.** Install is human-gated, per candidate, via approval
  ticket. No exceptions, no marketplace whitelist, no "it's official so it's
  fine."
- **Never propose blind.** Verify-in-worktree is the gate before a ticket is
  filed. No exceptions.
- **Friction-first, not novelty-first.** No ledger signal → DEFERRED, not proposed.
- **Workspace ledger only.** The friction signal is the workspace session
  ledger — never a universal/shared brain's ledger.
- **Primary sources only** (P20). A tool's own repo/docs, not a roundup blog.
- **Respect the REJECTED list.** Re-evaluating a reject requires a new reason
  (e.g., major version bump) — note it in the entry.
- **Max 3 proposals per run.** Rank and cut; log what was cut (no silent caps).
- **Every proposal carries its rollback.** A ticket or registry entry without
  a rollback command is incomplete — fix before moving on.

## How to verify

**Trigger command:** Type `forage`.

**Expected output:**
1. Source scan summary (marketplace diff count, trending hits, recommender gaps).
2. Friction profile from the week's ledger (3-5 named pain points with dates).
3. Ranked candidate table: candidate → friction matched → score.
4. Per-candidate verify result (worktree smoke-test PASS/FAIL + token cost).
5. Proposal report: per-candidate approval tickets filed (with evidence +
   rollback), PENDING registry rows appended. **Nothing installed.**
6. Summary ticket link + memory entry confirmation.

**Failure modes:**
- Installing ANYTHING without explicit human approval of that candidate's
  ticket → autonomy-contract violation (auto-install was explicitly REVOKED)
- Proposing without a worktree verify pass → FOUNDATION-FIRST violation
- Reading a universal/shared brain's ledger instead of the workspace ledger →
  flywheel scores against the wrong work
- Candidates ranked by stars alone with no ledger read → flywheel broken (it's
  foraging for the internet's work, not yours)
- Registry entry or ticket missing rollback command → incomplete codification
- Re-evaluating REJECTED tools weekly → churn; respect the list
- "Found 12 great new tools!" with no friction match → novelty noise +
  Calibration Auditor flag

## Interaction with other skills

- **claude-automation-recommender** — composed as a FORAGE source (repo-gap lens).
- **/dream** — optional final consolidation of the run's memory writes.
- **unknown-unknown** — sibling: it cross-pollinates existing insights inward;
  forage discovers new capability outward.
- **calibration-auditor** — the findings report must pass Zero-Flattery (no
  "exciting new tools!" framing; state friction → tool → verdict).

### END FORAGE ###
