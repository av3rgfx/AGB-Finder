"use client";

import { useEffect, useRef } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { LayoutGrid, List, PackageSearch, Search } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product/product-card";
import { ProductRow } from "@/components/product/product-row";
import { ProductFilters } from "@/components/product/product-filters";
import { ActiveFilterChips } from "@/components/product/active-filter-chips";
import { RecentSearches } from "@/components/product/recent-searches";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { CopyLinkButton } from "@/components/product/copy-link-button";
import { useArchivioSearch } from "@/lib/use-archivio-search";
import { clearScroll, loadScroll, shouldRestoreScroll } from "@/lib/archivio-scroll";
import { isEditableTarget } from "@/lib/is-editable-target";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export function ArchivioClient() {
  const {
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
  } = useArchivioSearch(PAGE_SIZE);

  const categories = api.product.listCategories.useQuery();
  const categoriesReady = !committed.filters.categoryId || categories.isSuccess;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const recent = api.product.recentSearches.useQuery(undefined, {
    enabled: committed.query.length === 0,
    staleTime: 0,
  });
  const pickQuery = (q: string) => {
    setQueryInput(q);
    searchInputRef.current?.focus();
  };

  const search = api.product.search.useQuery(
    { query: committed.query, filters: committed.filters, limit: PAGE_SIZE, offset },
    {
      enabled: committed.query.length > 0,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    },
  );

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;

  // p fuori range (URL condiviso / drift): 0 hit ma offset>0 → torna a pagina 1.
  useEffect(() => {
    if (search.isSuccess && hits.length === 0 && offset > 0) setPage(1);
  }, [search.isSuccess, hits.length, offset, setPage]);

  // Prendiamo il controllo esclusivo dello scroll mentre l'Archivio è montato:
  // niente ripristino nativo che compete col nostro (verdetto council).
  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  // Ripristino scroll: una volta, quando i dati in cache per la chiave corrente sono
  // presenti (non placeholder) e la vista è nota. `restored` viene impostato SOLO dopo
  // lo scrollTo effettivo (dentro il rAF), così se l'effetto ri-parte per un cambio di
  // dipendenza il ripristino viene riprogrammato invece di perdersi.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    const savedY = loadScroll(scrollKey);
    const go = shouldRestoreScroll({
      hasData: Boolean(search.data),
      isPlaceholder: search.isPlaceholderData,
      viewLoaded,
      categoriesReady,
      alreadyRestored: restored.current,
      savedY,
    });
    if (!go || savedY === null) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      restored.current = true;
      window.scrollTo(0, savedY);
      clearScroll(scrollKey);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [search.data, search.isPlaceholderData, viewLoaded, categoriesReady, scrollKey]);

  // Scorciatoia «/» per focalizzare la ricerca (se non si sta già scrivendo); Esc sfoca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isEditableTarget(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Archivio prodotti</h1>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              id="archivio-search"
              ref={searchInputRef}
              type="search"
              aria-label="Cerca nel catalogo"
              placeholder="Cerca per nome, categoria o codice AGB…"
              leadingIcon={<Search className="size-4" aria-hidden />}
              trailingSlot={
                <kbd className="pointer-events-none hidden select-none rounded border border-line-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle sm:inline-block">
                  /
                </kbd>
              }
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>
          <div
            className="flex rounded border border-line-strong bg-surface"
            role="group"
            aria-label="Vista risultati"
          >
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="Vista lista"
              onClick={() => setView("list")}
              className={cn(
                "rounded-l p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                view === "list" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken",
              )}
            >
              <List className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Vista griglia"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-r p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                view === "grid" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken",
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
        <ProductFilters filters={committed.filters} onChange={setFilters} />

        <section
          aria-label="Risultati"
          aria-busy={search.isFetching}
          className="flex min-w-0 flex-col gap-4"
        >
          {committed.query.length === 0 ? (
            <div className="flex flex-col items-center gap-6">
              <EmptyState
                title="Cerca nel catalogo AGB"
                detail="Digita un termine (es. “cerniera anta ribalta”) o un codice prodotto (es. B00590)."
              />
              <RecentlyViewed />
              <RecentSearches recent={recent.data ?? []} onPick={pickQuery} />
            </div>
          ) : search.isPending ? (
            <SkeletonList />
          ) : search.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
            >
              Errore durante la ricerca. Riprova tra qualche istante.
            </div>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nessun risultato"
              detail={`Nessun prodotto trovato per “${committed.query}”. Prova con un termine diverso o rimuovi i filtri.`}
            />
          ) : (
            <>
              <ActiveFilterChips
                filters={committed.filters}
                categoryName={(id) => categories.data?.find((c) => c.id === id)?.name}
                onRemove={(keys) => clearFilter(...keys)}
                onClearAll={clearAllFilters}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-subtle" aria-live="polite">
                  {total} {total === 1 ? "prodotto trovato" : "prodotti trovati"}
                  {search.data ? ` · ${search.data.queryTimeMs} ms` : null}
                </p>
                <CopyLinkButton />
              </div>
              {view === "grid" ? (
                <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <ProductCard product={hit} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-hidden rounded-md border border-line">
                  {hits.map((hit) => (
                    <ProductRow key={hit.id} product={hit} />
                  ))}
                </div>
              )}
              <Pagination page={committed.page} total={total} onChange={setPage} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface p-10 text-center">
      <PackageSearch className="size-8 text-ink-subtle" aria-hidden />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-subtle">{detail}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-md border border-line" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0"
        >
          <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const offset = (page - 1) * PAGE_SIZE;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-4">
      <p className="text-sm tabular-nums text-ink-subtle">
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Precedente
        </Button>
        <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => onChange(page + 1)}>
          Successiva
        </Button>
      </div>
    </nav>
  );
}
