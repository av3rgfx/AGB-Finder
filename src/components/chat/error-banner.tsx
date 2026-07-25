"use client";

import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stesso shape di `StreamState["error"]` in `use-chat-stream.ts` (duplicato di proposito:
 * questo componente non deve importare dall'hook, vedi `chat-events.ts` per lo stesso pattern). */
export interface ChatStreamError {
  recoverable: boolean;
  retryAfter?: number;
  message: string;
}

export interface ErrorBannerProps {
  error: ChatStreamError;
  onRetry: () => void;
}

/**
 * Banner d'errore per lo streaming chat. Recuperabile (rate limit, errore transitorio):
 * toni warning + countdown "Riprovo tra Ns…" a partire da `retryAfter` (puramente
 * informativo — il retry resta manuale, il countdown non richiama `onRetry` da solo).
 * Non recuperabile: toni danger, nessun countdown.
 *
 * Il bottone dice sempre «Riprova», mai «Rigenera»: qui si ritenta il turno FALLITO (ri-invio del
 * messaggio o nuova generazione), non si sostituisce mai una risposta già esistente — quella è
 * l'azione «Rigenera» di `MessageTurn`, che è legata all'id di una risposta precisa.
 */
export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const [remaining, setRemaining] = useState(error.retryAfter ?? 0);

  useEffect(() => {
    setRemaining(error.retryAfter ?? 0);
    if (!error.recoverable || !error.retryAfter) return;

    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [error]);

  const Icon = error.recoverable ? AlertTriangle : AlertCircle;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        error.recoverable ? "border-warning/30 bg-warning/5" : "border-danger/30 bg-danger/5",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn("mt-0.5 size-4 shrink-0", error.recoverable ? "text-warning" : "text-danger")}
          aria-hidden
        />
        <div>
          <p className="text-ink">{error.message}</p>
          {error.recoverable && error.retryAfter ? (
            <p className="mt-0.5 text-xs text-ink-subtle">
              {remaining > 0 ? `Riprovo tra ${remaining}s…` : "Pronto per un nuovo tentativo."}
            </p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded border border-line-strong px-3 text-xs font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:self-auto"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Riprova
      </button>
    </div>
  );
}
