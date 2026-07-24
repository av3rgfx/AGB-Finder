import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const findMany = vi.fn();
const dbStub = { activityLog: { findMany } };
const appRouter = createTRPCRouter({ product: productRouter });
const makeCtx = (session: unknown): TRPCContext =>
  ({ db: dbStub, session, headers: new Headers() }) as unknown as TRPCContext;
const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("product.recentSearches", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.product.recentSearches()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("filtra per utente, tipo, 7 giorni; take 100; desc; deriva la lista", async () => {
    findMany.mockResolvedValue([
      { metadata: { query: "cerniera", results: 3 } },
      { metadata: { query: "cer", results: 3 } },
      { metadata: { query: "vuota", results: 0 } },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.product.recentSearches();
    expect(out).toEqual(["cerniera"]);
    const arg = findMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ userId: "agent1", type: "PRODUCT_SEARCHED" });
    expect((arg.where.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
    expect(arg.take).toBe(100);
    expect(arg.orderBy).toMatchObject({ createdAt: "desc" });
    expect(arg.select).toMatchObject({ metadata: true });
  });
});
