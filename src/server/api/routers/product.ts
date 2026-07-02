import { z } from "zod";
import { createTRPCRouter, agentProcedure, publicProcedure } from "@/server/api/trpc";
import { ragEngine } from "@/server/ai/rag";

const filtersSchema = z.object({
  categoryId: z.string().optional(),
  material: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
});

/** Prisma Decimal fields → plain numbers (superjson has no Decimal support). */
const toPlain = <T extends { basePrice: unknown; discountedPrice: unknown }>(product: T | null) =>
  product && {
    ...product,
    basePrice: Number(product.basePrice),
    discountedPrice: product.discountedPrice === null ? null : Number(product.discountedPrice),
  };

export const productRouter = createTRPCRouter({
  /** Hybrid search (RAGEngine). Logs the query for analytics. */
  search: agentProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        filters: filtersSchema.optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await ragEngine.search(input.query, input.filters ?? {}, {
        limit: input.limit,
        offset: input.offset,
      });
      await ctx.db.activityLog.create({
        data: {
          type: "PRODUCT_SEARCHED",
          description: `Ricerca prodotti: "${input.query}"`,
          userId: ctx.session.user.id,
          metadata: { query: input.query, results: result.hits.length },
        },
      });
      return result;
    }),

  /** Browse without a query (Archivio initial state). */
  list: agentProcedure
    .input(
      z.object({
        categoryId: z.string().optional(),
        limit: z.number().min(1).max(50).default(24),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        isAvailable: true,
        ...(input.categoryId && { categoryId: input.categoryId }),
      };
      const [items, total] = await Promise.all([
        ctx.db.product.findMany({
          where,
          take: input.limit,
          skip: input.offset,
          orderBy: { agbCode: "asc" },
          include: { category: { select: { name: true, slug: true } } },
        }),
        ctx.db.product.count({ where }),
      ]);
      return { items: items.map((p) => toPlain(p)!), total };
    }),

  getById: agentProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) =>
      toPlain(
        await ctx.db.product.findUnique({ where: { id: input.id }, include: { category: true } }),
      ),
    ),

  getByCode: agentProcedure
    .input(z.object({ agbCode: z.string() }))
    .query(async ({ ctx, input }) =>
      toPlain(
        await ctx.db.product.findUnique({
          where: { agbCode: input.agbCode },
          include: { category: true },
        }),
      ),
    ),

  listCategories: publicProcedure
    .input(z.object({ parentId: z.string().nullable().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.productCategory.findMany({
        where: { parentId: input?.parentId ?? null },
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
    ),

  getRelated: agentProcedure
    .input(z.object({ productId: z.string(), limit: z.number().min(1).max(10).default(5) }))
    .query(({ input }) => ragEngine.getRelated(input.productId, input.limit)),
});
