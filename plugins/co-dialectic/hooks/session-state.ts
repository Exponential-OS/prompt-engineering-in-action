import { createHash } from "crypto";
import { existsSync, mkdirSync, opendirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export interface SessionAwareHookInput {
  session_id?: string;
  sessionId?: string;
  cwd?: string;
  workspace?: string | {
    current_dir?: string;
    project_dir?: string;
  };
}

export function safeSessionId(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+$/, "");
  if (sanitized.length > 0 && sanitized.length <= 96) return sanitized;
  return `session-${createHash("sha256").update(trimmed).digest("hex").slice(0, 12)}`;
}

export function sessionIdFromHookInput(input: SessionAwareHookInput): string | null {
  return safeSessionId(input.session_id ?? input.sessionId);
}

export function codiStateDir(): string {
  return (
    process.env.CODI_STATE_DIR?.trim() ||
    join(process.env.HOME?.trim() || homedir(), ".codialectic")
  );
}

export function sessionStatePath(sessionId: string): string {
  return join(codiStateDir(), "sessions", `${sessionId}.json`);
}

/**
 * XOS-443. Onboarding completion is a USER-level fact, not a session-level one.
 *
 * It used to ride on `growth_total_turns` in a machine-global state file: a
 * returning user had a large count, so the first-run hint stayed suppressed.
 * Once state became session-scoped that counter resets to 0 on every new
 * session, which would have re-shown a 16-line "First-time orientation" block
 * for the first three prompts of every session, forever. The counter was
 * quietly doing two jobs; splitting state by session fixed one and broke the
 * other.
 *
 * So this fact gets its own home. Note this is NOT the global state file coming
 * back: that one was dead because nothing wrote it, and it carried fourteen
 * fields of session-specific data that had no business being shared. This marker
 * is written, is read, and holds exactly one fact that is genuinely true of the
 * machine rather than of a conversation.
 */
export function onboardingMarkerPath(): string {
  return join(codiStateDir(), "onboarded");
}

export const ONBOARDING_MARKER_SCHEMA = "codi.onboarded/1";

/**
 * The marker is self-describing on purpose. The file it replaces --
 * ~/.codialectic/state.json -- became unreadable in the human sense: fourteen
 * fields, no schema, no statement of what it was for, so nobody could tell
 * which parts were load-bearing and the answer defaulted to "all of them".
 * This file says what it is, who wrote it, when, and why, in the file itself,
 * so a future reader never has to infer its purpose from the code that happens
 * to still reference it.
 */
export function markOnboarded(): void {
  try {
    const path = onboardingMarkerPath();
    mkdirSync(dirname(path), { recursive: true });
    // Atomic: several sessions can reach the window at once. Writing the same
    // content twice is harmless, but a torn file is not, and presence is the
    // semantic so a half-written marker would still read as onboarded.
    atomicWriteJson(
      path,
      (
        {
          schema: ONBOARDING_MARKER_SCHEMA,
          onboarded_at: new Date().toISOString(),
          written_by: "co-dialectic/session-state.ts",
          why: "User-level fact: the first-run orientation hint has been shown. "
            + "Session state cannot answer this -- its turn counter restarts "
            + "every session. Delete this file to see onboarding again.",
        }
      ),
    );
  } catch {
    // Best-effort: failing to record onboarding re-shows a hint, which is
    // cosmetic. It must never break the prompt hook.
  }
}

/**
 * How many prior sessions count as "this person has already been onboarded".
 *
 * Mirrors ONBOARDING_TURN_WINDOW in user-prompt-submit.ts. Duplicated rather
 * than imported because that module imports this one, and a cycle here would
 * be a worse problem than a constant in two places.
 *
 * ONE prior session is NOT enough, and that distinction is the whole reason
 * this threshold exists. A brand-new user who types a single turn, closes the
 * terminal, and opens a fresh session leaves exactly one session file behind.
 * A probe that accepted it would mark them onboarded having shown the hint
 * once out of three times -- permanently, with no way back. That is an
 * ordinary first-use pattern (try it, close it, come back), not an edge case.
 *
 * At this threshold the two signals converge: every prior session rendered the
 * hint at least once, so N prior sessions means the hint was seen about N
 * times, which is what the turn counter was measuring anyway. A returning user
 * with real history clears it instantly; someone still finding their way does
 * not.
 */
export const ONBOARDING_PRIOR_SESSION_THRESHOLD = 3;

/**
 * True when at least ONBOARDING_PRIOR_SESSION_THRESHOLD sessions OTHER than
 * this one have state on disk.
 *
 * Excluding the current session matters independently: SessionStart may have
 * already written this session's own file before the first prompt, so counting
 * it would mark a genuinely-new user as onboarded on turn one.
 *
 * Reads dirents lazily and stops as soon as the threshold is met, so a user
 * with thousands of session files costs a handful of syscalls and the
 * directory is never listed. Only ever called while the marker is absent,
 * which is at most once per state dir.
 */
export function hasOtherSessionState(
  currentSessionId: string | null,
  threshold: number = ONBOARDING_PRIOR_SESSION_THRESHOLD,
): boolean {
  const selfFile = currentSessionId ? `${currentSessionId}.json` : null;
  let seen = 0;
  try {
    const dir = opendirSync(join(codiStateDir(), "sessions"));
    try {
      for (let entry = dir.readSync(); entry !== null; entry = dir.readSync()) {
        if (!entry.name.endsWith(".json")) continue;
        if (selfFile && entry.name === selfFile) continue;
        if (++seen >= threshold) return true;
      }
      return false;
    } finally {
      dir.closeSync();
    }
  } catch {
    return false;
  }
}

/**
 * Has the person behind this HOME already been through onboarding?
 *
 * Scope is per-HOME: the marker sits in CODI_STATE_DIR, which defaults under
 * $HOME, so two OS users on one machine onboard independently and a single
 * user carries their state across every session and workspace. "Machine-level"
 * elsewhere in these comments means exactly this, not literally per-device.
 *
 * FULL LIFECYCLE, since the halves live in two files and neither tells the
 * whole story alone:
 *
 *   1. Brand-new HOME, first turn: no marker, no other session state ->
 *      hasOnboarded() false -> the hint renders. No marker is written yet;
 *      the person has not finished onboarding, they have just started it.
 *   2. Turns 2..N of that first session: same, hint still rendering, counter
 *      climbing.
 *   3. The turn where growth_total_turns reaches ONBOARDING_TURN_WINDOW: the
 *      caller in user-prompt-submit.ts writes the marker. Onboarding is now
 *      complete and will never re-fire for this HOME.
 *   4. Any later session: existsSync short-circuits on the first line. One
 *      syscall, no probe.
 *   5. Upgrading user who onboarded before this marker existed: no marker,
 *      but other session files are present -> treated as onboarded and the
 *      marker is written once, so the probe never runs again.
 *
 * The probe is therefore a migration path, not steady-state behavior, and it
 * excludes the current session's own file -- see hasOtherSessionState.
 *
 * Failure modes are deliberately asymmetric: if the marker cannot be written,
 * the worst case is that someone sees a hint again. If it could wrongly
 * suppress, a real new user would never see onboarding at all. So every
 * uncertain path resolves toward showing the hint.
 */
export function hasOnboarded(currentSessionId: string | null): boolean {
  if (existsSync(onboardingMarkerPath())) return true;
  if (hasOtherSessionState(currentSessionId)) {
    markOnboarded();
    return true;
  }
  return false;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function workspaceRootFromInput(input: SessionAwareHookInput): string {
  const explicitRoot = nonEmpty(process.env.BRAIN_WORKSPACE_ROOT);
  if (explicitRoot) return explicitRoot;

  if (typeof input.workspace === "string") {
    const workspace = nonEmpty(input.workspace);
    if (workspace) return workspace;
  } else if (input.workspace && typeof input.workspace === "object") {
    const projectDir = nonEmpty(input.workspace.project_dir);
    if (projectDir) return projectDir;
    const currentDir = nonEmpty(input.workspace.current_dir);
    if (currentDir) return currentDir;
  }

  const cwd = nonEmpty(input.cwd);
  if (cwd) return cwd;
  return nonEmpty(process.env.CAREER_HOME) ?? process.cwd();
}

export function readJsonObject(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function atomicWriteJson(path: string, value: Record<string, unknown>): void {
  const dir = dirname(path);
  const tmpPath = join(
    dir,
    `.session-state.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmpPath, path);
}
