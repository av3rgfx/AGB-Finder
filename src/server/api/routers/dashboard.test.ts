import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { dashboardRouter } from "./dashboard";

const appRouter = createTRPCRouter({ dashboard: dashboardRouter });

const kitCount = vi.fn();
const convCount = vi.fn();
const logCount = vi.fn();
const kitFindMany = vi.fn();

const dbStub = {
  kitRequest: { count: kitCount, findMany: kitFindMany },
  conversation: { count: convCount },
  activityLog: { count: logCount },
};

const makeCtx = (session: unknown): TRPCContext =>
  ({ db: dbStub, session, headers: new Headers() }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };

beforeEach(() => {
  for (const fn of [kitCount, convCount, logCount, kitFindMany]) fn.mockReset();
  kitCount.mockResolvedValue(0);
  convCount.mockResolvedValue(0);
  logCount.mockResolvedValue(0);
  kitFindMany.mockResolvedValue([]);
});

describe("dashboard.overview", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.dashboard.overview({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("scope mine → tutte le count filtrano per l'utente", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.scope).toBe("mine");
    expect(kitCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
    expect(convCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
    expect(logCount.mock.calls[0]![0].where).toMatchObject({ userId: "agent1", type: "PRODUCT_SEARCHED" });
    expect(kitFindMany.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
  });

  it("ADMIN scope team → count senza filtro utente", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    const out = await caller.dashboard.overview({ scope: "team" });
    expect(out.scope).toBe("team");
    expect(kitCount.mock.calls[0]![0].where).not.toHaveProperty("agentId");
    expect(convCount.mock.calls[0]![0].where).not.toHaveProperty("agentId");
    expect(logCount.mock.calls[0]![0].where).not.toHaveProperty("userId");
    expect(logCount.mock.calls[0]![0].where).toMatchObject({ type: "PRODUCT_SEARCHED" });
  });

  it("AGENT che forza scope team → ridotto a mine", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "team" });
    expect(out.scope).toBe("mine");
    expect(kitCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
  });

  it("kitGenerati conta generatedAt not null", async () => {
    kitCount.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      const gen = where.generatedAt as { not?: unknown } | undefined;
      if (gen && "not" in gen) return Promise.resolve(7);
      return Promise.resolve(20);
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.stats.kitGenerati.total).toBe(7);
    expect(out.stats.richieste.total).toBe(20);
  });

  it("i conteggi 'oggi' filtrano per createdAt >= inizio giornata", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.dashboard.overview({ scope: "mine" });
    const todayCall = kitCount.mock.calls.find(
      ([arg]) => (arg.where as { createdAt?: unknown }).createdAt,
    );
    expect((todayCall![0].where.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
  });

  it("recentKits mappa Decimal→number e customerName", async () => {
    kitFindMany.mockResolvedValue([
      {
        id: "k1", requestNumber: "KIT-2026-0001", status: "COMPLETED",
        createdAt: new Date("2026-07-06T08:00:00Z"),
        totalPrice: { toString: () => "90.2" }, customer: { companyName: "ACME Srl" },
      },
      {
        id: "k2", requestNumber: "KIT-2026-0002", status: "DRAFT",
        createdAt: new Date("2026-07-06T09:00:00Z"), totalPrice: null, customer: null,
      },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.recentKits[0]).toMatchObject({
      requestNumber: "KIT-2026-0001", totalPrice: 90.2, customerName: "ACME Srl",
    });
    expect(out.recentKits[1]).toMatchObject({ totalPrice: null, customerName: null });
  });
});
