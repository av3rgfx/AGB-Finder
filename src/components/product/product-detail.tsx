"use client";

import Link from "next/link";
import { ChevronLeft, PackageSearch } from "lucide-react";
import { api } from "@/trpc/react";
import { ProductCode } from "./product-code";
import { Price } from "./price";
import { RelatedProducts } from "./related-products";

const SPEC_LABELS: Record<string, string> = {
  finitura: "Finitura",
  materiale: "Materiale",
  dimensione: "Dimensione",
  mano: "Mano",
  confezione: "Confezione",
  classeSconto: "Classe sconto",
  sottocategoria: "Sottocategoria",
  gruppo: "Gruppo",
};

function formatSpecValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (key === "confezione" && typeof value === "object") {
    const v = value as { scatola?: number | null; cartone?: number | null };
    if (!v.scatola && !v.cartone) return null;
    return `${v.scatola ?? "—"} pz / cartone ${v.cartone ?? "—"}`;
  }
  if (typeof value === "object") return null;
  return String(value);
}

/** Specification table from the product's JSON attributes (Italian labels). */
export function SpecTable({ specifications }: { specifications: unknown }) {
  if (!specifications || typeof specifications !== "object") return null;
  const entries = Object.entries(SPEC_LABELS)
    .map(([key, label]) => {
      const value = formatSpecValue(key, (specifications as Record<string, unknown>)[key]);
      return value === null ? null : ([label, value] as const);
    })
    .filter((e): e is readonly [string, string] => e !== null);

  if (entries.length === 0) return null;

  return (
    <dl className="divide-y divide-line rounded-md border border-line bg-surface shadow-card">
      {entries.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-sm">
          <dt className="font-medium text-ink-subtle">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductDetail({ productId }: { productId: string }) {
  const { data: product, isPending, isError } = api.product.getById.useQuery({ id: productId });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-2/3 animate-pulse rounded bg-surface-sunken" />
        <div className="h-48 animate-pulse rounded-md border border-line bg-surface-sunken" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-subtle">
          <PackageSearch className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-medium text-ink">Prodotto non trovato.</p>
        <Link href="/archivio" className="text-sm font-medium text-brand hover:underline">
          Torna all&apos;archivio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-subtle">
        <Link href="/archivio" className="inline-flex items-center gap-1 hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> Archivio
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">{product.category.name}</span>
      </nav>

      <header className="flex flex-col gap-2">
        <ProductCode code={product.agbCode} withCopy />
        <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight text-ink">
          {product.name}
        </h1>
        <div className="flex items-center gap-4">
          <Price base={product.basePrice} discounted={product.discountedPrice} className="text-xl" />
          {product.isAvailable ? (
            <span className="rounded bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
              Disponibile
            </span>
          ) : (
            <span className="rounded bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
              Non disponibile
            </span>
          )}
        </div>
      </header>

      <section aria-label="Specifiche" className="max-w-2xl">
        <h2 className="mb-2 text-base font-semibold text-ink">Specifiche</h2>
        <SpecTable specifications={product.specifications} />
      </section>

      <RelatedProducts productId={product.id} />
    </div>
  );
}
