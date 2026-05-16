#!/usr/bin/env bun
/**
 * agent-lifecycle.ts — Codi Agents background lifecycle manager.
 *
 * Replaces agent_lifecycle.py (dead-end: monitored wrong output path).
 *
 * Root-cause fix: Python version polled ~/.co-dialectic/task-outputs/{codi-agent-id}.txt
 * but Claude Code writes output to /private/tmp/claude-501/.../tasks/{task_id}.output.
 * No codi-agent-id → task_id mapping existed → completion never auto-detected → stuck.
 *
 * This version removes the broken file-based detection. Completion relies on
 * the agent explicitly calling `complete --agent-id {fish_id}` (injected into
 * its prompt by claude-code.ts). Timeout is the safety net for stuck agents.
 *
 * Commands:
 *   register   --agent-id <id> --files <f1> [f2...] [--description "..."]
 *   check-dedup --files <f1> [f2...]
 *   poll       [--timeout-min <N>]
 *   status
 *   complete   --agent-id <id>
 *
 * State: ~/.co-dialectic/agent-lifecycle.json (atomic writes via tmp-then-rename)
 * Exit:  0=PASS  1=BLOCK  2=WARN
 */

import { mkdirSync, writeFileSync, renameSync, existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

type AgentStatus = "running" | "completed" | "stuck" | "capacity-error";

interface AgentRecord {
  registered_at: string;
  description: string;
  target_files: string[];
  status: AgentStatus;
  last_polled: string;
}

interface LifecycleState {
  agents: Record<string, AgentRecord>;
}

interface Conflict {
  agent_id: string;
  conflicting_files: string[];
}

// ── State persistence ────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".co-dialectic");
const STATE_FILE = join(STATE_DIR, "agent-lifecycle.json");

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function loadState(): LifecycleState {
  if (!existsSync(STATE_FILE)) return { agents: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as LifecycleState;
  } catch {
    return { agents: {} };
  }
}

function saveState(state: LifecycleState): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = STATE_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_FILE);
}

function runningAgents(state: LifecycleState): Record<string, AgentRecord> {
  return Object.fromEntries(
    Object.entries(state.agents).filter(([, v]) => v.status === "running"),
  );
}

function fileConflicts(files: string[], running: Record<string, AgentRecord>): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const [agentId, info] of Object.entries(running)) {
    const overlap = files.filter((f) => info.target_files.includes(f));
    if (overlap.length > 0) {
      conflicts.push({ agent_id: agentId, conflicting_files: overlap });
    }
  }
  return conflicts;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdRegister(agentId: string, files: string[], description: string): number {
  const state = loadState();
  const running = runningAgents(state);
  const conflicts = fileConflicts(files, running);

  if (conflicts.length > 0) {
    process.stdout.write(
      JSON.stringify({
        verdict: "BLOCK",
        reason: "file conflict — existing agent already targeting these files",
        conflicting_agents: conflicts,
        files,
      }) + "\n",
    );
    return 1;
  }

  state.agents[agentId] = {
    registered_at: nowIso(),
    description,
    target_files: files,
    status: "running",
    last_polled: nowIso(),
  };
  saveState(state);
  process.stdout.write(JSON.stringify({ verdict: "PASS", agent_id: agentId }) + "\n");
  return 0;
}

function cmdCheckDedup(files: string[]): number {
  const state = loadState();
  const running = runningAgents(state);
  const conflicts = fileConflicts(files, running);

  if (conflicts.length > 0) {
    process.stdout.write(JSON.stringify({ verdict: "BLOCK", conflicting_agents: conflicts }) + "\n");
    return 1;
  }
  process.stdout.write(JSON.stringify({ verdict: "PASS", conflicting_agents: [] }) + "\n");
  return 0;
}

function cmdPoll(timeoutMin: number): number {
  const state = loadState();
  const now = Date.now();
  const stuck: Array<{ agent_id: string; age_min: number }> = [];
  let completedCount = 0;

  for (const [agentId, info] of Object.entries(state.agents)) {
    if (info.status !== "running") continue;

    // Timeout detection — the only reliable stuck signal.
    // (File-based completion detection removed: Claude Code writes to
    //  /private/tmp/.../tasks/{task_id}.output, not our codi-agent-id path.)
    const registeredMs = new Date(info.registered_at).getTime();
    if (!isNaN(registeredMs)) {
      const ageMin = (now - registeredMs) / 60_000;
      if (ageMin > timeoutMin) {
        state.agents[agentId]!.status = "stuck";
        stuck.push({ agent_id: agentId, age_min: Math.round(ageMin * 10) / 10 });
        continue;
      }
    }

    state.agents[agentId]!.last_polled = nowIso();
  }

  saveState(state);

  const result = {
    verdict: stuck.length > 0 ? "WARN" : "PASS",
    running: Object.keys(runningAgents(state)).length,
    stuck,
    completed_since_last_poll: completedCount,
  };
  process.stdout.write(JSON.stringify(result) + "\n");
  return stuck.length > 0 ? 2 : 0;
}

function cmdStatus(): number {
  const state = loadState();
  process.stdout.write(JSON.stringify(state, null, 2) + "\n");
  return 0;
}

function cmdComplete(agentId: string): number {
  const state = loadState();
  if (!(agentId in state.agents)) {
    process.stdout.write(
      JSON.stringify({ verdict: "WARN", reason: `agent ${agentId} not found` }) + "\n",
    );
    return 2;
  }
  state.agents[agentId]!.status = "completed";
  saveState(state);
  process.stdout.write(
    JSON.stringify({ verdict: "PASS", agent_id: agentId, status: "completed" }) + "\n",
  );
  return 0;
}

// ── CLI parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): number {
  // argv[0]=bun argv[1]=script.ts argv[2]=command ...
  const [, , command, ...rest] = argv;

  if (!command) {
    process.stderr.write(
      "Usage: agent-lifecycle.ts <register|check-dedup|poll|status|complete> [options]\n",
    );
    return 1;
  }

  function getFlag(flag: string): string | null {
    const idx = rest.indexOf(flag);
    return idx !== -1 && idx + 1 < rest.length ? rest[idx + 1]! : null;
  }

  function getMultiFlag(flag: string): string[] {
    const idx = rest.indexOf(flag);
    if (idx === -1) return [];
    const values: string[] = [];
    for (let i = idx + 1; i < rest.length; i++) {
      if (rest[i]!.startsWith("--")) break;
      values.push(rest[i]!);
    }
    return values;
  }

  switch (command) {
    case "register": {
      const agentId = getFlag("--agent-id");
      const files = getMultiFlag("--files");
      const description = getFlag("--description") ?? "";
      if (!agentId || files.length === 0) {
        process.stderr.write("register requires --agent-id and --files\n");
        return 1;
      }
      return cmdRegister(agentId, files, description);
    }

    case "check-dedup": {
      const files = getMultiFlag("--files");
      if (files.length === 0) {
        process.stderr.write("check-dedup requires --files\n");
        return 1;
      }
      return cmdCheckDedup(files);
    }

    case "poll": {
      const timeoutStr = getFlag("--timeout-min");
      const timeoutMin = timeoutStr ? parseFloat(timeoutStr) : 10.0;
      return cmdPoll(isNaN(timeoutMin) ? 10.0 : timeoutMin);
    }

    case "status":
      return cmdStatus();

    case "complete": {
      const agentId = getFlag("--agent-id");
      if (!agentId) {
        process.stderr.write("complete requires --agent-id\n");
        return 1;
      }
      return cmdComplete(agentId);
    }

    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      return 1;
  }
}

process.exit(parseArgs(process.argv));
