import { openDb } from "../lib/db";
import { listEntries } from "../lib/store";
import { resolveProject } from "../lib/project";
import { appendLog } from "../lib/log";
import type { Entry, EntryKind } from "../lib/entry";

const MAX_CHARS = 2000;
const TOP_K = 3;

/**
 * SessionStart only surfaces high-signal kinds. Observations get skipped because
 * they're the noisy category — yesterday's debugging crumbs would drown out
 * today's planning session if we included them. Decisions, patterns, commitments,
 * and references are semantically stable across sessions and worth eager display.
 */
const HIGH_SIGNAL_KINDS: readonly EntryKind[] = ["decision", "pattern", "commitment", "reference"];

export interface HookInput {
  cwd: string;
}

function entryInProject(entry: Entry, project: string): boolean {
  const p = entry.project;
  // Entries with no project are global — included in every session's SessionStart.
  if (!p) return true;
  return p === project || p.startsWith(project + "/") || project.startsWith(p + "/");
}

function relAge(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export async function runSessionStart(input: HookInput): Promise<void> {
  try {
    const project = resolveProject(input.cwd);
    if (!project) {
      appendLog("session_start.miss", { cwd: input.cwd, reason: "no-project" });
      return;
    }

    const db = openDb();
    try {
      // listEntries returns sorted by created DESC. Filter by project + kind, then take TOP_K.
      const scoped = listEntries(db)
        .filter((e) => HIGH_SIGNAL_KINDS.includes(e.kind))
        .filter((e) => entryInProject(e, project))
        .slice(0, TOP_K);

      if (scoped.length === 0) {
        appendLog("session_start.miss", { project, reason: "no-entries" });
        return;
      }

      const now = Date.now();
      const lines: string[] = ["Prior relevant context from Zuun:\n\n"];
      for (const e of scoped) {
        const body = e.body.replace(/\n/g, " ");
        const age = relAge(now - new Date(e.created).getTime());
        lines.push(`- ${e.id} (${e.kind}, ${age}): ${body}\n`);
      }
      let text = lines.join("");
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS - 1) + "…";

      const payload = {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: text,
        },
      };
      process.stdout.write(JSON.stringify(payload));
      appendLog("session_start.inject", { project, hits: scoped.length, chars: text.length });
    } finally {
      db.close();
    }
  } catch (err) {
    appendLog("session_start.miss", { cwd: input.cwd, reason: "error", err: (err as Error).message });
    process.stderr.write(`zuun session-start hook: ${(err as Error).message}\n`);
  }
}
