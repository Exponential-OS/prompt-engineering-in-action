#!/usr/bin/env bun
/**
 * unit-of-work-check.ts — Co-Dialectic v4.16.0 Stop hook harness.
 *
 * Enforces the UNIT-OF-WORK COMMIT PROTOCOL from workspace CLAUDE.md:
 *
 *   "Every prompt response is a unit of work. Like a database transaction,
 *    it must commit before it closes. After EVERY response that produces any
 *    of the following: a file write, a decision, a key fact, a status change,
 *    a drafted artifact — update AGENT_STATUS.yaml and git commit+push."
 *
 * Fires on Stop. If cwd is a Career-OS-style workspace AND there are
 * uncommitted changes beyond the session's ambient dirty baseline, surface a
 * banner reminding the user that the unit of work hasn't closed yet.
 *
 * WORKSPACE-IDENTITY GATE — same pattern as the v0.66 session-logger fix:
 *   - $CAREER_HOME env var matches cwd, OR
 *   - brain/identity/ dir exists in cwd, OR
 *   - .career-os-workspace sentinel exists
 * None match → silent no-op (this is a Career-OS-coupled discipline; do not
 * lecture about uncommitted state in unrelated repos like /private/tmp).
 *
 * Exit: ALWAYS 0. Surfaces signal, never blocks. The agent and the user
 * decide whether to commit.
 *
 * Why this is a HARNESS not just a memory entry:
 *   2026-05-14 incident: an uncommitted unit of work survived a context
 *   compaction; the next agent didn't see the state; user lost ~2 hours of
 *   work. Memory entry alone didn't prevent recurrence. A wired Stop hook
 *   that fires unconditionally does.
 */

import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join } from "path";

interface HookInput {
  cwd?: string;
  session_id?: string;
  sessionId?: string;
  transcript_path?: string;
}

function isCareerOsWorkspace(cwd: string): boolean {
  const careerHome = process.env.CAREER_HOME;
  if (careerHome && careerHome.trim() === cwd) return true;
  if (existsSync(join(cwd, "brain", "identity"))) return true;
  if (existsSync(join(cwd, ".career-os-workspace"))) return true;
  return false;
}

function dirtyPathFromStatusLine(line: string): string | null {
  const status = line.slice(0, 2);
  let path = line.length > 3 ? line.slice(3).trim() : "";
  if ((status.includes("R") || status.includes("C")) && path.includes(" -> ")) {
    path = path.slice(path.lastIndexOf(" -> ") + 4).trim();
  }
  return path.length > 0 ? path : null;
}

function gitDirtyPaths(cwd: string): string[] | null {
  // Confirm cwd is inside a git repo first
  const inRepo = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (inRepo.status !== 0) return null;
  const result = spawnSync("git", ["-C", cwd, "status", "--short"], { encoding: "utf8", timeout: 5000 });
  if (result.status !== 0) return null;
  const lines = result.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const paths = lines
    .map((line) => dirtyPathFromStatusLine(line))
    .filter((path): path is string => path !== null);
  return Array.from(new Set(paths)).sort();
}

function safeSessionKey(raw: string): string {
  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+$/, "");
  if (sanitized.length > 0 && sanitized.length <= 96) return sanitized;

  const digest = createHash("sha256").update(trimmed).digest("hex").slice(0, 12);
  const prefix = sanitized.slice(0, 80) || "session";
  return `${prefix}-${digest}`;
}

function sessionKey(input: HookInput, cwd: string): string {
  if (typeof input.session_id === "string" && input.session_id.trim().length > 0) {
    return safeSessionKey(input.session_id);
  }
  if (typeof input.sessionId === "string" && input.sessionId.trim().length > 0) {
    return safeSessionKey(input.sessionId);
  }
  if (typeof input.transcript_path === "string" && input.transcript_path.trim().length > 0) {
    const transcriptBase = basename(input.transcript_path);
    if (transcriptBase.trim().length > 0) return safeSessionKey(transcriptBase);
  }

  const cwdHash = createHash("sha256").update(cwd).digest("hex").slice(0, 12);
  return `cwd-${cwdHash}`;
}

function baselinePath(input: HookInput, cwd: string): string {
  const stateRoot = process.env.CLAUDE_PLUGIN_DATA?.trim() || join(process.env.HOME || homedir(), ".career-os-state");
  return join(stateRoot, "unit-of-work-baseline", `${sessionKey(input, cwd)}.json`);
}

function readBaseline(path: string): Set<string> {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Invalid unit-of-work baseline");
  return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
}

function writeBaseline(path: string, paths: string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(paths, null, 2) + "\n");
}

function emitSilent(): never {
  // Stop hook contract: just exit 0 (no payload needed for silent pass)
  process.exit(0);
}

function emitReminder(banner: string, context: string): never {
  // Stop hook schema does NOT accept hookSpecificOutput.additionalContext —
  // that field is PreToolUse / UserPromptSubmit only. Same-class bug previously
  // fixed in stop-hook-learning-flywheel.ts (cyborg/main 6bf6a8a, 2026-05-22).
  // For Stop hooks, fold the context into systemMessage — it surfaces to the
  // user without blocking the session close and stays schema-valid.
  const payload = {
    systemMessage: `${banner}\n\n${context}`,
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = (await Bun.stdin.text()).trim();
    if (raw) input = JSON.parse(raw);
  } catch {
    // Malformed stdin — fail-open
    emitSilent();
  }

  const cwd = input.cwd ?? process.cwd();
  if (!isCareerOsWorkspace(cwd)) emitSilent();

  const currentPaths = gitDirtyPaths(cwd);
  if (!currentPaths) emitSilent(); // not a git repo, can't reason about it

  const stateFile = baselinePath(input, cwd);
  if (!existsSync(stateFile)) {
    writeBaseline(stateFile, currentPaths);
    emitSilent(); // first Stop in this session snapshots ambient dirty state
  }

  const baseline = readBaseline(stateFile);
  const newPaths = currentPaths.filter((path) => !baseline.has(path));
  if (newPaths.length === 0) emitSilent(); // clean session delta — unit of work either had no writes or was committed

  // Uncommitted changes from this session exist in a workspace cwd. Surface as reminder.
  const sample = newPaths.slice(0, 5);
  const fileList = sample.map((path) => `  ${path}`).join("\n");
  const more = newPaths.length > sample.length ? `\n  … and ${newPaths.length - sample.length} more` : "";

  const banner = `⚠ Unit-of-work not committed: ${newPaths.length} file${newPaths.length === 1 ? "" : "s"} from this session uncommitted. Commit + push before the next prompt (CLAUDE.md UNIT-OF-WORK protocol).`;

  const context = [
    `╭─ unit-of-work-check harness (Stop hook) ────────`,
    `│ Workspace: ${cwd}`,
    `│ Uncommitted files from this session: ${newPaths.length}`,
    `╰────`,
    ``,
    `Files:`,
    fileList + more,
    ``,
    `Per workspace CLAUDE.md "UNIT-OF-WORK COMMIT PROTOCOL":`,
    `  Every prompt response is a unit of work. Like a database transaction,`,
    `  it must commit before it closes. Two-hour data losses have been traced`,
    `  to compactions that hit before a multi-write unit of work landed.`,
    ``,
    `Suggested next action (release-branch workflow):`,
    `  git -C "${cwd}" checkout -b status/<slug>-$(date +%Y-%m-%d)`,
    `  git -C "${cwd}" add -- <only-your-paths>`,
    `  git -C "${cwd}" commit -- <only-your-paths> -m "..."`,
    `  git -C "${cwd}" checkout main && git -C "${cwd}" merge --ff-only status/<slug>-...`,
    `  git -C "${cwd}" push origin main`,
    ``,
    `If the unit was purely informational (no writes, no decisions), the diff`,
    `should clear naturally. If not, commit now.`,
  ].join("\n");

  emitReminder(banner, context);
}

main().catch(() => {
  // Fail-open: NEVER block the Stop event due to harness errors.
  process.exit(0);
});
