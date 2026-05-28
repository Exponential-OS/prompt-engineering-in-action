#!/usr/bin/env bun
/**
 * skill-version-banner.ts — Co-Dialectic dev-cycle visibility hook.
 *
 * Fires on PreToolUse for the `Skill` tool. Resolves which installed plugin
 * actually owns the firing skill (scope-resolution-aware: project-matching-cwd
 * beats local beats user), then surfaces a one-line banner so both the human
 * and the agent know exactly which `plugin@marketplace v?` and `scope` won.
 *
 * Why this exists:
 *   Claude Code's Skill tool surfaces the skill name but NOT which install of
 *   which plugin satisfied it. When the same plugin is installed at multiple
 *   scopes (user/project/local), or when a stale orphan still lurks in the
 *   cache, you can spend hours wondering "why isn't this working" — when the
 *   real answer is "wrong version won the scope race". This hook eliminates
 *   that diagnostic gap, every time, for every skill, with zero per-skill setup.
 *
 * Output goes to:
 *   - systemMessage  → visible to the human (banner appears in UI)
 *   - additionalContext → injected into agent context (agent reasons about it)
 *
 * Exit semantics: ALWAYS exit 0. This hook NEVER blocks tool execution — it
 * only observes and reports. If resolution fails, emit a "could not resolve"
 * banner and proceed.
 */

import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const INSTALLED_PLUGINS = join(homedir(), ".claude/plugins/installed_plugins.json");

interface HookInput {
  tool_name?: string;
  tool_input?: { skill?: string; args?: string };
  cwd?: string;
  hook_event_name?: string;
}

interface PluginInstall {
  scope: "user" | "project" | "local" | "managed";
  installPath: string;
  version: string;
  projectPath?: string;
  installedAt?: string;
  lastUpdated?: string;
  gitCommitSha?: string;
}

interface InstalledPluginsManifest {
  version: number;
  plugins: Record<string, PluginInstall[]>;
}

interface Resolution {
  pluginKey: string;        // e.g. "career-intelligence@xos"
  skill: string;            // e.g. "mission-control"
  scope: string;            // "user" | "project" | "local"
  version: string;          // e.g. "0.65.0"
  installPath: string;      // absolute fs path
  projectPath?: string;     // present if scope=project
}

/**
 * Read installed_plugins.json — fail-safe (returns empty manifest on any error).
 */
function readManifest(): InstalledPluginsManifest {
  if (!existsSync(INSTALLED_PLUGINS)) return { version: 2, plugins: {} };
  try {
    return JSON.parse(readFileSync(INSTALLED_PLUGINS, "utf8"));
  } catch {
    return { version: 2, plugins: {} };
  }
}

/**
 * Check whether a given install actually contains the named skill.
 * Skill files live at: <installPath>/skills/<skill-name>/SKILL.md
 */
function installDeclaresSkill(installPath: string, skill: string): boolean {
  try {
    const skillMd = join(installPath, "skills", skill, "SKILL.md");
    return existsSync(skillMd) && statSync(skillMd).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve which install of which plugin would win for the given skill at this cwd.
 *
 * Scope resolution priority (Claude Code semantics):
 *   1. project-scope install whose projectPath is an ancestor of cwd
 *   2. local-scope install
 *   3. user-scope install
 *
 * If the skill name is namespaced ("plugin-name:skill-name"), constrain candidates
 * to that plugin. Otherwise scan all installed plugins for the bare skill name.
 */
function resolveSkill(skillArg: string, cwd: string): Resolution | null {
  const colonIdx = skillArg.indexOf(":");
  const constrainedPlugin = colonIdx >= 0 ? skillArg.slice(0, colonIdx) : null;
  const skillName = colonIdx >= 0 ? skillArg.slice(colonIdx + 1) : skillArg;

  const manifest = readManifest();
  const candidates: Array<{ pluginKey: string; install: PluginInstall }> = [];

  for (const [pluginKey, installs] of Object.entries(manifest.plugins ?? {})) {
    const pluginName = pluginKey.split("@")[0];
    if (constrainedPlugin && pluginName !== constrainedPlugin) continue;
    for (const install of installs) {
      if (installDeclaresSkill(install.installPath, skillName)) {
        candidates.push({ pluginKey, install });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Rank candidates by scope-resolution priority.
  // Lower rank = wins.
  function rank(c: { install: PluginInstall }): number {
    const s = c.install.scope;
    if (s === "project") {
      // Only wins if cwd is under this projectPath
      const p = c.install.projectPath ?? "";
      if (p && (cwd === p || cwd.startsWith(p + "/"))) return 0;
      // project scope but wrong cwd — push to bottom
      return 99;
    }
    if (s === "local") return 1;
    if (s === "user") return 2;
    if (s === "managed") return 3;
    return 50;
  }

  candidates.sort((a, b) => rank(a) - rank(b));
  const winner = candidates[0];
  if (rank(winner) === 99) return null; // No applicable scope

  return {
    pluginKey: winner.pluginKey,
    skill: skillName,
    scope: winner.install.scope,
    version: winner.install.version,
    installPath: winner.install.installPath,
    projectPath: winner.install.projectPath,
  };
}

/**
 * Render the human-facing banner (terse, one line).
 */
function renderBanner(r: Resolution, totalCandidates: number): string {
  const homePrefixed = r.installPath.replace(homedir(), "~");
  const ambiguous = totalCandidates > 1 ? ` ⚠ ${totalCandidates} installs found — scope race resolved` : "";
  return `[skill: ${r.pluginKey} v${r.version} · scope=${r.scope} · ${r.skill}${ambiguous}]\n  path: ${homePrefixed}`;
}

/**
 * Render the agent-facing context (more verbose — agent benefits from full path).
 */
function renderContext(r: Resolution, totalCandidates: number): string {
  const lines = [
    `Skill resolution (skill-version-banner hook):`,
    `  skill:       ${r.skill}`,
    `  plugin:      ${r.pluginKey}`,
    `  version:     ${r.version}`,
    `  scope:       ${r.scope}`,
    `  installPath: ${r.installPath}`,
  ];
  if (r.projectPath) lines.push(`  projectPath: ${r.projectPath}`);
  if (totalCandidates > 1) {
    lines.push(`  ⚠ ${totalCandidates} installs declare this skill — winner above resolved by Claude Code scope priority (project-matching-cwd > local > user).`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  let input: HookInput = {};
  try {
    const raw = await Bun.stdin.text();
    if (raw && raw.trim()) input = JSON.parse(raw);
  } catch {
    // Malformed stdin — exit silently, don't block
    process.exit(0);
  }

  // Defensive: matcher should already filter to Skill, but be explicit
  if (input.tool_name && input.tool_name !== "Skill") {
    process.exit(0);
  }

  const skillArg = input.tool_input?.skill;
  if (!skillArg) {
    process.exit(0);
  }

  const cwd = input.cwd ?? process.cwd();

  // Count candidates for the "ambiguity" warning before picking the winner
  const manifest = readManifest();
  const colonIdx = skillArg.indexOf(":");
  const constrainedPlugin = colonIdx >= 0 ? skillArg.slice(0, colonIdx) : null;
  const skillName = colonIdx >= 0 ? skillArg.slice(colonIdx + 1) : skillArg;
  let totalCandidates = 0;
  for (const [pluginKey, installs] of Object.entries(manifest.plugins ?? {})) {
    const pluginName = pluginKey.split("@")[0];
    if (constrainedPlugin && pluginName !== constrainedPlugin) continue;
    for (const install of installs) {
      if (installDeclaresSkill(install.installPath, skillName)) totalCandidates++;
    }
  }

  const resolution = resolveSkill(skillArg, cwd);

  let banner: string;
  let context: string;
  if (resolution) {
    banner = renderBanner(resolution, totalCandidates);
    context = renderContext(resolution, totalCandidates);
  } else {
    banner = `[skill: ${skillArg} ⚠ could not resolve owning plugin — not found in installed_plugins.json or no scope applies for cwd=${cwd}]`;
    context = `Skill resolution failed for "${skillArg}" at cwd=${cwd}. Possible causes: (1) skill not installed, (2) project scope install exists but cwd doesn't match its projectPath, (3) installed_plugins.json missing or corrupt. Consider: claude plugin install <plugin>@<marketplace>.`;
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: context,
    },
    systemMessage: banner,
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch((err) => {
  // Fail-safe: never block tool execution on error.
  process.stderr.write(`skill-version-banner error: ${err}\n`);
  process.exit(0);
});
