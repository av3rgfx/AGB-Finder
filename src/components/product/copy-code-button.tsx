"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `copyAs` esiste perché i due reparti scrivono i codici in modo diverso e uno
 * solo dei due va normalizzato: le maniglie si ORDINANO `0ID41RCR` e si LEGGONO
 * `0ID41R-CR`, mentre i serramenti si ordinano `A50122.08.07`, punti compresi.
 *
 * Il default è «copia ciò che mostri»: nessuna chiamata esistente cambia
 * comportamento, e chi aggiunge una schermata non deve ricordarsi di nulla.
 * Il valore per le maniglie non si ricalcola qui — è `articles.code_norm`, cioè
 * la stessa chiave con cui si aggancia la pronta consegna.
 */
export function CopyCodeButton({ code, copyAs }: { code: string; copyAs?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyAs ?? code);
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
