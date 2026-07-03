// Embedding batch del catalogo: pnpm embed:products
// Idempotente e riavviabile: pagina su WHERE embedding IS NULL, quindi ogni run
// riparte da dove si era fermato e dopo un re-import calcola solo i nuovi.
import { PrismaClient } from "@prisma/client";
import { GeminiEmbeddingService, HttpStatusError } from "../src/server/ai/embedding";
import { embeddingText } from "../src/server/ai/product-text";
import { RAGEngine } from "../src/server/ai/rag";

const BATCH_SIZE = 100; // limite batchEmbedContents
const MAX_ATTEMPTS = 5;

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let delayMs = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retriable =
        error instanceof HttpStatusError && (error.status === 429 || error.status >= 500);
      if (!retriable || attempt >= MAX_ATTEMPTS) throw error;
      console.warn(`  Tentativo ${attempt} fallito (${error.message}), retry tra ${delayMs}ms…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY mancante: aggiungila a .env prima di lanciare l'embedding.");
    process.exit(1);
  }
  const db = new PrismaClient();
  const engine = new RAGEngine(db);
  const service = new GeminiEmbeddingService(apiKey, "RETRIEVAL_DOCUMENT");
  let done = 0;
  try {
    for (;;) {
      const batch = await engine.listUnembedded(BATCH_SIZE);
      if (batch.length === 0) break;
      const vectors = await withBackoff(() => service.generateBatch(batch.map(embeddingText)));
      await engine.storeEmbeddings(
        batch.map((product, i) => ({ id: product.id, embedding: vectors[i]! })),
      );
      done += batch.length;
      console.log(`✓ ${done} prodotti embeddati…`);
    }
    console.log(
      done === 0
        ? "Niente da fare: tutti i prodotti hanno già l'embedding."
        : `Completato: ${done} embedding generati.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
