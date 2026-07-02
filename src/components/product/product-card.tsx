import Link from "next/link";
import { Package } from "lucide-react";
import { ProductCode } from "./product-code";
import { Price } from "./price";

export interface ProductSummary {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  discountedPrice: number | null;
  isAvailable: boolean;
  stockQuantity: number;
  categoryName: string;
  imageUrls: string[];
}

/** Grid card for the Archivio. Dense, code-first — agents scan by code. */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="group flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <ProductCode code={product.agbCode} />
        <span className="shrink-0 rounded bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-subtle">
          {product.categoryName}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded bg-surface-sunken text-ink-subtle">
          <Package className="size-5" aria-hidden />
        </span>
        <p className="line-clamp-3 text-sm leading-snug text-ink group-hover:underline">
          {product.name}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <Price base={product.basePrice} discounted={product.discountedPrice} />
        {product.isAvailable ? (
          <span className="text-xs font-medium text-success">Disponibile</span>
        ) : (
          <span className="text-xs font-medium text-danger">Non disponibile</span>
        )}
      </div>
    </Link>
  );
}
