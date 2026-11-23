#!/usr/bin/env bun
/**
 * user-prompt-submit.ts — Co-Dialectic survival hook (v4.17.0).
 *
 * Fires on EVERY user message in Claude Code (UserPromptSubmit event).
 *
 * STATE SOURCE (XOS-443): exactly one.
 *   ~/.codialectic/sessions/<session_id>.json
 *
 * There used to be three, read in a fallback chain: a brain-kernel workspace
 * file, a machine-global ~/.codialectic/state.json, and the session file.
 * Neither of the first two was a real source, though not for the same reason.
 * The brain-kernel file had no writer -- last touched 2026-08-14, still
 * untouched 101 days later. The machine-global file had the opposite problem:
 * install-survival-layer.sh rewrites it on every SessionStart, and nothing has
 * read it since state went session-scoped, so it carried a fresh timestamp and
 * no meaning. Meanwhile this hook told the model, every single turn, that the
 * brain-kernel path was "the source of truth across sessions and devices".
 *
 * A fallback chain whose upper tiers have no reader is not resilience. It is a
 * way to be confidently wrong, and the actively-rewritten tier is the worse
 * half: staleness is at least visible, while a maintained-looking file that
 * feeds nothing is not.
 *
 * One file, one writer (the Stop hook), one reader. No session id means no
 * state -- not a different file. Per-turn heartbeat fields are stamped by the
 * Stop hook; the model only persists command-driven preference changes, and
 * those are session-scoped.
 *
 * statusline.sh resolves state by the same single rule, so one heartbeat drives
 * both visible surfaces.
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
import { DEFAULT_STALE_SECS, evaluateSharedLiveness } from "./liveness.ts";
import {
  consumeCostNudgeForSession,
  sessionIdFromInput,
  type HookInput as CostNudgeHookInput,
} from "./cost-routing-nudge.ts";
import {
  atomicWriteJson,
  hasOnboarded,
  markOnboarded,
  readJsonObject,
  sessionIdFromHookInput,
  sessionStatePath,
  workspaceRootFromInput,
  type SessionAwareHookInput,
} from "./session-state.ts";

interface CodiState {
  schema_version: string;
  active: boolean;
  mode: "drive" | "cruise" | "quiet";
  honesty: "grounded" | "brutal" | "soft";
  persona: string | null;
  persona_icon: string | null;
  last_score: number | null;
  last_cal: number | null;
  last_protocol_ts?: string | null;
  last_session_start_ts?: string | null;
  installed_version?: string | null;
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

type LoadedStateSource = "session";
type ReminderStateSource = LoadedStateSource | "missing";

interface UserPromptSubmitInput extends SessionAwareHookInput {}

// ─── State loading ────────────────────────────────────────────────────────────



/**
 * resolveWorkspaceRoot — determine the workspace root to use for brain reads.
 *
 * Priority: BRAIN_WORKSPACE_ROOT env > CAREER_HOME env > process.cwd().
 *
 * SPEC-CLARIFICATION-NEEDED: in multi-workspace installations (xTeamOS, etc.)
 * BRAIN_WORKSPACE_ROOT must be explicitly set per workspace. Falling back to
 * cwd is only correct when the hook fires inside the workspace directory tree.
 */
function resolveWorkspaceRoot(input: UserPromptSubmitInput = {}): string {
  return workspaceRootFromInput(input);
}

/**
 * loadSessionState — load this session's own state file (XOS-391).
 *
 * This is where status-liveness-check actually stamps the heartbeat:
 * resolveStateWriteTargets() returns sessionStatePath(sessionId) whenever a
 * session id is present, which Claude Code supplies on every Stop invocation.
 * Before this existed, the reader's chain was brain -> legacy -> null with no
 * branch to the session file at all, so the writer and the reader were pointed
 * at different files and the DEGRADED banner could never clear no matter how
 * correctly the session behaved.
 *
 * XOS-443: the session file is now the only source. It is a superset of the
 * old brain-kernel schema -- same preference fields (mode, verbosity, honesty,
 * persona) plus session_id, workspace_root and last_user_prompt_ts -- so
 * dropping the fallbacks loses no field, only staleness. A new session starts
 * with default preferences rather than inheriting a file nobody had written
 * since August; that is the honest behavior, and the reminder now says so
 * instead of promising cross-device persistence the code never delivered.
 */
function loadSessionState(input: UserPromptSubmitInput = {}): CodiState | null {
  const sessionId = sessionIdFromHookInput(input);
  if (!sessionId) return null;
  const parsed = readJsonObject(sessionStatePath(sessionId));
  return parsed === null ? null : (parsed as CodiState);
}

/**
 * loadState — load this session's state.
 *
 * Returns [state, "session"], or [null, null] when this session has no state
 * yet (first turn, or no session id on the payload). The caller self-resurrects
 * from defaults in that case.
 */
function loadState(input: UserPromptSubmitInput = {}): [CodiState | null, LoadedStateSource | null] {
  const sessionState = loadSessionState(input);
  return sessionState !== null ? [sessionState, "session"] : [null, null];
}

// ─── Structural liveness (XOS-141) ───────────────────────────────────────────

export interface CodiLiveness {
  live: boolean;
  degraded: boolean;
  unknown: boolean;
  stale: boolean;
  skew: boolean;
  inactive: boolean;
  installedVersion: string;
  reasons: string[];
}

export function resolveInstalledVersion(state?: Partial<CodiState> | null): string {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const pluginJson = join(pluginRoot, ".claude-plugin", "plugin.json");
    if (existsSync(pluginJson)) {
      try {
        const parsed = JSON.parse(readFileSync(pluginJson, "utf8"));
        if (typeof parsed.version === "string" && parsed.version.length > 0) {
          return parsed.version;
        }
      } catch {
        // Fall through to state-backed values.
      }
    }
  }
  return state?.installed_version ?? state?.version ?? "unknown";
}

export function evaluateCodiLiveness(
  state: Partial<CodiState> | null,
  installedVersion: string,
  now: Date = new Date(),
  staleSecs: number = Number(process.env.CODI_STALE_SECS ?? DEFAULT_STALE_SECS),
): CodiLiveness {
  const result = evaluateSharedLiveness(
    state,
    installedVersion,
    now,
    staleSecs,
    // XOS-213: unified on the tolerant reading. This path used "boolean-only"
    // while status-liveness-check.ts used "boolean-or-string" and statusline.sh
    // degraded only on a literal "false" — three readings of one field. A legacy
    // or hand-edited state carrying the STRING "true" manufactured a DEGRADED
    // here and nowhere else, which is precisely the false-alarm class XOS-237
    // was filed for. Pinned by xos-213-liveness-parity.test.ts.
    "boolean-or-string",
  );

  return {
    live: result.live,
    degraded: result.degraded,
    unknown: result.unknown,
    stale: result.stale,
    skew: result.skew,
    inactive: result.inactive,
    installedVersion,
    reasons: result.reasons,
  };
}

/**
 * NAME the header this nudge demands.
 *
 * It used to say "render the required status header" without saying which one. XOS-308.
 *
 * ⚠️ The deadlock is NARROWER than "the gate refuses a live header while degraded" — that
 * is false, and an earlier version of this comment said it. checkStatusLiveness ACCEPTS a
 * well-formed LIVE header while degraded and stamps on it; there is an existing regression
 * test requiring exactly that resurrection path. Do NOT "repair" the gate to allow
 * something it already allows — you would be editing working behaviour to match a wrong
 * explanation. (Caught by a cross-family review of this very diff, 2026-09-29.)
 *
 * The real trap is the MALFORMED HYBRID. Protocol 1, two lines above this nudge in the same
 * reminder, asks for a persona/score/Cal line unconditionally. While degraded, the reminder
 * also says the scores are hidden. A compliant agent obeys both and renders
 * `<persona> · score:— · Cal:— · [HH:MM]` — which satisfies NEITHER regex: not LIVE
 * (no `93% · Cal: 97%`) and not DEGRADED (wrong prefix). No match means no stamp, the
 * heartbeat never advances, and the session is degraded for good.
 *
 * So the instruction pair is self-defeating: the "hide the scores" half disqualifies the
 * header the other half asks for. The escape was a string the agent was never given — it
 * appeared solely inside the Stop hook's rejection, which arrives one turn too late to act
 * on. This nudge now names it, as the specific exception to Protocol 1's general rule.
 */
export function buildDegradationNudge(liveness: CodiLiveness): string {
  const inactiveInstruction = liveness.inactive
    ? " If codi was explicitly turned off, tell the user to type 'codi on'."
    : "";
  return (
    "⚠ CODI DEGRADED — re-fire Protocol 0/1 NOW: " +
    "render `⚠ Codi DEGRADED · [HH:MM]` as the FIRST line, with no score numbers. " +
    "The Stop hook stamps the heartbeat after verifying the transcript." +
    inactiveInstruction
  );
}

function buildDefaultState(installedVersion: string): CodiState {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    schema_version: "1.0.0",
    active: true,
    mode: "drive",
    honesty: "grounded",
    persona: null,
    persona_icon: null,
    last_score: null,
    last_cal: null,
    last_protocol_ts: null,
    last_session_start_ts: now,
    installed_version: installedVersion,
    wildcard: false,
    session_start_ts: now,
    version: installedVersion,
    growth_total_turns: 0,
    last_updated_ts: now,
  };
}

export function recordUserPrompt(
  input: UserPromptSubmitInput,
  durableState: CodiState,
  now: Date = new Date(),
): CodiState {
  const sessionId = sessionIdFromHookInput(input);
  if (!sessionId) return durableState;

  const path = sessionStatePath(sessionId);
  const existing = readJsonObject(path) as CodiState | null;
  const next = {
    ...durableState,
    ...(existing ?? {}),
    // Durable command-owned preferences remain authoritative; session files
    // are projections plus per-session liveness/persona/score fields.
    active: durableState.active,
    mode: durableState.mode,
    honesty: durableState.honesty,
    wildcard: durableState.wildcard,
    verbosity: durableState.verbosity,
    installed_version: durableState.installed_version,
    session_id: sessionId,
    workspace_root: resolveWorkspaceRoot(input),
    last_user_prompt_ts: now.toISOString(),
  } as CodiState & Record<string, unknown>;

  if (existing === null) {
    // Never inherit a different session's heartbeat from legacy/canonical
    // bootstrap state. Absence is UNKNOWN until this session proves Protocol 1.
    delete next.last_protocol_ts;
  }

  try {
    atomicWriteJson(path, next);
  } catch {
    // Survival hooks fail open. The in-memory state still gives this prompt a
    // sensible UNKNOWN/LIVE/DEGRADED reminder.
  }
  return next;
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

async function readHookInput(): Promise<UserPromptSubmitInput> {
  try {
    const raw = (await Bun.stdin.text()).trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as UserPromptSubmitInput;
  } catch {
    return {};
  }
}

export function appendCostRoutingNudge(additionalContext: string, nudge: string | null): string {
  return nudge ? `${additionalContext}\n\n${nudge}` : additionalContext;
}

function costRoutingNudgeFromInput(input: UserPromptSubmitInput): string | null {
  const sessionId = sessionIdFromInput(input as CostNudgeHookInput);
  return sessionId ? consumeCostNudgeForSession(sessionId) : null;
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
export function buildOnboardingHint(state: CodiState, onboarded = false): string {
  // `onboarded` is the user-level fact (XOS-443); growth_total_turns is this
  // session's counter. Both must be clear before the hint shows, because a
  // returning user always has a fresh session counter.
  if (onboarded) return "";
  if (state.growth_total_turns >= ONBOARDING_TURN_WINDOW) return "";
  const remaining = ONBOARDING_TURN_WINDOW - state.growth_total_turns;
  return [
    "<codi-onboarding-hint>",
    `First-time orientation (auto-fades in ${remaining} more turn${remaining === 1 ? "" : "s"}):`,
    "  • The status line at the top of each response shows four things:",
    "      X% = prompt-quality (how well-formed your prompt was for me to act on)",
    "      Cal: Y% = caliber fidelity (how deeply the persona engaged at its 0.001% level)",
    "      Icon = active persona — task-described (e.g., 🎨 UX Critique) by default.",
    "      [HH:MM] = OS-grounded time of the response — temporal grounding + a scroll anchor for long runs.",
    "  • You never need to memorize persona names. Just say what you want done:",
    "      'critique the UX' → 🎨 UX Critique    'prioritize this list' → 📦 Product Strategy",
    "      'debug this' → 🔍 Debug    'pitch this to a VC' → 🎯 Positioning",
    "  • Type 'who' in any turn to see which persona is active.",
    "  • Type 'codi verbose' to see persona names; 'codi concise' to hide them.",
    "</codi-onboarding-hint>",
  ].join("\n");
}

interface BuildReminderOptions {
  liveness?: CodiLiveness;
  workspaceRoot?: string;
  /** User-level onboarding fact (XOS-443). Resolved by the caller, which has
   *  the hook input; buildReminder stays free of filesystem reads. */
  onboarded?: boolean;
}

export function buildReminder(
  state: CodiState,
  stateSource: ReminderStateSource,
  options: BuildReminderOptions = {},
): string {
  const degraded = options.liveness?.degraded ?? state.active === false;
  const unknown = options.liveness?.unknown ?? false;
  const displayVersion =
    options.liveness?.installedVersion ?? state.installed_version ?? state.version ?? "unknown";
  const healthLabel = degraded ? "DEGRADED" : unknown ? "UNINITIALIZED" : "ACTIVE";
  const personaLine = state.persona
    ? `${state.persona_icon ?? "🎯"} ${state.persona} (active persona)`
    : "Persona: auto-detect from current task";

  const scoresLine = degraded
    ? "Last response score/cal hidden: codi liveness is degraded; refresh Protocol 1 before trusting model-owned metrics"
    : unknown
      ? "Last response score/cal unavailable: this session has not completed Protocol 1 yet"
    : state.last_score !== null && state.last_cal !== null
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

  // The Stop hook owns per-turn heartbeat/counter writes. The model only persists
  // command-driven preference changes so routine turns have a single writer.
  // ⛔ XOS-443. This instruction used to name the brain-kernel path
  // (<workspace>/co-dialectic/status-state.json) and call it "the source of truth
  // across sessions and devices". Nothing had written that file in 101 DAYS.
  //
  // Both loadState() and resolveStateWriteTargets() take the session branch first,
  // and Claude Code always supplies session_id, so the brain and legacy branches
  // were unreachable. A preference written to the brain path was shadowed by the
  // session file on the very next turn and never read back — so `codi concise`
  // appeared to work for the rest of the session and silently reverted after.
  //
  // Naming a path the code never touches is the dead-ENFORCE-pointer shape
  // (XOS-407), except injected into every turn and promising a user-facing
  // guarantee. The honest instruction names the file that is actually written.
  const preferencePersistInstruction =
    `Preference persistence: only when the user changes a codi preference via command ` +
    `(\`codi cruise\` / \`codi drive\` / \`codi quiet\` / \`codi verbose\` / ` +
    `\`codi concise\` / \`codi wildcard\`), persist ONLY mode, verbosity, and wildcard ` +
    `to this session's state file. Preferences are SESSION-SCOPED — they do not ` +
    `carry to a new session or another device.`;

  const onboardingHint = buildOnboardingHint(state, options.onboarded ?? false);
  const verbosity = state.verbosity ?? "concise";
  const verbosityLine = `Verbosity: ${verbosity} (toggle: 'codi verbose' / 'codi concise')`;

  const protocol3Concise =
    "Protocol 3 (Tiered Sharpening) — CONCISE MODE (default): " +
    "lead with the ANSWER. Do NOT eagerly render the three tiers. " +
    "If the prompt has room to improve, end the response with ONE LINE: " +
    "`Sharpen? Reply I / S / D → IMPROVED / SOCRATIC / DIALECTIC (or 'codi sharpen' for all three).` " +
    "Single-key select (input-tax minimizer): if the user's NEXT message is exactly `I`, `S`, or `D` " +
    "(case-insensitive, trimmed) AND this response just offered the Sharpen prompt, treat it as picking that " +
    "one tier and render only it. Only interpret a bare I/S/D as a sharpen-select right after the offer — " +
    "never elsewhere (so a literal `D`/`S`/`I` answer to some other question is NOT hijacked). `codi sharpen` " +
    "still renders all three. " +
    "Exception: T3+ stakes (named person, public-facing, irreversible decision) → " +
    "render DIALECTIC inline even in concise mode (the user is making a one-way-door call).";

  const protocol3Verbose =
    "Protocol 3 (Tiered Sharpening) — VERBOSE MODE: " +
    "if this prompt has room to improve, render the three tiers " +
    "(IMPROVED / SOCRATIC / DIALECTIC) per spec. Auto-detect T3+ stakes " +
    "(named person, public-facing, irreversible) → eager DIALECTIC synthesis.";

  const protocol3Line = verbosity === "verbose" ? protocol3Verbose : protocol3Concise;
  const stateSourceLabel = stateSource === "session"
    ? "this session's state file"
    : "missing state (self-resurrection)";

  const lines = [
    "<codi-survival-reminder>",
    `Co-Dialectic v${displayVersion} is ${healthLabel} (state source: ${stateSourceLabel}, survives compaction).`,
    "",
    `${nowLine}`,
    `${personaLine}`,
    `${modeLine}`,
    `${verbosityLine}`,
    `${scoresLine}`,
    "Local verification: credentials for local runs are usually already in the project's env/config files (.env / .env.local); local testing is expected before you claim done — run it and paste the output.",
    "",
    "Protocol 1 (Status Line): begin EVERY response with the status line, rendered EXACTLY as `{icon} {Persona} · X% · Cal: Y% · [HH:MM]` — the [HH:MM] is the time from the OS-grounded Now line above (never recalled), so the user sees the response is temporally grounded and can scroll back to a moment. LIVE means this session's heartbeat covers the current user turn; elapsed tool time cannot make it stale. DEGRADED means its heartbeat predates the current prompt beyond the grace backstop. UNINITIALIZED means this session has no heartbeat yet. On a day boundary use [MM-DD HH:MM].",
    "Protocol 1 Verification: render the status header; the Stop hook verifies the transcript and stamps the heartbeat/counter fields.",
    protocol3Line,
    "Protocol 11 (Persona Roster): activate the appropriate persona at 0.001% caliber based on prompt domain. Task-first routing per skills/co-dialectic/task-persona-map.md — users describe tasks, not persona names.",
    "Protocol 17 (Temporal Grounding): every time-referential phrase ('tonight', 'tomorrow', 'recently', 'yesterday') in your response MUST anchor to the OS-grounded Now line above. Convert relative → absolute datetime before writing.",
    "",
    preferencePersistInstruction,
    "</codi-survival-reminder>",
  ];
  if (onboardingHint) {
    lines.push("", onboardingHint);
  }
  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const hookInput = await readHookInput();
  const [loadedState, loadedSource] = loadState(hookInput);
  if (loadedState?.active === false) {
    // `active:false` is the only cheap durable signal for an explicit `codi off`.
    // Missing state or missing `active` is UNINITIALIZED, not degraded, and
    // self-initializes when the verified Protocol 1 header completes.
    emitSilent();
  }

  const installedVersion = resolveInstalledVersion(loadedState);
  const durableState = loadedState ?? buildDefaultState(installedVersion);
  const state = recordUserPrompt(hookInput, durableState);
  const source: ReminderStateSource = loadedSource ?? "missing";
  const livenessState = sessionIdFromHookInput(hookInput) ? state : loadedState;
  const liveness = evaluateCodiLiveness(livenessState, installedVersion);
  // XOS-443: onboarding is a user-level fact; this session's turn counter
  // restarts at zero and cannot answer "has this person seen the hint before".
  const sessionId = sessionIdFromHookInput(hookInput);
  const onboarded = hasOnboarded(sessionId);
  if (!onboarded && state.growth_total_turns >= ONBOARDING_TURN_WINDOW) markOnboarded();
  const baseContext = buildReminder(state, source, {
    liveness,
    workspaceRoot: resolveWorkspaceRoot(hookInput),
    onboarded,
  });
  const degradationNudge = buildDegradationNudge(liveness);
  const survivalContext = liveness.degraded
    ? `${baseContext}\n\n${degradationNudge}`
    : baseContext;
  const additionalContext = appendCostRoutingNudge(
    survivalContext,
    costRoutingNudgeFromInput(hookInput),
  );
  const displayVersion = state.installed_version ?? state.version ?? installedVersion;
  const systemMessage = liveness.degraded
    ? degradationNudge
    : `Co-Dialectic v${displayVersion} ${liveness.unknown ? "uninitialized for this session" : "active"} · mode=${state.mode}${state.persona ? ` · persona=${state.persona}` : ""} — render status line + apply Protocol 3 tiered sharpening per spec.`;
  emit(additionalContext, systemMessage);
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.main) {
  main().catch(() => {
    process.exit(0);
  });
}
