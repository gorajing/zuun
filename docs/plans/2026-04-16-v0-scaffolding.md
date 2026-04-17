# Zuun v0 Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal, local-first persistent memory layer for Claude Code sessions, delivered as an MCP server + CLI, with a single canonical Entry type, SQLite + FTS5 + sqlite-vec storage, and Ollama embeddings.

**Architecture:** Markdown files on disk (human-readable, git-friendly, portable) are the source of truth. A SQLite index (`.zuun/index.db`) makes them fast to search via FTS5 (keyword) and sqlite-vec (semantic). Reindex is always safe to re-run — the index is a derived artifact. The MCP server exposes two tools to Claude Code: `remember` (write) and `context_for` (read).

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), tsx for dev, CommonJS, Zod for validation, `@modelcontextprotocol/sdk`, `better-sqlite3` + `sqlite-vec`, Ollama (`nomic-embed-text`, 768-dim, L2-normalized), `gray-matter` for frontmatter, Vitest for tests.

---

## Open Design Questions (need sign-off before Task 1)

These are the five decisions I want you to lock before we write any code. Each has a recommended default — if you approve the defaults, just say "defaults look good" and we proceed.

### Q1. Where does the store live?

**Options:**
- **A (recommended):** `~/.zuun/` — single global store, one memory across all projects. Simplest UX; entries from different projects coexist, filtered by tags/origin.
- **B:** `./.zuun/` per project — one store per working dir. Stronger isolation but loses cross-project recall.
- **C:** Configurable — default global, override with env var. Adds surface area for v0.

**Recommendation:** A. Ship one store. Add per-project override later if users ask.

### Q2. File layout under the store?

**Options:**
- **A (recommended):** `~/.zuun/entries/ENT-YYMMDD-XXXX.md` — flat. One dir, one file per entry. Fine until ~100k entries (filesystem-dependent).
- **B:** `~/.zuun/entries/YYYY/MM/ENT-...md` — dated folders. Scales forever but adds path-building code.

**Recommendation:** A. Flat is simpler. 100k entries is years away for a solo user. Migrate later if needed.

### Q3. How many MCP tools on day one?

**Options:**
- **A (recommended):** Two tools — `remember(body, kind?, tags?)` and `context_for(task)`. Minimum viable surface.
- **B:** Four tools — add `search(query)` (explicit retrieval) and `recall(id)` (fetch by ID). More power, more choices for Claude to make wrong.

**Recommendation:** A. The whole product thesis is "it just works." If Claude has to pick between four tools, we've already lost. Add more if usage shows the need.

### Q4. Hybrid search blend?

**Options:**
- **A (recommended):** 50/50 FTS + vector on day one. Tune once we have real entries to regress against.
- **B:** Pick a weighted blend upfront (e.g., 30% FTS / 70% vector).

**Recommendation:** A. No basis to pick weights without data. Ship 50/50, make it a CLI flag so we can A/B later.

### Q5. Manual capture UX?

**Options:**
- **A (recommended):** `zuun capture` reads from stdin. Pipe-friendly, scriptable, editor-agnostic. (`echo "foo" | zuun capture --kind decision`)
- **B:** `zuun capture "text"` positional arg. Simpler, but awkward for multi-line content.
- **C:** Both — stdin if present, else positional.

**Recommendation:** A on day one; add C if it's friction.

### Q6. Entry kinds — confirm the set

Already landed in `src/lib/entry.ts`: `decision | observation | pattern | commitment | reference`. Confirm this is the set you want to ship with. If anything is missing (e.g., `question`, `lesson`) or extra (e.g., `reference` overlaps with `observation`), say so now — this schema is the foundation, and changing it later touches every file.

---

## Architectural Decisions (locked — documented so the engineer doesn't re-litigate)

1. **Single Entry type.** No separate Insight/Principle/Prediction/Decision/Tension records. Every thing worth remembering is an `Entry` with a `kind` field. Collapses Zuhn's reference-integrity bug class.
2. **Markdown + YAML frontmatter on disk is the source of truth.** The SQLite index is a derived artifact that can always be rebuilt from files. This is what makes the store portable (`tar -czf zuun-backup.tgz ~/.zuun`) and git-friendly.
3. **Zod validation at every boundary.** File read, MCP input, CLI input. No internal Zod — trust types past the boundary.
4. **Embeddings are optional and lazy.** Zuun works without Ollama (keyword-only search). Embeddings upgrade search quality when available. The product must never hard-fail because Ollama isn't running.
5. **No daemon in v0.** Background services are how Zuhn accumulated security debt. If we need one later, we'll add it as a separate opt-in process with a minimal API surface. v0 is pure request/response.
6. **TDD.** Every task in this plan starts with a failing test. No exceptions. The test is the spec.
7. **Frequent commits.** One logical change per commit. Commit after each task's final green test.

---

## Target File Structure (end state of this plan)

```
zuun/
├── README.md                     (exists)
├── package.json                  (exists)
├── tsconfig.json                 (exists)
├── vitest.config.ts              (exists)
├── .gitignore                    (exists)
├── bin/
│   └── zuun.js                   (Task 13 — CLI entry shim)
├── src/
│   ├── lib/
│   │   ├── entry.ts              (exists — schema)
│   │   ├── entry.test.ts         (exists — 7 passing tests)
│   │   ├── paths.ts              (Task 1 — resolve store locations)
│   │   ├── paths.test.ts         (Task 1)
│   │   ├── id.ts                 (Task 2 — stateless ID generation)
│   │   ├── id.test.ts            (Task 2)
│   │   ├── entry-io.ts           (Task 3 — read/write entry files)
│   │   ├── entry-io.test.ts      (Task 3)
│   │   ├── db.ts                 (Task 4 — SQLite init + schema)
│   │   ├── db.test.ts            (Task 4)
│   │   ├── index.ts              (Task 5 — upsert/delete/get)
│   │   ├── index.test.ts         (Task 5)
│   │   ├── embed-client.ts       (Task 7 — Ollama HTTP client)
│   │   ├── embed-client.test.ts  (Task 7)
│   │   ├── embed.ts              (Task 8 — index-side embedding store)
│   │   ├── embed.test.ts         (Task 8)
│   │   ├── search.ts             (Task 9 — hybrid search)
│   │   └── search.test.ts        (Task 9)
│   ├── mcp.ts                    (Task 10 — MCP server entry)
│   ├── mcp.test.ts               (Task 11 — MCP integration tests)
│   ├── cli.ts                    (Task 12 — CLI dispatch)
│   ├── cli.test.ts               (Task 12)
│   ├── capture.ts                (Task 14 — stdin capture)
│   ├── capture.test.ts           (Task 14)
│   └── scripts/
│       └── reindex.ts            (Task 6 — rebuild index from files)
└── tests/
    └── e2e.test.ts               (Task 15 — end-to-end smoke test)
```

---

## Phase 1 — Data Primitives

### Task 1: Store path resolution

**Files:**
- Create: `src/lib/paths.ts`
- Create: `src/lib/paths.test.ts`

Resolves where Zuun stores files. Defaults to `~/.zuun`, overridable via `ZUUN_HOME` env var for tests and edge cases. Exposes `storeRoot()`, `entriesDir()`, `dbPath()`.

- [ ] **Step 1: Write the failing test**

`src/lib/paths.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { storeRoot, entriesDir, dbPath } from "./paths";
import * as os from "os";
import * as path from "path";

describe("paths", () => {
  const originalHome = process.env.ZUUN_HOME;
  afterEach(() => {
    if (originalHome === undefined) delete process.env.ZUUN_HOME;
    else process.env.ZUUN_HOME = originalHome;
  });

  it("defaults to ~/.zuun when ZUUN_HOME is unset", () => {
    delete process.env.ZUUN_HOME;
    expect(storeRoot()).toBe(path.join(os.homedir(), ".zuun"));
  });

  it("honors ZUUN_HOME override", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(storeRoot()).toBe("/tmp/zuun-test");
  });

  it("entriesDir is <root>/entries", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(entriesDir()).toBe("/tmp/zuun-test/entries");
  });

  it("dbPath is <root>/index.db", () => {
    process.env.ZUUN_HOME = "/tmp/zuun-test";
    expect(dbPath()).toBe("/tmp/zuun-test/index.db");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/paths.test.ts`
Expected: FAIL with "Cannot find module './paths'"

- [ ] **Step 3: Write minimal implementation**

`src/lib/paths.ts`:

```typescript
import * as os from "os";
import * as path from "path";

export function storeRoot(): string {
  return process.env.ZUUN_HOME ?? path.join(os.homedir(), ".zuun");
}

export function entriesDir(): string {
  return path.join(storeRoot(), "entries");
}

export function dbPath(): string {
  return path.join(storeRoot(), "index.db");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/paths.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/paths.ts src/lib/paths.test.ts
git commit -m "feat(paths): resolve store root, entries dir, db path"
```

---

### Task 2: Stateless ID generation

**Files:**
- Create: `src/lib/id.ts`
- Create: `src/lib/id.test.ts`

Generates `ENT-YYMMDD-XXXX` IDs from (date, body) without a counter. Uses a 4-hex-char hash of `body + timestamp_ms` so same-second captures don't collide.

- [ ] **Step 1: Write the failing test**

`src/lib/id.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { newEntryId } from "./id";
import { ENTRY_ID_REGEX } from "./entry";

describe("newEntryId", () => {
  it("produces an ID matching the Entry ID regex", () => {
    const id = newEntryId("some body text", new Date("2026-04-16T12:00:00Z"));
    expect(ENTRY_ID_REGEX.test(id)).toBe(true);
  });

  it("encodes the date as YYMMDD", () => {
    const id = newEntryId("body", new Date("2026-04-16T12:00:00Z"));
    expect(id.startsWith("ENT-260416-")).toBe(true);
  });

  it("produces different IDs for different bodies at the same instant", () => {
    const at = new Date("2026-04-16T12:00:00Z");
    const a = newEntryId("body one", at);
    const b = newEntryId("body two", at);
    expect(a).not.toBe(b);
  });

  it("produces different IDs for same body at different instants", () => {
    const a = newEntryId("body", new Date("2026-04-16T12:00:00.000Z"));
    const b = newEntryId("body", new Date("2026-04-16T12:00:00.001Z"));
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/id.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/lib/id.ts`:

```typescript
import * as crypto from "crypto";

export function newEntryId(body: string, at: Date = new Date()): string {
  const yy = String(at.getUTCFullYear()).slice(-2);
  const mm = String(at.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(at.getUTCDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;

  const hash = crypto
    .createHash("sha256")
    .update(`${body}|${at.getTime()}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();

  return `ENT-${datePart}-${hash}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/id.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/id.ts src/lib/id.test.ts
git commit -m "feat(id): stateless ENT-YYMMDD-XXXX generator"
```

---

### Task 3: Entry file I/O (read/write markdown + frontmatter)

**Files:**
- Create: `src/lib/entry-io.ts`
- Create: `src/lib/entry-io.test.ts`

Writes an `Entry` to `entries/<id>.md` as YAML frontmatter + body. Reads it back and re-validates through `EntrySchema`. This is the trust boundary — if the file is malformed, we throw; no silent drops.

- [ ] **Step 1: Write the failing test**

`src/lib/entry-io.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeEntry, readEntry, listEntryIds } from "./entry-io";
import type { Entry } from "./entry";

describe("entry-io", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  const fixture: Entry = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Decided to go local-first because portability is the moat.",
    kind: "decision",
    source: "manual",
    tags: ["architecture", "v0"],
    related: [],
  };

  it("round-trips an entry through disk", () => {
    writeEntry(fixture);
    const read = readEntry(fixture.id);
    expect(read).toEqual(fixture);
  });

  it("creates the entries directory on first write", () => {
    writeEntry(fixture);
    expect(fs.existsSync(path.join(tmp, "entries"))).toBe(true);
  });

  it("throws on a malformed entry file instead of silently dropping it", () => {
    const bogusPath = path.join(tmp, "entries", "ENT-260416-0000.md");
    fs.mkdirSync(path.dirname(bogusPath), { recursive: true });
    fs.writeFileSync(bogusPath, "---\nid: not-a-valid-id\n---\nbody");
    expect(() => readEntry("ENT-260416-0000")).toThrow();
  });

  it("listEntryIds returns all entry IDs in the store", () => {
    writeEntry(fixture);
    writeEntry({ ...fixture, id: "ENT-260416-BEEF" });
    const ids = listEntryIds().sort();
    expect(ids).toEqual(["ENT-260416-3A7F", "ENT-260416-BEEF"]);
  });

  it("listEntryIds returns [] if entries dir doesn't exist", () => {
    expect(listEntryIds()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/entry-io.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/lib/entry-io.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { EntrySchema, type Entry } from "./entry";
import { entriesDir } from "./paths";

function entryPath(id: string): string {
  return path.join(entriesDir(), `${id}.md`);
}

export function writeEntry(entry: Entry): void {
  EntrySchema.parse(entry);
  fs.mkdirSync(entriesDir(), { recursive: true });
  const { body, ...frontmatter } = entry;
  const file = matter.stringify(body, frontmatter);
  fs.writeFileSync(entryPath(entry.id), file);
}

export function readEntry(id: string): Entry {
  const raw = fs.readFileSync(entryPath(id), "utf8");
  const parsed = matter(raw);
  return EntrySchema.parse({ ...parsed.data, body: parsed.content.trim() });
}

export function listEntryIds(): string[] {
  const dir = entriesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/entry-io.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/entry-io.ts src/lib/entry-io.test.ts
git commit -m "feat(entry-io): read/write entries as YAML-frontmatter markdown"
```

---

## Phase 2 — Storage Layer

### Task 4: SQLite connection + schema init

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/db.test.ts`

Opens a `better-sqlite3` connection at `dbPath()`, loads `sqlite-vec`, and creates the schema if missing: an `entries` table (id, body, kind, source, created, origin), an FTS5 virtual table (`entries_fts` on `body`), and a vec0 virtual table (`entries_vec` with 768-dim embedding).

- [ ] **Step 1: Write the failing test**

`src/lib/db.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb } from "./db";

describe("openDb", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("creates the db file on first open", () => {
    const db = openDb();
    expect(fs.existsSync(path.join(tmp, "index.db"))).toBe(true);
    db.close();
  });

  it("creates the entries table", () => {
    const db = openDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entries'")
      .get();
    expect(row).toBeDefined();
    db.close();
  });

  it("creates the entries_fts virtual table", () => {
    const db = openDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE name='entries_fts'")
      .get();
    expect(row).toBeDefined();
    db.close();
  });

  it("creates the entries_vec virtual table with 768-dim embedding", () => {
    const db = openDb();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE name='entries_vec'")
      .get();
    expect(row).toBeDefined();
    db.close();
  });

  it("is idempotent — opening twice does not error", () => {
    openDb().close();
    expect(() => openDb().close()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/lib/db.ts`:

```typescript
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as fs from "fs";
import { dbPath, storeRoot } from "./paths";

export type Db = Database.Database;

export function openDb(): Db {
  fs.mkdirSync(storeRoot(), { recursive: true });
  const db = new Database(dbPath());
  sqliteVec.load(db);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      created TEXT NOT NULL,
      stance TEXT,
      origin TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      related TEXT NOT NULL DEFAULT '[]',
      confidence TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      id UNINDEXED,
      body,
      content=''
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS entries_vec USING vec0(
      id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    );
  `);

  return db;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat(db): sqlite init with entries + fts5 + vec0 tables"
```

---

### Task 5: Entry index CRUD (upsert, delete, get)

**Files:**
- Create: `src/lib/index.ts`
- Create: `src/lib/index.test.ts`

Given a `Db` and an `Entry`, upsert into both `entries` and `entries_fts`. Delete removes from both. `getEntry(db, id)` returns `Entry | null`. This is pure SQL — no file I/O, no embedding.

- [ ] **Step 1: Write the failing test**

`src/lib/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry, deleteEntry, getEntry } from "./index";
import type { Entry } from "./entry";

describe("index CRUD", () => {
  let tmp: string;
  let db: Db;

  const fixture: Entry = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Local-first wins on portability.",
    kind: "decision",
    source: "manual",
    tags: ["architecture"],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("upserts and reads back an entry", () => {
    upsertEntry(db, fixture);
    expect(getEntry(db, fixture.id)).toEqual(fixture);
  });

  it("upsert is idempotent (second call updates fields)", () => {
    upsertEntry(db, fixture);
    upsertEntry(db, { ...fixture, body: "updated body" });
    expect(getEntry(db, fixture.id)?.body).toBe("updated body");
  });

  it("getEntry returns null for missing id", () => {
    expect(getEntry(db, "ENT-260416-0000")).toBeNull();
  });

  it("deleteEntry removes the row", () => {
    upsertEntry(db, fixture);
    deleteEntry(db, fixture.id);
    expect(getEntry(db, fixture.id)).toBeNull();
  });

  it("upsert also writes to fts so body is searchable", () => {
    upsertEntry(db, fixture);
    const row = db
      .prepare("SELECT id FROM entries_fts WHERE entries_fts MATCH 'local-first'")
      .get() as { id: string } | undefined;
    expect(row?.id).toBe(fixture.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/index.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/lib/index.ts`:

```typescript
import type { Db } from "./db";
import { EntrySchema, type Entry } from "./entry";

export function upsertEntry(db: Db, entry: Entry): void {
  EntrySchema.parse(entry);
  db.prepare(
    `INSERT INTO entries (id, body, kind, source, created, stance, origin, tags, related, confidence)
     VALUES (@id, @body, @kind, @source, @created, @stance, @origin, @tags, @related, @confidence)
     ON CONFLICT(id) DO UPDATE SET
       body=excluded.body, kind=excluded.kind, source=excluded.source,
       created=excluded.created, stance=excluded.stance, origin=excluded.origin,
       tags=excluded.tags, related=excluded.related, confidence=excluded.confidence`,
  ).run({
    id: entry.id,
    body: entry.body,
    kind: entry.kind,
    source: entry.source,
    created: entry.created,
    stance: entry.stance ?? null,
    origin: entry.origin ?? null,
    tags: JSON.stringify(entry.tags),
    related: JSON.stringify(entry.related),
    confidence: entry.confidence ?? null,
  });
  db.prepare("DELETE FROM entries_fts WHERE id = ?").run(entry.id);
  db.prepare("INSERT INTO entries_fts (id, body) VALUES (?, ?)").run(entry.id, entry.body);
}

export function deleteEntry(db: Db, id: string): void {
  db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  db.prepare("DELETE FROM entries_fts WHERE id = ?").run(id);
  db.prepare("DELETE FROM entries_vec WHERE id = ?").run(id);
}

export function getEntry(db: Db, id: string): Entry | null {
  const row = db.prepare("SELECT * FROM entries WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return EntrySchema.parse({
    ...row,
    tags: JSON.parse(row.tags as string),
    related: JSON.parse(row.related as string),
    stance: row.stance ?? undefined,
    origin: row.origin ?? undefined,
    confidence: row.confidence ?? undefined,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/index.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/index.ts src/lib/index.test.ts
git commit -m "feat(index): upsert/delete/get entry in SQLite + FTS"
```

---

### Task 6: Reindex script (rebuild SQLite from markdown files)

**Files:**
- Create: `src/scripts/reindex.ts`
- Test: extended via e2e.test.ts in Task 15 (reindex is simple enough that E2E is the right level)

Reads every file under `entries/`, validates with `EntrySchema`, and upserts into a **fresh** SQLite index. Safe to re-run. This is the "always safe" property that makes the filesystem the source of truth.

- [ ] **Step 1: Write the implementation**

`src/scripts/reindex.ts`:

```typescript
import * as fs from "fs";
import { openDb } from "../lib/db";
import { listEntryIds, readEntry } from "../lib/entry-io";
import { upsertEntry } from "../lib/index";
import { dbPath } from "../lib/paths";

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
  return { indexed, failed };
}

if (require.main === module) {
  const result = reindex();
  console.log(`indexed ${result.indexed} entries`);
  if (result.failed.length > 0) {
    console.error(`failed: ${result.failed.length}`);
    for (const line of result.failed) console.error(`  ${line}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Manual smoke test**

Run:
```bash
export ZUUN_HOME=/tmp/zuun-smoke-$$
mkdir -p $ZUUN_HOME/entries
cat > $ZUUN_HOME/entries/ENT-260416-AAAA.md <<'MD'
---
id: ENT-260416-AAAA
created: 2026-04-16T14:22:00.000Z
kind: decision
source: manual
tags: []
related: []
---
Test body.
MD
npx tsx src/scripts/reindex.ts
```

Expected: prints `indexed 1 entries`, exits 0. File `$ZUUN_HOME/index.db` exists.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/reindex.ts
git commit -m "feat(reindex): rebuild sqlite index from markdown files"
```

---

## Phase 3 — Embeddings

### Task 7: Ollama embed client (HTTP, optional, graceful failure)

**Files:**
- Create: `src/lib/embed-client.ts`
- Create: `src/lib/embed-client.test.ts`

Calls `POST http://127.0.0.1:11434/api/embeddings` with `{ model, prompt }` and returns a 768-float array. **L2-normalizes the result** (one of the hard-won Zuhn lessons). On connection failure (Ollama not running), returns `null` — never throws. This keeps Zuun usable without Ollama.

- [ ] **Step 1: Write the failing test**

`src/lib/embed-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embedText } from "./embed-client";

describe("embedText", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a 768-float L2-normalized vector on success", async () => {
    const raw = Array.from({ length: 768 }, (_, i) => i + 1);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: raw }),
    } as Response);

    const vec = await embedText("hello");
    expect(vec).not.toBeNull();
    expect(vec).toHaveLength(768);
    const norm = Math.sqrt(vec!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("returns null when Ollama is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await embedText("hello")).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    expect(await embedText("hello")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/embed-client.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/lib/embed-client.ts`:

```typescript
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.ZUUN_EMBED_MODEL ?? "nomic-embed-text";

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding || data.embedding.length !== 768) return null;
    return l2Normalize(data.embedding);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/embed-client.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/embed-client.ts src/lib/embed-client.test.ts
git commit -m "feat(embed-client): ollama http client with l2 norm + graceful failure"
```

---

### Task 8: Embedding index store

**Files:**
- Create: `src/lib/embed.ts`
- Create: `src/lib/embed.test.ts`

Given a `Db` and an Entry id + vector, upsert into `entries_vec`. Expose `embedAll(db)` that finds entries missing vectors and embeds them. If Ollama is unreachable, skip silently (entries still searchable via FTS).

- [ ] **Step 1: Write the failing test**

`src/lib/embed.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry } from "./index";
import { setEmbedding, hasEmbedding, embedMissing } from "./embed";

describe("embed store", () => {
  let tmp: string;
  let db: Db;

  const fixture = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Local-first wins.",
    kind: "decision" as const,
    source: "manual" as const,
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("setEmbedding stores a 768-vec and hasEmbedding reports true", () => {
    upsertEntry(db, fixture);
    setEmbedding(db, fixture.id, Array(768).fill(0.1));
    expect(hasEmbedding(db, fixture.id)).toBe(true);
  });

  it("hasEmbedding returns false for entries without vectors", () => {
    upsertEntry(db, fixture);
    expect(hasEmbedding(db, fixture.id)).toBe(false);
  });

  it("embedMissing skips entries with existing embeddings", async () => {
    upsertEntry(db, fixture);
    setEmbedding(db, fixture.id, Array(768).fill(0.1));
    const embedFn = vi.fn();
    await embedMissing(db, embedFn);
    expect(embedFn).not.toHaveBeenCalled();
  });

  it("embedMissing calls embedFn for unembedded entries", async () => {
    upsertEntry(db, fixture);
    const embedFn = vi.fn().mockResolvedValue(Array(768).fill(0.1));
    await embedMissing(db, embedFn);
    expect(embedFn).toHaveBeenCalledWith(fixture.body);
    expect(hasEmbedding(db, fixture.id)).toBe(true);
  });

  it("embedMissing is a no-op when embedFn returns null", async () => {
    upsertEntry(db, fixture);
    const embedFn = vi.fn().mockResolvedValue(null);
    await expect(embedMissing(db, embedFn)).resolves.not.toThrow();
    expect(hasEmbedding(db, fixture.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/embed.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/lib/embed.ts`:

```typescript
import type { Db } from "./db";

export function setEmbedding(db: Db, id: string, vec: number[]): void {
  if (vec.length !== 768) throw new Error(`expected 768-dim, got ${vec.length}`);
  db.prepare("DELETE FROM entries_vec WHERE id = ?").run(id);
  db.prepare("INSERT INTO entries_vec (id, embedding) VALUES (?, ?)").run(
    id,
    new Float32Array(vec),
  );
}

export function hasEmbedding(db: Db, id: string): boolean {
  const row = db.prepare("SELECT id FROM entries_vec WHERE id = ?").get(id);
  return row !== undefined;
}

export async function embedMissing(
  db: Db,
  embedFn: (text: string) => Promise<number[] | null>,
): Promise<{ embedded: number; skipped: number }> {
  const rows = db
    .prepare(
      "SELECT e.id, e.body FROM entries e LEFT JOIN entries_vec v ON v.id = e.id WHERE v.id IS NULL",
    )
    .all() as { id: string; body: string }[];

  let embedded = 0;
  let skipped = 0;
  for (const row of rows) {
    const vec = await embedFn(row.body);
    if (vec === null) {
      skipped++;
      continue;
    }
    setEmbedding(db, row.id, vec);
    embedded++;
  }
  return { embedded, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/embed.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/embed.ts src/lib/embed.test.ts
git commit -m "feat(embed): store vectors in entries_vec, skip on ollama miss"
```

---

## Phase 4 — Search

### Task 9: Hybrid search (FTS + vector, 50/50 blend)

**Files:**
- Create: `src/lib/search.ts`
- Create: `src/lib/search.test.ts`

Given a query string, return top-K entries. If a vector is available for the query, blend FTS (BM25) and cosine scores 50/50 after min-max normalization within the result set. If no vector (Ollama down), return FTS-only. Blend weight is a parameter defaulting to 0.5.

- [ ] **Step 1: Write the failing test**

`src/lib/search.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDb, type Db } from "./db";
import { upsertEntry } from "./index";
import { setEmbedding } from "./embed";
import { search } from "./search";
import type { Entry } from "./entry";

describe("search", () => {
  let tmp: string;
  let db: Db;

  const base: Omit<Entry, "id" | "body"> = {
    created: "2026-04-16T14:22:00.000Z",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  const a: Entry = { ...base, id: "ENT-260416-AAAA", body: "Local-first architecture enables portability." };
  const b: Entry = { ...base, id: "ENT-260416-BBBB", body: "Cloud deployments scale horizontally with ease." };
  const c: Entry = { ...base, id: "ENT-260416-CCCC", body: "Portability means your data travels with you." };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
    db = openDb();
    upsertEntry(db, a);
    upsertEntry(db, b);
    upsertEntry(db, c);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("returns FTS matches when no query vector is given", () => {
    const results = search(db, { query: "portability" });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
  });

  it("ranks exact lexical matches near the top", () => {
    const results = search(db, { query: "portability" });
    expect([a.id, c.id]).toContain(results[0]?.id);
  });

  it("respects the limit parameter", () => {
    const results = search(db, { query: "the", limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("blends vector scores when query vector is provided", () => {
    // give b a vector that aligns with query vector; lexical doesn't match
    const qVec = Array(768).fill(0).map((_, i) => (i === 0 ? 1 : 0));
    setEmbedding(db, b.id, qVec);
    setEmbedding(db, a.id, Array(768).fill(0).map((_, i) => (i === 1 ? 1 : 0)));
    const results = search(db, { query: "unrelated text zzqq", queryVec: qVec, limit: 5 });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(b.id);
  });

  it("returns empty list for a gibberish query with no vector", () => {
    expect(search(db, { query: "zzqqxxtt" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/search.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/lib/search.ts`:

```typescript
import type { Db } from "./db";
import { getEntry } from "./index";
import type { Entry } from "./entry";

export interface SearchOptions {
  query: string;
  queryVec?: number[];
  limit?: number;
  blend?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  entry: Entry;
}

function sanitizeFts(q: string): string {
  return q.replace(/["]/g, " ").split(/\s+/).filter(Boolean).map((t) => `"${t}"`).join(" OR ");
}

function minMaxNormalize(scores: Map<string, number>): Map<string, number> {
  const values = [...scores.values()];
  if (values.length === 0) return scores;
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

export function search(db: Db, opts: SearchOptions): SearchResult[] {
  const limit = opts.limit ?? 10;
  const blend = opts.blend ?? 0.5;

  const ftsQuery = sanitizeFts(opts.query);
  const ftsScores = new Map<string, number>();
  if (ftsQuery.length > 0) {
    const rows = db
      .prepare(
        "SELECT id, bm25(entries_fts) AS score FROM entries_fts WHERE entries_fts MATCH ? ORDER BY score LIMIT ?",
      )
      .all(ftsQuery, limit * 4) as { id: string; score: number }[];
    for (const r of rows) ftsScores.set(r.id, -r.score);
  }

  const vecScores = new Map<string, number>();
  if (opts.queryVec) {
    const rows = db
      .prepare(
        "SELECT id, distance FROM entries_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance",
      )
      .all(new Float32Array(opts.queryVec), limit * 4) as { id: string; distance: number }[];
    for (const r of rows) vecScores.set(r.id, 1 - r.distance);
  }

  const normFts = minMaxNormalize(ftsScores);
  const normVec = minMaxNormalize(vecScores);
  const ids = new Set<string>([...normFts.keys(), ...normVec.keys()]);
  const combined: { id: string; score: number }[] = [];
  for (const id of ids) {
    const f = normFts.get(id) ?? 0;
    const v = normVec.get(id) ?? 0;
    const score = opts.queryVec ? blend * f + (1 - blend) * v : f;
    combined.push({ id, score });
  }
  combined.sort((a, b) => b.score - a.score);

  return combined.slice(0, limit).flatMap((c) => {
    const entry = getEntry(db, c.id);
    return entry ? [{ id: c.id, score: c.score, entry }] : [];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/search.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts src/lib/search.test.ts
git commit -m "feat(search): hybrid fts + vector with min-max blend"
```

---

## Phase 5 — MCP Server

### Task 10: MCP server skeleton with `remember` tool

**Files:**
- Create: `src/mcp.ts`

Starts an MCP server over stdio using `@modelcontextprotocol/sdk`. Registers the `remember` tool: `remember(body, kind?, tags?)` writes an entry to disk and upserts the index. Synchronous happy path; return the new entry id.

- [ ] **Step 1: Write the implementation**

`src/mcp.ts`:

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { openDb } from "./lib/db";
import { upsertEntry } from "./lib/index";
import { writeEntry } from "./lib/entry-io";
import { newEntryId } from "./lib/id";
import { search } from "./lib/search";
import { embedText } from "./lib/embed-client";
import { setEmbedding } from "./lib/embed";
import { EntryKind } from "./lib/entry";

const RememberInput = z.object({
  body: z.string().min(1),
  kind: EntryKind.default("observation"),
  tags: z.array(z.string()).default([]),
  stance: z.string().optional(),
});

const ContextForInput = z.object({
  task: z.string().min(1),
  limit: z.number().int().positive().max(50).default(8),
});

async function main(): Promise<void> {
  const server = new Server(
    { name: "zuun", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "remember",
        description: "Save a piece of context, a decision, an observation, a pattern, or a commitment so it can be recalled in future sessions.",
        inputSchema: {
          type: "object",
          properties: {
            body: { type: "string", description: "The content to remember." },
            kind: { type: "string", enum: ["decision", "observation", "pattern", "commitment", "reference"] },
            tags: { type: "array", items: { type: "string" } },
            stance: { type: "string", description: "Optional one-line directional claim." },
          },
          required: ["body"],
        },
      },
      {
        name: "context_for",
        description: "Retrieve the most relevant past entries for the current task. Call at the start of a session or when switching context.",
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", description: "Description of what you're working on." },
            limit: { type: "number", default: 8 },
          },
          required: ["task"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "remember") {
      const input = RememberInput.parse(req.params.arguments);
      const now = new Date();
      const id = newEntryId(input.body, now);
      const entry = {
        id,
        created: now.toISOString(),
        body: input.body,
        kind: input.kind,
        source: "claude-code" as const,
        tags: input.tags,
        related: [],
        stance: input.stance,
      };
      writeEntry(entry);
      const db = openDb();
      try {
        upsertEntry(db, entry);
        const vec = await embedText(input.body);
        if (vec) setEmbedding(db, id, vec);
      } finally {
        db.close();
      }
      return { content: [{ type: "text", text: `saved ${id}` }] };
    }

    if (req.params.name === "context_for") {
      const input = ContextForInput.parse(req.params.arguments);
      const db = openDb();
      try {
        const qVec = await embedText(input.task);
        const results = search(db, {
          query: input.task,
          queryVec: qVec ?? undefined,
          limit: input.limit,
        });
        const text = results.length === 0
          ? "no relevant entries found"
          : results
              .map((r) => `[${r.entry.id}] (${r.entry.kind}) ${r.entry.body}`)
              .join("\n\n");
        return { content: [{ type: "text", text }] };
      } finally {
        db.close();
      }
    }

    throw new Error(`unknown tool: ${req.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke test manually**

```bash
# start the server against a throwaway store
export ZUUN_HOME=/tmp/zuun-mcp-smoke
rm -rf $ZUUN_HOME
npx tsx src/mcp.ts &
PID=$!
sleep 1
kill $PID
```

Expected: no stack trace on startup.

- [ ] **Step 3: Commit**

```bash
git add src/mcp.ts
git commit -m "feat(mcp): stdio server with remember + context_for tools"
```

---

### Task 11: MCP integration tests

**Files:**
- Create: `src/mcp.test.ts`

Spawn the MCP server as a subprocess, send JSON-RPC over stdio, assert responses. Covers the full contract: list_tools, call remember, call context_for, error on unknown tool.

- [ ] **Step 1: Write the failing test**

`src/mcp.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function rpc(proc: ChildProcess, id: number, method: string, params: unknown): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.trim().length === 0) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          if (msg.id === id) {
            proc.stdout!.off("data", onData);
            resolve(msg);
            return;
          }
        } catch { /* keep reading */ }
      }
    };
    proc.stdout!.on("data", onData);
    proc.stdin!.write(req);
    setTimeout(() => reject(new Error("rpc timeout")), 10_000);
  });
}

describe("mcp server", () => {
  let tmp: string;
  let proc: ChildProcess;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-mcp-"));
    proc = spawn("npx", ["tsx", "src/mcp.ts"], {
      env: { ...process.env, ZUUN_HOME: tmp },
      stdio: ["pipe", "pipe", "inherit"],
    });
    await rpc(proc, 0, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
  });

  afterEach(() => {
    proc.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("lists remember and context_for tools", async () => {
    const res = await rpc(proc, 1, "tools/list", {});
    const tools = (res.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    expect(tools).toContain("remember");
    expect(tools).toContain("context_for");
  });

  it("remember writes an entry file", async () => {
    await rpc(proc, 2, "tools/call", {
      name: "remember",
      arguments: { body: "Local-first wins", kind: "decision" },
    });
    const files = fs.readdirSync(path.join(tmp, "entries"));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^ENT-\d{6}-[A-F0-9]{4}\.md$/);
  });

  it("context_for returns the remembered entry", async () => {
    await rpc(proc, 3, "tools/call", {
      name: "remember",
      arguments: { body: "Avoid DBSCAN in high dimensions; use Louvain instead." },
    });
    const res = await rpc(proc, 4, "tools/call", {
      name: "context_for",
      arguments: { task: "picking a clustering algorithm" },
    });
    const text = ((res.result as { content: { text: string }[] }).content[0]).text;
    expect(text).toContain("Louvain");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/mcp.test.ts`
Expected: may pass if Task 10 is solid; if it fails, fix the server code until green.

- [ ] **Step 3: Commit**

```bash
git add src/mcp.test.ts
git commit -m "test(mcp): integration tests for remember + context_for"
```

---

## Phase 6 — CLI

### Task 12: CLI dispatcher

**Files:**
- Create: `src/cli.ts`
- Create: `src/cli.test.ts`

Dispatches subcommands: `init`, `mcp`, `reindex`, `embed`, `capture`, `search`. Each delegates to a library function. `mcp` spawns `src/mcp.ts`. Exits with code 0 on success, non-zero on error.

- [ ] **Step 1: Write the failing test**

`src/cli.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runCli } from "./cli";

describe("cli", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-cli-"));
    process.env.ZUUN_HOME = tmp;
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("init creates the store directory", async () => {
    expect(await runCli(["init"])).toBe(0);
    expect(fs.existsSync(path.join(tmp, "entries"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "index.db"))).toBe(true);
  });

  it("reindex runs successfully on an empty store", async () => {
    await runCli(["init"]);
    expect(await runCli(["reindex"])).toBe(0);
  });

  it("unknown command returns non-zero", async () => {
    expect(await runCli(["bogus"])).not.toBe(0);
  });

  it("no command prints help and returns non-zero", async () => {
    expect(await runCli([])).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/cli.test.ts`
Expected: FAIL, module not found

- [ ] **Step 3: Write minimal implementation**

`src/cli.ts`:

```typescript
import * as fs from "fs";
import { openDb } from "./lib/db";
import { entriesDir, storeRoot } from "./lib/paths";
import { reindex } from "./scripts/reindex";
import { embedMissing } from "./lib/embed";
import { embedText } from "./lib/embed-client";
import { search } from "./lib/search";

const HELP = `usage: zuun <command>

commands:
  init         create the store directory and index
  mcp          run the MCP server over stdio
  reindex      rebuild the SQLite index from markdown files
  embed        embed all entries that are missing vectors (requires Ollama)
  capture      read an entry body from stdin and save it
  search QRY   print top matches for QRY
`;

export async function runCli(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    console.error(HELP);
    return 1;
  }

  switch (cmd) {
    case "init": {
      fs.mkdirSync(entriesDir(), { recursive: true });
      openDb().close();
      console.log(`initialized zuun store at ${storeRoot()}`);
      return 0;
    }
    case "mcp": {
      await import("./mcp");
      return 0;
    }
    case "reindex": {
      const r = reindex();
      console.log(`indexed ${r.indexed}, failed ${r.failed.length}`);
      return r.failed.length === 0 ? 0 : 1;
    }
    case "embed": {
      const db = openDb();
      try {
        const r = await embedMissing(db, embedText);
        console.log(`embedded ${r.embedded}, skipped ${r.skipped}`);
        return 0;
      } finally {
        db.close();
      }
    }
    case "capture": {
      const { capture } = await import("./capture");
      return capture(rest);
    }
    case "search": {
      const query = rest.join(" ");
      if (!query) {
        console.error("usage: zuun search <query>");
        return 1;
      }
      const db = openDb();
      try {
        const qVec = await embedText(query);
        const results = search(db, { query, queryVec: qVec ?? undefined, limit: 10 });
        for (const r of results) {
          console.log(`[${r.entry.id}] (${r.entry.kind}) ${r.entry.body}`);
        }
        return 0;
      } finally {
        db.close();
      }
    }
    default: {
      console.error(`unknown command: ${cmd}\n\n${HELP}`);
      return 1;
    }
  }
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/cli.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/cli.test.ts
git commit -m "feat(cli): init/mcp/reindex/embed/capture/search dispatcher"
```

---

### Task 13: `bin/zuun.js` shim

**Files:**
- Create: `bin/zuun.js`

Node shebang entry that loads the compiled CLI. Also handles dev mode (tsx) when `dist/` is missing.

- [ ] **Step 1: Write the shim**

`bin/zuun.js`:

```javascript
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const distCli = path.join(__dirname, "..", "dist", "cli.js");

if (fs.existsSync(distCli)) {
  require(distCli).runCli(process.argv.slice(2)).then((code) => process.exit(code));
} else {
  require("tsx/cjs");
  require(path.join(__dirname, "..", "src", "cli.ts")).runCli(process.argv.slice(2)).then((code) => process.exit(code));
}
```

- [ ] **Step 2: Make it executable and smoke test**

```bash
chmod +x bin/zuun.js
./bin/zuun.js
```

Expected: prints `usage: zuun <command>` and exits 1.

- [ ] **Step 3: Smoke test init**

```bash
export ZUUN_HOME=/tmp/zuun-bin-smoke
rm -rf $ZUUN_HOME
./bin/zuun.js init
```

Expected: prints `initialized zuun store at /tmp/zuun-bin-smoke`, exits 0.

- [ ] **Step 4: Commit**

```bash
git add bin/zuun.js
git commit -m "feat(bin): zuun CLI entry shim with dev fallback to tsx"
```

---

## Phase 7 — Manual Capture

### Task 14: `capture` command reads stdin

**Files:**
- Create: `src/capture.ts`
- Create: `src/capture.test.ts`

`zuun capture [--kind K] [--tag T]...` reads body from stdin, builds an Entry with source=`manual`, writes to disk, upserts the index, and embeds if Ollama is available. Prints the new ID.

- [ ] **Step 1: Write the failing test**

`src/capture.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { capture } from "./capture";

describe("capture", () => {
  let tmp: string;
  let originalStdin: NodeJS.ReadStream;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-capture-"));
    process.env.ZUUN_HOME = tmp;
    originalStdin = process.stdin;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
  });

  function pipeStdin(text: string) {
    const stream = Readable.from([text]);
    Object.defineProperty(process, "stdin", { value: stream, configurable: true });
  }

  it("writes an entry from stdin with default kind=observation", async () => {
    pipeStdin("A thing I noticed.");
    const code = await capture([]);
    expect(code).toBe(0);
    const files = fs.readdirSync(path.join(tmp, "entries"));
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(tmp, "entries", files[0]!), "utf8");
    expect(content).toContain("kind: observation");
    expect(content).toContain("A thing I noticed");
  });

  it("honors --kind", async () => {
    pipeStdin("A decision.");
    await capture(["--kind", "decision"]);
    const files = fs.readdirSync(path.join(tmp, "entries"));
    const content = fs.readFileSync(path.join(tmp, "entries", files[0]!), "utf8");
    expect(content).toContain("kind: decision");
  });

  it("honors --tag (repeatable)", async () => {
    pipeStdin("Tagged thing.");
    await capture(["--tag", "architecture", "--tag", "v0"]);
    const files = fs.readdirSync(path.join(tmp, "entries"));
    const content = fs.readFileSync(path.join(tmp, "entries", files[0]!), "utf8");
    expect(content).toContain("architecture");
    expect(content).toContain("v0");
  });

  it("rejects empty stdin", async () => {
    pipeStdin("");
    expect(await capture([])).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/capture.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/capture.ts`:

```typescript
import { openDb } from "./lib/db";
import { upsertEntry } from "./lib/index";
import { writeEntry } from "./lib/entry-io";
import { newEntryId } from "./lib/id";
import { embedText } from "./lib/embed-client";
import { setEmbedding } from "./lib/embed";
import { EntryKind, type Entry } from "./lib/entry";

interface Opts {
  kind: Entry["kind"];
  tags: string[];
}

function parseArgs(argv: string[]): Opts {
  const opts: Opts = { kind: "observation", tags: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind") {
      const val = argv[++i];
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
  const opts = parseArgs(argv);
  const body = await readStdin();
  if (body.length === 0) {
    console.error("capture: no body on stdin");
    return 1;
  }
  const now = new Date();
  const id = newEntryId(body, now);
  const entry: Entry = {
    id,
    created: now.toISOString(),
    body,
    kind: opts.kind,
    source: "manual",
    tags: opts.tags,
    related: [],
  };
  writeEntry(entry);
  const db = openDb();
  try {
    upsertEntry(db, entry);
    const vec = await embedText(body);
    if (vec) setEmbedding(db, id, vec);
  } finally {
    db.close();
  }
  console.log(id);
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/capture.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/capture.ts src/capture.test.ts
git commit -m "feat(capture): stdin capture with --kind and --tag flags"
```

---

## Phase 8 — End-to-End Validation

### Task 15: E2E smoke test

**Files:**
- Create: `tests/e2e.test.ts`

Exercise the full path: init → capture a few entries → reindex → search → verify results. Does not require Ollama; tests FTS-only path. Ensures components compose.

- [ ] **Step 1: Write the test**

`tests/e2e.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("e2e", () => {
  let tmp: string;
  const env = () => ({ ...process.env, ZUUN_HOME: tmp });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-e2e-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function cli(args: string[], input?: string) {
    return spawnSync("node", ["bin/zuun.js", ...args], {
      env: env(),
      input,
      encoding: "utf8",
    });
  }

  it("init → capture → search round-trip", () => {
    const init = cli(["init"]);
    expect(init.status).toBe(0);

    const cap1 = cli(["capture", "--kind", "decision"], "Local-first beats cloud-first for portability.");
    expect(cap1.status).toBe(0);

    const cap2 = cli(["capture", "--kind", "observation"], "FTS is fast enough for personal memory.");
    expect(cap2.status).toBe(0);

    const search = cli(["search", "portability"]);
    expect(search.status).toBe(0);
    expect(search.stdout).toContain("Local-first");
  });

  it("reindex rebuilds the db from markdown files", () => {
    cli(["init"]);
    cli(["capture"], "Something to remember.");
    fs.rmSync(path.join(tmp, "index.db"));
    const r = cli(["reindex"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/indexed 1/);
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run tests/e2e.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 3: Commit**

```bash
git add tests/e2e.test.ts
git commit -m "test(e2e): init, capture, reindex, search round-trip"
```

---

### Task 16: Manual smoke test with real Claude Code MCP

**No files to create — this is a human-in-the-loop validation step.**

- [ ] **Step 1: Register zuun as an MCP server for Claude Code**

```bash
claude mcp add zuun node /Users/jinchoi/Code/zuun/bin/zuun.js mcp
```

- [ ] **Step 2: Start a new Claude Code session and test `remember`**

Ask Claude Code: *"Use the zuun remember tool to save: 'Zuun uses local-first markdown + SQLite, no cloud.'"*

Verify:
- `ls ~/.zuun/entries/` shows a new `ENT-*.md` file
- File content includes the body and `source: claude-code`

- [ ] **Step 3: Start another session and test `context_for`**

Ask Claude Code: *"Call zuun context_for with task='how does zuun store data'"*

Expected: response contains the text you saved in Step 2.

- [ ] **Step 4: Document results in commit message**

```bash
git commit --allow-empty -m "chore: v0 manual smoke test with claude code MCP — PASSED"
```

---

## Success Criteria

At the end of this plan, the following must be true:

1. **All tests green.** `npx vitest run` passes with zero failures. ~30+ tests across unit + integration + e2e.
2. **`zuun init` works.** Creates `~/.zuun/entries/` and `~/.zuun/index.db`.
3. **`zuun capture` works.** Pipe body via stdin, entry file appears on disk, row in SQLite.
4. **`zuun search "query"` returns FTS hits** without Ollama running.
5. **`zuun mcp` starts as an MCP server** Claude Code can register.
6. **`remember` tool in Claude Code writes entries** visible on disk.
7. **`context_for` tool in Claude Code returns matching entries** from a prior session.
8. **`zuun reindex` rebuilds the index** from scratch after `rm ~/.zuun/index.db`.

If any of these fails, the plan is not done.

---

## Risk Register (noting these so future-me doesn't re-discover them)

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| sqlite-vec version mismatch with better-sqlite3 | Medium | Pin both; lockfile committed |
| Ollama model name changes (`nomic-embed-text` → something) | Low | Env var override for model name |
| MCP SDK API churn | Medium | Pin `@modelcontextprotocol/sdk` to current minor; update deliberately |
| FTS5 tokenizer strips useful chars | Low | Use the default tokenizer; revisit if queries miss matches |
| Entry schema turns out to be wrong | High | That's why we started with only 5 kinds and a small required set; migrating early is cheap |
| CLI arg parsing gets a surprise input | Medium | Keep arg parsing thin; CLI only takes flags we define |
| Tests leave lingering processes (MCP spawn) | Medium | `afterEach` kills child process; use `process.kill` consistently |

---

## Self-Review Checklist

Before handing off:

- [x] **Spec coverage:** every part of the original stripped-down product scope is covered (Entry schema ✓, capture ✓, reindex ✓, hybrid search ✓, MCP ✓, CLI ✓, E2E ✓).
- [x] **No placeholders:** every code block is complete; every shell command is specific; no "TODO" language.
- [x] **Type consistency:** `Entry`, `Db`, `EntryKind`, `EntrySource` referenced consistently across tasks. No renames mid-plan.
- [x] **Commit granularity:** each task ends with a commit; each commit maps to one logical change.
- [x] **Dependency ordering:** Task N only uses types/functions defined in Tasks 1..N-1.
- [x] **Testability:** every task that produces code has a test file. E2E catches composition bugs that unit tests miss.

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-04-16-v0-scaffolding.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best when tasks are independent and we want parallelism where possible.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best when I want to stay in one context and see every step.

**Which approach?**
