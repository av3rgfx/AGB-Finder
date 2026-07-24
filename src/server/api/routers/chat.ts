import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { resolveChatProducts, type ChatProductSummary } from "@/server/chat/products";

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
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          search: z.string().trim().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.conversation.findMany({
        where: {
          agentId: ctx.session.user.id,
          status: "ACTIVE",
          ...(input?.search
            ? { title: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
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
        select: {
          id: true,
          role: true,
          content: true,
          status: true,
          errorMessage: true,
          createdAt: true,
          referencedProductIds: true,
        },
      });
      // Prodotti citati risolti per messaggio (card sotto ciascun messaggio ASSISTANT in UI),
      // ma in UNA sola query: dedup dell'unione degli id su tutti i messaggi, poi si rimappa.
      const products = await resolveChatProducts(
        ctx.db,
        [...new Set(messages.flatMap((m) => m.referencedProductIds))],
      );
      const byId = new Map(products.map((p) => [p.id, p]));
      const messagesOut = messages.map((m) => ({
        ...m,
        products: m.referencedProductIds
          .map((id) => byId.get(id))
          .filter((p): p is ChatProductSummary => Boolean(p)),
      }));
      return {
        conversation: { id: conversation.id, title: conversation.title },
        messages: messagesOut,
      };
    }),

  rename: agentProcedure
    .input(z.object({ conversationId: z.string().min(1), title: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      await ownConversation(ctx, input.conversationId);
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { title: input.title },
      });
      return { ok: true };
    }),

  delete: agentProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ownConversation(ctx, input.conversationId);
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { status: "DELETED" },
      });
      return { ok: true };
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
