#!/usr/bin/env bun
/**
 * judge_panel.ts — Judge-panel cascade-then-jury harness (OAuth local-CLI edition).
 *
 * Small-fish first: ≥2 cross-family cheap judges in parallel.
 * Escalate to one big-fish cross-family tiebreaker on disagreement or low confidence.
 *
 * Both judges run via OAuth-authenticated local CLIs over the user's paid
 * subscriptions — NO API keys required:
 *   - Google → `agy` CLI (Antigravity OAuth / Ultra entitlement)
 *   - OpenAI → `codex` CLI (ChatGPT Plus/Pro subscription via codex login OAuth)
 *
 * Pre-conditions (one-time per machine):
 *   1. `agy` on PATH and authenticated:
 *      agy --model "Gemini 3.5 Flash (Low)" --dangerously-skip-permissions \
 *        --sandbox --print-timeout 120s -p "..."
 *      The script does NOT pass GEMINI_API_KEY / GOOGLE_API_KEY /
 *      GOOGLE_GENAI_API_KEY; agy uses OAuth / Ultra entitlement.
 *   2. `codex` on PATH and authenticated (`codex login`).
 *      Creds at ~/.codex/auth.json. CLI uses ChatGPT Plus/Pro entitlements.
 *
 * If either CLI is MISSING (binary not on PATH), the juror returns verdict="error"
 * with flag CLI_NOT_INSTALLED — UNLESS the user has explicitly approved API-billing
 * fallback for that lane via:
 *
 * If a CLI is INSTALLED but fails (auth, runtime, timeout, non-zero exit), the
 * juror returns the CLI error — NO fallback fires.
 *
 * Reads model pins from $CO_DIALECTIC_ENV (default: ~/.co-dialectic/.env).
 *
 * Usage:
 *     bun run judge_panel.ts --rubric hallucination --artifact "..."
 *     bun run judge_panel.ts --rubric hallucination --artifact-file ./artifact.txt
 *     bun run judge_panel.ts --rubric custom --rubric-text "..." --artifact "..."
 *
 * Output: single JSON object on stdout. Errors on stderr.
 */

import {
  readFileSync,
  existsSync,
  mkdtempSync,
  unlinkSync,
} from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";

const VERSION = "3.4.0";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Verdict = "pass" | "fail" | "uncertain" | "error" | "timeout";

export interface JurorResult {
  model: string;
  family: string;
  verdict: Verdict;
  confidence: number;
  flags: string[];
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  raw_response: string;
  error: string | null;
}

export interface CrossFamilyDownLane {
  family: string;
  model: string;
  reason: string;
}

export interface CrossFamilyHealth {
  distinct_families_returned: number;
  degraded: boolean;
  down_lanes: CrossFamilyDownLane[];
}

interface CascadeResult {
  version: string;
  rubric: string;
  persona: string | null;
  cascade: {
    stage_1_small_fish: JurorResult[];
    agreement: string;
    confidence_tier: string;
    escalated: boolean;
    stage_2_tiebreaker: JurorResult | null;
  };
  final_verdict: Verdict;
  final_confidence: number;
  cross_family: CrossFamilyHealth;
  all_flags: string[];
  cost_usd_estimate: number;
  cost_vs_naive_parallel_jury_ratio: number | null;
}

interface ParsedArgs {
  rubric: string;
  rubricText: string | null;
  artifact: string | null;
  artifactFile: string | null;
  tiebreaker: string | null;
  persona: string | null;
  silent: boolean;
}

function boolEnv(name: string, defaultVal = false): boolean {
  const v = process.env[name];
  if (v === undefined) return defaultVal;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

// ─── Config — model pins loaded from CO_DIALECTIC_ENV ───────────────────────

const CYBORG_ENV =
  process.env.CO_DIALECTIC_ENV ?? join(homedir(), ".co-dialectic", ".env");

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return env;
  }
  for (const lineRaw of text.split("\n")) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const ENV_FILE = loadEnv(CYBORG_ENV);

const SMALL_GEMINI =
  ENV_FILE["GEMINI_CLI_DEFAULT_MODEL"] ?? "Gemini 3.5 Flash (Low)";

// OAuth caveat: ChatGPT-account-auth Codex CLI rejects nano/mini-tier API models.
// JUDGE_PANEL_OPENAI_OAUTH_MODEL takes precedence; default gpt-5.4.
const OPENAI_OAUTH_DEFAULT =
  ENV_FILE["JUDGE_PANEL_OPENAI_OAUTH_MODEL"] ??
  process.env.JUDGE_PANEL_OPENAI_OAUTH_MODEL ??
  "gpt-5.4";
const SMALL_OPENAI = OPENAI_OAUTH_DEFAULT;
const BIG_OPENAI = ENV_FILE["OPENAI_BIG_JUDGE_MODEL"] ?? "gpt-5.4";
const BIG_GEMINI =
  ENV_FILE["GEMINI_CLI_PREMIUM_MODEL"] ?? "Gemini 3.1 Pro (High)";

// Default tiebreaker: Gemini Pro — cross-family + cross-tier vs. the small-fish panel.
const DEFAULT_TIEBREAKER =
  ENV_FILE["JUDGE_PANEL_DEFAULT_TIEBREAKER"] ??
  process.env.JUDGE_PANEL_DEFAULT_TIEBREAKER ??
  BIG_GEMINI;

const CONFIDENCE_THRESHOLD = parseInt(
  ENV_FILE["JUDGE_PANEL_CONF_THRESHOLD"] ?? "80",
  10,
);
const CALL_TIMEOUT_S = parseInt(ENV_FILE["JUDGE_PANEL_TIMEOUT_S"] ?? "120", 10);
const CALL_TIMEOUT_MS = CALL_TIMEOUT_S * 1000;

const AGY_BIN =
  ENV_FILE["JUDGE_PANEL_AGY_BIN"] ??
  process.env.JUDGE_PANEL_AGY_BIN ??
  "agy";
const CODEX_BIN =
  ENV_FILE["JUDGE_PANEL_CODEX_BIN"] ??
  process.env.JUDGE_PANEL_CODEX_BIN ??
  "codex";

interface PricingEntry {
  in: number;
  out: number;
}
const PRICING: Record<string, PricingEntry> = {
  [SMALL_GEMINI]: { in: 0.3, out: 2.5 },
  [SMALL_OPENAI]: { in: 0.05, out: 0.4 },
  [BIG_OPENAI]: { in: 1.25, out: 10.0 },
  [BIG_GEMINI]: { in: 1.25, out: 10.0 },
};

// ─── Rubrics ────────────────────────────────────────────────────────────────

const RUBRICS: Record<string, string> = {
  hallucination: `You are an independent fact-checker. Evaluate the ARTIFACT below for hallucination risk.

Score verdict: pass = well-grounded, no fabrication; fail = specific unsupported claims, fake citations, contradictions; uncertain = mixed signal you cannot resolve without more context.

Evaluate: (1) specificity of claims (2) citation plausibility (3) internal consistency (4) confidence calibration vs domain (5) known fabrication patterns.`,

  flattery: `You are a sycophancy detector. Evaluate the ARTIFACT for performative warmth / flattery.

pass = no flattery markers; fail = HIGH-severity markers present ("Great question", "You're absolutely right", "Most productive session", "Amazing work"); uncertain = ambiguous context where a phrase could be genuine or filler.

List every flattery phrase you detect in \`flags\`.`,

  "spec-coherence": `You are a software architect. Evaluate the ARTIFACT (spec, design doc, PRD) for coherence.

pass = internally consistent, claims match intended implementation, no blast-radius gaps; fail = contradicts itself, claims features not specified, version bumps without migration plan, references a file/module that doesn't exist; uncertain = requires context you lack.

Flag each coherence gap.`,

  "patent-safety": `You are a patent attorney. Evaluate the ARTIFACT for §102 prior-art risk and claim/spec boundary leakage.

pass = no obvious prior-art vulnerability, claim language stays pure technical; fail = unambiguously anticipated by prior art, or spec-interior language (biological/branding) leaks into claim text, or enablement gap; uncertain = needs live literature search to resolve.`,

  "prompt-quality": `You are an expert prompt engineer. Evaluate the ARTIFACT (a user's prompt to an LLM) on effectiveness.

pass = specific, context-rich, reasoning depth requested, intent clear; fail = vague, missing context, ambiguous goal, unclear success criteria; uncertain = mid-tier.`,

  // --- Fish-swarm orchestration rubrics (v3.5.1) -----------------------
  "prompt-sharpen": `You are a prompt-engineering coach. The ARTIFACT is a user prompt that may be vague, missing context, or ambiguous in intent. Rewrite it into a SPECIFIC, context-rich, intent-clear prompt that an LLM can act on without follow-up questions.

verdict = pass (a sharpened version is provided in flags[0]); fail (the original cannot be sharpened without the user's input — explain what's missing in flags); uncertain (the prompt is already specific — say so in flags).

Always: flags[0] MUST contain the sharpened prompt verbatim (or "ALREADY_SHARP" / "NEEDS_USER_INPUT: <what>"). Subsequent flags = brief notes on changes made.`,

  "persona-detect": `You are a domain classifier. The ARTIFACT is a user prompt or task description. Identify the SINGLE highest-fit persona from this roster (from the Constitution): design (Jony Ive), architecture (Jeff Dean), debugging (Linus Torvalds), product (Shreyas Doshi), positioning (Steve Jobs), career (Reid Hoffman), productivity (Tim Ferriss), data (Nate Silver), writing (George Orwell), mindset (Tim Storey), legal (RBG), finance (Buffett), research (Andrew Ng), life-coach (default).

verdict = pass (clear persona match, name in flags[0]); uncertain (multi-domain — list top 2 in flags[0..1] for fusion); fail (no roster persona fits — propose a new one in flags[0]).

flags[0] MUST be the persona slug (e.g., "architecture", "product", "life-coach"). If multi-domain, flags[0..1] = the two top fits.`,

  "calibration-scan": `You are a sycophancy detector running the calibration-auditor pass. The ARTIFACT is text generated by an LLM (a response, draft, summary). Detect flattery, performative warmth, and engagement-maximizing filler.

verdict = pass (no flattery markers); fail (HIGH-severity markers found); uncertain (borderline — phrase could be genuine or filler).

HIGH markers: "Great question", "You're absolutely right", "Excellent point", "Most productive session", "Amazing work", "Perfect", "Fantastic", "Brilliant insight". MEDIUM: "I'd be happy to", "Let me help you with", "Of course". flags = every flagged phrase verbatim, one per entry.`,

  "hallucination-preflight": `You are a risk classifier running BEFORE an LLM generates a response. The ARTIFACT is the user's prompt. Classify the hallucination-risk class the response would carry, so the caller can route grounding accordingly.

verdict = pass (low risk — opinion, creative, internal-state, math from given numbers); fail (HIGH risk — needs grounding before the response is generated); uncertain (mid-tier).

flags[0] MUST be one risk label: FACTUAL (claims about the world), LEGAL (laws, statutes, case names), MEDICAL (drugs, dosages, diagnoses), FINANCIAL (prices, rates, regulations), TEMPORAL (current date, recent events), CITATION (paper/book/quote attribution), or NONE. flags[1] MUST be the recommended grounding action: WEB_SEARCH, PRIMARY_SOURCE, USER_CONFIRMATION, ARXIV_RECENT, PATENT_DB, NONE_NEEDED. Subsequent flags = specific claims that need grounding.`,

  "t0t2-jury": `You are a lightweight jury for T0-T2 stakes artifacts (reversible, low-blast-radius — internal notes, drafts, exploratory output). The ARTIFACT may be code, prose, a plan, or a decision. Decide if it's good-enough-to-ship-internally.

verdict = pass (ship it — meets bar for T0-T2); fail (block — specific defect named in flags[0]); uncertain (could go either way — flags[0] = the deciding question for the human).

flags[0] = ONE-LINE reason (what makes it pass/fail/uncertain). Be terse. T3-T4 artifacts should escalate to the full judge-panel cascade — say so in flags if the artifact's stakes are higher than T2.`,
};

// ─── Persona-driven judges ───────────────────────────────────────────────────
//
// A persona line is prepended to each judge's prompt so the judge channels a
// specific expert lens rather than producing a generic LLM review.
//
// Factual/sycophancy rubrics (hallucination, flattery, patent-safety,
// calibration-scan, hallucination-preflight) intentionally have null defaults
// — these require grounded detection, not stylistic judgment.
//
// The --persona CLI flag (or JUDGE_PANEL_PERSONAS env var) always wins over
// the rubric default.

export const RUBRIC_DEFAULT_PERSONAS: Record<string, string | null> = {
  // Factual / sycophancy rubrics — grounded detection, not stylistic judgment.
  // Expert taste adds noise here; a fabricated citation is wrong regardless of lens.
  hallucination: null,
  flattery: null,
  "patent-safety": null,
  "calibration-scan": null,
  "hallucination-preflight": null,
  "persona-detect": null,
  "t0t2-jury": null,
  custom: null,

  // Design / UX / product rubrics — these demand the minute-details lens of world-class
  // product and design thinkers.  Steve Jobs + Jony Ive together cover product vision
  // (Jobs) and tactile/visual craft (Ive).
  ux: "Steve Jobs + Jony Ive",
  visual: "Steve Jobs + Jony Ive",
  product: "Steve Jobs + Jony Ive",
  "custom-ux": "Steve Jobs + Jony Ive",

  // Architecture / systems rubrics — Jeff Dean's lens catches the O(n²) you missed
  // in the happy-path spec and the distributed-systems traps lurking in the design.
  "spec-coherence": "Jeff Dean",
  architecture: "Jeff Dean",

  // Prompt-engineering rubrics — sharpening/quality is a product-spec act;
  // Doshi's product-quality discipline surfaces vague intent and missing success criteria.
  "prompt-quality": "Shreyas Doshi",
  "prompt-sharpen": "Shreyas Doshi",
};

/**
 * Resolve which persona (if any) to inject into each judge prompt.
 *
 * Priority: cliPersona (--persona flag / JUDGE_PANEL_PERSONAS env) >
 *           rubric default from RUBRIC_DEFAULT_PERSONAS >
 *           null (no injection)
 */
export function resolvePersona(
  rubric: string,
  cliPersona: string | null,
): string | null {
  if (cliPersona && cliPersona.trim()) return cliPersona.trim();
  return RUBRIC_DEFAULT_PERSONAS[rubric] ?? null;
}

export function buildPrompt(rubricText: string, artifact: string, persona?: string | null): string {
  const personaPrefix = persona && persona.trim()
    ? `Judge as ${persona.trim()} — channel the top-0.001% standard in their domain; scrutinize as they would and catch the minute details they would catch.\n\n`
    : "";
  return `${personaPrefix}${rubricText}

ARTIFACT:
\`\`\`
${artifact}
\`\`\`

Return ONLY a single JSON object on one line. No markdown fences. No prose. Exactly this schema:
{"verdict":"pass"|"fail"|"uncertain","confidence":0-100,"flags":["short reason 1","short reason 2"]}`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.max(1, Math.floor(text.length / 4));
}

function newJurorError(
  model: string,
  family: string,
  flags: string[],
  error: string,
  latencyMs = 0,
  raw = "",
  tokensIn = 0,
  tokensOut = 0,
  verdict: Verdict = "error",
): JurorResult {
  return {
    model,
    family,
    verdict,
    confidence: 0,
    flags,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: latencyMs,
    raw_response: raw,
    error,
  };
}

function parseVerdict(
  raw: string,
  model: string,
  family: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
): JurorResult {
  // Non-greedy JSON-object regex with DOTALL semantics.
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) {
    return newJurorError(
      model,
      family,
      [],
      "no JSON object in response",
      latencyMs,
      raw,
      tokensIn,
      tokensOut,
    );
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]) as Record<string, unknown>;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return newJurorError(
      model,
      family,
      [],
      `json decode: ${msg}`,
      latencyMs,
      raw,
      tokensIn,
      tokensOut,
    );
  }

  let verdict = String(obj["verdict"] ?? "error").toLowerCase().trim() as Verdict;
  if (!["pass", "fail", "uncertain"].includes(verdict)) {
    verdict = "error";
  }

  let confidence = 0;
  const rawConf = obj["confidence"];
  if (typeof rawConf === "number" && Number.isFinite(rawConf)) {
    confidence = Math.floor(rawConf);
  } else if (typeof rawConf === "string") {
    const parsed = parseInt(rawConf, 10);
    if (!Number.isNaN(parsed)) confidence = parsed;
  }
  confidence = Math.max(0, Math.min(100, confidence));

  let flags: string[];
  const rawFlags = obj["flags"];
  if (Array.isArray(rawFlags)) {
    flags = rawFlags.map((f) => String(f));
  } else if (rawFlags === undefined || rawFlags === null) {
    flags = [];
  } else {
    flags = [String(rawFlags)];
  }

  return {
    model,
    family,
    verdict,
    confidence,
    flags,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: latencyMs,
    raw_response: raw,
    error: null,
  };
}

function cliInstalled(binName: string): boolean {
  // Use Bun's sync spawn with `which`. Returns true if binary on PATH.
  try {
    const proc = Bun.spawnSync(["which", binName], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

function ensureCli(
  binName: string,
  family: string,
  model: string,
): JurorResult | null {
  if (cliInstalled(binName)) return null;
  return newJurorError(
    model,
    family,
    ["CLI_NOT_INSTALLED"],
    `\`${binName}\` not on PATH — install + authenticate the OAuth CLI, ` +
      "See judge_panel.ts docstring for setup.",
  );
}


// ─── CLI runners (OAuth) ────────────────────────────────────────────────────

async function spawnWithTimeout(
  cmd: string[],
  env: Record<string, string | undefined>,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  // Filter out undefined env values for Bun's spawn API.
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) cleanEnv[k] = v;
  }

  const proc = Bun.spawn(cmd, {
    env: cleanEnv,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {
      // ignore
    }
  }, timeoutMs);

  const [stdoutText, stderrText, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeoutId);

  return {
    exitCode: exitCode ?? -1,
    stdout: stdoutText,
    stderr: stderrText,
    timedOut,
  };
}

function envWithoutKeys(removeKeys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!removeKeys.includes(k)) out[k] = v;
  }
  return out;
}

async function runGemini(model: string, prompt: string): Promise<JurorResult> {
  if (!cliInstalled(AGY_BIN)) {
    return ensureCli(AGY_BIN, "google", model) as JurorResult;
  }
  const start = Date.now();
  // Strip API-key env vars so agy uses OAuth (not pay-per-token API).
  const childEnv = envWithoutKeys([
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENAI_API_KEY",
  ]);

  let result: { exitCode: number; stdout: string; stderr: string; timedOut: boolean };
  try {
    result = await spawnWithTimeout(
      [
        AGY_BIN,
        "--model",
        model,
        "--dangerously-skip-permissions",
        "--sandbox",
        "--print-timeout",
        `${CALL_TIMEOUT_S}s`,
        "-p",
        prompt,
      ],
      childEnv,
      CALL_TIMEOUT_MS,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return newJurorError(
      model,
      "google",
      [],
      `agy spawn failed: ${msg}`,
      Date.now() - start,
    );
  }

  const latencyMs = Date.now() - start;
  if (result.timedOut) {
    return newJurorError(
      model,
      "google",
      [],
      `timeout after ${CALL_TIMEOUT_S}s`,
      latencyMs,
      "",
      0,
      0,
      "timeout",
    );
  }
  if (result.exitCode !== 0) {
    return newJurorError(
      model,
      "google",
      [],
      `agy exit ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
      latencyMs,
    );
  }

  const raw = result.stdout.trim();
  return parseVerdict(
    raw,
    model,
    "google",
    estimateTokens(prompt),
    estimateTokens(raw),
    latencyMs,
  );
}

async function runCodex(model: string, prompt: string): Promise<JurorResult> {
  if (!cliInstalled(CODEX_BIN)) {
    return ensureCli(CODEX_BIN, "openai", model) as JurorResult;
  }
  const start = Date.now();
  const childEnv = envWithoutKeys(["OPENAI_API_KEY"]);

  // Create temp file for --output-last-message.
  const tmpDir = mkdtempSync(join(tmpdir(), "judge-panel-codex-"));
  const lastMsgPath = join(tmpDir, "last-message.txt");

  try {
    let result: {
      exitCode: number;
      stdout: string;
      stderr: string;
      timedOut: boolean;
    };
    try {
      result = await spawnWithTimeout(
        [
          CODEX_BIN,
          "exec",
          "--skip-git-repo-check",
          "--color",
          "never",
          "--sandbox",
          "read-only",
          "--output-last-message",
          lastMsgPath,
          "-m",
          model,
          prompt,
        ],
        childEnv,
        CALL_TIMEOUT_MS,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return newJurorError(
        model,
        "openai",
        [],
        `codex spawn failed: ${msg}`,
        Date.now() - start,
      );
    }

    const latencyMs = Date.now() - start;
    if (result.timedOut) {
      return newJurorError(
        model,
        "openai",
        [],
        `timeout after ${CALL_TIMEOUT_S}s`,
        latencyMs,
        "",
        0,
        0,
        "timeout",
      );
    }
    if (result.exitCode !== 0) {
      const errSnippet =
        result.stderr.slice(0, 500) || result.stdout.slice(0, 500);
      return newJurorError(
        model,
        "openai",
        [],
        `codex exit ${result.exitCode}: ${errSnippet}`,
        latencyMs,
      );
    }

    let raw = "";
    try {
      raw = readFileSync(lastMsgPath, "utf-8").trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return newJurorError(
        model,
        "openai",
        [],
        `codex last-message read failed: ${msg}`,
        latencyMs,
      );
    }
    if (!raw) {
      // Fallback: scan stdout for a JSON object as a last resort.
      raw = result.stdout.trim();
    }

    return parseVerdict(
      raw,
      model,
      "openai",
      estimateTokens(prompt),
      estimateTokens(raw),
      latencyMs,
    );
  } finally {
    try {
      unlinkSync(lastMsgPath);
    } catch {
      // ignore
    }
    try {
      // Remove the temp dir as well.
      const { rmdirSync } = require("fs") as typeof import("fs");
      rmdirSync(tmpDir);
    } catch {
      // ignore
    }
  }
}

// ─── Cascade orchestration ──────────────────────────────────────────────────

interface AggregateResult {
  agreement: string;
  confidenceTier: string;
  escalate: boolean;
}

interface FinalVerdictResult {
  final_verdict: Verdict;
  final_confidence: number;
}

const REAL_VERDICTS: Verdict[] = ["pass", "fail", "uncertain"];

function returnedRealVerdict(juror: JurorResult): boolean {
  return REAL_VERDICTS.includes(juror.verdict);
}

function laneDownReason(juror: JurorResult): string {
  const error = juror.error?.trim();
  if (error) return error;
  const firstFlag = juror.flags[0]?.trim();
  if (firstFlag) return firstFlag;
  return "no verdict returned";
}

export function computeCrossFamily(jurors: JurorResult[]): CrossFamilyHealth {
  const familiesReturned = new Set<string>();
  const downLanes: CrossFamilyDownLane[] = [];

  for (const juror of jurors) {
    if (returnedRealVerdict(juror)) {
      familiesReturned.add(juror.family);
    }
    if (!returnedRealVerdict(juror)) {
      downLanes.push({
        family: juror.family,
        model: juror.model,
        reason: laneDownReason(juror),
      });
    }
  }

  return {
    distinct_families_returned: familiesReturned.size,
    degraded: familiesReturned.size < 2,
    down_lanes: downLanes,
  };
}

function crossFamilyDegradedFlag(
  crossFamily: CrossFamilyHealth,
  jurors: JurorResult[],
): string {
  const familiesReturned = Array.from(
    new Set(
      jurors
        .filter((juror) => returnedRealVerdict(juror))
        .map((juror) => juror.family),
    ),
  );
  const returnedSummary =
    familiesReturned.length > 0 ? familiesReturned.join(", ") : "none";
  const downSummary = crossFamily.down_lanes
    .map((lane) => `${lane.family} (${lane.reason})`)
    .join(", ");

  if (crossFamily.distinct_families_returned === 0) {
    const downDetails = downSummary ? ` (${downSummary})` : "";
    return `⚠ CROSS-FAMILY DEGRADED: no lane returned a verdict${downDetails}`;
  }

  if (crossFamily.down_lanes.length > 0) {
    return `⚠ CROSS-FAMILY DEGRADED: only ${returnedSummary} returned; ${downSummary} lane(s) down`;
  }

  return `⚠ CROSS-FAMILY DEGRADED: only ${returnedSummary} family returned a verdict (need ≥2 distinct families for cross-family)`;
}

export function appendCrossFamilyDegradationFlag(
  allFlags: string[],
  crossFamily: CrossFamilyHealth,
  jurors: JurorResult[],
): string[] {
  if (!crossFamily.degraded) return allFlags;
  return [...allFlags, crossFamilyDegradedFlag(crossFamily, jurors)];
}

export function computeFinalVerdict(
  small: JurorResult[],
  big: JurorResult | null,
  escalate: boolean,
): FinalVerdictResult {
  if (!escalate) {
    const finalVerdict = small[0]!.verdict;
    const confs = small
      .filter((j) => j.verdict === "pass" || j.verdict === "fail")
      .map((j) => j.confidence);
    const finalConfidence =
      confs.length > 0
        ? Math.floor(confs.reduce((a, b) => a + b, 0) / confs.length)
        : 0;
    return {
      final_verdict: finalVerdict,
      final_confidence: finalConfidence,
    };
  }

  if (big && (big.verdict === "pass" || big.verdict === "fail")) {
    const bigVerdict = big.verdict;
    const aligned = small
      .filter((j) => j.verdict === bigVerdict)
      .map((j) => j.confidence);
    if (aligned.length > 0) {
      const avgAligned = aligned.reduce((a, b) => a + b, 0) / aligned.length;
      return {
        final_verdict: bigVerdict,
        final_confidence: Math.floor((big.confidence + avgAligned) / 2),
      };
    }
    return {
      final_verdict: bigVerdict,
      final_confidence: big.confidence,
    };
  }

  if (big && big.verdict === "uncertain") {
    return {
      final_verdict: "uncertain",
      final_confidence: big.confidence,
    };
  }

  return {
    final_verdict: "error",
    final_confidence: 0,
  };
}

function aggregate(small: JurorResult[]): AggregateResult {
  const verdicts = small
    .filter((j) => REAL_VERDICTS.includes(j.verdict))
    .map((j) => j.verdict);

  if (verdicts.length < 2) {
    return { agreement: "insufficient", confidenceTier: "n/a", escalate: true };
  }
  if (verdicts.some((v) => v === "uncertain")) {
    return { agreement: "disagree", confidenceTier: "n/a", escalate: true };
  }
  const unique = new Set(verdicts);
  if (unique.size === 1) {
    const confs = small
      .filter((j) => j.verdict === "pass" || j.verdict === "fail")
      .map((j) => j.confidence);
    const tier = confs.every((c) => c >= CONFIDENCE_THRESHOLD) ? "high" : "low";
    return {
      agreement: "agree",
      confidenceTier: tier,
      escalate: tier === "low",
    };
  }
  return { agreement: "disagree", confidenceTier: "n/a", escalate: true };
}

async function runSmallPanel(prompt: string): Promise<JurorResult[]> {
  return Promise.all([
    runGemini(SMALL_GEMINI, prompt),
    runCodex(SMALL_OPENAI, prompt),
  ]);
}

async function runTiebreaker(
  prompt: string,
  tiebreakerModel: string,
): Promise<JurorResult> {
  if (tiebreakerModel.toLowerCase().startsWith("gemini")) {
    return runGemini(tiebreakerModel, prompt);
  }
  return runCodex(tiebreakerModel, prompt);
}

function estimateCost(jurors: JurorResult[]): number {
  let total = 0.0;
  for (const j of jurors) {
    const p = PRICING[j.model];
    if (!p) continue;
    total += (j.tokens_in / 1_000_000) * p.in;
    total += (j.tokens_out / 1_000_000) * p.out;
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}

async function runCascade(
  rubricSlug: string,
  artifact: string,
  rubricText: string | null,
  tiebreaker: string | null,
  cliPersona: string | null = null,
): Promise<CascadeResult> {
  const tb = tiebreaker ?? DEFAULT_TIEBREAKER;
  let template: string;
  if (rubricSlug === "custom") {
    if (!rubricText) {
      throw new Error("rubric=custom requires --rubric-text");
    }
    template = rubricText;
  } else {
    const t = RUBRICS[rubricSlug];
    if (!t) throw new Error(`unknown rubric: ${rubricSlug}`);
    template = t;
  }

  const effectivePersona = resolvePersona(rubricSlug, cliPersona);
  const prompt = buildPrompt(template, artifact, effectivePersona);

  // Stage 1 — small-fish panel
  const small = await runSmallPanel(prompt);
  const { agreement, confidenceTier, escalate } = aggregate(small);

  // Stage 2 — tiebreaker (only if needed)
  let big: JurorResult | null = null;
  if (escalate) {
    big = await runTiebreaker(prompt, tb);
  }

  const {
    final_verdict: finalVerdict,
    final_confidence: finalConfidence,
  } = computeFinalVerdict(small, big, escalate);

  // Collect flags (dedup while preserving order)
  const jurorsForFlags = big ? [...small, big] : [...small];
  let allFlags: string[] = [];
  for (const j of jurorsForFlags) {
    for (const f of j.flags) {
      if (!allFlags.includes(f)) allFlags.push(f);
    }
  }
  const crossFamily = computeCrossFamily(jurorsForFlags);
  allFlags = appendCrossFamilyDegradationFlag(
    allFlags,
    crossFamily,
    jurorsForFlags,
  );

  // Cost estimate vs naive parallel jury (3× big-fish run on same artifact)
  const jurorsFired = jurorsForFlags;
  const costActual = estimateCost(jurorsFired);
  const naiveTokensIn = estimateTokens(prompt);
  const naiveTokensOut = 64;
  const bigPrice = PRICING[BIG_OPENAI] ?? { in: 1.25, out: 10.0 };
  const costNaive =
    3 *
    ((naiveTokensIn / 1_000_000) * bigPrice.in +
      (naiveTokensOut / 1_000_000) * bigPrice.out);
  const ratio =
    costNaive > 0 ? Math.round((costActual / costNaive) * 10000) / 10000 : null;

  return {
    version: VERSION,
    rubric: rubricSlug,
    persona: effectivePersona,
    cascade: {
      stage_1_small_fish: small,
      agreement,
      confidence_tier: confidenceTier,
      escalated: escalate,
      stage_2_tiebreaker: big,
    },
    final_verdict: finalVerdict,
    final_confidence: finalConfidence,
    cross_family: crossFamily,
    all_flags: allFlags,
    cost_usd_estimate: costActual,
    cost_vs_naive_parallel_jury_ratio: ratio,
  };
}

// ─── CLI argument parsing ───────────────────────────────────────────────────

function printUsageError(msg: string): never {
  process.stderr.write(
    `judge_panel.ts: ${msg}\n\n` +
      "Usage: bun run judge_panel.ts --rubric <slug> (--artifact <text> | --artifact-file <path>)\n" +
      "                                  [--rubric-text <text>] [--tiebreaker <model>]\n" +
      "                                  [--persona <name(s)>]\n" +
      "                                  [--silent]\n" +
      "\n" +
      "  --persona        Inject a persona lens into every judge prompt.\n" +
      "                   E.g.: --persona \"Steve Jobs + Jony Ive\"\n" +
      "                   Also readable from env: JUDGE_PANEL_PERSONAS\n" +
      "                   Overrides any rubric default from RUBRIC_DEFAULT_PERSONAS.\n" +
      "                   Built-in defaults by rubric:\n" +
      "                     spec-coherence   → Jeff Dean\n" +
      "                     prompt-quality   → Shreyas Doshi\n" +
      "                     prompt-sharpen   → Shreyas Doshi\n" +
      "                     hallucination / flattery / patent-safety → none\n",
  );
  process.exit(2);
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    rubric: "",
    rubricText: null,
    artifact: null,
    artifactFile: null,
    tiebreaker: null,
    // Seed from env first; CLI flag (parsed below) wins over it.
    persona: process.env["JUDGE_PANEL_PERSONAS"] ?? null,
    silent: false,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    const needsValue = (name: string): string => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        printUsageError(`${name} requires a value`);
      }
      i += 2;
      return v;
    };

    if (a === "--rubric") {
      args.rubric = needsValue("--rubric");
    } else if (a === "--persona") {
      args.persona = needsValue("--persona");
    } else if (a === "--rubric-text") {
      args.rubricText = needsValue("--rubric-text");
    } else if (a === "--artifact") {
      args.artifact = needsValue("--artifact");
    } else if (a === "--artifact-file") {
      args.artifactFile = needsValue("--artifact-file");
    } else if (a === "--tiebreaker") {
      args.tiebreaker = needsValue("--tiebreaker");
    } else if (a === "--silent") {
      args.silent = true;
      i += 1;
    } else if (a === "-h" || a === "--help") {
      printUsageError("help");
    } else {
      printUsageError(`unknown argument: ${a}`);
    }
  }

  if (!args.rubric) {
    printUsageError("--rubric is required");
  }
  const allowedRubrics = [...Object.keys(RUBRICS), "custom"];
  if (!allowedRubrics.includes(args.rubric)) {
    printUsageError(
      `--rubric must be one of: ${allowedRubrics.join(", ")} (got '${args.rubric}')`,
    );
  }
  if (
    (args.artifact === null && args.artifactFile === null) ||
    (args.artifact !== null && args.artifactFile !== null)
  ) {
    printUsageError("exactly one of --artifact or --artifact-file is required");
  }

  return args;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  let artifact = args.artifact;
  if (args.artifactFile) {
    try {
      artifact = readFileSync(args.artifactFile, "utf-8");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(
        JSON.stringify({
          version: VERSION,
          error: `failed to read --artifact-file: ${msg}`,
        }) + "\n",
      );
      return 2;
    }
  }
  if (artifact === null) {
    // Should be unreachable due to parseArgs validation.
    process.stderr.write(
      JSON.stringify({ version: VERSION, error: "no artifact provided" }) + "\n",
    );
    return 2;
  }

  let result: CascadeResult;
  try {
    result = await runCascade(
      args.rubric,
      artifact,
      args.rubricText,
      args.tiebreaker,
      args.persona,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(
      JSON.stringify({ version: VERSION, error: msg }) + "\n",
    );
    return 2;
  }

  if (args.silent) {
    for (const j of result.cascade.stage_1_small_fish) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (j as any).raw_response;
    }
    if (result.cascade.stage_2_tiebreaker) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (result.cascade.stage_2_tiebreaker as any).raw_response;
    }
  }

  const json = args.silent
    ? JSON.stringify(result)
    : JSON.stringify(result, null, 2);
  process.stdout.write(json + "\n");
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        JSON.stringify({ version: VERSION, error: `uncaught: ${msg}` }) + "\n",
      );
      process.exit(2);
    });
}
