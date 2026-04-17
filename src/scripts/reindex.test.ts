import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { reindex } from "./reindex";
import { writeEntry } from "../lib/entry-io";
import { openDb } from "../lib/db";
import { getEntry } from "../lib/store";
import type { Entry } from "../lib/entry";

describe("reindex", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-reindex-"));
    process.env.ZUUN_HOME = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  const fixture: Entry = {
    id: "ENT-260416-AAAA",
    created: "2026-04-16T10:00:00.000Z",
    body: "A body to index.",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  it("indexes all entry files from scratch", () => {
    writeEntry(fixture);
    writeEntry({ ...fixture, id: "ENT-260416-BBBB" });
    const r = reindex();
    expect(r.indexed).toBe(2);
    expect(r.failed).toEqual([]);
  });

  it("rebuilds after db is deleted", () => {
    writeEntry(fixture);
    reindex();
    fs.rmSync(path.join(tmp, "index.db"));
    const r = reindex();
    expect(r.indexed).toBe(1);
    const db = openDb();
    expect(getEntry(db, fixture.id)?.body).toBe("A body to index.\n");
    db.close();
  });

  it("reports malformed files as failed without aborting", () => {
    writeEntry(fixture);
    const bogus = path.join(tmp, "entries", "ENT-260416-0000.md");
    fs.writeFileSync(bogus, "not valid frontmatter or entry");
    const r = reindex();
    expect(r.indexed).toBe(1);
    expect(r.failed.length).toBe(1);
    expect(r.failed[0]).toMatch(/ENT-260416-0000/);
  });

  it("is idempotent — re-running on a clean db produces the same result", () => {
    writeEntry(fixture);
    const first = reindex();
    const second = reindex();
    expect(second.indexed).toBe(first.indexed);
  });
});
