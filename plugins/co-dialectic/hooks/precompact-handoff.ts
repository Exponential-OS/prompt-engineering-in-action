#!/usr/bin/env bun
/**
 * precompact-handoff.ts — Co-Dialectic v4.21.1 auto-handoff-before-compaction.
 *
 * Belt-and-suspenders: emits Claude reminder AND captures structured packet.
 *
 * Fires on PreCompact event (Claude Code's signal that the context window is
 * about to be compacted into a summary). At this moment, the session has its
 * FULL conversation context intact for the last time. If we don't capture
 * structured handoff NOW, the post-compaction summary will lose:
 *   - the actual unfinished tasks the user just discussed
 *   - the decisions made in the current arc
 *   - the lessons that should be codified
 *   - the open follow-ups and their crisp triggers
 *
 * Two-layer capture (v4.21.1):
 *   1. RECOMMEND layer — emit hookSpecificOutput.additionalContext with
 *      strong system-reminder telling Claude to invoke the codi-handoff skill
 *      IMMEDIATELY. This is the rich path: the skill has Protocol 9 logic,
 *      structured packet schema, workspace-substrate dispatch.
 *   2. CAPTURE layer (belt-and-suspenders) — write a structured JSON packet
 *      to ~/.codialectic/precompact-packet-<timestamp>.json containing what
 *      we CAN deterministically capture from the hook context: timestamp,
 *      trigger, cwd, git state (branch, uncommitted files, recent commits),
 *      transcript_path. Even if Claude ignores the reminder, this packet
 *      survives — the next session's waky-waky can find + read it.
 *
 * Why both layers:
 *   - Layer 1 alone fails when Claude is mid-tool-use and can't act before
 *     compaction completes, OR when Claude (me) pattern-matches incorrectly
 *     and writes the handoff manually instead of invoking the skill.
 *   - Layer 2 alone is structurally limited — only knows what's in the OS,
 *     not what's in the conversation. Misses the "unfinished work" semantic.
 *   - Together: deterministic floor + conversational ceiling.
 *
 * Fail-safe: ALWAYS exit 0. Never blocks compaction. If either layer fails,
 * log to stderr and proceed — compaction must not be blocked by hook errors.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";

const CODI_DIR = join(homedir(), ".codialectic");
const MARKER_FILE = join(CODI_DIR, "last-precompact.json");

interface PreCompactInput {
  hook_event_name?: string;
  transcript_path?: string;
  trigger?: "manual" | "auto" | string;
  cwd?: string;
  session_id?: string;
}

interface GitState {
  in_repo: boolean;
  branch?: string;
  head_sha?: string;
  head_subject?: string;
  uncommitted_files_count?: number;
  uncommitted_files?: string[];
  recent_commits?: Array<{ sha: string; subject: string }>;
  has_uncommitted_handoff_doc?: boolean;
  error?: string;
}

function captureGitState(cwd: string): GitState {
  try {
    // Check if cwd is inside a git repo
    const inRepo = spawnSync("git", ["-C", cwd, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
    });
    if ((inRepo.status ?? 1) !== 0) {
      return { in_repo: false };
    }

    const branchRes = spawnSync("git", ["-C", cwd, "branch", "--show-current"], { encoding: "utf8" });
    const branch = (branchRes.stdout ?? "").trim() || "(detached)";

    const headRes = spawnSync("git", ["-C", cwd, "log", "-1", "--format=%H|%s"], { encoding: "utf8" });
    const [head_sha = "", head_subject = ""] = (headRes.stdout ?? "").trim().split("|", 2);

    const statusRes = spawnSync("git", ["-C", cwd, "status", "--porcelain"], { encoding: "utf8" });
    const allUncommitted = (statusRes.stdout ?? "")
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const uncommittedFiles = allUncommitted.slice(0, 50).map((l) => l.slice(3));
    const hasHandoffDoc = allUncommitted.some((l) =>
      l.includes("NEXT_SESSION_HANDOFF.md") || l.includes("HANDOFF.md")
    );

    const logRes = spawnSync(
      "git",
      ["-C", cwd, "log", "--oneline", "-10", "--format=%h|%s"],
      { encoding: "utf8" }
    );
    const recent_commits = (logRes.stdout ?? "")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        const [sha = "", ...rest] = l.split("|");
        return { sha, subject: rest.join("|") };
      });

    return {
      in_repo: true,
      branch,
      head_sha: head_sha.slice(0, 12),
      head_subject,
      uncommitted_files_count: allUncommitted.length,
      uncommitted_files: uncommittedFiles,
      recent_commits,
      has_uncommitted_handoff_doc: hasHandoffDoc,
    };
  } catch (e) {
    return { in_repo: false, error: String(e) };
  }
}

async function main(): Promise<void> {
  let input: PreCompactInput = {};
  try {
    const raw = await Bun.stdin.text();
    if (raw && raw.trim()) input = JSON.parse(raw);
  } catch {
    // Malformed stdin — proceed with empty input; never block compaction
  }

  const now = new Date().toISOString();
  const tsCompact = now.replace(/[:.]/g, "-");
  const trigger = input.trigger ?? "unknown";
  const transcript = input.transcript_path ?? null;
  const cwd = input.cwd ?? process.cwd();
  const sessionId = input.session_id ?? null;

  // ── Layer 2: CAPTURE — structured packet to disk ──────────────────────────
  const gitState = captureGitState(cwd);
  const packet = {
    schema_version: "1.0.0",
    ts: now,
    trigger,
    cwd,
    session_id: sessionId,
    transcript_path: transcript,
    git: gitState,
    notes: [
      "This is the minimal deterministic packet captured by the precompact-handoff hook.",
      "It does NOT contain conversation semantics (unfinished work, decisions, lessons).",
      "Those live in the full codi-handoff skill output. If Claude invoked the skill,",
      "look for a richer handoff in NEXT_SESSION_HANDOFF.md or the workspace substrate.",
      "If Claude did NOT invoke the skill, this packet is the only structured record",
      "of pre-compaction state — combine with transcript_path to reconstruct.",
    ],
    next_step_for_post_compact_claude: [
      "1. Read this packet + check transcript_path to see what was in flight.",
      "2. If NEXT_SESSION_HANDOFF.md was uncommitted, the skill may have been invoked",
      "   but didn't complete the commit — check the diff and finish the work.",
      "3. If uncommitted_files is non-empty, those represent in-flight work — commit",
      "   or stash before starting new tasks.",
    ],
  };

  let packetFile: string | null = null;
  try {
    if (!existsSync(CODI_DIR)) mkdirSync(CODI_DIR, { recursive: true });
    packetFile = join(CODI_DIR, `precompact-packet-${tsCompact}.json`);
    writeFileSync(packetFile, JSON.stringify(packet, null, 2));
  } catch (e) {
    process.stderr.write(`precompact-handoff: packet write failed: ${e}\n`);
  }

  // Marker file (latest-only) for easy discovery by post-compact Claude
  try {
    if (!existsSync(CODI_DIR)) mkdirSync(CODI_DIR, { recursive: true });
    writeFileSync(
      MARKER_FILE,
      JSON.stringify(
        {
          ts: now,
          trigger,
          transcript_path: transcript,
          cwd,
          session_id: sessionId,
          packet_file: packetFile,
          git_uncommitted_count: gitState.uncommitted_files_count ?? 0,
          git_branch: gitState.branch ?? null,
          schema_version: "1.1.0",
        },
        null,
        2
      )
    );
  } catch (e) {
    process.stderr.write(`precompact-handoff: marker write failed: ${e}\n`);
  }

  // ── Layer 1: RECOMMEND — system-reminder to invoke skill ─────────────────
  const reminder = [
    "━━━ PRE-COMPACT HANDOFF TRIGGER (v4.21.1) ━━━",
    `Compaction is firing (trigger=${trigger}, at=${now}). The full conversation`,
    "context is intact for the LAST TIME before summarization. Capture handoff NOW.",
    "",
    "REQUIRED ACTION before the next user turn:",
    "  1. Invoke the codi-handoff skill (Protocol 9 — auto closure detection).",
    "  2. Let it run its phases: scan unfinished items, decisions, lessons,",
    "     codify open follow-ups with crisp triggers, emit structured packet.",
    "  3. The workspace adapter persists to NEXT_SESSION_HANDOFF.md or the",
    "     configured substrate (GitHub Issues, etc.). Codi knows nothing about",
    "     the substrate — it captures + emits.",
    "",
    "DO NOT skip this. DO NOT write the handoff manually via Edit/Write — the",
    "skill has the structured-packet schema + workspace dispatch. Manual writes",
    "lose the structure and diverge from the canonical Protocol 9 spec.",
    "",
    "BELT-AND-SUSPENDERS (v4.21.1): a minimal deterministic packet was already",
    `written to ${packetFile ?? "(packet write failed — check stderr)"}`,
    "containing timestamp, trigger, cwd, git state (branch, uncommitted files,",
    "recent commits), and transcript_path. This is the structural floor. The",
    "codi-handoff skill provides the semantic ceiling. Both matter.",
    "",
    `Git state at capture: branch=${gitState.branch ?? "n/a"}, ` +
      `uncommitted=${gitState.uncommitted_files_count ?? 0}, ` +
      `HEAD=${gitState.head_sha ?? "n/a"}.`,
    gitState.has_uncommitted_handoff_doc
      ? "⚠ NEXT_SESSION_HANDOFF.md is uncommitted — may indicate in-flight handoff work."
      : "",
    "",
    `Marker: ${MARKER_FILE} (post-compact Claude can read this to verify).`,
    "Reference: codi-handoff skill at ~/.claude/skills/handoff/SKILL.md.",
    "━━━ END PRE-COMPACT TRIGGER ━━━",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreCompact",
      additionalContext: reminder,
    },
    systemMessage:
      `Co-Dialectic v4.21.1: PreCompact firing — auto-handoff captured ` +
      `(trigger=${trigger}, packet=${packetFile ? "✓" : "✗"}, ` +
      `git_uncommitted=${gitState.uncommitted_files_count ?? "n/a"}).`,
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  // Fail-safe: never block compaction on error
  process.stderr.write(`precompact-handoff error: ${err}\n`);
  process.exit(0);
});
