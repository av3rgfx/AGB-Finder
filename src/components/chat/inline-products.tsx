"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, PackageSearch } from "lucide-react";
import { CopyCodeButton } from "@/components/product/copy-code-button";
import { ProductThumb } from "@/components/product/product-thumb";
import { ListinoButton } from "@/components/listino/listino-button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatProductSummary } from "@/lib/chat/chat-events";

export interface InlineProductsProps {
  products: ChatProductSummary[];
}

/**
 * Prodotti citati dall'assistente, renderizzati SOTTO la sua risposta (nessun pannello
 * laterale né bottom sheet — decisione di design definitiva, vedi spec streaming).
 * Chip «N prodotti» pieghevole: parte chiusa, click espande l'elenco delle card.
 * Non renderizza nulla se `products` è vuoto (nessun messaggio ha citato prodotti).
 */
export function InlineProducts({ products }: InlineProductsProps) {
  const [expanded, setExpanded] = useState(false);
  if (products.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <PackageSearch className="size-3.5 text-ink-subtle" aria-hidden />
        {products.length} {products.length === 1 ? "prodotto" : "prodotti"}
        <ChevronDown
          className={cn(
            "size-3.5 text-ink-subtle transition-transform duration-150 ease-out-quart",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <ul className="mt-2 flex flex-col gap-2">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 shadow-card"
            >
              <ProductThumb code={product.agbCode} variant="row" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CopyCodeButton code={product.agbCode} />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      product.isAvailable ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                    )}
                  >
                    {product.isAvailable ? "Disponibile" : "Non disponibile"}
                  </span>
                </div>
                <Link
                  href={`/archivio/${product.id}`}
                  className="mt-1 block truncate text-sm font-medium text-ink transition-colors duration-150 ease-out-quart hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {product.name}
                </Link>
                <p className="mt-0.5 text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</p>
              </div>
              {product.listinoPage != null && (
                <ListinoButton code={product.agbCode} page={product.listinoPage} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
