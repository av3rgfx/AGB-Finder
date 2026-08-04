import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { createCallerFactory, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { articleRouter } from "./article";

vi.mock("@/server/maniglie/search", () => ({
  searchArticleIds: vi.fn(),
}));
import { searchArticleIds } from "@/server/maniglie/search";

const appRouter = createTRPCRouter({ article: articleRouter });

const articleFindMany = vi.fn();
const articleFindUnique = vi.fn();
const stockImportFindFirst = vi.fn();
const stockImportCreate = vi.fn();
const stockImportUpdate = vi.fn();
const stockImportFindMany = vi.fn();
const stockLineFindMany = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      article: { findMany: articleFindMany, findUnique: articleFindUnique },
      stockImport: {
        findFirst: stockImportFindFirst,
        create: stockImportCreate,
        update: stockImportUpdate,
        findMany: stockImportFindMany,
      },
      stockLine: { findMany: stockLineFindMany },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };
const caller = (s: unknown) => createCallerFactory(appRouter)(makeCtx(s));

const D = (v: string) => new Prisma.Decimal(v);
const article = (o: Partial<Record<string, unknown>> = {}) => ({
  id: "a1",
  brand: "COLOMBO",
  code: "0CD41R-CM",
  name: "MANIGLIA CD41 CROMO SATINATO",
  priceList: D("101.00"),
  surcharge: D("3.54"),
  ean: "8033433012345",
  catalogPage: 63,
  imageUrl: null,
  lastListingAt: new Date("2026-07-01"),
  ...o,
});

beforeEach(() => {
  for (const fn of [
    articleFindMany,
    articleFindUnique,
    stockImportFindFirst,
    stockImportCreate,
    stockImportUpdate,
    stockImportFindMany,
    stockLineFindMany,
  ]) {
    fn.mockReset();
  }
  vi.mocked(searchArticleIds).mockReset();
  articleFindMany.mockResolvedValue([]);
  stockLineFindMany.mockResolvedValue([]);
  stockImportFindFirst.mockResolvedValue(null);
});

describe("article.search", () => {
  it("restituisce il TOTALE derivato, non il prezzo di listino nudo", async () => {
    // Andrea: «nel listino è presente il prezzo già sommato e l'agente deve
    // vedere quello». 101,00 + 3,54 = 104,54.
    vi.mocked(searchArticleIds).mockResolvedValue({ hits: [{ id: "a1", score: 1 }], total: 1 });
    articleFindMany.mockResolvedValue([article()]);

    const res = await caller(agent).article.search({ query: "CD41" });
    expect(res.hits[0]!.total).toBe(104.54);
  });

  it("conserva l'ordine di pertinenza calcolato dalla ricerca", async () => {
    // `findMany` con `id: { in: [...] }` NON garantisce l'ordine: se il router
    // non riordinasse, il codice esatto potrebbe finire terzo.
    vi.mocked(searchArticleIds).mockResolvedValue({
      hits: [
        { id: "a3", score: 1 },
        { id: "a1", score: 0.9 },
        { id: "a2", score: 0.8 },
      ],
      total: 3,
    });
    articleFindMany.mockResolvedValue([
      article({ id: "a1", code: "B" }),
      article({ id: "a2", code: "C" }),
      article({ id: "a3", code: "A" }),
    ]);

    const res = await caller(agent).article.search({ query: "x" });
    expect(res.hits.map((h) => h.id)).toEqual(["a3", "a1", "a2"]);
  });

  it("marca «in pronta consegna» solo chi è nell'ultimo import valido", async () => {
    vi.mocked(searchArticleIds).mockResolvedValue({
      hits: [
        { id: "a1", score: 1 },
        { id: "a2", score: 1 },
      ],
      total: 2,
    });
    articleFindMany.mockResolvedValue([article({ id: "a1" }), article({ id: "a2", code: "X" })]);
    stockImportFindFirst.mockResolvedValue({ id: "imp1", importedAt: new Date("2026-07-28") });
    stockLineFindMany.mockResolvedValue([{ articleId: "a1" }]);

    const res = await caller(agent).article.search({ query: "x" });
    expect(res.hits.find((h) => h.id === "a1")!.inStock).toBe(true);
    expect(res.hits.find((h) => h.id === "a2")!.inStock).toBe(false);
  });

  it("restituisce la data dell'ultimo import ANCHE senza risultati", async () => {
    // Regola inviolabile: nessuna disponibilità si mostra senza la data. La
    // domanda «di quando è questo dato?» non dipende dall'aver trovato qualcosa.
    vi.mocked(searchArticleIds).mockResolvedValue({ hits: [], total: 0 });
    stockImportFindFirst.mockResolvedValue({ id: "imp1", importedAt: new Date("2026-07-28") });

    const res = await caller(agent).article.search({ query: "zzz" });
    expect(res.hits).toEqual([]);
    expect(res.stockUpdates).toEqual([
      { brand: "COLOMBO", importedAt: new Date("2026-07-28") },
    ]);
  });

  it("non inventa una data quando nessuna pronta consegna è mai stata caricata", async () => {
    vi.mocked(searchArticleIds).mockResolvedValue({ hits: [{ id: "a1", score: 1 }], total: 1 });
    articleFindMany.mockResolvedValue([article()]);
    stockImportFindFirst.mockResolvedValue(null);

    const res = await caller(agent).article.search({ query: "x" });
    expect(res.stockUpdates).toEqual([]);
    expect(res.hits[0]!.inStock).toBe(false);
  });

  it("rifiuta chi non è autenticato", async () => {
    await expect(caller(null).article.search({ query: "x" })).rejects.toThrow();
  });
});

describe("la foto: dalla chiave a DB all'URL della route", () => {
  const CHIAVE = "maniglie/colombo/01-fedra/fedra-1ol";

  it("la chiave non esce mai grezza verso il browser", async () => {
    // A DB c'è la CHIAVE Blob (store privato): il browser deve ricevere solo un
    // percorso della nostra applicazione, che passa dall'auth.
    vi.mocked(searchArticleIds).mockResolvedValue({ hits: [{ id: "a1", score: 1 }], total: 1 });
    articleFindMany.mockResolvedValue([article({ imageUrl: CHIAVE })]);

    const res = await caller(agent).article.search({ query: "fedra" });
    expect(res.hits[0]!.imageUrl).toBe(
      "/api/article-image?k=maniglie%2Fcolombo%2F01-fedra%2Ffedra-1ol&size=320",
    );
  });

  it("senza foto l'URL è null: nessuna richiesta sprecata per il 42% scoperto", async () => {
    vi.mocked(searchArticleIds).mockResolvedValue({ hits: [{ id: "a1", score: 1 }], total: 1 });
    articleFindMany.mockResolvedValue([article({ imageUrl: null })]);

    const res = await caller(agent).article.search({ query: "vite" });
    expect(res.hits[0]!.imageUrl).toBeNull();
  });

  it("la scheda riceve anche il formato grande", async () => {
    articleFindUnique.mockResolvedValue(article({ imageUrl: CHIAVE }));
    const res = await caller(agent).article.getById({ id: "a1" });
    expect(res.imageUrl).toContain("size=320");
    expect(res.imageUrlLarge).toBe(
      "/api/article-image?k=maniglie%2Fcolombo%2F01-fedra%2Ffedra-1ol&size=900",
    );
  });

  it("senza foto anche il formato grande è null", async () => {
    articleFindUnique.mockResolvedValue(article({ imageUrl: null }));
    const res = await caller(agent).article.getById({ id: "a1" });
    expect(res.imageUrlLarge).toBeNull();
  });
});

describe("article.getById", () => {
  it("espone ENTRAMBE le metà del prezzo, oltre al totale", async () => {
    // Il surcharge è temporaneo per definizione: deve essere leggibile.
    articleFindUnique.mockResolvedValue(article());
    const res = await caller(agent).article.getById({ id: "a1" });
    expect(res.total).toBe(104.54);
    expect(res.priceList).toBe(101);
    expect(res.surcharge).toBe(3.54);
  });

  it("404 su articolo inesistente", async () => {
    articleFindUnique.mockResolvedValue(null);
    await expect(caller(agent).article.getById({ id: "nope" })).rejects.toThrow(
      /non trovato/i,
    );
  });
});

describe("article.confirmStockImport", () => {
  it("RI-AGGANCIA lato server invece di fidarsi dell'anteprima", async () => {
    // L'anteprima è informativa. Se il client mandasse un aggancio già fatto, un
    // elenco manomesso scriverebbe disponibilità arbitrarie.
    articleFindMany.mockResolvedValue([{ id: "a1", codeNorm: "0CD41RCM" }]);
    stockImportCreate.mockResolvedValue({
      id: "imp2",
      importedAt: new Date(),
      matchedCount: 1,
      orphanCount: 1,
    });

    await caller(admin).article.confirmStockImport({
      brand: "COLOMBO",
      fileName: "pc.xls",
      rawCodes: ["0CD41R-CM", "XGRATZ7SX"],
    });

    const data = stockImportCreate.mock.calls[0]![0].data;
    expect(data.matchedCount).toBe(1);
    expect(data.orphanCount).toBe(1);
    expect(data.lines.create).toEqual([
      { rawCode: "0CD41R-CM", codeNorm: "0CD41RCM", articleId: "a1" },
      { rawCode: "XGRATZ7SX", codeNorm: "XGRATZ7SX", articleId: null },
    ]);
  });

  it("registra chi ha caricato, prendendolo dalla sessione e non dall'input", async () => {
    articleFindMany.mockResolvedValue([]);
    stockImportCreate.mockResolvedValue({
      id: "imp2",
      importedAt: new Date(),
      matchedCount: 0,
      orphanCount: 1,
    });
    await caller(admin).article.confirmStockImport({
      brand: "COLOMBO",
      fileName: "pc.xls",
      rawCodes: ["XX"],
    });
    expect(stockImportCreate.mock.calls[0]![0].data.importedById).toBe("admin1");
  });

  it("è riservata agli ADMIN: un AGENT non pubblica disponibilità a tutti", async () => {
    await expect(
      caller(agent).article.confirmStockImport({
        brand: "COLOMBO",
        fileName: "pc.xls",
        rawCodes: ["0CD41RCM"],
      }),
    ).rejects.toThrow();
    expect(stockImportCreate).not.toHaveBeenCalled();
  });

  it("non crea un import da un elenco tutto inutilizzabile", async () => {
    articleFindMany.mockResolvedValue([]);
    await expect(
      caller(admin).article.confirmStockImport({
        brand: "COLOMBO",
        fileName: "pc.xls",
        rawCodes: ["---", "***"],
      }),
    ).rejects.toThrow(/nessun codice utilizzabile/i);
    expect(stockImportCreate).not.toHaveBeenCalled();
  });
});

describe("article.cancelLastStockImport", () => {
  it("annulla l'ultimo import e dice quale torna in vigore", async () => {
    stockImportFindFirst
      .mockResolvedValueOnce({ id: "imp2", importedAt: new Date("2026-07-28") })
      .mockResolvedValueOnce({ id: "imp1", importedAt: new Date("2026-07-04") });

    const res = await caller(admin).article.cancelLastStockImport({ brand: "COLOMBO" });
    expect(stockImportUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "imp2" } }),
    );
    // Non si CANCELLA: si marca. L'import resta a DB e smette di valere.
    expect(stockImportUpdate.mock.calls[0]![0].data.cancelledAt).toBeInstanceOf(Date);
    expect(res.nowInForceAt).toEqual(new Date("2026-07-04"));
  });

  it("non fa nulla se non c'è niente da annullare", async () => {
    stockImportFindFirst.mockResolvedValue(null);
    await expect(
      caller(admin).article.cancelLastStockImport({ brand: "COLOMBO" }),
    ).rejects.toThrow(/nessun import/i);
    expect(stockImportUpdate).not.toHaveBeenCalled();
  });

  it("è riservata agli ADMIN", async () => {
    await expect(
      caller(agent).article.cancelLastStockImport({ brand: "COLOMBO" }),
    ).rejects.toThrow();
  });
});

describe("article.stockImports", () => {
  it("marca «in vigore» il più recente NON annullato, non semplicemente il primo", async () => {
    stockImportFindMany.mockResolvedValue([
      {
        id: "imp3",
        fileName: "c.xls",
        importedAt: new Date("2026-07-28"),
        rowCount: 1,
        matchedCount: 1,
        orphanCount: 0,
        cancelledAt: new Date("2026-07-29"),
        importedBy: { firstName: "Andrea", lastName: "R." },
      },
      {
        id: "imp2",
        fileName: "b.xls",
        importedAt: new Date("2026-07-04"),
        rowCount: 1,
        matchedCount: 1,
        orphanCount: 0,
        cancelledAt: null,
        importedBy: { firstName: "Andrea", lastName: "R." },
      },
    ]);
    const rows = await caller(admin).article.stockImports({ brand: "COLOMBO" });
    expect(rows.find((r) => r.id === "imp3")!.inForce).toBe(false);
    expect(rows.find((r) => r.id === "imp2")!.inForce).toBe(true);
  });

  it("gli ORFANI sono riservati all'ADMIN", async () => {
    // Decisione dell'utente: l'agente non li vede. Mostrargli un prodotto senza
    // prezzo lo metterebbe in condizione di promettere ciò che non sa quotare.
    await expect(
      caller(agent).article.stockImportOrphans({ importId: "imp1" }),
    ).rejects.toThrow();
  });
});
