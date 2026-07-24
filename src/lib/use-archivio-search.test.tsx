// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

let sp = new URLSearchParams("");
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ replace }),
  usePathname: () => "/archivio",
}));

import { useArchivioSearch } from "./use-archivio-search";

beforeEach(() => {
  sp = new URLSearchParams("");
  replace.mockReset();
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("useArchivioSearch", () => {
  it("committa la query dopo il debounce e azzera la pagina (p omesso)", () => {
    vi.useFakeTimers();
    sp = new URLSearchParams("q=old&p=3");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.setQueryInput("nuovo"));
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledTimes(1);
    const url = replace.mock.calls[0]![0] as string;
    expect(url).toContain("q=nuovo");
    expect(url).not.toContain("p=");
    expect(replace.mock.calls[0]![1]).toMatchObject({ scroll: false });
  });

  it("setFilters scrive il filtro e azzera la pagina", () => {
    sp = new URLSearchParams("q=x&p=2");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.setFilters({ categoryId: "c1" }));
    const url = replace.mock.calls[0]![0] as string;
    expect(url).toContain("cat=c1");
    expect(url).toContain("q=x");
    expect(url).not.toContain("p=");
  });

  it("clearFilter rimuove più chiavi in una sola scrittura (prezzo)", () => {
    sp = new URLSearchParams("pmin=10&pmax=50&p=2");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.clearFilter("priceMin", "priceMax"));
    const url = replace.mock.calls[0]![0] as string;
    expect(url).not.toContain("pmin");
    expect(url).not.toContain("pmax");
    expect(url).not.toContain("p=");
  });

  it("view: default list, persiste in localStorage, viewLoaded true dopo mount", () => {
    const { result } = renderHook(() => useArchivioSearch(24));
    expect(result.current.viewLoaded).toBe(true);
    expect(result.current.view).toBe("list");
    act(() => result.current.setView("grid"));
    expect(result.current.view).toBe("grid");
    expect(window.localStorage.getItem("archivio:view")).toBe("grid");
  });

  it("offset derivato dalla pagina", () => {
    sp = new URLSearchParams("q=x&p=3");
    const { result } = renderHook(() => useArchivioSearch(24));
    expect(result.current.offset).toBe(48);
    expect(result.current.committed.query).toBe("x");
  });
});
