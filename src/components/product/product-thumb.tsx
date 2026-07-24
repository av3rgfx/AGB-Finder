"use client";

import { Package } from "lucide-react";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";

/** Thumbnail a dimensioni FISSE (riserva il box → niente layout-shift → protegge lo scroll restore). */
export function ProductThumb({ code, variant }: { code: string; variant: "row" | "card" }) {
  const box = variant === "row" ? "size-10 shrink-0" : "h-28 w-full";
  return (
    <ProductImage
      code={code}
      alt=""
      className={cn("rounded border border-line bg-white object-contain", box)}
      fallback={
        <span
          className={cn(
            "grid place-items-center rounded border border-line bg-surface-sunken",
            box,
          )}
        >
          <Package className="size-4 text-ink-subtle" aria-hidden />
        </span>
      }
    />
  );
}
