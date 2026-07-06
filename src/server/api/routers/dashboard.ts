import { z } from "zod";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { startOfTodayRome } from "@/lib/format";

export const dashboardRouter = createTRPCRouter({
  overview: agentProcedure
    .input(z.object({ scope: z.enum(["mine", "team"]).default("mine") }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isAdmin = ctx.session.user.role === "ADMIN";
      const scope: "mine" | "team" = isAdmin ? input.scope : "mine";
      const since = startOfTodayRome();

      // Filtri di scope: mine = solo i propri record; team = tutti gli agenti.
      const kitWhere = scope === "mine" ? { agentId: userId } : {};
      const convWhere = scope === "mine" ? { agentId: userId } : {};
      const logWhere = scope === "mine" ? { userId } : {};

      const [
        richiesteTotal,
        richiesteToday,
        kitGenTotal,
        kitGenToday,
        convTotal,
        convToday,
        searchTotal,
        searchToday,
        recent,
      ] = await Promise.all([
        ctx.db.kitRequest.count({ where: kitWhere }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, createdAt: { gte: since } } }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, generatedAt: { not: null } } }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, generatedAt: { gte: since } } }),
        ctx.db.conversation.count({ where: convWhere }),
        ctx.db.conversation.count({ where: { ...convWhere, createdAt: { gte: since } } }),
        ctx.db.activityLog.count({ where: { ...logWhere, type: "PRODUCT_SEARCHED" } }),
        ctx.db.activityLog.count({
          where: { ...logWhere, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
        }),
        ctx.db.kitRequest.findMany({
          where: kitWhere,
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { customer: { select: { companyName: true } } },
        }),
      ]);

      return {
        scope,
        isAdmin,
        stats: {
          richieste: { total: richiesteTotal, today: richiesteToday },
          kitGenerati: { total: kitGenTotal, today: kitGenToday },
          conversazioni: { total: convTotal, today: convToday },
          prodottiCercati: { total: searchTotal, today: searchToday },
        },
        recentKits: recent.map((k) => ({
          id: k.id,
          requestNumber: k.requestNumber,
          status: k.status,
          createdAt: k.createdAt,
          totalPrice: k.totalPrice === null ? null : Number(k.totalPrice),
          customerName: k.customer?.companyName ?? null,
        })),
      };
    }),
});
