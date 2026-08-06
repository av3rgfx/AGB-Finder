import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { adminProcedure, agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  searchArticleIds,
  browseFirstWords,
  articleIdsByFirstWord,
} from "@/server/maniglie/search";
import {
  splitGroup,
  fotoRappresentativa,
  type BrowseRow,
} from "@/server/maniglie/browse";
import { previewDiGruppo } from "@/server/maniglie/copertina";
import { etichetteAccessorio, resolveLabel } from "@/server/maniglie/curatela";
import { articleTotal } from "@/server/maniglie/price";
import {
  allAvailableArticleIds,
  availableArticleIds,
  currentStockImport,
} from "@/server/maniglie/stock-status";
import { matchStockCodes } from "@/server/maniglie/stock-file";
import { contaFiniture, finituraDiCodice } from "@/server/maniglie/finiture";
import { etichetteModello } from "@/server/maniglie/foto-archivio";
import { browseLabel } from "@/server/maniglie/curatela";

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
  codeNorm: true,
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
    /** La forma SENZA separatori: è ciò che si copia negli appunti, ed è la
        chiave con cui si aggancia la pronta consegna. Non si ricalcola in UI. */
    codeNorm: a.codeNorm,
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
export const searchInputSchema = z.object({
  query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200),
  brand: z.string().trim().min(1).max(50).default("COLOMBO"),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
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
 * Gli id dei codici di una finitura, o `undefined` se non si filtra.
 *
 * La REGOLA — «qual è la finitura di un codice» — resta in TypeScript, come la
 * disponibilità: al raw SQL arriva al massimo una lista di id già decisa. Sono
 * 3.456 righe di due colonne, la stessa scala della query della giacenza.
 */
async function finituraIds(db: PrismaClient, brand: string, finitura: string | undefined) {
  if (!finitura) return undefined;
  const rows = await db.article.findMany({ where: { brand }, select: { id: true, code: true } });
  return rows.filter((r) => finituraDiCodice(r.code) === finitura).map((r) => r.id);
}

/**
 * I due filtri insieme. `undefined` = non filtrare; `[]` = filtro acceso e
 * nessun risultato, che è un valore DIVERSO e i chiamanti lo distinguono.
 */
function intersecaIds(a: string[] | undefined, b: string[] | undefined) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const set = new Set(b);
  return a.filter((id) => set.has(id));
}

/** Gli id che sopravvivono a entrambi i filtri dello sfoglio. */
async function idsFiltrati(
  db: PrismaClient,
  brand: string,
  input: { soloPronta: boolean; finitura?: string },
) {
  return intersecaIds(
    await prontaIds(db, brand, input.soloPronta),
    await finituraIds(db, brand, input.finitura),
  );
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
        finitura: z.string().trim().min(1).max(8).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const filtrati = await idsFiltrati(ctx.db, input.brand, input);
      const groups = await browseFirstWords(ctx.db, input.brand, filtrati);
      const modelli = etichetteModello();
      // «Accessori» è una parola NOSTRA, non di COLOMBO: la schermata lo
      // dichiara, e questo è il dato che le permette di farlo.
      const accessori = etichetteAccessorio(input.brand);

      // Una sola lettura in più, e SOLO delle righe che una foto ce l'hanno
      // (2.118 su 3.456): serve a scegliere l'anteprima di ogni gruppo-modello.
      // Le righe senza foto qui non servirebbero a niente.
      const conFoto = await ctx.db.article.findMany({
        where: {
          brand: input.brand,
          imageUrl: { not: null },
          ...(filtrati ? { id: { in: filtrati } } : {}),
        },
        select: { code: true, name: true, imageUrl: true },
      });

      const perGruppo = new Map<string, { code: string; imageUrl: string }>();
      for (const r of conFoto) {
        const label = browseLabel(input.brand, r.name);
        // Il filtro sui modelli è ridondante con `previewDiGruppo`, che lo
        // riapplica, ed è tenuto apposta: evita di costruire 22 voci che
        // nessuno leggerà.
        if (label === null || !modelli.has(label)) continue;
        // La prima per codice, deterministicamente: dentro un gruppo-modello
        // ogni articolo ritrae lo stesso modello, quindi l'arbitrio si riduce
        // alla finitura — e il filtro colore, quando è acceso, l'ha già decisa.
        const gia = perGruppo.get(label);
        if (gia === undefined || r.code.localeCompare(gia.code) < 0) {
          perGruppo.set(label, { code: r.code, imageUrl: r.imageUrl! });
        }
      }

      return {
        groups: groups.map((g) => ({
          word: g.word,
          count: g.count,
          // ⚠️ `isModello` NON si manda più: dal 2026-08-06 la forma della
          // tessera segue `preview`, e nessuno lo leggeva più. Un campo che il
          // server calcola, spedisce e nessuno guarda è la classe di difetto
          // chiusa otto volte da questo progetto. Al livello 2 c'è ancora,
          // perché lì SPEGNE le anteprime di serie.
          isAccessorio: accessori.has(g.word),
          // La FORMA della tessera segue `preview`, non `isModello`: vedi
          // `previewDiGruppo`. Prima seguiva `isModello`, e i quattro gruppi di
          // pomoli — modelli rimasti senza foto dopo la PR #60 — mostravano il
          // riquadro VUOTO, cioè proprio la cosa che quella regola esisteva per
          // impedire.
          preview: urlFoto(previewDiGruppo(g.word, perGruppo.get(g.word)?.imageUrl ?? null), 320),
        })),
      };
    }),

  /**
   * Le finiture DA OFFRIRE, con quante ne contengono.
   *
   * Non le 31 sempre: quelle presenti nel contesto che si sta guardando — tutto
   * il catalogo, oppure il gruppo che si sta sfogliando. Offrire una scelta che
   * dà uno schermo vuoto è offrire un filtro che non filtra, e dentro FEDRA le
   * finiture vere sono cinque, non trentuno.
   *
   * Rispetta «solo pronta consegna» (il numero conta l'insieme che si ha davanti)
   * ma NON la finitura scelta: un filtro non può cancellare le proprie
   * alternative, o sceglierne una sarebbe un vicolo cieco.
   */
  finiture: agentProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        tipo: z.string().trim().min(1).max(100).optional(),
        soloPronta: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const soloIds = await prontaIds(ctx.db, input.brand, input.soloPronta);
      if (input.tipo) {
        const rows = await articleIdsByFirstWord(ctx.db, input.brand, input.tipo, soloIds);
        return { finiture: contaFiniture(rows.map((r) => r.code)) };
      }
      if (soloIds?.length === 0) return { finiture: [] };
      const rows = await ctx.db.article.findMany({
        where: { brand: input.brand, ...(soloIds ? { id: { in: soloIds } } : {}) },
        select: { code: true },
      });
      return { finiture: contaFiniture(rows.map((r) => r.code)) };
    }),

  /**
   * SFOGLIO, livello 2: le SERIE di un gruppo, **con le loro righe**.
   *
   * Le righe arrivano tutte insieme e non una tendina alla volta: il server
   * legge già l'intero gruppo per classificarlo, quindi una seconda strada che
   * le rilegge sarebbe una seconda definizione di «le righe di questo gruppo»,
   * libera di divergere. Caso peggiore misurato: MANIGLIONE, 338 righe = 88 KB.
   * E una tendina chiusa tiene le sue righe nel DOM con `display:none`, quindi
   * il browser non ne scarica le foto: il costo di rete è quello che si apre,
   * non quello che si manda.
   *
   * ⚠️ La classificazione usa TUTTE le righe del gruppo; i filtri decidono solo
   * quali si mostrano. Classificando dopo il filtro, 27 articoli su 3.393
   * cambiavano serie con «solo pronta consegna» acceso.
   *
   * `senzaSerie` non è un dettaglio: sono i codici che il listino non lega a una
   * serie, e vanno raggiunti. La schermata li mostra SOTTO le serie, come righe
   * articolo — non come una categoria che non hanno.
   */
  browseSerie: agentProcedure
    .input(
      z.object({
        brand: z.string().trim().min(1).max(50).default("COLOMBO"),
        tipo: z.string().trim().min(1).max(100),
        soloPronta: z.boolean().default(false),
        finitura: z.string().trim().min(1).max(8).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tipo = resolveLabel(input.brand, input.tipo);
      // `tipo` torna al chiamante RISOLTO: con un `?tipo=MANIG.` condiviso
      // prima della fusione, il chip «dove sei» mostrerebbe altrimenti un nome
      // che non è quello del gruppo che si sta guardando.
      if (tipo === null)
        return { tipo: input.tipo, isModello: false, serie: [], senzaSerie: [], total: 0 };

      const all = await articleIdsByFirstWord(ctx.db, input.brand, tipo);
      // `isModello` serve al livello 2 per SPEGNERE le anteprime: dentro un
      // gruppo-modello le serie sono lo stesso pezzo in varianti, e la foto
      // ripeterebbe. Sembra il contrario del livello 1 e non lo è — cambia
      // l'unità ritratta, non il principio. Vedi `SfogliaSerie`.
      const isModello = etichetteModello().has(tipo);
      if (all.length === 0) return { tipo, isModello, serie: [], senzaSerie: [], total: 0 };

      const filtrati = await idsFiltrati(ctx.db, input.brand, input);
      const visible = filtrati === undefined ? undefined : new Set(filtrati);

      const rows = await ctx.db.article.findMany({
        where: { id: { in: all.map((r) => r.id) } },
        select: ARTICLE_FIELDS,
      });
      const byId = new Map(rows.map((r: ArticleRow) => [r.id, r]));
      const { inStock } = await resolveStock(ctx.db, rows);

      // `imageUrl` grezzo (la chiave Blob) serve a `fotoRappresentativa`;
      // `toSummary` lo trasforma poi nel percorso della route per il browser.
      const conFoto: BrowseRow[] = all.map((r) => ({
        ...r,
        imageUrl: byId.get(r.id)?.imageUrl ?? null,
      }));
      const { serie, senzaSerie } = splitGroup(conFoto, tipo, visible);

      const somma = (r: BrowseRow) => {
        const a = byId.get(r.id);
        return a ? toSummary(a, inStock.has(a.id)) : null;
      };
      const vive = <T,>(x: T | null): x is T => x !== null;

      return {
        tipo,
        isModello,
        serie: serie.map((s) => ({
          serie: s.serie,
          count: s.count,
          preview: urlFoto(fotoRappresentativa(s.rows), 320),
          rows: s.rows.map(somma).filter(vive),
        })),
        senzaSerie: senzaSerie.map(somma).filter(vive),
        total: serie.reduce((n, s) => n + s.count, 0) + senzaSerie.length,
      };
    }),

  /** Ricerca: codice, nome, EAN. Prezzi visibili a tutti (decisione utente). */
  search: agentProcedure
    .input(searchInputSchema)
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
