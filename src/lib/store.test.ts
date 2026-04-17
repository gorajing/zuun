import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry, deleteEntry, getEntry, listEntries } from "./store";
import type { Entry } from "./entry";

describe("store CRUD", () => {
  let tmp: string;
  let db: Db;

  const base: Entry = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Local-first wins on portability.",
    kind: "decision",
    source: "manual",
    tags: ["architecture"],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-store-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("upserts and reads back an entry", () => {
    upsertEntry(db, base);
    expect(getEntry(db, base.id)).toEqual(base);
  });

  it("upsert is idempotent (second call updates fields)", () => {
    upsertEntry(db, base);
    upsertEntry(db, { ...base, body: "updated body" });
    expect(getEntry(db, base.id)?.body).toBe("updated body");
  });

  it("upsert updates FTS on body change (no stale hits)", () => {
    upsertEntry(db, base);
    upsertEntry(db, { ...base, body: "completely different content" });
    const stale = db
      .prepare("SELECT id FROM entries_fts WHERE entries_fts MATCH 'portability'")
      .get();
    expect(stale).toBeUndefined();
    const fresh = db
      .prepare("SELECT id FROM entries_fts WHERE entries_fts MATCH 'completely'")
      .get() as { id: string } | undefined;
    expect(fresh?.id).toBe(base.id);
  });

  it("getEntry returns null for missing id", () => {
    expect(getEntry(db, "ENT-260416-0000")).toBeNull();
  });

  it("deleteEntry removes from entries, fts, and vec", () => {
    upsertEntry(db, base);
    deleteEntry(db, base.id);
    expect(getEntry(db, base.id)).toBeNull();
    const fts = db.prepare("SELECT id FROM entries_fts WHERE id = ?").get(base.id);
    expect(fts).toBeUndefined();
  });

  it("round-trips all optional fields including project", () => {
    const full: Entry = {
      ...base,
      tags: ["a", "b"],
      related: ["ENT-260401-ZZZZ"],
      stance: "Portability > convenience",
      confidence: "high",
      origin: "session:xyz",
      project: "/work/zuun",
    };
    upsertEntry(db, full);
    expect(getEntry(db, full.id)).toEqual(full);
  });

  it("listEntries returns all entries in created-desc order", () => {
    upsertEntry(db, { ...base, id: "ENT-260415-AAAA", created: "2026-04-15T10:00:00.000Z" });
    upsertEntry(db, { ...base, id: "ENT-260416-BBBB", created: "2026-04-16T10:00:00.000Z" });
    const ids = listEntries(db).map((e) => e.id);
    expect(ids).toEqual(["ENT-260416-BBBB", "ENT-260415-AAAA"]);
  });
});
