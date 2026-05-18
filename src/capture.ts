import { openDb } from "./lib/db";
import { upsertEntry } from "./lib/store";
import { writeEntry } from "./lib/entry-io";
import { newEntryId } from "./lib/id";
import { defaultProvider } from "./lib/embed-provider";
import { setEmbedding } from "./lib/embed";
import { EntryKind, type Entry } from "./lib/entry";
import { normalizeTags } from "./lib/tags";
import { routeEntTokensFromTags, isShortDecisionNoTags } from "./lib/lints";
import { findRecentDuplicate } from "./lib/dedup";
import { resolveProject } from "./lib/project";
import { appendLog } from "./lib/log";

interface Opts {
  kind: Entry["kind"];
  tags: string[];
}

function parseArgs(argv: string[]): Opts {
  const opts: Opts = { kind: "observation", tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind") {
      const val = argv[++i] ?? "";
      opts.kind = EntryKind.parse(val);
    } else if (a === "--tag") {
      const val = argv[++i];
      if (val) opts.tags.push(val);
    }
  }
  return opts;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

export async function capture(argv: string[]): Promise<number> {
  let opts: Opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`capture: ${(err as Error).message}\n`);
    return 1;
  }
  const body = await readStdin();
  if (body.length === 0) {
    process.stderr.write("capture: no body on stdin\n");
    return 1;
  }

  const now = new Date();
  const db = openDb();
  try {
    const existing = findRecentDuplicate(db, body, now);
    if (existing) {
      process.stdout.write(`${existing}\n`);
      appendLog("capture.dedup", { id: existing });
      return 0;
    }
    // Lint on RAW tags before normalization: normalizeTags lowercases, but an
    // entry ID is uppercase-hex, so a polluting ENT token must be detected and
    // routed to related here or it becomes undetectable (ENT-260514-4BA0).
    const routing = routeEntTokensFromTags(opts.tags, []);
    if (routing.routed.length > 0) {
      process.stderr.write(
        `capture: moved entry id(s) from tags to related: ${routing.routed.join(", ")} ` +
          `(tags are for topics; related links entries)\n`,
      );
    }

    const id = newEntryId(body, now);
    const entry: Entry = {
      id,
      created: now.toISOString(),
      body,
      kind: opts.kind,
      source: "manual",
      tags: normalizeTags(routing.tags),
      related: routing.related,
      project: resolveProject(),
    };
    // short-decision-no-tags lint; provenance ENT-260514-75A3 (see lints.ts).
    if (isShortDecisionNoTags(entry)) {
      process.stderr.write(
        `capture: ${id} is a short decision with no tags — likely an accidental ` +
          `auto-capture; 'zuun forget ${id}' if it is not a durable choice\n`,
      );
    }
    writeEntry(entry);
    upsertEntry(db, entry);
    const vec = await defaultProvider.embed(body);
    if (vec) setEmbedding(db, id, vec);
    appendLog("capture", { id, kind: entry.kind, tags: entry.tags, project: entry.project });
    process.stdout.write(`${id}\n`);
    return 0;
  } finally {
    db.close();
  }
}
