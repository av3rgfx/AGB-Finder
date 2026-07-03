// NB: niente "server-only": il modulo è riusato dallo script tsx embed-products
// (stesso pattern di src/server/catalog/*).
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

/** HTTP non-2xx dall'API embedding: lo status guida il backoff dello script batch. */
export class HttpStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

/**
 * Client Gemini embedContent/batchEmbedContents. Dalla Fase 1c è cablato:
 * l'AIGateway lo usa per l'embedding delle query (RETRIEVAL_QUERY, timeout 3s)
 * e lo script `pnpm embed:products` per il batch dei prodotti (RETRIEVAL_DOCUMENT).
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
      throw new HttpStatusError(
        `Gemini embedContent fallito: HTTP ${response.status}`,
        response.status,
      );
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

  /** Embedding batch: ≤100 testi per richiesta batchEmbedContents, vettori L2-normalizzati. */
  async generateBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > 100) throw new Error("Massimo 100 testi per batchEmbedContents");
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            taskType: this.taskType,
            outputDimensionality: EMBEDDING_DIM,
          })),
        }),
      },
    );
    if (!response.ok) {
      throw new HttpStatusError(
        `Gemini batchEmbedContents fallito: HTTP ${response.status}`,
        response.status,
      );
    }
    const payload = (await response.json()) as { embeddings?: { values?: number[] }[] };
    const embeddings = payload.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Batch incompleto: attesi ${texts.length} embedding, ricevuti ${embeddings.length}`,
      );
    }
    return embeddings.map((entry) => {
      const values = entry.values ?? [];
      if (values.length !== EMBEDDING_DIM) {
        throw new Error(
          `Embedding non valido: attese ${EMBEDDING_DIM} dimensioni, ricevute ${values.length}`,
        );
      }
      return l2Normalize(values);
    });
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
