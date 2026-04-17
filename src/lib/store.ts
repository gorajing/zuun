import type { Db } from "./db";
import { EntrySchema, type Entry } from "./entry";

function rowToEntry(row: Record<string, unknown>): Entry {
  return EntrySchema.parse({
    ...row,
    tags: JSON.parse(row.tags as string),
    related: JSON.parse(row.related as string),
    stance: row.stance ?? undefined,
    origin: row.origin ?? undefined,
    project: row.project ?? undefined,
    confidence: row.confidence ?? undefined,
  });
}

export function upsertEntry(db: Db, entry: Entry): void {
  EntrySchema.parse(entry);
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO entries (id, body, kind, source, created, stance, origin, project, tags, related, confidence)
       VALUES (@id, @body, @kind, @source, @created, @stance, @origin, @project, @tags, @related, @confidence)
       ON CONFLICT(id) DO UPDATE SET
         body=excluded.body, kind=excluded.kind, source=excluded.source,
         created=excluded.created, stance=excluded.stance, origin=excluded.origin,
         project=excluded.project,
         tags=excluded.tags, related=excluded.related, confidence=excluded.confidence`,
    ).run({
      id: entry.id,
      body: entry.body,
      kind: entry.kind,
      source: entry.source,
      created: entry.created,
      stance: entry.stance ?? null,
      origin: entry.origin ?? null,
      project: entry.project ?? null,
      tags: JSON.stringify(entry.tags),
      related: JSON.stringify(entry.related),
      confidence: entry.confidence ?? null,
    });
    // Regular-content FTS5 supports plain DELETE + INSERT.
    db.prepare("DELETE FROM entries_fts WHERE id = ?").run(entry.id);
    db.prepare("INSERT INTO entries_fts (id, body) VALUES (?, ?)").run(entry.id, entry.body);
  });
  tx();
}

export function deleteEntry(db: Db, id: string): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM entries WHERE id = ?").run(id);
    db.prepare("DELETE FROM entries_fts WHERE id = ?").run(id);
    db.prepare("DELETE FROM entries_vec WHERE id = ?").run(id);
  });
  tx();
}

export function getEntry(db: Db, id: string): Entry | null {
  const row = db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToEntry(row) : null;
}

export function listEntries(db: Db): Entry[] {
  const rows = db
    .prepare("SELECT * FROM entries ORDER BY created DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToEntry);
}
