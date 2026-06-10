#!/usr/bin/env bun
/**
 * task-completed-judge-gate.ts — Cross-family quality gate for agent teams.
 *
 * TaskCompleted hook (Claude Code agent teams, v2.1.32+ experimental).
 * When a teammate marks a task complete, this gate runs the judge-panel
 * cascade (Gemini + GPT cross-family jurors via the EXISTING
 * skills/judge-panel/scripts/judge_panel.ts harness) on the task content.
 *
 * Exit semantics (per Claude Code TaskCompleted contract):
 *   exit 0 → completion proceeds
 *   exit 2 → completion BLOCKED; stderr is delivered to the teammate as feedback
 *
 * OPT-IN: does nothing unless CODI_TEAM_JUDGE_GATE=1 (env or ~/.claude
 * settings env block). Agent teams are experimental and the cascade costs
 * ~10-20s per completion — users opt into structural enforcement explicitly.
 *
 * FAIL-HARD: when the gate is ON and the cascade cannot run (CLIs missing,
 * harness error), the task is BLOCKED with remediation — never silently
 * passed. Opting in means cross-family review is load-bearing; an
 * unreviewable task must not complete as if it were reviewed.
 *
 * Design notes:
 *   - Calls judge_panel.ts UNCHANGED (P2/P3 — the harness is the platform).
 *     Spec: anand-career-os WIP/prompt-engineering-in-action-product/
 *     co-dialectic/spec-judge-panel-on-workflow-2026-06-04.md (amended:
 *     Workflow re-platform cancelled; this gate promoted to deliverable).
 *   - Rubric: spec-coherence (task summaries are claims about work done —
 *     the rubric checks claims-vs-implementation drift).
 *   - Skips tasks with < MIN_ARTIFACT_CHARS of content: nothing to judge.
 */

const GATE_ENV = "CODI_TEAM_JUDGE_GATE";
const MIN_ARTIFACT_CHARS = 80;
const RUBRIC = process.env.CODI_TEAM_JUDGE_RUBRIC || "spec-coherence";

function gateEnabled(): boolean {
  const v = (process.env[GATE_ENV] || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(v);
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

/** Extract judgeable text from the TaskCompleted payload, defensively —
 *  the experimental payload shape may evolve. */
function extractArtifact(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  const candidates = [
    "subject",
    "title",
    "description",
    "summary",
    "result",
    "output",
    "content",
  ];
  const task = (payload["task"] ?? payload) as Record<string, unknown>;
  for (const key of candidates) {
    const v = task[key];
    if (typeof v === "string" && v.trim()) parts.push(`${key}: ${v.trim()}`);
  }
  return parts.join("\n");
}

async function main(): Promise<number> {
  if (!gateEnabled()) return 0; // opt-in gate — default no-op

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    // Unparseable payload: cannot judge, cannot safely block — log and pass.
    // (Payload parse failure is a harness-shape issue, not a task-quality
    // signal; blocking here would brick task flow on a schema change.)
    console.error("[judge-gate] WARN: unparseable TaskCompleted payload — gate skipped");
    return 0;
  }

  const artifact = extractArtifact(payload);
  if (artifact.length < MIN_ARTIFACT_CHARS) return 0; // nothing substantive to judge

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  const harness = `${pluginRoot}/skills/judge-panel/scripts/judge_panel.ts`;
  if (!pluginRoot || !(await Bun.file(harness).exists())) {
    console.error(
      `[judge-gate] BLOCKED (FAIL-HARD): ${GATE_ENV}=1 but judge_panel.ts not found at ${harness}.\n` +
        `Fix: reinstall co-dialectic plugin, or unset ${GATE_ENV} to disable the gate.`,
    );
    return 2;
  }

  // Write artifact to a temp file (0600) to avoid argv exposure via `ps`.
  const tmpFile = `/tmp/judge-gate-artifact-${Date.now()}-${process.pid}.txt`;
  await Bun.write(tmpFile, artifact);
  try {
    await Bun.spawn(["chmod", "0600", tmpFile]).exited;
  } catch {
    // chmod failure is non-fatal — file is short-lived; proceed.
  }

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(
      ["bun", "run", harness, "--rubric", RUBRIC, "--artifact-file", tmpFile, "--silent"],
      { stdout: "pipe", stderr: "pipe" },
    );
  } catch (err) {
    await Bun.file(tmpFile).exists().then(() => Bun.spawn(["rm", "-f", tmpFile]).exited).catch(() => {});
    console.error(
      `[judge-gate] BLOCKED (FAIL-HARD): could not spawn judge cascade: ${err}.\n` +
        `Fix: run \`bun run ${harness} --rubric ${RUBRIC} --artifact-file <file>\` manually, ` +
        `or unset ${GATE_ENV} to disable the gate.`,
    );
    return 2;
  }

  const timeoutMs = 90_000;
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  // Clean up temp file regardless of outcome.
  await Bun.spawn(["rm", "-f", tmpFile]).exited.catch(() => {});

  let verdict: Record<string, unknown>;
  try {
    verdict = JSON.parse(stdout);
  } catch {
    const timedOut = exitCode === null || (exitCode !== 0 && stdout.trim() === "");
    console.error(
      `[judge-gate] BLOCKED (FAIL-HARD): cascade ${timedOut ? "timed out after 90s" : "did not return JSON"} (exit ${exitCode}).\n` +
        `stderr: ${stderr.slice(0, 400)}\n` +
        `Fix: run \`bun run ${harness} --rubric ${RUBRIC} --artifact-file <file>\` manually, ` +
        `or unset ${GATE_ENV} to disable the gate.`,
    );
    return 2;
  }

  const final = String(verdict["final_verdict"] ?? "error");
  const confidence = Number(verdict["final_confidence"] ?? 0);
  const flags = (verdict["all_flags"] as string[]) ?? [];

  if (final === "pass") {
    // Silent success — the UI only surfaces hook output on failure.
    return 0;
  }

  if (final === "error" || final === "timeout") {
    console.error(
      `[judge-gate] BLOCKED (FAIL-HARD): cascade verdict=${final}, flags=[${flags.join(", ")}].\n` +
        `Cross-family CLIs unreachable or failing — the task cannot be verified.\n` +
        `Fix: check \`gemini --version\` and \`codex --version\` auth, or unset ${GATE_ENV}.`,
    );
    return 2;
  }

  // fail / uncertain → block with the jurors' reasons as teammate feedback
  console.error(
    `[judge-gate] Task completion BLOCKED by cross-family judge panel.\n` +
      `Verdict: ${final} (confidence ${confidence}). Flags:\n` +
      flags.map((f) => `  - ${f}`).join("\n") +
      `\nAddress the flagged issues, update the task output, and complete again.`,
  );
  return 2;
}

process.exit(await main());
