import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { explain } from "./explain";
import { openDb } from "../lib/db";
import { upsertEntry } from "../lib/store";
import type { Entry } from "../lib/entry";

describe("explain", () => {
  let tmp: string;
  let stdout = "";
  const origWrite = process.stdout.write.bind(process.stdout);

  const fixture: Entry = {
    id: "ENT-260416-AAAA",
    created: "2026-04-16T10:00:00.000Z",
    body: "Local-first wins on portability.",
    kind: "decision",
    source: "manual",
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-explain-"));
    process.env.ZUUN_HOME = tmp;
    const db = openDb();
    upsertEntry(db, fixture);
    db.close();
    stdout = "";
    process.stdout.write = ((s: string) => {
      stdout += s;
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
    process.stdout.write = origWrite;
  });

  it("prints each hit with fts/vec/recency components and final score", async () => {
    expect(await explain(["portability"])).toBe(0);
    expect(stdout).toContain(fixture.id);
    expect(stdout).toMatch(/fts:\s*[\d.]+/);
    expect(stdout).toMatch(/vec:\s*[\d.]+/);
    expect(stdout).toMatch(/recency:\s*[\d.]+/);
    expect(stdout).toMatch(/score:\s*[\d.]+/);
  });

  it("requires a query", async () => {
    expect(await explain([])).not.toBe(0);
  });

  it("reports no matches when query is gibberish", async () => {
    expect(await explain(["zzqqxxttuu"])).toBe(0);
    expect(stdout).toMatch(/no results/i);
  });
});
