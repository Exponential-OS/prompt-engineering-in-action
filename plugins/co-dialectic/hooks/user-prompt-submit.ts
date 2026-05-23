#!/usr/bin/env bun
/**
 * user-prompt-submit.ts — Co-Dialectic survival hook (v4.17.0).
 *
 * Fires on EVERY user message in Claude Code (UserPromptSubmit event).
 *
 * STATE SOURCE OF TRUTH HIERARCHY (v4.17.0):
 *   1. co-dialectic/status-state.json  via brain-kernel (GitHub-backed, portable)
 *   2. ~/.codialectic/state.json        machine-local fallback (v4.16 legacy path)
 *
 * Codi reads the brain-kernel path first (using BRAIN_WORKSPACE_ROOT env or cwd).
 * If the brain path is absent (first run after install, or workspace not yet
 * bootstrapped), falls back to the legacy machine-local file.
 *
 * After each successful read of the brain path, the in-memory state is the
 * authoritative source. The survival reminder instructs Claude to write back
 * to the brain path (not the legacy path) after each response.
 *
 * SPEC-CLARIFICATION-NEEDED (migration period):
 *   - The statusline.sh still reads ~/.codialectic/state.json directly (hasn't
 *     been updated yet). During the migration period (v4.17.0) both paths may
 *     diverge if the statusline.sh updates lag behind. The brain path is
 *     authoritative; statusline.sh will be updated in a follow-up.
 *   - If BRAIN_WORKSPACE_ROOT is not set and cwd is not a workspace, the
 *     brain read will return null. The fallback to ~/.codialectic/state.json
 *     ensures the hook never silently disables codi.
 *
 * Output format (Claude Code spec):
 *   {
 *     "hookSpecificOutput": {
 *       "hookEventName": "UserPromptSubmit",
 *       "additionalContext": "<the reminder Claude will see>"
 *     }
 *   }
 *
 * Exit: 0 always (this hook never blocks; it just injects context).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface CodiState {
  schema_version: string;
  active: boolean;
  mode: "drive" | "cruise" | "quiet";
  honesty: "grounded" | "brutal" | "soft";
  persona: string | null;
  persona_icon: string | null;
  last_score: number | null;
  last_cal: number | null;
  wildcard: boolean;
  session_start_ts: string;
  version: string;
  growth_total_turns: number;
  last_updated_ts: string;
  /**
   * verbosity — added in v4.19.0 to resolve GH #10 (Guillaume De Smedt
   * feedback: "I love reading — just not while in 'get things done' mode").
   * "concise" (default for new state) = summary-first; sharpening offered on
   * demand, not eagerly rendered. "verbose" = legacy behavior; eager Tiered
   * Sharpening + full protocol reminders. Optional for backward compat: legacy
   * state files without this field are treated as "concise".
   */
  verbosity?: "concise" | "verbose";
}

// ─── State loading ────────────────────────────────────────────────────────────

/** Legacy machine-local state path (v4.16 and earlier). */
const LEGACY_STATE_PATH = join(homedir(), ".codialectic", "state.json");

/** Brain-kernel state path relative to workspace root. */
const BRAIN_STATE_RELATIVE = "co-dialectic/status-state.json";

/**
 * resolveWorkspaceRoot — determine the workspace root to use for brain reads.
 *
 * Priority: BRAIN_WORKSPACE_ROOT env > CAREER_HOME env > process.cwd().
 *
 * SPEC-CLARIFICATION-NEEDED: in multi-workspace installations (xTeamOS, etc.)
 * BRAIN_WORKSPACE_ROOT must be explicitly set per workspace. Falling back to
 * cwd is only correct when the hook fires inside the workspace directory tree.
 */
function resolveWorkspaceRoot(): string {
  return (
    process.env.BRAIN_WORKSPACE_ROOT ??
    process.env.CAREER_HOME ??
    process.cwd()
  );
}

/**
 * loadBrainState — attempt to load state from the brain-kernel workspace path.
 *
 * Returns null if the workspace root doesn't have the brain path, or if the
 * JSON is invalid. Failures here are soft — we fall back to legacy.
 */
function loadBrainState(): CodiState | null {
  const root = resolveWorkspaceRoot();
  const absPath = join(root, BRAIN_STATE_RELATIVE);
  if (!existsSync(absPath)) return null;
  try {
    const raw = readFileSync(absPath, "utf8");
    return JSON.parse(raw) as CodiState;
  } catch {
    // SPEC-CLARIFICATION-NEEDED: brain path JSON is corrupt. Fall back to legacy.
    // This should not happen in normal operation; brain.write() is atomic via git.
    return null;
  }
}

/**
 * loadLegacyState — load from ~/.codialectic/state.json (v4.16 fallback).
 */
function loadLegacyState(): CodiState | null {
  if (!existsSync(LEGACY_STATE_PATH)) return null;
  try {
    const raw = readFileSync(LEGACY_STATE_PATH, "utf8");
    return JSON.parse(raw) as CodiState;
  } catch {
    return null;
  }
}

/**
 * loadState — load codi state with fallback chain.
 *
 * Returns: [state, source] where source is "brain" | "legacy" | null.
 */
function loadState(): [CodiState | null, "brain" | "legacy" | null] {
  const brainState = loadBrainState();
  if (brainState !== null) return [brainState, "brain"];

  const legacyState = loadLegacyState();
  if (legacyState !== null) return [legacyState, "legacy"];

  return [null, null];
}

// ─── Hook output ──────────────────────────────────────────────────────────────

function emit(additionalContext: string, systemMessage: string): never {
  // Emit BOTH formats: additionalContext (Claude Code v2.x+) AND systemMessage
  // (older versions + maximum compatibility). decision:approve so we don't block.
  const payload = {
    decision: "approve",
    systemMessage,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
}

// H2: return type is `never` so TypeScript flow-analysis understands that callers
// of emitSilent() do not return — this narrows `state` and `source` correctly
// in the code that follows each emitSilent() call in main().
function emitSilent(): never {
  process.stdout.write(JSON.stringify({
    decision: "approve",
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "" },
  }) + "\n");
  process.exit(0);
}

// ─── Date/time ─────────────────────────────────────────────────────────────────

function osGroundedDate(): string {
  // TEMPORAL GROUNDING INVARIANT (v4.16.0): inject OS-grounded datetime into
  // every prompt context. Prevents the "agent says 'tonight' at 1pm Monday"
  // failure mode caused by stale internal time recall.
  try {
    const d = new Date();
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
      hour12: false,
    };
    const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")}, ${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
  } catch {
    return new Date().toISOString();
  }
}

// ─── Reminder builder ─────────────────────────────────────────────────────────

/**
 * ONBOARDING_TURN_WINDOW — number of turns during which the first-time score
 * explainer is appended to the reminder. Resolves issue #9 (Guillaume De Smedt
 * feedback): "what are these scores? what do they mean?" Users only need this
 * once — fade after a few turns. 3 is the smallest window that survives a
 * typical first interaction (prompt + clarifier + follow-up).
 */
export const ONBOARDING_TURN_WINDOW = 3;

/**
 * buildOnboardingHint — returns the first-time score explainer when the user
 * is still in their onboarding window, or an empty string after the window.
 *
 * Returns empty string (not null) so the caller can unconditionally concatenate
 * without conditional join logic.
 */
export function buildOnboardingHint(state: CodiState): string {
  if (state.growth_total_turns >= ONBOARDING_TURN_WINDOW) return "";
  const remaining = ONBOARDING_TURN_WINDOW - state.growth_total_turns;
  return [
    "<codi-onboarding-hint>",
    `First-time orientation (auto-fades in ${remaining} more turn${remaining === 1 ? "" : "s"}):`,
    "  • The status line at the top of each response shows three things:",
    "      X% = prompt-quality (how well-formed your prompt was for me to act on)",
    "      Cal: Y% = caliber fidelity (how deeply the persona engaged at its 0.001% level)",
    "      Icon = active persona — task-described (e.g., 🎨 UX Critique) by default.",
    "  • You never need to memorize persona names. Just say what you want done:",
    "      'critique the UX' → 🎨 UX Critique    'prioritize this list' → 📦 Product Strategy",
    "      'debug this' → 🔍 Debug    'pitch this to a VC' → 🎯 Positioning",
    "  • Type 'who' in any turn to see which persona is active.",
    "  • Type '/cod verbose' to see persona names; '/cod concise' to hide them.",
    "</codi-onboarding-hint>",
  ].join("\n");
}

export function buildReminder(state: CodiState, stateSource: "brain" | "legacy"): string {
  const personaLine = state.persona
    ? `${state.persona_icon ?? "🎯"} ${state.persona} (active persona)`
    : "Persona: auto-detect from current task";

  const scoresLine =
    state.last_score !== null && state.last_cal !== null
      ? `Last response: ${state.last_score}% · Cal: ${state.last_cal}%`
      : "Status line will populate on this response";

  /**
   * modeLine — render the user-facing mode descriptor.
   *
   * Bug fix v4.20.0 (GH #11-adjacent): when state.json lacks the `honesty`
   * field (older state schemas, fresh installs, or post-migration state
   * shapes), `state.honesty` is `undefined`. The previous conditional
   * `state.honesty !== "grounded"` is true for undefined, producing the
   * literal string "honesty:undefined" in the survival reminder — a visible
   * cosmetic bug AND a signal of state-schema drift.
   *
   * Fix: only append the honesty suffix when honesty is a non-empty string
   * AND is not the default ("grounded"). Same defensive treatment for
   * `state.wildcard` and `state.mode` (fall back to "drive" if missing).
   */
  const safeMode = state.mode || "drive";
  const showHonesty =
    typeof state.honesty === "string" &&
    state.honesty.length > 0 &&
    state.honesty !== "grounded";
  const honestySuffix = showHonesty ? ` · honesty:${state.honesty}` : "";
  const wildcardSuffix = state.wildcard === true ? " · 🃏 Wildcard ON" : "";
  const modeLine = `Mode: ${safeMode}${honestySuffix}${wildcardSuffix}`;

  const nowLine = `Now (OS-grounded, do NOT recall from memory): ${osGroundedDate()}`;

  // Tell Claude which path to write state back to after the response.
  const workspaceRoot = resolveWorkspaceRoot();
  const brainStatePath = join(workspaceRoot, "co-dialectic/status-state.json");
  const writeBackInstruction = stateSource === "brain"
    ? `After your response, write back to the brain-kernel path: ${brainStatePath}`
    : `After your response, write to the brain-kernel path: ${brainStatePath} ` +
      `(NOTE: state was loaded from legacy ~/.codialectic/state.json — brain path not yet initialized; ` +
      `writing to brain path will complete the migration)`;

  const onboardingHint = buildOnboardingHint(state);
  const verbosity = state.verbosity ?? "concise";
  const verbosityLine = `Verbosity: ${verbosity} (toggle: 'cod verbose' / 'cod concise')`;

  const protocol3Concise =
    "Protocol 3 (Tiered Sharpening) — CONCISE MODE (default): " +
    "lead with the ANSWER. Do NOT eagerly render the three tiers. " +
    "If the prompt has room to improve, end the response with ONE LINE: " +
    "`Sharpen? Type 'cod sharpen' for IMPROVED / SOCRATIC / DIALECTIC.` " +
    "Exception: T3+ stakes (named person, public-facing, irreversible decision) → " +
    "render DIALECTIC inline even in concise mode (the user is making a one-way-door call).";

  const protocol3Verbose =
    "Protocol 3 (Tiered Sharpening) — VERBOSE MODE: " +
    "if this prompt has room to improve, render the three tiers " +
    "(IMPROVED / SOCRATIC / DIALECTIC) per spec. Auto-detect T3+ stakes " +
    "(named person, public-facing, irreversible) → eager DIALECTIC synthesis.";

  const protocol3Line = verbosity === "verbose" ? protocol3Verbose : protocol3Concise;

  const lines = [
    "<codi-survival-reminder>",
    `Co-Dialectic v${state.version} is ACTIVE (state source: ${stateSource === "brain" ? "brain-kernel workspace" : "legacy ~/.codialectic/state.json"}, survives compaction).`,
    "",
    `${nowLine}`,
    `${personaLine}`,
    `${modeLine}`,
    `${verbosityLine}`,
    `${scoresLine}`,
    "",
    "Protocol 1 (Status Line): begin EVERY response with the persona/score/Cal line.",
    protocol3Line,
    "Protocol 11 (Persona Roster): activate the appropriate persona at 0.001% caliber based on prompt domain. Task-first routing per skills/co-dialectic/task-persona-map.md — users describe tasks, not persona names.",
    "Protocol 17 (Temporal Grounding): every time-referential phrase ('tonight', 'tomorrow', 'recently', 'yesterday') in your response MUST anchor to the OS-grounded Now line above. Convert relative → absolute datetime before writing.",
    "",
    writeBackInstruction,
    "Update last_score, last_cal, persona, growth_total_turns (increment by 1), and verbosity fields. The brain-kernel path is the source of truth across sessions and devices.",
    "</codi-survival-reminder>",
  ];
  if (onboardingHint) {
    lines.push("", onboardingHint);
  }
  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const [state, source] = loadState();
  if (!state || source === null) {
    emitSilent(); // no state file = codi never initialized = silent
  }
  if (!state.active) {
    emitSilent(); // explicitly disabled by user (codi off)
  }
  const additionalContext = buildReminder(state, source);
  const systemMessage = `Co-Dialectic v${state.version} active · mode=${state.mode}${state.persona ? ` · persona=${state.persona}` : ""} — render status line + apply Protocol 3 tiered sharpening per spec.`;
  emit(additionalContext, systemMessage);
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.main) {
  main();
}
