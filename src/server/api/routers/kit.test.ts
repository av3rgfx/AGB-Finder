import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { ENGINE_VERSION } from "@/server/kit/engine";
import { kitInputFromRequest, type PersistedKitRequest } from "@/server/kit/from-request";
vi.mock("@/server/settings/discount-threshold", () => ({
  getDiscountThreshold: vi.fn().mockResolvedValue(40),
  SOGLIA_SCONTO_DEFAULT: 40,
}));

import { kitRouter } from "./kit";

const appRouter = createTRPCRouter({ kit: kitRouter });

const requestCreate = vi.fn();
const requestFindFirst = vi.fn();
const requestFindMany = vi.fn();
const requestUpdate = vi.fn();
const requestUpdateMany = vi.fn();
const requestCount = vi.fn();
const componentDeleteMany = vi.fn();
const componentCreateMany = vi.fn();
const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const activityCreate = vi.fn();
const customerFindUnique = vi.fn();
const transaction = vi.fn();

const dbStub = {
  kitRequest: { create: requestCreate, findFirst: requestFindFirst, findMany: requestFindMany, update: requestUpdate, updateMany: requestUpdateMany, count: requestCount },
  kitComponent: { deleteMany: componentDeleteMany, createMany: componentCreateMany },
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
  activityLog: { create: activityCreate },
  customer: { findUnique: customerFindUnique },
};

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: { ...dbStub, $transaction: transaction },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

// Pivot LEGNO (post ADR 2026-07-04-fase1d-emendamento-legno): il generatore
// regole reale copre solo material "LEGNO" — vedi rules-artech.ts.
const validInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "LEGNO",
  geometry: "A12_I13_B20", entrata: "E15", seatConfig: "STANDARD",
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
} as const;

beforeEach(() => {
  for (const fn of [requestCreate, requestFindFirst, requestFindMany, requestUpdate, requestUpdateMany, requestCount, componentDeleteMany, componentCreateMany, templateFindFirst, productFindMany, activityCreate, customerFindUnique, transaction]) {
    fn.mockReset();
  }
  activityCreate.mockResolvedValue({});
  requestUpdateMany.mockResolvedValue({ count: 1 });
  // Il mock supporta entrambe le forme di `$transaction` usate nel router:
  // l'array (`generate`, batch indipendente) e la callback interattiva
  // (`ricalcola`, dove la seconda scrittura dipende dall'id creato dalla
  // prima). Se l'argomento è una funzione la si invoca passandole lo stub
  // del db (stessi mock condivisi, quindi le asserzioni sui singoli metodi
  // restano valide dentro o fuori dalla transazione); altrimenti si
  // comporta come prima.
  transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof dbStub) => Promise<unknown>)(dbStub)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("kit.create", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.kit.create({ specs: validInput })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("crea DRAFT con requestNumber KIT-YYYY-NNNN e logga", async () => {
    requestCount.mockResolvedValue(41);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const created = await caller.kit.create({ specs: validInput });
    const year = new Date().getFullYear();
    expect(created.requestNumber).toBe(`KIT-${year}-0042`);
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      agentId: "agent1", status: "DRAFT", widthMm: 550, series: "ARTECH",
    });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "KIT_REQUEST_CREATED" }),
    });
  });

  it("inoltra geometry e seatConfig nel payload create (colonne KitRequest)", async () => {
    // Stessa ragione degli altri due test di inoltro: la riga È l'input di ogni
    // rigenerazione, e senza la colonna Prisma risponde «Unknown argument» solo a
    // runtime (il typecheck non lo vede). Senza questa asserzione si potevano
    // cancellare `geometry`/`seatConfig` dal `branch` del router e la suite
    // restava verde: `kitInputFromRequest` avrebbe poi rifiutato ogni riga ARTECH.
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: { ...validInput, geometry: "A12_I9_B18", seatConfig: "SEDE_30" } });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      geometry: "A12_I9_B18",
      seatConfig: "SEDE_30",
    });
  });

  it("seatConfig omesso → il default zod STANDARD finisce a DB (nessun default a DB)", async () => {
    // La colonna non ha `@default` a schema Prisma (un default DB valorizzerebbe
    // anche le righe TOUR e mascherebbe una sede 30 legacy): l'unico default è
    // quello di zod, e deve arrivare fino alla riga.
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: { ...validInput, seatConfig: undefined } });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ seatConfig: "STANDARD" });
  });

  it("inoltra supplementaryClosures nel payload create (persistito su colonna KitRequest)", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: { ...validInput, supplementaryClosures: true } });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ supplementaryClosures: true });
  });

  it("inoltra sashWeightKg nel payload create (colonna KitRequest, facoltativa)", async () => {
    // `create` fa lo spread dell'intero KitInput dentro prisma.kitRequest.create:
    // ogni campo nuovo dello schema DEVE avere la sua colonna, altrimenti Prisma
    // risponde «Unknown argument» a runtime (il typecheck non lo vede, lo spread
    // non è soggetto all'excess property check).
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: { ...validInput, sashWeightKg: 75 } });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ sashWeightKg: 75 });
  });

  it("inoltra entrata nel payload create (colonna KitRequest)", async () => {
    // Stessa ragione degli altri tre test di inoltro: `entrata` è l'ultimo
    // parametro che il motore decideva da sé (costante E15 cablata) — senza
    // questa asserzione si poteva cancellare `entrata` dal `branch` del router e
    // la suite restava verde, mentre ogni richiesta a entrata 7,5 sarebbe
    // silenziosamente tornata 15 mm in produzione.
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: { ...validInput, entrata: "E75" } });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ entrata: "E75" });
  });

  it("input invalido → BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.create({ specs: { ...validInput, widthMm: 10 } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("kit.generate", () => {
  it("richiesta altrui → NOT_FOUND", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "altrui" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("errore regole (fuori campo applicazione) → BAD_REQUEST italiano, resta DRAFT", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", agentId: "agent1", ...validInput, heightMm: 3000, status: "DRAFT" });
    templateFindFirst.mockResolvedValue({ id: "t1", rules: { engine: "artech-ar-legno", version: 1 } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "k1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("successo → persiste componenti + stato COMPLETED + KIT_GENERATED", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", agentId: "agent1", ...validInput, status: "DRAFT" });
    templateFindFirst.mockResolvedValue({ id: "t1", rules: { engine: "artech-ar-legno", version: 1 } });
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve((where.agbCode.in as string[]).map((code: string) => ({
        id: "p_" + code, agbCode: code, name: "N " + code, basePrice: { toString: () => "1.5" },
      }))),
    );
    componentDeleteMany.mockResolvedValue({});
    componentCreateMany.mockResolvedValue({});
    requestUpdate.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const output = await caller.kit.generate({ kitRequestId: "k1" });
    // Task 1 (Fase 1g): validInput non imposta supplementaryClosures →
    // default OFF → set obbligatorio (12 righe), non più 16.
    expect(output.lines).toHaveLength(12);
    expect(componentCreateMany).toHaveBeenCalled();
    const rows = componentCreateMany.mock.calls[0]![0].data;
    expect(rows[0]).toMatchObject({ kitRequestId: "k1", componentCode: expect.any(String), ruleId: expect.any(String) });
    // `engineVersion` è timbrata sulla riga (colonna, non più solo dentro il JSON):
    // è ciò che permetterà al ricalcolo versionato di dire quali distinte le ha
    // prodotte il motore vecchio. Senza questa asserzione si poteva cancellare la
    // riga dal router e la suite restava verde, con la colonna sempre NULL.
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          totalComponents: 12,
          engineVersion: ENGINE_VERSION,
        }),
      }),
    );
    expect(output.engineVersion).toBe(ENGINE_VERSION);
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "KIT_GENERATED" }) });
  });

  // GUARDIA DEL VERSIONAMENTO. `generate` fa deleteMany + createMany su
  // `kit_components`, e dei componenti non esiste storico: su una riga già
  // emessa riscriverebbe la distinta che il cliente ha in mano, su una riga
  // superata corromperebbe lo storico congelato da `ricalcola`. La UI non basta
  // — una scheda aperta in un'altra tab, il tasto Indietro o un secondo
  // dispositivo la aggirano — quindi l'invariante va provata QUI.
  it("richiesta non-DRAFT (già emessa) → CONFLICT, nessuna scrittura", async () => {
    requestFindFirst.mockResolvedValue({
      id: "k1", agentId: "agent1", ...validInput, status: "COMPLETED", supersededById: null,
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "k1" })).rejects.toMatchObject({
      code: "CONFLICT",
      // Il messaggio nomina il pulsante che l'agente deve premere: dal
      // 2026-08-01 si chiama «Nuova versione», perché «Ricalcola» prometteva
      // «rifai lo stesso conto» mentre emette un documento con un numero nuovo.
      message: expect.stringContaining("Nuova versione"),
    });
    expect(componentDeleteMany).not.toHaveBeenCalled();
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("richiesta superata (supersededById) → CONFLICT, nessuna scrittura", async () => {
    requestFindFirst.mockResolvedValue({
      id: "k1", agentId: "agent1", ...validInput, status: "DRAFT", supersededById: "k2",
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "k1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(componentDeleteMany).not.toHaveBeenCalled();
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("rilegge sashWeightKg dalla richiesta e lo passa alle regole (vasistas)", async () => {
    // L 600 → 1 forbice → portata 40 kg: un'anta da 50 kg va rifiutata in
    // italiano. Se il router non inoltrasse il peso, la generazione riuscirebbe.
    requestFindFirst.mockResolvedValue({
      id: "k1", agentId: "agent1", ...validInput,
      windowType: "VASISTAS", widthMm: 600, heightMm: 1000, sashWeightKg: 50, status: "DRAFT",
    });
    templateFindFirst.mockResolvedValue({
      id: "t1", rules: { engine: "artech-vasistas-legno", version: 1 },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "k1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("portata delle forbici"),
    });
    expect(requestUpdate).not.toHaveBeenCalled();
  });
});

describe("kit.list / kit.get", () => {
  it("lista solo le proprie richieste", async () => {
    requestFindMany.mockResolvedValue([]);
    requestCount.mockResolvedValue(0);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.list({});
    expect(requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent1" }, orderBy: { createdAt: "desc" } }),
    );
  });

  it("get con ownership → NOT_FOUND se altrui", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.get({ id: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("get success → restituisce richiesta con componenti + prodotto", async () => {
    requestFindFirst.mockResolvedValue({
      id: "k1",
      agentId: "agent1",
      ...validInput,
      status: "COMPLETED",
      totalComponents: 1,
      totalPrice: { toString: () => "99.99" },
      generatedKit: null,
      generatedAt: null,
      createdAt: new Date(),
      components: [
        {
          id: "c1",
          kitRequestId: "k1",
          productId: "p1",
          componentCode: "COMP-001",
          componentName: "Componente Test",
          position: "TOP",
          quantity: 1,
          unitPrice: { toString: () => "99.99" },
          totalPrice: { toString: () => "99.99" },
          sortOrder: 0,
          ruleId: "r1",
          ruleDescription: "Test Rule",
          product: { id: "p1", agbCode: "X", name: "N", isAvailable: true, listinoPage: 418 },
        },
      ],
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.kit.get({ id: "k1" });
    expect(requestFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "k1", agentId: "agent1" },
        include: expect.objectContaining({
          components: expect.objectContaining({
            include: expect.objectContaining({
              product: expect.objectContaining({
                select: { id: true, agbCode: true, name: true, isAvailable: true, listinoPage: true },
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toMatchObject({
      product: { agbCode: "X", listinoPage: 418 },
      unitPrice: 99.99,
      totalPrice: 99.99,
    });
    expect(result.totalPrice).toBe(99.99);
  });
});

describe("kit.ricalcola", () => {
  beforeEach(() => {
    requestCount.mockResolvedValue(7);
  });

  it("richiesta altrui → NOT_FOUND", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.ricalcola({ kitRequestId: "altrui" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("su una richiesta COMPLETED crea una NUOVA riga e marca l'originale", async () => {
    requestFindFirst.mockResolvedValue({
      ...validInput,
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
      customerId: null,
      tourSchema: null,
      sashWeightKg: null,
      notes: null,
    });
    requestCreate.mockResolvedValue({ id: "req2", requestNumber: "KIT-2026-0008" });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const nuova = await caller.kit.ricalcola({ kitRequestId: "req1" });

    expect(nuova.id).toBe("req2");
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", geometry: validInput.geometry }),
      }),
    );
    expect(requestUpdateMany).toHaveBeenCalledWith({
      where: { id: "req1", supersededById: null },
      data: { supersededById: "req2" },
    });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "KIT_REQUEST_CREATED",
        resourceId: "req2",
      }),
    });
  });

  it("marcatura concorrente (count 0) → CONFLICT, nessun orfano", async () => {
    // Simula due `ricalcola` concorrenti sulla stessa riga: il check fail-fast
    // in cima (`if (request.supersededById)`) è check-then-act e può essere
    // superato da entrambe. La garanzia vera è la `updateMany` condizionata
    // dentro la transazione — qui la si fa fallire (count 0, come se un'altra
    // chiamata avesse già marcato la riga) e si verifica che l'intera
    // transazione (quindi anche la `create`) venga rigettata: nessuna riga
    // orfana, nessun log d'audit per una versione mai davvero creata.
    requestFindFirst.mockResolvedValue({
      ...validInput,
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
      customerId: null,
      tourSchema: null,
      sashWeightKg: null,
      notes: null,
    });
    requestCreate.mockResolvedValue({ id: "req2", requestNumber: "KIT-2026-0008" });
    requestUpdateMany.mockResolvedValue({ count: 0 });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.ricalcola({ kitRequestId: "req1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("copia tutti i campi necessari a rigenerare (nessun campo dimenticato)", async () => {
    // Rete di sicurezza per il monito del task: un campo dimenticato qui non fa
    // fallire il typecheck (è un campo Prisma opzionale semplicemente omesso, non
    // un nome storpiato) — solo un'asserzione sul valore lo scopre. Valori tutti
    // diversi dai default/null così un omissione si vede subito.
    requestFindFirst.mockResolvedValue({
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
      windowType: "VASISTAS",
      widthMm: 700,
      heightMm: 900,
      material: "LEGNO",
      finish: "BRONZO",
      series: "ARTECH",
      geometry: "A4_I9_B18",
      entrata: "E75",
      seatConfig: "SEDE_30",
      openingSide: "DESTRA",
      openingDir: "SPINGERE",
      supplementaryClosures: true,
      sashWeightKg: 42,
      tourSchema: null,
      notes: "nota di prova",
      customerId: "cust1",
      // Valorizzato e diverso da null/{} come tutti gli altri campi di questo
      // test: se `ricalcola` dimenticasse `variants` nella copia, qui non lo
      // vedrebbe nessun altro test (quello del giro completo usa un valore
      // presente ma non prova l'assenza del campo dalla copia).
      variants: { squadraAngolare: "TRAVERSO_ALU" },
    });
    requestCreate.mockResolvedValue({ id: "req2", requestNumber: "KIT-2026-0008" });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "req1" });

    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      windowType: "VASISTAS",
      widthMm: 700,
      heightMm: 900,
      material: "LEGNO",
      finish: "BRONZO",
      series: "ARTECH",
      geometry: "A4_I9_B18",
      entrata: "E75",
      seatConfig: "SEDE_30",
      openingSide: "DESTRA",
      openingDir: "SPINGERE",
      supplementaryClosures: true,
      sashWeightKg: 42,
      tourSchema: null,
      notes: "nota di prova",
      customerId: "cust1",
      status: "DRAFT",
      agentId: "agent1",
      variants: { squadraAngolare: "TRAVERSO_ALU" },
    });
  });

  it("su una richiesta DRAFT rigenera in loco: nessuna riga nuova", async () => {
    requestFindFirst.mockResolvedValue({
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "DRAFT",
      supersededById: null,
    });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const esito = await caller.kit.ricalcola({ kitRequestId: "req1" });

    expect(esito.id).toBe("req1");
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("una richiesta già ricalcolata rifiuta con CONFLICT", async () => {
    requestFindFirst.mockResolvedValue({
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: "req2",
    });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.ricalcola({ kitRequestId: "req1" })).rejects.toThrow(/già.*ricalcolata/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `ricalcola` con `variants` (2026-08-01). Prima di oggi le varianti scelte nel
// passo «Componenti» non si cambiavano più dopo la creazione: si rifaceva il
// wizard da capo.
//
// Contratto: assente = eredita verbatim · `{}` = reset esplicito allo standard
// (scrive NULL) · oggetto = SOSTITUZIONE INTEGRALE, mai un merge.
// ─────────────────────────────────────────────────────────────────────────────
describe("kit.ricalcola — varianti", () => {
  const emessa = {
    id: "req1",
    agentId: "agent1",
    requestNumber: "KIT-2026-0007",
    status: "COMPLETED",
    supersededById: null,
    ...validInput,
    supplementaryClosures: true,
    sashWeightKg: null,
    tourSchema: null,
    notes: null,
    customerId: null,
    discountPercent: null,
    variants: { squadraAngolare: "BASE" },
  };

  /** Mock perché la validazione in memoria arrivi in fondo senza sollevare. */
  function preparaRicalcolo(row: Record<string, unknown> = emessa) {
    requestCount.mockResolvedValue(11);
    requestFindFirst.mockResolvedValue(row);
    templateFindFirst.mockResolvedValue({
      id: "t1",
      rules: { engine: "artech-ar-legno", version: 1 },
    });
    // Ogni codice risolve a un prodotto con prezzo: al router serve che il
    // motore non sollevi, non i prezzi veri — quelli li asserisce il gate su
    // catalogo reale (`engine.integration.test.ts`).
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve(
        (where.agbCode.in as string[]).map((code: string) => ({
          id: "p_" + code,
          agbCode: code,
          name: "N " + code,
          basePrice: { toString: () => "1.5" },
        })),
      ),
    );
    requestCreate.mockResolvedValue({ id: "req2", requestNumber: "KIT-2026-0012" });
  }

  it("senza `variants` la nuova versione eredita quelle della riga", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "req1" });
    expect(requestCreate.mock.calls[0]![0].data.variants).toEqual({ squadraAngolare: "BASE" });
  });

  it("con `variants` la nuova versione porta le nuove, non un merge", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({
      kitRequestId: "req1",
      variants: { piastrinoAntieffrazione: true },
    });
    // `squadraAngolare` NON sopravvive: una variante che l'agente non vede più
    // a schermo non deve restare nel dato — sarebbe «campo persistito e mai
    // dichiarato», la stessa classe di difetto pagata sette volte.
    expect(requestCreate.mock.calls[0]![0].data.variants).toEqual({
      piastrinoAntieffrazione: true,
    });
  });

  it("`variants: {}` è il reset esplicito: scrive NULL, non {}", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "req1", variants: {} });
    expect(requestCreate.mock.calls[0]![0].data.variants).toBe(Prisma.DbNull);
  });

  it("un blocco che si pota a vuoto scrive NULL, non {}", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({
      kitRequestId: "req1",
      variants: { piastrinoAntieffrazione: false },
    });
    expect(requestCreate.mock.calls[0]![0].data.variants).toBe(Prisma.DbNull);
  });

  // IL TEST CHE CONTA. La validazione sta PRIMA di qualunque scrittura.
  // `COMPENSATORE` non è pubblicata a listino per l'interasse 8,5 (è la
  // geometria del cliente MC): il modulo solleva. Se il rifiuto arrivasse dopo,
  // resterebbe una richiesta superata che punta a una riga non generabile — e
  // la vecchia sarebbe congelata, perché `generate` e `ricalcola` la rifiutano
  // entrambi.
  it("una variante non disponibile per quella geometria è rifiutata SENZA scrivere", async () => {
    preparaRicalcolo({ ...emessa, geometry: "A4_I85_B15", variants: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({
        kitRequestId: "req1",
        variants: { squadraAngolare: "COMPENSATORE" },
      }),
    ).rejects.toThrow(/non disponibile|non la pubblica/);
    expect(requestCreate).not.toHaveBeenCalled();
    expect(requestUpdateMany).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("su una bozza scrive sulla stessa riga: nessuna versione, nessun numero consumato", async () => {
    preparaRicalcolo({ ...emessa, status: "DRAFT" });
    requestUpdate.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.kit.ricalcola({
      kitRequestId: "req1",
      variants: { piastrinoAntieffrazione: true },
    });
    expect(out).toEqual({ id: "req1", requestNumber: "KIT-2026-0007" });
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: { variants: { piastrinoAntieffrazione: true } },
    });
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("su una bozza il reset scrive NULL sulla stessa riga", async () => {
    preparaRicalcolo({ ...emessa, status: "DRAFT" });
    requestUpdate.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "req1", variants: {} });
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: { variants: Prisma.DbNull },
    });
  });

  it("su una bozza SENZA `variants` non tocca la colonna (comportamento storico)", async () => {
    preparaRicalcolo({ ...emessa, status: "DRAFT" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.ricalcola({ kitRequestId: "req1" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  // Il ramo TOUR non dichiara varianti: `kitInputFromRequest` non le
  // proporrebbe nemmeno al parse, quindi senza questo rifiuto verrebbero
  // raccolte, persistite e MAI LETTE da nessun modulo.
  it("su una richiesta TOUR le varianti sono rifiutate, con la serie nel messaggio", async () => {
    preparaRicalcolo({
      ...emessa,
      series: "TOUR",
      windowType: "BILICO",
      geometry: null,
      entrata: null,
      tourSchema: 2,
      variants: null,
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({
        kitRequestId: "req1",
        variants: { piastrinoAntieffrazione: true },
      }),
    ).rejects.toThrow(/TOUR/);
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("una chiave sconosciuta è rifiutata dallo schema, prima di ogni scrittura", async () => {
    preparaRicalcolo();
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({
        kitRequestId: "req1",
        // @ts-expect-error — chiave inesistente: `variantiSchema` è `.strict()`
        variants: { squadraAngolareX: "BASE" },
      }),
    ).rejects.toThrow();
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("la guardia sulla riga superata scatta anche portando varianti", async () => {
    preparaRicalcolo({ ...emessa, supersededById: "req9" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.ricalcola({
        kitRequestId: "req1",
        variants: { piastrinoAntieffrazione: true },
      }),
    ).rejects.toThrow(/già.*ricalcolata/i);
    expect(requestCreate).not.toHaveBeenCalled();
  });
});

describe("kit.create — il cliente e il suo sconto", () => {
  beforeEach(() => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
  });

  it("senza cliente la richiesta nasce senza sconto", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      customerId: null,
      discountPercent: null,
    });
    expect(customerFindUnique).not.toHaveBeenCalled();
  });

  it("col cliente timbra lo sconto del cliente sulla richiesta", async () => {
    customerFindUnique.mockResolvedValue({ id: "c1", discount: { toString: () => "42.5" } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput, customerId: "c1" });
    const data = requestCreate.mock.calls[0]![0].data;
    expect(data.customerId).toBe("c1");
    expect(Number(data.discountPercent)).toBe(42.5);
  });

  it("un cliente senza sconto non inventa una percentuale", async () => {
    customerFindUnique.mockResolvedValue({ id: "c1", discount: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput, customerId: "c1" });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      customerId: "c1",
      discountPercent: null,
    });
  });

  it("un cliente inesistente e` NOT_FOUND e non crea niente", async () => {
    customerFindUnique.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.create({ specs: validInput, customerId: "fantasma" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requestCreate).not.toHaveBeenCalled();
  });
});

describe("kit.get — il netto", () => {
  const base = {
    id: "k1",
    requestNumber: "KIT-2026-0001",
    totalPrice: { toString: () => "90.20" },
    components: [],
    customer: null,
  };

  it("senza sconto il netto e` il lordo e lo sconto e` nullo", async () => {
    requestFindFirst.mockResolvedValue({ ...base, discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.totalPrice).toBe(90.2);
    expect(r.discountPercent).toBeNull();
    expect(r.netPrice).toBe(90.2);
    expect(r.discountAmount).toBeNull();
  });

  it("col 40% il netto del golden e` 54,12 EUR", async () => {
    requestFindFirst.mockResolvedValue({
      ...base,
      discountPercent: { toString: () => "40" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.totalPrice).toBe(90.2);
    expect(r.discountPercent).toBe(40);
    expect(r.discountAmount).toBe(36.08);
    expect(r.netPrice).toBe(54.12);
  });

  it("una distinta non ancora generata non ha netto", async () => {
    requestFindFirst.mockResolvedValue({
      ...base,
      totalPrice: null,
      discountPercent: { toString: () => "40" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.netPrice).toBeNull();
    expect(r.discountAmount).toBeNull();
  });

  it("restituisce la soglia, perche` la UI deve sapere quando avvisare", async () => {
    requestFindFirst.mockResolvedValue({ ...base, discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.get({ id: "k1" })).resolves.toMatchObject({ soglia: 40 });
  });
});

describe("kit.setDiscount", () => {
  it("modifica lo sconto anche su una distinta GIA` generata (e` il punto)", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", supersededById: null });
    requestUpdate.mockResolvedValue({ id: "k1", discountPercent: { toString: () => "42.5" } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.setDiscount({ id: "k1", discountPercent: 42.5 })).resolves.toEqual({
      id: "k1",
      discountPercent: 42.5,
    });
  });

  it("azzerare lo sconto e` possibile", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", supersededById: null });
    requestUpdate.mockResolvedValue({ id: "k1", discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.setDiscount({ id: "k1", discountPercent: null })).resolves.toEqual({
      id: "k1",
      discountPercent: null,
    });
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { discountPercent: null } }),
    );
  });

  it("su una richiesta di un altro agente e` NOT_FOUND", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "altrui", discountPercent: 40 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("su una riga gia` superata rifiuta: si sconta la versione piu` recente", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", supersededById: "k2" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: 40 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it.each([101, -1, 40.555])("rifiuta lo sconto non valido %s", async (v) => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: v }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("kit — le varianti sopravvivono al giro completo", () => {
  // Il modulo anta-ribalta non legge ancora `variants` (Task 5, deliberatamente
  // dopo questo): qui si prova solo il PERCORSO DATI, non l'effetto sulla
  // distinta. Se il giro creazione → rilettura → ricalcolo perdesse le
  // varianti in uno dei tre punti, questo test lo scoprirebbe prima che un
  // modulo inizi a fidarsene.
  it("la variante sopravvive al giro creazione → rilettura → ricalcolo", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));

    // 1. CREATE — le varianti scelte nel wizard finiscono sulla colonna.
    await caller.kit.create({
      specs: { ...validInput, variants: { squadraAngolare: "BASE" } },
    });
    const creata = requestCreate.mock.calls[0]![0].data;
    expect(creata.variants).toEqual({ squadraAngolare: "BASE" });

    // 2. RILETTURA — la riga (così come uscirebbe da Prisma) si ricostruisce
    // in un `KitInput` puro, senza toccare il DB (from-request.ts è testabile
    // da solo per questo).
    const riga: PersistedKitRequest = {
      windowType: creata.windowType,
      widthMm: creata.widthMm,
      heightMm: creata.heightMm,
      material: creata.material,
      finish: creata.finish,
      series: creata.series,
      geometry: creata.geometry,
      entrata: creata.entrata,
      seatConfig: creata.seatConfig,
      openingSide: creata.openingSide,
      openingDir: creata.openingDir,
      supplementaryClosures: creata.supplementaryClosures,
      sashWeightKg: creata.sashWeightKg,
      tourSchema: creata.tourSchema ?? null,
      notes: creata.notes,
      variants: creata.variants,
    };
    const input = kitInputFromRequest(riga);
    expect(input.series === "ARTECH" && input.variants).toEqual({ squadraAngolare: "BASE" });

    // 3. RICALCOLO — su una riga già emessa nasce una versione nuova, che deve
    // ereditare le stesse varianti (non rinegoziarle).
    requestCount.mockResolvedValue(7);
    requestFindFirst.mockResolvedValue({
      ...creata,
      id: "k1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
    });
    requestCreate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0008" });
    await caller.kit.ricalcola({ kitRequestId: "k1" });
    const ricalcolata = requestCreate.mock.calls[1]![0].data;
    expect(ricalcolata.variants).toEqual({ squadraAngolare: "BASE" });
  });

  // Gemello a NULL del test sopra: «assente» non è «vuoto». `Prisma.DbNull` è
  // il sentinella che dice a Prisma di scrivere un NULL su una colonna JSON —
  // un `{}` letterale sarebbe una richiesta con "zero varianti scelte" invece
  // che "nessuna variante mai scelta", e le due cose non sono la stessa cosa
  // (un domani, un modulo potrebbe leggere `{}` come "campo presente" invece
  // che "campo assente").
  it("una richiesta SENZA varianti scrive Prisma.DbNull, e il ricalcolo non lo materializza in {}", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));

    // 1. CREATE — nessuna variante nel wizard: `validInput` non porta `variants`.
    await caller.kit.create({ specs: validInput });
    const creata = requestCreate.mock.calls[0]![0].data;
    expect(creata.variants).toBe(Prisma.DbNull);

    // 2. RICALCOLO — una colonna JSON NULL torna da Prisma come `null` (mai
    // come `Prisma.DbNull`, che è solo il sentinella di SCRITTURA): la riga
    // che `ricalcola` rilegge ha quindi `variants: null`, non `Prisma.DbNull`.
    requestCount.mockResolvedValue(7);
    requestFindFirst.mockResolvedValue({
      ...creata,
      variants: null,
      id: "k1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
    });
    requestCreate.mockResolvedValue({ id: "k2", requestNumber: "KIT-2026-0008" });
    await caller.kit.ricalcola({ kitRequestId: "k1" });
    const ricalcolata = requestCreate.mock.calls[1]![0].data;
    expect(ricalcolata.variants).toBe(Prisma.DbNull);
  });
});
