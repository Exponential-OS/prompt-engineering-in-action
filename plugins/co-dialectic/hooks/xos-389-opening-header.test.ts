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
} from "./status-liveness-check.ts";

const rec = (o: unknown) => JSON.stringify(o);
const user = (text: string) => rec({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const toolResult = () => rec({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "ok" }] } });
const asst = (text: string) => rec({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });

const HEADER = "⚠ Codi DEGRADED · [13:19]";

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

test("a LIVE header in the opening block is recognised too, not just degraded", () => {
  const live = [user("hi"), asst("🎯 career-hoffman 93/97 · [13:19]\n\nbody"), toolResult(), asst("tail")].join("\n");
  const opening = openingAssistantMessageFromTranscript(live);
  expect(opening).toContain("career-hoffman");
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
