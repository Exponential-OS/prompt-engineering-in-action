/**
 * test_user_prompt_submit.ts — Tests for user-prompt-submit.ts hook helpers.
 *
 * Covers:
 *   - buildOnboardingHint: shows for first ONBOARDING_TURN_WINDOW turns, hides after
 *   - buildReminder: includes onboarding hint for new users, excludes for veterans
 *   - buildReminder: includes task-persona-map reference in Protocol 11 line
 *
 * Resolves Codi GH issues:
 *   #8 (task-based persona routing — buildReminder references task-persona-map.md)
 *   #9 (first-time context for UI metrics — buildOnboardingHint)
 *
 * Run: bun test tests/test_user_prompt_submit.ts
 */

import { test, expect, describe } from "bun:test";
import {
  buildOnboardingHint,
  buildReminder,
  ONBOARDING_TURN_WINDOW,
} from "../hooks/user-prompt-submit.ts";

function makeState(overrides: Partial<{
  growth_total_turns: number;
  persona: string | null;
  persona_icon: string | null;
  last_score: number | null;
  last_cal: number | null;
  verbosity: "concise" | "verbose" | undefined;
}> = {}): any {
  return {
    schema_version: "1.0.0",
    active: true,
    mode: "drive",
    honesty: "grounded",
    persona: overrides.persona ?? null,
    persona_icon: overrides.persona_icon ?? null,
    last_score: overrides.last_score ?? null,
    last_cal: overrides.last_cal ?? null,
    wildcard: false,
    session_start_ts: "2026-05-22T00:00:00Z",
    version: "4.19.0",
    growth_total_turns: overrides.growth_total_turns ?? 0,
    last_updated_ts: "2026-05-22T00:00:00Z",
    ...("verbosity" in overrides ? { verbosity: overrides.verbosity } : {}),
  };
}

describe("modeLine defensive coding (v4.20.0 — honesty:undefined fix)", () => {
  test("missing honesty field — no 'honesty:undefined' literal", () => {
    const stateNoHonesty: any = makeState({ growth_total_turns: 5 });
    delete stateNoHonesty.honesty;
    const reminder = buildReminder(stateNoHonesty, "brain");
    expect(reminder).not.toContain("honesty:undefined");
    expect(reminder).toContain("Mode: drive");
  });

  test("honesty='grounded' (default) — suffix is omitted", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 5 }), "brain");
    expect(reminder).toContain("Mode: drive");
    expect(reminder).not.toMatch(/honesty:/);
  });

  test("honesty='brutal' — suffix is rendered", () => {
    const stateBrutal: any = makeState({ growth_total_turns: 5 });
    stateBrutal.honesty = "brutal";
    const reminder = buildReminder(stateBrutal, "brain");
    expect(reminder).toContain("Mode: drive · honesty:brutal");
  });

  test("missing mode field — falls back to 'drive'", () => {
    const stateNoMode: any = makeState({ growth_total_turns: 5 });
    delete stateNoMode.mode;
    const reminder = buildReminder(stateNoMode, "brain");
    expect(reminder).toContain("Mode: drive");
  });

  test("wildcard=true — 🃏 suffix appears", () => {
    const stateWild: any = makeState({ growth_total_turns: 5 });
    stateWild.wildcard = true;
    const reminder = buildReminder(stateWild, "brain");
    expect(reminder).toContain("🃏 Wildcard ON");
  });

  test("wildcard missing/undefined — no 🃏 suffix", () => {
    const stateNoWild: any = makeState({ growth_total_turns: 5 });
    delete stateNoWild.wildcard;
    const reminder = buildReminder(stateNoWild, "brain");
    expect(reminder).not.toContain("🃏");
  });
});

describe("buildOnboardingHint (issue #9)", () => {
  test("turn 0 (brand new user) — shows hint", () => {
    const hint = buildOnboardingHint(makeState({ growth_total_turns: 0 }));
    expect(hint).toContain("First-time orientation");
    expect(hint).toContain("prompt-quality");
    expect(hint).toContain("Cal:");
    expect(hint).toContain("caliber fidelity");
  });

  test("turn 0 — explains task-first routing without requiring persona names", () => {
    const hint = buildOnboardingHint(makeState({ growth_total_turns: 0 }));
    expect(hint).toContain("never need to memorize persona names");
    expect(hint).toContain("critique the UX");
    expect(hint).toContain("UX Critique");
    expect(hint).toContain("prioritize");
    expect(hint).toContain("Product Strategy");
  });

  test("turn 1 — still shows (fade window not closed)", () => {
    const hint = buildOnboardingHint(makeState({ growth_total_turns: 1 }));
    expect(hint).toContain("First-time orientation");
  });

  test("turn 2 — last turn that shows hint", () => {
    const hint = buildOnboardingHint(makeState({ growth_total_turns: 2 }));
    expect(hint).toContain("First-time orientation");
    expect(hint).toContain("1 more turn"); // singular form when 1 remaining
  });

  test("turn ONBOARDING_TURN_WINDOW (3) — hint stops", () => {
    const hint = buildOnboardingHint(
      makeState({ growth_total_turns: ONBOARDING_TURN_WINDOW }),
    );
    expect(hint).toBe("");
  });

  test("turn 100 — veteran user gets no hint", () => {
    const hint = buildOnboardingHint(makeState({ growth_total_turns: 100 }));
    expect(hint).toBe("");
  });

  test("singular vs plural 'turn' wording is correct", () => {
    expect(buildOnboardingHint(makeState({ growth_total_turns: 0 }))).toContain("3 more turns");
    expect(buildOnboardingHint(makeState({ growth_total_turns: 1 }))).toContain("2 more turns");
    expect(buildOnboardingHint(makeState({ growth_total_turns: 2 }))).toContain("1 more turn");
  });
});

describe("buildReminder integration (issues #8 + #9)", () => {
  test("new user — reminder includes onboarding hint block", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 0 }), "brain");
    expect(reminder).toContain("<codi-onboarding-hint>");
    expect(reminder).toContain("</codi-onboarding-hint>");
    expect(reminder).toContain("First-time orientation");
  });

  test("veteran user — reminder excludes onboarding hint block", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 50 }), "brain");
    expect(reminder).not.toContain("<codi-onboarding-hint>");
    expect(reminder).not.toContain("First-time orientation");
  });

  test("reminder references task-persona-map.md (issue #8)", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 50 }), "brain");
    expect(reminder).toContain("task-persona-map.md");
    expect(reminder).toContain("Task-first routing");
  });

  test("reminder instructs Claude to increment growth_total_turns", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 0 }), "brain");
    expect(reminder).toContain("growth_total_turns");
    expect(reminder).toContain("increment by 1");
  });

  test("reminder always includes the core survival block", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 100 }), "brain");
    expect(reminder).toContain("<codi-survival-reminder>");
    expect(reminder).toContain("</codi-survival-reminder>");
    expect(reminder).toContain("Co-Dialectic v");
    expect(reminder).toContain("Protocol 1 (Status Line)");
  });
});

describe("verbosity / concise-by-default (issue #10)", () => {
  test("default verbosity = concise (no field set)", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 50 }), "brain");
    expect(reminder).toContain("Verbosity: concise");
    expect(reminder).toContain("CONCISE MODE");
    expect(reminder).toContain("lead with the ANSWER");
    expect(reminder).toContain("'cod sharpen'");
    expect(reminder).not.toContain("VERBOSE MODE:");
  });

  test("explicit concise verbosity — same concise instructions", () => {
    const reminder = buildReminder(
      makeState({ growth_total_turns: 50, verbosity: "concise" }),
      "brain",
    );
    expect(reminder).toContain("Verbosity: concise");
    expect(reminder).toContain("CONCISE MODE");
    expect(reminder).toContain("lead with the ANSWER");
  });

  test("verbose verbosity — eager three-tier sharpening per spec", () => {
    const reminder = buildReminder(
      makeState({ growth_total_turns: 50, verbosity: "verbose" }),
      "brain",
    );
    expect(reminder).toContain("Verbosity: verbose");
    expect(reminder).toContain("VERBOSE MODE:");
    expect(reminder).toContain("render the three tiers");
    expect(reminder).toContain("IMPROVED / SOCRATIC / DIALECTIC");
    expect(reminder).not.toContain("CONCISE MODE");
  });

  test("concise mode preserves T3+ inline DIALECTIC escape hatch", () => {
    const reminder = buildReminder(
      makeState({ growth_total_turns: 50, verbosity: "concise" }),
      "brain",
    );
    expect(reminder).toContain("T3+ stakes");
    expect(reminder).toContain("inline even in concise mode");
  });

  test("verbosity-toggle hint is always present in reminder", () => {
    const conciseReminder = buildReminder(
      makeState({ growth_total_turns: 50, verbosity: "concise" }),
      "brain",
    );
    const verboseReminder = buildReminder(
      makeState({ growth_total_turns: 50, verbosity: "verbose" }),
      "brain",
    );
    expect(conciseReminder).toContain("'cod verbose'");
    expect(conciseReminder).toContain("'cod concise'");
    expect(verboseReminder).toContain("'cod verbose'");
    expect(verboseReminder).toContain("'cod concise'");
  });

  test("write-back instruction tells Claude to persist verbosity", () => {
    const reminder = buildReminder(makeState({ growth_total_turns: 50 }), "brain");
    expect(reminder).toContain("verbosity");
  });
});
