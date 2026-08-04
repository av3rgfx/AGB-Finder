import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { adminProcedure, agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { searchArticleIds } from "@/server/maniglie/search";
import { articleTotal } from "@/server/maniglie/price";
import { availableArticleIds, currentStockImport } from "@/server/maniglie/stock-status";
import { matchStockCodes } from "@/server/maniglie/stock-file";

/**
 * Reparto maniglie — ricerca e scheda articolo.
 *
 * Due stati soli per l'agente: «in pronta consegna» e «da ordinare». Gli ORFANI
 * (righe di giacenza senza articolo a listino) non compaiono qui: li vede solo
 * Andrea nel riepilogo dell'import. Mostrare all'agente un prodotto senza prezzo,
 * quando nella maggioranza dei casi il prezzo esiste e arriverà col listino
 * aggiornato, lo metterebbe in condizione di promettere ciò che non sa quotare.
 */

const ARTICLE_FIELDS = {
  id: true,
  brand: true,
  code: true,
  name: true,
  priceList: true,
  surcharge: true,
  ean: true,
  catalogPage: true,
  imageUrl: true,
  lastListingAt: true,
} satisfies Prisma.ArticleSelect;

type ArticleRow = Prisma.ArticleGetPayload<{ select: typeof ARTICLE_FIELDS }>;

function toSummary(a: ArticleRow, inStock: boolean) {
  return {
    id: a.id,
    brand: a.brand,
    code: a.code,
    name: a.name,
    /** Totale DERIVATO (prezzo + surcharge), arrotondato a 2 decimali in Decimal. */
    total: articleTotal(a.priceList, a.surcharge).toNumber(),
    ean: a.ean,
    catalogPage: a.catalogPage,
    imageUrl: a.imageUrl,
    inStock,
  };
}

export type ArticleSummary = ReturnType<typeof toSummary>;

/**
 * Disponibilità di un gruppo di articoli. Ogni marca ha il SUO ultimo import, e
 * quindi la sua data: la verità non è una sola riga globale.
 */
async function resolveStock(db: Parameters<typeof currentStockImport>[0], rows: ArticleRow[]) {
  const brands = [...new Set(rows.map((r) => r.brand))];
  const inStock = new Set<string>();
  const updates: { brand: string; importedAt: Date }[] = [];

  for (const brand of brands) {
    const imp = await currentStockImport(db, brand);
    if (!imp) continue;
    updates.push({ brand, importedAt: imp.importedAt });
    const ids = rows.filter((r) => r.brand === brand).map((r) => r.id);
    for (const id of await availableArticleIds(db, imp.id, ids)) inStock.add(id);
  }
  return { inStock, updates };
}

export const articleRouter = createTRPCRouter({
  /** Ricerca: codice, nome, EAN. Prezzi visibili a tutti (decisione utente). */
  search: agentProcedure
    .input(
      z.object({
        query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200),
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { hits, total } = await searchArticleIds(ctx.db, input);
      if (hits.length === 0) {
        // La data si mostra anche senza risultati: è la risposta alla domanda
        // «di quando è questo dato?», che non dipende dall'aver trovato qualcosa.
        const imp = await currentStockImport(ctx.db, input.brand);
        return {
          hits: [],
          total: 0,
          stockUpdates: imp ? [{ brand: input.brand, importedAt: imp.importedAt }] : [],
        };
      }

      const rows = await ctx.db.article.findMany({
        where: { id: { in: hits.map((h) => h.id) } },
        select: ARTICLE_FIELDS,
      });
      // `findMany` non conserva l'ordine di pertinenza calcolato dalla ricerca.
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = hits.map((h) => byId.get(h.id)).filter((r): r is ArticleRow => Boolean(r));

      const { inStock, updates } = await resolveStock(ctx.db, ordered);
      return {
        hits: ordered.map((r) => toSummary(r, inStock.has(r.id))),
        total,
        stockUpdates: updates,
      };
    }),

  /**
   * Solo la data dell'ultimo import: serve alla schermata PRIMA che si cerchi
   * qualcosa. «Di quando è questo dato?» è una domanda che l'agente ha già
   * aprendo la pagina, e saperlo prima di investire una ricerca è ciò che gli
   * dice se fidarsi. `null` = nessuna pronta consegna mai caricata: non si
   * inventa una data.
   */
  stockInfo: agentProcedure
    .input(z.object({ brand: z.string().trim().min(1).max(50).default("COLOMBO") }))
    .query(async ({ ctx, input }) => {
      const imp = await currentStockImport(ctx.db, input.brand);
      return { importedAt: imp?.importedAt ?? null };
    }),

  getById: agentProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.article.findUnique({
        where: { id: input.id },
        select: ARTICLE_FIELDS,
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Articolo non trovato." });

      const { inStock, updates } = await resolveStock(ctx.db, [row]);
      return {
        ...toSummary(row, inStock.has(row.id)),
        /** Le due metà, per la scheda: il surcharge è temporaneo e va poter essere letto. */
        priceList: row.priceList.toNumber(),
        surcharge: row.surcharge === null ? null : row.surcharge.toNumber(),
        lastListingAt: row.lastListingAt,
        stockUpdatedAt: updates[0]?.importedAt ?? null,
      };
    }),

  // ── Pronta consegna: solo Andrea (ADMIN) ────────────────────────────────

  /**
   * Scrive l'import confermato. I codici arrivano dall'anteprima, ma l'aggancio
   * si rifà QUI da capo: l'anteprima è informativa, la verità la ricostruisce il
   * server. Manomettere l'elenco equivale a caricare un altro file, cosa che un
   * ADMIN può fare comunque.
   */
  confirmStockImport: adminProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50),
        fileName: z.string().trim().min(1).max(255),
        rawCodes: z.array(z.string().trim().min(1).max(64)).min(1).max(20_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const articles = await ctx.db.article.findMany({
        where: { brand: input.brand },
        select: { id: true, codeNorm: true },
      });
      const match = matchStockCodes(input.rawCodes, new Map(articles.map((a) => [a.codeNorm, a.id])));
      if (match.lines.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nessun codice utilizzabile: import non creato.",
        });
      }

      const created = await ctx.db.stockImport.create({
        data: {
          brand: input.brand,
          fileName: input.fileName,
          importedById: ctx.session.user.id,
          rowCount: match.lines.length,
          matchedCount: match.matchedCount,
          orphanCount: match.orphans.length,
          lines: { create: match.lines },
        },
        select: { id: true, importedAt: true, matchedCount: true, orphanCount: true },
      });
      return created;
    }),

  /**
   * Annulla SOLO l'ultimo import di una marca; il precedente torna a valere.
   * Non si cancella un import qualunque della storia: sarebbe riscrivere il
   * passato, la stessa ragione per cui nel kit una distinta emessa genera una
   * versione invece di riscriversi.
   */
  cancelLastStockImport: adminProcedure
    .input(z.object({ brand: z.string().trim().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const last = await currentStockImport(ctx.db, input.brand);
      if (!last) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nessun import da annullare per questa marca.",
        });
      }
      await ctx.db.stockImport.update({
        where: { id: last.id },
        data: { cancelledAt: new Date() },
      });
      const restored = await currentStockImport(ctx.db, input.brand);
      return { cancelledId: last.id, nowInForceAt: restored?.importedAt ?? null };
    }),

  /** Storico dei caricamenti, il più recente per primo. */
  stockImports: adminProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.stockImport.findMany({
        where: { brand: input.brand },
        orderBy: { importedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          fileName: true,
          importedAt: true,
          rowCount: true,
          matchedCount: true,
          orphanCount: true,
          cancelledAt: true,
          importedBy: { select: { firstName: true, lastName: true } },
        },
      });
      // «In vigore» è DERIVATO qui, non salvato: è il più recente non annullato.
      const inForceId = rows.find((r) => r.cancelledAt === null)?.id ?? null;
      return rows.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        importedAt: r.importedAt,
        rowCount: r.rowCount,
        matchedCount: r.matchedCount,
        orphanCount: r.orphanCount,
        cancelledAt: r.cancelledAt,
        importedBy: `${r.importedBy.firstName} ${r.importedBy.lastName}`.trim(),
        inForce: r.id === inForceId,
      }));
    }),

  /** Le righe orfane di un import: le vede SOLO Andrea, mai l'agente. */
  stockImportOrphans: adminProcedure
    .input(z.object({ importId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const lines = await ctx.db.stockLine.findMany({
        where: { importId: input.importId, articleId: null },
        select: { rawCode: true },
        orderBy: { rawCode: "asc" },
      });
      return lines.map((l) => l.rawCode);
    }),
});
