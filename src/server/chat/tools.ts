import "server-only";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import type { EmbeddingService } from "@/server/ai/embedding";
import { RAGEngine } from "@/server/ai/rag";
import type { ToolDeclaration } from "@/server/ai/providers/types";

export type ToolDb = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "product">;

export interface ToolExecution {
  /** JSON-serializzabile: torna al modello come functionResponse/tool message. */
  output: unknown;
  /** Prodotti citati, per referencedProductIds del messaggio ASSISTANT. */
  productIds: string[];
}

export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: "search_products",
    description:
      "Cerca prodotti nel catalogo AGB per nome, descrizione, categoria o prefisso del codice. Ritorna i migliori risultati ordinati per pertinenza. I filtri sono restrittivi (escludono i prodotti senza quel dato): se una ricerca filtrata dà 0 risultati, riprova subito senza filtri.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termini di ricerca in italiano o prefisso codice AGB",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Numero massimo di risultati (default 5)",
        },
        material: {
          type: "string",
          description:
            "Filtro materiale, es. ACCIAIO, ZAMA. Esclude i prodotti senza materiale specificato: usalo solo se il materiale è essenziale per l'utente.",
        },
        priceMax: { type: "number", description: "Prezzo massimo in EUR" },
        inStockOnly: { type: "boolean", description: "Solo prodotti disponibili" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_by_code",
    description: "Recupera la scheda completa di un prodotto dato il codice AGB esatto.",
    parameters: {
      type: "object",
      properties: {
        agbCode: { type: "string", description: "Codice AGB esatto, es. B00590.15.03" },
      },
      required: ["agbCode"],
    },
  },
];

const searchArgs = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(10).default(5),
  material: z.string().min(1).max(50).optional(),
  priceMax: z.number().nonnegative().optional(),
  inStockOnly: z.boolean().optional(),
});

const codeArgs = z.object({ agbCode: z.string().trim().min(1).max(20) });

function invalidArgs(error: z.ZodError): ToolExecution {
  const details = error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  return { output: { error: `Argomenti non validi — ${details}` }, productIds: [] };
}

/** Esegue un tool. MAI lancia per input errati: l'errore torna al modello, che può riformulare. */
export async function executeTool(
  db: ToolDb,
  name: string,
  args: Record<string, unknown>,
  embeddings?: EmbeddingService,
): Promise<ToolExecution> {
  if (name === "search_products") {
    const parsed = searchArgs.safeParse(args);
    if (!parsed.success) return invalidArgs(parsed.error);
    const { query, limit, ...filters } = parsed.data;
    const result = await new RAGEngine(db, embeddings).search(query, filters, { limit });
    return {
      output: {
        total: result.total,
        results: result.hits.map((hit) => ({
          agbCode: hit.agbCode,
          name: hit.name,
          shortDescription: hit.shortDescription,
          price: hit.basePrice,
          available: hit.isAvailable,
          category: hit.categoryName,
        })),
      },
      productIds: result.hits.map((hit) => hit.id),
    };
  }

  if (name === "get_product_by_code") {
    const parsed = codeArgs.safeParse(args);
    if (!parsed.success) return invalidArgs(parsed.error);
    const product = await db.product.findUnique({
      where: { agbCode: parsed.data.agbCode },
      include: { category: true },
    });
    if (!product)
      return {
        output: { error: `Nessun prodotto con codice ${parsed.data.agbCode}` },
        productIds: [],
      };
    return {
      output: {
        agbCode: product.agbCode,
        name: product.name,
        shortDescription: product.shortDescription,
        price: Number(product.basePrice),
        priceUnit: product.priceUnit,
        available: product.isAvailable,
        stock: product.stockQuantity,
        category: product.category.name,
        specifications: product.specifications,
      },
      productIds: [product.id],
    };
  }

  return { output: { error: `Tool sconosciuto: ${name}` }, productIds: [] };
}
