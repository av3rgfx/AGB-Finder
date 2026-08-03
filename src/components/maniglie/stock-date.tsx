import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Data della pronta consegna: «di quando è questo dato?».
 *
 * Sta UNA VOLTA SOLA, sopra la lista, perché è una proprietà dell'IMPORT e non
 * della riga: ripeterla su venti righe identiche è rumore, non informazione.
 * Ma deve essere sempre a schermo quando si mostra una disponibilità — un
 * «in pronta consegna» senza data è un'affermazione senza scadenza.
 *
 * Se la pronta consegna non è mai stata caricata NON si scrive una data finta:
 * si dice che il dato non c'è (stessa regola di `currentStockImport`, che
 * restituisce `null` invece di inventare un import).
 */

// Formato esteso italiano: «28 luglio 2026». Fuso di Roma come nel resto
// dell'app: il server è in UTC, ma il giorno di calendario è quello italiano.
const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

export function formatStockDate(value: Date | string): string {
  return longDate.format(new Date(value));
}

export function StockDate({
  importedAt,
  className,
}: {
  importedAt: Date | string | null;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded bg-surface-sunken px-3 py-2.5 text-xs text-ink-muted sm:text-sm",
        className,
      )}
    >
      <Clock className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      {importedAt ? (
        <span>
          Pronta consegna aggiornata al{" "}
          <strong className="font-semibold text-ink">{formatStockDate(importedAt)}</strong>
        </span>
      ) : (
        <span>Nessuna pronta consegna caricata</span>
      )}
    </p>
  );
}
