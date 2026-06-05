# Issues Log — 2026-05-11

**Branch:** `add-cursor-codex-support`
**Canonical version:** `4.9.0`
**Test suite:** 57/57 PASS, 0 FAIL, 1 WARN (missing agent-marketplace dir — cosmetic)

---

## Version Inconsistencies (6) — ALL FIXED

| # | File | Was | Now | Status |
|---|------|-----|-----|--------|
| 1 | `SKILL-lite.md` line 4 | `3.0.0-lite` | `4.9.0-lite` | FIXED |
| 2 | `SKILL-lite.md` line 23 | `v3.0.0-lite active` | `v4.9.0-lite active` | FIXED |
| 3 | `SKILL.md` line 30 | `v4.7.0 active` | `v4.9.0 active` | FIXED |
| 4 | `plugin.json` desc | `v4.8.0` | `v4.9.0` | FIXED |
| 5 | `marketplace.json` desc | `v4.2.0` | `v4.9.0` | FIXED |
| 6 | `install.ps1` line 15 | `$Version = "3.0.0"` | `$Version = "4.9.0"` | FIXED |

---

## Codex Compatibility (`logs/codex-compat-test.log`)

- Install, byte-identical template match, idempotency, CLI visibility: **ALL PASSED**
- Codex CLI (`codex-cli 0.130.0-alpha.5`) read `AGENTS.md` and listed all `codi` commands
- No issues found

## Cursor Compatibility (`logs/cursor-compat-test.log`)

- Local install (`--target cursor`): **PASSED** — `.cursor/rules/co-dialectic.mdc` byte-identical to adapter
- `CO_DIALECTIC_REPO` file:// and plain path variants: **PASSED**
- Raw `main` URL for `.mdc`: **404** — expected pre-merge; resolves when branch merges to `main`
- No code fix needed

## Cleanup — DONE

- Removed stale temp artifacts: `logs/cursor_chk.YUub8O`, `logs/.plugin-test-tmp/`, `.cursor_test_nested/`
