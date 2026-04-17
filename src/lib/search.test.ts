import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry } from "./store";
import { setEmbedding } from "./embed";
import { search } from "./search";
import { EMBED_DIM } from "./embed-provider";
import type { Entry } from "./entry";

describe("search", () => {
  let tmp: string;
  let db: Db;

  const base: Omit<Entry, "id" | "body"> = {
    created: "2026-04-16T14:22:00.000Z",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  const a: Entry = { ...base, id: "ENT-260416-AAAA", body: "Local-first architecture enables portability." };
  const b: Entry = { ...base, id: "ENT-260416-BBBB", body: "Cloud deployments scale horizontally with ease." };
  const c: Entry = { ...base, id: "ENT-260416-CCCC", body: "Portability means your data travels with you." };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-search-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
    upsertEntry(db, a);
    upsertEntry(db, b);
    upsertEntry(db, c);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("returns FTS matches when no query vector is given", () => {
    const ids = search(db, { query: "portability" }).map((r) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
  });

  it("ranks exact lexical matches near the top", () => {
    const r = search(db, { query: "portability" });
    expect([a.id, c.id]).toContain(r[0]?.id);
  });

  it("respects the limit parameter", () => {
    expect(search(db, { query: "the", limit: 1 }).length).toBeLessThanOrEqual(1);
  });

  it("returns [] for a gibberish query with no vector", () => {
    expect(search(db, { query: "zzqqxxtt" })).toEqual([]);
  });

  it("returns [] for empty query", () => {
    expect(search(db, { query: "" })).toEqual([]);
  });

  it("blends vector scores when query vector is provided", () => {
    const qVec = Array(EMBED_DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0));
    setEmbedding(db, b.id, qVec);
    setEmbedding(db, a.id, Array(EMBED_DIM).fill(0).map((_, i) => (i === 1 ? 1 : 0)));
    const ids = search(db, { query: "unrelated text zzqq", queryVec: qVec, limit: 5 }).map((r) => r.id);
    expect(ids).toContain(b.id);
  });

  it("is robust to FTS-special characters in queries", () => {
    expect(() => search(db, { query: 'what about "quotes" and *stars* AND boolean' })).not.toThrow();
  });

  it("results carry id, score, and entry together", () => {
    const [first] = search(db, { query: "portability", limit: 1 });
    expect(first?.id).toBeDefined();
    expect(typeof first?.score).toBe("number");
    expect(first?.entry.body).toMatch(/[Pp]ortability/);
  });

  it("recency bias breaks ties toward newer entries", () => {
    const old: Entry = { ...base, id: "ENT-250101-0AD0", body: "portability note", created: "2025-01-01T00:00:00.000Z" };
    const fresh: Entry = { ...base, id: "ENT-260416-DEAD", body: "portability note", created: "2026-04-16T00:00:00.000Z" };
    upsertEntry(db, old);
    upsertEntry(db, fresh);
    const [first] = search(db, { query: "portability note", limit: 1 });
    expect(first?.id).toBe(fresh.id);
  });

  it("respects the kind filter", () => {
    const dec: Entry = { ...base, id: "ENT-260416-DEC0", body: "portable decision", kind: "decision" };
    upsertEntry(db, dec);
    const ids = search(db, { query: "portable", kind: "decision" }).map((r) => r.id);
    expect(ids).toEqual([dec.id]);
  });

  it("respects AND-semantics on the tags filter", () => {
    const hit: Entry = { ...base, id: "ENT-260416-BEEF", body: "portable tagged", tags: ["arch", "v0"] };
    const miss: Entry = { ...base, id: "ENT-260416-CAFE", body: "portable tagged", tags: ["arch"] };
    upsertEntry(db, hit);
    upsertEntry(db, miss);
    const ids = search(db, { query: "portable", tags: ["arch", "v0"] }).map((r) => r.id);
    expect(ids).toEqual([hit.id]);
  });

  it("respects the since filter", () => {
    const old: Entry = { ...base, id: "ENT-250101-0AD1", body: "portable past", created: "2025-01-01T00:00:00.000Z" };
    upsertEntry(db, old);
    const ids = search(db, { query: "portable past", since: "2026-01-01T00:00:00.000Z" }).map((r) => r.id);
    expect(ids).not.toContain(old.id);
  });

  it("respects the project filter with prefix semantics", () => {
    const acme: Entry = { ...base, id: "ENT-260416-AC01", body: "portable acme note", project: "/work/acme" };
    const other: Entry = { ...base, id: "ENT-260416-BB01", body: "portable other note", project: "/work/other" };
    upsertEntry(db, acme);
    upsertEntry(db, other);

    let ids = search(db, { query: "portable note", project: "/work/acme" }).map((r) => r.id);
    expect(ids).toContain(acme.id);
    expect(ids).not.toContain(other.id);

    ids = search(db, { query: "portable note", project: "/work/acme/api/src" }).map((r) => r.id);
    expect(ids).toContain(acme.id);

    ids = search(db, { query: "portable note", project: "/work" }).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([acme.id, other.id]));
  });

  it("entries with no project are global — included under every project filter", () => {
    const global: Entry = { ...base, id: "ENT-260416-0CA0", body: "portable global insight" };
    const acme: Entry = { ...base, id: "ENT-260416-AC02", body: "portable acme note", project: "/work/acme" };
    upsertEntry(db, global);
    upsertEntry(db, acme);

    let ids = search(db, { query: "portable", project: "/work/acme" }).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([global.id, acme.id]));

    ids = search(db, { query: "portable", project: "/work/other" }).map((r) => r.id);
    expect(ids).toContain(global.id);
    expect(ids).not.toContain(acme.id);
  });

  it("respects ZUUN_SEARCH_BLEND env override", () => {
    process.env.ZUUN_SEARCH_BLEND = "1,0,0"; // FTS only
    const qVec = Array(EMBED_DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0));
    setEmbedding(db, b.id, qVec);
    const [first] = search(db, { query: "portability", queryVec: qVec, limit: 1 });
    expect([a.id, c.id]).toContain(first?.id); // not b
    delete process.env.ZUUN_SEARCH_BLEND;
  });
});
