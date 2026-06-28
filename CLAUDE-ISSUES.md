# Virgin Install Audit — 2026-05-12

**Branch:** `fix-virgin-install`
**Test suite:** 54/54 PASS, 0 FAIL, 1 WARN

---

## Bugs Found and Fixed

### 1. Virgin install skips Claude Code when ~/.claude doesn't exist — FIXED
- **File:** `install.sh` line 437
- **Bug:** `if [ -d "$HOME/.claude" ]` — users with `claude` CLI installed but no `~/.claude` dir (never ran it) got zero install
- **Fix:** Changed to `if [ -d "$HOME/.claude" ] || command -v claude > /dev/null 2>&1` + `mkdir -p "$HOME/.claude/skills"`

### 2. /dev/tty errors spam output during curl pipe install — FIXED
- **File:** `install.sh` lines 59, 68
- **Bug:** `[ -c /dev/tty ]` returns true even when tty is not configured (device exists but can't be opened), causing stderr spam
- **Fix:** Changed `_is_interactive()` to use `( exec < /dev/tty ) 2>/dev/null` which actually tests if tty is usable

### 3. INSTALLED variable never initialized — FIXED
- **File:** `install.sh`
- **Bug:** `INSTALLED` used at line 508 to check if nothing was installed, but never set to `false` initially — undefined behavior
- **Fix:** Added `INSTALLED=false` and `INSTALLED_TOOLS=""` at script top

### 4. "🎉 Done!" shown even when nothing was installed — FIXED
- **File:** `install.sh` end of script
- **Bug:** Users who have no Claude/Cursor/IDE see "🎉 Done!" with no indication nothing happened
- **Fix:** Shows "⚠️ Nothing was installed" with manual install instructions when `INSTALLED=false`; shows "Installed for: <tools>" when successful

### 5. settings.json not created for virgin install — FIXED
- **File:** `install.sh` `wire_agent_hook()` function
- **Bug:** Fish gate hook wiring skipped with "settings.json not found" on fresh installs
- **Fix:** Creates `~/.claude/settings.json` with `{}` if it doesn't exist, then proceeds with hook wiring

### 6. Marketplace fallback missing — FIXED
- **File:** `install.sh` line 442
- **Bug:** Only tries `Exponential-OS/agent-marketplace`. If that fails (permissions, network), no fallback
- **Fix:** Added fallback: `|| claude plugin marketplace add Exponential-OS/prompt-engineering-in-action`

### 7. README missing troubleshooting for common install failures — FIXED
- **File:** `README.md`
- **Bug:** No guidance when plugin install fails, marketplace add fails, or nothing gets installed
- **Fix:** Added collapsible troubleshooting sections for both plugin install and general install issues

### 8. Version strings stale (carried from main) — FIXED
- **Files:** `SKILL.md`, `SKILL-lite.md`, `plugin.json`, `marketplace.json`, `install.ps1`
- Same 6 version fixes as the `add-cursor-codex-support` branch

---

## Verified

- Virgin install with no `~/.claude` → Claude Code detected via CLI, plugin installed, all skills downloaded, fish gate wired ✓
- Virgin install with no `claude` CLI and no IDE dirs → clear "Nothing was installed" message with manual instructions ✓
- Non-interactive (curl pipe) install → no `/dev/tty` errors, auto-selects defaults silently ✓
- Test suite: 54/54 PASS ✓

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
