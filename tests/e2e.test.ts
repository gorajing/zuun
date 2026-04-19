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
