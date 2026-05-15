# Changelog — Co-Dialectic

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
