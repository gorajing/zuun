import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { openDb } from "../lib/db";
import { readEntry } from "../lib/entry-io";
import { upsertEntry, getEntry } from "../lib/store";
import { entriesDir } from "../lib/paths";
import { appendLog } from "../lib/log";

export async function edit(args: string[]): Promise<number> {
  const [id] = args;
  if (!id) {
    process.stderr.write("usage: zuun edit <id>\n");
    return 1;
  }
  const db = openDb();
  try {
    if (!getEntry(db, id)) {
      process.stderr.write(`edit: no entry with id ${id}\n`);
      return 1;
    }
    const file = path.join(entriesDir(), `${id}.md`);
    if (!fs.existsSync(file)) {
      process.stderr.write(`edit: file missing on disk: ${file}\n`);
      return 1;
    }

    const editor = process.env.EDITOR ?? "vi";
    const result = spawnSync(editor, [file], { stdio: "inherit" });
    if (result.status !== 0) {
      process.stderr.write(`edit: editor exited with status ${result.status}\n`);
      return 1;
    }

    try {
      const parsed = readEntry(id);
      upsertEntry(db, parsed);
      appendLog("edit", { id });
      process.stdout.write(`updated ${id}\n`);
      return 0;
    } catch (err) {
      process.stderr.write(
        `edit: file fails schema after edit — db row left unchanged\n  ${(err as Error).message}\n`,
      );
      return 1;
    }
  } finally {
    db.close();
  }
}
