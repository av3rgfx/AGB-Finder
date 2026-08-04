import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedManiglie } from "../../../prisma/seed-maniglie";
import { searchArticleIds, browseFirstWords } from "./search";
import { firstWord } from "./taxonomy";
import { currentStockImport, availableArticleIds } from "./stock-status";

const url = process.env.INTEGRATION_DATABASE_URL;

/**
 * `seedManiglie` esce in silenzio se a DB non c'è un ADMIN («salto la pronta
 * consegna»): su un database di integrazione pulito la giacenza non nasceva, e
 * i tre test della disponibilità — la regola centrale del reparto — fallivano
 * senza che il gate stesse verificando alcunché. L'admin lo crea il test, che è
 * chi ne ha bisogno; il ritorno anticipato del seed resta com'è, perché in
 * sviluppo è un messaggio utile.
 */
async function ensureAdmin(db: PrismaClient) {
  const existing = await db.user.findFirst({ where: { role: "ADMIN" } });
  if (existing) return existing;
  return db.user.create({
    data: {
      name: "Integrazione",
      email: "integrazione@ufptrade.local",
      firstName: "Integrazione",
      lastName: "Test",
      role: "ADMIN",
    },
  });
}

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
    await ensureAdmin(db);
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
    await ensureAdmin(db);
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

describe.runIf(Boolean(url))("sfoglio — il GROUP BY SQL e la funzione TypeScript", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await ensureAdmin(db);
    await seedManiglie(db);
    // Righe scelte per rompere il gemello SQL se divergesse da `firstWord`:
    // spazio doppio (45 casi nel listino vero), spazi attorno, parola sola.
    for (const [code, name] of [
      ["ZZTEST-A", "PEGASO  INCASSO AM111 CROMAT"],
      ["ZZTEST-B", "  MANIGLIONE  ZZ01 OTTONE  "],
      ["ZZTEST-C", "POMOLO"],
    ] as const) {
      await db.article.upsert({
        where: { brand_code: { brand: "COLOMBO", code } },
        update: { name },
        create: {
          brand: "COLOMBO",
          code,
          codeNorm: code.replace(/[^A-Z0-9]/g, ""),
          name,
          priceList: "1.00",
          lastListingAt: new Date(),
        },
      });
    }
  }, 30_000);

  afterAll(async () => {
    await db.article.deleteMany({ where: { code: { startsWith: "ZZTEST-" } } });
    await db.$disconnect();
  });

  /**
   * IL test di questo modulo. La «prima parola» è scritta due volte — una in
   * TypeScript per lo script di misura, una in SQL per il raggruppamento — e se
   * le due divergono il numero misurato smette di essere il numero mostrato
   * all'agente, in silenzio. Qui si confrontano su TUTTA la tabella.
   */
  it("danno esattamente gli stessi gruppi, sull'intera tabella", async () => {
    const sql = await browseFirstWords(db, "COLOMBO");

    const rows = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { name: true },
    });
    const ts = new Map<string, number>();
    for (const r of rows) {
      const w = firstWord(r.name);
      ts.set(w, (ts.get(w) ?? 0) + 1);
    }

    expect(sql.length).toBe(ts.size);
    for (const g of sql) expect([g.word, g.count]).toEqual([g.word, ts.get(g.word)]);
  });

  it("lo spazio doppio non produce un gruppo vuoto", async () => {
    const groups = await browseFirstWords(db, "COLOMBO");
    expect(groups.map((g) => g.word)).not.toContain("");
    expect(groups.map((g) => g.word)).toContain("PEGASO");
  });

  it("ordina per numero di codici decrescente (decisione utente)", async () => {
    const groups = await browseFirstWords(db, "COLOMBO");
    const counts = groups.map((g) => g.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
