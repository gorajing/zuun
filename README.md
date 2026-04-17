# Zuun

**Persistent memory for AI-assisted work.**

Auto-captures context from your Claude Code sessions and git activity. Surfaces relevant past context into future sessions via MCP, so you stop re-explaining yourself to AI.

## The pitch

Every AI session forgets what the last one figured out. You re-explain your architecture, your constraints, your past decisions, every time. Zuun sits in the background, captures the decisions and patterns that come out of your work, and injects the relevant ones into your next session automatically.

Week 4 feels different from week 1.

## Who this is for

Technical knowledge workers who use Claude Code or Cursor 2+ hours a day and notice themselves repeating context to AI.

## What it does

- **Captures** decisions, patterns, and commitments from your AI sessions automatically (Claude Code SessionEnd + git post-commit hooks).
- **Surfaces** the 3–5 most relevant past captures when you start new AI work, via an MCP server.
- **Runs locally.** Markdown + SQLite on your disk. No cloud, no account, your data.

## What it is not

- A note-taking app.
- A knowledge management system or second brain.
- A chat interface.
- A compression, learning, or analysis engine.

## Install

> **Status:** pre-alpha. Not yet installable. Scaffolding in progress.

```bash
# coming soon
npm install -g zuun
zuun init
claude mcp add zuun -- zuun mcp
```

### Build prerequisites

`zuun` depends on `better-sqlite3` and `sqlite-vec`, both native modules. On most systems prebuilt binaries install automatically. If `npm install` falls through to compilation:

- **macOS:** `xcode-select --install` (Xcode Command Line Tools)
- **Linux (Debian/Ubuntu):** `sudo apt install build-essential python3`
- **Linux (Fedora/RHEL):** `sudo dnf groupinstall "Development Tools" && sudo dnf install python3`

## Data model

A single record type: `Entry`. Everything else is emergent.

See [`src/lib/entry.ts`](./src/lib/entry.ts) for the full schema.

## Philosophy

- **Local-first.** Markdown + SQLite. You can `grep` it, `git log` it, `rm -rf` it.
- **Structured, not soup.** Every entry has a `kind` and optional `stance`. Retrieval quality depends on this.
- **Boring is the point.** Daily-use products win on invisible compounding, not on cleverness.
- **Capture is passive.** If you have to remember to use it, it fails.

## License

MIT
