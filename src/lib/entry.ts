import { z } from "zod";

/**
 * An Entry is anything worth remembering from your work.
 *
 * This schema is load-bearing. It sets:
 *   - the ceiling on retrieval quality (what fields exist to rank/filter by),
 *   - the floor on capture success (what fields a capture must produce).
 *
 * Design bias: small required set, rich optional set. Auto-capture from
 * Claude Code sessions cannot reliably produce a stance, so stance is
 * optional. But capture can always produce body, kind, and source.
 *
 * If required vs. optional is wrong, it's easy to migrate early. It gets
 * hard once there are thousands of entries. Think hard before changing.
 */

// ID format: ENT-YYMMDD-XXXX where XXXX is 4 hex chars.
export const ENTRY_ID_REGEX = /^ENT-\d{6}-[A-F0-9]{4}$/;

export const EntryKind = z.enum([
  "decision",    // a choice made, with reasoning
  "observation", // something noticed about how the world works
  "pattern",     // a reusable approach or shape
  "commitment",  // a promise made to future-self
  "reference",   // a piece of context worth preserving (snippet, link, spec)
]);
export type EntryKind = z.infer<typeof EntryKind>;

export const EntrySource = z.enum([
  "claude-code", // auto-captured from a Claude Code session
  "cursor",      // auto-captured from Cursor
  "git",         // captured from a commit / PR / diff
  "manual",      // user typed it in via remember() or CLI
  "import",      // bulk-imported from another system
]);
export type EntrySource = z.infer<typeof EntrySource>;

export const Confidence = z.preprocess(
  // case-insensitive accept; avoids the silent-drop bug from Zuhn's review
  (v) => (typeof v === "string" ? v.toLowerCase() : v),
  z.enum(["low", "medium", "high"]),
);
export type Confidence = z.infer<typeof Confidence>;

export const EntrySchema = z.object({
  // --- required ---
  id: z.string().regex(ENTRY_ID_REGEX),
  created: z.string().datetime(),
  body: z.string().min(1),
  kind: EntryKind,
  source: EntrySource,

  // --- optional, but the retrieval layer leans on these ---

  /** One-line directional claim, assertable as true or false. */
  stance: z.string().optional(),

  /** Freeform tags. No ontology, no hierarchy. Retrieval handles grouping. */
  tags: z.array(z.string()).default([]),

  /** Advisory links to other entry IDs. Not validated; broken refs are fine. */
  related: z.array(z.string()).default([]),

  /** Self-assessed confidence in the entry's claim. */
  confidence: Confidence.optional(),

  /** Where this came from — git sha, session id, URL, file path, etc. */
  origin: z.string().optional(),
});

export type Entry = z.infer<typeof EntrySchema>;
