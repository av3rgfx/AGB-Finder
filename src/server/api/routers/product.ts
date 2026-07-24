import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getAIGateway } from "@/server/ai/gateway";
import { RAGEngine } from "@/server/ai/rag";
import { deriveRecentSearches } from "@/lib/recent-searches";

const searchFiltersInput = z.object({
  categoryId: z.string().min(1).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  material: z.string().min(1).max(50).optional(),
  inStockOnly: z.boolean().optional(),
});

const searchInput = z.object({
  query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200),
  filters: searchFiltersInput.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

/** Prisma Decimal → number: superjson non serializza Decimal. */
function serializeProduct<
  T extends { basePrice: unknown; discountedPrice: unknown; weightKg: unknown },
>(product: T) {
  return {
    ...product,
    basePrice: Number(product.basePrice),
    discountedPrice: product.discountedPrice === null ? null : Number(product.discountedPrice),
    weightKg: product.weightKg === null ? null : Number(product.weightKg),
  };
}

export const productRouter = createTRPCRouter({
  /** Ricerca ibrida: tsvector+trigram sempre, ramo vettoriale se Gemini è configurato. */
  search: agentProcedure.input(searchInput).query(async ({ ctx, input }) => {
    const engine = new RAGEngine(ctx.db, (await getAIGateway()).queryEmbeddings());
    const result = await engine.search(input.query, input.filters ?? {}, {
      limit: input.limit,
      offset: input.offset,
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "PRODUCT_SEARCHED",
        description: `Ricerca prodotti: "${input.query}"`,
        metadata: {
          query: input.query,
          filters: input.filters ?? {},
          results: result.hits.length,
          queryTimeMs: result.queryTimeMs,
        },
      },
    });
    return result;
  }),

  getById: agentProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.id },
        include: { category: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Prodotto non trovato." });
      return serializeProduct(product);
    }),

  getByCode: agentProcedure
    .input(z.object({ agbCode: z.string().min(1).max(20) }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { agbCode: input.agbCode },
        include: { category: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Prodotto non trovato." });
      return serializeProduct(product);
    }),

  listCategories: publicProcedure
    .input(z.object({ parentId: z.string().nullish() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.productCategory.findMany({
        where: { parentId: input?.parentId ?? null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, parentId: true },
      }),
    ),

  getRelated: agentProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        limit: z.number().int().min(1).max(12).default(4),
      }),
    )
    .query(({ ctx, input }) => new RAGEngine(ctx.db).getRelated(input.productId, input.limit)),

  /** Ricerche recenti dell'utente (ultimi 7 giorni), derivate read-side dai log. */
  recentSearches: agentProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rows = await ctx.db.activityLog.findMany({
        where: { userId: ctx.session.user.id, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { metadata: true },
      });
      return deriveRecentSearches(rows, { limit: input?.limit ?? 8 });
    }),
});
