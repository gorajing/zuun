# Zuun

**Persistent memory for AI-assisted work.** A Claude Code plugin that captures durable insights from your sessions and surfaces them into future ones — so you stop re-explaining yourself to the agent.

- 🧠 **MCP tools** — `remember` and `context_for` the agent can call mid-session
- 🪄 **SessionStart injection** — every new Claude Code session opens with relevant prior decisions pre-loaded
- 📝 **`/zuun:reflect` skill** — user-invoked end-of-session reflection
- 🪝 **Git post-commit hook** — every commit you make becomes a captured pattern
- 🔎 **Hybrid search** — FTS5 + vector (via Ollama) + recency, with per-component score explain
- 💾 **Local-first** — plain markdown + SQLite on your disk. No cloud. No account. `grep`-able, `git`-able, `rm -rf`-able.

```
$ zuun doctor
schema_version: 2
entries on disk: 17
entries in db: 17
broken related refs: 0
ollama: up
recent log:
  2026-04-19T13:16:11Z capture {"id":"ENT-260419-D75E","kind":"pattern","source":"git"}
  2026-04-19T13:17:02Z session_start.inject {"project":"/Users/you/Code/zuun","hits":3,"chars":890}
```

---

## The problem

Every Claude Code session starts from zero. Yesterday's architectural decisions, the reason you rejected library X, the gotcha you discovered in module Y — the agent forgets all of it the moment the session closes. You either re-type the context every morning, stuff it into CLAUDE.md (and watch it grow stale), or accept that the agent will propose things you already rejected last week.

Zuun is the smallest useful fix: a local store that captures the durable claims from a session and injects the relevant ones into the next one.

**Unit of improvement: the multi-session trajectory, not the single commit.** You won't see Zuun in a one-off task. You'll see it in week 4, when the agent is already calibrated to your preferences without you re-calibrating it.

---

## How it works

```
     ┌──────────────────────────────────────────────────────┐
     │               Claude Code session                    │
     │                                                      │
     │   remember  ─────┐                    ┌──── /zuun:   │
     │   context_for ◀──┤                    │    reflect   │
     └──────────────────┼────────────────────┼──────────────┘
                        │                    │
                        ▼                    ▼
     ┌──────────────────────────────────────────────────────┐
     │   MCP server (stdio)        +       CLI (zuun …)     │
     └──────────────────────────────────────────────────────┘
                        │                    │
                        ▼                    ▼
                ┌─────────────────────────────────┐
                │   ~/.zuun/                      │
                │     entries/  ENT-YYMMDD-XXXX.md│
                │     index.db  (SQLite + FTS5    │
                │                + sqlite-vec)    │
                │     log.jsonl (append-only)     │
                └─────────────────────────────────┘
                        ▲                    ▲
                        │                    │
               git post-commit       SessionStart hook
                (captures)             (injects)
```

Every mutation writes to both disk (markdown) and index (SQLite), in that order. If a crash hits between, `zuun reindex` rebuilds the DB from disk. The markdown files are the source of truth; SQLite is a derived, throwaway index.

---

## Install

Prerequisites:

- Node **20.x or 22.x**
- [Claude Code](https://docs.anthropic.com/claude-code) v2.0+
- [Ollama](https://ollama.com/) with `nomic-embed-text` *(optional — search works without it via pure FTS; embeddings just improve semantic match)*
- `git` (for the post-commit hook)

### 1. Install the Claude Code plugin

```bash
claude plugin marketplace add github:gorajing/zuun
claude plugin install zuun@zuun
```

Relaunch Claude Code. Run `/mcp` — `zuun` should appear as **connected**. That's the signal the MCP server booted (fetched from npm on first run via `npx`). No data setup required: the store (`~/.zuun/`) auto-creates on first write.

### 2. Install the CLI globally (optional but recommended)

For the git post-commit hook, manual captures, and shell pipelines:

```bash
npm install -g zuun
zuun --version   # should print 0.1.1
```

The Claude Code plugin and the global CLI share the same `~/.zuun/` store, so entries captured from one are visible to the other.

### 3. First run — zero setup

Start a new Claude Code session, then prompt the agent:

> *"Use the zuun remember tool to save: 'Local-first beats cloud-first because tar is the moat.'"*

It'll return `saved ENT-YYMMDD-XXXX`. That's your first entry. The store was created, the index was built, and future sessions will see this entry in their SessionStart context when you're in the same project directory.

From here, the loop starts: capture what's hard-won, let SessionStart re-surface it, use `/zuun:reflect` at natural breakpoints.

### 4. Install the git post-commit hook in your active repos

Requires the global CLI from step 2.

```bash
# In each repo you want to capture commits from:
cd ~/path/to/my-project
zuun install-git-hook
```

The installer writes an absolute path into `.git/hooks/post-commit` (one per repo, opt-in). Hooks fire outside Claude Code too — every `git commit` becomes an `ENT-*.md` with `source: git`, the commit SHA as `origin`, and the commit message + changed files as the body.

To remove: `rm .git/hooks/post-commit`. It's one file per repo.

### Developing on zuun itself

If you want to hack on zuun's source:

```bash
git clone https://github.com/gorajing/zuun.git
cd zuun
npm install
npm test           # 167 tests should pass in ~5s

# Load your local working copy into Claude Code instead of the marketplace version:
claude --plugin-dir "$PWD"
```

---

## Usage

### Agent-facing tools (MCP)

Two tools, intentionally. Expanding this surface area comes with a context-cost tax on every Claude Code turn — [attention budget is a feature](#philosophy).

**`remember`** — save a durable insight.

```
# Agent-invoked mid-session:
body:   "Local-first beats cloud-first for portability because tar is the moat."
kind:   "decision"   # or pattern | commitment | reference | observation
tags:   ["architecture", "roadmap"]
# optional:
stance: "local-first is the right default for single-user dev tools"
origin: "src/lib/paths.ts"   # file path, git sha, URL, session marker
```

Dedupes same-body entries within a 10-minute window. Returns `saved ENT-<id>` or `already remembered ENT-<id>`.

**`context_for`** — retrieve relevant past entries for the current work.

```
task:  "picking between SQLite and Postgres for session storage"
limit: 8
```

Returns a markdown list. Retrieval is automatically scoped to the current git project (or "global" for entries captured outside any git repo). Hybrid-scored across FTS5, vector similarity, and recency — see `zuun explain <query>` for per-component scores.

### User-facing skill

**`/zuun:reflect`** — type this at a natural breakpoint (end of session, before a break). The agent looks back at what was decided, learned, or built and calls `remember` for the 2–5 highest-signal items. If the session produced nothing worth preserving, it says so and skips — which is a feature, not a bug.

### Hooks

**SessionStart injection** — fires every time you open a Claude Code session. Pulls the N most recent `decision`/`pattern`/`commitment`/`reference` entries for the current project, caps at 2000 chars, and injects them as `additionalContext`. The agent's first response benefits without you saying a word. Every fire writes `session_start.inject` or `session_start.miss` to `log.jsonl` — always inspectable.

**Git post-commit** — opt-in per repo. After install, every `git commit` writes an entry with the message, files changed, and SHA as origin.

### CLI reference

```
zuun init                    create ~/.zuun store (entries dir + SQLite DB)
zuun capture                 read body from stdin, save as entry
  --kind <kind>                one of: decision|observation|pattern|commitment|reference
  --tag <tag>                  repeatable

zuun search <query>          hybrid search, top 10 hits
zuun explain <query>         per-component scores (fts/vec/recency/final) for top 10
zuun reindex                 rebuild SQLite from markdown files
zuun embed                   backfill missing vectors (requires Ollama)

zuun forget <id>             delete entry (disk + DB, crash-safe order)
zuun edit <id>               open in $EDITOR; re-validate on save; DB untouched on schema failure

zuun install-git-hook        install post-commit hook in current repo
zuun capture-commit          (invoked by hook; not for direct use)

zuun doctor                  health check: disk vs DB, schema, ollama, broken refs, log tail
zuun version                 print version
zuun help                    show commands

zuun mcp                     run the MCP server over stdio (Claude Code invokes this)
```

Usage examples:

```bash
# Capture manually (or from a script, or a | pipe):
echo "Prefer execFileSync over exec to avoid shell injection." \
  | zuun capture --kind pattern --tag security --tag shell

# Search:
zuun search "shell injection"

# Debug a retrieval:
zuun explain "shell injection"
```

---

## Data model

One record type — `Entry`. Everything else is emergent. Full schema in [`src/lib/entry.ts`](./src/lib/entry.ts).

Required fields:

| Field   | Type       | Notes |
|---------|------------|-------|
| `id`    | `ENT-YYMMDD-XXXX` | Content-hashed; stable across re-captures |
| `created` | ISO 8601 | UTC |
| `body`  | string     | One self-contained claim. "Local-first beats cloud-first because…" — not a paragraph. |
| `kind`  | enum       | `decision` · `observation` · `pattern` · `commitment` · `reference` |
| `source`| enum       | `claude-code` · `cursor` · `git` · `manual` · `import` |

Optional fields: `stance`, `tags[]`, `related[]`, `confidence`, `origin`, `project`.

Why so minimal? Schema migrations are cheap at 5 entries and painful at 5000. Biased toward "small required set, rich optional set" so auto-capture paths that can't infer stance/confidence still succeed.

---

## Configuration

Environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `ZUUN_HOME` | `~/.zuun` | Store location (entries + DB + log) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama server for embeddings |
| `ZUUN_EMBED_MODEL` | `nomic-embed-text` | Embedding model name |
| `ZUUN_SEARCH_BLEND` | `fts=0.45,vec=0.45,recency=0.1` | Hybrid search weights |
| `ZUUN_MCP_SOURCE` | `claude-code` | Tag for entries created via MCP |
| `ZUUN_BIN` | *(set by shim)* | Absolute path to `bin/zuun.js`, used by git hook installer |
| `EDITOR` | `vi` | Editor for `zuun edit` |

---

## Development

```bash
npm install
npm test                       # full suite (167 tests, ~5s)
npm run cli -- <subcommand>    # run CLI without building
npm run dev                    # run the MCP server directly (debugging)
```

### Running the test suite

Tests use Vitest with a single-fork pool (database integration tests would race under parallel isolates). The suite includes:

- **Unit tests** per module (`src/**/*.test.ts`)
- **MCP integration test** — spawns `tsx src/mcp.ts`, sends JSON-RPC
- **E2E tests** (`tests/e2e.test.ts`) — spawn the real `bin/zuun.js` shim to catch dispatcher bugs unit tests can't

### Perf sanity check

```bash
# Seeds 1000 synthetic entries with vectors and measures warm search latency:
rm -rf /tmp/zuun-perf
ZUUN_HOME=/tmp/zuun-perf bin/zuun.js init
# (see docs/plans/2026-04-16-v0-plan.md Task 25 for a recent measurement)
```

Budget: **warm search <100ms on 1k entries**. Current on M-series Mac: ~2ms hybrid / <1ms FTS — ~50× headroom.

---

## Philosophy

**Local-first.** Everything is markdown + SQLite on your disk. You can `grep` it, `git log` it, `rm -rf` it. No cloud, no account, no sync daemon. Cross-device sync is a `git push` to a private remote today; first-class support is v0.1.

**Structured, not soup.** Every entry has a `kind`; optional `stance` gives retrieval a directional claim to weight against. Rich unstructured text is easy; usefulness at scale is hard — and structure is the cheapest bet on usefulness.

**Boring is the point.** Daily-use products win on invisible compounding, not cleverness. Zuun tries to be uninteresting enough that you forget it's running and only notice its absence.

**Explicit capture before automation.** v0 ships with `remember` + `/zuun:reflect` + git hooks. No LLM-based auto-distillation. Three costs to avoid until usage data justifies them: corpus pollution, context burn on every turn, and judgment quality (agents are poor self-editors mid-task).

**Attention budget is a feature.** Two MCP tools, not eight. The agent has a limited context budget; every tool schema shipped is a fixed tax on every turn. Adding surface area requires evidence, not enthusiasm.

**Passive signals over explicit ones.** Any future "was this entry useful?" feedback must be inferred from behavior (agent cites an injected entry's ID, user edits vs. forgets it) — never an explicit rate-this-entry UI. Friction kills capture rates; absence of friction is the whole product.

---

## Project status

**v0.1.1 released.** Published to npm; plugin installable from GitHub via the marketplace flow. 167 tests green. Full plugin surface verified end-to-end on a real Claude Code session (MCP tools, slash command, SessionStart hook, git post-commit hook). Perf within budget by ~50×.

This is pre-1.0 software. Schema is versioned (`schema_version: 2`); breaking changes will get a migration path, not a silent reset.

### Roadmap

Explicitly deferred past v0.1. Each has a reason:

- **`~/.zuun` as a git repo with commit-on-write** — cross-device sync + audit history. Next substantive build.
- **Cursor integration** — schema supports `source: cursor`; needs a capture path.
- **`forget` / `edit` as MCP tools** — CLI-only today per attention-budget principle. Adds iff usage data says agents ask users to delete/edit.
- **`export` / `import`** — `tar -czf ~/zuun.tgz ~/.zuun` works today.
- **Multi-layer memory hierarchy** (short-term / long-term / reasoning traces) — the `kind` field is the hook. v0.2.
- **Auto-distillation** — LLM summarizes sessions into entries. Requires explicit-path usage data first (see philosophy).
- **Tag ontology** — intentional non-goal. "No ontology, no hierarchy" per the schema docstring.

---

## Acknowledgments

Zuun was built with [Claude Code](https://docs.anthropic.com/claude-code) and used Claude Code as the primary smoke-test environment throughout development. The first working plugin smoke session found two dispatch-layer bugs that 165 passing unit tests had missed — an object lesson in what "shipped" actually means.

---

## License

MIT © Jin Choi
