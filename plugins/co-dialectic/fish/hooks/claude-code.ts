#!/usr/bin/env bun
/**
 * hooks/claude-code.ts — Claude Code PreToolUse adapter for Codi Agents pre-check.
 *
 * Replaces hooks/claude-code.py (dead-end: Python completion command referenced
 * wrong script path; no type safety on hook JSON parsing).
 *
 * Claude Code passes hook context as JSON on stdin:
 *   { hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { prompt, ... } }
 *
 * This adapter:
 *   1. Infers stakes tier (T1/T2/T3) — semantic Haiku call or keyword fallback.
 *   2. Recommends MiroFish model tier (haiku/sonnet/opus).
 *   3. Auto-sets run_in_background based on tier + subagent type.
 *   4. Calls handler.ts for approach pre-flight (PASS/WARN/BLOCK).
 *   5. Merges results into updatedInput so Claude Code auto-sets model + threading.
 *   6. Registers background agents with the lifecycle manager (dedup check first).
 *
 * Exit: 0=allow  1=block
 */

import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { spawnSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────────────────

interface HookContext {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: {
    prompt?: string;
    subagent_type?: string;
    model?: string;
    run_in_background?: boolean;
    isolation?: string;
    [key: string]: unknown;
  };
}

interface HandlerOutput {
  verdict?: string;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName?: string;
    updatedInput?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type ModelTier = "haiku" | "sonnet" | "opus";

// ── Paths ────────────────────────────────────────────────────────────────────

const HOOK_DIR = dirname(import.meta.url.replace("file://", ""));
const HANDLER_TS = join(HOOK_DIR, "..", "handler.ts");
const LIFECYCLE_TS = join(HOOK_DIR, "..", "scripts", "agent-lifecycle.ts");
const BUN_BIN = join(homedir(), ".bun", "bin", "bun");

// ── Stakes inference ─────────────────────────────────────────────────────────

const T3_SIGNALS = new Set([
  "publish", "send", "deploy", "delete", "remove", "drop", "push to",
  "email", "post to linkedin", "linkedin post", "publish linkedin",
  "substack", "tweet", "post to", "notify", "production", "irreversible", "overwrite",
]);

const T3_MIGRATE_SIGNALS = new Set([
  "db migrate", "database migrate", "schema migrate", "data migrate",
  "migrate database", "migrate schema", "migrate data", "migrate table",
  "alembic", "flyway", "liquibase", "migration script to prod",
]);

const T1_SIGNALS = new Set([
  "read", "research", "search", "analyze", "summarize", "explain",
  "list", "show", "find", "grep", "check", "look", "review",
]);

const SEMANTIC_SYSTEM =
  "You classify AI agent task prompts by stakes tier. " +
  "Reply with exactly one of: T1, T2, or T3. No other output.\n" +
  "T1 = read-only, exploratory, fully reversible: grep, read, research, summarize, explain.\n" +
  "T2 = writes to regular code/config files, non-canonical edits, internal notes.\n" +
  "T3 = ANY of: (a) write/edit/add to strategy or architecture documents " +
  "(content-flywheel.md, BRIEF.md, CONSTITUTION.md, SKILL.md, ADR files, " +
  "brain/identity/ files, campaign masters, schema files); " +
  "(b) architectural or schema decisions; " +
  "(c) outreach to real humans (email, DM, post); " +
  "(d) publishing or deploying; " +
  "(e) irreversible or hard-to-undo actions; " +
  "(f) canonical documents that multiple agents read and act on. " +
  "When uncertain between T2 and T3, choose T3.";

async function inferStakesSemantic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey, timeout: 8_000 });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 5,
      system: SEMANTIC_SYSTEM,
      messages: [{ role: "user", content: prompt.slice(0, 400) }],
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .toUpperCase()
      .slice(0, 10);
    for (const tier of ["T3", "T2", "T1"] as const) {
      if (text.includes(tier)) return tier;
    }
    return null;
  } catch {
    return null;
  }
}

function inferStakesKeyword(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (prompt.split(/\s+/).length > 300) return "T3";
  for (const sig of T3_SIGNALS) {
    if (lower.includes(sig)) return "T3";
  }
  for (const sig of T3_MIGRATE_SIGNALS) {
    if (lower.includes(sig)) return "T3";
  }
  for (const sig of ["force", "push"]) {
    if (new RegExp(`\\b${sig}\\b`).test(lower)) return "T3";
  }
  for (const sig of T1_SIGNALS) {
    if (lower.includes(sig)) return "T1";
  }
  return "T2";
}

async function inferStakes(prompt: string): Promise<string> {
  const semantic = await inferStakesSemantic(prompt);
  return semantic ?? inferStakesKeyword(prompt);
}

// ── Model tier recommendation ─────────────────────────────────────────────────

const HAIKU_KW = [
  "read ", "grep", "find ", "surgical", "preserve", "mechanical",
  "pattern match", "move ", "rename", " cp ", " mv ", "chmod", " rm ",
  "backfill", "patch", "edit ", "inventory", "list ", " ls ", "scan",
  "sed ", " wc ", "head ", "tail ", "concat", "append", "truncate", "cleanup",
];
const SONNET_KW = [
  "synthesize", "analyze", "extract", "identify pattern", "summarize",
  "audit", "review", "critique", "evaluate", "classify", "consolidat",
  "reorganize", "refactor", "spec", "plan", "design", "draft",
];
const OPUS_KW = [
  "architect", "architecture", "constitution", "multi-domain", "tradeoff",
  "governance", "invariant", "principle", "framework", "cross-cutting",
  "long-form", "jurisprudence", "policy",
];

function recommendTier(prompt: string, stakes: string): ModelTier {
  if (stakes === "T3" || stakes === "T4") return "sonnet";
  const lower = prompt.toLowerCase();
  if (OPUS_KW.some((kw) => lower.includes(kw))) return "opus";
  if (SONNET_KW.some((kw) => lower.includes(kw))) return "sonnet";
  if (HAIKU_KW.some((kw) => lower.includes(kw))) return "haiku";
  return "sonnet";
}

// ── Executor types ────────────────────────────────────────────────────────────

const DEFAULT_EXECUTOR_TYPES = new Set(["elite-code-writer", "codex:codex-rescue"]);
const envExecutors = process.env.CODI_EXECUTOR_TYPES;
const EXECUTOR_TYPES =
  envExecutors === undefined
    ? DEFAULT_EXECUTOR_TYPES
    : envExecutors === ""
      ? new Set<string>()
      : new Set(envExecutors.split(",").map((t) => t.trim()).filter(Boolean));

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

function runLifecycle(args: string[]): Record<string, unknown> {
  if (!existsSync(LIFECYCLE_TS)) return {};
  try {
    const result = spawnSync(BUN_BIN, ["run", LIFECYCLE_TS, ...args], {
      encoding: "utf8",
      timeout: 5_000,
    });
    return JSON.parse(result.stdout?.trim() || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const raw = (await Bun.stdin.text()).trim();
  if (!raw) { process.exit(0); }

  let hookCtx: HookContext;
  try {
    hookCtx = JSON.parse(raw) as HookContext;
  } catch {
    process.exit(0); // malformed — fail open
  }

  if (hookCtx.tool_name !== "Agent") { process.exit(0); }

  const toolInput = hookCtx.tool_input ?? {};
  const prompt = (toolInput.prompt ?? "").trim();
  const subagentType = toolInput.subagent_type ?? "";
  const existingModel = toolInput.model ?? "";
  const existingBg = toolInput.run_in_background; // undefined = caller didn't set
  const isolation = toolInput.isolation ?? "";

  if (!prompt) { process.exit(0); }

  const stakes = await inferStakes(prompt);
  const recommendedTier = recommendTier(prompt, stakes);

  const applyModel = !existingModel;
  const applyBg = existingBg === undefined;

  // Worktree isolation → force foreground (prevents silent hangs).
  let autoBg: boolean;
  let worktreeForcedFg = false;
  if (isolation === "worktree" && applyBg) {
    autoBg = false;
    worktreeForcedFg = true;
  } else {
    const isCodeExecutor = Boolean(subagentType) && EXECUTOR_TYPES.has(subagentType);
    autoBg = isCodeExecutor || (stakes !== "T3" && stakes !== "T4" && recommendedTier !== "opus");
  }

  // ── Lifecycle registration + dedup ─────────────────────────────────────────
  const effectiveBg = applyBg ? autoBg : Boolean(existingBg);
  let lifecycleBlockMsg = "";
  let fishId = "";

  if (effectiveBg && existsSync(LIFECYCLE_TS)) {
    const filePattern =
      /(?:\/[\w.\-]+)+\.(?:py|md|json|yaml|sh|ts|js|txt|csv)|~(?:\/[\w.\-]+)+|[\w.\-]+\.(?:py|md|json|yaml|sh|ts|js|txt)/g;
    const extractedFiles = [...new Set(prompt.match(filePattern) ?? [])].slice(0, 10);

    if (extractedFiles.length > 0) {
      const dedupOut = runLifecycle(["check-dedup", "--files", ...extractedFiles]);
      if (dedupOut.verdict === "BLOCK") {
        const conflictIds = ((dedupOut.conflicting_agents as Array<{ agent_id: string }> | undefined) ?? [])
          .map((c) => c.agent_id)
          .join(", ");
        lifecycleBlockMsg =
          `[Codi Agents] BLOCK — file conflict with running agent(s): ${conflictIds}. ` +
          `Files: ${JSON.stringify(extractedFiles)}. ` +
          `Wait for those agents to complete or call: ` +
          `${BUN_BIN} run ${LIFECYCLE_TS} complete --agent-id <id>`;
      }
    }

    if (!lifecycleBlockMsg) {
      fishId = `codi-agent-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
      const regFiles = extractedFiles.length > 0 ? extractedFiles : [`agent-${fishId}`];
      runLifecycle([
        "register",
        "--agent-id", fishId,
        "--files", ...regFiles,
        "--description", prompt.slice(0, 200),
      ]);
    }
  }

  // ── Handler pre-flight ─────────────────────────────────────────────────────
  const fishInput = JSON.stringify({
    task: prompt.slice(0, 600),
    stakes,
    context: subagentType ? `subagent_type=${subagentType}` : "",
  });

  let payload: HandlerOutput = {};
  let exitCode = 0;

  if (existsSync(HANDLER_TS)) {
    const result = spawnSync(BUN_BIN, ["run", HANDLER_TS, "-"], {
      input: fishInput,
      encoding: "utf8",
      timeout: 25_000,
    });
    exitCode = result.status ?? 0;
    try {
      payload = JSON.parse(result.stdout?.trim() || "{}") as HandlerOutput;
    } catch {
      payload = {};
    }
  }

  // ── Advisor routing annotation ────────────────────────────────────────────
  let tierNote =
    `[Codi Agents] recommended model: ${recommendedTier} ` +
    `(stakes=${stakes}, apply_model=${applyModel}, bg=${applyBg ? autoBg : existingBg}). ` +
    `Whale decompose → Codi Agent execute at ${recommendedTier} tier.`;

  if (worktreeForcedFg) {
    tierNote += " [worktree→foreground: isolation=worktree forces run_in_background=false]";
  }
  if (lifecycleBlockMsg) {
    tierNote = lifecycleBlockMsg + "\n" + tierNote;
    exitCode = 1;
  }

  const existingMsg = payload.systemMessage ?? "";
  payload.systemMessage = existingMsg ? `${existingMsg}\n${tierNote}` : tierNote;

  // ── Inject updatedInput ────────────────────────────────────────────────────
  // CRITICAL: updatedInput REPLACES the original tool_input — must preserve
  // all fields (description, subagent_type, etc.) or Agent tool crashes with
  // `undefined is not an object` (observed 2026-05-17).
  if (applyModel || applyBg) {
    const hookSpecific = (payload.hookSpecificOutput ?? {}) as NonNullable<HandlerOutput["hookSpecificOutput"]>;
    hookSpecific.hookEventName = "PreToolUse";
    const updatedInput: Record<string, unknown> = {
      ...toolInput,
      ...((hookSpecific.updatedInput ?? {}) as Record<string, unknown>),
    };

    if (applyModel) updatedInput.model = recommendedTier;
    if (applyBg) updatedInput.run_in_background = autoBg;

    // Inject completion contract so agent signals lifecycle when done.
    // Key fix: uses bun + agent-lifecycle.ts (not python3 + .py)
    if (fishId && existsSync(LIFECYCLE_TS)) {
      const completeCmd = `${BUN_BIN} run ${LIFECYCLE_TS} complete --agent-id ${fishId}`;
      updatedInput.prompt =
        prompt +
        `\n\n[codi-agent:${fishId}] On task completion, signal the lifecycle manager: ${completeCmd}`;
    }

    hookSpecific.updatedInput = updatedInput;
    payload.hookSpecificOutput = hookSpecific;
  }

  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(exitCode);
}

main().catch(() => {
  // Fail open — hook bugs must never block real work.
  process.stdout.write("{}\n");
  process.exit(0);
});
