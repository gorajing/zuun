#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { openDb } from "./lib/db";
import { upsertEntry } from "./lib/store";
import { writeEntry } from "./lib/entry-io";
import { newEntryId } from "./lib/id";
import { search, type SearchResult } from "./lib/search";
import { defaultProvider } from "./lib/embed-provider";
import { setEmbedding } from "./lib/embed";
import { EntryKind, EntrySource, type Entry } from "./lib/entry";
import { normalizeTags } from "./lib/tags";
import { findRecentDuplicate } from "./lib/dedup";
import { resolveProject } from "./lib/project";
import { appendLog } from "./lib/log";

const SOURCE: Entry["source"] =
  EntrySource.safeParse(process.env.ZUUN_MCP_SOURCE).success
    ? (process.env.ZUUN_MCP_SOURCE as Entry["source"])
    : "claude-code";

const RememberInput = z.object({
  body: z.string().min(1, "body must not be empty"),
  kind: EntryKind.default("observation"),
  tags: z.array(z.string()).default([]),
  stance: z.string().optional(),
  related: z.array(z.string()).default([]),
  origin: z.string().optional(),
  project: z.string().optional(),
});

const ContextForInput = z.object({
  task: z.string().min(1, "task must not be empty"),
  limit: z.number().int().positive().max(50).default(8),
});

const REMEMBER_DESC = `Save a durable insight from this session so future sessions can recall it.

WHEN TO CALL: Something you just decided, observed, or learned that a new session would have to re-derive — an architectural choice, a "we don't do X because Y," a rule of thumb, a commitment to future-self, or an external fact worth preserving. Call as soon as the thing is true; you don't have to batch.

WHEN NOT TO CALL: (1) Ephemeral task state — use your own notes. (2) Content already in the codebase — code is its own memory. (3) Unverified speculation — capture after confirming.

INPUT SHAPE: One self-contained claim per call. "Local-first beats cloud-first for portability because tar is the moat." — not a paragraph, not a list. If you have five things to remember, make five calls.

KINDS: "decision" (a choice with reasoning), "observation" (something noticed about how the world works), "pattern" (a reusable approach), "commitment" (a promise to future-self), "reference" (a durable context snippet).

OPTIONAL \`origin\`: Pass the file path, git sha, PR number, or session marker this entry came from — lets future retrieval cite the source. Use it when the memory is tied to a specific artifact.

PROJECT SCOPING: The \`project\` field is auto-populated from the MCP server's cwd (git root, or pwd). This scopes the entry so SessionStart / context_for retrieve it only for sessions in the same project. Override \`project\` only if the memory belongs to a different project than the current session's cwd — e.g., a cross-repo observation.

OUTPUT: The generated entry id, kind, and echoed body on success. If an identical body was remembered in the last 10 minutes, returns "already remembered <id>" without duplicating.`;

const CONTEXT_FOR_DESC = `Surface the most relevant past entries for what you're working on right now.

WHEN TO CALL: At the start of a new task, or when switching context. Once per context switch — not repeatedly inside the same task. Results are stable-enough that re-querying wastes attention budget.

INPUT SHAPE: Free-form, specific description of the current work. "picking between SQLite and Postgres for session storage" beats "databases". More specific phrasing retrieves more specific matches.

SCOPING: Retrieval is automatically scoped to the current project (resolved from the server's cwd). Global entries (captured outside any git repo) are always included — they apply everywhere. Entries from other projects are excluded. You don't control this; it's structural.

OUTPUT: A markdown list of up to \`limit\` entries. Each line shows id, kind, relative age, and body. If no matching prior context exists, returns "no prior context" — treat that as signal, not an error. The entries you see are the entries your past self already thought were worth remembering; cite their ids when referencing them.`;

async function main(): Promise<void> {
  const server = new Server(
    { name: "zuun", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "remember",
        description: REMEMBER_DESC,
        inputSchema: {
          type: "object",
          properties: {
            body: { type: "string", description: "The content to remember — one self-contained claim." },
            kind: {
              type: "string",
              enum: ["decision", "observation", "pattern", "commitment", "reference"],
              description: "Defaults to observation if omitted.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Freeform tags. Normalized to lowercase-dashed.",
            },
            stance: {
              type: "string",
              description: "Optional one-line directional claim, assertable as true or false.",
            },
            related: {
              type: "array",
              items: { type: "string" },
              description: "Optional entry IDs this one builds on. Soft refs; not validated.",
            },
            origin: {
              type: "string",
              description: "Optional provenance: file path, git sha, PR number, or session marker. Lets future retrieval cite sources.",
            },
            project: {
              type: "string",
              description: "Optional absolute path scoping this entry to a project. Auto-populated from the server's cwd (git root or pwd) if omitted — override only if the memory genuinely belongs to a different project than the session's cwd.",
            },
          },
          required: ["body"],
        },
      },
      {
        name: "context_for",
        description: CONTEXT_FOR_DESC,
        inputSchema: {
          type: "object",
          properties: {
            task: { type: "string", description: "What you're working on, in your own words." },
            limit: { type: "number", description: "Max results. Default 8, max 50.", default: 8 },
          },
          required: ["task"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "remember") return handleRemember(req.params.arguments);
    if (req.params.name === "context_for") return handleContextFor(req.params.arguments);
    return {
      content: [{ type: "text", text: `unknown tool: ${req.params.name}` }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function handleRemember(args: unknown) {
  const input = RememberInput.parse(args);
  const now = new Date();
  const db = openDb();
  try {
    const existing = findRecentDuplicate(db, input.body, now);
    if (existing) {
      appendLog("remember.dedup", { id: existing });
      return {
        content: [
          { type: "text", text: `already remembered ${existing} (same body within 10 minutes)` },
        ],
      };
    }
    const id = newEntryId(input.body, now);
    const entry: Entry = {
      id,
      created: now.toISOString(),
      body: input.body,
      kind: input.kind,
      source: SOURCE,
      tags: normalizeTags(input.tags),
      related: input.related,
      stance: input.stance,
      origin: input.origin,
      project: input.project ?? resolveProject(),
    };
    writeEntry(entry);
    upsertEntry(db, entry);
    appendLog("remember", { id, kind: entry.kind, tags: entry.tags });
    // Fire-and-forget embed: search works without it; rerun via `zuun embed`.
    void defaultProvider
      .embed(entry.body)
      .then((vec) => {
        if (!vec) return;
        const db2 = openDb();
        try {
          setEmbedding(db2, id, vec);
        } finally {
          db2.close();
        }
      })
      .catch(() => {});
    const tagLine = entry.tags.length ? ` · tags: ${entry.tags.join(", ")}` : "";
    return {
      content: [
        { type: "text", text: `saved ${id} (${entry.kind}${tagLine})\n${entry.body}` },
      ],
    };
  } finally {
    db.close();
  }
}

async function handleContextFor(args: unknown) {
  const input = ContextForInput.parse(args);
  const db = openDb();
  try {
    const project = resolveProject();
    const qVec = await defaultProvider.embed(input.task);
    const results = search(db, {
      query: input.task,
      queryVec: qVec ?? undefined,
      limit: input.limit,
      project: project ?? undefined,
    });
    appendLog("context_for", { task: input.task.slice(0, 120), project, hits: results.length });
    const text = results.length === 0 ? "no prior context" : formatResults(results);
    return { content: [{ type: "text", text }] };
  } finally {
    db.close();
  }
}

function formatResults(results: SearchResult[]): string {
  const lines = [`Found ${results.length} entries:\n`];
  const now = Date.now();
  for (const r of results) {
    const age = relativeAge(now - new Date(r.entry.created).getTime());
    const tags = r.entry.tags.length ? ` · tags: ${r.entry.tags.join(", ")}` : "";
    lines.push(`- ${r.entry.id} · ${r.entry.kind} · ${age}${tags}`);
    lines.push(`  ${r.entry.body.replace(/\n/g, " ")}`);
  }
  return lines.join("\n");
}

function relativeAge(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
