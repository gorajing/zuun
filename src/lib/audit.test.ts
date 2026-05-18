import { describe, it, expect } from "vitest";
import { auditStatus, AUDIT_THRESHOLD } from "./audit";
import type { Entry } from "./entry";

function entry(over: Partial<Entry> & Pick<Entry, "id" | "created">): Entry {
  return {
    body: "body",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
    ...over,
  };
}

describe("auditStatus", () => {
  it("threshold is 50 (from ENT-260420-4BDD: re-audit at ~50 entries)", () => {
    expect(AUDIT_THRESHOLD).toBe(50);
  });

  it("finds the newest audit-tagged entry as the last audit", () => {
    const entries = [
      entry({ id: "ENT-260301-0001", created: "2026-03-01T00:00:00.000Z", tags: ["audit"] }),
      entry({ id: "ENT-260514-0AUD", created: "2026-05-14T00:00:00.000Z", tags: ["audit", "meta"] }),
      entry({ id: "ENT-260410-0002", created: "2026-04-10T00:00:00.000Z", tags: ["audit"] }),
    ];
    const s = auditStatus(entries);
    expect(s.lastAuditId).toBe("ENT-260514-0AUD");
    expect(s.lastAuditAt).toBe("2026-05-14T00:00:00.000Z");
  });

  it("counts only entries created strictly after the last audit (audit's own outputs excluded)", () => {
    const entries = [
      entry({ id: "ENT-260514-0AUD", created: "2026-05-14T00:00:00.000Z", tags: ["audit"] }),
      // captured in the same audit run — same timestamp, must NOT count as "since"
      entry({ id: "ENT-260514-0OUT", created: "2026-05-14T00:00:00.000Z", tags: ["audit", "x"] }),
      entry({ id: "ENT-260515-0003", created: "2026-05-15T00:00:00.000Z" }),
      entry({ id: "ENT-260516-0004", created: "2026-05-16T00:00:00.000Z" }),
    ];
    const s = auditStatus(entries);
    expect(s.sinceAudit).toBe(2);
  });

  it("is not overdue when entries since last audit are below threshold", () => {
    const entries = [
      entry({ id: "ENT-260514-0AUD", created: "2026-05-14T00:00:00.000Z", tags: ["audit"] }),
      ...Array.from({ length: 49 }, (_, i) =>
        entry({ id: `ENT-260515-${String(i).padStart(4, "0")}`, created: `2026-05-15T00:00:${String(i).padStart(2, "0")}.000Z` }),
      ),
    ];
    const s = auditStatus(entries);
    expect(s.sinceAudit).toBe(49);
    expect(s.overdue).toBe(false);
  });

  it("is overdue when entries since last audit reach the threshold", () => {
    const entries = [
      entry({ id: "ENT-260514-0AUD", created: "2026-05-14T00:00:00.000Z", tags: ["audit"] }),
      ...Array.from({ length: 50 }, (_, i) =>
        entry({ id: `ENT-260515-${String(i).padStart(4, "0")}`, created: `2026-05-15T00:00:${String(i).padStart(2, "0")}.000Z` }),
      ),
    ];
    const s = auditStatus(entries);
    expect(s.sinceAudit).toBe(50);
    expect(s.overdue).toBe(true);
  });

  it("treats a corpus that was never audited as measured against total", () => {
    const entries = Array.from({ length: 50 }, (_, i) =>
      entry({ id: `ENT-260515-${String(i).padStart(4, "0")}`, created: `2026-05-15T00:00:${String(i).padStart(2, "0")}.000Z` }),
    );
    const s = auditStatus(entries);
    expect(s.lastAuditId).toBeNull();
    expect(s.lastAuditAt).toBeNull();
    expect(s.sinceAudit).toBe(50);
    expect(s.overdue).toBe(true);
  });

  it("an empty corpus is never overdue", () => {
    const s = auditStatus([]);
    expect(s.lastAuditId).toBeNull();
    expect(s.sinceAudit).toBe(0);
    expect(s.overdue).toBe(false);
  });
});
