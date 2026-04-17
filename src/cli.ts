import * as fs from "fs";
import { openDb } from "./lib/db";
import { entriesDir, storeRoot } from "./lib/paths";
import { reindex } from "./scripts/reindex";
import { embedMissing } from "./lib/embed";
import { defaultProvider } from "./lib/embed-provider";
import { search } from "./lib/search";
import { runDoctor } from "./lib/doctor";
import { appendLog } from "./lib/log";

const VERSION = "0.0.1";

const HELP = `usage: zuun <command>

commands:
  init         create the store directory and index
  mcp          run the MCP server over stdio
  capture      read an entry body from stdin and save it
  search QRY   print top matches for QRY
  reindex      rebuild the sqlite index from markdown files
  embed        embed all entries missing vectors (requires Ollama)
  doctor       health check: entries, db, ollama, broken refs
  version      print the zuun version
  help         show this message
`;

export async function runCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    process.stderr.write(HELP);
    return 1;
  }

  switch (cmd) {
    case "init":
      return cmdInit();
    case "mcp":
      await import("./mcp");
      return 0;
    case "reindex":
      return cmdReindex();
    case "embed":
      return cmdEmbed();
    case "capture": {
      const { capture } = await import("./capture");
      return capture(rest);
    }
    case "search":
      return cmdSearch(rest);
    case "doctor":
      return cmdDoctor();
    case "version":
      process.stdout.write(`zuun ${VERSION}\n`);
      return 0;
    case "help":
      process.stdout.write(HELP);
      return 0;
    default:
      process.stderr.write(`unknown command: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

function cmdInit(): number {
  fs.mkdirSync(entriesDir(), { recursive: true });
  openDb().close();
  appendLog("init", { root: storeRoot() });
  process.stdout.write(`initialized zuun store at ${storeRoot()}\n`);
  return 0;
}

function cmdReindex(): number {
  const r = reindex();
  process.stdout.write(`indexed ${r.indexed}, failed ${r.failed.length}\n`);
  for (const line of r.failed) process.stderr.write(`  ${line}\n`);
  return r.failed.length === 0 ? 0 : 1;
}

async function cmdEmbed(): Promise<number> {
  const db = openDb();
  try {
    const r = await embedMissing(db, defaultProvider);
    process.stdout.write(`embedded ${r.embedded}, skipped ${r.skipped}\n`);
    return 0;
  } finally {
    db.close();
  }
}

async function cmdSearch(args: string[]): Promise<number> {
  const query = args.join(" ");
  if (!query) {
    process.stderr.write("usage: zuun search <query>\n");
    return 1;
  }
  const db = openDb();
  try {
    const qVec = await defaultProvider.embed(query);
    const results = search(db, { query, queryVec: qVec ?? undefined, limit: 10 });
    if (results.length === 0) {
      process.stdout.write("(no results)\n");
      return 0;
    }
    for (const r of results) {
      process.stdout.write(
        `${r.entry.id} · ${r.entry.kind} · ${r.entry.created}\n  ${r.entry.body.replace(/\n/g, " ")}\n\n`,
      );
    }
    return 0;
  } finally {
    db.close();
  }
}

async function cmdDoctor(): Promise<number> {
  const report = await runDoctor();
  process.stdout.write(report.text);
  return report.healthy ? 0 : 1;
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
