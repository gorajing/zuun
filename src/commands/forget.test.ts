import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { forget } from "./forget";
import { writeEntry } from "../lib/entry-io";
import { openDb } from "../lib/db";
import { upsertEntry, getEntry } from "../lib/store";
import type { Entry } from "../lib/entry";

describe("forget", () => {
  let tmp: string;
  const fixture: Entry = {
    id: "ENT-260416-AAAA",
    created: "2026-04-16T10:00:00.000Z",
    body: "body",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-forget-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("removes the entry from disk and db", async () => {
    writeEntry(fixture);
    const db = openDb();
    upsertEntry(db, fixture);
    db.close();

    expect(await forget([fixture.id])).toBe(0);
    expect(fs.existsSync(path.join(tmp, "entries", `${fixture.id}.md`))).toBe(false);
    const db2 = openDb();
    expect(getEntry(db2, fixture.id)).toBeNull();
    db2.close();
  });

  it("exits non-zero on unknown id", async () => {
    expect(await forget(["ENT-260416-FFFF"])).not.toBe(0);
  });

  it("requires an id argument", async () => {
    expect(await forget([])).not.toBe(0);
  });

  it("removes the file before the db row (crash-safe: reindex doesn't resurrect)", async () => {
    writeEntry(fixture);
    const db1 = openDb();
    upsertEntry(db1, fixture);
    db1.close();

    fs.rmSync(path.join(tmp, "entries", `${fixture.id}.md`));

    const { reindex } = await import("../scripts/reindex");
    const r = reindex();
    expect(r.indexed).toBe(0);

    const db2 = openDb();
    expect(getEntry(db2, fixture.id)).toBeNull();
    db2.close();
  });
});
