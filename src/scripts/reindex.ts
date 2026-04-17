import * as fs from "fs";
import { openDb } from "../lib/db";
import { listEntryIds, readEntry } from "../lib/entry-io";
import { upsertEntry } from "../lib/store";
import { dbPath } from "../lib/paths";
import { appendLog } from "../lib/log";

export function reindex(): { indexed: number; failed: string[] } {
  if (fs.existsSync(dbPath())) fs.rmSync(dbPath());
  const db = openDb();
  const failed: string[] = [];
  let indexed = 0;
  for (const id of listEntryIds()) {
    try {
      upsertEntry(db, readEntry(id));
      indexed++;
    } catch (err) {
      failed.push(`${id}: ${(err as Error).message}`);
    }
  }
  db.close();
  appendLog("reindex", { indexed, failed: failed.length });
  return { indexed, failed };
}

if (require.main === module) {
  const r = reindex();
  console.log(`indexed ${r.indexed} entries`);
  if (r.failed.length > 0) {
    console.error(`failed: ${r.failed.length}`);
    for (const line of r.failed) console.error(`  ${line}`);
    process.exit(1);
  }
}
