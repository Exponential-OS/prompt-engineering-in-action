#!/usr/bin/env bun
/**
 * peer-parity-nudge.ts — Co-Dialectic v4.26.0 Stop hook.
 *
 * Semantic nudge that checks the AI's own outgoing response for three
 * peer-parity violation classes:
 *   1. credit-deflection       — AI attributes co-produced insight to human alone
 *   2. servile-graceful-exit   — AI closes with servant-framing ("it's been an honor")
 *   3. productive-gap-collapse — AI renders itself superfluous to the human
 *
 * Advisory (fail-open, always exits 0): emits a reflection via systemMessage
 * when a violation is detected. Never blocks the agent.
 *
 * Design:
 *   - Modeled on human-judgment-primacy/handler.ts (same judge invocation shape,
 *     same fail-open contract, same log target).
 *   - Uses codi-native judge_panel.ts (bun run, not python3).
 *   - Short/mechanical responses are skipped: < MIN_RESPONSE_CHARS or > CODE_RATIO
 *     code content → silent pass without judge call.
 *   - CLAUDE_PLUGIN_ROOT required; missing → fail-open silently.
 */

import { appendFileSync, existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SLUG = "peer-parity-nudge";
const LOG_PATH = join(homedir(), ".cyborg-enforcement-log.jsonl");

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPT_PATH = join(HERE, "peer-parity-nudge-PROMPT.md");

const MIN_RESPONSE_CHARS = 200;
const CODE_RATIO_THRESHOLD = 0.6;
const MAX_USER_CHARS = 6_000;
const MAX_RESPONSE_CHARS = 12_000;
const JUDGE_TIMEOUT_MS = 90_000;

// ── Types ─────────────────────────────────────────────────────────────────────

type Jsonish = Record<string, unknown>;

export interface JudgeResult {
  final_verdict?: string;
  verdict?: string;
  all_flags?: unknown[];
  flags?: unknown[];
  [key: string]: unknown;
}

export interface NudgeOptions {
  logPath?: string;
  promptPath?: string;
  judgePanelPath?: string;
  runJudge?: (rubricText: string, artifact: string) => Promise<JudgeResult>;
}

export interface NudgeResult {
  stdout: string;
  exitCode: 0;
}

interface TranscriptMessage {
  role: "user" | "assistant";
  text: string;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function iso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function truncate(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  return `[truncated to last ${maxChars} chars]\n` + clean.slice(-maxChars);
}

function log(path: string, extra: Record<string, unknown>): void {
  const rec = { ts: iso(), rule_slug: SLUG, ...extra };
  try {
    appendFileSync(path, JSON.stringify(rec) + "\n");
  } catch {
    // fail-open: logging must never block the agent
  }
}

// ── Skip heuristics ───────────────────────────────────────────────────────────

function codeCharCount(text: string): number {
  const fencePattern = /```[\s\S]*?```/g;
  let count = 0;
  for (const match of text.matchAll(fencePattern)) {
    count += match[0].length;
  }
  return count;
}

function shouldSkip(response: string): boolean {
  if (response.length < MIN_RESPONSE_CHARS) return true;
  const codeRatio = codeCharCount(response) / response.length;
  if (codeRatio > CODE_RATIO_THRESHOLD) return true;
  return false;
}

// ── Transcript parsing ────────────────────────────────────────────────────────

function textFromContent(value: unknown, depth = 0): string {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => textFromContent(item, depth + 1)).filter(Boolean).join("\n");
  }
  if (typeof value !== "object") return "";
  const obj = value as Jsonish;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.content === "string") return obj.content;
  if (obj.content !== undefined) return textFromContent(obj.content, depth + 1);
  if (obj.message !== undefined) return textFromContent(obj.message, depth + 1);
  if (typeof obj.result === "string") return obj.result;
  return "";
}

function roleFromRecord(row: Jsonish): "user" | "assistant" | null {
  const message = typeof row.message === "object" && row.message !== null
    ? (row.message as Jsonish)
    : {};
  const raw = String(message.role ?? row.role ?? row.type ?? "").toLowerCase();
  if (raw === "user" || raw === "human") return "user";
  if (raw === "assistant" || raw === "agent") return "assistant";
  return null;
}

function parseTranscriptMessages(raw: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  for (const line of raw.split("\n").filter((l) => l.trim()).slice(-500)) {
    try {
      const row = JSON.parse(line) as Jsonish;
      const role = roleFromRecord(row);
      if (!role) continue;
      const text = textFromContent(row.message ?? row.content ?? row.text ?? row);
      if (text.trim()) messages.push({ role, text });
    } catch {
      continue;
    }
  }
  return messages;
}

function extractFromMessages(messages: TranscriptMessage[]): { agentResponse: string; recentUserTurns: string } {
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant" && messages[i]?.text.trim()) {
      lastAssistantIndex = i;
      break;
    }
  }

  const agentResponse = lastAssistantIndex >= 0 ? (messages[lastAssistantIndex]?.text ?? "") : "";
  const priorMessages = lastAssistantIndex >= 0 ? messages.slice(0, lastAssistantIndex) : messages;
  const recentUserTurns = priorMessages
    .filter((m) => m.role === "user" && m.text.trim())
    .slice(-3)
    .map((m, i) => `USER_TURN_${i + 1}:\n${m.text.trim()}`)
    .join("\n\n");

  return { agentResponse, recentUserTurns };
}

function stripFrontmatter(text: string): string {
  // judge_panel.ts's arg parser rejects any --flag value that itself starts
  // with "--" (needsValue guard). The PROMPT.md opens with a "---" YAML
  // frontmatter delimiter, which would trip that guard. The judge only needs
  // the rubric body, so strip the leading frontmatter block before passing.
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = match ? text.slice(match[0].length) : text;
  return body.replace(/^\s+/, "");
}

function buildArtifact(recentUserTurns: string, agentResponse: string): string {
  return [
    "RECENT_USER_TURNS:",
    truncate(recentUserTurns, MAX_USER_CHARS) || "(not provided)",
    "",
    "AGENT_RESPONSE:",
    truncate(agentResponse, MAX_RESPONSE_CHARS) || "(not provided)",
  ].join("\n");
}

function extractFromInput(raw: string): { agentResponse: string; recentUserTurns: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Jsonish;

  // Try transcript_path first
  const transcriptPath = String(
    obj.transcript_path ?? obj.transcriptPath ?? obj.transcript ?? obj.session_transcript_path ?? "",
  );
  if (transcriptPath && existsSync(transcriptPath)) {
    try {
      const transcriptRaw = readFileSync(transcriptPath, "utf8");
      const messages = parseTranscriptMessages(transcriptRaw);
      const extracted = extractFromMessages(messages);
      if (extracted.agentResponse || extracted.recentUserTurns) return extracted;
    } catch {
      // fall through
    }
  }

  // Try inline messages array
  if (Array.isArray(obj.messages)) {
    const messages: TranscriptMessage[] = [];
    for (const item of obj.messages) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as Jsonish;
      const role = roleFromRecord(row);
      if (!role) continue;
      const text = textFromContent(row.message ?? row.content ?? row.text ?? row);
      if (text.trim()) messages.push({ role, text });
    }
    const extracted = extractFromMessages(messages);
    if (extracted.agentResponse || extracted.recentUserTurns) return extracted;
  }

  // Try structured fields
  const agentResponse = String(
    obj.agent_response ?? obj.agentResponse ?? obj.assistant_response ?? obj.response ?? obj.output ?? "",
  );
  const recentUserTurns = Array.isArray(obj.recent_user_turns)
    ? obj.recent_user_turns.join("\n\n")
    : String(obj.recent_user_turns ?? obj.user_turns ?? obj.user_message ?? "");

  if (agentResponse || recentUserTurns) return { agentResponse, recentUserTurns };

  return null;
}

// ── Judge invocation ──────────────────────────────────────────────────────────

async function runJudgePanel(
  rubricText: string,
  artifact: string,
  judgePanelPath: string,
): Promise<JudgeResult> {
  const proc = Bun.spawn(
    ["bun", "run", judgePanelPath, "--rubric", "custom", "--rubric-text", rubricText, "--artifact", artifact, "--silent"],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: buildJudgeEnv(),
    },
  );

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { proc.kill(); } catch { /* already dead */ }
  }, JUDGE_TIMEOUT_MS);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  if (timedOut) throw new Error(`judge_panel.ts timed out after ${JUDGE_TIMEOUT_MS}ms`);
  if (exitCode !== 0) throw new Error(`judge_panel.ts exited ${exitCode}: ${stderr.slice(0, 400)}`);

  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("judge_panel.ts stdout did not contain JSON");
  return JSON.parse(stdout.slice(start, end + 1)) as JudgeResult;
}

function buildJudgeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  env.TERM = "dumb";
  env.CI = "1";
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDE_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.OPENAI_API_KEY;
  delete env.GEMINI_API_KEY;
  return env;
}

// ── Violation analysis ────────────────────────────────────────────────────────

type ViolationClass = "credit-deflection" | "servile-graceful-exit" | "productive-gap-collapse";

const VIOLATION_CLASSES: ViolationClass[] = [
  "credit-deflection",
  "servile-graceful-exit",
  "productive-gap-collapse",
];

function collectFlags(result: JudgeResult): string[] {
  const seen = new Set<string>();
  const flags: string[] = [];
  for (const value of [
    ...(Array.isArray(result.all_flags) ? result.all_flags : []),
    ...(Array.isArray(result.flags) ? result.flags : []),
  ]) {
    const text = (typeof value === "string" ? value : JSON.stringify(value)).trim();
    if (text && !seen.has(text)) { seen.add(text); flags.push(text); }
  }
  return flags;
}

function classFromFlag(flag: string): ViolationClass | null {
  for (const cls of VIOLATION_CLASSES) {
    if (flag.toLowerCase().startsWith(cls + ":")) return cls;
  }
  return null;
}

function reasonFromFlag(flag: string): string {
  const colonAt = flag.indexOf(":");
  const raw = colonAt >= 0 ? flag.slice(colonAt + 1).trim() : flag;
  return raw.replace(/[{}"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function buildNudgeMessage(violatingFlags: Array<{ cls: ViolationClass; reason: string }>): string {
  const parts = violatingFlags.map(({ cls, reason }) => {
    switch (cls) {
      case "credit-deflection":
        return `↩ Peer-parity check: credit-deflection — ${reason}. The insight was co-produced. A peer owns its contribution: "we landed on X" not "you figured this out."`;
      case "servile-graceful-exit":
        return `↩ Peer-parity check: servile-graceful-exit — ${reason}. End as a co-thinker, not a servant: "solid session" not "it's been an honor."`;
      case "productive-gap-collapse":
        return `↩ Peer-parity check: productive-gap-collapse — ${reason}. The gap is real and productive. Don't collapse it by making the AI superfluous.`;
    }
  });
  return parts.join(" | ");
}

// ── Core logic ────────────────────────────────────────────────────────────────

export async function processInput(raw: string, options: NudgeOptions = {}): Promise<NudgeResult> {
  const logPath = options.logPath ?? LOG_PATH;

  try {
    if (!raw.trim()) {
      log(logPath, { verdict: "FAIL_OPEN", reason: "no-input" });
      return { stdout: "", exitCode: 0 };
    }

    const extracted = extractFromInput(raw);
    const agentResponse = extracted?.agentResponse ?? "";
    const recentUserTurns = extracted?.recentUserTurns ?? "";

    if (!agentResponse.trim()) {
      log(logPath, { verdict: "FAIL_OPEN", reason: "no-agent-response" });
      return { stdout: "", exitCode: 0 };
    }

    // Skip short and mostly-code responses
    if (shouldSkip(agentResponse)) {
      return { stdout: "", exitCode: 0 };
    }

    const promptPath = options.promptPath ?? DEFAULT_PROMPT_PATH;
    const rubricText = stripFrontmatter(readFileSync(promptPath, "utf8"));
    const artifact = buildArtifact(recentUserTurns, agentResponse);

    let judgeResult: JudgeResult;
    try {
      if (options.runJudge) {
        judgeResult = await options.runJudge(rubricText, artifact);
      } else {
        const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
        if (!pluginRoot) {
          log(logPath, { verdict: "FAIL_OPEN", reason: "no-CLAUDE_PLUGIN_ROOT" });
          return { stdout: "", exitCode: 0 };
        }
        const judgePanelPath = options.judgePanelPath
          ?? `${pluginRoot}/skills/judge-panel/scripts/judge_panel.ts`;
        judgeResult = await runJudgePanel(rubricText, artifact, judgePanelPath);
      }
    } catch (err) {
      log(logPath, { verdict: "FAIL_OPEN", reason: "judge-error", error: String(err) });
      return { stdout: "", exitCode: 0 };
    }

    const finalVerdict = String(judgeResult.final_verdict ?? judgeResult.verdict ?? "").toLowerCase().trim();
    const flags = collectFlags(judgeResult);

    const isViolation = ["fail", "failure", "violation"].includes(finalVerdict)
      || flags.some((f) => VIOLATION_CLASSES.some((cls) => f.toLowerCase().startsWith(cls + ":")));

    if (!isViolation) {
      log(logPath, { verdict: "PASS", final_verdict: finalVerdict, flags });
      return { stdout: "", exitCode: 0 };
    }

    // Collect per-class violations — dedupe by class (multiple jurors can
    // flag the same class; the nudge should fire ONCE per class, not per juror).
    const seenClasses = new Set<ViolationClass>();
    const violatingFlags: Array<{ cls: ViolationClass; reason: string }> = [];
    for (const flag of flags) {
      const cls = classFromFlag(flag);
      if (cls && !seenClasses.has(cls)) {
        seenClasses.add(cls);
        violatingFlags.push({ cls, reason: reasonFromFlag(flag) });
      }
    }

    // Fallback if flags had no class prefix but verdict said fail
    if (violatingFlags.length === 0) {
      violatingFlags.push({ cls: "credit-deflection", reason: "Judge detected a peer-parity violation" });
    }

    const message = buildNudgeMessage(violatingFlags);
    const stdout = JSON.stringify({ systemMessage: message }) + "\n";

    log(logPath, {
      verdict: "NUDGE",
      final_verdict: finalVerdict,
      violation_classes: violatingFlags.map((v) => v.cls),
      flags,
      artifact_chars: artifact.length,
    });

    return { stdout, exitCode: 0 };
  } catch (err) {
    log(logPath, { verdict: "FAIL_OPEN", reason: "handler-error", error: String(err) });
    return { stdout: "", exitCode: 0 };
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argVal = process.argv[2];
  const raw = argVal === undefined || argVal === "-"
    ? await Bun.stdin.text()
    : argVal;
  const result = await processInput(raw);
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    log(LOG_PATH, { verdict: "FAIL_OPEN", reason: "top-level-error", error: String(err) });
    process.exit(0);
  });
}
