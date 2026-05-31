#!/usr/bin/env bun
/**
 * precompact-handoff.ts — Co-Dialectic v4.21.0 auto-handoff-before-compaction.
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
 * What this hook does:
 *   - Reads the PreCompact payload from stdin (transcript_path, trigger reason)
 *   - Writes a marker file at ~/.codialectic/last-precompact.json with timestamp,
 *     trigger, and transcript path — so post-compaction Claude can verify a
 *     handoff was attempted + find the source transcript if needed
 *   - Emits `hookSpecificOutput.additionalContext` with a strong, structured
 *     system reminder telling Claude to INVOKE the codi-handoff skill
 *     IMMEDIATELY before compaction proceeds. The reminder is preserved in
 *     the post-compaction context, so even if compaction happens before
 *     Claude responds, the next Claude turn sees the explicit instruction.
 *
 * Why option (b) — reminder, not direct file write:
 *   - The codi-handoff skill already has Protocol 9 closure-detection logic,
 *     structured packet schema, workspace-substrate dispatch (GitHub Issues /
 *     HANDOFF.md / etc.). Duplicating that in this hook would diverge over time.
 *   - Hook stays minimal — single responsibility (trigger), not implementation.
 *   - Skill invocation lets the active persona + caliber rules apply to the
 *     handoff content (architecture / product / debugging persona shapes the
 *     "what's unfinished" framing).
 *
 * Fail-safe: ALWAYS exit 0. Never blocks compaction. If the marker file write
 * fails, log to stderr and proceed — compaction must not be blocked by hook
 * errors.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CODI_DIR = join(homedir(), ".codialectic");
const MARKER_FILE = join(CODI_DIR, "last-precompact.json");

interface PreCompactInput {
  hook_event_name?: string;
  transcript_path?: string;
  trigger?: "manual" | "auto" | string;
  cwd?: string;
  session_id?: string;
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
  const trigger = input.trigger ?? "unknown";
  const transcript = input.transcript_path ?? "(not provided)";
  const cwd = input.cwd ?? process.cwd();

  // Write marker file (best-effort; never block on failure)
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
          session_id: input.session_id ?? null,
          schema_version: "1.0.0",
        },
        null,
        2
      )
    );
  } catch (e) {
    process.stderr.write(`precompact-handoff: marker write failed: ${e}\n`);
  }

  const reminder = [
    "━━━ PRE-COMPACT HANDOFF TRIGGER ━━━",
    `Compaction is firing (trigger=${trigger}, at=${now}). The full conversation`,
    "context is intact for the LAST TIME before summarization. Capture handoff NOW.",
    "",
    "REQUIRED ACTION before the next user turn:",
    "  1. Invoke the codi-handoff skill (Protocol 9 — auto closure detection).",
    "  2. Let it run its phases: scan unfinished items, decisions, lessons, ",
    "     codify open follow-ups with crisp triggers, emit structured packet.",
    "  3. The workspace adapter persists to NEXT_SESSION_HANDOFF.md or the",
    "     configured substrate (GitHub Issues, etc.). Codi knows nothing about",
    "     the substrate — it captures + emits.",
    "",
    "DO NOT skip this. DO NOT write the handoff manually via Edit/Write — the",
    "skill has the structured-packet schema + workspace dispatch. Manual writes",
    "lose the structure and diverge from the canonical Protocol 9 spec.",
    "",
    `Marker: ${MARKER_FILE} (post-compact Claude can read this to verify).`,
    "Reference: codi-handoff skill at ~/.claude/skills/handoff/SKILL.md.",
    "━━━ END PRE-COMPACT TRIGGER ━━━",
  ].join("\n");

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreCompact",
      additionalContext: reminder,
    },
    systemMessage: `Co-Dialectic: PreCompact firing — auto-handoff triggered (trigger=${trigger}).`,
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  // Fail-safe: never block compaction on error
  process.stderr.write(`precompact-handoff error: ${err}\n`);
  process.exit(0);
});
