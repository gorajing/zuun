import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { installGitHook } from "./install-git-hook";

describe("install-git-hook", () => {
  let repo: string;
  const origCwd = process.cwd();
  const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-install-"));
    process.chdir(repo);
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: repo });
    process.env.CLAUDE_PLUGIN_ROOT = path.resolve(origCwd);
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(repo, { recursive: true, force: true });
    if (origPluginRoot === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
    else process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot;
  });

  it("installs post-commit hook as executable", async () => {
    expect(await installGitHook([])).toBe(0);
    const hook = path.join(repo, ".git", "hooks", "post-commit");
    expect(fs.existsSync(hook)).toBe(true);
    expect(fs.statSync(hook).mode & 0o111).toBeTruthy();
  });

  it("embeds an absolute path to zuun.js so the hook works outside Claude Code", async () => {
    await installGitHook([]);
    const content = fs.readFileSync(
      path.join(repo, ".git", "hooks", "post-commit"), "utf8",
    );
    expect(content).toMatch(/node\s+"\/.*bin\/zuun\.js"\s+capture-commit/);
    expect(content).not.toMatch(/^\s*zuun\s+capture-commit/m);
  });

  it("appends to an existing hook instead of overwriting", async () => {
    const hook = path.join(repo, ".git", "hooks", "post-commit");
    fs.writeFileSync(hook, "#!/bin/sh\n# existing user hook\necho 'hi'\n");
    fs.chmodSync(hook, 0o755);

    expect(await installGitHook([])).toBe(0);
    const content = fs.readFileSync(hook, "utf8");
    expect(content).toContain("existing user hook");
    expect(content).toContain("capture-commit");
    expect(content).toContain("# zuun:post-commit");
  });

  it("is idempotent — running twice doesn't duplicate the zuun line", async () => {
    await installGitHook([]);
    await installGitHook([]);
    const content = fs.readFileSync(
      path.join(repo, ".git", "hooks", "post-commit"), "utf8",
    );
    const matches = content.match(/# zuun:post-commit/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("honors core.hooksPath when set", async () => {
    const customHooks = path.join(repo, "custom-hooks");
    fs.mkdirSync(customHooks, { recursive: true });
    execFileSync("git", ["config", "core.hooksPath", customHooks], { cwd: repo });

    expect(await installGitHook([])).toBe(0);
    expect(fs.existsSync(path.join(customHooks, "post-commit"))).toBe(true);
    expect(fs.existsSync(path.join(repo, ".git", "hooks", "post-commit"))).toBe(false);
  });

  it("returns non-zero when not in a git repo", async () => {
    process.chdir(os.tmpdir());
    expect(await installGitHook([])).not.toBe(0);
  });
});
