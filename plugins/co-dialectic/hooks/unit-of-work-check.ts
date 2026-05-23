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
 * uncommitted changes, surface a banner reminding the user that the unit of
 * work hasn't closed yet.
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
import { existsSync } from "fs";
import { join } from "path";

interface HookInput {
  cwd?: string;
}

function isCareerOsWorkspace(cwd: string): boolean {
  const careerHome = process.env.CAREER_HOME;
  if (careerHome && careerHome.trim() === cwd) return true;
  if (existsSync(join(cwd, "brain", "identity"))) return true;
  if (existsSync(join(cwd, ".career-os-workspace"))) return true;
  return false;
}

function gitStatusShort(cwd: string): { changes: number; sample: string[] } | null {
  // Confirm cwd is inside a git repo first
  const inRepo = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (inRepo.status !== 0) return null;
  const result = spawnSync("git", ["-C", cwd, "status", "--short"], { encoding: "utf8", timeout: 5000 });
  if (result.status !== 0) return null;
  const lines = result.stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return { changes: lines.length, sample: lines.slice(0, 5) };
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

  const status = gitStatusShort(cwd);
  if (!status) emitSilent();              // not a git repo, can't reason about it
  if (status.changes === 0) emitSilent(); // clean tree — unit of work either had no writes or was committed

  // Uncommitted changes exist in a workspace cwd. Surface as reminder.
  const fileList = status.sample.map((l) => `  ${l}`).join("\n");
  const more = status.changes > status.sample.length ? `\n  … and ${status.changes - status.sample.length} more` : "";

  const banner = `⚠ Unit-of-work not committed: ${status.changes} file${status.changes === 1 ? "" : "s"} changed in workspace. Commit + push before the next prompt (CLAUDE.md UNIT-OF-WORK protocol).`;

  const context = [
    `╭─ unit-of-work-check harness (Stop hook) ────────`,
    `│ Workspace: ${cwd}`,
    `│ Uncommitted files: ${status.changes}`,
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
