import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, type ProductSummary } from "./product-card";

export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line bg-surface px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:grid-cols-[140px_1fr_auto_auto_auto]"
    >
      <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
      <span className="truncate text-sm font-medium text-ink">{product.name}</span>
      <span className="hidden rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted sm:inline">
        {product.categoryName}
      </span>
      <AvailabilityDot available={product.isAvailable} />
      <span className="text-sm font-semibold tabular-nums text-ink">
        {formatPrice(product.basePrice)}
      </span>
    </Link>
  );
}
