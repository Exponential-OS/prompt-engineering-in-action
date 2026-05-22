/**
 * brain-kernel-bootstrap.ts — co-dialectic engine bootstrap for brain-kernel.
 *
 * Registers ACL declarations and lint functions with an existing brain instance.
 * Called once at engine install time (or session start when the engine is active).
 *
 * Usage:
 *   import { registerEngine, migrateLocalState } from "./brain-kernel-bootstrap.ts";
 *   const brain = createBrain(workspaceRoot);
 *   registerEngine(brain);
 *   await migrateLocalState(brain);  // one-shot; idempotent
 *
 * State migration contract:
 *   - ~/.codialectic/state.json  (machine-local, v4.16 and earlier)
 *     migrates to → co-dialectic/status-state.json  (GitHub-backed, v4.17+)
 *   - Migration fires only when the source exists AND the destination is absent.
 *   - After migration the source is left intact with a deprecation note appended.
 *     Rationale: deleting the source risks breaking the statusline.sh / survival-layer
 *     scripts that still reference ~/.codialectic/state.json on the current machine.
 *     Those scripts will be updated in a follow-up hook patch once the kernel path
 *     is confirmed stable.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import type { Brain, LintFn as LinterFn } from "../../../xos/plugins/brain-kernel/kernel.ts";
import type { LintFinding } from "../../../xos/plugins/brain-kernel/lint.ts";
import type { BrainReadAPI } from "../../../xos/plugins/brain-kernel/lint.ts";

export const ENGINE_ID = "co-dialectic";

// ─── CodiState shape ─────────────────────────────────────────────────────────

export interface CodiState {
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
}

const LEGACY_STATE_PATH = join(homedir(), ".codialectic", "state.json");
const BRAIN_STATE_PATH = "co-dialectic/status-state.json";

// ─── ACL registration ─────────────────────────────────────────────────────────

/**
 * registerAcl — declare engine namespace + read access to primitives.
 *
 * Mirrors the `brain` section in plugin.json:
 *   owned_paths:           co-dialectic/**
 *   writes_to_primitives:  [] (codi does not write primitives)
 *   reads_from_primitives: identity/skills-matrix.md, identity/handles.md
 *
 * IMPLEMENTATION NOTE: brain.acl.register() is idempotent per engine_id.
 * The first call sets the namespace. Subsequent calls on the same engine_id
 * are NO-OPs. Cross-namespace read declarations are documented here for
 * forward compatibility; the current kernel permits all reads by default
 * (ACL is write-gated, not read-gated).
 */
function registerAcl(brain: Brain): void {
  // Primary registration: sets namespace "co-dialectic" with implied
  // owned_paths: ["co-dialectic/**"].
  brain.acl.register(ENGINE_ID, "co-dialectic", "write");

  // Read declarations (NO-OPs per idempotency, kept as forward-compat docs):
  // Reads are not ACL-gated in the current kernel but declared here so that
  // if the kernel adds read enforcement these are already wired.
  brain.acl.register(ENGINE_ID, "identity/skills-matrix.md", "read");  // reads_from_primitives
  brain.acl.register(ENGINE_ID, "identity/handles.md", "read");         // reads_from_primitives
}

// ─── State I/O ─────────────────────────────────────────────────────────────────

/**
 * readBrainState — read co-dialectic/status-state.json via brain.read().
 *
 * Returns parsed CodiState on success. Returns null when:
 *   - file does not exist (never initialized → fall back to defaults)
 *   - JSON is corrupt (SPEC-CLARIFICATION-NEEDED: corrupt state file is a
 *     partial-data scenario; we prefer null + re-init over silently dropping
 *     data. Callers should treat null as "needs initialization" not "error".)
 */
export async function readBrainState(brain: Brain): Promise<CodiState | null> {
  const result = await brain.read(BRAIN_STATE_PATH);
  if (!result.ok || result.content === null) return null;
  try {
    return JSON.parse(result.content) as CodiState;
  } catch {
    // SPEC-CLARIFICATION-NEEDED: corrupt state.json. The JSON is invalid — this
    // could happen if a previous write was interrupted mid-stream. We return null
    // so callers re-initialize rather than crashing. The raw content is preserved
    // in the git history (brain.write already committed the bad bytes), so
    // recovery is possible via `git show HEAD:co-dialectic/status-state.json`.
    console.error(
      `[co-dialectic] brain-kernel-bootstrap: corrupt co-dialectic/status-state.json — ` +
      `returning null (original preserved in git history). Re-initialize via codi onboarding.`,
    );
    return null;
  }
}

/**
 * writeBrainState — persist CodiState to co-dialectic/status-state.json.
 *
 * Validates required fields before write to prevent silently persisting
 * partial state that would break the survival-layer hook.
 *
 * SPEC-CLARIFICATION-NEEDED edge cases:
 *   (1) Missing required fields: if state has unexpected shape (e.g., a manual
 *       edit dropped `active`), we write it anyway with a warning — the survival
 *       hook's `active` check defaults to "not active" on null, which is safe.
 *   (2) brain.write() failure (network/git error): we return the error to the
 *       caller rather than silently swallowing. The caller (hook / SKILL) should
 *       fall back to the legacy ~/.codialectic/state.json if brain write fails.
 */
export async function writeBrainState(
  brain: Brain,
  state: CodiState,
  why: string,
): Promise<{ ok: boolean; err?: string }> {
  // Validate required fields
  const required: (keyof CodiState)[] = ["schema_version", "active", "mode", "version"];
  const missing = required.filter((k) => state[k] === undefined || state[k] === null);
  if (missing.length > 0) {
    console.warn(
      `[co-dialectic] writeBrainState: state missing required fields: ${missing.join(", ")}. ` +
      `Writing anyway — survival hook will fall back to defaults on missing fields.`,
    );
  }

  const result = await brain.write(
    BRAIN_STATE_PATH,
    JSON.stringify(state, null, 2),
    {
      provenance: {
        who: ENGINE_ID,
        why,
        source: "brain-kernel-bootstrap.ts#writeBrainState",
      },
      engine_id: ENGINE_ID,
    },
  );

  return { ok: result.ok, err: result.err };
}

// ─── One-shot migration ──────────────────────────────────────────────────────

/**
 * migrateLocalState — migrate ~/.codialectic/state.json to brain-kernel storage.
 *
 * Idempotent: if co-dialectic/status-state.json already exists, this is a no-op.
 * Safe: never deletes the legacy file (leaves a deprecation note appended instead).
 *
 * Edge cases handled:
 *   (1) Legacy file missing → no-op (nothing to migrate).
 *   (2) Destination already exists → no-op (migration already done).
 *   (3) Legacy JSON is corrupt → copy raw content, annotate corruption in note.
 *       SPEC-CLARIFICATION-NEEDED: should we block on corrupt JSON or copy as-is?
 *       We copy as-is and add a WARNING comment. The git history preserves the
 *       exact corrupt bytes so the user can inspect and repair.
 *   (4) brain.write() fails (no git remote, rate-limit, etc.) → return error;
 *       legacy file is NOT modified. Next session will retry.
 *   (5) State has extra/unknown fields (future version schema) → JSON.parse + JSON.stringify
 *       round-trip strips no fields. We preserve all fields.
 *
 * Returns:
 *   { status: "migrated" }          — success, wrote to brain
 *   { status: "skipped" }           — destination already exists
 *   { status: "no-source" }         — ~/.codialectic/state.json not found
 *   { status: "error"; err: string }  — brain.write() failed
 */
export async function migrateLocalState(brain: Brain): Promise<{
  status: "migrated" | "skipped" | "no-source" | "error";
  err?: string;
}> {
  // Guard: destination already exists → skip (idempotent)
  const destExists = await brain.exists(BRAIN_STATE_PATH);
  if (destExists) {
    return { status: "skipped" };
  }

  // Guard: legacy source doesn't exist → nothing to migrate
  if (!existsSync(LEGACY_STATE_PATH)) {
    return { status: "no-source" };
  }

  // Read legacy state
  let rawContent: string;
  try {
    rawContent = readFileSync(LEGACY_STATE_PATH, "utf8");
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { status: "error", err: `Cannot read legacy state file: ${err}` };
  }

  // Attempt JSON parse to validate — write regardless (preserve as-is if corrupt)
  let parsedOk = true;
  try {
    JSON.parse(rawContent);
  } catch {
    parsedOk = false;
    // SPEC-CLARIFICATION-NEEDED: raw content is corrupt JSON. We copy it verbatim
    // so the git history has the original bytes. The survival hook's JSON.parse
    // will fail gracefully and return null (codi off), which is safe. The user
    // should run /co-dialectic-onboarding to re-initialize.
    console.warn(
      `[co-dialectic] migrateLocalState: legacy state.json is corrupt JSON. ` +
      `Copying verbatim to brain. Survival hook will treat this as codi=off. ` +
      `Run /co-dialectic-onboarding to repair.`,
    );
  }

  // Write to brain
  const writeResult = await brain.write(
    BRAIN_STATE_PATH,
    rawContent,
    {
      provenance: {
        who: ENGINE_ID,
        why: `one-shot migration from ${LEGACY_STATE_PATH} to brain-kernel`,
        source: "brain-kernel-bootstrap.ts#migrateLocalState",
      },
      engine_id: ENGINE_ID,
    },
  );

  if (!writeResult.ok) {
    return { status: "error", err: writeResult.err };
  }

  // Append deprecation note to legacy file (do NOT delete — too risky)
  // The statusline.sh and user-prompt-submit.ts still reference this path on the
  // current machine. They will be updated in a follow-up hook patch.
  const deprecationNote =
    `\n/* DEPRECATED — migrated to brain-kernel at co-dialectic/status-state.json on ${new Date().toISOString()}. ` +
    (parsedOk
      ? `This file is no longer the source of truth. The survival hook will read from the workspace path once the hooks are updated.`
      : `WARNING: this file contained corrupt JSON at time of migration. Please run /co-dialectic-onboarding.`) +
    ` */`;

  try {
    writeFileSync(LEGACY_STATE_PATH, rawContent + deprecationNote, "utf8");
  } catch {
    // Non-fatal: if we can't write the deprecation note, the migration still succeeded.
    // The legacy file remains unchanged.
  }

  return { status: "migrated" };
}

// ─── Linters ─────────────────────────────────────────────────────────────────

/**
 * checkFeedbackContradictions — walks co-dialectic/feedback/** and flags pairs
 * of feedback files whose titles/content contain directly contradicting claims.
 *
 * Contradiction detection: lexical pattern match only (P0.5 — best-effort,
 * not semantic). Looks for pairs where one file contains "always X" and another
 * contains "never X" (case-insensitive, where X is a non-trivial predicate).
 *
 * Severity: "info" — contradictions are a signal for human review, not a blocker.
 *
 * Limitations (SPEC-CLARIFICATION-NEEDED):
 *   - Lexical matching produces false positives on negated contexts
 *     (e.g., "always verify, never skip" in the SAME file could look like a
 *     contradiction to a naïve scanner). This is intentional for v4.17 — flag
 *     broadly and let the human filter. Tighten in a future version.
 *   - Files over 10KB are skipped (too expensive for a lint pass).
 */
export const checkFeedbackContradictions: LinterFn = async (
  brain: BrainReadAPI,
): Promise<LintFinding[]> => {
  const findings: LintFinding[] = [];

  // eslint-disable-next-line @typescript-eslint/await-thenable
  const paths = await (brain.list("co-dialectic/feedback") as unknown as Promise<string[]> | string[]);
  const feedbackPaths = paths.filter((p) => p.endsWith(".md"));

  if (feedbackPaths.length < 2) return findings; // need ≥2 files to have contradictions

  // Load content for each feedback file (skip large files)
  const MAX_BYTES = 10 * 1024;
  const contents: Array<{ path: string; content: string }> = [];
  for (const p of feedbackPaths) {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const content = await (brain.read(p) as unknown as Promise<string | null> | string | null);
    if (content === null) continue;
    if (content.length > MAX_BYTES) continue; // skip large files
    contents.push({ path: p, content: content.toLowerCase() });
  }

  // Extract "always X" and "never X" predicates from each file.
  // We capture the word after always/never as the predicate token.
  const ALWAYS_RE = /\balways\s+(\w{3,30})\b/g;
  const NEVER_RE = /\bnever\s+(\w{3,30})\b/g;

  type PredicateEntry = { predicate: string; path: string; pattern: string };
  const alwaysEntries: PredicateEntry[] = [];
  const neverEntries: PredicateEntry[] = [];

  for (const { path, content } of contents) {
    for (const match of content.matchAll(ALWAYS_RE)) {
      alwaysEntries.push({ predicate: match[1]!, path, pattern: match[0] });
    }
    for (const match of content.matchAll(NEVER_RE)) {
      neverEntries.push({ predicate: match[1]!, path, pattern: match[0] });
    }
  }

  // Find predicate collisions across DIFFERENT files
  for (const always of alwaysEntries) {
    for (const never of neverEntries) {
      if (always.path === never.path) continue; // same file — not a contradiction
      if (always.predicate !== never.predicate) continue; // different predicate — skip

      findings.push({
        severity: "info",
        path: always.path,
        message: `feedback contradiction: "${always.pattern}" in ${always.path} vs "${never.pattern}" in ${never.path}`,
        fix:
          `Review both feedback files and consolidate the rule. ` +
          `Remove or amend the weaker/older entry so codi receives a consistent signal.`,
      });
    }
  }

  return findings;
};

/**
 * checkPersonaDrift — reads the active persona from co-dialectic/personas/ and
 * checks it is a valid, recognized persona name.
 *
 * "Drift" is defined as: persona field in status-state.json names a persona
 * that has no corresponding file in co-dialectic/personas/. This catches the
 * case where a persona was renamed or deleted but status-state.json still
 * references the old name.
 *
 * Severity: "warn" — persona mismatch degrades codi quality but is not a blocker.
 *
 * Note: if status-state.json is absent (workspace not yet initialized), this
 * linter returns no findings (can't drift without a state).
 */
export const checkPersonaDrift: LinterFn = async (
  brain: BrainReadAPI,
): Promise<LintFinding[]> => {
  const findings: LintFinding[] = [];

  // Read current state
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const stateContent = await (brain.read(BRAIN_STATE_PATH) as unknown as Promise<string | null> | string | null);
  if (stateContent === null) return findings; // workspace not initialized — no drift possible

  let state: Partial<CodiState>;
  try {
    state = JSON.parse(stateContent) as Partial<CodiState>;
  } catch {
    // SPEC-CLARIFICATION-NEEDED: corrupt status-state.json. We emit a warn here
    // because a corrupt state file IS a drift condition — the codi engine
    // cannot load its persona correctly.
    findings.push({
      severity: "warn",
      path: BRAIN_STATE_PATH,
      message: "co-dialectic/status-state.json contains invalid JSON — persona state cannot be loaded",
      fix: "Run /co-dialectic-onboarding to re-initialize the state file.",
    });
    return findings;
  }

  const activePersona = state.persona;
  if (!activePersona) return findings; // null persona = auto-detect mode, no drift

  // Check whether there is a persona file for this active persona
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const personaPaths = await (brain.list("co-dialectic/personas") as unknown as Promise<string[]> | string[]);
  const personaFiles = personaPaths.filter((p) => p.endsWith(".md"));

  // Normalize: persona file slug is derived from persona name (lowercase, spaces→dashes)
  const expectedSlug = activePersona.toLowerCase().replace(/\s+/g, "-");
  const matchingFile = personaFiles.find((p) => {
    const basename = p.split("/").pop()?.replace(".md", "") ?? "";
    return basename === expectedSlug || basename.includes(expectedSlug);
  });

  if (!matchingFile) {
    findings.push({
      severity: "warn",
      path: BRAIN_STATE_PATH,
      message:
        `persona drift: active persona "${activePersona}" in status-state.json has no ` +
        `corresponding file in co-dialectic/personas/ (expected slug: ${expectedSlug})`,
      fix:
        `Either create co-dialectic/personas/${expectedSlug}.md ` +
        `or reset the active persona via "codi persona reset".`,
    });
  }

  return findings;
};

/**
 * checkCalibrationDrift — reads co-dialectic/calibration-history.md and flags
 * when the last calibration audit entry is >7 days ago.
 *
 * Rationale: the Zero-Flattery calibration audit (Protocol 8) is a recurring
 * practice. Going >7 days without a calibration pass signals that the audit
 * loop has stalled — which degrades codi output quality over time.
 *
 * Severity: "info" — calibration gap is a signal for attention, not a hard error.
 *
 * Date format expected in calibration-history.md: entries contain ISO dates
 * in the format YYYY-MM-DD, typically in a header like "## 2026-05-21" or
 * an inline "audited: 2026-05-21".
 *
 * SPEC-CLARIFICATION-NEEDED: if calibration-history.md has no date entries
 * at all (file was just created and is empty), we return a single "no audit
 * history" info finding. This is intentional — a fresh install should prompt
 * the user to do their first calibration pass.
 */
export const checkCalibrationDrift: LinterFn = async (
  brain: BrainReadAPI,
): Promise<LintFinding[]> => {
  const STALE_DAYS = 7;
  const findings: LintFinding[] = [];

  // eslint-disable-next-line @typescript-eslint/await-thenable
  const content = await (brain.read("co-dialectic/calibration-history.md") as unknown as Promise<string | null> | string | null);

  if (content === null) return findings; // file doesn't exist yet — linter skips

  // Extract all ISO date strings from the file
  const dateMatches = [...content.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)];

  if (dateMatches.length === 0) {
    findings.push({
      severity: "info",
      path: "co-dialectic/calibration-history.md",
      message: "calibration-history.md has no date entries — no audit has been recorded yet",
      fix: "Run /calibration-auditor to perform your first calibration audit and record the date.",
    });
    return findings;
  }

  // Find the most recent date
  const dates = dateMatches
    .map((m) => new Date(m[1]!))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length === 0) return findings; // all date strings were malformed — skip

  const mostRecent = dates[0]!;
  const today = new Date();
  const daysSince = Math.floor(
    (today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSince > STALE_DAYS) {
    findings.push({
      severity: "info",
      path: "co-dialectic/calibration-history.md",
      message:
        `calibration drift: last audit was ${daysSince} days ago ` +
        `(${mostRecent.toISOString().split("T")[0]}). ` +
        `Threshold: ${STALE_DAYS} days.`,
      fix: "Run /calibration-auditor to perform a fresh calibration audit.",
    });
  }

  return findings;
};

// ─── Public bootstrap entrypoint ─────────────────────────────────────────────

/**
 * registerEngine — register co-dialectic ACL declarations and linters with a
 * brain instance. Call once at engine install / session start.
 */
export function registerEngine(brain: Brain): void {
  registerAcl(brain);

  brain.lint.register("feedback-contradictions", checkFeedbackContradictions, {
    runs_on: "session-end",
  });
  brain.lint.register("persona-drift", checkPersonaDrift, {
    runs_on: "session-end",
  });
  brain.lint.register("calibration-drift", checkCalibrationDrift, {
    runs_on: "session-end",
  });
}
