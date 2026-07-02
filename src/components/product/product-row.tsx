import Link from "next/link";
import { ProductCode } from "./product-code";
import { Price } from "./price";
import type { ProductSummary } from "./product-card";

/** Compact list row for the Archivio list view — max information density. */
export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="grid grid-cols-[130px_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-page sm:grid-cols-[150px_1fr_130px_110px]"
    >
      <ProductCode code={product.agbCode} />
      <span className="truncate text-sm text-ink">{product.name}</span>
      <span className="hidden truncate text-xs text-ink-subtle sm:block">
        {product.categoryName}
      </span>
      <span className="justify-self-end">
        <Price base={product.basePrice} discounted={product.discountedPrice} className="text-sm" />
      </span>
    </Link>
  );
}
