/**
 * xos_143_memory_index.test.ts — waky-waky institutional memory tier.
 *
 * Run: bun test tests/xos_143_memory_index.test.ts
 */

import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import {
  DEFAULT_MEMORY_INDEX_BUDGET_BYTES,
  loadMemoryIndexTier,
  resolveMemoryIndexPath,
} from "../skills/waky-waky/resolve-memory-index.ts";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function loadWithoutThrow(context: unknown, options = {}): ReturnType<typeof loadMemoryIndexTier> {
  let loaded: ReturnType<typeof loadMemoryIndexTier> | undefined;
  expect(() => {
    loaded = loadMemoryIndexTier(context as never, options);
  }).not.toThrow();
  return loaded as ReturnType<typeof loadMemoryIndexTier>;
}

function expectSkipped(loaded: ReturnType<typeof loadMemoryIndexTier>): void {
  expect(loaded.kind).toBe("none");
  expect(loaded.path).toBeNull();
  expect(loaded.source).toBeNull();
  expect(loaded.loadedBytes).toBe(0);
  expect(loaded.totalBytes).toBe(0);
  expect(loaded.truncated).toBe(false);
  expect(loaded.content).toBe("");
  expect(loaded.statusLine).toBe("Tier 2.6 (memory): none (no index path resolved)");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("waky-waky memory index resolution (XOS-143)", () => {
  test("context.json memory_index_path wins over fallback candidates", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");
    const configured = join(root, "configured", "index.md");
    const cyborg = join(home, "cyborg", "memory-index.md");
    const workspaceMemory = join(workspace, "MEMORY.md");

    writeFile(configured, "configured index\n");
    writeFile(cyborg, "cyborg index\n");
    writeFile(workspaceMemory, "workspace memory\n");

    const resolved = resolveMemoryIndexPath(
      { memory_index_path: configured, workspace_root: workspace },
      { homeDir: home },
    );
    const loaded = loadMemoryIndexTier(
      { memory_index_path: configured, workspace_root: workspace },
      { homeDir: home },
    );

    expect(resolved).toEqual({ path: configured, source: "context" });
    expect(loaded.kind).toBe("loaded");
    expect(loaded.content).toBe("configured index\n");
  });

  test("configured missing path skips instead of using fallback candidates", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");
    const configured = join(root, "configured", "missing.md");
    const cyborg = join(home, "cyborg", "memory-index.md");
    const workspaceMemory = join(workspace, "MEMORY.md");

    writeFile(cyborg, "cyborg fallback must not load\n");
    writeFile(workspaceMemory, "workspace fallback must not load\n");

    const resolved = resolveMemoryIndexPath(
      { memory_index_path: configured, workspace_root: workspace },
      { homeDir: home },
    );
    const loaded = loadWithoutThrow(
      { memory_index_path: configured, workspace_root: workspace },
      { homeDir: home },
    );

    expect(resolved).toBeNull();
    expectSkipped(loaded);
    expect(loaded.content).not.toContain("fallback must not load");
  });

  test("fallback chain prefers ~/cyborg/memory-index.md, then workspace MEMORY.md", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");
    const cyborg = join(home, "cyborg", "memory-index.md");
    const workspaceMemory = join(workspace, "MEMORY.md");

    writeFile(cyborg, "cyborg index\n");
    writeFile(workspaceMemory, "workspace memory\n");

    expect(resolveMemoryIndexPath({ workspace_root: workspace }, { homeDir: home })).toEqual({
      path: cyborg,
      source: "cyborg",
    });

    rmSync(cyborg);

    expect(resolveMemoryIndexPath({ workspace_root: workspace }, { homeDir: home })).toEqual({
      path: workspaceMemory,
      source: "workspace-memory",
    });
  });

  test("fallback chain skips invalid cyborg candidate and continues to workspace MEMORY.md", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");
    const cyborgDirectory = join(home, "cyborg", "memory-index.md");
    const workspaceMemory = join(workspace, "MEMORY.md");

    mkdirSync(cyborgDirectory, { recursive: true });
    writeFile(workspaceMemory, "workspace fallback survives invalid cyborg\n");

    const loaded = loadWithoutThrow({ workspace_root: workspace }, { homeDir: home });

    expect(loaded.kind).toBe("loaded");
    expect(loaded.path).toBe(workspaceMemory);
    expect(loaded.source).toBe("workspace-memory");
    expect(loaded.content).toBe("workspace fallback survives invalid cyborg\n");
  });

  test("~ paths resolve via HOME, workspace relatives resolve via workspace_root, and relatives without workspace_root skip", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");
    const cwd = join(root, "cwd");
    const homeIndex = join(home, "indexes", "memory.md");
    const workspaceIndex = join(workspace, "indexes", "memory.md");
    const cwdIndex = join(cwd, "indexes", "memory.md");

    writeFile(homeIndex, "home-expanded index\n");
    writeFile(workspaceIndex, "workspace-relative index\n");
    writeFile(cwdIndex, "cwd-relative must not load\n");

    expect(resolveMemoryIndexPath({ memory_index_path: "~/indexes/memory.md" }, { homeDir: home })).toEqual({
      path: homeIndex,
      source: "context",
    });
    expect(loadMemoryIndexTier({ memory_index_path: "~/indexes/memory.md" }, { homeDir: home }).content).toBe(
      "home-expanded index\n",
    );

    expect(
      resolveMemoryIndexPath(
        { memory_index_path: "indexes/memory.md", workspace_root: workspace },
        { homeDir: home, cwd },
      ),
    ).toEqual({
      path: workspaceIndex,
      source: "context",
    });
    expect(
      loadMemoryIndexTier(
        { memory_index_path: "indexes/memory.md", workspace_root: workspace },
        { homeDir: home, cwd },
      ).content,
    ).toBe("workspace-relative index\n");

    expect(resolveMemoryIndexPath({ memory_index_path: "indexes/memory.md" }, { homeDir: home, cwd })).toBeNull();
    expectSkipped(loadWithoutThrow({ memory_index_path: "indexes/memory.md" }, { homeDir: home, cwd }));
  });

  test("missing configured and fallback paths skip the tier", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const workspace = join(root, "workspace");

    mkdirSync(home, { recursive: true });
    mkdirSync(workspace, { recursive: true });

    const loaded = loadMemoryIndexTier({ workspace_root: workspace }, { homeDir: home });

    expect(loaded).toEqual({
      kind: "none",
      path: null,
      source: null,
      budgetBytes: DEFAULT_MEMORY_INDEX_BUDGET_BYTES,
      loadedBytes: 0,
      totalBytes: 0,
      truncated: false,
      content: "",
      statusLine: "Tier 2.6 (memory): none (no index path resolved)",
    });
  });

  test("UTF-8 boundary truncation keeps a valid head and appends the on-demand pointer", () => {
    const root = makeTempDir("codi-xos-143-");
    const index = join(root, "memory-index.md");
    const content = "abcédef";
    writeFile(index, content);

    const loaded = loadMemoryIndexTier({
      memory_index_path: index,
      memory_index_budget_bytes: 4,
    });

    expect(loaded.kind).toBe("loaded");
    expect(loaded.truncated).toBe(true);
    expect(loaded.loadedBytes).toBeLessThanOrEqual(4);
    expect(loaded.loadedBytes).toBe(3);
    expect(loaded.totalBytes).toBe(Buffer.byteLength(content));
    expect(loaded.content).toBe(`abc\n…(5 more bytes — full index at ${index}; read on demand)`);
    expect(loaded.content).not.toContain("\uFFFD");
    expect(loaded.content).toContain("read on demand");
  });

  test("over-budget index loads only the head plus an on-demand pointer", () => {
    const root = makeTempDir("codi-xos-143-");
    const index = join(root, "memory-index.md");
    const content = "0123456789abcdefghijklmnopqrstuvwxyz";
    writeFile(index, content);

    const loaded = loadMemoryIndexTier({
      memory_index_path: index,
      memory_index_budget_bytes: 10,
    });

    expect(loaded.kind).toBe("loaded");
    expect(loaded.truncated).toBe(true);
    expect(loaded.loadedBytes).toBe(10);
    expect(loaded.totalBytes).toBe(content.length);
    expect(loaded.content).toBe(
      `0123456789\n…(26 more bytes — full index at ${index}; read on demand)`,
    );
    expect(loaded.content).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(loaded.statusLine).toBe("Tier 2.6 (memory): loaded ~1 KB (budget 1 KB), truncated");
  });

  test("under-budget index loads in full", () => {
    const root = makeTempDir("codi-xos-143-");
    const index = join(root, "memory-index.md");
    const content = "one-line recall index\nsecond recall\n";
    writeFile(index, content);

    const loaded = loadMemoryIndexTier({
      memory_index_path: index,
      memory_index_budget_bytes: 1024,
    });

    expect(loaded.kind).toBe("loaded");
    expect(loaded.truncated).toBe(false);
    expect(loaded.loadedBytes).toBe(Buffer.byteLength(content));
    expect(loaded.totalBytes).toBe(Buffer.byteLength(content));
    expect(loaded.content).toBe(content);
    expect(loaded.statusLine).toBe("Tier 2.6 (memory): loaded ~1 KB (budget 1 KB)");
  });

  test("unreadable, directory, and disappeared configured paths skip without throwing", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");
    const lockedDir = join(root, "locked");
    const unreadable = join(lockedDir, "index.md");
    const directoryPath = join(root, "directory-index.md");
    const disappeared = join(root, "disappeared.md");

    writeFile(unreadable, "unreadable index\n");
    mkdirSync(directoryPath, { recursive: true });
    writeFile(disappeared, "gone\n");
    rmSync(disappeared);

    chmodSync(lockedDir, 0);
    try {
      expectSkipped(loadWithoutThrow({ memory_index_path: unreadable }, { homeDir: home }));
    } finally {
      chmodSync(lockedDir, 0o700);
    }

    expectSkipped(loadWithoutThrow({ memory_index_path: directoryPath }, { homeDir: home }));
    expectSkipped(loadWithoutThrow({ memory_index_path: disappeared }, { homeDir: home }));
  });

  test("malformed and empty context skip, and an empty index file loads cleanly", () => {
    const root = makeTempDir("codi-xos-143-");
    const home = join(root, "home");

    for (const context of [null, [], "not-json", {}, { memory_index_path: 42, workspace_root: 17 }]) {
      expectSkipped(loadWithoutThrow(context, { homeDir: home, cwd: root }));
    }

    const emptyIndex = join(root, "empty-index.md");
    writeFile(emptyIndex, "");

    const loaded = loadWithoutThrow(
      { memory_index_path: emptyIndex, memory_index_budget_bytes: 16 },
      { homeDir: home },
    );

    expect(loaded.kind).toBe("loaded");
    expect(loaded.content).toBe("");
    expect(loaded.loadedBytes).toBe(0);
    expect(loaded.totalBytes).toBe(0);
    expect(loaded.truncated).toBe(false);
    expect(loaded.statusLine).toBe("Tier 2.6 (memory): loaded ~0 KB (budget 1 KB)");
  });
});
