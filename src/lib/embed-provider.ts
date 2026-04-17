import { appendLog } from "./log";

export interface EmbedProvider {
  embed(text: string): Promise<number[] | null>;
}

export const EMBED_DIM = 768;
const MAX_INPUT_CHARS = 8000;

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

export class OllamaProvider implements EmbedProvider {
  private readonly url: string;
  private readonly model: string;

  constructor(
    url = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    model = process.env.ZUUN_EMBED_MODEL ?? "nomic-embed-text",
  ) {
    this.url = url;
    this.model = model;
  }

  async embed(text: string): Promise<number[] | null> {
    const prompt = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
    if (prompt.length < text.length) {
      appendLog("embed.truncate", { from: text.length, to: prompt.length });
    }
    try {
      const res = await fetch(`${this.url}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding || data.embedding.length !== EMBED_DIM) return null;
      return l2Normalize(data.embedding);
    } catch {
      return null;
    }
  }
}

export const defaultProvider: EmbedProvider = new OllamaProvider();
