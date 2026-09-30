/**
 * xos-197-liveness.test.ts — false DEGRADED regression coverage.
 *
 * Run: bun test hooks/xos-197-liveness.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { checkStatusLiveness, evaluateStatusFreshness } from "./status-liveness-check.ts";
import { buildDegradationNudge, evaluateCodiLiveness } from "./user-prompt-submit.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..");
const STATUSLINE = join(import.meta.dir, "statusline.sh");
const USER_PROMPT_SUBMIT = join(import.meta.dir, "user-prompt-submit.ts");
const INSTALL_SURVIVAL_LAYER = join(import.meta.dir, "scripts", "install-survival-layer.sh");

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function baseState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    schema_version: "1.0.0",
    active: true,
    mode: "drive",
    honesty: "grounded",
    persona: "Product",
    persona_icon: "📦",
    last_score: 88,
    last_cal: 96,
    wildcard: false,
    installed_version: "4.34.0",
    version: "4.34.0",
    last_session_start_ts: isoSeconds(new Date(now - 60_000)),
    last_protocol_ts: isoSeconds(new Date(now - 1_000)),
    growth_total_turns: 12,
    last_updated_ts: isoSeconds(new Date(now - 1_000)),
    ...overrides,
  };
}

function writeState(home: string, state: Record<string, unknown>): void {
  const codiDir = join(home, ".codialectic");
  mkdirSync(codiDir, { recursive: true });
  writeFileSync(join(codiDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
}

function writeRawState(home: string, raw: string): void {
  const codiDir = join(home, ".codialectic");
  mkdirSync(codiDir, { recursive: true });
  writeFileSync(join(codiDir, "state.json"), raw);
}

function runStatuslineVerdict(home: string): "LIVE" | "DEGRADED" {
  const proc = Bun.spawnSync(["bash", STATUSLINE], {
    // XOS-309: same trap as runUserPromptSubmit below. statusline.sh does
    // `IFS= read -r STATUS_INPUT`, which blocks until a newline or EOF. Without an
    // explicit stdin the child inherits the test runner's, which never closes.
    stdin: "ignore",
    cwd: home,
    env: {
      ...process.env,
      HOME: home,
      BRAIN_WORKSPACE_ROOT: join(home, "workspace"),
      CAREER_HOME: "",
      CODI_STALE_SECS: "900",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(proc.exitCode).toBe(0);
  const stdout = new TextDecoder().decode(proc.stdout);
  return stdout.includes("DEGRADED") ? "DEGRADED" : "LIVE";
}

function makePluginRoot(version = "4.34.0"): string {
  const pluginRoot = makeTempDir("codi-xos-197-plugin-");
  mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
  mkdirSync(join(pluginRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "co-dialectic", version }, null, 2) + "\n",
  );
  writeFileSync(join(pluginRoot, "hooks", "statusline.sh"), "#!/usr/bin/env bash\n");
  return pluginRoot;
}

function runInstallSurvivalLayer(home: string, pluginRoot: string): void {
  const proc = Bun.spawnSync(["bash", INSTALL_SURVIVAL_LAYER], {
    // XOS-309: explicit stdin for the same reason as the other two spawns in this file.
    stdin: "ignore",
    cwd: PLUGIN_ROOT,
    env: {
      ...process.env,
      HOME: home,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      BRAIN_WORKSPACE_ROOT: "",
      CAREER_HOME: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(proc.exitCode).toBe(0);
}

function runUserPromptSubmit(home: string, workspaceRoot: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const proc = Bun.spawnSync([process.execPath, USER_PROMPT_SUBMIT], {
    cwd: PLUGIN_ROOT,
    env: {
      ...process.env,
      HOME: home,
      BRAIN_WORKSPACE_ROOT: workspaceRoot,
      CAREER_HOME: "",
      CLAUDE_PLUGIN_ROOT: "",
      CODI_STALE_SECS: "900",
    },
    // XOS-309: stdin MUST be explicit. user-prompt-submit.ts awaits Bun.stdin.text(),
    // which blocks until EOF. Omitting stdin here makes the child inherit the test
    // runner's stdin, which never closes -> the child blocks forever -> spawnSync
    // blocks this process forever -> the ENTIRE file hangs before any result prints,
    // so bun reports it as zero tests registered and `test:all` dies on its timeout.
    // "ignore" gives the child an immediate EOF, which is exactly what a real hook
    // invocation with no payload looks like (readHookInput returns {} on empty stdin).
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout).trim(),
    stderr: new TextDecoder().decode(proc.stderr).trim(),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("XOS-197 grace-window liveness", () => {
  test("XOS-197 repro: 382s heartbeat stays LIVE despite newer session_start", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const liveness = evaluateCodiLiveness(
      baseState({
        active: true,
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 382_000)),
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 10_000)),
      }),
      "4.34.0",
      now,
      900,
    );

    expect(liveness.degraded).toBe(false);
    expect(liveness.stale).toBe(false);
    expect(liveness.reasons).not.toContain("protocol-before-session");
  });

  test("fresh heartbeat inside 900s is LIVE regardless of session_start leapfrog", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    for (const ageSecs of [0, 60, 899, 900]) {
      const liveness = evaluateCodiLiveness(
        baseState({
          last_protocol_ts: isoSeconds(new Date(now.getTime() - ageSecs * 1000)),
          last_session_start_ts: isoSeconds(new Date(now.getTime() + 1_000)),
        }),
        "4.34.0",
        now,
        900,
      );

      expect(liveness.degraded).toBe(false);
      expect(liveness.stale).toBe(false);
    }
  });

  test("genuinely stale heartbeat before session_start is still DEGRADED", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const liveness = evaluateCodiLiveness(
      baseState({
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 901_000)),
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 60_000)),
      }),
      "4.34.0",
      now,
      900,
    );

    expect(liveness.degraded).toBe(true);
    expect(liveness.stale).toBe(true);
    expect(liveness.reasons).toContain("protocol-before-session");
  });

  test("missing/absent heartbeat is UNKNOWN while active:false remains DEGRADED", () => {
    const now = new Date("2026-07-03T12:00:00Z");

    const missing = evaluateCodiLiveness(null, "4.34.0", now, 900);
    const absent = evaluateCodiLiveness(baseState({ last_protocol_ts: null }), "4.34.0", now, 900);
    expect(missing.unknown).toBe(true);
    expect(missing.degraded).toBe(false);
    expect(absent.unknown).toBe(true);
    expect(absent.degraded).toBe(false);
    expect(evaluateCodiLiveness(baseState({ active: false }), "4.34.0", now, 900).degraded).toBe(true);
  });

  test("statusline verdict matches hook verdict for the XOS-197 repro state", () => {
    const home = makeTempDir("codi-xos-197-home-");
    const now = new Date();
    const state = baseState({
      last_protocol_ts: isoSeconds(new Date(now.getTime() - 382_000)),
      last_session_start_ts: isoSeconds(new Date(now.getTime() - 10_000)),
    });
    writeState(home, state);

    const hookVerdict = evaluateCodiLiveness(state, "4.34.0", now, 900).degraded
      ? "DEGRADED"
      : "LIVE";
    const stopHookVerdict = evaluateStatusFreshness(state, now, 900).degraded
      ? "DEGRADED"
      : "LIVE";

    expect(hookVerdict).toBe("LIVE");
    expect(stopHookVerdict).toBe(hookVerdict);
    expect(runStatuslineVerdict(home)).toBe(hookVerdict);
  });

  test("install-survival-layer merge preserves model-owned state and session marker", () => {
    const home = makeTempDir("codi-xos-197-home-");
    const pluginRoot = makePluginRoot("4.34.0");
    const priorProtocol = isoSeconds(new Date(Date.now() - 120_000));
    const priorSession = "2026-07-03T01:02:03Z";
    writeState(
      home,
      baseState({
        installed_version: "4.30.0",
        version: "4.30.0",
        growth_total_turns: 37,
        last_protocol_ts: priorProtocol,
        last_session_start_ts: priorSession,
        last_score: 91,
        last_cal: 97,
        persona: "Debug",
        mode: "cruise",
      }),
    );

    runInstallSurvivalLayer(home, pluginRoot);

    const statePath = join(home, ".codialectic", "state.json");
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    expect(state.installed_version).toBe("4.34.0");
    expect(state.version).toBe("4.30.0");
    expect(state.growth_total_turns).toBe(37);
    expect(state.last_protocol_ts).toBe(priorProtocol);
    expect(state.last_session_start_ts).toBe(priorSession);
    expect(state.last_score).toBe(91);
    expect(state.last_cal).toBe(97);
    expect(state.persona).toBe("Debug");
    expect(state.mode).toBe("cruise");
  });

  test("absent last_session_start_ts with a recent heartbeat is LIVE", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    const state = baseState({
      last_protocol_ts: isoSeconds(new Date(now.getTime() - 60_000)),
    });
    delete state.last_session_start_ts;

    const liveness = evaluateCodiLiveness(state, "4.34.0", now, 900);

    expect(liveness.degraded).toBe(false);
    expect(liveness.stale).toBe(false);
  });

  test("malformed state file fails open with exit 0", () => {
    const home = makeTempDir("codi-xos-197-home-");
    const workspace = makeTempDir("codi-xos-197-workspace-");
    writeRawState(home, '{"active":true,"last_protocol_ts":');

    const result = runUserPromptSubmit(home, workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toBe("");
    expect(JSON.parse(result.stdout).decision).toBe("approve");
  });
});

describe("XOS-308: a DEGRADED session can return to LIVE", () => {
  // The deadlock: while degraded the reminder says score/cal are hidden, so the agent
  // renders `· score:— · Cal:—`, which fails the LIVE regex (it wants `93% · Cal: 97%`).
  // The DEGRADED header would pass — but the nudge never named it, so the agent could not
  // know the string. Both regexes miss, the heartbeat never advances, and the session is
  // degraded for good. The reminder's own "hide the scores" instruction is what
  // disqualifies the header it asks for.
  const degradedState = {
    last_protocol_ts: "2026-08-14T09:20:27.138918-07:00",
    last_user_prompt_ts: new Date().toISOString(),
    version: "4.36.0",
    active: true,
  } as unknown as Parameters<typeof checkStatusLiveness>[1];

  test("the nudge NAMES the exact header the gate requires", () => {
    // Pin the literal string, not a loose match: the whole bug was that the requirement
    // existed in the gate and appeared nowhere in the instruction.
    const nudge = buildDegradationNudge({ degraded: true, inactive: false } as never);
    expect(nudge).toContain("⚠ Codi DEGRADED · [HH:MM]");
  });

  test("the header the nudge names is the header the gate accepts", () => {
    // Couples instruction to gate. If either side is edited alone, this fails — which is
    // exactly the drift that produced XOS-308.
    const nudge = buildDegradationNudge({ degraded: true, inactive: false } as never);
    const named = nudge.match(/`([^`]*DEGRADED[^`]*)`/)?.[1];
    expect(named).toBeTruthy();
    const rendered = named!.replace("[HH:MM]", "[12:56]");
    const check = checkStatusLiveness(`${rendered}\n\nbody`, degradedState);
    expect(check.reason ?? null).toBeNull();
  });

  test("a score-suppressed live header is still rejected while degraded", () => {
    // Guard against over-fixing. Note precisely what this pins: the gate ALREADY accepts a
    // well-formed LIVE header while degraded (there is a separate test for that resurrection
    // path). What must stay rejected is the MALFORMED hybrid below — persona present, scores
    // suppressed to em-dashes. Loosening the gate to swallow that would make a silent drop
    // invisible, which is the whole reason the degraded header exists.
    const check = checkStatusLiveness(
      "🎯 career-hoffman · score:— · Cal:— · [12:56]\n\nbody",
      degradedState,
    );
    expect(check.reason).toBe("missing-degraded-header");
  });
});
