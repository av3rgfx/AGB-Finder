import { describe, it, expect, vi, beforeEach } from "vitest";

const { search, getRelated } = vi.hoisted(() => ({
  search: vi.fn(),
  getRelated: vi.fn(),
}));
vi.mock("@/server/ai/rag", () => ({ ragEngine: { search, getRelated } }));

import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const router = createTRPCRouter({ product: productRouter });
const makeCtx = (session: unknown, db: unknown = {}): TRPCContext => ({
  db: db as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
});
const agent = { user: { id: "a1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  search.mockReset().mockResolvedValue({ hits: [], queryTimeMs: 5 });
  getRelated.mockReset().mockResolvedValue([]);
});

describe("product.search", () => {
  it("requires authentication", async () => {
    const caller = createCallerFactory(router)(makeCtx(null));
    await expect(caller.product.search({ query: "cerniera" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("delegates to ragEngine with filters and logs the activity", async () => {
    const create = vi.fn().mockResolvedValue({});
    const caller = createCallerFactory(router)(makeCtx(agent, { activityLog: { create } }));
    const res = await caller.product.search({ query: "cerniera", filters: { inStock: true } });
    expect(search).toHaveBeenCalledWith("cerniera", { inStock: true }, { limit: 20, offset: 0 });
    expect(res.queryTimeMs).toBe(5);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "PRODUCT_SEARCHED", userId: "a1" }),
      }),
    );
  });

  it("rejects an empty query", async () => {
    const caller = createCallerFactory(router)(makeCtx(agent));
    await expect(caller.product.search({ query: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("product.getByCode / getById", () => {
  it("getByCode maps Decimal prices to plain numbers", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "p1",
      agbCode: "B00590.15.03",
      name: "x",
      basePrice: { toString: () => "1.23" },
      discountedPrice: null,
      category: { name: "SERRATURE", slug: "serrature" },
    });
    const caller = createCallerFactory(router)(makeCtx(agent, { product: { findUnique } }));
    const p = await caller.product.getByCode({ agbCode: "B00590.15.03" });
    expect(p!.basePrice).toBe(1.23);
    expect(p!.discountedPrice).toBeNull();
  });

  it("getById returns null for a missing product", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const caller = createCallerFactory(router)(makeCtx(agent, { product: { findUnique } }));
    expect(await caller.product.getById({ id: "missing" })).toBeNull();
  });
});

describe("product.list", () => {
  it("paginates via Prisma and maps prices", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const caller = createCallerFactory(router)(makeCtx(agent, { product: { findMany, count } }));
    const res = await caller.product.list({ limit: 12, offset: 24 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 12, skip: 24 }));
    expect(res.total).toBe(0);
  });
});

describe("product.getRelated", () => {
  it("delegates to ragEngine", async () => {
    const caller = createCallerFactory(router)(makeCtx(agent));
    await caller.product.getRelated({ productId: "p1", limit: 4 });
    expect(getRelated).toHaveBeenCalledWith("p1", 4);
  });
});
