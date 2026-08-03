import { describe, it, expect } from "vitest";
import {
  parseSearchState,
  buildSearchQueryString,
  searchScrollKey,
} from "./archivio-search-params";

describe("parseSearchState", () => {
  it("legge query, filtri e pagina", () => {
    const s = parseSearchState(
      new URLSearchParams("q=cerniera&cat=c1&pmin=10&pmax=50&mat=acciaio&p=3"),
    );
    expect(s).toEqual({
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, priceMax: 50, material: "acciaio" },
      page: 3,
    });
  });

  it("default sicuri su input assente/ostile", () => {
    expect(parseSearchState(new URLSearchParams(""))).toEqual({ query: "", filters: {}, page: 1 });
    const s = parseSearchState(new URLSearchParams("p=abc&pmin=-5&pmax="));
    expect(s.page).toBe(1);
    expect(s.filters.priceMin).toBeUndefined();
    expect(s.filters.priceMax).toBeUndefined();
  });

  it("ignora il vecchio parametro stock=1 senza rompersi", () => {
    const s = parseSearchState(new URLSearchParams("q=maniglia&stock=1"));
    expect(s.query).toBe("maniglia");
    expect(Object.keys(s.filters).length).toBe(0);
  });
});

describe("buildSearchQueryString", () => {
  it("omette i default (URL pulito) e fa round-trip", () => {
    expect(buildSearchQueryString({ query: "", filters: {}, page: 1 })).toBe("");
    const state = {
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, material: "acciaio" },
      page: 2,
    };
    const round = parseSearchState(new URLSearchParams(buildSearchQueryString(state)));
    expect(round).toEqual(state);
  });

  it("trim della query", () => {
    expect(buildSearchQueryString({ query: "  x  ", filters: {}, page: 1 })).toBe("q=x");
  });

  it("non scrive mai il parametro stock", () => {
    const qs = buildSearchQueryString({ query: "x", filters: {}, page: 1 });
    expect(qs.includes("stock")).toBe(false);
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
