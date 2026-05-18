import { describe, it, expect } from "vitest";
import { routeEntTokensFromTags, isShortDecisionNoTags, SHORT_DECISION_MAX } from "./lints";

describe("routeEntTokensFromTags", () => {
  it("moves an ENT-shaped tag out of tags and into related", () => {
    const r = routeEntTokensFromTags(["architecture", "ENT-260501-DE46"], []);
    expect(r.tags).toEqual(["architecture"]);
    expect(r.related).toEqual(["ENT-260501-DE46"]);
    expect(r.routed).toEqual(["ENT-260501-DE46"]);
  });

  it("canonicalizes a lowercase ent token to uppercase in related", () => {
    const r = routeEntTokensFromTags(["ent-260502-cbc9"], []);
    expect(r.tags).toEqual([]);
    expect(r.related).toEqual(["ENT-260502-CBC9"]);
    expect(r.routed).toEqual(["ENT-260502-CBC9"]);
  });

  it("trims surrounding whitespace before matching and canonicalizing", () => {
    const r = routeEntTokensFromTags(["  ENT-260502-A664  "], []);
    expect(r.related).toEqual(["ENT-260502-A664"]);
    expect(r.routed).toEqual(["ENT-260502-A664"]);
  });

  it("leaves real tags untouched and preserves their order", () => {
    const r = routeEntTokensFromTags(["zuun", "ENT-260501-DE46", "audit", "data-quality"], []);
    expect(r.tags).toEqual(["zuun", "audit", "data-quality"]);
  });

  it("appends routed IDs after existing related, preserving existing order", () => {
    const r = routeEntTokensFromTags(["ENT-260501-DE46"], ["ENT-260420-4BDD"]);
    expect(r.related).toEqual(["ENT-260420-4BDD", "ENT-260501-DE46"]);
  });

  it("does not duplicate an ID already present in related (case-insensitive)", () => {
    const r = routeEntTokensFromTags(["ent-260420-4bdd"], ["ENT-260420-4BDD"]);
    expect(r.related).toEqual(["ENT-260420-4BDD"]);
    expect(r.routed).toEqual(["ENT-260420-4BDD"]);
  });

  it("dedupes repeated ENT tokens within the tags list", () => {
    const r = routeEntTokensFromTags(["ENT-260501-DE46", "ent-260501-de46"], []);
    expect(r.related).toEqual(["ENT-260501-DE46"]);
    expect(r.routed).toEqual(["ENT-260501-DE46"]);
  });

  it("ignores tags that merely contain 'ENT-' but are not a full entry id", () => {
    const r = routeEntTokensFromTags(["entanglement", "ENT-260501", "documENT-ation"], []);
    expect(r.tags).toEqual(["entanglement", "ENT-260501", "documENT-ation"]);
    expect(r.routed).toEqual([]);
  });

  it("is a no-op when there are no ENT tokens", () => {
    const r = routeEntTokensFromTags(["a", "b"], ["ENT-260101-FACE"]);
    expect(r.tags).toEqual(["a", "b"]);
    expect(r.related).toEqual(["ENT-260101-FACE"]);
    expect(r.routed).toEqual([]);
  });
});

describe("isShortDecisionNoTags", () => {
  it("threshold is 80 chars (from ENT-260514-75A3)", () => {
    expect(SHORT_DECISION_MAX).toBe(80);
  });

  it("flags a short, untagged decision (the ENT-260420-C96C stub pattern)", () => {
    expect(
      isShortDecisionNoTags({
        kind: "decision",
        body: "Ollama stopped — embed should fail silently.",
        tags: [],
      }),
    ).toBe(true);
  });

  it("does not flag a decision long enough to read as a durable choice", () => {
    const body =
      "Reject auto-distill: passive signals only, because every distill pass biases the corpus toward its own framing.";
    expect(body.length).toBeGreaterThanOrEqual(SHORT_DECISION_MAX);
    expect(isShortDecisionNoTags({ kind: "decision", body, tags: [] })).toBe(false);
  });

  it("does not flag a short decision that carries tags", () => {
    expect(
      isShortDecisionNoTags({ kind: "decision", body: "Use Louvain.", tags: ["clustering"] }),
    ).toBe(false);
  });

  it("does not flag non-decision kinds even when short and untagged", () => {
    expect(isShortDecisionNoTags({ kind: "observation", body: "Short.", tags: [] })).toBe(false);
    expect(isShortDecisionNoTags({ kind: "commitment", body: "Short.", tags: [] })).toBe(false);
  });

  it("treats exactly 80 chars as not 'under 80' (boundary is exclusive)", () => {
    const body = "x".repeat(80);
    expect(isShortDecisionNoTags({ kind: "decision", body, tags: [] })).toBe(false);
  });

  it("measures trimmed length so whitespace padding does not mask a stub", () => {
    // Padded out past 80 raw chars, but only "Ship it." once trimmed.
    const body = "   Ship it." + " ".repeat(80) + "\n";
    expect(body.length).toBeGreaterThan(SHORT_DECISION_MAX);
    expect(isShortDecisionNoTags({ kind: "decision", body, tags: [] })).toBe(true);
  });
});
