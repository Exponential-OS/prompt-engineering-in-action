#!/usr/bin/env bun
/**
 * Tests for brain-config.ts — XOS-400.
 *
 * The negatives carry most of the weight. A private installer writes this
 * config, so a bad value must fall back rather than become a `$(pwd)`-class
 * bug with extra steps — which is the failure this whole change replaces.
 */

import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";

import {
  defaultBrainRoot,
  readConfig,
  resolveBrainRoot,
  sessionLogRoot,
  setBrainRoot,
  validateBrainRoot,
} from "./brain-config.ts";

const dirs: string[] = [];
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "codi-cfg-"));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function cfgWith(value: unknown): string {
  const p = join(scratch(), "config.json");
  writeFileSync(p, JSON.stringify({ brain_root: value }) + "\n");
  return p;
}

// ── the default, which must not follow cwd ──────────────────────────────────
test("with no config at all, the default is under HOME, never cwd", () => {
  const r = resolveBrainRoot(join(scratch(), "does-not-exist.json"));
  expect(r.ok).toBe(true);
  expect(r.path).toBe(defaultBrainRoot());
  expect(r.path.startsWith(homedir())).toBe(true);
});

test("a default that followed cwd would reintroduce the original bug", () => {
  // Pinned explicitly: the 686 MB ledger happened because the writer used
  // $(pwd). A default anchored to HOME cannot do that.
  expect(defaultBrainRoot()).not.toBe(process.cwd());
  expect(defaultBrainRoot().startsWith(process.cwd() + "/")).toBe(false);
});

// ── config is honoured, and is the ONLY tier above the default ──────────────
test("a valid absolute config path wins", () => {
  const target = scratch();
  const r = resolveBrainRoot(cfgWith(target));
  expect(r.ok).toBe(true);
  expect(r.path).toBe(target);
});

test("sessions hang off the brain root", () => {
  const target = scratch();
  expect(sessionLogRoot(cfgWith(target))).toBe(join(target, "sessions"));
});

test("BRAIN_WORKSPACE_ROOT is NOT consulted — ambient env was the bug", () => {
  const prev = process.env.BRAIN_WORKSPACE_ROOT;
  process.env.BRAIN_WORKSPACE_ROOT = "/tmp/should-be-ignored-entirely";
  try {
    const r = resolveBrainRoot(join(scratch(), "absent.json"));
    expect(r.path).toBe(defaultBrainRoot());
  } finally {
    if (prev === undefined) delete process.env.BRAIN_WORKSPACE_ROOT;
    else process.env.BRAIN_WORKSPACE_ROOT = prev;
  }
});

// ── untrusted input: every refusal falls back, none throws ──────────────────
test("a RELATIVE path is refused — it would resolve differently per invocation", () => {
  const r = resolveBrainRoot(cfgWith("some/relative/dir"));
  expect(r.ok).toBe(false);
  expect(r.path).toBe(defaultBrainRoot());
  expect(r.reason).toContain("absolute");
});

test("system locations are refused", () => {
  for (const bad of ["/", "/etc", "/usr", "/System"]) {
    const r = validateBrainRoot(bad);
    expect(r.ok, `${bad} must be refused`).toBe(false);
    expect(r.path).toBe(defaultBrainRoot());
  }
});

test("non-strings and empties are refused, not crashed on", () => {
  for (const bad of [null, 42, {}, [], "", "   "]) {
    const r = validateBrainRoot(bad);
    expect(r.ok).toBe(false);
    expect(r.path).toBe(defaultBrainRoot());
  }
});

test("a corrupt config file falls back instead of throwing", () => {
  const p = join(scratch(), "config.json");
  writeFileSync(p, "{ this is not json");
  expect(readConfig(p)).toEqual({});
  expect(resolveBrainRoot(p).path).toBe(defaultBrainRoot());
});

test("~ is expanded — a human-edited config still works", () => {
  const r = validateBrainRoot("~/codi-test-brain");
  expect(r.ok).toBe(true);
  expect(r.path).toBe(join(homedir(), "codi-test-brain"));
});

test("traversal is normalised away rather than honoured literally", () => {
  const base = scratch();
  const r = validateBrainRoot(join(base, "a", "..", "b"));
  expect(r.ok).toBe(true);
  expect(r.path).toBe(join(base, "b"));
});

// ── the programmatic setter a private companion uses ────────────────────────
test("setBrainRoot persists the path and its provenance", () => {
  const p = join(scratch(), "config.json");
  const target = scratch();
  const r = setBrainRoot(target, "xos-extension", p);
  expect(r.ok).toBe(true);

  const written = JSON.parse(readFileSync(p, "utf8"));
  expect(written.brain_root).toBe(target);
  expect(written.brain_root_source).toBe("xos-extension");
  expect(resolveBrainRoot(p).path).toBe(target);
});

test("setBrainRoot REFUSES a bad value and reports it rather than silently falling back", () => {
  // Silently ignoring a bad repoint is how a migration appears to work and
  // does not. The caller must be able to tell accepted from refused.
  const p = join(scratch(), "config.json");
  const r = setBrainRoot("not/absolute", "xos-extension", p);
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("absolute");
  expect(readConfig(p).brain_root).toBeUndefined();
});

test("setBrainRoot preserves unrelated config keys", () => {
  const p = join(scratch(), "config.json");
  writeFileSync(p, JSON.stringify({ verbosity: "concise", mode: "drive" }) + "\n");
  setBrainRoot(scratch(), "cli", p);
  const written = readConfig(p);
  expect(written.verbosity).toBe("concise");
  expect(written.mode).toBe("drive");
});
