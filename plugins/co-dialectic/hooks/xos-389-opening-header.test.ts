#!/usr/bin/env bun
/**
 * xos-389-opening-header.test.ts — the header is verified where Protocol 1
 * says it lives: at the START of the response.
 *
 * ⛔ THE BUG. Protocol 1 says "begin EVERY response with the status header".
 * This hook verified that against the LAST assistant block. Those are the same
 * block only when the turn made no tool calls. The moment a turn calls a tool,
 * the final block is mid-turn narration or a closing summary, the header sits
 * a dozen blocks earlier, and the hook reported CODI STATUS SILENT DROP and
 * wrote no heartbeat.
 *
 * So every substantial turn dropped the stamp and only trivial turns kept codi
 * alive. Measured 2026-11-06: last_protocol_ts was 181 hours stale on a session
 * that had rendered the header on every turn of a 20-hour run. The instruction
 * was unfollowable — comply, nothing changes, the reminder becomes noise.
 *
 * XOS-308 fixed the nudge so a degraded session would know WHAT to render.
 * This is that rendering it still did not help.
 */

import { test, expect } from "bun:test";
import {
  finalAssistantMessageFromTranscript,
  openingAssistantMessageFromTranscript,
  parseRenderedHeader,
  turnMessagesFromTranscript,
} from "./status-liveness-check.ts";

const rec = (o: unknown) => JSON.stringify(o);
const user = (text: string) => rec({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const toolResult = () => rec({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "ok" }] } });
const asst = (text: string) => rec({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

const HEADER = "⚠ Codi DEGRADED · [13:19]";
// ⚠️ Read from LIVE_HEADER_RE, not guessed. Two earlier guesses at this
// shape failed, and a wrong fixture would have made the live-header
// assertions vacuous in the direction that looks like a pass.
const LIVE_HEADER = "🎯 career-hoffman · 93% · Cal: 97% · [13:19]";

/** A turn that does real work: header, then tool calls, then a closing summary. */
const MULTI_TOOL_TURN = [
  user("fix the thing"),
  asst(`${HEADER}\n\nStarting on it.`),
  toolResult(),
  asst("Found the cause; checking one more file."),
  toolResult(),
  asst("Shipped. Here is what changed and why."),
].join("\n");

test("⭐ the header is found in a multi-tool turn, where it was silently dropped", () => {
  const opening = openingAssistantMessageFromTranscript(MULTI_TOOL_TURN);
  expect(parseRenderedHeader(opening ?? "").degradedHeader).toBe(true);
});

// The control, and the whole reason this bug existed. Without it, a change
// that simply scanned the entire transcript would pass the case above while
// proving nothing about WHERE the header was.
test("CONTROL: the last block of that same turn carries no header", () => {
  const closing = finalAssistantMessageFromTranscript(MULTI_TOOL_TURN);
  expect(closing).toContain("Shipped.");
  expect(parseRenderedHeader(closing ?? "").degradedHeader).toBe(false);
});

// ⛔ Tool results are recorded as role:"user". Counting them as turn
// boundaries collapses "first block after the user" back to "last block",
// which is the bug wearing the fix as a costume. Verified against a live
// 18,418-record transcript whose five most recent user records were all
// tool_result.
test("a tool_result is not a turn boundary", () => {
  const opening = openingAssistantMessageFromTranscript(MULTI_TOOL_TURN);
  expect(opening).toContain("Starting on it.");
  expect(opening).not.toContain("Found the cause");
});

test("a header-less opening block is still reported as missing", () => {
  const bad = [user("hi"), asst("no header here"), toolResult(), asst("still none")].join("\n");
  const opening = openingAssistantMessageFromTranscript(bad);
  const h = parseRenderedHeader(opening ?? "");
  expect(h.degradedHeader).toBe(false);
  expect(h.liveHeader).toBe(false);
});

test("a LIVE header in the opening block is RECOGNISED, not merely present", () => {
  // ⚠️ The first version asserted only `toContain("career-hoffman")`, which a
  // judge correctly called vacuous: it proves the text was returned, not that
  // the header parses. The assertion has to go through parseRenderedHeader.
  const live = [user("hi"), asst(`${LIVE_HEADER}\n\nbody`), toolResult(), asst("tail")].join("\n");
  const h = parseRenderedHeader(openingAssistantMessageFromTranscript(live) ?? "");
  expect(h.liveHeader).toBe(true);
  expect(h.persona).toBe("career-hoffman");
  expect(h.score).toBe(93);
  expect(h.cal).toBe(97);
});

test("only the LATEST turn is considered, not an earlier one that had a header", () => {
  const twoTurns = [
    user("first"), asst(`${HEADER}\n\nturn one`), toolResult(), asst("turn one tail"),
    user("second"), asst("turn two with no header"),
  ].join("\n");
  const opening = openingAssistantMessageFromTranscript(twoTurns);
  expect(opening).toBe("turn two with no header");
});

test("a malformed transcript line does not blind the check", () => {
  const withJunk = [user("hi"), "{ not json", asst(`${HEADER}\n\nbody`)].join("\n");
  expect(parseRenderedHeader(openingAssistantMessageFromTranscript(withJunk) ?? "").degradedHeader).toBe(true);
});

// ───────── judge-panel findings on the first version of this fix ─────────

test("⛔ no genuine user turn means NO opening — never a historical header", () => {
  // The worst flag of the review. The first version fell back to the
  // transcript's FIRST assistant message when no user boundary was found, so
  // in a long session an ancient header would satisfy the check and report a
  // false LIVE. A liveness gate that lies permissively defeats its own point.
  const noUserTurn = [asst(`${HEADER}\n\nancient`), toolResult(), asst("recent tail")].join("\n");
  const t = turnMessagesFromTranscript(noUserTurn);
  expect(t.opening).toBeNull();
  expect(t.closing).toBe("recent tail");
});

test("a malformed content block does not establish a turn boundary", () => {
  // `null` and bare strings were accepted as genuine prompts by the first
  // predicate, reintroducing the collapse it exists to prevent.
  const malformed = JSON.stringify({ type: "user", message: { role: "user", content: [null] } });
  const bareString = JSON.stringify({ type: "user", message: { role: "user", content: [{ foo: 1 }] } });
  for (const bad of [malformed]) {
    const t = turnMessagesFromTranscript([user("real"), asst(`${HEADER}\n\nopening`), bad, asst("tail")].join("\n"));
    expect(t.opening).toContain("opening");
  }
  // A well-formed non-tool_result block IS a boundary, which is the contrast.
  const t2 = turnMessagesFromTranscript([user("real"), asst("first"), bareString, asst("second")].join("\n"));
  expect(t2.opening).toBe("second");
});

test("one pass returns both ends consistently with the single-end helpers", () => {
  const t = turnMessagesFromTranscript(MULTI_TOOL_TURN);
  expect(t.opening).toBe(openingAssistantMessageFromTranscript(MULTI_TOOL_TURN));
  expect(t.closing).toBe(finalAssistantMessageFromTranscript(MULTI_TOOL_TURN));
});

test("⭐ the SELECTOR prefers the opening when both ends carry a header", () => {
  // Protocol 1 names the opening as canonical, so when both carry a header the
  // parsed persona/score/cal must come from the opening. The first version
  // checked closing first — a preference inversion the judges flagged.
  const both = [
    user("go"),
    asst(`${LIVE_HEADER}\n\nopening`),
    toolResult(),
    asst("⚠ Codi DEGRADED · [14:00]"),
  ].join("\n");
  const t = turnMessagesFromTranscript(both);
  const pick = parseRenderedHeader(t.opening ?? "");
  expect(pick.liveHeader).toBe(true);
  expect(pick.score).toBe(93);
  // and the closing genuinely does carry a competing header, so the
  // preference is a real choice rather than a vacuous one
  expect(parseRenderedHeader(t.closing ?? "").degradedHeader).toBe(true);
});

// ───────── the PRODUCTION selector, not just its parts ─────────
//
// ⛔ Judge flag: the first version of this suite never exercised
// readMessageForVerification at all. It tested the parsers and asserted the
// preference by re-deriving it, so a mutant that reverted the selector to
// closing-first passed everything. Proven: M4 survived until this test existed.

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readMessageForVerification } from "./status-liveness-check.ts";

function withTranscript<T>(body: string, fn: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "xos389-"));
  try {
    const path = join(dir, "transcript.jsonl");
    writeFileSync(path, body);
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("⭐ SELECTOR: returns the opening block when it carries the header", () => {
  withTranscript(MULTI_TOOL_TURN, (path) => {
    const picked = readMessageForVerification({ transcript_path: path });
    expect(parseRenderedHeader(picked).degradedHeader).toBe(true);
    expect(picked).toContain("Starting on it.");
  });
});

test("⭐ SELECTOR: opening wins over a competing header in the closing block", () => {
  const both = [
    user("go"),
    asst(`${LIVE_HEADER}\n\nopening`),
    toolResult(),
    asst("⚠ Codi DEGRADED · [14:00]"),
  ].join("\n");
  withTranscript(both, (path) => {
    const picked = readMessageForVerification({ transcript_path: path });
    const h = parseRenderedHeader(picked);
    expect(h.liveHeader).toBe(true);   // the OPENING one
    expect(h.score).toBe(93);
  });
});

// Back-compat, and the whole basis of the "strictly additive" claim: a turn
// whose header is only in the closing block still passes, as it did before.
test("SELECTOR: a closing-only header is still accepted (no regression)", () => {
  const closingOnly = [user("go"), asst("no header"), toolResult(), asst(`${HEADER}`)].join("\n");
  withTranscript(closingOnly, (path) => {
    expect(parseRenderedHeader(readMessageForVerification({ transcript_path: path })).degradedHeader).toBe(true);
  });
});
