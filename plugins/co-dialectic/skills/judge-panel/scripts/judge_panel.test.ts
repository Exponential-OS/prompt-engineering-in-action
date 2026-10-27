import { describe, expect, test } from "bun:test";
import {
  appendCrossFamilyDegradationFlag,
  computeCrossFamily,
  computeFinalVerdict,
  exitCodeFor,
  extractJsonObject,
  parseVerdict,
  geminiModelRemediation,
  reportedCodexModel,
  CODEX_ACCOUNT_DEFAULT,
  EXIT_OK,
  EXIT_NOT_REVIEWED,
  type JurorResult,
  type Verdict,
} from "./judge_panel.ts";

function juror(
  family: string,
  model: string,
  verdict: Verdict,
  overrides: Partial<JurorResult> = {},
): JurorResult {
  return {
    family,
    model,
    verdict,
    confidence: verdict === "error" || verdict === "timeout" ? 0 : 90,
    flags: [],
    tokens_in: 0,
    tokens_out: 0,
    latency_ms: 0,
    raw_response: "",
    error: verdict === "error" ? `${family} failed` : null,
    ...overrides,
  };
}

describe("computeCrossFamily", () => {
  test("one lane error plus one pass is degraded with one returned family", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "error", {
        error: "no JSON object in response",
      }),
      juror("openai", "gpt-5.4", "pass"),
    ]);

    expect(health.degraded).toBe(true);
    expect(health.distinct_families_returned).toBe(1);
    expect(health.down_lanes).toEqual([
      {
        family: "google",
        model: "gemini-flash",
        reason: "no JSON object in response",
      },
    ]);
  });

  test("both lanes pass across distinct families is not degraded", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "pass"),
      juror("openai", "gpt-5.4", "pass"),
    ]);

    expect(health.degraded).toBe(false);
    expect(health.distinct_families_returned).toBe(2);
    expect(health.down_lanes).toEqual([]);
  });

  test("both lanes error is degraded with zero returned families", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "error"),
      juror("openai", "gpt-5.4", "timeout", {
        error: "timeout after 120s",
      }),
    ]);

    expect(health.degraded).toBe(true);
    expect(health.distinct_families_returned).toBe(0);
    expect(health.down_lanes.map((lane) => lane.family)).toEqual([
      "google",
      "openai",
    ]);
  });

  test("two same-family responders are still degraded", () => {
    const health = computeCrossFamily([
      juror("openai", "gpt-5.4", "pass"),
      juror("openai", "gpt-5.4-mini", "pass"),
    ]);

    expect(health.degraded).toBe(true);
    expect(health.distinct_families_returned).toBe(1);
    expect(health.down_lanes).toEqual([]);
  });

  test("stage-1 down plus same down-family tiebreaker error stays degraded", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "error", {
        error: "no JSON object in response",
      }),
      juror("openai", "gpt-5.4", "pass"),
      juror("google", "gemini-pro", "error", {
        error: "no JSON object in response",
      }),
    ]);

    expect(health.degraded).toBe(true);
    expect(health.distinct_families_returned).toBe(1);
    expect(health.down_lanes.map((lane) => lane.model)).toEqual([
      "gemini-flash",
      "gemini-pro",
    ]);
  });

  test("stage-1 down plus same returned-family tiebreaker verdict stays degraded", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "error", {
        error: "no JSON object in response",
      }),
      juror("openai", "gpt-5.4", "pass"),
      juror("openai", "gpt-5.4", "pass"),
    ]);

    expect(health.degraded).toBe(true);
    expect(health.distinct_families_returned).toBe(1);
    expect(health.down_lanes).toEqual([
      {
        family: "google",
        model: "gemini-flash",
        reason: "no JSON object in response",
      },
    ]);
  });

  test("stage-1 down plus different-family tiebreaker verdict restores cross-family", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "error", {
        error: "no JSON object in response",
      }),
      juror("openai", "gpt-5.4", "pass"),
      juror("google", "gemini-pro", "pass"),
    ]);

    expect(health.degraded).toBe(false);
    expect(health.distinct_families_returned).toBe(2);
    expect(health.down_lanes).toEqual([
      {
        family: "google",
        model: "gemini-flash",
        reason: "no JSON object in response",
      },
    ]);
  });

  test("empty/no-json reasoning flags on a real verdict do not mark a lane down", () => {
    const health = computeCrossFamily([
      juror("google", "gemini-flash", "pass", {
        flags: ["artifact is empty and no json is expected in the input"],
      }),
      juror("openai", "gpt-5.4", "pass"),
    ]);

    expect(health.degraded).toBe(false);
    expect(health.distinct_families_returned).toBe(2);
    expect(health.down_lanes).toEqual([]);
  });
});

describe("appendCrossFamilyDegradationFlag", () => {
  test("appends degraded line without shifting an existing index-0 flag", () => {
    const jurors = [
      juror("google", "gemini-flash", "error", {
        error: "no JSON object in response",
      }),
      juror("openai", "gpt-5.4", "pass"),
    ];
    const flags = appendCrossFamilyDegradationFlag(
      ["pre-existing flag"],
      computeCrossFamily(jurors),
      jurors,
    );

    expect(flags[0]).toBe("pre-existing flag");
    expect(
      flags.some((flag) =>
        flag.startsWith(
          "⚠ CROSS-FAMILY DEGRADED: only openai returned; google (no JSON object in response) lane(s) down",
        ),
      ),
    ).toBe(true);
  });

  test("both lanes down banner names zero verdicts and keeps per-lane reasons", () => {
    const jurors = [
      juror("google", "gemini-flash", "timeout", {
        error: "timeout after 120s",
      }),
      juror("openai", "gpt-5.4", "error", {
        error: "no JSON object in response",
      }),
    ];
    const flags = appendCrossFamilyDegradationFlag(
      [],
      computeCrossFamily(jurors),
      jurors,
    );
    const degradedFlag = flags.find((flag) =>
      flag.startsWith("⚠ CROSS-FAMILY DEGRADED:"),
    );

    expect(degradedFlag).toBe(
      "⚠ CROSS-FAMILY DEGRADED: no lane returned a verdict (google (timeout after 120s), openai (no JSON object in response))",
    );
    expect(degradedFlag).toContain("google (timeout after 120s)");
    expect(degradedFlag).toContain("openai (no JSON object in response)");
    expect(degradedFlag).not.toContain("only none returned");
  });

  test("same-family-only degraded line asks for distinct families without lane down", () => {
    const jurors = [
      juror("openai", "gpt-5.4", "pass"),
      juror("openai", "gpt-5.4-mini", "pass"),
    ];
    const flags = appendCrossFamilyDegradationFlag(
      [],
      computeCrossFamily(jurors),
      jurors,
    );
    const degradedFlag = flags.find((flag) =>
      flag.startsWith("⚠ CROSS-FAMILY DEGRADED:"),
    );

    expect(degradedFlag).toContain("need ≥2 distinct families");
    expect(degradedFlag).not.toContain("lane down");
  });
});

describe("computeFinalVerdict", () => {
  test("both-lanes-pass verdict math matches existing no-escalation behavior", () => {
    const result = computeFinalVerdict(
      [
        juror("google", "gemini-flash", "pass", { confidence: 90 }),
        juror("openai", "gpt-5.4", "pass", { confidence: 82 }),
      ],
      null,
      false,
    );

    expect(result.final_verdict).toBe("pass");
    expect(result.final_confidence).toBe(86);
  });
});

// ── XOS-335 ───────────────────────────────────────────────────────────────
// This panel is the unskippable cross-family gate in /ship-feature. Every test
// below exists because on 2026-10-26 all three lanes failed -- two stale model
// pins and a CLI that had migrated out from under one of them -- and the
// process still exited 0.
describe("a panel that did not review must not read as success", () => {
  const ok = { final_verdict: "pass" as Verdict, cross_family: { distinct_families_returned: 2 } };

  test("no family returned a verdict is NOT REVIEWED, not approval", () => {
    expect(
      exitCodeFor({ final_verdict: "error", cross_family: { distinct_families_returned: 0 } }),
    ).toBe(EXIT_NOT_REVIEWED);
  });
  test("zero families is NOT REVIEWED whatever the verdict says", () => {
    // ⭐ This case is why the family count is checked SEPARATELY from the
    // verdict. The test above passes through the verdict branch alone, so
    // deleting the count check left the suite green -- caught by mutating it.
    // An aggregate that reports `pass` while nothing answered is the exact
    // shape of the bug this whole ticket is about.
    for (const v of ["pass", "fail", "uncertain"] as Verdict[])
      expect(
        exitCodeFor({ final_verdict: v, cross_family: { distinct_families_returned: 0 } }),
      ).toBe(EXIT_NOT_REVIEWED);
  });
  test("verdict error or timeout is NOT REVIEWED even if a lane answered", () => {
    for (const v of ["error", "timeout"] as Verdict[])
      expect(
        exitCodeFor({ final_verdict: v, cross_family: { distinct_families_returned: 1 } }),
      ).toBe(EXIT_NOT_REVIEWED);
  });
  test("a real FAIL verdict stays 0 — that is the gate working", () => {
    // Deliberate. A finding that looks like a crash gets `|| true`'d, and then
    // the gate is gone entirely. Callers read the verdict; the exit code only
    // answers "did this run".
    for (const v of ["pass", "fail", "uncertain"] as Verdict[])
      expect(
        exitCodeFor({ final_verdict: v, cross_family: { distinct_families_returned: 2 } }),
      ).toBe(EXIT_OK);
  });
  test("the healthy path is still 0", () => {
    expect(exitCodeFor(ok)).toBe(EXIT_OK);
  });
});

describe("an unpinned codex lane still names its reviewer", () => {
  test("reads the model out of codex's preamble", () => {
    const preamble = [
      "--------",
      "workdir: /tmp/x",
      "model: gpt-6-astra",
      "provider: openai",
      "--------",
    ].join("\n");
    expect(reportedCodexModel(preamble)).toBe("gpt-6-astra");
  });
  test("falls back to a named placeholder, never an empty string", () => {
    expect(reportedCodexModel("no preamble here")).toBe(CODEX_ACCOUNT_DEFAULT);
    expect(reportedCodexModel("")).toBe(CODEX_ACCOUNT_DEFAULT);
  });
  test("does not match a model mentioned mid-line", () => {
    expect(reportedCodexModel("the model: gpt-9 was used")).toBe(
      CODEX_ACCOUNT_DEFAULT,
    );
  });
});

describe("a rejected model pin explains itself", () => {
  const agyStderr = [
    'error: invalid model selection (--model "Gemini 3.1 Pro (High)" --effort ""): model Gemini 3.1 Pro (High) is not recognized as a known model or custom model in settings',
    "Available models:",
    "  Gemini 4 Argon (High)",
    "  Gemini 3.8 Flash (Low)",
    "  Claude Opus 5.5 (Medium)",
  ].join("\n");

  test("turns agy's dump into the names and the file to edit", () => {
    const r = geminiModelRemediation("Gemini 3.1 Pro (High)", agyStderr);
    expect(r).toContain("Gemini 4 Argon (High)");
    expect(r).toContain("Gemini 3.8 Flash (Low)");
    expect(r).toContain("GEMINI_CLI_PREMIUM_MODEL");
    expect(r).toContain("never ran");
  });
  test("stays null for unrelated failures, so real errors are not masked", () => {
    expect(geminiModelRemediation("m", "network unreachable")).toBeNull();
    expect(geminiModelRemediation("m", "")).toBeNull();
  });
  test("still helps when the list is missing from stderr", () => {
    const r = geminiModelRemediation("m", "model m is not recognized as a known model");
    expect(r).toContain("agy --model");
    expect(r).not.toContain("Available right now");
  });
});

describe("a finding that quotes code must not cost the juror its verdict", () => {
  test("a brace INSIDE a string no longer truncates the object", () => {
    // The exact payload that came back as a down lane three times in one review.
    // The old extractor was non-greedy and stopped at the first `}` anywhere.
    const raw =
      '{"verdict":"fail","confidence":92,"flags":["`{ domain: \\"\\" }` falls back silently"]}';
    const got = extractJsonObject(raw);
    expect(got).not.toBeNull();
    expect(JSON.parse(got!).verdict).toBe("fail");
    expect(JSON.parse(got!).flags[0]).toContain("falls back silently");
  });
  test("nested objects survive", () => {
    const raw = '{"verdict":"pass","meta":{"a":{"b":1}},"flags":[]}';
    expect(JSON.parse(extractJsonObject(raw)!).meta.a.b).toBe(1);
  });
  test("prose and fences before the JSON cost a retry, not the verdict", () => {
    for (const raw of [
      'Here is my verdict (note: {} is empty):\n{"verdict":"pass","flags":[]}',
      '```json\n{"verdict":"pass","flags":[]}\n```',
      'see function foo() { return 1 } then: {"verdict":"pass","flags":[]}',
    ])
      expect(JSON.parse(extractJsonObject(raw)!).verdict).toBe("pass");
  });
  test("an ESCAPED QUOTE inside a string does not end the string early", () => {
    // The previous version of this test used `C:\\x`, which passes with escape
    // tracking DELETED -- mutating the tracker away left the suite green. The
    // discriminating case needs an escaped quote followed by a brace, still
    // inside the string: without tracking, the \" closes it and the } ends the
    // object two keys early.
    const raw =
      '{"verdict":"pass","flags":["he said \\" } and left"],"n":1}';
    const got = extractJsonObject(raw);
    expect(got).not.toBeNull();
    expect(JSON.parse(got!).n).toBe(1);
    expect(JSON.parse(got!).flags[0]).toContain("and left");
  });
  test("parseVerdict ITSELF uses the balanced scan, not just the helper", () => {
    // The first version of these tests called extractJsonObject directly, so
    // restoring the non-greedy regex at the CALL SITE left all of them green.
    // Testing a helper is not testing the thing that ships.
    const raw =
      '{"verdict":"fail","confidence":88,"flags":["`{ a: 1 }` is wrong"]}';
    const r = parseVerdict(raw, "m", "google", 0, 0, 0);
    expect(r.verdict).toBe("fail");
    expect(r.confidence).toBe(88);
    expect(r.error ?? "").not.toContain("json decode");
  });
  test("no object, or no VALID object, returns null rather than guessing", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("{ not json at all ")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });
});
