import type { Entry } from "./entry";

/**
 * Re-audit cadence. ENT-260420-4BDD committed to a corpus re-audit "at ~50
 * entries"; ENT-260514-98FC observed that passive scheduling let the corpus
 * run 67 entries past that point before an audit fired. doctor enforces it.
 */
export const AUDIT_THRESHOLD = 50;

/** Entries tagged this are treated as the marker an audit was performed. */
const AUDIT_TAG = "audit";

export interface AuditStatus {
  lastAuditId: string | null;
  lastAuditAt: string | null;
  /** Entries created strictly after the last audit (or total if never audited). */
  sinceAudit: number;
  overdue: boolean;
}

/**
 * Audit state derived from the corpus itself — no sidecar file to drift out of
 * sync. An audit run leaves entries tagged `audit`; the newest one marks when
 * the last audit happened. Entries created after it are the un-audited backlog.
 */
export function auditStatus(entries: Entry[]): AuditStatus {
  let last: Entry | null = null;
  for (const e of entries) {
    if (e.tags.includes(AUDIT_TAG) && (last === null || e.created > last.created)) {
      last = e;
    }
  }

  if (last === null) {
    const sinceAudit = entries.length;
    return { lastAuditId: null, lastAuditAt: null, sinceAudit, overdue: sinceAudit >= AUDIT_THRESHOLD };
  }

  const cutoff = last.created;
  const sinceAudit = entries.reduce((n, e) => (e.created > cutoff ? n + 1 : n), 0);
  return {
    lastAuditId: last.id,
    lastAuditAt: last.created,
    sinceAudit,
    overdue: sinceAudit >= AUDIT_THRESHOLD,
  };
}
