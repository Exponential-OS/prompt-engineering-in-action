#!/usr/bin/env bun
/**
 * status-liveness-check.ts — Co-Dialectic v4.27.0 Stop hook harness.
 *
 * Verifies the model-authored in-message Protocol 1 status header against the
 * hook-owned liveness rule used by hooks/statusline.sh. Surfaces a loud nudge
 * via Stop-hook systemMessage, but never blocks or crashes the session.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import {
  evaluateSharedLiveness,
  staleSecsFromEnv,
  stringOr,
} from "./liveness.ts";
import {
  sessionIdFromHookInput,
  sessionStatePath,
  workspaceRootFromInput,
  type SessionAwareHookInput,
} from "./session-state.ts";

interface HookInput extends SessionAwareHookInput {
  transcript_path?: string;
}

export interface CodiStatusState {
  active?: unknown;
  mode?: unknown;
  verbosity?: unknown;
  wildcard?: unknown;
  persona?: unknown;
  persona_icon?: unknown;
  last_score?: unknown;
  last_cal?: unknown;
  installed_version?: unknown;
  version?: unknown;
  last_session_start_ts?: unknown;
  last_protocol_ts?: unknown;
  last_user_prompt_ts?: unknown;
  growth_total_turns?: unknown;
  [key: string]: unknown;
}

export interface StatusFreshness {
  live: boolean;
  degraded: boolean;
  unknown: boolean;
  stale: boolean;
  skew: boolean;
  inactive: boolean;
  installedVersion: string;
}

export interface RenderedHeader {
  firstLine: string;
  liveHeader: boolean;
  degradedHeader: boolean;
  quietFooter: boolean;
  hasNumericScore: boolean;
  hasStatusScoreToken: boolean;
  persona: string | null;
  personaIcon: string | null;
  score: number | null;
  cal: number | null;
}

export interface StateWriteTarget {
  path: string;
  authoritative: boolean;
}

export interface StatusLivenessCheck {
  reason: "silent-drop" | "missing-degraded-header" | null;
  nudge: string | null;
  freshness: StatusFreshness;
  header: RenderedHeader;
  scorePermitted: boolean;
}

const HEADER_TIME_PATTERN = String.raw`(?:\d{2}:\d{2}|\d{2}-\d{2} \d{2}:\d{2})`;
const OPTIONAL_HEADER_TIME_PATTERN = String.raw`(?: · \[${HEADER_TIME_PATTERN}\])?`;
const ICON_PERSONA_LEAD_PATTERN = String.raw`(?=[^\x00-\x7F])(?:\p{Extended_Pictographic}|\p{S})[^·%\n]{0,119}`;
const DOMAIN_NAME_PERSONA_LEAD_PATTERN = String.raw`[\p{L}\p{M}][\p{L}\p{M}\p{N}'&/ -]{0,80} \([^)·%\n]{1,80}\)`;
const PERSONA_LEAD_PATTERN = String.raw`(?:${ICON_PERSONA_LEAD_PATTERN}|${DOMAIN_NAME_PERSONA_LEAD_PATTERN})`;
const LIVE_HEADER_RE = new RegExp(
  String.raw`^(${PERSONA_LEAD_PATTERN}) · (\d{1,3})% · Cal: (\d{1,3})%${OPTIONAL_HEADER_TIME_PATTERN}$`,
  "u",
);
const DEGRADED_HEADER_RE = new RegExp(
  String.raw`^⚠ Codi DEGRADED${OPTIONAL_HEADER_TIME_PATTERN}$`,
  "u",
);
const STATUS_SCORE_TOKEN_RE = new RegExp(
  String.raw`(?:^|\n)\s*\d{1,3}% · (?:Cal:(?: \d{1,3}%)?|\[${HEADER_TIME_PATTERN}\])|· \d{1,3}% · (?:Cal:(?: \d{1,3}%)?|\[${HEADER_TIME_PATTERN}\])`,
  "u",
);

function homeDir(): string {
  return process.env.HOME?.trim() || homedir();
}

export function authoritativeStatePath(input: HookInput = {}): string {
  const sessionId = sessionIdFromHookInput(input);
  if (sessionId) return sessionStatePath(sessionId);

  // Backward-compatible no-stdin/no-session path: brain-kernel workspace first,
  // then legacy machine-local state. There is exactly one write target.
  const root = workspaceRootFromInput(input);
  const brainPath = join(root, "co-dialectic", "status-state.json");
  if (existsSync(brainPath)) return brainPath;
  return legacyStatePath();
}

export function legacyStatePath(): string {
  return join(homeDir(), ".codialectic", "state.json");
}

function brainStatePath(input: HookInput = {}): string {
  const root = workspaceRootFromInput(input);
  return join(root, "co-dialectic", "status-state.json");
}

export function resolveStateWriteTargets(input: HookInput = {}): StateWriteTarget[] {
  const sessionId = sessionIdFromHookInput(input);
  if (sessionId) {
    return [{ path: sessionStatePath(sessionId), authoritative: true }];
  }

  const brainPath = brainStatePath(input);
  const brainDir = dirname(brainPath);
  if (existsSync(brainDir)) {
    return [{ path: brainPath, authoritative: true }];
  }
  return [{ path: legacyStatePath(), authoritative: true }];
}

export function evaluateStatusFreshness(
  state: CodiStatusState | null,
  now: Date = new Date(),
  staleSecs: number = staleSecsFromEnv(),
): StatusFreshness {
  const installedVersion = stringOr(state?.installed_version, "unknown");
  const liveness = evaluateSharedLiveness(
    state,
    installedVersion,
    now,
    staleSecs,
    "boolean-or-string",
  );

  return {
    live: liveness.live,
    degraded: liveness.degraded,
    unknown: liveness.unknown,
    stale: liveness.stale,
    skew: liveness.skew,
    inactive: liveness.inactive,
    installedVersion,
  };
}

function firstNonEmptyLine(message: string): string {
  return message.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
}

function lastNonEmptyLine(message: string): string {
  const lines = message.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}

function hasStatusScoreToken(message: string): boolean {
  return STATUS_SCORE_TOKEN_RE.test(message);
}

export function parseRenderedHeader(message: string): RenderedHeader {
  const firstLine = firstNonEmptyLine(message);
  const finalLine = lastNonEmptyLine(message);
  const liveMatch = firstLine.match(LIVE_HEADER_RE);
  const liveHeader = liveMatch !== null;
  const degradedHeader = DEGRADED_HEADER_RE.test(firstLine);
  const quietFooter = /^Co-Dialectic tracking silently/.test(finalLine);
  const personaLead = liveMatch ? liveMatch[1].trim() : null;
  const personaParts = personaLead ? parsePersonaLead(personaLead) : { persona: null, personaIcon: null };
  const score = liveMatch ? Number(liveMatch[2]) : null;
  const cal = liveMatch ? Number(liveMatch[3]) : null;

  return {
    firstLine,
    liveHeader,
    degradedHeader,
    quietFooter,
    hasNumericScore: liveHeader,
    hasStatusScoreToken: hasStatusScoreToken(message),
    persona: personaParts.persona,
    personaIcon: personaParts.personaIcon,
    score,
    cal,
  };
}

function parsePersonaLead(lead: string): { persona: string | null; personaIcon: string | null } {
  const match = lead.match(/^((?:\p{Extended_Pictographic}|\p{S}))\s*(.+)$/u);
  if (!match) return { persona: lead, personaIcon: null };
  return {
    persona: match[2].trim() || null,
    personaIcon: match[1] || null,
  };
}

function buildNudge(reason: NonNullable<StatusLivenessCheck["reason"]>): string {
  if (reason === "silent-drop") {
    return [
      "⚠ CODI STATUS SILENT DROP — codi is LIVE but the Protocol 1 status line was missing.",
      "Always render `{icon} {Persona} · X% · Cal: Y% · [HH:MM]` when the heartbeat is fresh.",
    ].join("\n");
  }
  return [
    "⚠ CODI STATUS SILENT DROP — codi is DEGRADED but the required degraded header was missing.",
    "Render `⚠ Codi DEGRADED · [HH:MM]` with no score numbers.",
  ].join("\n");
}

export function checkStatusLiveness(
  message: string,
  state: CodiStatusState | null,
  now: Date = new Date(),
  staleSecs: number = staleSecsFromEnv(),
): StatusLivenessCheck {
  const freshness = evaluateStatusFreshness(state, now, staleSecs);
  const header = parseRenderedHeader(message);
  const scorePermitted = freshness.live;

  let reason: StatusLivenessCheck["reason"] = null;
  if (header.quietFooter) {
    reason = null;
  } else if (freshness.unknown) {
    // No session heartbeat is not evidence of failure. A valid header below
    // will initialize it; absence remains quiet rather than crying wolf.
    reason = null;
  } else if (!scorePermitted) {
    if (!header.liveHeader && !header.degradedHeader) {
      reason = freshness.degraded ? "missing-degraded-header" : "silent-drop";
    }
  } else if (!header.liveHeader) {
    reason = "silent-drop";
  }

  return {
    reason,
    nudge: reason ? buildNudge(reason) : null,
    freshness,
    header,
    scorePermitted,
  };
}

function readState(path: string = authoritativeStatePath()): CodiStatusState {
  if (!existsSync(path)) throw new Error("state missing");
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("state is not an object");
  }
  return parsed as CodiStatusState;
}

function readExistingStateForWrite(path: string): CodiStatusState | null {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as CodiStatusState;
  } catch {
    return null;
  }
}

function readBaseStateForWrite(
  targets: StateWriteTarget[],
  input: HookInput = {},
): CodiStatusState {
  for (const target of targets) {
    const state = readExistingStateForWrite(target.path);
    if (state !== null) return state;
  }

  // First canonical workspace write may bootstrap durable preferences from the
  // legacy file, but the legacy file is never mirrored afterward.
  if (targets.some((target) => target.path === brainStatePath(input))) {
    const legacy = readExistingStateForWrite(legacyStatePath());
    if (legacy) return legacy;
  }

  // A new per-session file derives durable preferences from the workspace
  // canonical state (or legacy bootstrap) without inheriting its heartbeat.
  if (sessionIdFromHookInput(input)) {
    const brain = readExistingStateForWrite(brainStatePath(input));
    const legacy = readExistingStateForWrite(legacyStatePath());
    const seed = brain ?? legacy;
    if (seed) {
      const next = { ...seed };
      delete next.last_protocol_ts;
      return next;
    }
  }
  return {};
}

export function resolvePluginVersion(
  existingState: CodiStatusState = {},
  hookDir: string = import.meta.dir,
): string | undefined {
  try {
    const pluginJson = join(hookDir, "..", ".claude-plugin", "plugin.json");
    const parsed = JSON.parse(readFileSync(pluginJson, "utf8"));
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // Fall through to state-backed version.
  }
  return typeof existingState.version === "string" && existingState.version.length > 0
    ? existingState.version
    : undefined;
}

function numericTurnCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function buildStampedState(
  existingState: CodiStatusState,
  header: RenderedHeader,
  now: Date,
  version: string | undefined,
): CodiStatusState {
  const next: CodiStatusState = {
    ...existingState,
    last_protocol_ts: now.toISOString(),
    growth_total_turns: numericTurnCount(existingState.growth_total_turns) + 1,
  };

  // A rendered Protocol-1 header proves codi executed → it is active. On a
  // missing/corrupt state file existingState is {} (no active), so default to
  // true here; nullish-coalesce preserves an explicit active:false (user turned
  // codi off). Without this, a from-scratch/corrupt-recovery write would leave
  // active:undefined → isActive()===false → a NEW DEGRADED-on-next-turn path
  // in the very saga this ticket ends (XOS-198 review finding).
  next.active = existingState.active ?? true;

  if (header.liveHeader) {
    next.persona = header.persona;
    next.persona_icon = header.personaIcon;
    next.last_score = header.score;
    next.last_cal = header.cal;
  }

  if (version) next.version = version;
  return next;
}

function atomicWriteJson(path: string, value: CodiStatusState): void {
  const dir = dirname(path);
  const tmpPath = join(dir, `.status-state.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmpPath, path);
}

export function stampProtocolHeartbeat(
  header: RenderedHeader,
  now: Date = new Date(),
  options: { hookDir?: string; targets?: StateWriteTarget[]; input?: HookInput } = {},
): void {
  if (!header.liveHeader && !header.degradedHeader && !header.quietFooter) return;

  const input = options.input ?? {};
  const targets = options.targets ?? resolveStateWriteTargets(input);
  const existing = readBaseStateForWrite(targets, input);
  const version = resolvePluginVersion(existing, options.hookDir);
  const next = buildStampedState(existing, header, now, version);
  for (const target of targets) {
    try {
      atomicWriteJson(target.path, next);
    } catch {
      // Stop hooks fail open: heartbeat writes must never block the session.
    }
  }
}

function textFromContent(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textFromContent);
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record.text === "string") parts.push(record.text);
  if (record.content !== undefined) parts.push(...textFromContent(record.content));
  if (record.message !== undefined) parts.push(...textFromContent(record.message));
  return parts;
}

function assistantTextFromRecord(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const obj = record as Record<string, unknown>;
  const message = obj.message && typeof obj.message === "object"
    ? obj.message as Record<string, unknown>
    : null;
  const role = obj.role ?? message?.role;
  const type = obj.type;
  const isAssistant = role === "assistant" || type === "assistant";
  if (!isAssistant) return null;

  const content = message?.content ?? obj.content ?? obj.text;
  const text = textFromContent(content).join("\n").trim();
  return text.length > 0 ? text : null;
}

export function finalAssistantMessageFromTranscript(transcript: string): string | null {
  let finalMessage: string | null = null;
  for (const line of transcript.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const text = assistantTextFromRecord(JSON.parse(trimmed));
    if (text) finalMessage = text;
  }
  return finalMessage;
}

/**
 * A REAL user turn, not a tool result.
 *
 * ⛔ Claude Code records tool results as role:"user" records whose content is
 * entirely `tool_result` blocks. Treating those as turn boundaries makes
 * "first assistant block after the last user message" collapse straight back
 * to the last block — the bug this exists to fix, wearing the fix as a
 * costume. Verified against a live 18,418-record transcript whose five most
 * recent user records were all tool_result.
 *
 * Malformed blocks (null, bare strings) do NOT establish a boundary either: a
 * judge caught the first version accepting them, which reintroduces the same
 * collapse on exactly the inputs least worth trusting.
 */
function isUserTurnRecord(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const obj = record as Record<string, unknown>;
  const message = obj.message && typeof obj.message === "object"
    ? obj.message as Record<string, unknown>
    : null;
  const isUser = (obj.role ?? message?.role) === "user" || obj.type === "user";
  if (!isUser) return false;

  const content = message?.content ?? obj.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((b) => {
    if (!b || typeof b !== "object") return false;
    return (b as Record<string, unknown>).type !== "tool_result";
  });
}

export interface TurnMessages {
  /** First assistant text of the CURRENT turn — where Protocol 1 puts the header. */
  opening: string | null;
  /** Last assistant text in the transcript — what this hook checked before XOS-389. */
  closing: string | null;
}

/**
 * Both ends of the current turn, in ONE pass.
 *
 * ⛔ XOS-389. Protocol 1 says "begin EVERY response with the status header",
 * and this hook verified that against the LAST assistant block. Those coincide
 * only when a turn makes no tool calls. The moment a turn does real work the
 * final block is mid-turn narration or a closing summary, the header sits a
 * dozen blocks earlier, and the hook reported CODI STATUS SILENT DROP and
 * wrote no heartbeat.
 *
 * So every substantial turn dropped the stamp and only trivial turns kept codi
 * alive. Measured 2026-11-06: last_protocol_ts 181 hours stale on a session
 * that had rendered the header on every turn of a 20-hour run. Worse than a
 * missed stamp, the instruction became unfollowable — comply, nothing changes,
 * the reminder becomes noise. XOS-308 fixed the nudge so a degraded session
 * knew WHAT to render; this is that rendering it still did not help.
 *
 * ⚠️ `opening` is null when no genuine user turn is found. It deliberately does
 * NOT fall back to the transcript's first assistant message: a judge flagged
 * that the first version did, so in a long session an ancient header from
 * hours earlier would satisfy the check and report a FALSE LIVE. A liveness
 * gate that lies permissively defeats its own purpose.
 *
 * Single pass because this runs on a Stop hook every turn and transcripts
 * reach 18k+ records; the first version read and JSON-parsed the file twice.
 * Stop-hook latency is not academic here — a perf fix once cut eight gates
 * from this machine's settings in a single edit.
 */
export function turnMessagesFromTranscript(transcript: string): TurnMessages {
  let closing: string | null = null;
  let opening: string | null = null;
  let seenUserTurn = false;

  for (const line of transcript.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let record: unknown;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue; // a malformed line must not blind the whole check
    }

    if (isUserTurnRecord(record)) {
      seenUserTurn = true;
      opening = null; // a new turn begins; discard the previous turn's opening
      continue;
    }

    const text = assistantTextFromRecord(record);
    if (!text) continue;
    closing = text;
    if (seenUserTurn && opening === null) opening = text;
  }

  return { opening, closing };
}

/** The opening block of the current turn, or null. */
export function openingAssistantMessageFromTranscript(transcript: string): string | null {
  return turnMessagesFromTranscript(transcript).opening;
}

/**
 * The message the header contract is verified against.
 *
 * Counts if the header OPENS the response (the contract) or CLOSES it (what
 * was checked before XOS-389). Strictly additive: no turn that satisfied the
 * old check starts failing, and a turn that actually followed Protocol 1
 * finally registers.
 *
 * ⚠️ Opening is preferred. Checking closing first was a preference inversion a
 * judge flagged — Protocol 1 names the opening as canonical, so when both ends
 * carry a header the parsed persona, score and cal must come from the one the
 * contract is about.
 */
export function readMessageForVerification(input: HookInput): string {
  if (typeof input.transcript_path !== "string" || input.transcript_path.trim().length === 0) {
    throw new Error("missing transcript path");
  }
  const raw = readFileSync(input.transcript_path, "utf8");
  const { opening, closing } = turnMessagesFromTranscript(raw);
  if (closing === null && opening === null) {
    throw new Error("missing final assistant message");
  }
  const carriesHeader = (text: string | null): boolean => {
    if (text === null) return false;
    const h = parseRenderedHeader(text);
    return h.liveHeader || h.degradedHeader || h.quietFooter;
  };
  if (carriesHeader(opening)) return opening as string;
  if (carriesHeader(closing)) return closing as string;
  return (closing ?? opening) as string;
}

function readFinalAssistantMessage(input: HookInput): string {
  if (typeof input.transcript_path !== "string" || input.transcript_path.trim().length === 0) {
    throw new Error("missing transcript path");
  }
  const raw = readFileSync(input.transcript_path, "utf8");
  const message = finalAssistantMessageFromTranscript(raw);
  if (message === null) throw new Error("missing final assistant message");
  return message;
}

function emitSilent(): never {
  process.exit(0);
}

function emitNudge(nudge: string): never {
  process.stdout.write(JSON.stringify({ systemMessage: nudge }) + "\n");
  process.exit(0);
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = (await Bun.stdin.text()).trim();
    if (!raw) emitSilent();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) emitSilent();
    input = parsed as HookInput;
  } catch {
    emitSilent();
  }

  let message = "";
  try {
    message = readMessageForVerification(input);
  } catch {
    emitSilent();
  }

  let state: CodiStatusState | null = null;
  try {
    state = readState(authoritativeStatePath(input));
  } catch {
    state = null;
  }

  const result = checkStatusLiveness(message, state);
  stampProtocolHeartbeat(result.header, new Date(), { input });
  if (result.nudge) emitNudge(result.nudge);
  emitSilent();
}

if (import.meta.main) {
  main().catch(() => {
    process.exit(0);
  });
}
