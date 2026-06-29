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
    env: {
      ...process.env,
      HOME: home,
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

  test("missing last_protocol_ts renders DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const state = baseState();
    delete state.last_protocol_ts;
    writeState(home, state);

    expect(runStatusline(home)).toBe(
      "⚠ Codi DEGRADED · v4.26.0 · protocols stale — type 'codi on' to re-activate",
    );
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

  test("last_protocol_ts older than last_session_start_ts renders DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const now = Date.now();
    writeState(
      home,
      baseState({
        last_session_start_ts: isoSeconds(new Date(now - 10_000)),
        last_protocol_ts: isoSeconds(new Date(now - 20_000)),
      }),
    );

    expect(runStatusline(home)).toContain("⚠ Codi DEGRADED");
  });

  test("version skew renders DEGRADED", () => {
    const home = makeTempDir("codi-xos-141-home-");
    writeState(home, baseState({ version: "4.25.0" }));

    expect(runStatusline(home)).toContain("⚠ Codi DEGRADED");
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
    expect(state.last_session_start_ts).not.toBe("2026-05-23T00:00:00Z");
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
  test("liveness nudge tells the model to refresh the model-owned heartbeat", () => {
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
    );

    expect(liveness.degraded).toBe(true);
    expect(liveness.stale).toBe(true);
    expect(liveness.skew).toBe(true);
    expect(buildDegradationNudge(liveness)).toBe(
      "⚠ CODI DEGRADED (stale/skew) — re-fire Protocol 0/1 NOW: render the status line + set ~/.codialectic/state.json last_protocol_ts to current ISO time + sync version to 4.26.0.",
    );
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

  test("missing state gets a degraded self-resurrection context", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const workspace = makeTempDir("codi-xos-141-workspace-");

    const payload = runUserPromptSubmit(home, workspace);
    const context = payload.hookSpecificOutput.additionalContext;

    expect(context).toContain("state source: missing state (self-resurrection)");
    expect(context).toContain("No codi state file was loaded");
    expect(context).toContain("active=true");
    expect(context).toContain("last_protocol_ts=current ISO time");
    expect(payload.systemMessage).toContain("⚠ CODI DEGRADED");
  });

  test("explicit codi off remains silent", () => {
    const home = makeTempDir("codi-xos-141-home-");
    const workspace = makeTempDir("codi-xos-141-workspace-");
    writeState(home, baseState({ active: false }));

    const payload = runUserPromptSubmit(home, workspace);

    expect(payload.hookSpecificOutput.additionalContext).toBe("");
  });
});
