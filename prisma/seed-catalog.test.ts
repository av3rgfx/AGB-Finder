import { describe, it, expect } from "vitest";
import { SEED_ROWS } from "./seed-catalog";
import { CODE_TOKEN } from "../src/server/catalog/parse-listino";

describe("SEED_ROWS", () => {
  it("contiene 50 prodotti con codici AGB unici e validi", () => {
    expect(SEED_ROWS).toHaveLength(50);
    const codes = SEED_ROWS.map((r) => r.agbCode);
    expect(new Set(codes).size).toBe(50);
    for (const code of codes) expect(code).toMatch(CODE_TOKEN);
  });

  it("copre 6 categorie e ha prezzi/confezioni plausibili", () => {
    const categories = new Set(SEED_ROWS.map((r) => r.category));
    expect(categories).toEqual(
      new Set([
        "SERRATURE",
        "CERNIERE",
        "ARTECH",
        "CILINDRI",
        "FERRAMENTA PER IMPOSTE",
        "MULTIPUNTO",
      ]),
    );
    for (const row of SEED_ROWS) {
      expect(row.priceCents).toBeGreaterThan(0);
      expect(row.discountClass).toMatch(/^[A-Z]\d$/);
    }
  });
});
