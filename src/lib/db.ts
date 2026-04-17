import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as fs from "fs";
import { dbPath, storeRoot } from "./paths";

export type Db = Database.Database;

export const SCHEMA_VERSION = 2;

const DDL_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS entries (
     id         TEXT PRIMARY KEY,
     body       TEXT NOT NULL,
     kind       TEXT NOT NULL,
     source     TEXT NOT NULL,
     created    TEXT NOT NULL,
     stance     TEXT,
     origin     TEXT,
     project    TEXT,
     tags       TEXT NOT NULL DEFAULT '[]',
     related    TEXT NOT NULL DEFAULT '[]',
     confidence TEXT
   )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
     id UNINDEXED,
     body,
     tokenize = "unicode61 tokenchars '_-'"
   )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS entries_vec USING vec0(
     id TEXT PRIMARY KEY,
     embedding FLOAT[768]
   )`,
];

export function openDb(): Db {
  fs.mkdirSync(storeRoot(), { recursive: true });
  const db = new Database(dbPath());
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  for (const sql of DDL_STATEMENTS) db.prepare(sql).run();

  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;

  if (!row) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION),
    );
    return db;
  }

  if (row.value !== String(SCHEMA_VERSION)) {
    db.close();
    throw new Error(
      `zuun: index schema_version is ${row.value}, code expects ${SCHEMA_VERSION}. ` +
        `Run 'zuun reindex' to rebuild the index from your markdown files.`,
    );
  }

  return db;
}
