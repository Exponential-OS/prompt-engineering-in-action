/**
 * XOS-237 — per-session, turn-relative liveness and workspace-owned packets.
 *
 * Run: bun test hooks/xos-237-session-liveness.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { evaluateSharedLiveness } from "./liveness.ts";

const STATUSLINE = join(import.meta.dir, "statusline.sh");
const USER_PROMPT_SUBMIT = join(import.meta.dir, "user-prompt-submit.ts");
const STATUS_LIVENESS_CHECK = join(import.meta.dir, "status-liveness-check.ts");
const PRECOMPACT = join(import.meta.dir, "precompact-handoff.ts");
const tempDirs: string[] = [];

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function state(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    active: true,
    mode: "drive",
    persona: "Product",
    persona_icon: "📦",
    last_score: 88,
    last_cal: 96,
    installed_version: "4.38.0",
    version: "4.38.0",
    last_user_prompt_ts: iso(now - 2_000),
    last_protocol_ts: iso(now - 1_000),
    ...overrides,
  };
}

function writeJson(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function sessionPath(home: string, sessionId: string): string {
  return join(home, ".codialectic", "sessions", `${sessionId}.json`);
}

function runStatusline(
  home: string,
  input: string,
  workspace = join(home, "workspace"),
): { exitCode: number; stdout: string; stderr: string } {
  const proc = spawnSync("/bin/bash", [STATUSLINE], {
    cwd: home,
    env: {
      ...process.env,
      HOME: home,
      CODI_STATE_DIR: "",
      BRAIN_WORKSPACE_ROOT: "",
      CAREER_HOME: "",
      CODI_STALE_SECS: "900",
    },
    input,
    encoding: "utf8",
  });
  return {
    exitCode: proc.status ?? 0,
    stdout: (proc.stdout ?? "").trim(),
    stderr: (proc.stderr ?? "").trim(),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("XOS-237 turn-relative per-session liveness", () => {
  test("heartbeat after the current prompt stays LIVE after 3 hours mid-tool-call", () => {
    const home = temp("codi-237-home-");
    const workspace = temp("codi-237-workspace-");
    const now = Date.now();
    const currentTurn = state({
      last_user_prompt_ts: iso(now - 3 * 60 * 60 * 1000 - 1_000),
      last_protocol_ts: iso(now - 3 * 60 * 60 * 1000),
    });
    writeJson(sessionPath(home, "session-a"), currentTurn);

    const evaluated = evaluateSharedLiveness(currentTurn, "4.38.0", new Date(now), 900);
    const rendered = runStatusline(
      home,
      JSON.stringify({ session_id: "session-a", cwd: workspace, workspace: { project_dir: workspace } }),
      workspace,
    );

    expect(evaluated.live).toBe(true);
    expect(evaluated.degraded).toBe(false);
    expect(evaluated.stale).toBe(false);
    expect(rendered.exitCode).toBe(0);
    expect(rendered.stdout).toContain("Product · 88% · Cal: 96%");
    expect(rendered.stdout).not.toContain("DEGRADED");
  });

  test("heartbeat before the current prompt and beyond grace is DEGRADED", () => {
    const home = temp("codi-237-home-");
    const now = Date.now();
    const missedTurn = state({
      last_protocol_ts: iso(now - 901_000),
      last_user_prompt_ts: iso(now - 900_000),
    });
    writeJson(sessionPath(home, "session-stale"), missedTurn);

    const evaluated = evaluateSharedLiveness(missedTurn, "4.38.0", new Date(now), 900);
    const rendered = runStatusline(home, JSON.stringify({ session_id: "session-stale", cwd: home }));

    expect(evaluated.degraded).toBe(true);
    expect(evaluated.reasons).toContain("protocol-before-user-prompt");
    expect(rendered.stdout).toContain("⚠ Codi DEGRADED");
  });

  test("no session file is UNKNOWN/uninitialized, never degraded", () => {
    const home = temp("codi-237-home-");
    const rendered = runStatusline(home, JSON.stringify({ session_id: "brand-new", cwd: home }));

    expect(rendered.exitCode).toBe(0);
    expect(rendered.stdout).toBe("🧠 Co-Dialectic · uninitialized");
    expect(rendered.stdout).not.toContain("DEGRADED");
  });

  test("session A heartbeat cannot make session B look live", () => {
    const home = temp("codi-237-home-");
    const liveA = state();
    writeJson(sessionPath(home, "session-a"), liveA);
    writeJson(join(home, ".codialectic", "state.json"), liveA);

    const a = runStatusline(home, JSON.stringify({ session_id: "session-a", cwd: home }));
    const b = runStatusline(home, JSON.stringify({ session_id: "session-b", cwd: home }));

    expect(a.stdout).toContain("Product · 88% · Cal: 96%");
    expect(b.stdout).toBe("🧠 Co-Dialectic · uninitialized");
    expect(b.stdout).not.toContain("Product");
  });

  test("empty and unparseable stdin fall back to legacy state without crashing", () => {
    const home = temp("codi-237-home-");
    writeJson(join(home, ".codialectic", "state.json"), state());

    for (const input of ["", "{not-json"]) {
      const rendered = runStatusline(home, input);
      expect(rendered.exitCode).toBe(0);
      expect(rendered.stderr).toBe("");
      expect(rendered.stdout).toContain("Product · 88% · Cal: 96%");
      expect(rendered.stdout).not.toContain("DEGRADED");
    }
  });

  test("XOS-197 fresh pre-SessionStart heartbeat and XOS-149 version skew remain LIVE", () => {
    const home = temp("codi-237-home-");
    const now = Date.now();
    writeJson(sessionPath(home, "compat"), state({
      version: "4.1.0",
      last_protocol_ts: iso(now - 20_000),
      last_user_prompt_ts: iso(now - 30_000),
      last_session_start_ts: iso(now - 10_000),
    }));

    const rendered = runStatusline(home, JSON.stringify({ session_id: "compat", cwd: home }));
    expect(rendered.stdout).toContain("Product · 88% · Cal: 96%");
    expect(rendered.stdout).not.toContain("DEGRADED");
  });
});

describe("XOS-237 writers and artifact ownership", () => {
  test("workspace canonical active state outranks a stale global active:false fallback", () => {
    const home = temp("codi-237-home-");
    const workspace = temp("codi-237-workspace-");
    writeJson(join(home, ".codialectic", "state.json"), state({ active: false }));
    writeJson(join(workspace, "co-dialectic", "status-state.json"), state({ active: true }));

    const proc = spawnSync(process.execPath, [USER_PROMPT_SUBMIT], {
      cwd: workspace,
      env: {
        ...process.env,
        HOME: home,
        CODI_STATE_DIR: "",
        BRAIN_WORKSPACE_ROOT: "",
        CAREER_HOME: "",
        CLAUDE_PLUGIN_ROOT: "",
      },
      input: JSON.stringify({ session_id: "canonical-session", cwd: workspace }),
      encoding: "utf8",
    });
    const output = JSON.parse((proc.stdout ?? "").trim());

    expect(proc.status).toBe(0);
    expect(output.hookSpecificOutput.additionalContext).not.toBe("");
    expect(output.systemMessage).toContain("uninitialized for this session");
    expect(JSON.parse(readFileSync(sessionPath(home, "canonical-session"), "utf8")).active).toBe(true);
  });

  test("UserPromptSubmit creates only this session's prompt marker and never fakes heartbeat", () => {
    const home = temp("codi-237-home-");
    const workspace = temp("codi-237-workspace-");
    const canonical = state({ last_protocol_ts: "2026-01-01T00:00:00Z" });
    writeJson(join(workspace, "co-dialectic", "status-state.json"), canonical);

    const proc = spawnSync(process.execPath, [USER_PROMPT_SUBMIT], {
      cwd: workspace,
      env: {
        ...process.env,
        HOME: home,
        CODI_STATE_DIR: "",
        BRAIN_WORKSPACE_ROOT: "",
        CAREER_HOME: "",
        CLAUDE_PLUGIN_ROOT: "",
      },
      input: JSON.stringify({ session_id: "writer-session", cwd: workspace }),
      encoding: "utf8",
    });
    const written = JSON.parse(readFileSync(sessionPath(home, "writer-session"), "utf8"));

    expect(proc.status).toBe(0);
    expect(written.session_id).toBe("writer-session");
    expect(Date.parse(written.last_user_prompt_ts)).toBeGreaterThan(0);
    expect("last_protocol_ts" in written).toBe(false);
    expect(JSON.parse(readFileSync(join(workspace, "co-dialectic", "status-state.json"), "utf8"))).toEqual(canonical);
  });

  test("verified Stop heartbeat writes only the current session file", () => {
    const home = temp("codi-237-home-");
    const workspace = temp("codi-237-workspace-");
    const canonicalPath = join(workspace, "co-dialectic", "status-state.json");
    const canonical = state({ last_protocol_ts: "2026-01-01T00:00:00Z", growth_total_turns: 41 });
    writeJson(canonicalPath, canonical);
    const transcript = join(workspace, "transcript.jsonl");
    writeFileSync(transcript, JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "📦 Product · 91% · Cal: 97% · [12:00]\nDone." }],
      },
    }) + "\n");

    const before = Date.now();
    const proc = spawnSync(process.execPath, [STATUS_LIVENESS_CHECK], {
      cwd: workspace,
      env: {
        ...process.env,
        HOME: home,
        CODI_STATE_DIR: "",
        BRAIN_WORKSPACE_ROOT: "",
        CAREER_HOME: "",
      },
      input: JSON.stringify({ session_id: "stop-session", cwd: workspace, transcript_path: transcript }),
      encoding: "utf8",
    });
    const session = JSON.parse(readFileSync(sessionPath(home, "stop-session"), "utf8"));

    expect(proc.status).toBe(0);
    expect(Date.parse(session.last_protocol_ts)).toBeGreaterThanOrEqual(before);
    expect(session.last_score).toBe(91);
    expect(session.last_cal).toBe(97);
    expect(session.growth_total_turns).toBe(42);
    expect(JSON.parse(readFileSync(canonicalPath, "utf8"))).toEqual(canonical);
    expect(existsSync(join(home, ".codialectic", "state.json"))).toBe(false);
  });

  test("new precompact packets and marker land under workspace brain/sessions/<session_id>", () => {
    const home = temp("codi-237-home-");
    const workspace = temp("codi-237-workspace-");
    const proc = spawnSync(process.execPath, [PRECOMPACT], {
      cwd: workspace,
      env: { ...process.env, HOME: home },
      input: JSON.stringify({
        session_id: "packet-session",
        cwd: workspace,
        transcript_path: join(workspace, "transcript.jsonl"),
        trigger: "auto",
      }),
      encoding: "utf8",
    });
    const packetDir = join(workspace, "brain", "sessions", "packet-session");
    const packets = readdirSync(packetDir).filter((name) => name.startsWith("precompact-packet-packet-session-"));

    expect(proc.status).toBe(0);
    expect(packets).toHaveLength(1);
    expect(existsSync(join(packetDir, "last-precompact.json"))).toBe(true);
    expect(existsSync(join(home, ".codialectic"))).toBe(false);
    const packet = JSON.parse(readFileSync(join(packetDir, packets[0]!), "utf8"));
    expect(packet.cwd).toBe(workspace);
    expect(packet.session_id).toBe("packet-session");
  });
});
