import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const ZUUN_MARKER = "# zuun:post-commit";
const SHEBANG = "#!/usr/bin/env sh\n";

/**
 * Absolute path to the zuun.js we want the installed hook to invoke.
 * Git hooks run outside Claude Code, so they cannot rely on PATH or CLAUDE_PLUGIN_ROOT
 * at fire time. We resolve the plugin's install location NOW and embed it literally
 * in the hook content. Resolution order:
 *
 *   1. ZUUN_BIN — set by bin/zuun.js when it spawns the tsx child (dev path).
 *      Authoritative in normal use.
 *   2. CLAUDE_PLUGIN_ROOT — set by Claude Code when loaded as a plugin.
 *   3. Walk up from process.argv[1] when it is src/cli.ts to find bin/zuun.js
 *      next door. Covers `tsx src/cli.ts install-git-hook` invocations.
 *   4. Last resort: literal argv[1] — only correct when argv[1] is bin/zuun.js
 *      itself (compiled/direct-node path).
 */
function resolveZuunBinPath(): string {
  if (process.env.ZUUN_BIN) return path.resolve(process.env.ZUUN_BIN);
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) return path.resolve(pluginRoot, "bin", "zuun.js");
  const argv1 = process.argv[1];
  if (argv1?.endsWith(".ts")) {
    return path.resolve(path.dirname(argv1), "..", "bin", "zuun.js");
  }
  if (argv1) return path.resolve(argv1);
  throw new Error("install-git-hook: cannot resolve absolute path to zuun.js");
}

/** Resolve .git/hooks/post-commit honoring core.hooksPath and worktrees. */
function resolveHookPath(): string | null {
  try {
    const rel = execFileSync("git", ["rev-parse", "--git-path", "hooks/post-commit"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path.resolve(process.cwd(), rel);
  } catch {
    return null;
  }
}

export async function installGitHook(_args: string[]): Promise<number> {
  const hookPath = resolveHookPath();
  if (!hookPath) {
    process.stderr.write("install-git-hook: not inside a git repository\n");
    return 1;
  }

  let zuunBin: string;
  try {
    zuunBin = resolveZuunBinPath();
  } catch (err) {
    process.stderr.write(`install-git-hook: ${(err as Error).message}\n`);
    return 1;
  }

  const zuunLine = `${ZUUN_MARKER}\nnode ${JSON.stringify(zuunBin)} capture-commit >/dev/null 2>&1 || true\n`;

  fs.mkdirSync(path.dirname(hookPath), { recursive: true });

  let content: string;
  if (fs.existsSync(hookPath)) {
    content = fs.readFileSync(hookPath, "utf8");
    if (content.includes(ZUUN_MARKER)) {
      process.stdout.write("post-commit hook already installed\n");
      return 0;
    }
    if (!content.endsWith("\n")) content += "\n";
    content += "\n" + zuunLine;
  } else {
    content = SHEBANG + zuunLine;
  }

  fs.writeFileSync(hookPath, content);
  fs.chmodSync(hookPath, 0o755);
  process.stdout.write(`installed post-commit hook at ${hookPath}\n  invoking: ${zuunBin}\n`);
  return 0;
}
