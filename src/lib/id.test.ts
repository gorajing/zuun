import { describe, it, expect } from "vitest";
import { newEntryId } from "./id";
import { ENTRY_ID_REGEX } from "./entry";

describe("newEntryId", () => {
  it("produces an ID matching the Entry ID regex", () => {
    const id = newEntryId("some body text", new Date("2026-04-16T12:00:00Z"));
    expect(ENTRY_ID_REGEX.test(id)).toBe(true);
  });

  it("encodes the date as YYMMDD in UTC", () => {
    const id = newEntryId("body", new Date("2026-04-16T12:00:00Z"));
    expect(id.startsWith("ENT-260416-")).toBe(true);
  });

  it("produces different IDs for different bodies at the same instant", () => {
    const at = new Date("2026-04-16T12:00:00Z");
    expect(newEntryId("body one", at)).not.toBe(newEntryId("body two", at));
  });

  it("produces different IDs for same body at different instants", () => {
    const a = newEntryId("body", new Date("2026-04-16T12:00:00.000Z"));
    const b = newEntryId("body", new Date("2026-04-16T12:00:00.001Z"));
    expect(a).not.toBe(b);
  });

  it("is deterministic — same (body, timestamp) → same ID", () => {
    const at = new Date("2026-04-16T12:00:00Z");
    expect(newEntryId("hello", at)).toBe(newEntryId("hello", at));
  });
});
