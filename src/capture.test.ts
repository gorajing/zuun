import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Readable } from "stream";
import { capture } from "./capture";

describe("capture", () => {
  let tmp: string;
  let originalStdin: NodeJS.ReadStream;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-capture-"));
    process.env.ZUUN_HOME = tmp;
    originalStdin = process.stdin;
  });

  afterEach(() => {
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
});
