"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { ArchivioFilters } from "@/lib/archivio-search-params";

interface ChipDef {
  keys: (keyof ArchivioFilters)[];
  label: string;
  aria: string;
}

export function ActiveFilterChips({
  filters,
  categoryName,
  onRemove,
  onClearAll,
}: {
  filters: ArchivioFilters;
  categoryName: (id: string) => string | undefined;
  onRemove: (keys: (keyof ArchivioFilters)[]) => void;
  onClearAll: () => void;
}) {
  const chips: ChipDef[] = [];
  if (filters.categoryId) {
    const name = categoryName(filters.categoryId) ?? "…";
    chips.push({ keys: ["categoryId"], label: `Categoria: ${name}`, aria: `Categoria ${name}` });
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const min = filters.priceMin !== undefined ? formatPrice(filters.priceMin) : "…";
    const max = filters.priceMax !== undefined ? formatPrice(filters.priceMax) : "…";
    chips.push({
      keys: ["priceMin", "priceMax"],
      label: `Prezzo: ${min}–${max}`,
      aria: `Prezzo ${min}-${max}`,
    });
  }
  if (filters.material) {
    chips.push({
      keys: ["material"],
      label: `Materiale: ${filters.material}`,
      aria: `Materiale ${filters.material}`,
    });
  }
  if (filters.inStockOnly) {
    chips.push({ keys: ["inStockOnly"], label: "Solo disponibili", aria: "Solo disponibili" });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.keys.join(",")}
          className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-xs text-ink-muted"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.keys)}
            aria-label={`Rimuovi filtro ${chip.aria}`}
            className="grid size-4 place-items-center rounded text-ink-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Azzera tutto
      </Button>
    </div>
  );
}
