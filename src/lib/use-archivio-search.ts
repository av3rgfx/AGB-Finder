"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  type ArchivioFilters,
  type ArchivioSearchState,
  buildSearchQueryString,
  parseSearchState,
  searchScrollKey,
} from "@/lib/archivio-search-params";
import { saveScroll } from "@/lib/archivio-scroll";

const VIEW_KEY = "archivio:view";
type View = "list" | "grid";

export function useArchivioSearch(pageSize: number) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const committed = useMemo<ArchivioSearchState>(
    () => parseSearchState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const offset = (committed.page - 1) * pageSize;
  const scrollKey = useMemo(() => searchScrollKey(committed), [committed]);

  const write = useCallback(
    (next: ArchivioSearchState) => {
      const qs = buildSearchQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // Query: mirror locale (seed dall'URL una volta) + debounce → commit atomico (reset pagina).
  const [queryInput, setQueryInput] = useState(committed.query);
  const debounced = useDebouncedValue(queryInput.trim(), 300);
  useEffect(() => {
    if (debounced === committed.query) return;
    write({ query: debounced, filters: committed.filters, page: 1 });
    // Solo su `debounced`: le altre modifiche URL non devono ri-scrivere la query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const setFilters = useCallback(
    (filters: ArchivioFilters) => write({ query: committed.query, filters, page: 1 }),
    [write, committed.query],
  );
  const clearFilter = useCallback(
    (...keys: (keyof ArchivioFilters)[]) => {
      const filters = { ...committed.filters };
      for (const k of keys) delete filters[k];
      write({ query: committed.query, filters, page: 1 });
    },
    [write, committed.query, committed.filters],
  );
  const clearAllFilters = useCallback(
    () => write({ query: committed.query, filters: {}, page: 1 }),
    [write, committed.query],
  );
  const setPage = useCallback(
    (page: number) => write({ query: committed.query, filters: committed.filters, page }),
    [write, committed.query, committed.filters],
  );

  // Vista: default SSR deterministico, idratata da localStorage post-mount (no flash/mismatch).
  const [view, setViewState] = useState<View>("list");
  const [viewLoaded, setViewLoaded] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "list") setViewState(v);
    } catch {
      /* no-op */
    }
    setViewLoaded(true);
  }, []);
  const setView = useCallback((v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* no-op */
    }
  }, []);

  // Salvataggio scroll: throttled + pagehide + cleanup all'unmount (Back verso il dettaglio).
  const scrollKeyRef = useRef(scrollKey);
  scrollKeyRef.current = scrollKey;
  useEffect(() => {
    const save = () => saveScroll(scrollKeyRef.current, window.scrollY);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        save();
        timer = null;
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (timer) clearTimeout(timer);
      save();
    };
  }, []);

  return {
    queryInput,
    setQueryInput,
    committed,
    offset,
    setFilters,
    clearFilter,
    clearAllFilters,
    setPage,
    view,
    setView,
    viewLoaded,
    scrollKey,
  };
}
