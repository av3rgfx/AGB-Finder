"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { LayoutGrid, List, PackageSearch, Search } from "lucide-react";
import { api } from "@/trpc/react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product/product-card";
import { ProductRow } from "@/components/product/product-row";
import { ProductFilters, type ArchivioFilters } from "@/components/product/product-filters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export function ArchivioClient() {
  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<ArchivioFilters>({});
  // Vista lista di default: densità prima di tutto (PRODUCT.md — "information density").
  const [view, setView] = useState<"list" | "grid">("list");
  const [offset, setOffset] = useState(0);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const setFilters = (next: ArchivioFilters) => {
    setFiltersState(next);
    setOffset(0);
  };

  const search = api.product.search.useQuery(
    { query: debouncedQuery, filters, limit: PAGE_SIZE, offset },
    { enabled: debouncedQuery.length > 0, placeholderData: keepPreviousData },
  );

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Archivio prodotti</h1>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="search"
              aria-label="Cerca nel catalogo"
              placeholder="Cerca per nome, categoria o codice AGB…"
              leadingIcon={<Search className="size-4" aria-hidden />}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
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
        <ProductFilters filters={filters} onChange={setFilters} />

        <section
          aria-label="Risultati"
          aria-busy={search.isFetching}
          className="flex min-w-0 flex-col gap-4"
        >
          {debouncedQuery.length === 0 ? (
            <EmptyState
              title="Cerca nel catalogo AGB"
              detail="Digita un termine (es. “cerniera anta ribalta”) o un codice prodotto (es. B00590)."
            />
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
              detail={`Nessun prodotto trovato per “${debouncedQuery}”. Prova con un termine diverso o rimuovi i filtri.`}
            />
          ) : (
            <>
              <p className="text-sm text-ink-subtle" aria-live="polite">
                {total} {total === 1 ? "prodotto trovato" : "prodotti trovati"}
                {search.data ? ` · ${search.data.queryTimeMs} ms` : null}
              </p>
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
              <Pagination offset={offset} total={total} onChange={setOffset} />
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
        <div key={i} className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0">
          <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

function Pagination({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-4">
      <p className="text-sm tabular-nums text-ink-subtle">
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
        >
          Precedente
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={to >= total}
          onClick={() => onChange(offset + PAGE_SIZE)}
        >
          Successiva
        </Button>
      </div>
    </nav>
  );
}
