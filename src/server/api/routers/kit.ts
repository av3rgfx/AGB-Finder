import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { KitEngine } from "@/server/kit/engine";
import { KitGenerationError, kitInputSchema } from "@/server/kit/types";

function toTRPC(error: unknown): never {
  if (error instanceof KitGenerationError)
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw error;
}

export const kitRouter = createTRPCRouter({
  create: agentProcedure.input(kitInputSchema).mutation(async ({ ctx, input }) => {
    const year = new Date().getFullYear();
    const inYear = await ctx.db.kitRequest.count({
      where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
    });
    const requestNumber = `KIT-${year}-${String(inYear + 1).padStart(4, "0")}`;
    const { notes, ...specs } = input;
    const request = await ctx.db.kitRequest.create({
      data: {
        ...specs,
        notes: notes ?? null,
        requestNumber,
        status: "DRAFT",
        agentId: ctx.session.user.id,
      },
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "KIT_REQUEST_CREATED",
        description: `Richiesta kit ${requestNumber}`,
        resourceType: "kit_request",
        resourceId: request.id,
      },
    });
    return { id: request.id, requestNumber };
  }),

  generate: agentProcedure
    .input(z.object({ kitRequestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.kitRequestId, agentId: ctx.session.user.id },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

      const engine = new KitEngine(ctx.db);
      const output = await engine
        .generate({
          windowType: request.windowType,
          widthMm: request.widthMm,
          heightMm: request.heightMm,
          material: request.material,
          airGapMm: request.airGapMm,
          axisOffsetMm: request.axisOffsetMm,
          rebateMm: request.rebateMm,
          seatMm: request.seatMm,
          openingSide: request.openingSide,
          openingDir: request.openingDir,
          finish: request.finish,
          series: request.series,
          supplementaryClosures: request.supplementaryClosures,
          notes: request.notes ?? undefined,
        })
        .catch(toTRPC);

      const rows = output.lines
        .filter((line) => line.productId !== null)
        .map((line, index) => ({
          kitRequestId: request.id,
          productId: line.productId!,
          componentCode: line.code,
          componentName: line.name ?? line.code,
          position: line.position,
          quantity: line.quantity,
          unitPrice: line.unitPrice!,
          totalPrice: line.totalPrice!,
          ruleId: line.ruleId,
          ruleDescription: line.ruleDescription,
          sortOrder: index,
        }));

      await ctx.db.$transaction([
        ctx.db.kitComponent.deleteMany({ where: { kitRequestId: request.id } }),
        ctx.db.kitComponent.createMany({ data: rows }),
        ctx.db.kitRequest.update({
          where: { id: request.id },
          data: {
            generatedKit: JSON.parse(JSON.stringify(output)),
            totalComponents: output.totalComponents,
            totalPrice: output.totalPrice,
            status: "COMPLETED",
            generatedAt: new Date(),
          },
        }),
      ]);
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "KIT_GENERATED",
          description: `Kit generato per ${request.requestNumber} (${output.totalComponents} componenti)`,
          resourceType: "kit_request",
          resourceId: request.id,
        },
      });
      return output;
    }),

  get: agentProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const request = await ctx.db.kitRequest.findFirst({
      where: { id: input.id, agentId: ctx.session.user.id },
      include: {
        components: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: { id: true, agbCode: true, name: true, isAvailable: true, listinoPage: true },
            },
          },
        },
      },
    });
    if (!request)
      throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });
    return {
      ...request,
      totalPrice: request.totalPrice === null ? null : Number(request.totalPrice),
      components: request.components.map((component) => ({
        ...component,
        unitPrice: Number(component.unitPrice),
        totalPrice: Number(component.totalPrice),
      })),
    };
  }),

  list: agentProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .partial()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.kitRequest.findMany({
          where: { agentId: ctx.session.user.id },
          orderBy: { createdAt: "desc" },
          take: input.limit ?? 20,
          skip: input.offset ?? 0,
          select: {
            id: true, requestNumber: true, windowType: true, series: true, material: true,
            widthMm: true, heightMm: true, status: true, totalComponents: true,
            totalPrice: true, createdAt: true,
          },
        }),
        ctx.db.kitRequest.count({ where: { agentId: ctx.session.user.id } }),
      ]);
      return {
        items: items.map((item) => ({
          ...item,
          totalPrice: item.totalPrice === null ? null : Number(item.totalPrice),
        })),
        total,
      };
    }),
});
