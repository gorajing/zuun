import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { runSessionStart } from "./session-start";
import { upsertEntry } from "../lib/store";
import { openDb } from "../lib/db";
import type { Entry } from "../lib/entry";

describe("session-start hook", () => {
  let tmp: string;
  let stdout = "";
  const origWrite = process.stdout.write.bind(process.stdout);

  function mkProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-proj-"));
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: dir });
    return fs.realpathSync(dir);
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-hook-"));
    process.env.ZUUN_HOME = tmp;
    stdout = "";
    process.stdout.write = ((s: string) => {
      stdout += s;
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
    process.stdout.write = origWrite;
  });

  it("emits nothing and logs 'no-entries' when store is empty", async () => {
    const proj = mkProject();
    await runSessionStart({ cwd: proj });
    expect(stdout).toBe("");
    const log = fs.readFileSync(path.join(tmp, "log.jsonl"), "utf8");
    expect(log).toMatch(/session_start\.miss.*no-entries/);
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("emits JSON with additionalContext when project-scoped entries exist", async () => {
    const proj = mkProject();
    const db = openDb();
    const e: Entry = {
      id: "ENT-260416-AAAA",
      created: "2026-04-16T10:00:00.000Z",
      body: "Zuun stores memory in markdown + sqlite locally.",
      kind: "decision",
      source: "manual",
      tags: ["zuun"],
      related: [],
      project: proj,
    };
    upsertEntry(db, e);
    db.close();

    await runSessionStart({ cwd: proj });
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("ENT-260416-AAAA");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("markdown");
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("excludes entries from other projects but includes global (no-project) entries", async () => {
    const proj = mkProject();
    const db = openDb();
    upsertEntry(db, {
      id: "ENT-260416-AAAA",
      created: "2026-04-16T10:00:00.000Z",
      body: "same project body",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
      project: proj,
    });
    upsertEntry(db, {
      id: "ENT-260416-BBBB",
      created: "2026-04-16T10:00:00.000Z",
      body: "other project body",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
      project: "/some/other/project",
    });
    upsertEntry(db, {
      id: "ENT-260416-CCCC",
      created: "2026-04-16T10:00:00.000Z",
      body: "global insight applies everywhere",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
    });
    db.close();

    await runSessionStart({ cwd: proj });
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } };
    expect(parsed.hookSpecificOutput.additionalContext).toContain("ENT-260416-AAAA");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("ENT-260416-CCCC");
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain("ENT-260416-BBBB");
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("returns entries sorted by created DESC (newest first)", async () => {
    const proj = mkProject();
    const db = openDb();
    upsertEntry(db, {
      id: "ENT-260415-0D01",
      created: "2026-04-15T10:00:00.000Z",
      body: "older memory",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
      project: proj,
    });
    upsertEntry(db, {
      id: "ENT-260416-0E01",
      created: "2026-04-16T10:00:00.000Z",
      body: "newer memory",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
      project: proj,
    });
    db.close();

    await runSessionStart({ cwd: proj });
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } };
    const ctx = parsed.hookSpecificOutput.additionalContext;
    expect(ctx.indexOf("ENT-260416-0E01")).toBeLessThan(ctx.indexOf("ENT-260415-0D01"));
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("skips observations — only high-signal kinds are surfaced", async () => {
    const proj = mkProject();
    const db = openDb();
    upsertEntry(db, {
      id: "ENT-260416-0B51",
      created: "2026-04-16T12:00:00.000Z",
      body: "yesterday's debugging noise",
      kind: "observation",
      source: "manual",
      tags: [],
      related: [],
      project: proj,
    });
    upsertEntry(db, {
      id: "ENT-260416-DEC1",
      created: "2026-04-15T09:00:00.000Z",
      body: "architectural decision worth keeping",
      kind: "decision",
      source: "manual",
      tags: [],
      related: [],
      project: proj,
    });
    db.close();

    await runSessionStart({ cwd: proj });
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } };
    expect(parsed.hookSpecificOutput.additionalContext).toContain("ENT-260416-DEC1");
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain("ENT-260416-0B51");
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("caps output at 2000 chars", async () => {
    const proj = mkProject();
    const db = openDb();
    for (let i = 0; i < 20; i++) {
      upsertEntry(db, {
        id: `ENT-260416-${i.toString(16).padStart(4, "0").toUpperCase()}`,
        created: "2026-04-16T10:00:00.000Z",
        body: "long body ".repeat(100),
        kind: "pattern",
        source: "manual",
        tags: [],
        related: [],
        project: proj,
      });
    }
    db.close();

    await runSessionStart({ cwd: proj });
    const parsed = JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } };
    expect(parsed.hookSpecificOutput.additionalContext.length).toBeLessThanOrEqual(2000);
    fs.rmSync(proj, { recursive: true, force: true });
  });

  it("logs 'no-project' when cwd can't be resolved", async () => {
    await runSessionStart({ cwd: "/nonexistent/path/xyz" });
    expect(stdout).toBe("");
    const log = fs.readFileSync(path.join(tmp, "log.jsonl"), "utf8");
    expect(log).toMatch(/session_start\.miss.*no-project/);
  });

  it("never throws on internal error (logs instead)", async () => {
    process.env.ZUUN_HOME = "/nonexistent/path/that/cannot/be/created/hopefully";
    await expect(runSessionStart({ cwd: "/x" })).resolves.not.toThrow();
  });
});
