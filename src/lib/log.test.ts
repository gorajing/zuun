import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { appendLog, tailLog } from "./log";

describe("log", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-log-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("appends one JSON line per call", () => {
    appendLog("remember", { id: "ENT-260416-AAAA" });
    appendLog("search", { query: "portability", hits: 2 });
    const raw = fs.readFileSync(path.join(tmp, "log.jsonl"), "utf8");
    const lines = raw.trim().split("\n");
    expect(lines.length).toBe(2);
    const first = JSON.parse(lines[0]!);
    expect(first.event).toBe("remember");
    expect(first.payload.id).toBe("ENT-260416-AAAA");
    expect(typeof first.at).toBe("string");
  });

  it("creates the store dir if missing", () => {
    appendLog("init", {});
    expect(fs.existsSync(path.join(tmp, "log.jsonl"))).toBe(true);
  });

  it("tailLog returns the last N lines parsed as JSON", () => {
    for (let i = 0; i < 5; i++) appendLog("x", { n: i });
    const tail = tailLog(3);
    expect(tail.length).toBe(3);
    expect(tail.map((l) => l.payload.n)).toEqual([2, 3, 4]);
  });

  it("tailLog returns [] when log is absent", () => {
    expect(tailLog(10)).toEqual([]);
  });

  it("never throws on I/O failure", () => {
    process.env.ZUUN_HOME = "/this/path/should/not/exist/and/isnt/writable";
    expect(() => appendLog("x", {})).not.toThrow();
  });
});
