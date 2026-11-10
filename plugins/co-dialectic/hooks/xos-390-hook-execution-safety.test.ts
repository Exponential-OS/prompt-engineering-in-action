/**
 * XOS-390 — the SessionStart survival layer deadlocked forever and starved the heartbeat.
 *
 * Root cause, measured 2026-11-09: `bash` on PATH was Homebrew 5.3.15, which sits inside
 * the 5.1-5.3.19 heredoc deadlock window (bash writes a heredoc body into a pipe BEFORE
 * forking the reader; a fresh macOS pipe holds 512 bytes, so any body of 513..65535 bytes
 * blocks with nothing draining it). install-survival-layer.sh carries two such heredocs
 * (3436 B and 1102 B). Every SessionStart therefore hung in heredoc_write, leaving 39
 * orphaned processes (oldest ~10 days, 17 reparented to PID 1) and -- because the 3436-byte
 * heredoc IS sync_state_json() -- a heartbeat that never advanced. That is the DEGRADED.
 *
 * Two independent defects are covered here, because fixing only one leaves the other live:
 *   1. INTERPRETER  - shell hooks must run under a bash outside the deadlock window.
 *   2. TIMEOUT UNIT - Claude Code's hook `timeout` is in SECONDS (docs: default 600 for
 *      command hooks). codi shipped 2000-7000 in that field, i.e. millisecond values,
 *      giving a wedged hook a 33-to-116-minute leash. task-completed-judge-gate's 120 was
 *      the only correctly-unit'd value, which is what proved the rest were a unit error
 *      rather than a deliberate choice.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, mkdtempSync, existsSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const HOOKS_DIR = dirname(import.meta.path);
const HOOKS_JSON = join(HOOKS_DIR, "hooks.json");
const SCRIPTS_DIR = join(HOOKS_DIR, "scripts");

/** Claude Code's documented default for command hooks, in seconds. Nothing codi runs needs more. */
const MAX_REASONABLE_TIMEOUT_SECONDS = 600;

interface HookEntry {
  event: string;
  command: string;
  timeout?: number;
}

/** Every file under `dir` matching `pred`, recursively, skipping node_modules. */
function walk(dir: string, pred: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, pred));
    else if (pred(full)) out.push(full);
  }
  return out;
}

const shellScriptsUnder = (dir: string) => walk(dir, (f) => f.endsWith(".sh"));
const testFilesUnder = (dir: string) => walk(dir, (f) => f.endsWith(".test.ts"));

function allHooks(): HookEntry[] {
  const parsed = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
  const out: HookEntry[] = [];
  for (const [event, groups] of Object.entries(parsed.hooks as Record<string, unknown[]>)) {
    for (const group of groups as Array<{ hooks?: Array<Record<string, unknown>> }>) {
      for (const h of group.hooks ?? []) {
        out.push({
          event,
          command: String(h.command ?? ""),
          timeout: typeof h.timeout === "number" ? h.timeout : undefined,
        });
      }
    }
  }
  // Backstop, deliberately kept after XOS-392 removed the statusLine key. The
  // XOS-392 suite below forbids that key outright, so this branch should never
  // fire -- but if the key ever returns (test deleted, merge resurrects it), the
  // interpreter check still sees it rather than walking past one level up, which
  // is exactly how `bash "...statusline.sh"` hid here in the first place.
  if (parsed.statusLine?.command) {
    out.push({ event: "statusLine", command: String(parsed.statusLine.command) });
  }
  return out;
}

/**
 * Bash builds known to be free of the heredoc deadlock, as an explicit allowlist.
 * "Absolute path" is NOT the property that matters -- /opt/homebrew/bin/bash is absolute
 * and is the broken one. Only an interpreter we have actually verified belongs here.
 */
const SAFE_INTERPRETERS = new Set(["/bin/bash", "/bin/sh"]);

/**
 * The leading interpreter token of a hook command, or null when the hook is not a shell
 * invocation. Deliberately anchored at ^ so the word "bash" appearing later in a command
 * (a path, a flag, a quoted argument) is never mistaken for the interpreter -- the
 * "token matched without its context" defect this repo keeps rediscovering.
 */
export function interpreterOf(command: string): string | null {
  const m = /^(\S+)\s/.exec(command.trim());
  if (!m) return null;
  const tok = m[1];
  return /(^|\/)(bash|sh|zsh)$/.test(tok) ? tok : null;
}

describe("XOS-390: shell hooks cannot run under a deadlock-window bash", () => {
  test("every shell hook names a verified-safe interpreter", () => {
    const shellHooks = allHooks().filter((h) => interpreterOf(h.command) !== null);
    // Non-vacuity floor. Was 3 while hooks.json also carried a documentation-only
    // statusLine block; XOS-392 removed that, leaving the two real SessionStart
    // shell hooks. The installer's own statusLine wiring is covered separately below.
    expect(shellHooks.length).toBeGreaterThanOrEqual(2);

    const unsafe = shellHooks
      .filter((h) => !SAFE_INTERPRETERS.has(interpreterOf(h.command)!))
      .map((h) => `${h.event}: ${h.command}`);
    expect(unsafe).toEqual([]);
  });

  test("control: both a PATH lookup and an absolute-but-broken bash are rejected", () => {
    // Guards the assertion above against passing because interpreterOf() stopped matching,
    // and against the weaker "is it absolute?" test this replaced -- /opt/homebrew/bin/bash
    // is absolute AND is the 5.3.15 binary that deadlocks.
    const bare = interpreterOf('bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh"');
    expect(bare).toBe("bash");
    expect(SAFE_INTERPRETERS.has(bare!)).toBe(false);

    const homebrew = interpreterOf('/opt/homebrew/bin/bash "/x/y.sh"');
    expect(homebrew).toBe("/opt/homebrew/bin/bash");
    expect(homebrew!.startsWith("/")).toBe(true); // absolute...
    expect(SAFE_INTERPRETERS.has(homebrew!)).toBe(false); // ...and still rejected
  });

  test("the installer does not wire the live statusLine through a PATH bash", () => {
    // install-survival-layer.sh writes statusLine.command into the user's REAL
    // ~/.claude/settings.json. It named `bash`, so the resident statusline.sh (804-byte
    // heredoc) ran under PATH bash and deadlocked -- the shebang pin is irrelevant when
    // the command names its own interpreter.
    const installer = readFileSync(join(SCRIPTS_DIR, "install-survival-layer.sh"), "utf8");
    const m = /^\s*target_cmd\s*=\s*f?(['"])(.*)\1\s*$/m.exec(installer);
    expect(m).not.toBeNull(); // non-vacuity: the assignment still exists to be checked
    const interpreter = m![2].trim().split(/\s+/)[0];
    expect(SAFE_INTERPRETERS.has(interpreter)).toBe(true);
  });

  test("control: a non-shell hook is not mistaken for one", () => {
    expect(interpreterOf('bun run "${CLAUDE_PLUGIN_ROOT}/hooks/user-prompt-submit.ts"')).toBeNull();
    // "bash" inside an argument must not register as the interpreter.
    expect(interpreterOf('bun run "/x/rebash/tool.ts" --shell bash')).toBeNull();
  });

  test("every hook script shebang pins an absolute bash", () => {
    // Scans the WHOLE hooks tree, not just scripts/. The first cut of this test only
    // looked at scripts/ and therefore missed hooks/statusline.sh, which carries an
    // 804-byte heredoc and deadlocked exactly the same way.
    const scripts = shellScriptsUnder(HOOKS_DIR);
    expect(scripts.length).toBeGreaterThanOrEqual(4); // non-vacuity, and catches a narrowed glob

    const offenders: string[] = [];
    for (const f of scripts) {
      const first = readFileSync(f, "utf8").split("\n")[0];
      // `#!/usr/bin/env bash` resolves through PATH -> Homebrew 5.3.15 -> deadlock.
      if (!/^#!\/bin\/bash\b/.test(first)) offenders.push(`${f.replace(HOOKS_DIR, "")}: ${first}`);
    }
    expect(offenders).toEqual([]);
  });

  test("no test spawns a bare `bash` interpreter", () => {
    // hooks/xos-197-liveness.test.ts and tests/xos_141_liveness.test.ts both did
    // Bun.spawnSync(["bash", ...]) against install-survival-layer.sh. spawnSync has no
    // timeout, so both files hung forever rather than failing -- which is why they were
    // long recorded as "emitting zero tests" (XOS-309) instead of as a deadlock.
    const offenders: string[] = [];
    for (const f of testFilesUnder(join(HOOKS_DIR, ".."))) {
      // Strip line comments FIRST. Without this the scan matches the comment above that
      // *describes* the pattern, and the guard fails on its own explanation -- the same
      // "token matched without its context" trap the thing being guarded fell into.
      const src = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      // Three call shapes, because matching only the first declared two real offenders
      // clean: spawnSync(["bash", ...]), spawnSync("bash", [...]), spawnSync({cmd:["bash"...]}).
      const shapes = [
        /spawnSync\(\s*\[\s*"([^"]+)"/g,
        /spawnSync\(\s*"([^"]+)"/g,
        /spawnSync\(\s*\{[^}]*?\bcmd\s*:\s*\[\s*"([^"]+)"/gs,
      ];
      for (const re of shapes) {
        for (const m of src.matchAll(re)) {
          if (/^(bash|sh|zsh)$/.test(m[1])) offenders.push(`${f.replace(HOOKS_DIR, "")}: "${m[1]}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("XOS-392: hooks.json carries no keys the Claude Code schema rejects", () => {
  // Claude Code validated hooks.json and logged `unknown key "statusLine" ignored`
  // on every session load. The block was documentation -- its own _note said so --
  // but it held a field named `command` with an executable string, inside a file
  // whose every other entry IS executed. Two reviewers in a row read it as a live
  // call site and pinned an interpreter there that never ran. Surveying every
  // installed plugin, co-dialectic was the only one with a third top-level key.
  const SCHEMA_KEYS = new Set(["description", "hooks"]);

  test("top-level keys are limited to the ones the schema accepts", () => {
    const parsed = JSON.parse(readFileSync(HOOKS_JSON, "utf8"));
    const keys = Object.keys(parsed);
    expect(keys).toContain("hooks"); // non-vacuity: we parsed a real hooks file
    expect(keys.filter((k) => !SCHEMA_KEYS.has(k))).toEqual([]);
  });

  test("no top-level key outside `hooks` smuggles an executable command", () => {
    // The specific trap: a `command` field somewhere the runtime never reads, so
    // edits to it look effective and are inert.
    const parsed = JSON.parse(readFileSync(HOOKS_JSON, "utf8")) as Record<string, unknown>;
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "hooks") continue;
      if (JSON.stringify(value ?? null).includes('"command"')) offenders.push(key);
    }
    expect(offenders).toEqual([]);
  });

  test("control: the removed statusLine block would have failed both checks", () => {
    const removed = {
      _note: "documentation only",
      type: "command",
      command: '/bin/bash "${CLAUDE_PLUGIN_ROOT}/hooks/statusline.sh"',
    };
    expect(SCHEMA_KEYS.has("statusLine")).toBe(false);
    expect(JSON.stringify(removed).includes('"command"')).toBe(true);
  });
});

describe("XOS-390: hook timeouts are seconds, not milliseconds", () => {
  test("no hook timeout exceeds Claude Code's own command-hook default", () => {
    const withTimeout = allHooks().filter((h) => h.timeout !== undefined);
    expect(withTimeout.length).toBeGreaterThan(0); // non-vacuity

    const absurd = withTimeout
      .filter((h) => h.timeout! > MAX_REASONABLE_TIMEOUT_SECONDS)
      .map((h) => `${h.event}: ${h.command.split("/").pop()} = ${h.timeout}s`);
    expect(absurd).toEqual([]);
  });

  test("control: the shipped millisecond values would have failed this", () => {
    // 3000 was the real value on main. As seconds that is 50 minutes.
    expect(3000).toBeGreaterThan(MAX_REASONABLE_TIMEOUT_SECONDS);
    expect(7000).toBeGreaterThan(MAX_REASONABLE_TIMEOUT_SECONDS);
    // ...and the one correctly-unit'd value must still pass, or the bound is too tight.
    expect(120).toBeLessThanOrEqual(MAX_REASONABLE_TIMEOUT_SECONDS);
  });
});

describe("XOS-390: the survival layer actually terminates", () => {
  test("install-survival-layer.sh completes and writes state.json", () => {
    const script = join(SCRIPTS_DIR, "install-survival-layer.sh");
    const sandbox = mkdtempSync(join(tmpdir(), "xos390-"));
    try {
      const started = Date.now();
      const proc = Bun.spawnSync({
        cmd: ["/bin/bash", script],
        env: { ...process.env, HOME: sandbox, CLAUDE_PLUGIN_ROOT: join(HOOKS_DIR, "..") },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 30_000,
      });
      const elapsed = Date.now() - started;

      expect(proc.exitCode).toBe(0);

      // Must finish inside the budget hooks.json actually gives it -- asserting a looser
      // bound than production enforces would pass a script Claude Code would still kill.
      const budgetSeconds = allHooks().find((h) =>
        h.command.includes("install-survival-layer.sh"),
      )?.timeout;
      expect(budgetSeconds).toBeGreaterThan(0); // non-vacuity: the budget was found
      expect(elapsed).toBeLessThan(budgetSeconds! * 1000);

      expect(existsSync(join(sandbox, ".codialectic", "state.json"))).toBe(true);

      // Presence of a field is not the property that matters -- a stale timestamp is
      // exactly what DEGRADED looks like. last_protocol_ts is legitimately null on a
      // fresh install (no protocol turn has happened yet), so the field that proves the
      // writer actually RAN is last_updated_ts, which sync_state_json stamps every call.
      const state = JSON.parse(readFileSync(join(sandbox, ".codialectic", "state.json"), "utf8"));
      expect(state).toHaveProperty("last_protocol_ts"); // schema intact
      const age = Date.now() - Date.parse(state.last_updated_ts);
      expect(Number.isNaN(age)).toBe(false); // parseable, not a placeholder string
      expect(age).toBeLessThan(5 * 60_000); // genuinely stamped by THIS run
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
