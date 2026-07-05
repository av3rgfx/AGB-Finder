import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
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
  airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
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
    expect(output.lines).toHaveLength(16);
    expect(componentCreateMany).toHaveBeenCalled();
    const rows = componentCreateMany.mock.calls[0]![0].data;
    expect(rows[0]).toMatchObject({ kitRequestId: "k1", componentCode: expect.any(String), ruleId: expect.any(String) });
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", totalComponents: 16 }) }),
    );
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "KIT_GENERATED" }) });
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
});
