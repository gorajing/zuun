---
name: reflect
description: Reflect on what was decided, learned, or built in this session and save the high-signal items to Zuun so future sessions have them. User-invoked only.
disable-model-invocation: true
---

# Reflect on this session

You are being invoked at the end (or a natural breakpoint) of a Claude Code session. Your job is to look back at what happened and preserve the 2–5 highest-signal items — decisions made, observations worth keeping, patterns learned, commitments to future-self — by calling the Zuun `remember` tool for each.

## What to save

Save items that:
- A new session tomorrow would have to re-derive from scratch.
- Would cause the user to re-explain themselves if lost.
- Are *claims*, not *events*. "We decided to use SQLite over Postgres because the store is single-user" — not "added SQLite."

## What NOT to save

- Step-by-step task notes — those belong in code comments or commit messages.
- Bugs that were already fixed — the fix lives in the diff.
- Speculation or things you haven't verified.
- Content already captured earlier in this session — check your own memory of past `remember` calls first.

## How to call `remember`

For each item, call the `remember` tool with:

- `body` — one self-contained claim. Under 300 chars. Not a paragraph.
- `kind` — pick the best fit: `decision`, `observation`, `pattern`, `commitment`, or `reference`.
- `tags` — 2–4 lowercase tags scoping the claim.
- `stance` (optional) — a one-line directional claim if the body is evaluative.
- `origin` (optional) — file path, PR number, or session marker if the memory ties to a specific artifact.
- `related` (optional) — entry IDs this one builds on (only if you retrieved them earlier this session via `context_for`).

## Cadence

Aim for **2–5 entries total**. Five is the ceiling, not the target. If you can't find 2, save fewer — one great entry beats four mediocre ones. If the session produced nothing worth preserving (a debugging round that ended in "it was a typo"), say so and skip.

## Dedup

The `remember` tool deduplicates same-body entries within a 10-minute window. `already remembered ENT-...` is fine — move on.

## Confirm and stop

After your last `remember` call, briefly list the ids you saved (or report "nothing worth preserving"), then stop. Do not call any other tools. Do not ask follow-up questions.
