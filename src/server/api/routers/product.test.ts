import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const appRouter = createTRPCRouter({ product: productRouter });

const queryRaw = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();
const createLog = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      $queryRaw: queryRaw,
      product: { findUnique },
      productCategory: { findMany },
      activityLog: { create: createLog },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  queryRaw.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  createLog.mockReset();
});

describe("product.search", () => {
  it("richiede autenticazione (UNAUTHORIZED senza sessione)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.product.search({ query: "cerniera" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("valida la query (stringa vuota → BAD_REQUEST)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.product.search({ query: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("ritorna i risultati e logga PRODUCT_SEARCHED", async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    createLog.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.product.search({ query: "cerniera" });
    expect(result).toMatchObject({ hits: [], total: 0 });
    expect(createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "agent1",
        type: "PRODUCT_SEARCHED",
        metadata: expect.objectContaining({ query: "cerniera", results: 0 }),
      }),
    });
  });
});

describe("product.getById / getByCode", () => {
  it("NOT_FOUND per id inesistente", async () => {
    findUnique.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.product.getById({ id: "manca" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("converte i Decimal in number (serializzabile da superjson)", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      agbCode: "B00590.15.03",
      name: "X",
      basePrice: { toString: () => "1.23" },
      discountedPrice: null,
      weightKg: null,
      category: { id: "c1", name: "Serrature", slug: "serrature" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const product = await caller.product.getByCode({ agbCode: "B00590.15.03" });
    expect(product.basePrice).toBe(1.23);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agbCode: "B00590.15.03" } }),
    );
  });
});

describe("product.listCategories", () => {
  it("è pubblica e di default lista le categorie radice", async () => {
    findMany.mockResolvedValue([{ id: "c1", name: "Cerniere", slug: "cerniere", parentId: null }]);
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    const categories = await caller.product.listCategories();
    expect(categories).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: null }, orderBy: { name: "asc" } }),
    );
  });
});
