#!/usr/bin/env bun
/**
 * user-prompt-submit.ts — Co-Dialectic survival hook.
 *
 * Fires on EVERY user message in Claude Code (UserPromptSubmit event).
 * Reads ~/.codialectic/state.json — the persistent source of truth for whether
 * codi is active, mode, persona, last scores.
 *
 * If active=true, emits a system-reminder via additionalContext that:
 *   - Tells Claude codi is active and which mode is in effect
 *   - Reminds Claude to render the Protocol 1 status line on this response
 *   - Provides the current persona + last scores
 *   - Activates Protocol 3 (tiered sharpening) if applicable
 *
 * Survives context compaction because: the hook config is in ~/.claude/settings.json
 * (persistent), the state file is on disk (persistent), and the hook fires regardless
 * of skill activation state. Compaction cannot turn codi off — only an explicit
 * `codi off` command from the user can.
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

import { readFileSync, writeFileSync, existsSync } from "fs";
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
}

const STATE_PATH = join(homedir(), ".codialectic", "state.json");

function loadState(): CodiState | null {
  if (!existsSync(STATE_PATH)) return null;
  try {
    const raw = readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw) as CodiState;
  } catch {
    return null;
  }
}

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

function emitSilent(): never {
  // No additionalContext = hook fires but adds nothing
  process.stdout.write(JSON.stringify({
    decision: "approve",
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: "" },
  }) + "\n");
  process.exit(0);
}

function osGroundedDate(): string {
  // TEMPORAL GROUNDING INVARIANT (v4.16.0): inject OS-grounded datetime into
  // every prompt context. Prevents the "agent says 'tonight' at 1pm Monday"
  // failure mode caused by stale internal time recall. This is the structural
  // wire for the temporal-grounding harness at ~/cyborg/rules/temporal-grounding/.
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

function buildReminder(state: CodiState): string {
  const personaLine = state.persona
    ? `${state.persona_icon ?? "🎯"} ${state.persona} (active persona)`
    : "Persona: auto-detect from current task";

  const scoresLine =
    state.last_score !== null && state.last_cal !== null
      ? `Last response: ${state.last_score}% · Cal: ${state.last_cal}%`
      : "Status line will populate on this response";

  const modeLine = `Mode: ${state.mode}${state.honesty !== "grounded" ? ` · honesty:${state.honesty}` : ""}${state.wildcard ? " · 🃏 Wildcard ON" : ""}`;

  const nowLine = `Now (OS-grounded, do NOT recall from memory): ${osGroundedDate()}`;

  return [
    "<codi-survival-reminder>",
    `Co-Dialectic v${state.version} is ACTIVE (persistent via ~/.codialectic/state.json, survives compaction).`,
    "",
    `${nowLine}`,
    `${personaLine}`,
    `${modeLine}`,
    `${scoresLine}`,
    "",
    "Protocol 1 (Status Line): begin EVERY response with the persona/score/Cal line.",
    "Protocol 3 (Tiered Sharpening): if this prompt has room to improve, render the three tiers (IMPROVED / SOCRATIC / DIALECTIC) per spec. Auto-detect T3+ stakes (named person, public-facing, irreversible) → eager DIALECTIC synthesis.",
    "Protocol 11 (Persona Roster): activate the appropriate persona at 0.001% caliber based on prompt domain.",
    "Protocol 17 (Temporal Grounding): every time-referential phrase ('tonight', 'tomorrow', 'recently', 'yesterday') in your response MUST anchor to the OS-grounded Now line above. Convert relative → absolute datetime before writing.",
    "",
    "After your response, write back to ~/.codialectic/state.json with the new last_score, last_cal, and persona. The state file is the source of truth across sessions and compactions.",
    "</codi-survival-reminder>",
  ].join("\n");
}

function main(): void {
  const state = loadState();
  if (!state) {
    emitSilent(); // no state file = codi never initialized = silent
  }
  if (!state.active) {
    emitSilent(); // explicitly disabled by user (codi off)
  }
  const additionalContext = buildReminder(state);
  const systemMessage = `Co-Dialectic v${state.version} active · mode=${state.mode}${state.persona ? ` · persona=${state.persona}` : ""} — render status line + apply Protocol 3 tiered sharpening per spec.`;
  emit(additionalContext, systemMessage);
}

main();
