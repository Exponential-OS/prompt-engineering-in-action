/**
 * xos_141_liveness.test.ts — Structural liveness regression tests.
 *
 * Run: bun test tests/xos_141_liveness.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildDegradationNudge,
  evaluateCodiLiveness,
} from "../hooks/user-prompt-submit.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..");
const STATUSLINE = join(PLUGIN_ROOT, "hooks", "statusline.sh");
const USER_PROMPT_SUBMIT = join(PLUGIN_ROOT, "hooks", "user-prompt-submit.ts");
const INSTALL_SURVIVAL_LAYER = join(
  PLUGIN_ROOT,
  "hooks",
  "scripts",
  "install-survival-layer.sh",
);

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function writeState(home: string, state: Record<string, unknown>): void {
  const codiDir = join(home, ".codialectic");
  mkdirSync(codiDir, { recursive: true });
  writeFileSync(join(codiDir, "state.json"), JSON.stringify(state, null, 2));
}

function writeRawState(home: string, raw: string): void {
  const codiDir = join(home, ".codialectic");
  mkdirSync(codiDir, { recursive: true });
  writeFileSync(join(codiDir, "state.json"), raw);
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
    installed_version: "4.26.0",
    version: "4.26.0",
    last_session_start_ts: isoSeconds(new Date(now - 60_000)),
    last_protocol_ts: isoSeconds(new Date(now - 1_000)),
    growth_total_turns: 12,
    ...overrides,
  };
}

function runStatusline(home: string): string {
  const proc = Bun.spawnSync(["bash", STATUSLINE], {
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
  return new TextDecoder().decode(proc.stdout).trim();
}

function makePluginRoot(version: string = "9.9.9"): string {
  const pluginRoot = makeTempDir("codi-xos-141-plugin-");
  mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });
  mkdirSync(join(pluginRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "co-dialectic", version }, null, 2),
  );
  writeFileSync(join(pluginRoot, "hooks", "statusline.sh"), "#!/usr/bin/env bash\n");
  return pluginRoot;
}

function runInstallSurvivalLayer(home: string, pluginRoot: string): void {
  const proc = Bun.spawnSync(["bash", INSTALL_SURVIVAL_LAYER], {
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

function stateBackups(home: string): string[] {
  const codiDir = join(home, ".codialectic");
  return readdirSync(codiDir)
    .filter((name) => name.startsWith("state.json.corrupt-"))
    .sort()
    .map((name) => join(codiDir, name));
}

function runUserPromptSubmit(home: string, workspaceRoot: string): any {
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
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(proc.exitCode).toBe(0);
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  expect(stdout).not.toBe("");
  return JSON.parse(stdout);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("statusline freshness gate (XOS-141)", () => {
  test("fresh last_protocol_ts renders the healthy score line", () => {
    const home = makeTempDir("codi-xos-141-home-");
    writeState(home, baseState());

    const line = runStatusline(home);

    expect(line).not.toContain("DEGRADED");
    expect(line).toContain("Product · 88% · Cal: 96%");
    expect(line).toContain("🤖 Codi: full");
  });

  test("missing last_protocol_ts renders uninitialized, not DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const state = baseState();
    delete state.last_protocol_ts;
    writeState(home, state);

    expect(runStatusline(home)).toBe("🧠 Co-Dialectic · uninitialized");
  });

  test("old last_protocol_ts renders DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const now = Date.now();
    writeState(
      home,
      baseState({
        last_session_start_ts: isoSeconds(new Date(now - 2_000_000)),
        last_protocol_ts: isoSeconds(new Date(now - 1_000_000)),
      }),
    );

    expect(runStatusline(home)).toContain("⚠ Codi DEGRADED");
  });

  test("fresh last_protocol_ts before last_session_start_ts remains healthy (XOS-197)", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const now = Date.now();
    writeState(
      home,
      baseState({
        last_session_start_ts: isoSeconds(new Date(now - 10_000)),
        last_protocol_ts: isoSeconds(new Date(now - 20_000)),
      }),
    );

    expect(runStatusline(home)).not.toContain("⚠ Codi DEGRADED");
  });

  test("stale last_protocol_ts before last_session_start_ts renders DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const now = Date.now();
    writeState(
      home,
      baseState({
        last_session_start_ts: isoSeconds(new Date(now - 60_000)),
        last_protocol_ts: isoSeconds(new Date(now - 1_000_000)),
      }),
    );

    expect(runStatusline(home)).toContain("⚠ Codi DEGRADED");
  });

  test("version skew is informational only — does NOT render DEGRADED (XOS-149)", () => {
    const home = makeTempDir("codi-xos-141-home-");
    // version (model-written) != installed_version (hook-written), but otherwise live
    // (fresh protocol, active). The decoupled-version mismatch must NOT degrade — it was
    // the permanent-false-DEGRADED bug (reproduced 2026-06-29).
    writeState(home, baseState({ version: "4.25.0" }));

    const out = runStatusline(home);
    expect(out).not.toContain("⚠ Codi DEGRADED");
    expect(out).toContain("Product");
  });
});

describe("install-survival-layer state sync (XOS-141)", () => {
  test("updates installed_version and preserves model-owned last_score", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const pluginRoot = makePluginRoot();
    writeState(
      home,
      baseState({
        installed_version: "4.25.0",
        version: "4.25.0",
        last_session_start_ts: "2026-05-23T00:00:00Z",
        last_score: 77,
      }),
    );

    runInstallSurvivalLayer(home, pluginRoot);

    const state = JSON.parse(readFileSync(join(home, ".codialectic", "state.json"), "utf8"));
    expect(state.installed_version).toBe("9.9.9");
    expect(state.last_session_start_ts).toBe("2026-05-23T00:00:00Z");
    expect(state.last_score).toBe(77);
    expect(state.version).toBe("4.25.0");
    expect(existsSync(join(home, ".codialectic", "statusline.sh"))).toBe(true);
  });

  test("backs up corrupt state.json before recreating defaults", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const pluginRoot = makePluginRoot();
    const raw = '{"active":true,"last_score":98,"last_cal":97,"persona":"Product",';
    writeRawState(home, raw);

    runInstallSurvivalLayer(home, pluginRoot);

    const backups = stateBackups(home);
    expect(backups.length).toBe(1);
    expect(readFileSync(backups[0], "utf8")).toBe(raw);
    const state = JSON.parse(readFileSync(join(home, ".codialectic", "state.json"), "utf8"));
    expect(state.installed_version).toBe("9.9.9");
    expect(state.last_score).toBeNull();
    expect(state.last_cal).toBeNull();
    const log = readFileSync(join(home, ".codialectic", "install.log"), "utf8");
    expect(log).toContain(`WARN: state.json was corrupt — backed up to ${backups[0]}, recreated`);
  });

  test("backs up non-object state.json before recreating defaults", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const pluginRoot = makePluginRoot();
    const raw = '[{"last_score":98,"last_cal":97,"persona":"Product"}]';
    writeRawState(home, raw);

    runInstallSurvivalLayer(home, pluginRoot);

    const backups = stateBackups(home);
    expect(backups.length).toBe(1);
    expect(readFileSync(backups[0], "utf8")).toBe(raw);
    const state = JSON.parse(readFileSync(join(home, ".codialectic", "state.json"), "utf8"));
    expect(state.active).toBe(true);
    expect(state.installed_version).toBe("9.9.9");
    expect(state.last_score).toBeNull();
    const log = readFileSync(join(home, ".codialectic", "install.log"), "utf8");
    expect(log).toContain(`WARN: state.json was corrupt — backed up to ${backups[0]}, recreated`);
  });
});

describe("UserPromptSubmit deterministic self-resurrection (XOS-141)", () => {
  test("liveness nudge tells the model to render the verified status header", () => {
    const liveness = evaluateCodiLiveness(
      {
        active: true,
        version: "4.25.0",
        installed_version: "4.26.0",
        last_session_start_ts: "2026-06-29T10:00:00Z",
        last_protocol_ts: "2026-06-29T09:00:00Z",
      },
      "4.26.0",
      new Date("2026-06-29T10:01:00Z"),
      // staleSecs passed EXPLICITLY. Without it this reads process.env.CODI_STALE_SECS and
      // falls back to DEFAULT_STALE_SECS = 21600 (6h). The fixture's protocol timestamp is
      // only 1h before `now`, so under the default it is NOT stale and the whole scenario
      // inverts: degraded false, and the test fails.
      //
      // It passed for anyone whose shell exported CODI_STALE_SECS below 3600 (mine is 2700)
      // and failed for everyone else -- including CI, the moment the suite was actually run
      // there. A test whose verdict depends on the author's shell is not a test of the code;
      // it is a test of the machine. 900 matches what the other suites in this repo pin.
      900,
    );

    expect(liveness.degraded).toBe(true); // from STALE (protocol-before-session), not skew
    expect(liveness.stale).toBe(true);
    expect(liveness.skew).toBe(true); // still computed (informational), no longer gates degraded

    // XOS-308 changed this nudge and this assertion was not updated with it, so the suite
    // carried a real failure. It went unnoticed because `test:all` appeared to hang at the
    // time, so the full suite was never seen green and the change shipped on a single
    // file's results. That is the cost of working around a broken suite instead of fixing
    // it, and it is why XOS-309 mattered beyond the inconvenience.
    //
    // Asserting the PROPERTY, not the sentence. The old version pinned the exact string,
    // which is why a legitimate wording improvement read as a regression. What actually
    // matters -- and what XOS-308 fixed -- is that the nudge NAMES THE HEADER THE GATE
    // ACCEPTS. A nudge that says "render the required status header" without saying which
    // one is the original deadlock: the agent renders the live header, the gate rejects it,
    // and the heartbeat never advances.
    const nudge = buildDegradationNudge(liveness);
    expect(nudge).toContain("CODI DEGRADED");
    expect(nudge).toContain("⚠ Codi DEGRADED · [HH:MM]"); // the literal the Stop hook accepts
    expect(nudge).toContain("no score numbers"); // the half that disqualified the live header
    expect(nudge).toMatch(/Stop hook stamps the heartbeat/i);

    // Pins the regression itself: the pre-XOS-308 wording named no header at all. If the
    // nudge ever reverts to describing the header instead of quoting it, this fails.
    expect(nudge).not.toBe(
      "⚠ CODI DEGRADED — re-fire Protocol 0/1 NOW: render the required status header; the Stop hook will stamp the heartbeat after verifying the transcript.",
    );
  });

  test("XOS-149 regression: fresh + active + version mismatch (incl 'unknown') is NOT degraded", () => {
    const now = new Date("2026-06-29T10:01:00Z");
    const fresh = "2026-06-29T10:00:30Z";
    const session = "2026-06-29T10:00:00Z";
    // version != installedVersion (the exact decoupled-field condition that caused
    // permanent false DEGRADED) — must be LIVE because protocol is fresh + active.
    for (const acknowledged of ["4.25.0", "unknown", ""]) {
      const liveness = evaluateCodiLiveness(
        {
          active: true,
          version: acknowledged,
          installed_version: "4.29.0",
          last_session_start_ts: session,
          last_protocol_ts: fresh,
        },
        "4.29.0",
        now,
      );
      expect(liveness.degraded).toBe(false);
      expect(liveness.stale).toBe(false);
      expect(liveness.inactive).toBe(false);
    }
  });

  test("degraded injected context suppresses stale score/cal", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const workspace = makeTempDir("codi-xos-141-workspace-");
    const now = Date.now();
    writeState(
      home,
      baseState({
        last_score: 98,
        last_cal: 97,
        last_session_start_ts: isoSeconds(new Date(now - 30_000)),
        last_protocol_ts: isoSeconds(new Date(now - 1_000_000)),
      }),
    );

    const payload = runUserPromptSubmit(home, workspace);
    const context = payload.hookSpecificOutput.additionalContext;

    expect(context).toContain("Co-Dialectic v4.26.0 is DEGRADED");
    expect(context).toContain("⚠ CODI DEGRADED");
    expect(context).toContain("score/cal hidden");
    expect(context).not.toContain("Last response: 98%");
    expect(context).not.toContain("Cal: 97%");
  });

  test("missing state gets an uninitialized self-resurrection context", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const workspace = makeTempDir("codi-xos-141-workspace-");

    const payload = runUserPromptSubmit(home, workspace);
    const context = payload.hookSpecificOutput.additionalContext;

    expect(context).toContain("state source: missing state (self-resurrection)");
    expect(context).toContain("Preference persistence");
    expect(context).toContain("persist ONLY mode, verbosity, and wildcard");
    expect(context).not.toContain("last_protocol_ts=current ISO time");
    expect(payload.systemMessage).toContain("uninitialized for this session");
    expect(payload.systemMessage).not.toContain("⚠ CODI DEGRADED");
  });

  test("explicit codi off remains silent", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const workspace = makeTempDir("codi-xos-141-workspace-");
    writeState(home, baseState({ active: false }));

    const payload = runUserPromptSubmit(home, workspace);

    expect(payload.hookSpecificOutput.additionalContext).toBe("");
  });
});
