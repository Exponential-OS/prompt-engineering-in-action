import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";

type LintFinding = {
  severity: "info" | "warn" | "block";
  path: string;
  message: string;
  fix?: string;
};

type LintFn = (brain: {
  read(path: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
}) => Promise<LintFinding[]>;

type RegisterEngineOpts = {
  namespace: string;
  owned_paths?: string[];
  writes_to_primitives?: string[];
  reads_from_primitives?: string[];
  reads_from_engines?: string[];
};

type WriteOptions = {
  provenance?: {
    who: string;
    why: string;
    source: string;
  };
  engine_id?: string;
};

class AclStore {
  private namespaces = new Map<string, string>();

  register(engineId: string, opts: RegisterEngineOpts): void {
    this.namespaces.set(engineId, opts.namespace);
  }

  canWrite(engineId: string | undefined, path: string): boolean {
    if (!engineId) return true;
    const namespace = this.namespaces.get(engineId);
    if (!namespace) return true;
    return path === namespace || path.startsWith(`${namespace}/`);
  }
}

function walk(root: string, dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(root, abs, out);
    } else if (stat.isFile()) {
      out.push(abs.slice(root.length + 1).replaceAll("\\", "/"));
    }
  }
}

export function createBrain(root: string) {
  const acl = new AclStore();
  const linters = new Map<string, LintFn>();

  const readContent = async (path: string): Promise<string | null> => {
    const abs = join(root, path);
    return existsSync(abs) ? readFileSync(abs, "utf8") : null;
  };

  const listFiles = async (prefix: string): Promise<string[]> => {
    const files: string[] = [];
    walk(root, join(root, prefix), files);
    return files;
  };

  return {
    acl,

    async write(path: string, content: string, opts: WriteOptions = {}) {
      if (!acl.canWrite(opts.engine_id, path)) {
        return {
          ok: false,
          path,
          err: `ACL BLOCK: ${opts.engine_id} cannot write ${path}`,
        };
      }

      const abs = join(root, path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content, "utf8");
      return { ok: true, path };
    },

    async read(path: string) {
      return {
        ok: true,
        path,
        content: await readContent(path),
      };
    },

    async exists(path: string) {
      return existsSync(join(root, path));
    },

    async list(prefix: string) {
      return listFiles(prefix);
    },

    lint: {
      register(name: string, fn: LintFn): void {
        linters.set(name, fn);
      },

      async run(names?: string[]) {
        const selected = names ?? [...linters.keys()];
        const findings_by_linter = [];
        let blocks = 0;

        const readApi = {
          read: readContent,
          list: listFiles,
        };

        for (const name of selected) {
          const fn = linters.get(name);
          if (!fn) continue;
          const findings = await fn(readApi);
          blocks += findings.filter((f) => f.severity === "block").length;
          findings_by_linter.push({ linter: name, findings });
        }

        return {
          total_linters: linters.size,
          ran: findings_by_linter.length,
          skipped: linters.size - findings_by_linter.length,
          findings_by_linter,
          summary: { blocks },
        };
      },
    },
  };
}
