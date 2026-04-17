import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { resolveProject } from "./project";

describe("resolveProject", () => {
  const origCwd = process.cwd();
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-project-"));
  });

  afterEach(() => {
    process.chdir(origCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns the git repo toplevel when cwd is inside a repo", () => {
    execFileSync("git", ["init", "--initial-branch=main"], { cwd: tmp });
    const subdir = path.join(tmp, "api", "src");
    fs.mkdirSync(subdir, { recursive: true });
    expect(resolveProject(subdir)).toBe(fs.realpathSync(tmp));
  });

  it("returns undefined when not inside a repo (entry is global)", () => {
    expect(resolveProject(tmp)).toBeUndefined();
  });

  it("defaults to process.cwd() when no argument passed", () => {
    process.chdir(tmp);
    // tmp is not a git repo → undefined → global capture
    expect(resolveProject()).toBeUndefined();
  });

  it("returns undefined for a nonexistent path", () => {
    expect(resolveProject("/nonexistent/path/that/cannot/exist/xyz")).toBeUndefined();
  });
});
