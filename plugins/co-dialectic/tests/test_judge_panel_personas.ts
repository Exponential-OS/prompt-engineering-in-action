/**
 * test_judge_panel_personas.ts — Tests for judge-panel persona injection (v3.4.0).
 *
 * Covers:
 *   - buildPrompt injects persona line when persona is provided
 *   - buildPrompt omits persona line when persona is null/undefined
 *   - RUBRIC_DEFAULT_PERSONAS: known rubrics map to expected personas
 *   - resolvePersona: --persona CLI flag overrides rubric default
 *   - resolvePersona: rubric default applies when no CLI persona provided
 *   - resolvePersona: factual rubrics (hallucination, flattery, patent-safety)
 *     have no default persona (null)
 *
 * Run: bun test tests/test_judge_panel_personas.ts
 */

import { test, expect, describe } from "bun:test";
import {
  buildPrompt,
  resolvePersona,
  RUBRIC_DEFAULT_PERSONAS,
} from "../skills/judge-panel/scripts/judge_panel.ts";

// ── buildPrompt — persona injection ─────────────────────────────────────────

describe("buildPrompt — persona injection", () => {
  const RUBRIC_TEXT = "You are a fact-checker. Evaluate the ARTIFACT.";
  const ARTIFACT = "The sky is green.";
  const PERSONA_LINE_PREFIX = "Judge as ";

  test("injects persona line when persona is a non-empty string", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, "Steve Jobs + Jony Ive");
    expect(prompt).toContain(
      "Judge as Steve Jobs + Jony Ive — channel the top-0.001% standard in their domain; scrutinize as they would and catch the minute details they would catch.",
    );
    // Persona line appears BEFORE the rubric text
    expect(prompt.indexOf(PERSONA_LINE_PREFIX)).toBeLessThan(
      prompt.indexOf(RUBRIC_TEXT),
    );
  });

  test("injects persona line when persona is a single name", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, "Jeff Dean");
    expect(prompt).toContain("Judge as Jeff Dean — channel the top-0.001% standard");
  });

  test("trims whitespace from persona before injecting", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, "  Shreyas Doshi  ");
    expect(prompt).toContain("Judge as Shreyas Doshi — channel");
    expect(prompt).not.toContain("Judge as   Shreyas Doshi");
  });

  test("omits persona line when persona is null", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, null);
    expect(prompt).not.toContain(PERSONA_LINE_PREFIX);
    // Rubric text is still present
    expect(prompt).toContain(RUBRIC_TEXT);
  });

  test("omits persona line when persona is undefined", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, undefined);
    expect(prompt).not.toContain(PERSONA_LINE_PREFIX);
  });

  test("omits persona line when persona is an empty string", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, "");
    expect(prompt).not.toContain(PERSONA_LINE_PREFIX);
  });

  test("omits persona line when persona is whitespace only", () => {
    const prompt = buildPrompt(RUBRIC_TEXT, ARTIFACT, "   ");
    expect(prompt).not.toContain(PERSONA_LINE_PREFIX);
  });

  test("still includes ARTIFACT block regardless of persona", () => {
    const withPersona = buildPrompt(RUBRIC_TEXT, ARTIFACT, "Jeff Dean");
    const noPersona = buildPrompt(RUBRIC_TEXT, ARTIFACT, null);
    expect(withPersona).toContain("ARTIFACT:");
    expect(noPersona).toContain("ARTIFACT:");
    expect(withPersona).toContain(ARTIFACT);
    expect(noPersona).toContain(ARTIFACT);
  });
});

// ── RUBRIC_DEFAULT_PERSONAS — map correctness ────────────────────────────────

describe("RUBRIC_DEFAULT_PERSONAS — rubric→default-persona map", () => {
  // Design / UX / product rubrics → Steve Jobs + Jony Ive
  test("ux defaults to Steve Jobs + Jony Ive", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["ux"]).toBe("Steve Jobs + Jony Ive");
  });

  test("visual defaults to Steve Jobs + Jony Ive", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["visual"]).toBe("Steve Jobs + Jony Ive");
  });

  test("product defaults to Steve Jobs + Jony Ive", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["product"]).toBe("Steve Jobs + Jony Ive");
  });

  test("custom-ux defaults to Steve Jobs + Jony Ive", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["custom-ux"]).toBe("Steve Jobs + Jony Ive");
  });

  // Architecture rubrics → Jeff Dean
  test("spec-coherence defaults to Jeff Dean", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["spec-coherence"]).toBe("Jeff Dean");
  });

  test("architecture defaults to Jeff Dean", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["architecture"]).toBe("Jeff Dean");
  });

  // Prompt-engineering rubrics → Shreyas Doshi
  test("prompt-quality defaults to Shreyas Doshi", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["prompt-quality"]).toBe("Shreyas Doshi");
  });

  test("prompt-sharpen defaults to Shreyas Doshi", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["prompt-sharpen"]).toBe("Shreyas Doshi");
  });

  // Factual rubrics — no persona default (grounded detection, not stylistic judgment)
  test("hallucination has no default persona (null)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["hallucination"]).toBeNull();
  });

  test("flattery has no default persona (null)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["flattery"]).toBeNull();
  });

  test("patent-safety has no default persona (null)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["patent-safety"]).toBeNull();
  });

  test("calibration-scan has no default persona (null)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["calibration-scan"]).toBeNull();
  });

  test("hallucination-preflight has no default persona (null)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["hallucination-preflight"]).toBeNull();
  });

  test("custom has no default persona (null — user provides via --persona)", () => {
    expect(RUBRIC_DEFAULT_PERSONAS["custom"]).toBeNull();
  });
});

// ── resolvePersona — override + default logic ────────────────────────────────

describe("resolvePersona — CLI flag override and rubric default", () => {
  test("returns CLI persona when explicitly set, even for rubric with a default", () => {
    // spec-coherence default is Jeff Dean; override with a custom persona
    const persona = resolvePersona("spec-coherence", "Linus Torvalds");
    expect(persona).toBe("Linus Torvalds");
  });

  test("returns CLI persona for factual rubric (no default exists)", () => {
    const persona = resolvePersona("hallucination", "Nate Silver");
    expect(persona).toBe("Nate Silver");
  });

  test("returns rubric default when CLI persona is null", () => {
    expect(resolvePersona("spec-coherence", null)).toBe("Jeff Dean");
    expect(resolvePersona("architecture", null)).toBe("Jeff Dean");
    expect(resolvePersona("prompt-quality", null)).toBe("Shreyas Doshi");
    expect(resolvePersona("prompt-sharpen", null)).toBe("Shreyas Doshi");
    expect(resolvePersona("ux", null)).toBe("Steve Jobs + Jony Ive");
    expect(resolvePersona("visual", null)).toBe("Steve Jobs + Jony Ive");
    expect(resolvePersona("product", null)).toBe("Steve Jobs + Jony Ive");
    expect(resolvePersona("custom-ux", null)).toBe("Steve Jobs + Jony Ive");
  });

  test("returns null for factual rubric when CLI persona is null", () => {
    expect(resolvePersona("hallucination", null)).toBeNull();
    expect(resolvePersona("flattery", null)).toBeNull();
    expect(resolvePersona("patent-safety", null)).toBeNull();
  });

  test("treats empty-string CLI persona as absent — falls back to rubric default", () => {
    // resolvePersona checks truthiness + trim; empty string resolves to default
    const persona = resolvePersona("spec-coherence", "");
    expect(persona).toBe("Jeff Dean");
  });

  test("trims whitespace from CLI persona", () => {
    const persona = resolvePersona("hallucination", "  Nate Silver  ");
    expect(persona).toBe("Nate Silver");
  });

  test("returns null for unknown rubric with no CLI persona", () => {
    // Unknown rubric → RUBRIC_DEFAULT_PERSONAS returns undefined → ?? null
    expect(resolvePersona("unknown-future-rubric", null)).toBeNull();
  });

  test("CLI persona wins over rubric default for multi-name persona", () => {
    const persona = resolvePersona("spec-coherence", "Steve Jobs + Jony Ive");
    expect(persona).toBe("Steve Jobs + Jony Ive");
    // Confirm it is NOT the default
    expect(persona).not.toBe("Jeff Dean");
  });
});
