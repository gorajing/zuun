import { describe, it, expect, afterEach } from "vitest";
import { storeRoot, entriesDir, dbPath, logPath } from "./paths";
import * as os from "os";
import * as path from "path";

describe("paths", () => {
  const original = process.env.ZUUN_HOME;
  afterEach(() => {
    if (original === undefined) delete process.env.ZUUN_HOME;
    else process.env.ZUUN_HOME = original;
  });

  it("defaults to ~/.zuun when ZUUN_HOME is unset", () => {
    delete process.env.ZUUN_HOME;
    expect(storeRoot()).toBe(path.join(os.homedir(), ".zuun"));
  });

  it("honors ZUUN_HOME override", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(storeRoot()).toBe("/tmp/zuun-test");
  });

  it("entriesDir is <root>/entries", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(entriesDir()).toBe("/tmp/zuun-test/entries");
  });

  it("dbPath is <root>/index.db", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(dbPath()).toBe("/tmp/zuun-test/index.db");
  });

  it("logPath is <root>/log.jsonl", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(logPath()).toBe("/tmp/zuun-test/log.jsonl");
  });
});
