# waky-waky institutional-memory tier (XOS-143, xos slice)

status: design
slug: wakywaky-memory-tier
ticket: XOS-143
repo: ~/aiprojects/prompt-engineering-in-action (plugins/co-dialectic)

## What
Add an institutional-memory tier to the waky-waky reincarnation load so every
reincarnated session (any agent) inherits the institutional-learning index that
agents have been writing — closing the *consumption* side of the memory-propagation
gap. (The *storage* side — moving memory CONTENT into `~/cyborg/memory/` +
broadcast-on-write — is the cyborg-agent's slice, routed separately.)

## Why
Agents write `feedback_*.md` memories + a one-line index, but waky-waky never loaded
them, so a reincarnation missed institutional learning (the same "shipped ≠ activated
everywhere" failure applied to memory). Today only this machine's Claude harness
auto-recalls them; other agents/machines get nothing on reincarnate.

## Design (size-budgeted — the index is ~36KB / too big to dump wholesale)
- New tier **"Tier 2.6 — Institutional Memory (load if present)"**, loaded after Tier 2
  (active state), before Tier 3 (per-WIP). It is the recall layer (one-line summaries);
  full memory files are pulled on demand by the agent when an entry is relevant.
- Path discovery via `~/.codialectic/context.json` new optional field
  `memory_index_path`. Fallback chain when the field is absent: `~/cyborg/memory-index.md`
  → the workspace `MEMORY.md` (which today symlinks to the cyborg index). Skip the tier
  silently if none resolve (graceful, like every other tier).
- **Size budget:** load up to a budget (default ~12KB / ~3K tokens, overridable via
  context.json `memory_index_budget_bytes`). If the index exceeds the budget, load the
  head up to the budget and append a pointer line: `…(N more bytes — full index at
  <path>; read on demand)`. Never dump the whole 36KB into every reincarnation.
- Status block: add a line `Tier 2.6 (memory): <loaded N entries, M KB / budget>` or
  `Tier 2.6 (memory): none (no index path resolved)`.
- Post-compaction fast-path (the auto-fire path that loads Tier 1+2, skips Tier 3): also
  load Tier 2.6 (institutional memory is cheap + high-value on compaction recovery).

## Scope
- In: waky-waky `SKILL.md` (new tier + load order + status block + context.json field
  docs); the context.json schema doc section; version bump 4.27.0 → 4.28.0 across all 5
  sources + root CHANGELOG.
- Out (cyborg-agent slice, routed via bus): moving memory CONTENT into `~/cyborg/memory/`;
  the local-path symlink for harness auto-recall; BROADCAST+ENSURE on memory write
  (couples XOS-112); the dangling-memory detector; the constitution home for "memory
  must propagate."
- Out (this ticket): loading FULL content of all 168 memory files (token explosion) —
  index only, on-demand full reads.

## Acceptance criteria
- [ ] On reincarnate, waky-waky loads the institutional-memory index from the resolved
      path and surfaces it (within the size budget) as Tier 2.6.
- [ ] Path resolution: context.json `memory_index_path` wins; else fallback chain
      `~/cyborg/memory-index.md` → workspace `MEMORY.md`; else skip silently.
- [ ] Index larger than budget → head-loaded + on-demand pointer; never the full 36KB.
- [ ] Tier absent/path-missing → graceful skip with an accurate status-block line (no error).
- [ ] Post-compaction fast-path includes Tier 2.6.
- [ ] Version 4.28.0 across marketplace.json, plugin.json, SKILL.md `**Version:**`,
      install.sh, SKILL-lite.md; root CHANGELOG `## [4.28.0]`.
- [ ] `test-plugin.sh` green.

## Test plan
- [ ] Tests for the path-resolution + budgeting logic (context.json field wins; fallback
      chain; missing → skip; over-budget → head + pointer). If waky-waky has no extractable
      TS helper, add one for path-resolve/budget so it is unit-testable; else assert via the
      SKILL contract + a harness smoke.
- [ ] CLI/SKILL smoke: a reincarnate with a present index loads it; with no index resolves
      to the skip line; oversized index head-loads.

## Rollback
Revert the PR; remove the Tier 2.6 block from waky-waky SKILL.md + the context.json field.
Additive tier in one skill; no data migration; other tiers unaffected.

## Lane note
This is the xos (co-dialectic) consumption slice. The cyborg-agent storage+propagation
slice is filed/delegated separately; this slice ships standalone value (index propagates
on reincarnate) and degrades gracefully until the shared store lands.
