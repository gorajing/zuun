import * as fs from "fs";
import { execFileSync } from "child_process";

/**
 * Resolve an absolute project path for the given working directory.
 *
 * Returns the enclosing git repo's toplevel if cwd is inside a git repo.
 * Returns `undefined` if the cwd is NOT inside a git repo — treated as a
 * "global" capture in zuun's semantics (applies to every project).
 *
 * Also returns undefined if the cwd doesn't exist.
 */
export function resolveProject(cwd: string = process.cwd()): string | undefined {
  try {
    const real = fs.realpathSync(cwd);
    try {
      const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: real,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return fs.realpathSync(root);
    } catch {
      // Not inside a git repo — treat as global (return undefined).
      return undefined;
    }
  } catch {
    return undefined;
  }
}
