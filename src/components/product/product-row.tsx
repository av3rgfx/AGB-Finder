import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, type ProductSummary } from "./product-card";
import { ProductThumb } from "./product-thumb";
import { ListinoButton } from "@/components/listino/listino-button";

export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <div className="group relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b border-line bg-surface px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-sunken sm:grid-cols-[40px_140px_1fr_auto_auto_auto] sm:gap-4 sm:px-4 sm:py-3">
      <ProductThumb code={product.agbCode} variant="row" />
      <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <AvailabilityDot available={product.isAvailable} />
        <span className="truncate font-mono">{product.agbCode}</span>
      </span>
      <span className="truncate text-sm font-medium text-ink">{product.name}</span>
      <span className="hidden rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted sm:inline">
        {product.categoryName}
      </span>
      <span className="text-sm font-semibold tabular-nums text-ink">
        {formatPrice(product.basePrice)}
      </span>
      {/* Colonna listino: solo desktop (evita affollamento a 375px); riservata per allineamento. */}
      <span className="z-10 hidden justify-self-end sm:inline-flex">
        {product.listinoPage != null && (
          <ListinoButton code={product.agbCode} page={product.listinoPage} />
        )}
      </span>
      <Link
        href={`/archivio/${product.id}`}
        aria-label={product.name}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
      />
    </div>
  );
}
