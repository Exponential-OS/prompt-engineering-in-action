/**
 * xos_146_status_liveness_check.test.ts — in-message status header liveness.
 *
 * Run: bun test tests/xos_146_status_liveness_check.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  checkStatusLiveness,
  evaluateStatusFreshness,
  finalAssistantMessageFromTranscript,
} from "../hooks/status-liveness-check.ts";

const PLUGIN_ROOT = join(import.meta.dir, "..");
const STATUSLINE = join(PLUGIN_ROOT, "hooks", "statusline.sh");
const STATUS_LIVENESS_CHECK = join(PLUGIN_ROOT, "hooks", "status-liveness-check.ts");
const NOW = new Date("2026-06-29T12:00:00Z");

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
  return {
    active: true,
    mode: "drive",
    persona: "Product",
    persona_icon: "📦",
    last_score: 88,
    last_cal: 96,
    installed_version: "4.27.0",
    version: "4.27.0",
    last_session_start_ts: isoSeconds(new Date(NOW.getTime() - 10 * 60 * 1000)),
    last_protocol_ts: isoSeconds(new Date(NOW.getTime() - 60 * 1000)),
    ...overrides,
  };
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

function transcriptWithAssistant(message: string): string {
  return JSON.stringify({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text: message }],
    },
  }) + "\n";
}

function runStatuslineVerdict(home: string): "LIVE" | "DEGRADED" {
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
  const stdout = new TextDecoder().decode(proc.stdout);
  return stdout.includes("DEGRADED") ? "DEGRADED" : "LIVE";
}

function runHook(home: string, transcriptPath: string): { exitCode: number; stdout: string } {
  const proc = spawnSync(process.execPath, [STATUS_LIVENESS_CHECK], {
    env: {
      ...process.env,
      HOME: home,
      CODI_STALE_SECS: "900",
    },
    input: JSON.stringify({ transcript_path: transcriptPath }),
    encoding: "utf8",
  });
  return {
    exitCode: proc.status ?? 0,
    stdout: (proc.stdout ?? "").trim(),
  };
}

function runHookWithAssistant(home: string, message: string): { exitCode: number; stdout: string } {
  const transcript = join(makeTempDir("codi-xos-146-transcript-"), "transcript.jsonl");
  writeFileSync(transcript, transcriptWithAssistant(message));
  return runHook(home, transcript);
}

function systemMessageFromStdout(stdout: string): string {
  expect(stdout).not.toBe("");
  const parsed = JSON.parse(stdout) as { systemMessage?: unknown };
  expect(typeof parsed.systemMessage).toBe("string");
  return parsed.systemMessage as string;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("status-liveness-check hook decisions", () => {
  test("LIVE + matching numbers -> no nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product · 88% · Cal: 96% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.nudge).toBeNull();
  });

  test("LIVE + matching numbers without time bracket -> no nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product (Doshi) · 88% · Cal: 96%\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.header.liveHeader).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.nudge).toBeNull();
  });

  test("LIVE + Domain(Name) persona lead without icon -> no nudge", () => {
    const result = checkStatusLiveness(
      "Product (Doshi) · 88% · Cal: 96% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.header.liveHeader).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.nudge).toBeNull();
  });

  test("DEGRADED stale/absent last_protocol_ts + response has a percent -> fabrication nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product · 88% · Cal: 96% · [12:00]\nDone.",
      baseState({ last_protocol_ts: null }),
      NOW,
    );

    expect(result.freshness.degraded).toBe(true);
    expect(result.reason).toBe("fabrication");
    expect(result.nudge).toContain("CODI STATUS FABRICATION");
    expect(result.nudge).toContain("never invented numbers");
  });

  test("rendered score mismatch -> inconsistent nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product · 87% · Cal: 96% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.reason).toBe("inconsistent");
    expect(result.nudge).toContain("CODI STATUS INCONSISTENT");
    expect(result.nudge).toContain("Render only numbers you actually wrote to state.json this turn.");
  });

  test("rendered Cal mismatch -> inconsistent nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product · 88% · Cal: 95% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.reason).toBe("inconsistent");
  });

  test("LIVE + no status line -> silent-drop nudge", () => {
    const result = checkStatusLiveness("Done.", baseState(), NOW);

    expect(result.freshness.live).toBe(true);
    expect(result.reason).toBe("silent-drop");
    expect(result.nudge).toContain("CODI STATUS SILENT DROP");
    expect(result.nudge).toContain("codi is LIVE");
  });

  test("LIVE + prose percent on first line is silent drop, not a parsed score", () => {
    const result = checkStatusLiveness(
      "I'm 100% sure Cal: 96% [12:00]\nDone.",
      baseState({ last_score: 100, last_cal: 96 }),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.header.liveHeader).toBe(false);
    expect(result.header.hasNumericScore).toBe(false);
    expect(result.reason).toBe("silent-drop");
  });

  test("LIVE + arbitrary ASCII lead text is silent drop, not a valid header", () => {
    const result = checkStatusLiveness(
      "Results · 88% · Cal: 96% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.header.liveHeader).toBe(false);
    expect(result.header.hasNumericScore).toBe(false);
    expect(result.header.score).toBeNull();
    expect(result.header.cal).toBeNull();
    expect(result.reason).toBe("silent-drop");
  });

  test("DEGRADED + prose percent is missing degraded header, not fabrication", () => {
    const result = checkStatusLiveness(
      "I'm 100% sure Cal: 96% [12:00]\nDone.",
      baseState({ last_protocol_ts: null }),
      NOW,
    );

    expect(result.freshness.degraded).toBe(true);
    expect(result.header.liveHeader).toBe(false);
    expect(result.header.hasStatusScoreToken).toBe(false);
    expect(result.reason).toBe("missing-degraded-header");
  });

  test("DEGRADED + status-shaped score without Cal -> fabrication nudge", () => {
    for (const message of [
      "📦 Product (Doshi) · 99% · [12:00]\nDone.",
      "99% · [12:00]\nDone.",
    ]) {
      const result = checkStatusLiveness(message, baseState({ last_protocol_ts: null }), NOW);

      expect(result.freshness.degraded).toBe(true);
      expect(result.header.hasStatusScoreToken).toBe(true);
      expect(result.reason).toBe("fabrication");
      expect(result.nudge).toContain("CODI STATUS FABRICATION");
    }
  });

  test("DEGRADED + score-token later in message -> fabrication nudge", () => {
    const result = checkStatusLiveness(
      "⚠ Codi DEGRADED · [12:00]\nPrior header: · 88% · Cal: 96%",
      baseState({ last_protocol_ts: null }),
      NOW,
    );

    expect(result.freshness.degraded).toBe(true);
    expect(result.header.degradedHeader).toBe(true);
    expect(result.header.hasStatusScoreToken).toBe(true);
    expect(result.reason).toBe("fabrication");
    expect(result.nudge).toContain("CODI STATUS FABRICATION");
  });

  test("DEGRADED + no header at all -> missing degraded header nudge", () => {
    const result = checkStatusLiveness("Done.", baseState({ last_protocol_ts: null }), NOW);

    expect(result.freshness.degraded).toBe(true);
    expect(result.reason).toBe("missing-degraded-header");
    expect(result.nudge).toContain("codi is DEGRADED");
  });

  test("DEGRADED + correct degraded header with no numbers -> no nudge", () => {
    const result = checkStatusLiveness(
      "⚠ Codi DEGRADED · [12:00]\nDone.",
      baseState({ last_protocol_ts: null }),
      NOW,
    );

    expect(result.freshness.degraded).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.nudge).toBeNull();
  });

  test("missing state is treated as DEGRADED and numeric output fabricates", () => {
    const result = checkStatusLiveness(
      "📦 Product · 88% · Cal: 96% · [12:00]\nDone.",
      null,
      NOW,
    );

    expect(result.freshness.degraded).toBe(true);
    expect(result.reason).toBe("fabrication");
  });

  test("corrupt state.json is DEGRADED and numeric output fabricates on real hook path", () => {
    const home = makeTempDir("codi-xos-146-home-");
    writeRawState(home, '{"active":true,"last_score":88,');

    const result = runHookWithAssistant(home, "📦 Product (Doshi) · 88% · Cal: 96% · [12:00]\nDone.");

    expect(result.exitCode).toBe(0);
    expect(systemMessageFromStdout(result.stdout)).toContain("CODI STATUS FABRICATION");
  });

  test("missing state.json is DEGRADED and numeric output fabricates on real hook path", () => {
    const home = makeTempDir("codi-xos-146-home-");

    const result = runHookWithAssistant(home, "📦 Product (Doshi) · 88% · Cal: 96% · [12:00]\nDone.");

    expect(result.exitCode).toBe(0);
    expect(systemMessageFromStdout(result.stdout)).toContain("CODI STATUS FABRICATION");
  });

  test("state read failure + degraded header -> no nudge", () => {
    for (const setupState of [
      (home: string) => writeRawState(home, '{"active":true,"last_score":88,'),
      (_home: string) => {},
    ]) {
      const home = makeTempDir("codi-xos-146-home-");
      setupState(home);

      const result = runHookWithAssistant(home, "⚠ Codi DEGRADED\nDone.");

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
    }
  });

  test("state read failure + no header -> missing degraded header nudge", () => {
    for (const setupState of [
      (home: string) => writeRawState(home, '{"active":true,"last_score":88,'),
      (_home: string) => {},
    ]) {
      const home = makeTempDir("codi-xos-146-home-");
      setupState(home);

      const result = runHookWithAssistant(home, "Done.");

      expect(result.exitCode).toBe(0);
      expect(systemMessageFromStdout(result.stdout)).toContain("codi is DEGRADED");
    }
  });

  test("transcript parse failure fails open silently", () => {
    const home = makeTempDir("codi-xos-146-home-");
    const transcript = join(makeTempDir("codi-xos-146-transcript-"), "transcript.jsonl");
    writeState(home, baseState());
    writeFileSync(transcript, "{not json}\n");

    const result = runHook(home, transcript);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("unextractable final assistant message fails open silently", () => {
    const home = makeTempDir("codi-xos-146-home-");
    const transcript = join(makeTempDir("codi-xos-146-transcript-"), "transcript.jsonl");
    writeState(home, baseState());
    writeFileSync(transcript, JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }) + "\n");

    const result = runHook(home, transcript);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("missing transcript file fails open silently", () => {
    const home = makeTempDir("codi-xos-146-home-");
    writeState(home, baseState());

    const result = runHook(home, join(home, "missing-transcript.jsonl"));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("LIVE state (window-fresh) + matching score -> no nudge", () => {
    const result = checkStatusLiveness(
      "📦 Product · 88% · Cal: 96% · [12:00]\nDone.",
      baseState(),
      NOW,
    );

    expect(result.freshness.live).toBe(true);
    expect(result.scorePermitted).toBe(true);
    expect(result.reason).toBeNull();
  });
});

describe("transcript parsing", () => {
  test("reads the final assistant message from JSONL transcript records", () => {
    const transcript = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
      transcriptWithAssistant("first"),
      transcriptWithAssistant("second"),
    ].join("\n");

    expect(finalAssistantMessageFromTranscript(transcript)).toBe("second");
  });
});

describe("freshness predicate parity with statusline.sh", () => {
  test("boundary cases match XOS-141 rule", () => {
    const justInside = baseState({
      last_session_start_ts: isoSeconds(new Date(NOW.getTime() - 20 * 60 * 1000)),
      last_protocol_ts: isoSeconds(new Date(NOW.getTime() - 900 * 1000)),
    });
    const justOutside = baseState({
      last_session_start_ts: isoSeconds(new Date(NOW.getTime() - 20 * 60 * 1000)),
      last_protocol_ts: isoSeconds(new Date(NOW.getTime() - 901 * 1000)),
    });

    expect(evaluateStatusFreshness(justInside, NOW, 900).live).toBe(true);
    expect(evaluateStatusFreshness(justOutside, NOW, 900).degraded).toBe(true);
    // XOS-149: version mismatch is informational, NOT a degraded trigger (was the false-skew bug)
    const skewOnly = evaluateStatusFreshness(baseState({ version: "4.26.0" }), NOW, 900);
    expect(skewOnly.degraded).toBe(false);
    expect(skewOnly.skew).toBe(true);
    expect(evaluateStatusFreshness(baseState({ active: false }), NOW, 900).degraded).toBe(true);
    expect(evaluateStatusFreshness(
      baseState({
        last_session_start_ts: "2026-06-29T12:00:00Z",
        last_protocol_ts: "2026-06-29T11:59:59Z",
      }),
      NOW,
      900,
    ).degraded).toBe(true);
  });

  test("predicate verdict agrees with statusline.sh for fresh, stale, skewed, inactive, and pre-session state", () => {
    const now = new Date();
    const cases = [
      baseState({
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 20 * 60 * 1000)),
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 10 * 60 * 1000)),
      }),
      baseState({
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 40 * 60 * 1000)),
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 20 * 60 * 1000)),
      }),
      baseState({
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 20 * 60 * 1000)),
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 10 * 60 * 1000)),
        version: "4.26.0",
      }),
      baseState({
        active: false,
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 20 * 60 * 1000)),
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 10 * 60 * 1000)),
      }),
      baseState({
        last_session_start_ts: isoSeconds(new Date(now.getTime() - 60 * 1000)),
        last_protocol_ts: isoSeconds(new Date(now.getTime() - 120 * 1000)),
      }),
    ];

    for (const state of cases) {
      const home = makeTempDir("codi-xos-146-home-");
      writeState(home, state);
      const tsVerdict = evaluateStatusFreshness(state, now, 900).live ? "LIVE" : "DEGRADED";
      expect(tsVerdict).toBe(runStatuslineVerdict(home));
    }
  });
});
