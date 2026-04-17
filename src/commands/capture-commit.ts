import { execFileSync } from "child_process";
import { openDb } from "../lib/db";
import { upsertEntry } from "../lib/store";
import { writeEntry } from "../lib/entry-io";
import { newEntryId } from "../lib/id";
import { normalizeTags } from "../lib/tags";
import { findRecentDuplicate } from "../lib/dedup";
import { appendLog } from "../lib/log";
import type { Entry, EntryKind } from "../lib/entry";

function kindFromMessage(msg: string): EntryKind {
  const prefix = msg.trim().split(/[:(\s]/, 1)[0]?.toLowerCase() ?? "";
  if (prefix === "feat") return "pattern";
  if (prefix === "fix") return "observation";
  if (prefix === "chore" || prefix === "refactor") return "decision";
  if (prefix === "docs" || prefix === "test") return "reference";
  return "observation";
}

function gitSafe(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export async function captureCommit(_args: string[]): Promise<number> {
  const sha = gitSafe(["rev-parse", "HEAD"]);
  if (!sha) return 0;
  const msg = gitSafe(["log", "-1", "--pretty=%B"]) ?? "";
  if (msg.trim().length === 0) return 0;
  const branch = gitSafe(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "unknown";
  const files = gitSafe(["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha]) ?? "";
  const repoRoot = gitSafe(["rev-parse", "--show-toplevel"]);

  const body = `${msg.trim()}\n\nFiles changed:\n${files}`;
  const now = new Date();

  const db = openDb();
  try {
    const existing = findRecentDuplicate(db, body, now);
    if (existing) {
      appendLog("capture_commit.dedup", { sha, id: existing });
      return 0;
    }
    const id = newEntryId(body, now);
    const entry: Entry = {
      id,
      created: now.toISOString(),
      body,
      kind: kindFromMessage(msg),
      source: "git",
      tags: normalizeTags([branch]),
      related: [],
      origin: sha,
      project: repoRoot ?? undefined,
    };
    writeEntry(entry);
    upsertEntry(db, entry);
    appendLog("capture_commit", { id, sha, kind: entry.kind, project: entry.project });
    process.stdout.write(`${id}\n`);
    return 0;
  } finally {
    db.close();
  }
}
