"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { ProductCode } from "./product-code";
import { Price } from "./price";

/** Same-category related products (vector-ranked when embeddings exist). */
export function RelatedProducts({ productId }: { productId: string }) {
  const { data: related } = api.product.getRelated.useQuery({ productId, limit: 4 });

  if (!related || related.length === 0) return null;

  return (
    <section aria-label="Prodotti correlati">
      <h2 className="mb-2 text-base font-semibold text-ink">Prodotti correlati</h2>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {related.map((p) => (
          <Link
            key={p.id}
            href={`/archivio/${p.id}`}
            className="flex flex-col gap-1.5 rounded-md border border-line bg-surface p-3 shadow-card transition-colors duration-150 hover:border-line-strong"
          >
            <ProductCode code={p.agbCode} />
            <span className="line-clamp-2 text-sm text-ink">{p.name}</span>
            <Price base={p.basePrice} className="text-sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
