import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "child_process";
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
});
