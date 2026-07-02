"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, LayoutGrid, List, PackageSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { ProductCard, type ProductSummary } from "./product-card";
import { ProductRow } from "./product-row";

const PAGE_SIZE = 24;

function SkeletonGrid() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-md border border-line bg-surface-sunken" />
      ))}
    </div>
  );
}

export function ArchivioClient() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset pagination when the query or filter changes.
  useEffect(() => setOffset(0), [debounced, categoryId]);

  const searching = debounced.length > 0;

  const categories = api.product.listCategories.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const searchQ = api.product.search.useQuery(
    { query: debounced, filters: categoryId ? { categoryId } : undefined, limit: PAGE_SIZE, offset },
    { enabled: searching, placeholderData: (prev) => prev },
  );
  const listQ = api.product.list.useQuery(
    { categoryId, limit: PAGE_SIZE, offset },
    { enabled: !searching, placeholderData: (prev) => prev },
  );

  const active = searching ? searchQ : listQ;

  const products: ProductSummary[] = useMemo(() => {
    if (searching) {
      return (searchQ.data?.hits ?? []).map((h) => ({
        id: h.id,
        agbCode: h.agbCode,
        name: h.name,
        basePrice: h.basePrice,
        discountedPrice: h.discountedPrice,
        isAvailable: h.isAvailable,
        stockQuantity: h.stockQuantity,
        categoryName: h.categoryName,
        imageUrls: h.imageUrls,
      }));
    }
    return (listQ.data?.items ?? []).map((p) => ({
      id: p.id,
      agbCode: p.agbCode,
      name: p.name,
      basePrice: p.basePrice,
      discountedPrice: p.discountedPrice,
      isAvailable: p.isAvailable,
      stockQuantity: p.stockQuantity,
      categoryName: p.category.name,
      imageUrls: p.imageUrls,
    }));
  }, [searching, searchQ.data, listQ.data]);

  const total = searching ? null : (listQ.data?.total ?? 0);
  const hasNext = searching ? products.length === PAGE_SIZE : offset + PAGE_SIZE < (total ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: search + category + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cerca nel catalogo"
            placeholder="Cerca per nome, codice AGB, finitura, materiale…"
            className="h-11 w-full rounded border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
          />
        </div>

        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || undefined)}
          aria-label="Filtra per categoria"
          className="h-11 rounded border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
        >
          <option value="">Tutte le categorie</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c._count.products})
            </option>
          ))}
        </select>

        <div className="flex rounded border border-line-strong bg-surface p-0.5" role="group" aria-label="Vista">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label="Vista griglia"
            aria-pressed={view === "grid"}
            className={cn(
              "grid size-9 place-items-center rounded transition-colors duration-150",
              view === "grid" ? "bg-brand-light text-brand" : "text-ink-subtle hover:text-ink",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="Vista elenco"
            aria-pressed={view === "list"}
            className={cn(
              "grid size-9 place-items-center rounded transition-colors duration-150",
              view === "list" ? "bg-brand-light text-brand" : "text-ink-subtle hover:text-ink",
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Result meta */}
      <div className="flex items-center justify-between text-sm text-ink-subtle">
        {searching ? (
          <span>
            Risultati per <strong className="text-ink">«{debounced}»</strong>
            {searchQ.data && ` — ${searchQ.data.queryTimeMs} ms`}
          </span>
        ) : (
          <span>{total !== null && `${total} prodotti a catalogo`}</span>
        )}
      </div>

      {/* Results */}
      {active.isPending ? (
        <SkeletonGrid />
      ) : active.isError ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-6 text-center text-sm text-danger">
          Errore durante il caricamento. Riprova.
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-line bg-surface px-6 py-16 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-subtle">
            <PackageSearch className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">
            {searching ? `Nessun prodotto trovato per «${debounced}»` : "Nessun prodotto a catalogo"}
          </p>
          <p className="max-w-sm text-sm text-ink-subtle">
            {searching
              ? "Prova con un termine diverso: nome, codice AGB, finitura o materiale."
              : "Importa il listino AGB per popolare l'archivio."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-line bg-surface shadow-card">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(offset > 0 || hasNext) && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="inline-flex h-9 items-center gap-1 rounded border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronLeft className="size-4" aria-hidden /> Precedente
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="inline-flex h-9 items-center gap-1 rounded border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-50"
          >
            Successiva <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
