import { ENTRY_ID_REGEX } from "./entry";

/**
 * Capture-path lints derived from the 2026-05-14 corpus audit.
 *
 * These run on the *raw* capture input, before tag normalization — by design.
 * `normalizeTags` lowercases, but ENTRY_ID_REGEX is uppercase-hex only, so an
 * ENT token routed after normalization would be undetectable (ENT-260514-4BA0).
 */

function isEntToken(raw: string): boolean {
  return ENTRY_ID_REGEX.test(raw.trim().toUpperCase());
}

export interface TagRouting {
  /** Input tags with ENT-shaped tokens removed (still raw, not yet normalized). */
  tags: string[];
  /** Input related plus the canonical-uppercase routed IDs, deduped. */
  related: string[];
  /** Canonical IDs moved out of tags — empty when the lint did not fire. */
  routed: string[];
}

/**
 * ENT-token-in-tags lint (ENT-260514-4BA0). Tag-index pollution: entry IDs
 * listed under `tags:` instead of `related:`. Strip ENT-shaped tokens from
 * tags and route them to related as canonical uppercase IDs.
 */
export function routeEntTokensFromTags(tags: string[], related: string[]): TagRouting {
  const keptTags: string[] = [];
  const relatedSeen = new Set(related.map((r) => r.toUpperCase()));
  const mergedRelated = [...related];
  const routedSeen = new Set<string>();
  const routed: string[] = [];

  for (const t of tags) {
    if (!isEntToken(t)) {
      keptTags.push(t);
      continue;
    }
    const id = t.trim().toUpperCase();
    // routed = every ENT token stripped from tags (deduped), even if it was
    // already in related — the polluting tag was still removed and should be
    // reported. mergedRelated only gains IDs not already linked.
    if (!routedSeen.has(id)) {
      routedSeen.add(id);
      routed.push(id);
    }
    if (!relatedSeen.has(id)) {
      relatedSeen.add(id);
      mergedRelated.push(id);
    }
  }

  return { tags: keptTags, related: mergedRelated, routed };
}

/**
 * A decision shorter than this (trimmed) with no tags reads as transient
 * state, not a durable choice — likely an accidental auto-capture.
 */
export const SHORT_DECISION_MAX = 80;

/**
 * short-decision-no-tags lint (ENT-260514-75A3). A `kind=decision` entry whose
 * trimmed body is under SHORT_DECISION_MAX with no tags is a stub-capture
 * candidate. Soft signal — capture still succeeds; the author verifies.
 */
export function isShortDecisionNoTags(input: {
  kind: string;
  body: string;
  tags: string[];
}): boolean {
  return (
    input.kind === "decision" &&
    input.body.trim().length < SHORT_DECISION_MAX &&
    input.tags.length === 0
  );
}
