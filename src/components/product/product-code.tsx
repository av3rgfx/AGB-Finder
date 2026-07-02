"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AGB product code: always monospace (project rule), with copy-to-clipboard.
 * Trust through accuracy — the code is the primary artifact agents exchange.
 */
export function ProductCode({
  code,
  className,
  withCopy = false,
}: {
  code: string;
  className?: string;
  withCopy?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono text-[13px] font-medium tabular-nums text-brand">{code}</span>
      {withCopy && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void copy();
          }}
          aria-label={copied ? "Codice copiato" : "Copia codice"}
          className="grid size-6 place-items-center rounded text-ink-subtle transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </span>
  );
}
