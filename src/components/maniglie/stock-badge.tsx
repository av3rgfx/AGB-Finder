import { cn } from "@/lib/utils";

/**
 * Stato di magazzino di un articolo: i DUE soli stati che l'agente deve leggere.
 *
 * «Da ordinare» NON è rosso: è il caso normale (3.278 articoli su 3.456). Un
 * allarme su tre righe su quattro smette di essere un allarme in due giorni, e
 * con lui smettono di contare i colori. Il verde è quindi l'eccezione (la buona
 * notizia), il neutro la regola.
 *
 * Il pallino non è decorazione: chi non distingue il verde deve poter separare
 * le due righe a colpo d'occhio (pieno / vuoto). E in ogni caso lo stato è
 * SEMPRE scritto a parole — il colore da solo non è mai l'informazione.
 */
export function StockBadge({ inStock, className }: { inStock: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium",
        inStock ? "bg-[#EAF4EC] text-[#215C2C]" : "bg-surface-sunken text-ink-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          inStock ? "bg-success" : "border border-ink-subtle",
        )}
      />
      {inStock ? "In pronta consegna" : "Da ordinare"}
    </span>
  );
}
