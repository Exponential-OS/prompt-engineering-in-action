#!/usr/bin/env bun
/**
 * xos-213-liveness-parity.test.ts
 *
 * Drives EVERY liveness implementation over the SAME fixture table and requires
 * them to agree. Before this existed, `statusline.sh` carried the comment
 * "Keep this predicate in sync with hooks/liveness.ts" — a hand-maintained
 * contract, which is the drift hazard XOS-213 was filed for.
 *
 * Implementations under parity:
 *   1. evaluateSharedLiveness      (hooks/liveness.ts)          — canonical
 *   2. evaluateCodiLiveness        (hooks/user-prompt-submit.ts) — hook path
 *   3. statusline.sh                                            — shell render
 *
 * statusline.sh is executed for real, in an isolated CODI_STATE_DIR, with the
 * session id fed on stdin exactly as Claude Code supplies it. Its rendered line
 * is classified back into LIVE / DEGRADED / UNINITIALIZED and compared.
 *
 * Written in bun:test form deliberately. An earlier draft of this file was a
 * standalone script that called process.exit() at module scope; because
 * `bun test` globs *.test.ts, that exit aborted the RUNNER and silently
 * prevented the other five suites in this directory from running at all.
 */

import { describe, test, expect } from "bun:test";
import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { evaluateSharedLiveness } from "./liveness.ts";
import { evaluateCodiLiveness } from "./user-prompt-submit.ts";
import {
  LIVENESS_FIXTURES,
  FIXTURE_STALE_SECS,
  type Classification,
  type LivenessFixture,
} from "./liveness-fixtures.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATUSLINE = join(HERE, "statusline.sh");
const VERSION = "4.40.0";

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Build the on-disk state object for a fixture, relative to `now`. */
function stateFor(f: LivenessFixture, now: Date): Record<string, unknown> {
  const at = (ago: number | null) =>
    ago === null ? undefined : iso(new Date(now.getTime() - ago * 1000));
  const s: Record<string, unknown> = { schema_version: "1.0.0", version: VERSION };
  const p = at(f.protocolAgo);
  const q = at(f.promptAgo);
  const r = at(f.sessionAgo);
  if (p !== undefined) s.last_protocol_ts = p;
  if (q !== undefined) s.last_user_prompt_ts = q;
  if (r !== undefined) s.last_session_start_ts = r;
  if (f.active !== undefined) s.active = f.active;
  return s;
}

function classifyShared(state: Record<string, unknown>, now: Date): Classification {
  const r = evaluateSharedLiveness(state as any, VERSION, now, FIXTURE_STALE_SECS, "boolean-or-string");
  if (r.degraded) return "DEGRADED";
  if (r.unknown) return "UNINITIALIZED";
  return "LIVE";
}

function classifyHookPath(state: Record<string, unknown>, now: Date): Classification {
  const r = evaluateCodiLiveness(state as any, VERSION, now, FIXTURE_STALE_SECS);
  if (r.degraded) return "DEGRADED";
  if (r.unknown) return "UNINITIALIZED";
  return "LIVE";
}

/** Run statusline.sh for real and classify its rendered output. */
function classifyStatusline(state: Record<string, unknown>): { cls: Classification; raw: string } {
  const dir = mkdtempSync(join(tmpdir(), "codi-parity-"));
  try {
    const sessionId = "paritysession";
    mkdirSync(join(dir, "sessions"), { recursive: true });
    writeFileSync(join(dir, "sessions", `${sessionId}.json`), JSON.stringify(state));
    const res = spawnSync("/bin/bash", [STATUSLINE], {
      input: JSON.stringify({ session_id: sessionId, cwd: dir }),
      encoding: "utf8",
      env: {
        ...process.env,
        CODI_STATE_DIR: dir,
        CODI_STALE_SECS: String(FIXTURE_STALE_SECS),
        BRAIN_WORKSPACE_ROOT: dir,
      },
      timeout: 20_000,
    });
    const raw = `${res.stdout ?? ""}`.trim();
    let cls: Classification;
    if (/DEGRADED/.test(raw)) cls = "DEGRADED";
    else if (/uninitialized/i.test(raw)) cls = "UNINITIALIZED";
    else cls = "LIVE";
    return { cls, raw };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("XOS-213 liveness parity", () => {
  // If the shell cannot render at all, every parity case would trivially agree
  // on nothing. Prove the harness exercises the real script before trusting it.
  test("harness actually exercises statusline.sh", () => {
    const probe = classifyStatusline({
      schema_version: "1.0.0",
      version: VERSION,
      active: true,
      last_protocol_ts: iso(new Date()),
      last_user_prompt_ts: iso(new Date(Date.now() - 5000)),
    });
    expect(probe.raw.length).toBeGreaterThan(0);
    expect(probe.cls).toBe("LIVE");
  });

  for (const f of LIVENESS_FIXTURES) {
    describe(f.name, () => {
      test(`canonical evaluator classifies as ${f.expect}`, () => {
        const now = new Date();
        expect(classifyShared(stateFor(f, now), now)).toBe(f.expect);
      });

      test("user-prompt-submit agrees with canonical", () => {
        const now = new Date();
        const state = stateFor(f, now);
        expect(classifyHookPath(state, now)).toBe(classifyShared(state, now));
      });

      test("statusline.sh agrees with canonical", () => {
        const now = new Date();
        const state = stateFor(f, now);
        const canonical = classifyShared(state, now);
        const { cls, raw } = classifyStatusline(state);
        // raw is included so a failure names what the shell actually printed.
        expect({ cls, raw: cls === canonical ? raw : `MISMATCH: ${raw}` }.cls).toBe(canonical);
      });
    });
  }
});
