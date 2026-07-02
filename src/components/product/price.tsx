import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/** EUR price, it-IT format. Shows the discounted price when present. */
export function Price({
  base,
  discounted,
  className,
}: {
  base: number;
  discounted?: number | null;
  className?: string;
}) {
  if (discounted != null && discounted < base) {
    return (
      <span className={cn("inline-flex items-baseline gap-1.5", className)}>
        <span className="font-semibold tabular-nums text-ink">{formatter.format(discounted)}</span>
        <s className="text-sm tabular-nums text-ink-subtle">{formatter.format(base)}</s>
      </span>
    );
  }
  return (
    <span className={cn("font-semibold tabular-nums text-ink", className)}>
      {formatter.format(base)}
    </span>
  );
}
