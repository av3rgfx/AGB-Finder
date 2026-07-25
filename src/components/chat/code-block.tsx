"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Blocco di codice scrollabile con pulsante "Copia" (pattern di CopyCodeButton). */
export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile: nessun feedback, il codice resta selezionabile
    }
  };

  return (
    <div className="relative my-2 overflow-x-auto rounded-md border border-line bg-surface-sunken">
      <button
        type="button"
        onClick={copy}
        aria-label="Copia codice"
        className={cn(
          "absolute right-2 top-2 inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors duration-150",
          copied
            ? "border-success/40 bg-success/10 text-success"
            : "border-line-strong bg-surface text-ink-muted hover:bg-surface-sunken",
        )}
      >
        {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        {copied ? "Copiato" : "Copia"}
      </button>
      <pre className="overflow-x-auto p-3 pt-9 text-xs">
        <code className="font-mono">{children}</code>
      </pre>
    </div>
  );
}
