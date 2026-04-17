import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, SCHEMA_VERSION } from "./db";

describe("openDb", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-db-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("creates the db file on first open", () => {
    openDb().close();
    expect(fs.existsSync(path.join(tmp, "index.db"))).toBe(true);
  });

  it("creates meta, entries, entries_fts, entries_vec", () => {
    const db = openDb();
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','virtual')")
      .all() as { name: string }[];
    const set = new Set(names.map((n) => n.name));
    expect(set.has("meta")).toBe(true);
    expect(set.has("entries")).toBe(true);
    expect(set.has("entries_fts")).toBe(true);
    expect(set.has("entries_vec")).toBe(true);
    db.close();
  });

  it("stamps meta.schema_version on first init", () => {
    const db = openDb();
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      | { value: string }
      | undefined;
    expect(row?.value).toBe(String(SCHEMA_VERSION));
    db.close();
  });

  it("is idempotent — opening twice does not error", () => {
    openDb().close();
    expect(() => openDb().close()).not.toThrow();
  });

  it("throws with a reindex hint on schema_version mismatch", () => {
    const db = openDb();
    db.prepare("UPDATE meta SET value = '999' WHERE key = 'schema_version'").run();
    db.close();
    expect(() => openDb()).toThrowError(/reindex/i);
  });

  it("FTS5 tokenizer keeps snake_case and kebab-case tokens whole", () => {
    const db = openDb();
    db.prepare(
      "INSERT INTO entries_fts (rowid, id, body) VALUES (1, 'X', 'new_entry_id and kebab-case')",
    ).run();
    // snake_case: underscore is a tokenchar, so the whole token indexes and matches.
    const hit = db
      .prepare("SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?")
      .get("new_entry_id") as { rowid: number } | undefined;
    expect(hit?.rowid).toBe(1);
    // kebab-case: FTS5 parses a bare `kebab-case` query as `kebab NOT case` (dash
    // is a boolean operator in query syntax, separate from tokenization). Wrap in
    // phrase quotes so the query is treated as an exact phrase.
    const kebab = db
      .prepare("SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?")
      .get('"kebab-case"') as { rowid: number } | undefined;
    expect(kebab?.rowid).toBe(1);
    // Also verify the tokenizer via the vocabulary — `kebab-case` indexed as one token.
    db.prepare("CREATE VIRTUAL TABLE IF NOT EXISTS v USING fts5vocab(entries_fts, 'row')").run();
    const vocab = db.prepare("SELECT term FROM v ORDER BY term").all() as { term: string }[];
    const terms = vocab.map((v) => v.term);
    expect(terms).toContain("kebab-case");
    expect(terms).toContain("new_entry_id");
    db.close();
  });
});
