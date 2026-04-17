import { describe, it, expect } from "vitest";
import { normalizeTag, normalizeTags } from "./tags";

describe("normalizeTag", () => {
  it("lowercases", () => expect(normalizeTag("Architecture")).toBe("architecture"));
  it("trims", () => expect(normalizeTag("  auth  ")).toBe("auth"));
  it("collapses internal whitespace to dash", () =>
    expect(normalizeTag("code review")).toBe("code-review"));
  it("preserves existing dashes and underscores", () =>
    expect(normalizeTag("pre-alpha_notes")).toBe("pre-alpha_notes"));
  it("drops whitespace-only input", () => expect(normalizeTag("   ")).toBe(""));
});

describe("normalizeTags", () => {
  it("normalizes each tag and dedupes", () => {
    expect(normalizeTags(["Architecture", "architecture", "AUTH"])).toEqual([
      "architecture",
      "auth",
    ]);
  });
  it("filters empty tags after normalization", () => {
    expect(normalizeTags(["arch", "   ", ""])).toEqual(["arch"]);
  });
  it("preserves order of first occurrence", () => {
    expect(normalizeTags(["b", "a", "B"])).toEqual(["b", "a"]);
  });
});
