import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

const SKILL = path.resolve(__dirname, "..", "skills", "reflect", "SKILL.md");

describe("/zuun:reflect skill", () => {
  it("exists", () => {
    expect(fs.existsSync(SKILL)).toBe(true);
  });

  it("is user-invoked only", () => {
    const { data } = matter(fs.readFileSync(SKILL, "utf8"));
    expect(data["disable-model-invocation"]).toBe(true);
  });

  it("has a descriptive frontmatter", () => {
    const { data } = matter(fs.readFileSync(SKILL, "utf8"));
    expect(typeof data.description).toBe("string");
    expect((data.description as string).length).toBeGreaterThan(40);
  });

  it("references the remember tool in its body", () => {
    const { content } = matter(fs.readFileSync(SKILL, "utf8"));
    expect(content).toMatch(/remember/);
  });

  it("instructs the agent to limit to a handful of entries", () => {
    const { content } = matter(fs.readFileSync(SKILL, "utf8"));
    expect(content).toMatch(/\b(2[\s–-]5|handful|few|at most)\b/i);
  });
});
