import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { captureCommit } from "./capture-commit";

describe("capture-commit", () => {
  let zuunHome: string;
  let repo: string;
  const origCwd = process.cwd();

  beforeEach(() => {
    zuunHome = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-home-"));
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-repo-"));
    process.env.ZUUN_HOME = zuunHome;
    process.chdir(repo);
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "t@x"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "README.md"), "hi");
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    execFileSync("git", ["commit", "-m", "feat: introduce README"], { cwd: repo });
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(zuunHome, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("captures the latest commit as an Entry", async () => {
    expect(await captureCommit([])).toBe(0);
    const files = fs.readdirSync(path.join(zuunHome, "entries"));
    expect(files.length).toBe(1);
    const body = fs.readFileSync(path.join(zuunHome, "entries", files[0]!), "utf8");
    expect(body).toMatch(/feat: introduce README/);
    expect(body).toMatch(/source: git/);
    expect(body).toMatch(/kind: pattern/);
  });

  it("includes changed files for the root commit (--root flag)", async () => {
    await captureCommit([]);
    const files = fs.readdirSync(path.join(zuunHome, "entries"));
    const body = fs.readFileSync(path.join(zuunHome, "entries", files[0]!), "utf8");
    expect(body).toMatch(/README\.md/);
  });

  it("populates project with the repo toplevel", async () => {
    await captureCommit([]);
    const files = fs.readdirSync(path.join(zuunHome, "entries"));
    const body = fs.readFileSync(path.join(zuunHome, "entries", files[0]!), "utf8");
    expect(body).toMatch(new RegExp(`project:\\s*${fs.realpathSync(repo).replace(/\//g, "\\/")}`));
  });

  it("maps chore: to decision", async () => {
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    execFileSync("git", ["add", "a.txt"], { cwd: repo });
    execFileSync("git", ["commit", "-m", "chore: add tooling"], { cwd: repo });
    await captureCommit([]);
    const files = fs.readdirSync(path.join(zuunHome, "entries")).sort();
    const last = fs.readFileSync(path.join(zuunHome, "entries", files[files.length - 1]!), "utf8");
    expect(last).toMatch(/kind: decision/);
  });

  it("is a no-op when not inside a git repo", async () => {
    process.chdir(os.tmpdir());
    expect(await captureCommit([])).toBe(0);
    const entriesDir = path.join(zuunHome, "entries");
    const files = fs.existsSync(entriesDir) ? fs.readdirSync(entriesDir) : [];
    expect(files.length).toBe(0);
  });
});
