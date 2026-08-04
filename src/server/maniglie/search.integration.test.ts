import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { seedManiglie } from "../../../prisma/seed-maniglie";
import { searchArticleIds, browseFirstWords, articleIdsByFirstWord } from "./search";
import { firstWord, secondToken, SQL_FIRST_WORD, SQL_SECOND_WORD } from "./taxonomy";
import { browseLabel } from "./curatela";
import {
  currentStockImport,
  availableArticleIds,
  allAvailableArticleIds,
} from "./stock-status";

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

  /**
   * Il refuso è nei DATI del fornitore, digitato a mano, e l'agente digita la
   * parola giusta. Il full-text non lo trova: lo trova il ramo trigram. Un
   * articolo che è sullo scaffale ma non si trova è ciò che riporta l'agente al
   * telefono, cioè il fallimento che la spec vuole evitare.
   *
   * Asserisce la PROPRIETÀ e non un codice: prima pretendeva `0CD41RCB`, che è
   * un articolo inventato dal seed, e sul catalogo vero (3.456 righe) falliva —
   * non perché la ricerca fosse rotta, ma perché il gate girava solo su venti
   * righe finte. Sul listino vero i refusi cadono alle posizioni 317-319 su 319,
   * cioè esattamente dove devono: dopo tutte le 288 scritte giuste.
   */
  it("RECUPERA il refuso del listino: «bocchetta» trova BOCCEHTTA", async () => {
    const { hits } = await searchArticleIds(db, {
      brand: "COLOMBO",
      query: "bocchetta",
      limit: 500,
      offset: 0,
    });
    const rows = await db.article.findMany({
      where: { id: { in: hits.map((h) => h.id) } },
      select: { id: true, name: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.name]));
    const names = hits.map((h) => byId.get(h.id)!).filter(Boolean);

    expect(names.some((n) => n.startsWith("BOCCEHTTA"))).toBe(true);
    // …e senza scavalcare quelle scritte giuste.
    expect(names[0]!.startsWith("BOCCHETTA")).toBe(true);
    expect(names.findIndex((n) => n.startsWith("BOCCEHTTA"))).toBeGreaterThan(
      names.findIndex((n) => n.startsWith("BOCCHETTA")),
    );
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
      const w = browseLabel(r.name);
      if (w === null) continue;
      ts.set(w, (ts.get(w) ?? 0) + 1);
    }

    expect(sql.length).toBe(ts.size);
    for (const g of sql) expect([g.word, g.count]).toEqual([g.word, ts.get(g.word)]);
  });

  /**
   * Il gemello SQL del SECONDO token, che è ciò su cui poggiano le divisioni:
   * se `split_part(…, 2)` e `secondToken` divergessero, `ROBOCINQUE S`
   * conterebbe righe diverse da quelle che poi la schermata mostra.
   */
  it("prima e secondo token: SQL e TypeScript concordano su tutta la tabella", async () => {
    const rows = await db.$queryRaw<{ w1: string; w2: string; name: string }[]>`
      SELECT ${Prisma.raw(SQL_FIRST_WORD.replace(/\bname\b/, "a.name"))} AS w1,
             ${Prisma.raw(SQL_SECOND_WORD.replace(/\bname\b/, "a.name"))} AS w2,
             a.name
      FROM articles a WHERE a.brand = 'COLOMBO'
    `;
    expect(rows.length).toBeGreaterThan(3000);
    for (const r of rows) {
      expect([r.name, r.w1, r.w2 || null]).toEqual([r.name, firstWord(r.name), secondToken(r.name)]);
    }
  });

  it("lo spazio doppio non produce un gruppo vuoto", async () => {
    const groups = await browseFirstWords(db, "COLOMBO");
    expect(groups.map((g) => g.word)).not.toContain("");
    expect(groups.map((g) => g.word)).toContain("PEGASO");
  });

  it("ordina alfabeticamente, non per numerosità", async () => {
    // Per numerosità il numero grosso significa «più finiture», non «più
    // importante», e spingerebbe in fondo i nomi che il cliente pronuncia.
    const groups = await browseFirstWords(db, "COLOMBO");
    const words = groups.map((g) => g.word);
    expect(words).toEqual([...words].sort((a, b) => a.localeCompare(b, "it")));
  });

  /**
   * Questo test prima diceva l'opposto — «i doppioni finiscono adiacenti, senza
   * che noi li fondiamo» — ed era il verdetto del `/llm-council`: in alfabetico
   * `ROS.` e `ROSETTA` si vedono insieme, quindi la fusione la fa l'occhio.
   * Andrea ha usato lo sfoglio vero e ha chiesto di fonderle. Il test è girato
   * insieme alla decisione, perché codificava il comportamento vecchio.
   */
  it("le etichette doppie del fornitore non compaiono più: sono fuse", async () => {
    const words = (await browseFirstWords(db, "COLOMBO")).map((g) => g.word);
    for (const storta of [
      "ROS.",
      "BOCCEHTTA",
      "NOTTOLIN",
      "KITPORTE",
      "DUMMY/C",
      "MOV.GRATZ",
      "MOV.MARTELLINA",
      "ROBOCINQUQ",
      "ROBOTE",
    ]) {
      expect(words).not.toContain(storta);
    }
    expect(words).toContain("ROSETTA");
    expect(words).toContain("BOCCHETTA");
  });

  it("le etichette escluse da Andrea non si sfogliano", async () => {
    const words = (await browseFirstWords(db, "COLOMBO")).map((g) => g.word);
    for (const fuori of ["VITE", "VITI", "RONDELLA", "DADO", "CHIAVE"]) {
      expect(words).not.toContain(fuori);
    }
  });

  it("Robocinque e Robocinque S sono due voci, e Roboquattro pure", async () => {
    const words = (await browseFirstWords(db, "COLOMBO")).map((g) => g.word);
    expect(words).toContain("ROBOCINQUE");
    expect(words).toContain("ROBOCINQUE S");
    expect(words).toContain("ROBOQUATTRO");
    expect(words).toContain("ROBOQUATTRO S");
  });

  /**
   * Nessun codice si perde per strada: la somma dei conteggi mostrati più gli
   * esclusi deve fare il totale a DB. Senza, una fusione sbagliata potrebbe far
   * sparire righe senza che nulla vada a zero.
   */
  it("la somma dei gruppi più gli esclusi fa il totale degli articoli", async () => {
    const groups = await browseFirstWords(db, "COLOMBO");
    const rows = await db.article.findMany({
      where: { brand: "COLOMBO" },
      select: { name: true },
    });
    const esclusi = rows.filter((r) => browseLabel(r.name) === null).length;
    expect(groups.reduce((s, g) => s + g.count, 0) + esclusi).toBe(rows.length);
    expect(esclusi).toBeGreaterThan(0);
  });

  it("le righe di un'etichetta fusa comprendono quelle scritte storte", async () => {
    const rows = await articleIdsByFirstWord(db, "COLOMBO", "ROSETTA");
    expect(rows.some((r) => firstWord(r.name) === "ROS.")).toBe(true);
    expect(rows.some((r) => firstWord(r.name) === "ROSETTA")).toBe(true);
  });

  it("le righe di una metà divisa non contengono l'altra metà", async () => {
    const s = await articleIdsByFirstWord(db, "COLOMBO", "ROBOCINQUE S");
    const base = await articleIdsByFirstWord(db, "COLOMBO", "ROBOCINQUE");
    expect(s.length).toBeGreaterThan(0);
    expect(base.length).toBeGreaterThan(0);
    for (const r of s) expect(secondToken(r.name)).toMatch(/^S'?/);
    for (const r of base) expect(secondToken(r.name)).not.toMatch(/^S'?$|^S'/);
    expect(s.some((r) => base.includes(r))).toBe(false);
  });

  /**
   * Un gruppo escluso non deve tornare a schermo scrivendolo nell'URL: sarebbe
   * nascosto dalla vista ma raggiungibile a mano, che è peggio di non toglierlo.
   */
  it("un'etichetta esclusa non restituisce righe nemmeno se richiesta a mano", async () => {
    expect(await articleIdsByFirstWord(db, "COLOMBO", "VITE")).toEqual([]);
  });

  /**
   * L'altra metà della decisione dell'utente, ed è quella che la rende
   * accettabile: le rimozioni valgono SOLO per lo sfoglio. Una vite tolta anche
   * dalla ricerca sarebbe un pezzo che è a magazzino e non si trova — cioè
   * esattamente il fallimento che il ramo trigram esiste per evitare.
   */
  it("ciò che è escluso dallo sfoglio resta trovabile SCRIVENDOLO", async () => {
    const { hits } = await searchArticleIds(db, {
      brand: "COLOMBO",
      query: "vite",
      limit: 50,
      offset: 0,
    });
    const rows = await db.article.findMany({
      where: { id: { in: hits.map((h) => h.id) } },
      select: { name: true },
    });
    const viti = rows.filter((r) => browseLabel(r.name) === null);
    expect(viti.length).toBeGreaterThan(0);
  });
});

describe.runIf(Boolean(url))("sfoglio — il filtro «solo pronta consegna»", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await ensureAdmin(db);
    await seedManiglie(db);
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("restringe i gruppi a quelli che hanno almeno un articolo pronto", async () => {
    const imp = await currentStockImport(db, "COLOMBO");
    const pronti = await allAvailableArticleIds(db, imp!.id);
    expect(pronti.length).toBeGreaterThan(0);

    const tutti = await browseFirstWords(db, "COLOMBO");
    const soloPronti = await browseFirstWords(db, "COLOMBO", pronti);

    expect(soloPronti.length).toBeGreaterThan(0);
    expect(soloPronti.length).toBeLessThanOrEqual(tutti.length);
    // Ogni conteggio filtrato è ≤ del suo totale, e mai maggiore: se lo fosse,
    // il filtro starebbe contando righe di giacenza invece che articoli.
    const totali = new Map(tutti.map((g) => [g.word, g.count]));
    for (const g of soloPronti) {
      expect(g.count).toBeLessThanOrEqual(totali.get(g.word) ?? 0);
    }
    /**
     * La somma dei filtrati è il numero di articoli pronti **che si sfogliano**,
     * non di quelli pronti. Prima erano lo stesso numero; da quando Andrea ha
     * escluso viti, dadi, chiavi e rondelle non lo sono più — nel seed c'è
     * proprio una `VITE FISSAGGIO ROSETTA` in pronta consegna. È voluto: quei
     * pezzi restano in magazzino e restano trovabili scrivendo, ma non stanno
     * nel catalogo che Andrea sfoglia.
     */
    const prontiRows = await db.article.findMany({
      where: { id: { in: [...new Set(pronti)] } },
      select: { name: true },
    });
    const sfogliabili = prontiRows.filter((r) => browseLabel(r.name) !== null);
    expect(soloPronti.reduce((n, g) => n + g.count, 0)).toBe(sfogliabili.length);
    // E i due numeri devono DAVVERO differire, altrimenti l'asserzione sopra
    // passerebbe anche se l'esclusione non funzionasse.
    expect(sfogliabili.length).toBeLessThan(prontiRows.length);
  });

  it("un elenco di id VUOTO dà zero gruppi, non tutti", async () => {
    // `[]` significa «filtro acceso, niente disponibile» ed è diverso da
    // `undefined`, che significa «non filtrare». Confonderli mostrerebbe
    // l'intero catalogo a chi ha chiesto solo ciò che è pronto.
    expect(await browseFirstWords(db, "COLOMBO", [])).toEqual([]);
    expect(await articleIdsByFirstWord(db, "COLOMBO", "MANIGLIA", [])).toEqual([]);
  });

  it("dentro un gruppo restituisce solo le righe pronte", async () => {
    const imp = await currentStockImport(db, "COLOMBO");
    const pronti = new Set(await allAvailableArticleIds(db, imp!.id));
    const righe = await articleIdsByFirstWord(db, "COLOMBO", "MANIGLIA", [...pronti]);
    expect(righe.length).toBeGreaterThan(0);
    for (const r of righe) expect(pronti.has(r.id)).toBe(true);
  });

  it("gli ORFANI non entrano: sono righe di giacenza senza articolo a listino", async () => {
    const imp = await currentStockImport(db, "COLOMBO");
    const pronti = await allAvailableArticleIds(db, imp!.id);
    const righe = await db.stockLine.count({ where: { importId: imp!.id } });
    const orfani = await db.stockLine.count({ where: { importId: imp!.id, articleId: null } });
    expect(pronti.length).toBe(righe - orfani);
  });
});
