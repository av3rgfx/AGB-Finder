import "server-only";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "@/server/constants/embedding";

/** Contratto unico per gli embedding: vettore L2-normalizzato di EMBEDDING_DIM. */
export interface EmbeddingService {
  generate(text: string): Promise<number[]>;
}

export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) throw new Error("Vettore nullo: impossibile normalizzare");
  return vector.map((value) => value / norm);
}

type GeminiTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Client Gemini embedContent. In Fase 1b NON è cablato nel runtime (manca la
 * GEMINI_API_KEY e la coda BullMQ): il RAGEngine senza EmbeddingService degrada
 * al solo tsvector. Si attiverà in Fase ≥1c dietro coda.
 */
export class GeminiEmbeddingService implements EmbeddingService {
  constructor(
    private readonly apiKey: string,
    private readonly taskType: GeminiTaskType = "RETRIEVAL_QUERY",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(text: string): Promise<number[]> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType: this.taskType,
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini embedContent fallito: HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    const values = payload.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIM) {
      throw new Error(
        `Embedding non valido: attese ${EMBEDDING_DIM} dimensioni, ricevute ${values?.length ?? 0}`,
      );
    }
    return l2Normalize(values); // le uscite ≠3072 non sono pre-normalizzate
  }
}

/** Embedding deterministico per i test del ramo vettoriale. MAI in produzione. */
export class FakeEmbeddingService implements EmbeddingService {
  generate(text: string): Promise<number[]> {
    const vector = Array.from({ length: EMBEDDING_DIM }, (_, i) => {
      let h = i + 1;
      for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1000;
      return (h + 1) / 1000;
    });
    return Promise.resolve(l2Normalize(vector));
  }
}
