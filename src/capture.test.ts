import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { capture } from "./capture";
import { readEntry, listEntryIds } from "./lib/entry-io";

describe("capture", () => {
  let tmp: string;
  let originalStdin: NodeJS.ReadStream;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-capture-"));
    process.env.ZUUN_HOME = tmp;
    originalStdin = process.stdin;
  });

  afterEach(() => {
    // Restore here, not just per-test: a failing assertion throws before an
    // inline errSpy.mockRestore(), which would otherwise leak the process.stderr
    // spy into the next test.
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
  });

  function pipeStdin(text: string) {
    const stream = Readable.from([text]);
    Object.defineProperty(process, "stdin", { value: stream, configurable: true });
  }

  it("writes an entry from stdin with default kind=observation", async () => {
    pipeStdin("A thing I noticed.");
    expect(await capture([])).toBe(0);
    const files = fs.readdirSync(path.join(tmp, "entries"));
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(tmp, "entries", files[0]!), "utf8");
    expect(content).toContain("kind: observation");
    expect(content).toContain("A thing I noticed");
  });

  it("honors --kind", async () => {
    pipeStdin("A decision.");
    await capture(["--kind", "decision"]);
    const [file] = fs.readdirSync(path.join(tmp, "entries"));
    expect(fs.readFileSync(path.join(tmp, "entries", file!), "utf8")).toContain("kind: decision");
  });

  it("honors --tag (repeatable) and normalizes tags", async () => {
    pipeStdin("Tagged thing.");
    await capture(["--tag", "Architecture", "--tag", "V0", "--tag", "architecture"]);
    const [file] = fs.readdirSync(path.join(tmp, "entries"));
    const content = fs.readFileSync(path.join(tmp, "entries", file!), "utf8");
    expect(content).toContain("architecture");
    expect(content).toContain("v0");
    expect(content.match(/architecture/g)?.length).toBe(1);
  });

  it("dedupes a repeat within the window", async () => {
    pipeStdin("repeat body");
    await capture([]);
    pipeStdin("repeat body");
    const code = await capture([]);
    expect(code).toBe(0);
    expect(fs.readdirSync(path.join(tmp, "entries")).length).toBe(1);
  });

  it("rejects empty stdin", async () => {
    pipeStdin("");
    expect(await capture([])).not.toBe(0);
  });

  it("rejects invalid --kind", async () => {
    pipeStdin("body");
    expect(await capture(["--kind", "unknown-kind"])).not.toBe(0);
  });

  it("routes an ENT-shaped --tag into related, drops it from tags, and warns", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    pipeStdin("An entry that references another.");
    const code = await capture(["--tag", "architecture", "--tag", "ENT-260501-DE46"]);
    expect(code).toBe(0);
    const e = readEntry(listEntryIds()[0]!);
    expect(e.tags).toEqual(["architecture"]);
    expect(e.related).toEqual(["ENT-260501-DE46"]);
    expect(errSpy.mock.calls.map((c) => String(c[0])).join("")).toMatch(/ENT-260501-DE46/);
    errSpy.mockRestore();
  });

  it("canonicalizes a lowercase ent --tag to uppercase in related", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    pipeStdin("Lowercase ent ref.");
    await capture(["--tag", "ent-260501-de46"]);
    const e = readEntry(listEntryIds()[0]!);
    expect(e.tags).toEqual([]);
    expect(e.related).toEqual(["ENT-260501-DE46"]);
    errSpy.mockRestore();
  });

  it("captures a short untagged decision but warns it looks like a stub", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    pipeStdin("Use SQLite.");
    const code = await capture(["--kind", "decision"]);
    expect(code).toBe(0);
    expect(listEntryIds().length).toBe(1);
    const warnings = errSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(warnings).toMatch(/short decision|stub/i);
    // Private corpus spec IDs must not leak into user-facing output.
    expect(warnings).not.toMatch(/ENT-260514-75A3/);
    errSpy.mockRestore();
  });

  it("does not warn for a short decision that carries a tag", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    pipeStdin("Use SQLite.");
    await capture(["--kind", "decision", "--tag", "storage"]);
    const warnings = errSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(warnings).not.toMatch(/short decision|stub/i);
    errSpy.mockRestore();
  });

  it("does not warn for a normal observation", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    pipeStdin("A short note.");
    await capture([]);
    expect(errSpy.mock.calls.map((c) => String(c[0])).join("")).toBe("");
    errSpy.mockRestore();
  });
});
