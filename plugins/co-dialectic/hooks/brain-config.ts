#!/usr/bin/env bun
/**
 * brain-config.ts — where codi keeps its session log, decided by CONFIG.
 *
 * ⛔ WHY THIS EXISTS, AND WHY IT IS NOT AN ENV VAR. XOS-400.
 *
 * codi resolved its brain root from `BRAIN_WORKSPACE_ROOT`, falling through to
 * cwd. Ambient environment is the wrong mechanism for a durable location: it
 * dies with the shell, differs per terminal, cannot be inspected after the
 * fact, and — because the fallback was cwd — it silently wrote wherever the
 * agent happened to be standing. The same `$(pwd)` shape put 686 MB of session
 * ledger into a repo nobody chose.
 *
 * A path that outlives a shell belongs in a file a PROGRAM can rewrite. That
 * is the whole point: a companion installer should be able to repoint codi
 * without asking a human to edit a dotfile or export a variable.
 *
 * ⭐ THE PUBLIC/PRIVATE BOUNDARY IS THE CONSTRAINT THAT SHAPES THIS.
 *
 * codi is AGPL and public. It must run standalone, with no knowledge that xOS
 * exists, so it CANNOT depend on the private brain-kernel for its own storage.
 * The dependency arrow runs one way only:
 *
 *     private xos extension  ──reads/writes──▶  this config  ◀──owns── public codi
 *
 * codi picks a default and logs there. A private companion may later point
 * this at an xOS brain. codi neither knows nor cares which happened — it reads
 * a path out of its own config file.
 *
 * ⚠️ THE CONFIG IS UNTRUSTED INPUT. A private installer writes it, so a bad or
 * hostile value must not become a `$(pwd)`-class bug with extra steps. Every
 * path is normalised, required to be absolute, and refused if it escapes to
 * somewhere a session log has no business being. Refusal falls back to the
 * default — codi keeps logging rather than failing a turn over a config typo.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "path";

/** Config lives beside session state, OUTSIDE the plugin cache, so it survives reinstalls. */
export function codiConfigPath(): string {
  const dir =
    process.env.CODI_STATE_DIR?.trim() || join(process.env.HOME?.trim() || homedir(), ".codialectic");
  return join(dir, "config.json");
}

/**
 * The default when nothing is configured.
 *
 * Deliberately under the user's home and NOT under cwd. A default that follows
 * the working directory is how logs end up scattered across unrelated repos.
 */
export function defaultBrainRoot(): string {
  return join(process.env.HOME?.trim() || homedir(), "codi", "brain");
}

export interface CodiConfig {
  /** Absolute path to the brain root that owns session logs. */
  brain_root?: unknown;
  /** Who last set brain_root — "default" | "user" | "<installer name>". For provenance only. */
  brain_root_source?: unknown;
  [key: string]: unknown;
}

export function readConfig(path: string = codiConfigPath()): CodiConfig {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as CodiConfig) : {};
  } catch {
    return {};
  }
}

/**
 * Paths a session log must never be written to, however the config got there.
 *
 * Narrow on purpose (RUMSFELD: enumerate the exemption, not the inclusion) —
 * this is a sanity floor against a mis-set config, not a security boundary.
 * The real protection is that the path must be absolute and normalised.
 */
const REFUSED_PREFIXES = ["/", "/etc", "/usr", "/bin", "/sbin", "/var", "/System", "/Library"];

export interface ValidationResult {
  ok: boolean;
  path: string;
  reason?: string;
}

export function validateBrainRoot(candidate: unknown): ValidationResult {
  const fallback = defaultBrainRoot();
  if (typeof candidate !== "string" || candidate.trim() === "") {
    return { ok: false, path: fallback, reason: "not a non-empty string" };
  }
  const raw = candidate.trim();

  // `~` is a shell affordance, not a path. Expanding it here means a config
  // written by a human in an editor still works.
  const expanded = raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;

  if (!isAbsolute(expanded)) {
    // A relative brain root reintroduces exactly the cwd-dependence this
    // replaces: the same config would resolve differently per invocation.
    return { ok: false, path: fallback, reason: `must be absolute, got "${raw}"` };
  }

  const norm = normalize(resolve(expanded));
  if (norm.includes("\0")) return { ok: false, path: fallback, reason: "null byte in path" };

  const stripped = norm.endsWith(sep) && norm.length > 1 ? norm.slice(0, -1) : norm;
  if (REFUSED_PREFIXES.includes(stripped)) {
    return { ok: false, path: fallback, reason: `refused system location "${stripped}"` };
  }

  return { ok: true, path: stripped };
}

/**
 * The brain root codi will use, with the resolution order ALL IN ONE PLACE.
 *
 *   1. config file  — a program wrote it (installer, companion, `codi brain set`)
 *   2. default      — ~/codi/brain
 *
 * There is deliberately no env-var tier and no cwd tier. Both were the bug.
 */
export function resolveBrainRoot(path: string = codiConfigPath()): ValidationResult {
  const cfg = readConfig(path);
  if (cfg.brain_root === undefined) return { ok: true, path: defaultBrainRoot() };
  return validateBrainRoot(cfg.brain_root);
}

/** Session logs live under the brain root, never under cwd. */
export function sessionLogRoot(path: string = codiConfigPath()): string {
  return join(resolveBrainRoot(path).path, "sessions");
}

/**
 * Set brain_root programmatically. This is the hook a private companion uses
 * to repoint codi at an xOS brain without a human editing anything.
 *
 * Returns the validation result so a caller can tell "accepted" from "refused
 * and fell back" — silently ignoring a bad value is how a repoint appears to
 * work and does not.
 */
export function setBrainRoot(
  candidate: string,
  source = "user",
  path: string = codiConfigPath(),
): ValidationResult {
  const result = validateBrainRoot(candidate);
  if (!result.ok) return result;

  const cfg = readConfig(path);
  cfg.brain_root = result.path;
  cfg.brain_root_source = source;

  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.config.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n");
  renameSync(tmp, path);
  return result;
}

if (import.meta.main) {
  // Guarded: importing this module must never write or print.
  const [cmd, value] = process.argv.slice(2);
  if (cmd === "set" && value) {
    const r = setBrainRoot(value, "cli");
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  }
  const r = resolveBrainRoot();
  console.log(JSON.stringify({ ...r, sessions: sessionLogRoot(), config: codiConfigPath() }, null, 2));
}
