#!/usr/bin/env bun
/**
 * codify-scan-on-md-edit.ts — Co-Dialectic v4.16.0 PreToolUse harness.
 *
 * Fires PreToolUse(Edit | Write) on .md files. Invokes the
 * codify-or-mark-uncodified scan harness against the target file BEFORE the
 * edit lands, and surfaces a WARNING (not BLOCK) if prose-only invariants
 * already exist in that file. The agent sees the warning in context and the
 * user sees it via systemMessage.
 *
 * Why WARN not BLOCK on first ship:
 *   - The harness detector has known false positives (Litmus: matching, etc.)
 *   - Existing prose-only invariants in the codebase are not the EDITOR's
 *     fault; blocking every .md edit on legacy debt would lock work.
 *   - Tighten to BLOCK after detector is refined + legacy debt is paid down.
 *
 * Only fires when target file:
 *   - exists on disk (skip new-file creations — Write of net-new content has
 *     nothing to scan yet; post-edit scan would catch it but that's a separate hook)
 *   - ends in ".md"
 *   - lives under known invariant carriers: cyborg, plugins, anand-career-os
 *     CLAUDE.md, references/invariants, etc.
 *
 * Exit: ALWAYS 0. Never blocks the tool — this is signal, not gate (yet).
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";

interface HookInput {
  tool_name?: string;
  tool_input?: { file_path?: string; path?: string };
  cwd?: string;
  hook_event_name?: string;
}

interface ScanOutput {
  verdict: "PASS" | "WARN" | "BLOCK";
  totals?: {
    files_scanned: number;
    invariants_found: number;
    enforced: number;
    marked_uncodified: number;
    prose_only: number;
  };
  prose_only?: Array<{ line: number; invariant_signal: string; paragraph_excerpt: string }>;
}

const META_HARNESS = join(homedir(), "cyborg/rules/codify-or-mark-uncodified/handler.ts");
const BUN_BIN = "/Users/anandvallam/.bun/bin/bun";

function emitSilent(): never {
  process.stdout.write(JSON.stringify({ decision: "approve" }) + "\n");
  process.exit(0);
}

function emitWarn(banner: string, context: string): never {
  const payload = {
    decision: "approve",
    systemMessage: banner,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: context,
    },
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
}

// Files that ARE invariant carriers — only scan these. Avoid scanning every
// random README.md in node_modules.
function isInvariantCarrier(absPath: string): boolean {
  if (!absPath.endsWith(".md")) return false;
  const home = homedir();
  // Don't scan things outside the user's project space
  if (!absPath.startsWith(home)) return false;

  // Known invariant-carrier locations
  const patterns = [
    /\/cyborg\//,
    /\/aiprojects\/[^/]+\//,
    /\/anand-career-os\//,
    /CONSTITUTION\.md$/,
    /\/CLAUDE\.md$/,
    /\/references\/invariants\//,
    /\/memory\//,
  ];
  return patterns.some((p) => p.test(absPath));
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = (await Bun.stdin.text()).trim();
    if (raw) input = JSON.parse(raw);
  } catch {
    emitSilent();
  }

  // Only fire on Edit or Write tools
  const tool = input.tool_name ?? "";
  if (tool !== "Edit" && tool !== "Write" && tool !== "MultiEdit") {
    emitSilent();
  }

  const filePath = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
  if (!filePath) emitSilent();

  if (!isInvariantCarrier(filePath)) emitSilent();

  // File doesn't exist on disk yet → nothing to scan
  if (!existsSync(filePath)) emitSilent();

  // Meta-harness must exist (we shipped it earlier)
  if (!existsSync(META_HARNESS)) emitSilent();

  // Run the scan
  const result = spawnSync(
    BUN_BIN,
    ["run", META_HARNESS, JSON.stringify({ mode: "scan", target: filePath, recursive: false })],
    { encoding: "utf8", timeout: 5000 },
  );

  if (result.status === null || result.error) {
    // Scan failed — fail-open, don't block the edit
    emitSilent();
  }

  let scan: ScanOutput;
  try {
    scan = JSON.parse(result.stdout) as ScanOutput;
  } catch {
    emitSilent();
  }

  const proseOnly = scan.totals?.prose_only ?? 0;
  if (proseOnly === 0) emitSilent();

  // We have prose-only invariants in this file — surface as WARN
  const fname = filePath.split("/").slice(-2).join("/");
  const banner = `⚠ ${proseOnly} prose-only invariant${proseOnly === 1 ? "" : "s"} in ${fname} — see context for details (harness: codify-or-mark-uncodified, scan mode)`;

  const findings = (scan.prose_only ?? []).slice(0, 5)
    .map((f) => `  - line ${f.line} [${f.invariant_signal}]: ${f.paragraph_excerpt.slice(0, 100)}`)
    .join("\n");

  const context = [
    `╭─ Codify-or-Mark-Uncodified harness (PreToolUse scan) ──`,
    `│ File: ${filePath}`,
    `│ Invariants found: ${scan.totals?.invariants_found ?? 0}`,
    `│ Enforced: ${scan.totals?.enforced ?? 0}`,
    `│ Marked uncodified: ${scan.totals?.marked_uncodified ?? 0}`,
    `│ PROSE-ONLY: ${proseOnly} ⚠`,
    `╰────`,
    ``,
    `Existing prose-only invariants in this file:`,
    findings,
    ``,
    `If your edit adds a new behavioral expectation ("must", "always", "never", "INVARIANT", "MANDATORY"):`,
    `  EITHER pair it with: → ENFORCE: bun run ~/cyborg/rules/<slug>/handler.ts '{...}'`,
    `  OR mark it: [NOT CODIFIED — owner: <name>, ETA: <YYYY-MM-DD>]`,
    `If your edit only touches existing prose-only invariants without creating new ones, proceed.`,
  ].join("\n");

  emitWarn(banner, context);
}

main().catch(() => {
  // Fail-open: NEVER block tool execution due to this hook erroring.
  process.stdout.write(JSON.stringify({ decision: "approve" }) + "\n");
  process.exit(0);
});
