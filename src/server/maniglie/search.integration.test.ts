import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedManiglie } from "../../../prisma/seed-maniglie";
import { searchArticleIds } from "./search";
import { currentStockImport, availableArticleIds } from "./stock-status";

const url = process.env.INTEGRATION_DATABASE_URL;

/**
 * La ricerca articoli è raw SQL (tsvector + trigram): i mock non ne verificano
 * nulla. Questo gate gira su Postgres vero, con gli indici veri creati dalla
 * migrazione, ed è l'unico posto in cui il comportamento è davvero provato.
 *
 *   INTEGRATION_DATABASE_URL=postgresql://… pnpm vitest run src/server/maniglie
 */
describe.runIf(Boolean(url))("ricerca articoli — integrazione su Postgres", () => {
  let db: PrismaClient;

  const codesOf = async (query: string, limit = 10) => {
    const { hits } = await searchArticleIds(db, { brand: "COLOMBO", query, limit, offset: 0 });
    const rows = await db.article.findMany({
      where: { id: { in: hits.map((h) => h.id) } },
      select: { id: true, code: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.code]));
    return hits.map((h) => byId.get(h.id)!).filter(Boolean);
  };

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedManiglie(db);
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("trova il codice esatto scritto come a listino", async () => {
    expect(await codesOf("0CD41R-CM")).toContain("0CD41R-CM");
  });

  it("trova lo stesso codice scritto SENZA separatori (la forma del magazzino)", async () => {
    // È il ponte fra le tre grafie: senza, ogni riga della pronta consegna
    // sarebbe orfana e l'intera feature non esisterebbe.
    expect(await codesOf("0CD41RCM")).toContain("0CD41R-CM");
  });

  it("il codice esatto vince sulle somiglianze di testo", async () => {
    const codes = await codesOf("0CD41R-CM");
    expect(codes[0]).toBe("0CD41R-CM");
  });

  it("trova per pezzo di codice, senza conoscerne l'inizio", async () => {
    expect(await codesOf("CD41")).toContain("0CD41R-CM");
  });

  it("trova per nome", async () => {
    expect(await codesOf("maniglia")).toContain("0CD41R-CM");
  });

  it("RECUPERA il refuso del listino: «bocchetta» trova BOCCEHTTA", async () => {
    // Il refuso è nei DATI del fornitore, digitato a mano, e l'agente digita la
    // parola giusta. Il full-text non lo trova: lo trova il ramo trigram. Un
    // articolo che è sullo scaffale ma non si trova è ciò che riporta l'agente
    // al telefono, cioè il fallimento che la spec vuole evitare.
    const codes = await codesOf("bocchetta");
    expect(codes).toContain("0CD41RCB"); // BOCCEHTTA CD41
    // …e senza scavalcare quelle scritte giuste.
    expect(codes.indexOf("0CD63FP-CM")).toBeLessThan(codes.indexOf("0CD41RCB"));
  });

  it("trova per EAN", async () => {
    expect(await codesOf("8033433012345")).toEqual(["0CD41R-CM"]);
  });

  it("non inventa risultati per una ricerca senza riscontro", async () => {
    const { hits, total } = await searchArticleIds(db, {
      brand: "COLOMBO",
      query: "ZX99NONESISTE",
      limit: 10,
      offset: 0,
    });
    expect(hits).toEqual([]);
    expect(total).toBe(0);
  });

  it("la paginazione non perde né duplica righe", async () => {
    const page = async (offset: number) =>
      (await searchArticleIds(db, { brand: "COLOMBO", query: "cromo", limit: 2, offset })).hits.map(
        (h) => h.id,
      );
    const [a, b] = [await page(0), await page(2)];
    expect(a).toHaveLength(2);
    expect(new Set([...a, ...b]).size).toBe(a.length + b.length);
  });

  it("il totale conta TUTTI i riscontri, non la sola pagina", async () => {
    const { hits, total } = await searchArticleIds(db, {
      brand: "COLOMBO",
      query: "cromo",
      limit: 2,
      offset: 0,
    });
    expect(hits).toHaveLength(2);
    expect(total).toBeGreaterThan(2);
  });
});

describe.runIf(Boolean(url))("disponibilità derivata — integrazione", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedManiglie(db);
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("distingue chi è in pronta consegna da chi è da ordinare", async () => {
    const imp = await currentStockImport(db, "COLOMBO");
    expect(imp).not.toBeNull();

    const inStockCode = await db.article.findFirstOrThrow({
      where: { brand: "COLOMBO", code: "0CD41R-CM" },
      select: { id: true },
    });
    const toOrderCode = await db.article.findFirstOrThrow({
      where: { brand: "COLOMBO", code: "0CD41R-OL" },
      select: { id: true },
    });

    const available = await availableArticleIds(db, imp!.id, [inStockCode.id, toOrderCode.id]);
    expect(available.has(inStockCode.id)).toBe(true);
    expect(available.has(toOrderCode.id)).toBe(false);
  });

  it("gli ORFANI restano a DB come righe senza articolo", async () => {
    // Sono ciò che li farà riagganciare da soli al listino aggiornato, senza
    // ricaricare a mano ogni pronta consegna passata.
    const imp = await currentStockImport(db, "COLOMBO");
    const orphans = await db.stockLine.count({
      where: { importId: imp!.id, articleId: null },
    });
    expect(orphans).toBeGreaterThan(0);
  });

  it("un import ANNULLATO smette di valere e torna in vigore il precedente", async () => {
    const before = await currentStockImport(db, "COLOMBO");
    await db.stockImport.update({
      where: { id: before!.id },
      data: { cancelledAt: new Date() },
    });
    const after = await currentStockImport(db, "COLOMBO");
    expect(after?.id).not.toBe(before!.id);
    // Ripristino, così l'ordine dei test non conta.
    await db.stockImport.update({ where: { id: before!.id }, data: { cancelledAt: null } });
    expect((await currentStockImport(db, "COLOMBO"))?.id).toBe(before!.id);
  });
});
