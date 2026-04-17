import { openDb } from "../lib/db";
import { search } from "../lib/search";
import { defaultProvider } from "../lib/embed-provider";

export async function explain(args: string[]): Promise<number> {
  const query = args.join(" ");
  if (!query) {
    process.stderr.write("usage: zuun explain <query>\n");
    return 1;
  }
  const db = openDb();
  try {
    const qVec = await defaultProvider.embed(query);
    const results = search(db, { query, queryVec: qVec ?? undefined, limit: 10 });
    if (results.length === 0) {
      process.stdout.write("no results\n");
      return 0;
    }
    for (const r of results) {
      process.stdout.write(
        `${r.entry.id} · ${r.entry.kind} · ${r.entry.created}\n` +
          `  fts: ${r.parts.fts.toFixed(3)}  vec: ${r.parts.vec.toFixed(3)}  recency: ${r.parts.recency.toFixed(3)}  →  score: ${r.score.toFixed(3)}\n` +
          `  ${r.entry.body.replace(/\n/g, " ")}\n\n`,
      );
    }
    return 0;
  } finally {
    db.close();
  }
}
