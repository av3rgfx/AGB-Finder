import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { ENGINE_VERSION } from "@/server/kit/engine";
import { kitRouter } from "./kit";

const appRouter = createTRPCRouter({ kit: kitRouter });

const requestCreate = vi.fn();
const requestFindFirst = vi.fn();
const requestFindMany = vi.fn();
const requestUpdate = vi.fn();
const requestCount = vi.fn();
const componentDeleteMany = vi.fn();
const componentCreateMany = vi.fn();
const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const activityCreate = vi.fn();
const transaction = vi.fn();

const dbStub = {
  kitRequest: { create: requestCreate, findFirst: requestFindFirst, findMany: requestFindMany, update: requestUpdate, count: requestCount },
  kitComponent: { deleteMany: componentDeleteMany, createMany: componentCreateMany },
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
  activityLog: { create: activityCreate },
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
  geometry: "A12_I13_B20", seatConfig: "STANDARD",
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
} as const;

beforeEach(() => {
  for (const fn of [requestCreate, requestFindFirst, requestFindMany, requestUpdate, requestCount, componentDeleteMany, componentCreateMany, templateFindFirst, productFindMany, activityCreate, transaction]) {
    fn.mockReset();
  }
  activityCreate.mockResolvedValue({});
  transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("kit.create", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.kit.create(validInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("crea DRAFT con requestNumber KIT-YYYY-NNNN e logga", async () => {
    requestCount.mockResolvedValue(41);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const created = await caller.kit.create(validInput);
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
    await caller.kit.create({ ...validInput, geometry: "A12_I9_B18", seatConfig: "SEDE_30" });
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
    await caller.kit.create({ ...validInput, seatConfig: undefined });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ seatConfig: "STANDARD" });
  });

  it("inoltra supplementaryClosures nel payload create (persistito su colonna KitRequest)", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ ...validInput, supplementaryClosures: true });
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
    await caller.kit.create({ ...validInput, sashWeightKg: 75 });
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({ sashWeightKg: 75 });
  });

  it("input invalido → BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.create({ ...validInput, widthMm: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: { supersededById: "req2" },
    });
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
      seatConfig: "SEDE_30",
      openingSide: "DESTRA",
      openingDir: "SPINGERE",
      supplementaryClosures: true,
      sashWeightKg: 42,
      tourSchema: null,
      notes: "nota di prova",
      customerId: "cust1",
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
