import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runDoctor } from "./doctor";
import { writeEntry } from "./entry-io";
import { openDb } from "./db";
import { upsertEntry } from "./store";
import type { Entry } from "./entry";

describe("doctor", () => {
  let tmp: string;
  const originalFetch = globalThis.fetch;

  const fixture: Entry = {
    id: "ENT-260416-AAAA",
    created: "2026-04-16T10:00:00.000Z",
    body: "body",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-doctor-"));
    process.env.ZUUN_HOME = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
    globalThis.fetch = originalFetch;
  });

  it("reports healthy on a fresh store with Ollama mocked up", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: Array(768).fill(0.1) }),
    } as Response);
    openDb().close();
    const r = await runDoctor();
    expect(r.healthy).toBe(true);
    expect(r.text).toMatch(/entries on disk: 0/);
    expect(r.text).toMatch(/entries in db: 0/);
    expect(r.text).toMatch(/ollama: up/);
  });

  it("reports drift when disk and db disagree", async () => {
    writeEntry(fixture);
    const db = openDb();
    db.close();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await runDoctor();
    expect(r.healthy).toBe(false);
    expect(r.text).toMatch(/drift/i);
  });

  it("reports broken related refs", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const db = openDb();
    writeEntry({ ...fixture, related: ["ENT-260101-FACE"] });
    upsertEntry(db, { ...fixture, related: ["ENT-260101-FACE"] });
    db.close();
    const r = await runDoctor();
    expect(r.text).toMatch(/broken related.*1/i);
  });

  it("reports Ollama down without failing overall health", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    openDb().close();
    const r = await runDoctor();
    expect(r.healthy).toBe(true);
    expect(r.text).toMatch(/ollama: down/);
  });

  function hex(n: number): string {
    return n.toString(16).toUpperCase().padStart(4, "0");
  }

  it("flags audit overdue and fails health when the un-audited backlog hits the threshold", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const db = openDb();
    const audit: Entry = {
      ...fixture,
      id: "ENT-260514-0AAA",
      created: "2026-05-14T00:00:00.000Z",
      tags: ["audit"],
    };
    writeEntry(audit);
    upsertEntry(db, audit);
    for (let i = 0; i < 50; i++) {
      const e: Entry = {
        ...fixture,
        id: `ENT-260515-${hex(i)}`,
        created: `2026-05-15T00:00:${String(i).padStart(2, "0")}.000Z`,
      };
      writeEntry(e);
      upsertEntry(db, e);
    }
    db.close();
    const r = await runDoctor();
    expect(r.healthy).toBe(false);
    expect(r.text).toMatch(/audit overdue/i);
    expect(r.text).toMatch(/50/);
    expect(r.text).toMatch(/re-audit/i);
    // Provenance IDs belong in code comments, not user-facing output.
    expect(r.text).not.toMatch(/ENT-260420-4BDD/);
  });

  it("stays healthy and reports audit current when the backlog is below threshold", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const db = openDb();
    const audit: Entry = {
      ...fixture,
      id: "ENT-260514-0AAA",
      created: "2026-05-14T00:00:00.000Z",
      tags: ["audit"],
    };
    writeEntry(audit);
    upsertEntry(db, audit);
    for (let i = 0; i < 3; i++) {
      const e: Entry = {
        ...fixture,
        id: `ENT-260515-${hex(i)}`,
        created: `2026-05-15T00:00:0${i}.000Z`,
      };
      writeEntry(e);
      upsertEntry(db, e);
    }
    db.close();
    const r = await runDoctor();
    expect(r.healthy).toBe(true);
    expect(r.text).toMatch(/audit:/);
    expect(r.text).not.toMatch(/audit overdue/i);
  });
});
