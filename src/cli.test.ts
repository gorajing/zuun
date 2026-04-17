import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runCli } from "./cli";

describe("cli", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-cli-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("init creates the store directory and db", async () => {
    expect(await runCli(["init"])).toBe(0);
    expect(fs.existsSync(path.join(tmp, "entries"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "index.db"))).toBe(true);
  });

  it("init is idempotent", async () => {
    await runCli(["init"]);
    expect(await runCli(["init"])).toBe(0);
  });

  it("reindex runs successfully on an empty store", async () => {
    await runCli(["init"]);
    expect(await runCli(["reindex"])).toBe(0);
  });

  it("version prints a non-empty line and exits 0", async () => {
    expect(await runCli(["version"])).toBe(0);
  });

  it("help returns 0", async () => {
    expect(await runCli(["help"])).toBe(0);
  });

  it("unknown command returns non-zero", async () => {
    expect(await runCli(["bogus"])).not.toBe(0);
  });

  it("no command returns non-zero", async () => {
    expect(await runCli([])).not.toBe(0);
  });

  it("search with no query returns non-zero", async () => {
    await runCli(["init"]);
    expect(await runCli(["search"])).not.toBe(0);
  });

  it("doctor runs and returns 0 on a fresh store", async () => {
    await runCli(["init"]);
    expect(await runCli(["doctor"])).toBe(0);
  });
});
