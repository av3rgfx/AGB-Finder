"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { pushViewed } from "@/lib/recently-viewed";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, ProductCard } from "./product-card";
import { CopyCodeButton } from "./copy-code-button";
import { ProductImage } from "./product-image";
import { ListinoButton } from "@/components/listino/listino-button";
import { SpecTable } from "./spec-table";

export function ProductDetail({ id }: { id: string }) {
  const product = api.product.getById.useQuery({ id });
  const related = api.product.getRelated.useQuery(
    { productId: id, limit: 4 },
    { enabled: product.isSuccess },
  );

  // Registra la visita per «Prodotti visti di recente» (localStorage, per-dispositivo).
  useEffect(() => {
    if (product.isSuccess) {
      pushViewed({
        id: product.data.id,
        agbCode: product.data.agbCode,
        name: product.data.name,
      });
    }
  }, [product.isSuccess, product.data?.id, product.data?.agbCode, product.data?.name]);

  if (product.isPending) {
    return (
      <div
        className="mx-auto h-64 max-w-4xl animate-pulse rounded-md border border-line bg-surface-sunken"
        aria-hidden
      />
    );
  }
  if (product.isError) {
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-4xl flex-col items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-6"
      >
        <p className="text-sm text-danger">Prodotto non trovato o errore di caricamento.</p>
        <Link href="/archivio" className="text-sm font-medium text-brand hover:underline">
          ← Torna all&apos;archivio
        </Link>
      </div>
    );
  }

  const p = product.data;
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/archivio"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> Archivio
      </Link>

      <header className="flex flex-col gap-4 rounded-md border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-start">
        <ProductImage
          code={p.agbCode}
          className="mx-auto w-40 max-w-full shrink-0 rounded border border-line bg-white object-contain sm:mx-0 sm:w-48"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <CopyCodeButton code={p.agbCode} />
              <ListinoButton code={p.agbCode} page={p.listinoPage} />
            </span>
            <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
              {p.category.name}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
              <AvailabilityDot available={p.isAvailable} />
              {p.isAvailable ? "Disponibile" : "Non disponibile"}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-ink">{p.name}</h1>
          {p.shortDescription && <p className="text-sm text-ink-subtle">{p.shortDescription}</p>}
          <p className="text-2xl font-semibold tabular-nums text-ink">{formatPrice(p.basePrice)}</p>
        </div>
      </header>

      <section aria-labelledby="spec-heading" className="flex flex-col gap-3">
        <h2 id="spec-heading" className="text-sm font-semibold text-ink">
          Specifiche
        </h2>
        <SpecTable specifications={p.specifications} />
      </section>

      {related.data && related.data.length > 0 && (
        <section aria-labelledby="related-heading" className="flex flex-col gap-3">
          <h2 id="related-heading" className="text-sm font-semibold text-ink">
            Prodotti correlati
          </h2>
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.data.map((r) => (
              <li key={r.id}>
                <ProductCard product={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
