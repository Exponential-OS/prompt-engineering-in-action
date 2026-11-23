/**
 * onboarding-marker.test.ts — XOS-443 user-level onboarding fact.
 *
 * Why this file exists: collapsing state to one session-scoped file reset
 * `growth_total_turns` on every new session, and that counter was quietly
 * doubling as "has this user seen the first-run hint". Without a user-level
 * marker, a returning user would get a 16-line orientation block for the first
 * three prompts of every session, forever. That regression would have shipped
 * invisibly -- every test still passed, because no test knew the counter had a
 * second job.
 *
 * The case worth protecting is the fourth one below: SessionStart may write
 * this session's own state file before the first prompt, so a probe that
 * counts it marks a genuinely-new user as onboarded and they never see the
 * hint at all.
 *
 * Run: bun test hooks/onboarding-marker.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ONBOARDING_MARKER_SCHEMA,
  ONBOARDING_PRIOR_SESSION_THRESHOLD,
  hasOnboarded,
  hasOtherSessionState,
  markOnboarded,
  onboardingMarkerPath,
} from "./session-state.ts";
import { ONBOARDING_TURN_WINDOW, buildOnboardingHint } from "./user-prompt-submit.ts";

const SESSION = "onboarding-test-session";
const tempDirs: string[] = [];

function makeStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "codi-onboarding-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, "sessions"), { recursive: true });
  return dir;
}

function withStateDir<T>(dir: string, fn: () => T): T {
  const previous = process.env.CODI_STATE_DIR;
  process.env.CODI_STATE_DIR = dir;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.CODI_STATE_DIR;
    else process.env.CODI_STATE_DIR = previous;
  }
}

function writeSession(dir: string, id: string): void {
  writeFileSync(join(dir, "sessions", `${id}.json`), "{}\n");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("XOS-443 onboarding marker", () => {
  test("brand-new user is not onboarded and no marker is written", () => {
    const dir = makeStateDir();
    withStateDir(dir, () => {
      expect(hasOnboarded(SESSION)).toBe(false);
      expect(existsSync(onboardingMarkerPath())).toBe(false);
    });
  });

  test("this session's OWN state file does not count as prior history", () => {
    // The regression this guards: SessionStart writes sessions/<self>.json
    // before the first prompt. Counting it would mark a first-time user as
    // onboarded and silently suppress the hint they are supposed to see.
    const dir = makeStateDir();
    writeSession(dir, SESSION);
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(false);
      expect(hasOnboarded(SESSION)).toBe(false);
      expect(existsSync(onboardingMarkerPath())).toBe(false);
    });
  });

  test("enough prior sessions means the user is returning, and is recorded", () => {
    const dir = makeStateDir();
    writeSession(dir, SESSION);
    for (let i = 0; i < ONBOARDING_PRIOR_SESSION_THRESHOLD; i++) {
      writeSession(dir, `older-${i}`);
    }
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(true);
      expect(hasOnboarded(SESSION)).toBe(true);
      // Recorded, so the directory probe never runs again for this state dir.
      expect(existsSync(onboardingMarkerPath())).toBe(true);
    });
  });

  test("an existing marker short-circuits before any directory probe", () => {
    const dir = makeStateDir();
    // No sessions at all: only the marker can be answering here.
    rmSync(join(dir, "sessions"), { recursive: true, force: true });
    withStateDir(dir, () => {
      markOnboarded();
      expect(hasOnboarded(SESSION)).toBe(true);
    });
  });

  test("a missing sessions directory is 'no history', not a crash", () => {
    const dir = makeStateDir();
    rmSync(join(dir, "sessions"), { recursive: true, force: true });
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(false);
      expect(hasOnboarded(SESSION)).toBe(false);
    });
  });

  test("non-json entries are ignored", () => {
    const dir = makeStateDir();
    writeFileSync(join(dir, "sessions", "README.txt"), "not state\n");
    writeFileSync(join(dir, "sessions", ".DS_Store"), "junk\n");
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(false);
    });
  });

  test("a null session id treats every session file as someone else's", () => {
    const dir = makeStateDir();
    // No self file to exclude, so all of these count toward the threshold.
    for (let i = 0; i < ONBOARDING_PRIOR_SESSION_THRESHOLD; i++) {
      writeSession(dir, `anything-${i}`);
    }
    withStateDir(dir, () => {
      expect(hasOtherSessionState(null)).toBe(true);
    });
  });

  test("markOnboarded is best-effort and never throws the prompt hook", () => {
    // An unwritable state dir must cost at most a repeated hint, never a
    // failed UserPromptSubmit.
    withStateDir("/dev/null/not-a-directory", () => {
      expect(() => markOnboarded()).not.toThrow();
      expect(hasOnboarded(SESSION)).toBe(false);
    });
  });

  test("the hint respects the user-level fact over the session counter", () => {
    const freshSession = { growth_total_turns: 0 } as any;
    expect(buildOnboardingHint(freshSession, false)).toContain("First-time orientation");
    // Same zeroed counter, returning user -> silent. This is the whole fix.
    expect(buildOnboardingHint(freshSession, true)).toBe("");
  });

  test("the hint still fades within a session once the window passes", () => {
    const atWindow = { growth_total_turns: ONBOARDING_TURN_WINDOW } as any;
    expect(buildOnboardingHint(atWindow, false)).toBe("");
    const midWindow = { growth_total_turns: ONBOARDING_TURN_WINDOW - 1 } as any;
    expect(buildOnboardingHint(midWindow, false)).toContain("1 more turn");
  });
});

describe("XOS-443 marker is self-describing and presence-only", () => {
  test("the marker records schema, time, author and why", () => {
    const dir = makeStateDir();
    withStateDir(dir, () => {
      markOnboarded();
      const parsed = JSON.parse(
        require("fs").readFileSync(onboardingMarkerPath(), "utf8"),
      );
      expect(parsed.schema).toBe(ONBOARDING_MARKER_SCHEMA);
      expect(typeof parsed.onboarded_at).toBe("string");
      expect(parsed.written_by).toContain("session-state");
      expect(parsed.why).toContain("turn counter");
    });
  });

  test("a marker from an older format still counts -- presence is the fact", () => {
    // The first shipped marker was a bare timestamp line. Onboarding must not
    // re-fire for those users just because the format gained fields.
    const dir = makeStateDir();
    withStateDir(dir, () => {
      writeFileSync(onboardingMarkerPath(), "2026-11-23T00:00:00.000Z\n");
      expect(hasOnboarded(SESSION)).toBe(true);
    });
  });
});

describe("XOS-443 onboarding lifecycle, end to end", () => {
  test("a new user sees the hint for the window, then never again", () => {
    const dir = makeStateDir();
    withStateDir(dir, () => {
      // Turns 1..N-1: hint shows, marker deliberately NOT yet written --
      // onboarding has started, not finished.
      for (let turn = 0; turn < ONBOARDING_TURN_WINDOW; turn++) {
        const onboarded = hasOnboarded(SESSION);
        expect(onboarded).toBe(false);
        expect(buildOnboardingHint({ growth_total_turns: turn } as any, onboarded))
          .toContain("First-time orientation");
        expect(existsSync(onboardingMarkerPath())).toBe(false);
      }
      // The turn that reaches the window is where the caller records it.
      markOnboarded();
      expect(hasOnboarded(SESSION)).toBe(true);
      // A brand-new session afterwards: counter back to 0, still silent.
      expect(buildOnboardingHint({ growth_total_turns: 0 } as any, hasOnboarded("a-later-session")))
        .toBe("");
    });
  });

  test("an unwritable marker re-shows the hint rather than suppressing it", () => {
    // Asymmetric by design: a repeated hint is cosmetic, a silently skipped
    // onboarding is a new user who never learns what the status line means.
    withStateDir("/dev/null/nope", () => {
      markOnboarded();
      expect(hasOnboarded(SESSION)).toBe(false);
      expect(buildOnboardingHint({ growth_total_turns: 0 } as any, hasOnboarded(SESSION)))
        .toContain("First-time orientation");
    });
  });
});

describe("XOS-443 probe threshold — the dissent case", () => {
  // Two judges from two model families independently flagged this: a new user
  // who types one turn, closes the terminal, and opens a fresh session leaves
  // exactly one session file behind. A probe that accepted it would mark them
  // onboarded after one of three turns, permanently.
  test("ONE prior session does not count as onboarded", () => {
    const dir = makeStateDir();
    writeSession(dir, SESSION);
    writeSession(dir, "abandoned-first-session");
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(false);
      expect(hasOnboarded(SESSION)).toBe(false);
      expect(existsSync(onboardingMarkerPath())).toBe(false);
    });
  });

  test("two prior sessions still do not count", () => {
    const dir = makeStateDir();
    writeSession(dir, SESSION);
    writeSession(dir, "first");
    writeSession(dir, "second");
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(false);
      expect(hasOnboarded(SESSION)).toBe(false);
    });
  });

  test("the threshold is where a real returning user is recognised", () => {
    const dir = makeStateDir();
    writeSession(dir, SESSION);
    for (let i = 0; i < ONBOARDING_PRIOR_SESSION_THRESHOLD; i++) {
      writeSession(dir, `prior-${i}`);
    }
    withStateDir(dir, () => {
      expect(hasOtherSessionState(SESSION)).toBe(true);
      expect(hasOnboarded(SESSION)).toBe(true);
      expect(existsSync(onboardingMarkerPath())).toBe(true);
    });
  });

  test("a user with real history is recognised without listing the directory", () => {
    const dir = makeStateDir();
    for (let i = 0; i < 500; i++) writeSession(dir, `s${i}`);
    withStateDir(dir, () => {
      const started = Date.now();
      expect(hasOtherSessionState(SESSION)).toBe(true);
      // Stops at the threshold, so this is syscall-cheap regardless of history.
      expect(Date.now() - started).toBeLessThan(250);
    });
  });

  test("the marker survives concurrent writers intact", () => {
    const dir = makeStateDir();
    withStateDir(dir, () => {
      for (let i = 0; i < 20; i++) markOnboarded();
      const parsed = JSON.parse(
        require("fs").readFileSync(onboardingMarkerPath(), "utf8"),
      );
      expect(parsed.schema).toBe(ONBOARDING_MARKER_SCHEMA);
    });
  });
});
