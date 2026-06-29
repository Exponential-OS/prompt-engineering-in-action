import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "fs";
import { homedir } from "os";
import { isAbsolute, join, resolve } from "path";

export const DEFAULT_MEMORY_INDEX_BUDGET_BYTES = 12_288;

export type MemoryIndexSource = "context" | "cyborg" | "workspace-memory";

export interface WakyWakyContext {
  memory_index_path?: unknown;
  memory_index_budget_bytes?: unknown;
  workspace_root?: unknown;
}

export interface ResolveMemoryIndexOptions {
  homeDir?: string;
  cwd?: string;
}

export interface ResolvedMemoryIndex {
  path: string;
  source: MemoryIndexSource;
}

interface NormalizedOptions {
  homeDir: string | null;
}

interface MemoryIndexCandidate {
  path: string;
  source: MemoryIndexSource;
}

export type MemoryIndexLoadResult =
  | {
      kind: "none";
      path: null;
      source: null;
      budgetBytes: number;
      loadedBytes: 0;
      totalBytes: 0;
      truncated: false;
      content: "";
      statusLine: "Tier 2.6 (memory): none (no index path resolved)";
    }
  | {
      kind: "loaded";
      path: string;
      source: MemoryIndexSource;
      budgetBytes: number;
      loadedBytes: number;
      totalBytes: number;
      truncated: boolean;
      content: string;
      statusLine: string;
    };

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asContext(value: unknown): WakyWakyContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as WakyWakyContext;
}

function normalizeHomeDir(value: unknown): string | null {
  const home = asNonEmptyString(value);
  return home && isAbsolute(home) ? home : null;
}

function defaultHomeDir(): string | null {
  try {
    return normalizeHomeDir(homedir());
  } catch {
    return null;
  }
}

function expandHome(path: string, homeDir: string | null): string | null {
  if (!homeDir && (path === "~" || path.startsWith("~/"))) return null;
  if (path === "~") return homeDir;
  if (path.startsWith("~/")) return join(homeDir, path.slice(2));
  return path;
}

function workspaceRoot(context: WakyWakyContext, options: NormalizedOptions): string | null {
  const root = asNonEmptyString(context.workspace_root);
  if (!root) return null;

  const expanded = expandHome(root, options.homeDir);
  if (!expanded) return null;
  return isAbsolute(expanded) ? expanded : null;
}

function normalizeConfiguredPath(
  path: string,
  context: WakyWakyContext,
  options: NormalizedOptions,
): string | null {
  const expanded = expandHome(path, options.homeDir);
  if (!expanded) return null;
  if (isAbsolute(expanded)) return expanded;

  const root = workspaceRoot(context, options);
  if (root) return resolve(root, expanded);

  return null;
}

function budgetBytes(context: WakyWakyContext): number {
  const raw = context.memory_index_budget_bytes;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MEMORY_INDEX_BUDGET_BYTES;
  }
  return Math.floor(raw);
}

function defaultOptions(options: ResolveMemoryIndexOptions = {}): NormalizedOptions {
  const safeOptions = options && typeof options === "object" ? options : {};
  return {
    homeDir: normalizeHomeDir((safeOptions as ResolveMemoryIndexOptions).homeDir) ?? defaultHomeDir(),
  };
}

function safeExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function safeStat(path: string): ReturnType<typeof statSync> | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function safeOpen(path: string): number | null {
  try {
    return openSync(path, "r");
  } catch {
    return null;
  }
}

function safeClose(fd: number): boolean {
  try {
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function readableFile(path: string): boolean {
  if (!safeExists(path)) return false;

  const stats = safeStat(path);
  if (!stats?.isFile()) return false;

  const fd = safeOpen(path);
  if (fd === null) return false;

  return safeClose(fd);
}

// Tier 2.6 is total/fail-open: configured paths are authoritative, fallbacks are
// only considered when unset, relatives require workspace_root, and any IO error
// makes that candidate behave as absent.
function candidatePaths(context: WakyWakyContext, options: NormalizedOptions): MemoryIndexCandidate[] {
  const configuredPath = asNonEmptyString(context.memory_index_path);

  if (configuredPath) {
    const path = normalizeConfiguredPath(configuredPath, context, options);
    return path ? [{ path, source: "context" }] : [];
  }

  const candidates: MemoryIndexCandidate[] = [];
  if (options.homeDir) {
    candidates.push({ path: join(options.homeDir, "cyborg", "memory-index.md"), source: "cyborg" });
  }

  const root = workspaceRoot(context, options);
  if (root) {
    candidates.push({ path: join(root, "MEMORY.md"), source: "workspace-memory" });
  }

  return candidates;
}

export function resolveMemoryIndexPath(
  context: WakyWakyContext = {},
  options: ResolveMemoryIndexOptions = {},
): ResolvedMemoryIndex | null {
  const safeContext = asContext(context);
  const resolvedOptions = defaultOptions(options);

  for (const candidate of candidatePaths(safeContext, resolvedOptions)) {
    if (readableFile(candidate.path)) {
      return candidate;
    }
  }

  return null;
}

function decodeUtf8Prefix(buffer: Buffer): { text: string; bytes: number } {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let end = buffer.length; end >= 0; end -= 1) {
    try {
      return { text: decoder.decode(buffer.subarray(0, end)), bytes: end };
    } catch {
      // Back up to the nearest UTF-8 boundary so the loaded head is valid text.
    }
  }
  return { text: "", bytes: 0 };
}

function readHead(path: string, maxBytes: number): Buffer | null {
  const fd = safeOpen(path);
  if (fd === null) return null;

  let result: Buffer | null = null;
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = readSync(fd, buffer, 0, maxBytes, 0);
    result = buffer.subarray(0, bytesRead);
  } catch {
    result = null;
  }

  return safeClose(fd) ? result : null;
}

function kb(bytes: number): number {
  return Math.ceil(bytes / 1024);
}

function statusLine(loadedBytes: number, budget: number, truncated: boolean): string {
  return `Tier 2.6 (memory): loaded ~${kb(loadedBytes)} KB (budget ${kb(budget)} KB)${
    truncated ? ", truncated" : ""
  }`;
}

function noneResult(budget: number): MemoryIndexLoadResult {
  return {
    kind: "none",
    path: null,
    source: null,
    budgetBytes: budget,
    loadedBytes: 0,
    totalBytes: 0,
    truncated: false,
    content: "",
    statusLine: "Tier 2.6 (memory): none (no index path resolved)",
  };
}

function loadCandidate(candidate: MemoryIndexCandidate, budget: number): MemoryIndexLoadResult | null {
  const stats = safeStat(candidate.path);
  if (!stats?.isFile()) return null;

  const totalBytes = stats.size;
  if (totalBytes <= budget) {
    const content = safeReadFile(candidate.path);
    if (content === null) return null;

    return {
      kind: "loaded",
      path: candidate.path,
      source: candidate.source,
      budgetBytes: budget,
      loadedBytes: totalBytes,
      totalBytes,
      truncated: false,
      content,
      statusLine: statusLine(totalBytes, budget, false),
    };
  }

  const buffer = readHead(candidate.path, budget);
  if (buffer === null) return null;

  const head = decodeUtf8Prefix(buffer);
  const remainingBytes = totalBytes - head.bytes;
  const pointer = `…(${remainingBytes} more bytes — full index at ${candidate.path}; read on demand)`;
  const separator = head.text.endsWith("\n") || head.text.length === 0 ? "" : "\n";
  const content = `${head.text}${separator}${pointer}`;

  return {
    kind: "loaded",
    path: candidate.path,
    source: candidate.source,
    budgetBytes: budget,
    loadedBytes: head.bytes,
    totalBytes,
    truncated: true,
    content,
    statusLine: statusLine(head.bytes, budget, true),
  };
}

export function loadMemoryIndexTier(
  context: WakyWakyContext = {},
  options: ResolveMemoryIndexOptions = {},
): MemoryIndexLoadResult {
  const safeContext = asContext(context);
  const budget = budgetBytes(safeContext);
  const resolvedOptions = defaultOptions(options);

  for (const candidate of candidatePaths(safeContext, resolvedOptions)) {
    const loaded = loadCandidate(candidate, budget);
    if (loaded) return loaded;
  }

  return noneResult(budget);
}
