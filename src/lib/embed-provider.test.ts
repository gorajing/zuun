import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider } from "./embed-provider";

describe("OllamaProvider", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns a 768-float L2-normalized vector on success", async () => {
    const raw = Array.from({ length: 768 }, (_, i) => i + 1);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: raw }),
    } as Response);

    const vec = await new OllamaProvider().embed("hello");
    expect(vec).not.toBeNull();
    expect(vec).toHaveLength(768);
    const norm = Math.sqrt(vec!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("returns null when Ollama is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await new OllamaProvider().embed("hello")).toBeNull();
  });

  it("returns null when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await new OllamaProvider().embed("hello")).toBeNull();
  });

  it("returns null on missing or wrong-length embedding field", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: Array(100).fill(0) }),
    } as Response);
    expect(await new OllamaProvider().embed("hello")).toBeNull();
  });

  it("truncates inputs over 8000 chars before sending", async () => {
    const sent: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      sent.push(init.body as string);
      return { ok: true, json: async () => ({ embedding: Array(768).fill(0.1) }) } as Response;
    });
    const long = "x".repeat(9000);
    await new OllamaProvider().embed(long);
    const body = JSON.parse(sent[0]!) as { prompt: string };
    expect(body.prompt.length).toBeLessThanOrEqual(8000);
  });
});
