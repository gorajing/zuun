import * as crypto from "crypto";
import type { Db } from "./db";

export function bodyHash(body: string): string {
  return crypto.createHash("sha256").update(body.trim()).digest("hex");
}

export function findRecentDuplicate(
  db: Db,
  body: string,
  now: Date,
  windowMinutes = 10,
): string | null {
  const cutoff = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
  const target = bodyHash(body);
  const rows = db
    .prepare("SELECT id, body FROM entries WHERE created >= ? ORDER BY created DESC")
    .all(cutoff) as { id: string; body: string }[];
  for (const row of rows) {
    if (bodyHash(row.body) === target) return row.id;
  }
  return null;
}
