import { describe, it, expect, vi, beforeEach } from "vitest";
import { TOOL_DECLARATIONS, executeTool, type ToolDb } from "./tools";

const queryRaw = vi.fn();
const executeRaw = vi.fn();
const findUnique = vi.fn();
const db = {
  $queryRaw: queryRaw,
  $executeRaw: executeRaw,
  product: { findUnique },
} as unknown as ToolDb;

const hit = {
  id: "p1",
  agbCode: "E10073.10.16",
  name: "COMPACT DX",
  shortDescription: "Cerniere · ACCIAIO",
  basePrice: 51.59,
  priceUnit: "EUR",
  isAvailable: true,
  stockQuantity: 0,
  categoryId: "c1",
  categoryName: "Cerniere",
  textScore: 0.6,
  vectorScore: 0,
  score: 0.6,
};

beforeEach(() => {
  queryRaw.mockReset();
  executeRaw.mockReset();
  findUnique.mockReset();
});

describe("TOOL_DECLARATIONS", () => {
  it("dichiara i due tool con query/agbCode obbligatori", () => {
    expect(TOOL_DECLARATIONS.map((t) => t.name)).toEqual([
      "search_products",
      "get_product_by_code",
    ]);
    expect(TOOL_DECLARATIONS[0]!.parameters).toMatchObject({ required: ["query"] });
    expect(TOOL_DECLARATIONS[1]!.parameters).toMatchObject({ required: ["agbCode"] });
  });
});

describe("executeTool — search_products", () => {
  it("cerca via RAGEngine e ritorna risultati compatti + productIds", async () => {
    queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);
    const execution = await executeTool(db, "search_products", { query: "cerniera" });
    expect(execution.productIds).toEqual(["p1"]);
    expect(execution.output).toMatchObject({
      total: 1,
      results: [
        { agbCode: "E10073.10.16", name: "COMPACT DX", price: 51.59, category: "Cerniere" },
      ],
    });
  });

  it("argomenti invalidi → output d'errore, nessuna query", async () => {
    const execution = await executeTool(db, "search_products", { query: "" });
    expect(execution.productIds).toEqual([]);
    expect(execution.output).toMatchObject({ error: expect.stringContaining("non valid") });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("limit oltre 10 → output d'errore (il modello riformula)", async () => {
    const execution = await executeTool(db, "search_products", { query: "x", limit: 50 });
    expect(execution.output).toMatchObject({ error: expect.any(String) });
  });
});

describe("executeTool — get_product_by_code", () => {
  it("trovato → scheda con specifiche e productIds", async () => {
    findUnique.mockResolvedValue({
      id: "p1",
      agbCode: "B00590.15.03",
      name: "Serratura",
      shortDescription: null,
      basePrice: { toString: () => "10.5" },
      priceUnit: "EUR",
      isAvailable: true,
      stockQuantity: 3,
      specifications: { materiale: "ACCIAIO" },
      category: { name: "Serrature" },
    });
    const execution = await executeTool(db, "get_product_by_code", { agbCode: "B00590.15.03" });
    expect(execution.productIds).toEqual(["p1"]);
    expect(execution.output).toMatchObject({
      agbCode: "B00590.15.03",
      price: 10.5,
      category: "Serrature",
    });
  });

  it("non trovato → output d'errore, productIds vuoto", async () => {
    findUnique.mockResolvedValue(null);
    const execution = await executeTool(db, "get_product_by_code", { agbCode: "X999" });
    expect(execution.productIds).toEqual([]);
    expect(execution.output).toMatchObject({ error: expect.stringContaining("X999") });
  });
});

describe("executeTool — tool sconosciuto", () => {
  it("ritorna un errore parlante", async () => {
    const execution = await executeTool(db, "boh", {});
    expect(execution.output).toMatchObject({ error: expect.stringContaining("boh") });
  });
});
