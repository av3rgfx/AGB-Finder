import "server-only";
import { env } from "@/env";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "@/server/constants/embedding";

export type EmbeddingTask = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";

export interface EmbeddingService {
  /** Returns an EMBEDDING_DIM-long, L2-normalized vector. */
  generate(text: string, task: EmbeddingTask): Promise<number[]>;
}

export function l2Normalize(v: number[]): number[] {
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/** Deterministic embedding for tests: FNV-hash-seeded pseudo-vector, unit norm. */
export class FakeEmbeddingService implements EmbeddingService {
  async generate(text: string, _task?: EmbeddingTask): Promise<number[]> {
    let h = 2166136261;
    for (const c of text) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    const v = Array.from({ length: EMBEDDING_DIM }, (_, i) => {
      h = Math.imul(h ^ i, 2654435761);
      return ((h >>> 0) % 1000) / 1000 - 0.5;
    });
    return l2Normalize(v);
  }
}

/**
 * Real Gemini embeddings — DEFERRED in Fase 1b: constructed only when a key
 * exists, and batch generation arrives with the BullMQ queue (project rule:
 * every AI call goes through the queue). Kept here so the wiring is one line.
 */
export class GeminiEmbeddingService implements EmbeddingService {
  constructor(private readonly apiKey: string) {}

  async generate(text: string, task: EmbeddingTask): Promise<number[]> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: task,
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini embedding HTTP ${res.status}`);
    const data = (await res.json()) as { embedding: { values: number[] } };
    const v = data.embedding.values;
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`Embedding dim ${v.length} !== ${EMBEDDING_DIM}`);
    }
    // Non-3072 Gemini outputs are NOT pre-normalized; cosine search needs unit norm.
    return l2Normalize(v);
  }
}

/** Runtime factory: null while no key is configured → search stays tsvector-only. */
export function getEmbeddingService(): EmbeddingService | null {
  return env.GEMINI_API_KEY ? new GeminiEmbeddingService(env.GEMINI_API_KEY) : null;
}
