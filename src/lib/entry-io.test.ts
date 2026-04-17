import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { writeEntry, readEntry, listEntryIds } from "./entry-io";
import type { Entry } from "./entry";

describe("entry-io", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-test-"));
    process.env.ZUUN_HOME = tmp;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  const fixture: Entry = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    // Body ends with \n per the canonical on-disk form invariant.
    body: "Decided to go local-first because portability is the moat.\n",
    kind: "decision",
    source: "manual",
    tags: ["architecture", "v0"],
    related: [],
  };

  it("round-trips an entry through disk", () => {
    writeEntry(fixture);
    expect(readEntry(fixture.id)).toEqual(fixture);
  });

  it("canonicalizes body to end with a single newline on write", () => {
    const noTrailing: Entry = { ...fixture, body: "body without trailing newline" };
    writeEntry(noTrailing);
    const readBack = readEntry(noTrailing.id);
    expect(readBack.body).toBe("body without trailing newline\n");
  });

  it("preserves body whitespace including trailing newlines", () => {
    const withNewlines: Entry = { ...fixture, body: "line 1\n\nline 2\n" };
    writeEntry(withNewlines);
    expect(readEntry(withNewlines.id).body).toBe("line 1\n\nline 2\n");
  });

  it("creates the entries directory on first write", () => {
    writeEntry(fixture);
    expect(fs.existsSync(path.join(tmp, "entries"))).toBe(true);
  });

  it("writes atomically — no .tmp files remain after success", () => {
    writeEntry(fixture);
    const files = fs.readdirSync(path.join(tmp, "entries"));
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("throws on a malformed entry file instead of silently dropping", () => {
    const bogus = path.join(tmp, "entries", "ENT-260416-0000.md");
    fs.mkdirSync(path.dirname(bogus), { recursive: true });
    fs.writeFileSync(bogus, "---\nid: not-a-valid-id\n---\nbody");
    expect(() => readEntry("ENT-260416-0000")).toThrow();
  });

  it("listEntryIds returns all entry IDs in the store", () => {
    writeEntry(fixture);
    writeEntry({ ...fixture, id: "ENT-260416-BEEF" });
    expect(listEntryIds().sort()).toEqual(["ENT-260416-3A7F", "ENT-260416-BEEF"]);
  });

  it("listEntryIds returns [] when entries dir is absent", () => {
    expect(listEntryIds()).toEqual([]);
  });

  it("listEntryIds ignores hidden files and non-md", () => {
    fs.mkdirSync(path.join(tmp, "entries"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "entries", ".DS_Store"), "");
    fs.writeFileSync(path.join(tmp, "entries", "notes.txt"), "");
    writeEntry(fixture);
    expect(listEntryIds()).toEqual([fixture.id]);
  });
});
