"use client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";

export interface ArchivioFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

const inputClass =
  "h-9 w-full rounded border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

export function ProductFilters({
  filters,
  onChange,
}: {
  filters: ArchivioFilters;
  onChange: (filters: ArchivioFilters) => void;
}) {
  const categories = api.product.listCategories.useQuery();
  const hasActive = Object.values(filters).some((value) => value !== undefined);

  const set = (patch: Partial<ArchivioFilters>) => onChange({ ...filters, ...patch });
  const numberOrUndefined = (raw: string) => (raw === "" ? undefined : Number(raw));

  return (
    <aside aria-label="Filtri di ricerca" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        Categoria
        <select
          className={inputClass}
          value={filters.categoryId ?? ""}
          onChange={(e) => set({ categoryId: e.target.value || undefined })}
        >
          <option value="">Tutte le categorie</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1.5 text-xs font-medium text-ink-muted">Prezzo (€)</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Min"
            aria-label="Prezzo minimo"
            className={inputClass}
            value={filters.priceMin ?? ""}
            onChange={(e) => set({ priceMin: numberOrUndefined(e.target.value) })}
          />
          <span aria-hidden className="text-ink-subtle">
            –
          </span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Max"
            aria-label="Prezzo massimo"
            className={inputClass}
            value={filters.priceMax ?? ""}
            onChange={(e) => set({ priceMax: numberOrUndefined(e.target.value) })}
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        Materiale
        <input
          type="text"
          placeholder="es. acciaio"
          className={inputClass}
          value={filters.material ?? ""}
          onChange={(e) => set({ material: e.target.value || undefined })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={filters.inStockOnly ?? false}
          onChange={(e) => set({ inStockOnly: e.target.checked || undefined })}
        />
        Solo disponibili
      </label>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Azzera filtri
        </Button>
      )}
    </aside>
  );
}
