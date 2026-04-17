import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry } from "./store";
import { findRecentDuplicate, bodyHash } from "./dedup";
import type { Entry } from "./entry";

describe("dedup", () => {
  let tmp: string;
  let db: Db;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-dedup-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  const mkEntry = (id: string, body: string, createdISO: string): Entry => ({
    id,
    created: createdISO,
    body,
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  });

  it("bodyHash is stable and ignores leading/trailing whitespace", () => {
    expect(bodyHash("hello world")).toBe(bodyHash("  hello world\n"));
  });

  it("returns null when no duplicate exists", () => {
    expect(findRecentDuplicate(db, "fresh body", new Date())).toBeNull();
  });

  it("returns the existing id when a same-body entry is within the window", () => {
    const now = new Date("2026-04-16T12:00:00Z");
    const recent = new Date("2026-04-16T11:55:00Z").toISOString();
    upsertEntry(db, mkEntry("ENT-260416-AAAA", "duplicate body", recent));
    expect(findRecentDuplicate(db, "duplicate body", now)).toBe("ENT-260416-AAAA");
  });

  it("ignores entries outside the window", () => {
    const now = new Date("2026-04-16T12:00:00Z");
    const old = new Date("2026-04-16T11:00:00Z").toISOString();
    upsertEntry(db, mkEntry("ENT-260416-AAAA", "duplicate body", old));
    expect(findRecentDuplicate(db, "duplicate body", now)).toBeNull();
  });

  it("honors a custom window", () => {
    const now = new Date("2026-04-16T12:00:00Z");
    const min30 = new Date("2026-04-16T11:30:00Z").toISOString();
    upsertEntry(db, mkEntry("ENT-260416-AAAA", "body", min30));
    expect(findRecentDuplicate(db, "body", now, 60)).toBe("ENT-260416-AAAA");
    expect(findRecentDuplicate(db, "body", now, 10)).toBeNull();
  });
});
