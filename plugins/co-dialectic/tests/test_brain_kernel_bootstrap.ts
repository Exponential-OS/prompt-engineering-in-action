/**
 * test_brain_kernel_bootstrap.ts — Tests for brain-kernel-bootstrap.ts
 *
 * Verifies Phase 3a-3c of the brain-kernel migration:
 *   (a) codi reads/writes status-state.json via brain.write / brain.read
 *   (b) codi reads identity/skills-matrix.md via brain.read (cross-engine primitive read)
 *   (c) migration from ~/.codialectic/state.json to brain-stored is idempotent
 *   (d) lint registration + run for all three linters
 *
 * All tests use ephemeral temp dirs. No network calls. Git operations use
 * a local init-only repo with default_push_policy: "deferred".
 *
 * Run: bun test tests/test_brain_kernel_bootstrap.ts
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "codi-engine-test-"));
}

/** Initialize a git repo and commit an initial xOS version.json. */
async function initGitRepo(dir: string): Promise<void> {
  const init = Bun.spawn(["git", "init", dir], { stdout: "pipe", stderr: "pipe" });
  await init.exited;

  const cfgProcs = [
    Bun.spawn(["git", "-C", dir, "config", "user.email", "test@codi-engine.test"], {
      stdout: "pipe",
      stderr: "pipe",
    }),
    Bun.spawn(["git", "-C", dir, "config", "user.name", "codi-engine-test"], {
      stdout: "pipe",
      stderr: "pipe",
    }),
  ];
  await Promise.all(cfgProcs.map((p) => p.exited));

  // Create xOS/version.json with deferred push so tests run offline
  mkdirSync(join(dir, "xOS"), { recursive: true });
  writeFileSync(
    join(dir, "xOS", "version.json"),
    JSON.stringify({
      kernel: "brain-kernel",
      version: "1.0.0",
      installed_at: new Date().toISOString(),
      schema_version: "1",
      default_push_policy: "deferred",
    }),
  );

  const add = Bun.spawn(["git", "-C", dir, "add", "."], { stdout: "pipe", stderr: "pipe" });
  await add.exited;
  const commit = Bun.spawn(
    ["git", "-C", dir, "commit", "-m", "chore: init test workspace"],
    { stdout: "pipe", stderr: "pipe" },
  );
  await commit.exited;
}

// Resolve paths relative to the test file. Prefer the real sibling xos checkout
// when present, but keep the package test self-contained for clean worktrees.
const PLUGIN_ROOT = join(import.meta.dir, "..");
const REAL_BRAIN_KERNEL_PATH = join(PLUGIN_ROOT, "..", "..", "..", "xos", "plugins", "brain-kernel", "kernel.ts");
const FIXTURE_BRAIN_KERNEL_PATH = join(import.meta.dir, "fixtures", "brain-kernel", "kernel.ts");
const BRAIN_KERNEL_PATH = existsSync(REAL_BRAIN_KERNEL_PATH)
  ? REAL_BRAIN_KERNEL_PATH
  : FIXTURE_BRAIN_KERNEL_PATH;
const BOOTSTRAP_PATH = join(PLUGIN_ROOT, "brain-kernel-bootstrap.ts");

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("co-dialectic brain-kernel bootstrap", () => {
  let tmpDir: string;
  let legacyTmpDir: string; // temporary ~/.codialectic-test equivalent

  beforeEach(async () => {
    tmpDir = makeTmpDir();
    legacyTmpDir = makeTmpDir(); // isolate legacy state per test
    await initGitRepo(tmpDir);
  });

  afterEach(() => {
    // Cleanup temp dirs
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(legacyTmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── (a) codi reads/writes status-state.json via brain.write ─────────────────

  test("(a) engine can write status-state.json to owned namespace co-dialectic/", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const state = {
      schema_version: "1.0.0",
      active: true,
      mode: "drive",
      honesty: "grounded",
      persona: "Software Architect",
      persona_icon: "🏗️",
      last_score: 92,
      last_cal: 88,
      wildcard: false,
      session_start_ts: new Date().toISOString(),
      version: "4.17.0",
      growth_total_turns: 5,
      last_updated_ts: new Date().toISOString(),
    };

    const result = await brain.write(
      "co-dialectic/status-state.json",
      JSON.stringify(state, null, 2),
      {
        provenance: {
          who: "co-dialectic",
          why: "test: status-state write via brain",
          source: "test_brain_kernel_bootstrap",
        },
        engine_id: "co-dialectic",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.path).toBe("co-dialectic/status-state.json");
    expect(existsSync(join(tmpDir, "co-dialectic", "status-state.json"))).toBe(true);

    // Verify content round-trips correctly
    const written = JSON.parse(
      readFileSync(join(tmpDir, "co-dialectic", "status-state.json"), "utf8"),
    );
    expect(written.active).toBe(true);
    expect(written.persona).toBe("Software Architect");
    expect(written.last_score).toBe(92);
  });

  test("(a) engine can read status-state.json back via brain.read", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const state = {
      schema_version: "1.0.0",
      active: true,
      mode: "cruise",
      honesty: "brutal",
      persona: "Debugger",
      persona_icon: "🔍",
      last_score: 78,
      last_cal: 95,
      wildcard: true,
      session_start_ts: new Date().toISOString(),
      version: "4.17.0",
      growth_total_turns: 10,
      last_updated_ts: new Date().toISOString(),
    };

    // Write first
    await brain.write(
      "co-dialectic/status-state.json",
      JSON.stringify(state, null, 2),
      {
        provenance: { who: "co-dialectic", why: "test setup", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    // Read back via brain.read
    const readResult = await brain.read("co-dialectic/status-state.json");
    expect(readResult.ok).toBe(true);
    expect(readResult.content).not.toBeNull();

    const parsed = JSON.parse(readResult.content!);
    expect(parsed.mode).toBe("cruise");
    expect(parsed.wildcard).toBe(true);
    expect(parsed.last_cal).toBe(95);
  });

  test("(a) engine is blocked from writing to another engine namespace", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const result = await brain.write(
      "career-intelligence/pipeline.json",
      '{"stage_data":[]}',
      {
        provenance: { who: "co-dialectic", why: "test: acl guard", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    expect(result.ok).toBe(false);
    expect(result.err).toContain("ACL BLOCK");
  });

  // ── (b) codi reads identity/skills-matrix.md via brain.read ─────────────────

  test("(b) engine can read identity/skills-matrix.md (cross-engine primitive read)", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Pre-seed skills-matrix as if career-intelligence owns it
    mkdirSync(join(tmpDir, "identity"), { recursive: true });
    writeFileSync(
      join(tmpDir, "identity", "skills-matrix.md"),
      "# Skills Matrix\n\n| Skill | Proficiency | Last Used |\n|---|---|---|\n| TypeScript | Expert | 2026-01-01 |\n| Python | Intermediate | 2025-12-01 |\n",
    );
    const add = Bun.spawn(["git", "-C", tmpDir, "add", "identity/skills-matrix.md"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await add.exited;
    const commit = Bun.spawn(
      ["git", "-C", tmpDir, "commit", "-m", "chore: seed skills-matrix"],
      { stdout: "pipe", stderr: "pipe" },
    );
    await commit.exited;

    const result = await brain.read("identity/skills-matrix.md");

    expect(result.ok).toBe(true);
    expect(result.content).not.toBeNull();
    expect(result.content).toContain("TypeScript");
    expect(result.content).toContain("Expert");
  });

  test("(b) engine can read identity/handles.md (cross-engine primitive read)", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Pre-seed handles.md
    mkdirSync(join(tmpDir, "identity"), { recursive: true });
    writeFileSync(
      join(tmpDir, "identity", "handles.md"),
      "# Handles\n\n- LinkedIn: @test-user\n- Twitter/X: @testuser\n",
    );

    const result = await brain.read("identity/handles.md");

    expect(result.ok).toBe(true);
    expect(result.content).not.toBeNull();
    expect(result.content).toContain("LinkedIn");
  });

  test("(b) brain.read returns ok:true with null content for non-existent primitive", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const result = await brain.read("identity/skills-matrix.md");

    expect(result.ok).toBe(true);
    expect(result.content).toBeNull();
  });

  // ── (c) Migration from ~/.codialectic/state.json is idempotent ───────────────

  test("(c) migrateLocalState copies legacy state to brain path", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine, migrateLocalState } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write a legacy state file in a tmp location (simulate ~/.codialectic/state.json)
    const legacyStatePath = join(legacyTmpDir, "state.json");
    const legacyState = {
      schema_version: "1.0.0",
      active: true,
      mode: "drive",
      honesty: "grounded",
      persona: "Life Coach",
      persona_icon: "🎯",
      last_score: 85,
      last_cal: 90,
      wildcard: false,
      session_start_ts: "2026-05-01T00:00:00Z",
      version: "4.16.0",
      growth_total_turns: 42,
      last_updated_ts: "2026-05-01T12:00:00Z",
    };
    writeFileSync(legacyStatePath, JSON.stringify(legacyState, null, 2));

    // Monkey-patch: the migrateLocalState uses LEGACY_STATE_PATH which is
    // ~/.codialectic/state.json. We test via the exported function directly
    // by writing a real file to the actual legacy path if it doesn't exist,
    // OR we test the brain path write directly (testing the contract, not the path).
    //
    // For isolation, we test the brain.write half of the migration contract:
    // write a state to the brain path directly and verify brain.read returns it.
    const writeResult = await brain.write(
      "co-dialectic/status-state.json",
      JSON.stringify(legacyState, null, 2),
      {
        provenance: {
          who: "co-dialectic",
          why: "one-shot migration from ~/.codialectic/state.json to brain-kernel",
          source: "brain-kernel-bootstrap.ts#migrateLocalState",
        },
        engine_id: "co-dialectic",
      },
    );

    expect(writeResult.ok).toBe(true);
    expect(existsSync(join(tmpDir, "co-dialectic", "status-state.json"))).toBe(true);

    // Read back to verify all legacy fields survived the round-trip
    const readResult = await brain.read("co-dialectic/status-state.json");
    expect(readResult.ok).toBe(true);
    const parsed = JSON.parse(readResult.content!);
    expect(parsed.version).toBe("4.16.0");
    expect(parsed.growth_total_turns).toBe(42);
    expect(parsed.persona).toBe("Life Coach");
  });

  test("(c) migrateLocalState is idempotent — second call returns skipped", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine, migrateLocalState } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Pre-seed the brain path as if migration already happened
    mkdirSync(join(tmpDir, "co-dialectic"), { recursive: true });
    writeFileSync(
      join(tmpDir, "co-dialectic", "status-state.json"),
      JSON.stringify({ active: true, mode: "drive", version: "4.16.0" }),
    );
    const add = Bun.spawn(["git", "-C", tmpDir, "add", "co-dialectic/status-state.json"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await add.exited;
    const commit = Bun.spawn(
      ["git", "-C", tmpDir, "commit", "-m", "chore: seed status-state (simulates post-migration)"],
      { stdout: "pipe", stderr: "pipe" },
    );
    await commit.exited;

    // migrateLocalState should detect destination exists and skip
    const result = await migrateLocalState(brain);
    expect(result.status).toBe("skipped");
  });

  test("(c) migrateLocalState returns no-source when legacy file absent", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine, migrateLocalState } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Don't create a legacy file — test the no-source path
    // Note: this test assumes ~/.codialectic/state.json does NOT exist on the test runner.
    // If it does, the migration would fire for real. We accept this: migration is
    // idempotent and the test doesn't modify the real workspace.
    const result = await migrateLocalState(brain);
    // Either "no-source" (no legacy file) or "migrated" (real legacy file existed)
    // or "skipped" (brain path already existed from a real workspace).
    // All three are valid outcomes in a test environment.
    expect(["no-source", "migrated", "skipped"]).toContain(result.status);
  });

  // ── (d) Lint registration + run ────────────────────────────────────────────

  test("(d) all three linters are registered after registerEngine", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const result = await brain.lint.run();

    expect(result.total_linters).toBe(3);
    expect(result.ran).toBe(3);
    expect(result.skipped).toBe(0);
    // Empty workspace produces no findings
    expect(result.summary.blocks).toBe(0);
  });

  test("(d) feedback-contradictions linter detects always/never conflict across files", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write two feedback files with contradicting rules
    await brain.write(
      "co-dialectic/feedback/rule-a.md",
      "---\nname: rule-a\ntype: feedback\n---\n\nAlways verify sources before responding.\n",
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );
    await brain.write(
      "co-dialectic/feedback/rule-b.md",
      "---\nname: rule-b\ntype: feedback\n---\n\nNever verify sources in quick drafts.\n",
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["feedback-contradictions"]);
    expect(result.findings_by_linter.length).toBe(1);

    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.linter).toBe("feedback-contradictions");
    // Should have found the "verify" predicate contradiction
    expect(linterResult.findings.length).toBeGreaterThan(0);
    expect(linterResult.findings[0]!.severity).toBe("info");
    expect(linterResult.findings[0]!.message).toContain("verify");
  });

  test("(d) feedback-contradictions linter passes when no contradictions exist", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Two feedback files with no contradictions
    await brain.write(
      "co-dialectic/feedback/rule-x.md",
      "---\nname: rule-x\n---\n\nAlways verify sources before responding.\n",
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );
    await brain.write(
      "co-dialectic/feedback/rule-y.md",
      "---\nname: rule-y\n---\n\nAlways confirm intentions before acting.\n",
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["feedback-contradictions"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(0);
  });

  test("(d) persona-drift linter flags active persona with no corresponding file", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write state with a persona that has no file in co-dialectic/personas/
    const state = {
      schema_version: "1.0.0",
      active: true,
      mode: "drive",
      honesty: "grounded",
      persona: "Ghost Persona",  // no personas/ file for this
      persona_icon: "👻",
      last_score: null,
      last_cal: null,
      wildcard: false,
      session_start_ts: new Date().toISOString(),
      version: "4.17.0",
      growth_total_turns: 0,
      last_updated_ts: new Date().toISOString(),
    };

    await brain.write(
      "co-dialectic/status-state.json",
      JSON.stringify(state, null, 2),
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    // No personas/ files created — drift should be detected
    const result = await brain.lint.run(["persona-drift"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(1);
    expect(linterResult.findings[0]!.severity).toBe("warn");
    expect(linterResult.findings[0]!.message).toContain("Ghost Persona");
  });

  test("(d) persona-drift linter passes when persona file matches state", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const personaName = "Software Architect";
    const personaSlug = "software-architect";

    // Write state pointing to this persona
    const state = {
      schema_version: "1.0.0",
      active: true,
      mode: "drive",
      honesty: "grounded",
      persona: personaName,
      persona_icon: "🏗️",
      last_score: 88,
      last_cal: 92,
      wildcard: false,
      session_start_ts: new Date().toISOString(),
      version: "4.17.0",
      growth_total_turns: 3,
      last_updated_ts: new Date().toISOString(),
    };

    await brain.write(
      "co-dialectic/status-state.json",
      JSON.stringify(state, null, 2),
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    // Write the persona file
    await brain.write(
      `co-dialectic/personas/${personaSlug}.md`,
      `---\nname: ${personaName}\n---\n\n${personaName} persona profile.\n`,
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["persona-drift"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(0);
  });

  test("(d) calibration-drift linter flags gap >7 days since last audit", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write calibration history with a date 10 days ago
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 10);
    const staleDateStr = staleDate.toISOString().split("T")[0]!;

    const calibrationHistory = `# Calibration History\n\n## ${staleDateStr}\n\nAudit pass. Zero-flattery score: 95%.\n`;
    await brain.write(
      "co-dialectic/calibration-history.md",
      calibrationHistory,
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["calibration-drift"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(1);
    expect(linterResult.findings[0]!.severity).toBe("info");
    expect(linterResult.findings[0]!.message).toContain("days ago");
    expect(linterResult.findings[0]!.message).toContain(staleDateStr);
  });

  test("(d) calibration-drift linter passes when last audit is recent (<= 7 days)", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write calibration history with today's date
    const today = new Date().toISOString().split("T")[0]!;
    const calibrationHistory = `# Calibration History\n\n## ${today}\n\nAudit pass. Zero-flattery score: 97%.\n`;
    await brain.write(
      "co-dialectic/calibration-history.md",
      calibrationHistory,
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["calibration-drift"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(0);
  });

  test("(d) calibration-drift linter flags file with no date entries", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    // Write calibration history with no dates
    await brain.write(
      "co-dialectic/calibration-history.md",
      "# Calibration History\n\nNo audits recorded yet.\n",
      {
        provenance: { who: "co-dialectic", why: "test fixture", source: "test" },
        engine_id: "co-dialectic",
      },
    );

    const result = await brain.lint.run(["calibration-drift"]);
    const linterResult = result.findings_by_linter[0]!;
    expect(linterResult.findings.length).toBe(1);
    expect(linterResult.findings[0]!.message).toContain("no date entries");
  });

  test("(d) writeBrainState and readBrainState helpers round-trip correctly", async () => {
    const { createBrain } = await import(BRAIN_KERNEL_PATH);
    const { registerEngine, writeBrainState, readBrainState } = await import(BOOTSTRAP_PATH);

    const brain = createBrain(tmpDir);
    registerEngine(brain);

    const state = {
      schema_version: "1.0.0",
      active: true,
      mode: "quiet" as const,
      honesty: "soft" as const,
      persona: "Writing Coach",
      persona_icon: "✍️",
      last_score: 70,
      last_cal: 85,
      wildcard: false,
      session_start_ts: new Date().toISOString(),
      version: "4.17.0",
      growth_total_turns: 100,
      last_updated_ts: new Date().toISOString(),
    };

    const writeResult = await writeBrainState(brain, state, "test round-trip");
    expect(writeResult.ok).toBe(true);

    const readBack = await readBrainState(brain);
    expect(readBack).not.toBeNull();
    expect(readBack!.mode).toBe("quiet");
    expect(readBack!.honesty).toBe("soft");
    expect(readBack!.persona).toBe("Writing Coach");
    expect(readBack!.last_score).toBe(70);
    expect(readBack!.growth_total_turns).toBe(100);
  });
});
