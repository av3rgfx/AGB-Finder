import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { adminProcedure, agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  searchArticleIds,
  browseFirstWords,
  articleIdsByFirstWord,
} from "@/server/maniglie/search";
import { splitGroup, filterByFamily } from "@/server/maniglie/browse";
import { articleTotal } from "@/server/maniglie/price";
import {
  allAvailableArticleIds,
  availableArticleIds,
  currentStockImport,
} from "@/server/maniglie/stock-status";
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

/**
 * `articles.image_url` conserva la CHIAVE Blob, non un URL: il file sta su uno
 * store PRIVATO e i byte passano sempre da `/api/article-image`, che è dietro
 * auth. Il browser vede solo un percorso della nostra applicazione.
 *
 * `null` quando la foto non c'è — il 42% dei codici, che è minuteria che nessun
 * catalogo fotografa: così la pagina non spende una richiesta per scoprirlo.
 */
function urlFoto(chiave: string | null, size: 320 | 900): string | null {
  return chiave === null ? null : `/api/article-image?k=${encodeURIComponent(chiave)}&size=${size}`;
}

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
    /** Miniatura: è la misura del posto che le righe hanno già (44px, retina). */
    imageUrl: urlFoto(a.imageUrl, 320),
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

/**
 * Un input per due strade: si digita (`query`) OPPURE si sfoglia (`tipo`, ed
 * eventualmente `famiglia`). Tutto ciò che viene dopo è in comune —
 * `resolveStock`, `toSummary`, la data dell'import, la riga a schermo — quindi
 * un secondo endpoint avrebbe duplicato la parte che conta.
 *
 * Nessuno dei due presente = «dammi tutto», cioè 3.456 righe senza che la
 * schermata possa dire di quale insieme si stiano vedendo venti elementi.
 * `famiglia` senza `tipo` non individua nulla: la famiglia è definita DENTRO un
 * gruppo, e la regola che scarta la famiglia degenere ha bisogno della parola
 * del gruppo per funzionare.
 */
export const searchInputSchema = z
  .object({
    query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200).optional(),
    tipo: z.string().trim().min(1).max(100).optional(),
    famiglia: z.string().trim().min(1).max(100).optional(),
    /** Filtro «solo pronta consegna». Vive nello sfoglio, non nella ricerca. */
    soloPronta: z.boolean().default(false),
    brand: z.string().trim().min(1).max(50).default("COLOMBO"),
    limit: z.number().int().min(1).max(50).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .refine((v) => Boolean(v.query) || Boolean(v.tipo), {
    message: "Serve un termine di ricerca oppure un gruppo da sfogliare.",
  })
  .refine((v) => !v.famiglia || Boolean(v.tipo), {
    message: "La famiglia esiste solo dentro un gruppo.",
  })
  .refine((v) => !v.soloPronta || Boolean(v.tipo), {
    // Il filtro appartiene allo sfoglio: nella ricerca per testo non compare, e
    // accettarlo lì significherebbe restringere in silenzio dei risultati che
    // l'agente ha chiesto scrivendo.
    message: "Il filtro «solo pronta consegna» vale solo sfogliando.",
  });

/**
 * Gli id in pronta consegna, o `undefined` se non si filtra. `[]` è un valore
 * legittimo e diverso da `undefined`: significa «filtro acceso, nulla di
 * disponibile», e i chiamanti devono restituire zero risultati invece di tutto.
 *
 * Senza un import di giacenza NON si filtra e non si finge: non esiste una
 * risposta a «cosa è pronto», e la fascia della data lo dice già a schermo.
 */
async function prontaIds(db: PrismaClient, brand: string, solo: boolean) {
  if (!solo) return undefined;
  const imp = await currentStockImport(db, brand);
  return imp ? await allAvailableArticleIds(db, imp.id) : [];
}

/**
 * Una pagina di codici presi SFOGLIANDO, non cercando. Le righe del gruppo si
 * leggono tutte (al massimo 338: MANIGLIONE) perché il filtro per famiglia è una
 * regola TypeScript e non una `WHERE`; poi si affetta.
 *
 * Restituisce la stessa forma di `search`: la schermata dei risultati è una sola.
 */
async function browseSlice(
  db: PrismaClient,
  input: {
    brand: string;
    tipo?: string;
    famiglia?: string;
    soloPronta: boolean;
    limit: number;
    offset: number;
  },
) {
  const all = await articleIdsByFirstWord(
    db,
    input.brand,
    input.tipo!,
    await prontaIds(db, input.brand, input.soloPronta),
  );
  const selected = input.famiglia ? filterByFamily(all, input.tipo!, input.famiglia) : all;
  const page = selected.slice(input.offset, input.offset + input.limit);

  if (page.length === 0) {
    const imp = await currentStockImport(db, input.brand);
    return {
      hits: [],
      total: selected.length,
      stockUpdates: imp ? [{ brand: input.brand, importedAt: imp.importedAt }] : [],
    };
  }

  const rows = await db.article.findMany({
    where: { id: { in: page.map((r) => r.id) } },
    select: ARTICLE_FIELDS,
  });
  const byId = new Map(rows.map((r: ArticleRow) => [r.id, r]));
  const ordered = page.map((r) => byId.get(r.id)).filter((r): r is ArticleRow => Boolean(r));

  const { inStock, updates } = await resolveStock(db, ordered);
  return {
    hits: ordered.map((r) => toSummary(r, inStock.has(r.id))),
    total: selected.length,
    stockUpdates: updates,
  };
}

export const articleRouter = createTRPCRouter({
  /**
   * SFOGLIO, livello 1: i gruppi, con quanti codici ciascuno.
   *
   * NON restituisce la data dell'ultimo import, anche se la schermata la mostra
   * sopra l'elenco: quella la dà già `stockInfo`, e due procedure che affermano
   * la stessa data sono due affermazioni che possono divergere. Di «quando è
   * questo dato» ne esiste una fonte sola.
   */
  browseGroups: agentProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        soloPronta: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => ({
      groups: await browseFirstWords(
        ctx.db,
        input.brand,
        await prontaIds(ctx.db, input.brand, input.soloPronta),
      ),
    })),

  /**
   * SFOGLIO, livello 2: le famiglie di un gruppo. `families` vuoto significa che
   * il gruppo una famiglia non ce l'ha — 21 gruppi su 114 — e la schermata salta
   * al livello 3 invece di mostrare un livello che non divide nulla.
   *
   * `loose` non è un dettaglio: su 70 gruppi su 114 la copertura è PARZIALE, e
   * quei codici vanno raggiunti. La schermata li mostra SOTTO le famiglie, come
   * righe articolo — non come una categoria che non hanno.
   */
  browseFamilies: agentProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        tipo: z.string().trim().min(1).max(100),
        soloPronta: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await articleIdsByFirstWord(
        ctx.db,
        input.brand,
        input.tipo,
        await prontaIds(ctx.db, input.brand, input.soloPronta),
      );
      const { families, loose } = splitGroup(rows, input.tipo);

      // Senza famiglie il gruppo non è diviso: le sue righe si impaginano con
      // `search({tipo})`, e restituirle anche qui sarebbe la stessa lista per
      // due strade — con KIT vorrebbe dire 139 schede in una risposta che la
      // schermata non userebbe.
      if (families.length === 0) {
        return { families, loose: [], total: rows.length };
      }

      // Con le famiglie, invece, i codici sciolti si mostrano SOTTO di esse
      // nella stessa schermata: sono al massimo qualche decina (il caso peggiore
      // del listino vero è BOCCHETTA con 38 su 288) e nasconderli dietro una
      // voce «Altro» significherebbe dare un nome di categoria a ciò che una
      // categoria non ce l'ha.
      const rowsLoose = await ctx.db.article.findMany({
        where: { id: { in: loose.map((r) => r.id) } },
        select: ARTICLE_FIELDS,
      });
      const byId = new Map(rowsLoose.map((r) => [r.id, r]));
      const ordered = loose.map((r) => byId.get(r.id)).filter((r): r is ArticleRow => Boolean(r));
      const { inStock } = await resolveStock(ctx.db, ordered);

      return {
        families,
        loose: ordered.map((r) => toSummary(r, inStock.has(r.id))),
        total: rows.length,
      };
    }),

  /** Ricerca: codice, nome, EAN. Prezzi visibili a tutti (decisione utente). */
  search: agentProcedure
    .input(searchInputSchema)
    .query(async ({ ctx, input }) => {
      if (input.tipo) return browseSlice(ctx.db, input);

      const { hits, total } = await searchArticleIds(ctx.db, {
        ...input,
        query: input.query!,
      });
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
        /** La scheda disegna la foto grande: 320px su un riquadro da 192 CSS px
            sarebbe sgranata su ogni schermo retina. */
        imageUrlLarge: urlFoto(row.imageUrl, 900),
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
