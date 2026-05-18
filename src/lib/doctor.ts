import { openDb, SCHEMA_VERSION } from "./db";
import { listEntryIds } from "./entry-io";
import { listEntries } from "./store";
import { defaultProvider } from "./embed-provider";
import { tailLog } from "./log";
import { auditStatus, AUDIT_THRESHOLD } from "./audit";

export async function runDoctor(): Promise<{ healthy: boolean; text: string }> {
  const db = openDb();
  const lines: string[] = [];
  let healthy = true;

  try {
    const onDisk = listEntryIds();
    const inDb = listEntries(db);
    lines.push(`schema_version: ${SCHEMA_VERSION}`);
    lines.push(`entries on disk: ${onDisk.length}`);
    lines.push(`entries in db: ${inDb.length}`);
    if (onDisk.length !== inDb.length) {
      healthy = false;
      lines.push("WARN: drift between disk and db — run 'zuun reindex'");
    }

    const ids = new Set(inDb.map((e) => e.id));
    let broken = 0;
    for (const e of inDb) {
      for (const r of e.related) {
        if (!ids.has(r)) broken++;
      }
    }
    lines.push(`broken related refs: ${broken}`);

    // Audit-cadence enforcement; provenance: ENT-260420-4BDD, ENT-260514-98FC
    // (see audit.ts). Spec IDs stay in comments — output must stand alone for
    // users who don't have this corpus.
    const audit = auditStatus(inDb);
    if (audit.overdue) {
      healthy = false;
      const baseline = audit.lastAuditId
        ? `last audit ${audit.lastAuditId} (${audit.lastAuditAt})`
        : "no audit on record";
      lines.push(
        `WARN: audit overdue — ${audit.sinceAudit} entries since ${
          audit.lastAuditId ? "last audit" : "first capture"
        } (threshold ${AUDIT_THRESHOLD}); ${baseline}; run a corpus re-audit`,
      );
    } else if (audit.lastAuditId) {
      lines.push(
        `audit: ${audit.sinceAudit} entries since last audit ${audit.lastAuditId} (threshold ${AUDIT_THRESHOLD})`,
      );
    } else {
      lines.push(`audit: ${audit.sinceAudit} entries, never audited (threshold ${AUDIT_THRESHOLD})`);
    }

    const vec = await defaultProvider.embed("doctor-check");
    lines.push(`ollama: ${vec ? "up" : "down"}`);
    if (!vec) lines.push("  note: embeddings are optional; FTS still works");

    const tail = tailLog(5);
    if (tail.length > 0) {
      lines.push("recent log:");
      for (const l of tail) lines.push(`  ${l.at} ${l.event} ${JSON.stringify(l.payload)}`);
    }
  } finally {
    db.close();
  }

  return { healthy, text: lines.join("\n") + "\n" };
}
