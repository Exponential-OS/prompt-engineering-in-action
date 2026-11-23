/**
 * xos-198-deterministic-heartbeat.test.ts — Stop-hook owned Protocol 1 heartbeat.
 *
 * XOS-443 rewrote the state-location half of this suite. State is session-scoped:
 * ~/.codialectic/sessions/<session_id>.json, one file, one writer, one reader.
 * The brain-kernel mirror and the machine-global ~/.codialectic/state.json that
 * XOS-198 introduced are gone, so the tests that asserted the three-tier
 * fallback were deleted rather than re-pointed — they described behavior the
 * code no longer has. The heartbeat semantics they surrounded (header parsing,
 * nudging, counter increments, preference preservation, fail-open on corrupt
 * state) are unchanged and fully retained below.
 *
 * Every test sets both CODI_STATE_DIR and HOME to throwaway dirs. That is not
 * ceremony: an earlier run of this work wrote test fixtures into the real
 * ~/.codialectic/sessions/ and one of them was later cited as evidence in a
 * ticket. Tests that can reach real state eventually will.
 *
 * Run: bun test hooks/xos-198-deterministic-heartbeat.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import {
  authoritativeStatePath,
  checkStatusLiveness,
  parseRenderedHeader,
  resolveStateWriteTargets,
  stampProtocolHeartbeat,
} from "./status-liveness-check.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..");
const STATUS_LIVENESS_CHECK = join(import.meta.dir, "status-liveness-check.ts");
const SESSION_ID = "heartbeat-test-session";

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
    mode: "cruise",
    verbosity: "verbose",
    wildcard: true,
    persona: "Product",
    persona_icon: "📦",
    last_score: 88,
    last_cal: 96,
    installed_version: "4.37.0",
    version: "4.37.0",
    last_session_start_ts: isoSeconds(new Date(now - 60_000)),
    last_protocol_ts: isoSeconds(new Date(now - 10_000)),
    growth_total_turns: 7,
    ...overrides,
  };
}

function pluginVersion(): string {
  const parsed = JSON.parse(
    readFileSync(join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"),
  );
  return parsed.version;
}

/** The one and only state location, post-XOS-443. */
function statePath(stateDir: string, sessionId: string = SESSION_ID): string {
  return join(stateDir, "sessions", `${sessionId}.json`);
}

function withEnv<T>(updates: Record<string, string>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function writeJson(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function writeState(
  stateDir: string,
  state: Record<string, unknown>,
  sessionId: string = SESSION_ID,
): void {
  writeJson(statePath(stateDir, sessionId), state);
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8"));
}

function transcriptWithAssistant(message: string): string {
  return JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text: message }],
    },
  }) + "\n";
}

/**
 * Runs the real hook as a subprocess with a sandboxed state dir.
 * `sessionId: null` reproduces a payload with no session id at all.
 */
function runHook(
  stateDir: string,
  message: string,
  options: { sessionId?: string | null } = {},
): { exitCode: number; stdout: string; stderr: string } {
  const sessionId = options.sessionId === undefined ? SESSION_ID : options.sessionId;
  const transcript = join(makeTempDir("codi-heartbeat-transcript-"), "transcript.jsonl");
  writeFileSync(transcript, transcriptWithAssistant(message));

  const payload: Record<string, unknown> = { transcript_path: transcript };
  if (sessionId !== null) payload.session_id = sessionId;

  const proc = spawnSync(process.execPath, [STATUS_LIVENESS_CHECK], {
    cwd: PLUGIN_ROOT,
    env: {
      ...process.env,
      HOME: makeTempDir("codi-heartbeat-home-"),
      CODI_STATE_DIR: stateDir,
      CAREER_HOME: "",
      CODI_STALE_SECS: "900",
    },
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return {
    exitCode: proc.status ?? 0,
    stdout: (proc.stdout ?? "").trim(),
    stderr: (proc.stderr ?? "").trim(),
  };
}

function expectFreshIso(value: unknown, before: number, after: number): void {
  expect(typeof value).toBe("string");
  const epoch = Date.parse(value as string);
  expect(Number.isFinite(epoch)).toBe(true);
  expect(epoch).toBeGreaterThanOrEqual(before);
  expect(epoch).toBeLessThanOrEqual(after);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("XOS-198 deterministic heartbeat writer", () => {
  test("score changes and stale resurrection do not nudge, but missing headers still do", () => {
    const now = new Date();
    const fresh = isoSeconds(new Date(now.getTime() - 10_000));
    const stale = isoSeconds(new Date(now.getTime() - 2_000_000));

    const changedScore = checkStatusLiveness(
      "📦 Product · 91% · Cal: 93% · [12:01]\nDone.",
      baseState({ last_protocol_ts: fresh, last_score: 88, last_cal: 96 }),
      now,
      900,
    );
    expect(changedScore.freshness.live).toBe(true);
    expect(changedScore.reason).toBeNull();
    expect(changedScore.nudge).toBeNull();

    const resurrected = checkStatusLiveness(
      "📦 Product · 91% · Cal: 93% · [12:01]\nDone.",
      baseState({ last_protocol_ts: stale, last_score: 88, last_cal: 96 }),
      now,
      900,
    );
    expect(resurrected.freshness.degraded).toBe(true);
    expect(resurrected.header.liveHeader).toBe(true);
    expect(resurrected.reason).toBeNull();
    expect(resurrected.nudge).toBeNull();

    const silentDrop = checkStatusLiveness("Done.", baseState({ last_protocol_ts: fresh }), now, 900);
    expect(silentDrop.reason).toBe("silent-drop");
    expect(silentDrop.nudge).toContain("codi is LIVE");

    const missingDegraded = checkStatusLiveness("Done.", baseState({ last_protocol_ts: stale }), now, 900);
    expect(missingDegraded.reason).toBe("missing-degraded-header");
    expect(missingDegraded.nudge).toContain("codi is DEGRADED");
  });

  test("valid live header stamps session state, preserves preferences, and increments", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    writeState(stateDir, baseState());

    const before = Date.now();
    const first = runHook(stateDir, "📦 Product (Doshi) · 88% · Cal: 96% · [12:00]\nDone.");
    const after = Date.now();

    expect(first.exitCode).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout).toBe("");

    const stamped = readJson(statePath(stateDir));
    expectFreshIso(stamped.last_protocol_ts, before, after);
    expect(stamped.persona).toBe("Product (Doshi)");
    expect(stamped.persona_icon).toBe("📦");
    expect(stamped.last_score).toBe(88);
    expect(stamped.last_cal).toBe(96);
    expect(stamped.version).toBe(pluginVersion());
    expect(stamped.growth_total_turns).toBe(8);
    expect(stamped.mode).toBe("cruise");
    expect(stamped.verbosity).toBe("verbose");
    expect(stamped.wildcard).toBe(true);
    expect(stamped.active).toBe(true);

    const second = runHook(stateDir, "📦 Product (Doshi) · 89% · Cal: 97% · [12:01]\nDone.");
    expect(second.exitCode).toBe(0);
    const afterSecond = readJson(statePath(stateDir));
    expect(afterSecond.growth_total_turns).toBe(9);
    expect(afterSecond.last_score).toBe(89);
    expect(afterSecond.last_cal).toBe(97);
  });

  test("one session's turn never writes into another session's state", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    const other = "someone-elses-session";
    writeState(stateDir, baseState(), SESSION_ID);
    writeState(stateDir, baseState({ growth_total_turns: 42 }), other);

    const result = runHook(stateDir, "📦 Product · 88% · Cal: 96% · [12:00]\nDone.");

    expect(result.exitCode).toBe(0);
    expect(readJson(statePath(stateDir)).growth_total_turns).toBe(8);
    // Untouched: the neighbour's counter and heartbeat must not move.
    expect(readJson(statePath(stateDir, other)).growth_total_turns).toBe(42);
  });

  test("degraded header stamps heartbeat and increments counter", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    const stale = isoSeconds(new Date(Date.now() - 2_000_000));
    writeState(stateDir, baseState({ last_protocol_ts: stale, growth_total_turns: 3 }));

    const before = Date.now();
    const result = runHook(stateDir, "⚠ Codi DEGRADED · [12:00]\nDone.");
    const after = Date.now();

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    const stamped = readJson(statePath(stateDir));
    expectFreshIso(stamped.last_protocol_ts, before, after);
    expect(stamped.growth_total_turns).toBe(4);
    expect(stamped.last_score).toBe(88);
    expect(stamped.last_cal).toBe(96);
  });

  test("quiet footer stamps liveness only without nudging for live or stale prior state", () => {
    const quietMessage = [
      "Quiet-mode work complete.",
      "",
      "Co-Dialectic tracking silently (type 'codi status' for info, 'codi on' to un-quiet)",
    ].join("\n");

    for (const lastProtocolTs of [
      isoSeconds(new Date(Date.now() - 10_000)),
      isoSeconds(new Date(Date.now() - 2_000_000)),
    ]) {
      const stateDir = makeTempDir("codi-heartbeat-state-");
      writeState(stateDir, baseState({
        active: undefined,
        last_protocol_ts: lastProtocolTs,
        last_score: 88,
        last_cal: 96,
        persona: "Product",
        persona_icon: "box",
        growth_total_turns: 5,
      }));

      const before = Date.now();
      const result = runHook(stateDir, quietMessage);
      const after = Date.now();

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe("");

      const stamped = readJson(statePath(stateDir));
      expectFreshIso(stamped.last_protocol_ts, before, after);
      expect(stamped.growth_total_turns).toBe(6);
      expect(stamped.active).toBe(true);
      expect(stamped.version).toBe(pluginVersion());
      expect(stamped.last_score).toBe(88);
      expect(stamped.last_cal).toBe(96);
      expect(stamped.persona).toBe("Product");
      expect(stamped.persona_icon).toBe("box");
    }
  });

  test("quiet phrase away from final line still nudges and does not stamp", () => {
    const message = [
      "Review note:",
      "Co-Dialectic tracking silently is documented here for reviewers.",
      "Done without a status header.",
    ].join("\n");

    for (const [lastProtocolTs, expectedNudge] of [
      [isoSeconds(new Date(Date.now() - 10_000)), "codi is LIVE"],
      [isoSeconds(new Date(Date.now() - 2_000_000)), "codi is DEGRADED"],
    ] as const) {
      const stateDir = makeTempDir("codi-heartbeat-state-");
      writeState(stateDir, baseState({
        last_protocol_ts: lastProtocolTs,
        growth_total_turns: 5,
      }));

      const result = runHook(stateDir, message);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("CODI STATUS SILENT DROP");
      expect(result.stdout).toContain(expectedNudge);

      const stamped = readJson(statePath(stateDir));
      expect(stamped.last_protocol_ts).toBe(lastProtocolTs);
      expect(stamped.growth_total_turns).toBe(5);
    }
  });

  test("live persona icon sync clears stale icon on iconless headers and sets present icons", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    writeState(stateDir, baseState({
      persona: "Design",
      persona_icon: "art-palette",
      growth_total_turns: 5,
    }));

    const iconless = runHook(stateDir, "Product (Doshi) · 91% · Cal: 93% · [12:00]\nDone.");

    expect(iconless.exitCode).toBe(0);
    expect(iconless.stderr).toBe("");
    expect(iconless.stdout).toBe("");
    const iconlessState = readJson(statePath(stateDir));
    expect(iconlessState.persona).toBe("Product (Doshi)");
    expect(iconlessState.persona_icon).toBeNull();
    expect(iconlessState.last_score).toBe(91);
    expect(iconlessState.last_cal).toBe(93);

    const withIcon = runHook(stateDir, "📦 Product (Doshi) · 92% · Cal: 94% · [12:01]\nDone.");

    expect(withIcon.exitCode).toBe(0);
    expect(withIcon.stderr).toBe("");
    expect(withIcon.stdout).toBe("");
    const withIconState = readJson(statePath(stateDir));
    expect(withIconState.persona).toBe("Product (Doshi)");
    expect(withIconState.persona_icon).toBe("📦");
    expect(withIconState.last_score).toBe(92);
    expect(withIconState.last_cal).toBe(94);
  });

  test("no Protocol 1 header does not write and still nudges", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    const prior = "2026-07-04T12:00:00Z";
    writeState(stateDir, baseState({ last_protocol_ts: prior, growth_total_turns: 5 }));

    const result = runHook(stateDir, "Done.");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CODI STATUS SILENT DROP");
    const stamped = readJson(statePath(stateDir));
    expect(stamped.last_protocol_ts).toBe(prior);
    expect(stamped.growth_total_turns).toBe(5);
  });

  test("corrupt existing state fails open and rewrites from an empty base", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    mkdirSync(join(stateDir, "sessions"), { recursive: true });
    writeFileSync(statePath(stateDir), '{"active":true,"last_protocol_ts":');

    const result = runHook(stateDir, "⚠ Codi DEGRADED\nDone.");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const stamped = readJson(statePath(stateDir));
    expect(typeof stamped.last_protocol_ts).toBe("string");
    expect(stamped.growth_total_turns).toBe(1);
    // corrupt-recovery rewrites from {} → must self-heal to active, not DEGRADED
    expect(stamped.active).toBe(true);
  });

  test("missing state file (dir exists) → from-scratch stamp self-heals to active=true (no DEGRADED path)", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    // sessions/ exists (as on any machine that has run codi before) but this
    // session's FILE is missing: the hook must create it from scratch and
    // self-heal to active=true rather than write active:undefined → DEGRADED
    // on the next turn.
    mkdirSync(join(stateDir, "sessions"), { recursive: true });
    const before = Date.now();
    const result = runHook(stateDir, "📦 Product · 88% · Cal: 96% · [12:00]\nDone.");
    const after = Date.now();

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const stamped = readJson(statePath(stateDir));
    expect(stamped.active).toBe(true);
    expect(stamped.growth_total_turns).toBe(1);
    expectFreshIso(stamped.last_protocol_ts, before, after);
  });

  test("missing sessions/ dir is created rather than silently dropping the turn", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    // Nothing exists yet — a genuinely fresh machine.
    const result = runHook(stateDir, "📦 Product · 88% · Cal: 96% · [12:00]\nDone.");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(existsSync(statePath(stateDir))).toBe(true);
    expect(readJson(statePath(stateDir)).growth_total_turns).toBe(1);
  });

  // ── XOS-443: the dead paths must stay dead ────────────────────────────────
  //
  // These are regression guards, not coverage padding. The brain-kernel and
  // machine-global files are the exact shape of thing that gets quietly
  // reintroduced by a later "backward compatibility" patch, and the failure is
  // silent: the hook keeps passing while the state it reads is months stale.

  test("no session id → no write target and no readable state path", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    const workspace = makeTempDir("codi-heartbeat-workspace-");

    withEnv({ CODI_STATE_DIR: stateDir, BRAIN_WORKSPACE_ROOT: workspace, CAREER_HOME: "" }, () => {
      expect(resolveStateWriteTargets()).toHaveLength(0);
      expect(authoritativeStatePath()).toBeNull();
    });
  });

  test("a stale brain-kernel or global state file is never read or written", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    const workspace = makeTempDir("codi-heartbeat-workspace-");
    const home = makeTempDir("codi-heartbeat-home-");

    // Both legacy locations, populated and plausible-looking.
    const brainFile = join(workspace, "co-dialectic", "status-state.json");
    const globalFile = join(home, ".codialectic", "state.json");
    writeJson(brainFile, baseState({ growth_total_turns: 900 }));
    writeJson(globalFile, baseState({ growth_total_turns: 901 }));

    withEnv(
      { CODI_STATE_DIR: stateDir, BRAIN_WORKSPACE_ROOT: workspace, HOME: home, CAREER_HOME: "" },
      () => {
        // With a session: resolves to the session file, not either legacy file.
        const targets = resolveStateWriteTargets({ session_id: SESSION_ID });
        expect(targets).toHaveLength(1);
        expect(targets[0]?.path).toBe(statePath(stateDir));
        expect(targets[0]?.authoritative).toBe(true);
        expect(authoritativeStatePath({ session_id: SESSION_ID })).toBe(statePath(stateDir));

        // Without a session: null, NOT a fallback to either legacy file.
        expect(authoritativeStatePath()).toBeNull();
      },
    );

    // And a real hook turn leaves both legacy files byte-identical.
    const brainBefore = readFileSync(brainFile, "utf8");
    const globalBefore = readFileSync(globalFile, "utf8");
    runHook(stateDir, "📦 Product · 88% · Cal: 96% · [12:00]\nDone.");
    expect(readFileSync(brainFile, "utf8")).toBe(brainBefore);
    expect(readFileSync(globalFile, "utf8")).toBe(globalBefore);
  });

  test("write target and read path resolve to the same file for a given session", () => {
    const stateDir = makeTempDir("codi-heartbeat-state-");
    withEnv({ CODI_STATE_DIR: stateDir, CAREER_HOME: "" }, () => {
      for (const sessionId of [SESSION_ID, "another-session", "a.b_c-123"]) {
        const [target] = resolveStateWriteTargets({ session_id: sessionId });
        expect(target?.path).toBe(authoritativeStatePath({ session_id: sessionId }));
      }
    });
  });

  test("unreadable plugin version preserves existing version or omits it without crashing", () => {
    const temp = makeTempDir("codi-heartbeat-version-");
    const fakeHookDir = join(temp, "hooks");
    mkdirSync(fakeHookDir, { recursive: true });

    const preservePath = join(temp, "preserve.json");
    writeJson(preservePath, { version: "8.8.8", growth_total_turns: 0 });
    stampProtocolHeartbeat(
      parseRenderedHeader("📦 Product · 88% · Cal: 96% · [12:00]"),
      new Date("2026-07-04T12:00:00Z"),
      { hookDir: fakeHookDir, targets: [{ path: preservePath, authoritative: true }] },
    );
    expect(readJson(preservePath).version).toBe("8.8.8");

    const omitPath = join(temp, "omit.json");
    writeJson(omitPath, { growth_total_turns: 0 });
    stampProtocolHeartbeat(
      parseRenderedHeader("📦 Product · 88% · Cal: 96% · [12:00]"),
      new Date("2026-07-04T12:00:00Z"),
      { hookDir: fakeHookDir, targets: [{ path: omitPath, authoritative: true }] },
    );
    expect("version" in readJson(omitPath)).toBe(false);
  });
});
