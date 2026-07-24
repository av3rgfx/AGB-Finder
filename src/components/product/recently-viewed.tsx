"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getViewed, type ViewedProduct } from "@/lib/recently-viewed";

export function RecentlyViewed() {
  const [items, setItems] = useState<ViewedProduct[]>([]);
  useEffect(() => setItems(getViewed()), []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="viewed-heading" className="flex w-full max-w-md flex-col gap-2">
      <h3 id="viewed-heading" className="text-xs font-medium text-ink-muted">
        Visti di recente
      </h3>
      <ul className="flex flex-col overflow-hidden rounded-md border border-line">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/archivio/${p.id}`}
              className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
            >
              <span className="shrink-0 font-mono text-xs text-ink-subtle">{p.agbCode}</span>
              <span className="truncate text-sm text-ink">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
