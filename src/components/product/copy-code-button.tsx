"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile: nessun feedback, il codice resta selezionabile
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Codice copiato" : `Copia codice ${code}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-sm transition-colors duration-150",
        copied
          ? "border-success/40 bg-success/10 text-success"
          : "border-line-strong text-ink hover:bg-surface-sunken",
      )}
    >
      {code}
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </button>
  );
}
