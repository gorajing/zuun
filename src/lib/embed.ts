import type { Db } from "./db";
import { EMBED_DIM, type EmbedProvider } from "./embed-provider";

export function setEmbedding(db: Db, id: string, vec: number[]): void {
  if (vec.length !== EMBED_DIM) {
    throw new Error(`embed: expected ${EMBED_DIM}-dim, got ${vec.length}`);
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM entries_vec WHERE id = ?").run(id);
    db.prepare("INSERT INTO entries_vec (id, embedding) VALUES (?, ?)").run(
      id,
      new Float32Array(vec),
    );
  });
  tx();
}

export function hasEmbedding(db: Db, id: string): boolean {
  return db.prepare("SELECT 1 FROM entries_vec WHERE id = ?").get(id) !== undefined;
}

export async function embedMissing(
  db: Db,
  provider: EmbedProvider,
): Promise<{ embedded: number; skipped: number }> {
  const rows = db
    .prepare(
      "SELECT e.id, e.body FROM entries e LEFT JOIN entries_vec v ON v.id = e.id WHERE v.id IS NULL",
    )
    .all() as { id: string; body: string }[];

  let embedded = 0;
  let skipped = 0;
  for (const row of rows) {
    const vec = await provider.embed(row.body);
    if (vec === null) {
      skipped++;
      continue;
    }
    setEmbedding(db, row.id, vec);
    embedded++;
  }
  return { embedded, skipped };
}
