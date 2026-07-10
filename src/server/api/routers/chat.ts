import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { getAIGateway } from "@/server/ai/gateway";
import { RateLimitedError } from "@/server/ai/errors";
import { ChatService } from "@/server/chat/service";

const PRODUCT_SUMMARY = {
  id: true,
  agbCode: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  priceUnit: true,
  isAvailable: true,
  stockQuantity: true,
} as const;

const DEFAULT_TITLE = "Nuova Conversazione";

/** Ownership: la conversazione deve appartenere all'agente (e non essere DELETED). */
async function ownConversation(
  ctx: TRPCContext & { session: NonNullable<TRPCContext["session"]> },
  conversationId: string,
) {
  const conversation = await ctx.db.conversation.findFirst({
    where: { id: conversationId, agentId: ctx.session.user.id, status: { not: "DELETED" } },
  });
  if (!conversation)
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversazione non trovata." });
  return conversation;
}

function mapRateLimit(error: unknown): never {
  if (error instanceof RateLimitedError)
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
  throw error;
}

export const chatRouter = createTRPCRouter({
  create: agentProcedure.mutation(async ({ ctx }) => {
    const conversation = await ctx.db.conversation.create({
      data: { agentId: ctx.session.user.id },
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "CONVERSATION_CREATED",
        description: "Nuova conversazione con l'assistente",
        resourceType: "conversation",
        resourceId: conversation.id,
      },
    });
    return { id: conversation.id, title: conversation.title };
  }),

  list: agentProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.conversation.findMany({
        where: { agentId: ctx.session.user.id, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        take: input?.limit ?? 20,
        select: { id: true, title: true, updatedAt: true },
      }),
    ),

  get: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      const messages = await ctx.db.message.findMany({
        where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "asc" },
      });
      const productIds = [...new Set(messages.flatMap((m) => m.referencedProductIds))];
      const products =
        productIds.length === 0
          ? []
          : await ctx.db.product.findMany({
              where: { id: { in: productIds } },
              select: PRODUCT_SUMMARY,
            });
      return {
        conversation: { id: conversation.id, title: conversation.title },
        messages,
        products: products.map((p) => ({ ...p, basePrice: Number(p.basePrice) })),
      };
    }),

  send: agentProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        content: z.string().trim().min(1, "Scrivi un messaggio").max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      // Titolo dal primo messaggio; l'update tocca comunque updatedAt (ordinamento di list).
      await ctx.db.conversation.update({
        where: { id: conversation.id },
        data: conversation.title === DEFAULT_TITLE ? { title: input.content.slice(0, 60) } : {},
      });
      const service = new ChatService(ctx.db, await getAIGateway());
      const result = await service
        .send({
          conversationId: conversation.id,
          agentId: ctx.session.user.id,
          content: input.content,
        })
        .catch(mapRateLimit);
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "CONVERSATION_MESSAGE",
          description: "Messaggio all'assistente",
          resourceType: "conversation",
          resourceId: conversation.id,
        },
      });
      return result;
    }),

  retry: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await ownConversation(ctx, input.conversationId);
      const service = new ChatService(ctx.db, await getAIGateway());
      return service
        .retry({ conversationId: conversation.id, agentId: ctx.session.user.id })
        .catch(mapRateLimit);
    }),

  archive: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ownConversation(ctx, input.conversationId);
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { status: "ARCHIVED" },
      });
      return { ok: true };
    }),
});
