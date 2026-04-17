import * as fs from "fs";
import * as path from "path";
import { openDb } from "../lib/db";
import { deleteEntry, getEntry } from "../lib/store";
import { entriesDir } from "../lib/paths";
import { appendLog } from "../lib/log";

export async function forget(args: string[]): Promise<number> {
  const [id] = args;
  if (!id) {
    process.stderr.write("usage: zuun forget <id>\n");
    return 1;
  }
  const db = openDb();
  try {
    const entry = getEntry(db, id);
    if (!entry) {
      process.stderr.write(`forget: no entry with id ${id}\n`);
      return 1;
    }

    // Order matters: unlink the markdown file FIRST, then delete the DB row.
    // Rationale: if we crash between steps, "file first" is self-healing via reindex
    // (file missing → DB row will be dropped on next reindex). The reverse order
    // would resurrect the entry — DB row gone, file present → next reindex re-reads
    // the file and re-inserts the row. "Forget" must not be un-forgotten.
    const file = path.join(entriesDir(), `${id}.md`);
    if (fs.existsSync(file)) fs.rmSync(file);
    deleteEntry(db, id);

    appendLog("forget", { id });
    process.stdout.write(`forgot ${id}\n`);
    return 0;
  } finally {
    db.close();
  }
}
