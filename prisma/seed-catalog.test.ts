import { describe, it, expect } from "vitest";
import { buildCatalogSeedRows } from "./seed-catalog";

describe("buildCatalogSeedRows", () => {
  const rows = buildCatalogSeedRows();

  it("yields the fixture products, deduplicated", () => {
    expect(rows.length).toBe(37); // 14 serrature + 8 cerniere + 15 profili
    expect(new Set(rows.map((r) => r.agbCode)).size).toBe(rows.length);
  });

  it("covers three categories", () => {
    expect(new Set(rows.map((r) => r.category))).toEqual(
      new Set(["SERRATURE", "CERNIERE", "IMAGO E IMAGO+"]),
    );
  });

  it("every row has a positive price", () => {
    for (const r of rows) expect(r.priceCents).toBeGreaterThan(0);
  });
});
