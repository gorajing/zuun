import type { Db } from "./db";
import { getEntry } from "./store";
import type { Entry, EntryKind } from "./entry";

export interface SearchOptions {
  query: string;
  queryVec?: number[];
  limit?: number;
  kind?: EntryKind;
  tags?: string[];
  since?: string;
  project?: string;
}

export interface SearchResult {
  id: string;
  score: number;
  entry: Entry;
  parts: { fts: number; vec: number; recency: number };
}

interface Weights {
  fts: number;
  vec: number;
  recency: number;
}

export function parseWeights(raw: string | undefined): Weights {
  const def = { fts: 0.45, vec: 0.45, recency: 0.1 };
  if (!raw) return def;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return def;
  const sum = parts[0]! + parts[1]! + parts[2]!;
  if (sum <= 0) return def;
  return { fts: parts[0]! / sum, vec: parts[1]! / sum, recency: parts[2]! / sum };
}

function sanitizeFts(q: string): string {
  return q
    .replace(/["*]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, "")}"`)
    .join(" OR ");
}

function minMax(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) return scores;
  const values = [...scores.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    const uniform = new Map<string, number>();
    for (const k of scores.keys()) uniform.set(k, 1);
    return uniform;
  }
  const out = new Map<string, number>();
  for (const [k, v] of scores) out.set(k, (v - min) / (max - min));
  return out;
}

function recencyScore(createdIso: string, now: number): number {
  const ageMs = now - new Date(createdIso).getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return Math.exp(-ageDays / 30);
}

function passesFilters(entry: Entry, opts: SearchOptions): boolean {
  if (opts.kind && entry.kind !== opts.kind) return false;
  if (opts.since && entry.created < opts.since) return false;
  if (opts.tags && opts.tags.length > 0) {
    const have = new Set(entry.tags);
    for (const t of opts.tags) if (!have.has(t)) return false;
  }
  if (opts.project) {
    const p = entry.project;
    if (p) {
      if (!(p === opts.project || p.startsWith(opts.project + "/") || opts.project.startsWith(p + "/"))) {
        return false;
      }
    }
  }
  return true;
}

export function search(db: Db, opts: SearchOptions): SearchResult[] {
  const limit = opts.limit ?? 10;
  if (opts.query.trim().length === 0) return [];

  const envWeights = parseWeights(process.env.ZUUN_SEARCH_BLEND);
  const weights: Weights = opts.queryVec
    ? envWeights
    : { fts: envWeights.fts + envWeights.vec, vec: 0, recency: envWeights.recency };

  const ftsQuery = sanitizeFts(opts.query);
  const ftsScores = new Map<string, number>();
  if (ftsQuery.length > 0) {
    try {
      const rows = db
        .prepare(
          "SELECT id, bm25(entries_fts) AS score FROM entries_fts WHERE entries_fts MATCH ? ORDER BY score LIMIT ?",
        )
        .all(ftsQuery, limit * 8) as { id: string; score: number }[];
      for (const r of rows) ftsScores.set(r.id, -r.score);
    } catch {
      // fall through
    }
  }

  const vecScores = new Map<string, number>();
  if (opts.queryVec) {
    const rows = db
      .prepare(
        "SELECT id, distance FROM entries_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance",
      )
      .all(new Float32Array(opts.queryVec), limit * 8) as { id: string; distance: number }[];
    for (const r of rows) vecScores.set(r.id, 1 - r.distance);
  }

  const normFts = minMax(ftsScores);
  const normVec = minMax(vecScores);
  const candidateIds = new Set<string>([...normFts.keys(), ...normVec.keys()]);

  const now = Date.now();
  const scored: { id: string; score: number; parts: SearchResult["parts"]; entry: Entry }[] = [];
  for (const id of candidateIds) {
    const entry = getEntry(db, id);
    if (!entry || !passesFilters(entry, opts)) continue;
    const f = normFts.get(id) ?? 0;
    const v = normVec.get(id) ?? 0;
    const r = recencyScore(entry.created, now);
    const score = weights.fts * f + weights.vec * v + weights.recency * r;
    scored.push({ id, score, parts: { fts: f, vec: v, recency: r }, entry });
  }
  scored.sort((x, y) => y.score - x.score);

  return scored.slice(0, limit).map((s) => ({
    id: s.id,
    score: s.score,
    entry: s.entry,
    parts: s.parts,
  }));
}
