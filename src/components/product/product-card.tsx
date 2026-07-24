import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductThumb } from "./product-thumb";

export interface ProductSummary {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  categoryName: string;
  isAvailable: boolean;
}

export function AvailabilityDot({ available }: { available: boolean }) {
  return (
    <span
      role="img"
      aria-label={available ? "Disponibile" : "Non disponibile"}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        available ? "bg-success" : "bg-line-strong",
      )}
    />
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="group flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card transition-shadow duration-150 ease-out-quart hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <ProductThumb code={product.agbCode} variant="card" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
        <AvailabilityDot available={product.isAvailable} />
      </div>
      <h3 className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-brand">
        {product.name}
      </h3>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
          {product.categoryName}
        </span>
        <span className="text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</span>
      </div>
    </Link>
  );
}
