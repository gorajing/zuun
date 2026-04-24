import * as fs from "fs";
import { openDb } from "./lib/db";
import { entriesDir, storeRoot } from "./lib/paths";
import { reindex } from "./scripts/reindex";
import { embedMissing } from "./lib/embed";
import { defaultProvider } from "./lib/embed-provider";
import { search } from "./lib/search";
import { runDoctor } from "./lib/doctor";
import { appendLog } from "./lib/log";

// Kept in sync with package.json on release. If this drifts again, switch to
// a runtime read of package.json (deferred: avoiding rootDir + tsc complexity).
const VERSION = "0.1.1";

const HELP = `usage: zuun <command>

commands:
  init         create the store directory and index
  mcp          run the MCP server over stdio
  capture      read an entry body from stdin and save it
  search QRY   print top matches for QRY
  explain QRY  show per-component scores (fts/vec/recency) for top hits
  reindex      rebuild the sqlite index from markdown files
  embed        embed all entries missing vectors (requires Ollama)
  forget ID    delete an entry cleanly (disk + db)
  edit ID      open an entry in $EDITOR and re-validate on save
  install-git-hook  install a git post-commit hook in the current repo
  capture-commit    capture the latest git commit (invoked by the post-commit hook)
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
      await import("./mcp.js");
      // mcp.ts registers stdin handlers (StdioServerTransport) that keep the
      // process alive. Returning here would cause the outer
      // runCli(...).then(process.exit) to terminate the server before it
      // handles a single request. Hang forever; the MCP server's own lifecycle
      // (stdin EOF → process exits naturally) handles shutdown.
      return new Promise<number>(() => {});
    case "reindex":
      return cmdReindex();
    case "embed":
      return cmdEmbed();
    case "capture": {
      const { capture } = await import("./capture.js");
      return capture(rest);
    }
    case "search":
      return cmdSearch(rest);
    case "forget": {
      const { forget } = await import("./commands/forget.js");
      return forget(rest);
    }
    case "edit": {
      const { edit } = await import("./commands/edit.js");
      return edit(rest);
    }
    case "explain": {
      const { explain } = await import("./commands/explain.js");
      return explain(rest);
    }
    case "install-git-hook": {
      const { installGitHook } = await import("./commands/install-git-hook.js");
      return installGitHook(rest);
    }
    case "capture-commit": {
      const { captureCommit } = await import("./commands/capture-commit.js");
      return captureCommit(rest);
    }
    case "session-start": {
      const { runSessionStart } = await import("./hook-scripts/session-start.js");
      let raw = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) raw += chunk;
      let cwd = process.cwd();
      try {
        const parsed = JSON.parse(raw) as { cwd?: string };
        if (parsed.cwd) cwd = parsed.cwd;
      } catch {
        /* ignore */
      }
      await runSessionStart({ cwd });
      return 0;
    }
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

// Direct invocation via `tsx src/cli.ts ...` (e.g., from bin/zuun.js dev path):
// process.argv[1] points at cli.ts. Run the dispatcher.
if (process.argv[1] && process.argv[1].endsWith("cli.ts")) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
} else if (require.main === module) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
