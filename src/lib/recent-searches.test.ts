import { describe, it, expect } from "vitest";
import { deriveRecentSearches } from "./recent-searches";

const row = (query: unknown, results?: unknown) => ({ metadata: { query, results } });

describe("deriveRecentSearches", () => {
  it("scarta 0-risultati, query vuote e metadata malformato", () => {
    const out = deriveRecentSearches([
      row("cerniera", 5),
      row("vuota", 0),
      row("   ", 3),
      row(123, 3),
      { metadata: null },
    ]);
    expect(out).toEqual(["cerniera"]);
  });

  it("dedup case/spazi tenendo la più recente", () => {
    expect(deriveRecentSearches([row("Cerniera", 2), row("cerniera ", 2)])).toEqual(["Cerniera"]);
  });

  it("collassa i prefissi", () => {
    // ordine = più recente prima
    expect(deriveRecentSearches([row("cerniera", 4), row("cer", 4)])).toEqual(["cerniera"]);
    expect(deriveRecentSearches([row("cerniera argento", 4), row("cerniera", 4)])).toEqual([
      "cerniera argento",
    ]);
  });

  it("rispetta il limite", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`q${i}`, 1));
    expect(deriveRecentSearches(rows, { limit: 8 })).toHaveLength(8);
  });

  it("tiene le ricerche con results sconosciuto (undefined)", () => {
    expect(deriveRecentSearches([row("maniglia")])).toEqual(["maniglia"]);
  });
});
