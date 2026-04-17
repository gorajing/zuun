import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry } from "./store";
import { setEmbedding, hasEmbedding, embedMissing } from "./embed";
import { EMBED_DIM, type EmbedProvider } from "./embed-provider";
import type { Entry } from "./entry";

describe("embed store", () => {
  let tmp: string;
  let db: Db;

  const fixture: Entry = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Local-first wins.",
    kind: "decision",
    source: "manual",
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-embed-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  function makeProvider(vec: number[] | null): EmbedProvider {
    return { embed: vi.fn().mockResolvedValue(vec) };
  }

  it("setEmbedding stores a vector and hasEmbedding reports true", () => {
    upsertEntry(db, fixture);
    setEmbedding(db, fixture.id, Array(EMBED_DIM).fill(0.1));
    expect(hasEmbedding(db, fixture.id)).toBe(true);
  });

  it("hasEmbedding is false for entries without vectors", () => {
    upsertEntry(db, fixture);
    expect(hasEmbedding(db, fixture.id)).toBe(false);
  });

  it("setEmbedding rejects wrong-dim vectors", () => {
    upsertEntry(db, fixture);
    expect(() => setEmbedding(db, fixture.id, Array(100).fill(0))).toThrowError(/dim/i);
  });

  it("embedMissing skips entries with existing embeddings", async () => {
    upsertEntry(db, fixture);
    setEmbedding(db, fixture.id, Array(EMBED_DIM).fill(0.1));
    const provider = makeProvider(Array(EMBED_DIM).fill(0.2));
    await embedMissing(db, provider);
    expect(provider.embed).not.toHaveBeenCalled();
  });

  it("embedMissing embeds unembedded entries", async () => {
    upsertEntry(db, fixture);
    const provider = makeProvider(Array(EMBED_DIM).fill(0.1));
    const r = await embedMissing(db, provider);
    expect(r.embedded).toBe(1);
    expect(hasEmbedding(db, fixture.id)).toBe(true);
  });

  it("embedMissing is a no-op when provider returns null", async () => {
    upsertEntry(db, fixture);
    const provider = makeProvider(null);
    const r = await embedMissing(db, provider);
    expect(r.embedded).toBe(0);
    expect(r.skipped).toBe(1);
    expect(hasEmbedding(db, fixture.id)).toBe(false);
  });

  it("embedMissing returns accurate counts across multiple entries", async () => {
    upsertEntry(db, fixture);
    upsertEntry(db, { ...fixture, id: "ENT-260416-BBBB" });
    upsertEntry(db, { ...fixture, id: "ENT-260416-CCCC" });
    const provider: EmbedProvider = {
      embed: vi
        .fn()
        .mockResolvedValueOnce(Array(EMBED_DIM).fill(0.1))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(Array(EMBED_DIM).fill(0.2)),
    };
    const r = await embedMissing(db, provider);
    expect(r.embedded).toBe(2);
    expect(r.skipped).toBe(1);
  });
});
