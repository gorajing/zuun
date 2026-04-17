import { describe, it, expect } from "vitest";
import { EntrySchema, ENTRY_ID_REGEX } from "./entry";

describe("EntrySchema", () => {
  const valid = {
    id: "ENT-260416-3A7F",
    created: "2026-04-16T14:22:00.000Z",
    body: "Decided to go local-first because portability is the moat.",
    kind: "decision" as const,
    source: "claude-code" as const,
  };

  it("accepts a minimal valid entry", () => {
    const parsed = EntrySchema.parse(valid);
    expect(parsed.id).toBe("ENT-260416-3A7F");
    expect(parsed.tags).toEqual([]);
    expect(parsed.related).toEqual([]);
  });

  it("rejects malformed IDs", () => {
    expect(() => EntrySchema.parse({ ...valid, id: "ent-260416-3A7F" })).toThrow();
    expect(() => EntrySchema.parse({ ...valid, id: "ENT-260416-xyz" })).toThrow();
  });

  it("accepts mixed-case confidence (case-insensitive preprocess)", () => {
    const parsed = EntrySchema.parse({ ...valid, confidence: "Medium" });
    expect(parsed.confidence).toBe("medium");
  });

  it("rejects empty body", () => {
    expect(() => EntrySchema.parse({ ...valid, body: "" })).toThrow();
  });

  it("rejects unknown kind", () => {
    expect(() => EntrySchema.parse({ ...valid, kind: "insight" })).toThrow();
  });

  it("stance is optional", () => {
    const parsed = EntrySchema.parse({ ...valid, stance: "Local-first wins" });
    expect(parsed.stance).toBe("Local-first wins");
  });

  it("ID regex matches expected shape", () => {
    expect(ENTRY_ID_REGEX.test("ENT-260416-ABCD")).toBe(true);
    expect(ENTRY_ID_REGEX.test("ENT-260416-abcd")).toBe(false);
    expect(ENTRY_ID_REGEX.test("ENT-26416-ABCD")).toBe(false);
  });

  it("accepts project as optional string", () => {
    const parsed = EntrySchema.parse({ ...valid, project: "/work/acme" });
    expect(parsed.project).toBe("/work/acme");
  });

  it("project is optional and defaults to undefined", () => {
    const parsed = EntrySchema.parse(valid);
    expect(parsed.project).toBeUndefined();
  });

  it("rejects non-string project", () => {
    expect(() => EntrySchema.parse({ ...valid, project: 123 })).toThrow();
  });
});
