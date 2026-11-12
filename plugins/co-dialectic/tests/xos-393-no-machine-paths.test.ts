/**
 * XOS-393 — a public repo shipped a PreToolUse hook pointing at one developer's home.
 *
 * `.claude/settings.json` was TRACKED in this public repo and registered:
 *
 *   "command": "/Users/<dev>/cyborg/scripts/preflight-cd-git-block.sh"
 *
 * That path was wrong two ways -- the script lives under a different root and was
 * migrated .sh -> .ts long ago -- so it existed on no machine, including the
 * author's. Every clone got a Bash hook pointing into a stranger's home directory.
 *
 * This is the XOS-360 class (fixed in f1fe91b for a plugin hook) recurring in the
 * repo's OWN config, which is why fixing the instance did not prevent it. The leak
 * gate could not catch either: it scans for secrets, and a hardcoded home path is
 * not a secret, it is a correctness bug that happens to also leak a username.
 *
 * The rule enforced here: no tracked file may contain an absolute path into a
 * specific user's home directory. Personal config belongs in
 * .claude/settings.local.json, which is gitignored.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const REPO_ROOT = join(dirname(import.meta.path), "..", "..", "..");

/** `git ls-files`, so this checks what SHIPS rather than what happens to be on disk. */
function trackedFiles(): string[] {
  const out = Bun.spawnSync({
    cmd: ["git", "-C", REPO_ROOT, "ls-files"],
    stdout: "pipe",
  });
  return new TextDecoder().decode(out.stdout).split("\n").filter(Boolean);
}

/**
 * The only two exemptions, both deliberate and both narrow:
 *
 *  - CHANGELOG.md quotes the very bug being described. A changelog is a
 *    historical record; rewriting history to pass a lint is worse than the lint.
 *  - THIS FILE carries the offending strings as control fixtures. It flagged
 *    itself on first CI run, and did not locally, because the scan reads
 *    `git ls-files`: before the commit the file was untracked and therefore
 *    invisible to its own scan. A green local run meant nothing here.
 *
 * Kept as an exact-match list, and asserted below to stay at two entries, so it
 * cannot quietly grow into the loophole that defeats the check.
 */
const EXEMPT = [/(^|\/)CHANGELOG\.md$/, /(^|\/)xos-393-no-machine-paths\.test\.ts$/];
const HISTORICAL = { test: (f: string) => EXEMPT.some((re) => re.test(f)) };

/** Absolute path into a named user's home on macOS or Linux. */
const HOME_PATH = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;

/** The encoded form Claude Code uses for project dirs, e.g. -Users-someone-project. */
const ENCODED_HOME = /-(?:Users|home)-[A-Za-z0-9._-]+-/;

describe("XOS-393: no tracked file hardcodes a developer's home directory", () => {
  const files = trackedFiles().filter((f) => !HISTORICAL.test(f));

  test("the tracked-file list is real", () => {
    expect(files.length).toBeGreaterThan(20); // non-vacuity: git ls-files worked
  });

  test("the exemption list stays exactly two entries", () => {
    // An exemption list that can grow silently is how this kind of check dies:
    // the next offender gets added to the list instead of fixed.
    expect(EXEMPT.length).toBe(2);
    // And the scan must still be looking at most of the repo.
    expect(trackedFiles().length - files.length).toBeLessThanOrEqual(4);
  });

  test("no absolute home path ships", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const full = join(REPO_ROOT, f);
      if (!existsSync(full)) continue;
      let text: string;
      try {
        text = readFileSync(full, "utf8");
      } catch {
        continue; // binary or unreadable
      }
      const hit = HOME_PATH.exec(text) ?? ENCODED_HOME.exec(text);
      if (hit) offenders.push(`${f}: ${hit[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  test("control: both forms are detected", () => {
    // Guards the scan above against passing because the patterns stopped matching.
    expect(HOME_PATH.test('"/Users/someone/cyborg/scripts/x.sh"')).toBe(true);
    expect(HOME_PATH.test('"/home/someone/.bun/bin/bun"')).toBe(true);
    expect(ENCODED_HOME.test("-Users-someone-anand-career-os/memory/x.md")).toBe(true);
    // ...and do not fire on a relative or tilde path, which is portable and fine.
    expect(HOME_PATH.test("~/.codialectic/statusline.sh")).toBe(false);
    expect(HOME_PATH.test("plugins/co-dialectic/hooks/statusline.sh")).toBe(false);
  });

  test(".claude/settings.json is not tracked", () => {
    // Personal config: machine-specific hook paths and plugin enablement are the
    // developer's, not the repo's. settings.local.json is the supported home.
    expect(trackedFiles()).not.toContain(".claude/settings.json");
  });
});
