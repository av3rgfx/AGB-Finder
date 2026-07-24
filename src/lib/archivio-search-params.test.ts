import { describe, it, expect } from "vitest";
import {
  parseSearchState,
  buildSearchQueryString,
  searchScrollKey,
} from "./archivio-search-params";

describe("parseSearchState", () => {
  it("legge query, filtri e pagina", () => {
    const s = parseSearchState(
      new URLSearchParams("q=cerniera&cat=c1&pmin=10&pmax=50&mat=acciaio&stock=1&p=3"),
    );
    expect(s).toEqual({
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, priceMax: 50, material: "acciaio", inStockOnly: true },
      page: 3,
    });
  });

  it("default sicuri su input assente/ostile", () => {
    expect(parseSearchState(new URLSearchParams(""))).toEqual({ query: "", filters: {}, page: 1 });
    const s = parseSearchState(new URLSearchParams("p=abc&pmin=-5&pmax=&stock=0"));
    expect(s.page).toBe(1);
    expect(s.filters.priceMin).toBeUndefined();
    expect(s.filters.priceMax).toBeUndefined();
    expect(s.filters.inStockOnly).toBeUndefined();
  });
});

describe("buildSearchQueryString", () => {
  it("omette i default (URL pulito) e fa round-trip", () => {
    expect(buildSearchQueryString({ query: "", filters: {}, page: 1 })).toBe("");
    const state = {
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, material: "acciaio", inStockOnly: true },
      page: 2,
    };
    const round = parseSearchState(new URLSearchParams(buildSearchQueryString(state)));
    expect(round).toEqual(state);
  });

  it("trim della query", () => {
    expect(buildSearchQueryString({ query: "  x  ", filters: {}, page: 1 })).toBe("q=x");
  });
});

describe("searchScrollKey", () => {
  it("distingue query/filtri/pagina, ignora la vista (non è nello stato)", () => {
    const a = searchScrollKey({ query: "x", filters: {}, page: 1 });
    const b = searchScrollKey({ query: "x", filters: {}, page: 2 });
    const c = searchScrollKey({ query: "y", filters: {}, page: 1 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe(searchScrollKey({ query: "x", filters: {}, page: 1 }));
  });
});
