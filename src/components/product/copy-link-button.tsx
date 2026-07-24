"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile (contesto non sicuro): no-op
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Link copiato" : "Copia link della ricerca"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors duration-150",
        copied
          ? "border-success/40 bg-success/10 text-success"
          : "border-line-strong text-ink-subtle hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}
