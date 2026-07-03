import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { CopyCodeButton } from "@/components/product/copy-code-button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChatProductSummary {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  isAvailable: boolean;
  stockQuantity: number;
}

/** Pannello destro (40%): schede dei prodotti citati dall'assistente. */
export function ProductPanel({ products }: { products: ChatProductSummary[] }) {
  if (products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <PackageSearch className="size-8 text-ink-subtle" aria-hidden />
        <p className="text-sm text-ink-muted">
          Nessun prodotto citato.
          <br />
          Le schede dei prodotti consigliati dall&apos;assistente appariranno qui.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      {products.map((product) => (
        <li key={product.id} className="rounded-md border border-line bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <CopyCodeButton code={product.agbCode} />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                product.isAvailable ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
              )}
            >
              {product.isAvailable ? "Disponibile" : "Non disponibile"}
            </span>
          </div>
          <Link
            href={`/archivio/${product.id}`}
            className="mt-2 block font-medium text-ink transition-colors duration-150 ease-out-quart hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            {product.name}
          </Link>
          {product.shortDescription && (
            <p className="mt-0.5 text-xs text-ink-subtle">{product.shortDescription}</p>
          )}
          <p className="mt-2 text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</p>
        </li>
      ))}
    </ul>
  );
}
