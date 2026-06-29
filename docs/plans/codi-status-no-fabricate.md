# Codi in-message status header — no-fabricate / no-silent-drop

status: design
slug: codi-status-no-fabricate
ticket: XOS-146
repo: ~/aiprojects/prompt-engineering-in-action (plugins/co-dialectic)

## What

Make codi's **in-message** status header (`{icon} {Persona} · X% · Cal: Y% · [HH:MM]`,
Protocol 1) impossible to fabricate or silently drop. XOS-141 fixed the **terminal**
statusLine (hook-owned, fail-loud); this fixes the **other** surface — the line the
model types at the top of every response, which is currently model-authored prose with
no grounded source.

## Why

2026-06-29, live proof: codi was dead the whole session (`~/.codialectic/state.json`
frozen, `last_protocol_ts` null, cache stale), yet the model TYPED `91% · Cal 95%`
headers with invented numbers, then silently dropped the header partway through, and
mistook its own performance for codi running. The terminal statusLine being reliable
does not help — the in-message header the user actually reads can still lie or vanish.
Anchors: Zero-Hallucination (don't fabricate the score), verification-before-completion,
[[feedback_dont_perform_a_dead_feature]].

## Scope

- **In:**
  - Contract rewrite in `SKILL.md` + `SKILL-lite.md` Protocol 1: a score `%`/`Cal:%`
    may appear ONLY when codi is live (a fresh `last_protocol_ts` heartbeat was written
    THIS turn AND the rendered numbers equal the `last_score`/`last_cal` just written).
    When DEGRADED (stale/absent `last_protocol_ts`, or `installed_version` skew) → header
    MUST read `⚠ Codi DEGRADED · [HH:MM]` with NO numbers. Never invent / recall a score
    from re-injected prose. `[HH:MM]` is always OS-grounded (Protocol 17).
  - NEW deterministic **Stop hook** `hooks/status-liveness-check.ts` (wired in
    `hooks.json`, following the existing `peer-parity-nudge.ts` Stop-hook pattern):
    reads the model's final assistant message + `state.json`, computes liveness, and
    emits a LOUD deterministic nudge on any of the three failure modes (below). This is
    the codification — replaces "the agent notices the drop" with a hook that always
    checks. Reuses the SAME freshness rule as `statusline.sh` (XOS-141) so the two
    surfaces can never disagree (extract/share the freshness predicate; if bash↔TS
    sharing is impractical, replicate the exact same threshold + skew rule and assert
    it in a test).
  - Tighten the `user-prompt-submit.ts` survival reminder text to state the contract
    explicitly ("a score requires a fresh heartbeat you write THIS turn; else
    `⚠ Codi DEGRADED`, never a %").
  - Version bump 4.27.0 across all 4 sources + root CHANGELOG + SKILL-lite.
- **Out:**
  - Deprecating the in-message header entirely in favor of the terminal statusLine
    (ticket direction 4) — bigger UX call; the contract + Stop hook make the in-message
    surface trustworthy without removing it. Noted as a future option, not this ticket.
  - Any change to the XOS-141 `statusline.sh` behavior (only share its freshness rule).
  - Any phone-home / telemetry. Local-only, as always.

## Acceptance criteria

- [ ] In-message header shows `X%`/`Cal: Y%` ONLY when `last_protocol_ts` is fresh AND
      the rendered numbers equal `state.json` `last_score`/`last_cal`.
- [ ] When codi is DEGRADED (stale/absent `last_protocol_ts` or version skew), the
      correct header is `⚠ Codi DEGRADED · [HH:MM]` with no numbers — documented in
      Protocol 1 (SKILL.md + SKILL-lite.md).
- [ ] `hooks/status-liveness-check.ts` (Stop hook) deterministically emits a loud nudge on:
      (a) **fabrication** — a numeric score present in the response but state NOT fresh;
      (b) **inconsistent** — rendered number ≠ `state.json` `last_score`/`last_cal`;
      (c) **silent drop** — state IS fresh but the response has no status line.
      No nudge when the DEGRADED header is correct, or when fresh + numbers match.
- [ ] The Stop hook fails safe: missing/corrupt `state.json` → treat as DEGRADED
      (expect DEGRADED header), never crash.
- [ ] Freshness predicate matches `statusline.sh` (XOS-141); a test asserts they agree.
- [ ] Version 4.27.0 in: `.claude-plugin/marketplace.json`, `plugins/co-dialectic/.claude-plugin/plugin.json`,
      `plugins/co-dialectic/skills/co-dialectic/SKILL.md` `**Version:**`, `install.sh` `VERSION=`,
      and `SKILL-lite.md` `**Version:**`; root `CHANGELOG.md` `## [4.27.0]` entry.
- [ ] `test-plugin.sh` validate green; `gh pr checks` green.

## Test plan

- [ ] `bun test` unit tests for `status-liveness-check.ts` covering the 4 cases
      (fresh+match → no nudge; stale+number → fabrication nudge; mismatch → inconsistent
      nudge; fresh+no-line → silent-drop nudge) + fail-safe on missing state.json.
- [ ] Freshness-parity test: same (last_protocol_ts, now, installed_version) inputs →
      same live/degraded verdict as the statusline.sh rule.
- [ ] CLI render smoke (Stage 5.5 plugin/CLI mode): hooks load + run without stack traces
      at narrow + standard widths; the new hook handles absent state.json gracefully.

## Rollback

Revert the PR; remove the `status-liveness-check` entry from `hooks.json`. Additive hook
+ doc edits in one plugin; no data migration; low blast radius. The terminal statusLine
(XOS-141) is unaffected, so liveness signalling never regresses below today.
