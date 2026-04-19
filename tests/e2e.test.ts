import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("e2e", () => {
  let tmp: string;
  const env = () => ({ ...process.env, ZUUN_HOME: tmp });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-e2e-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function cli(args: string[], input?: string) {
    return spawnSync("node", ["bin/zuun.js", ...args], {
      env: env(),
      input,
      encoding: "utf8",
    });
  }

  it("init → capture → search round-trip", () => {
    expect(cli(["init"]).status).toBe(0);

    const c1 = cli(["capture", "--kind", "decision"], "Local-first beats cloud-first for portability.");
    expect(c1.status).toBe(0);

    const c2 = cli(["capture", "--kind", "observation"], "FTS is fast enough for personal memory.");
    expect(c2.status).toBe(0);

    const s = cli(["search", "portability"]);
    expect(s.status).toBe(0);
    expect(s.stdout).toContain("Local-first");
  });

  it("reindex rebuilds the db from markdown files", () => {
    cli(["init"]);
    cli(["capture"], "Something to remember.");
    fs.rmSync(path.join(tmp, "index.db"));
    const r = cli(["reindex"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/indexed 1/);
  });

  it("doctor reports healthy after a normal init", () => {
    cli(["init"]);
    const d = cli(["doctor"]);
    expect(d.status).toBe(0);
    expect(d.stdout).toMatch(/entries on disk: 0/);
  });

  it("version prints a non-empty line", () => {
    const v = cli(["version"]);
    expect(v.status).toBe(0);
    expect(v.stdout.trim().length).toBeGreaterThan(0);
  });

  // Regression: install-git-hook must embed a runnable absolute path to
  // bin/zuun.js in the installed hook. The unit test forces CLAUDE_PLUGIN_ROOT
  // to make resolution trivial, which masks the real failure mode: when the
  // command is run outside Claude Code (e.g. a user in a plain shell), neither
  // CLAUDE_PLUGIN_ROOT nor a node-executable process.argv[1] is available, and
  // earlier versions embedded `node "src/cli.ts"` — which silently fails because
  // node cannot run a .ts file directly and the hook swallows the error via
  // `|| true`. This test spawns through the real shim without CLAUDE_PLUGIN_ROOT
  // and asserts the hook points at bin/zuun.js.
  it("install-git-hook (real shim, no CLAUDE_PLUGIN_ROOT) writes a runnable hook", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-hook-"));
    try {
      spawnSync("git", ["init", "--initial-branch=main"], { cwd: repo });
      const plainEnv = { ...process.env };
      delete (plainEnv as Record<string, string | undefined>).CLAUDE_PLUGIN_ROOT;
      const install = spawnSync(
        "node",
        [path.resolve("bin/zuun.js"), "install-git-hook"],
        { cwd: repo, env: plainEnv, encoding: "utf8" },
      );
      expect(install.status).toBe(0);
      const hookPath = path.join(repo, ".git", "hooks", "post-commit");
      const content = fs.readFileSync(hookPath, "utf8");
      expect(content).toContain("bin/zuun.js");
      expect(content).not.toMatch(/src\/cli\.ts/);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  // Regression: the real path Claude Code uses to launch the MCP server is
  // `node bin/zuun.js mcp`, which dispatches through src/cli.ts. Earlier versions
  // of cli.ts returned 0 after `await import("./mcp.js")`, causing the outer
  // runCli().then(process.exit) to kill the server before it could answer a
  // single request. Tests that spawn `tsx src/mcp.ts` directly bypass this
  // dispatcher and cannot catch the regression. This test exercises the exact
  // production path.
  it("mcp server survives the bin/zuun.js dispatch and answers initialize", async () => {
    cli(["init"]);
    const proc = spawn("node", ["bin/zuun.js", "mcp"], {
      env: env(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    try {
      let stdout = "";
      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }) + "\n",
      );
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (stdout.includes('"id":1')) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(stdout).toContain('"protocolVersion":"2024-11-05"');
      expect(stdout).toContain('"name":"zuun"');
      expect(proc.exitCode).toBeNull(); // still alive, not killed by dispatcher
    } finally {
      proc.kill("SIGKILL");
      await new Promise((r) => proc.on("exit", r));
    }
  }, 15_000);
});
