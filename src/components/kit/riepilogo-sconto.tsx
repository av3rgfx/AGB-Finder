"use client";

import { useId, useState } from "react";
import { AlertTriangle, Pencil, Percent } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPercent, formatPrice } from "@/lib/format";
import { superaSoglia } from "@/server/pricing/discount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Riepilogo commerciale sotto la distinta: quanto sconto, e quanto paga il
 * cliente.
 *
 * NON ripete il lordo. Il piè della tabella lo mostra già («Totale listino
 * AGB»), e la stessa cifra due volte di fila a due centimetri di distanza è
 * rumore che fa dubitare di aver letto male. Qui compare solo ciò che la
 * tabella non sa: lo sconto e il netto.
 *
 * Le righe della distinta restano al lordo (scelta dell'utente): questo è
 * l'unico posto in cui lo sconto lavora. Il netto arriva già calcolato dal
 * server — non lo si ricalcola qui, altrimenti due aritmetiche finirebbero per
 * mostrare due numeri diversi.
 */
export function RiepilogoSconto({
  requestId,
  discountPercent,
  netto,
  scontoImporto,
  soglia,
  readOnly = false,
}: {
  requestId: string;
  discountPercent: number | null;
  netto: number;
  scontoImporto: number | null;
  soglia: number;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [valore, setValore] = useState(discountPercent === null ? "" : String(discountPercent));
  const campoId = useId();
  const utils = api.useUtils();

  const setDiscount = api.kit.setDiscount.useMutation({
    onSuccess: () => {
      void utils.kit.get.invalidate({ id: requestId });
      void utils.kit.list.invalidate();
      setEditing(false);
    },
  });

  const haSconto = discountPercent !== null && scontoImporto !== null;
  const fuoriSoglia = superaSoglia(discountPercent, soglia);

  // Il campo vuoto vale «nessuno sconto», che è diverso da «testo non valido»:
  // la prima si salva, la seconda no. La guardia sta anche qui e non solo sul
  // server perché un pulsante che parte e torna con un errore è peggio di un
  // pulsante spento.
  const grezzo = valore.trim().replace(",", ".");
  const parsed = grezzo === "" ? null : Number(grezzo);
  const valido = parsed === null || (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100);

  async function handleSalva() {
    if (!valido) return;
    await setDiscount.mutateAsync({ id: requestId, discountPercent: parsed });
  }

  return (
    <section
      aria-label="Prezzo per il cliente"
      className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card"
    >
      {haSconto && (
        // Mobile-first: lista verticale, non una tabella. A 375px due colonne
        // con gli importi a destra si stringono fino a spezzare le cifre.
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-subtle">Sconto cliente {formatPercent(discountPercent)}</span>
            <span className="text-ink">−{formatPrice(scontoImporto)}</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line-strong pt-2">
            <span className="text-sm font-semibold text-ink">Totale cliente</span>
            {/* È il numero per cui esiste questa schermata: pesa più degli altri
                invece di essere una terza riga identica. */}
            <span className="text-2xl font-semibold tabular-nums text-ink">
              {formatPrice(netto)}
            </span>
          </div>
        </div>
      )}

      {fuoriSoglia && (
        <p
          role="status"
          className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            Sconto oltre la soglia aziendale del {formatPercent(soglia)}. Puoi salvarlo comunque: è
            solo un avviso.
          </span>
        </p>
      )}

      {!readOnly &&
        (editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={campoId} className="text-sm text-ink-muted">
              Sconto <span className="text-ink-subtle">(vuoto = nessuno sconto)</span>
            </label>
            <Input
              id={campoId}
              inputMode="decimal"
              autoFocus
              value={valore}
              onChange={(event) => setValore(event.target.value)}
              invalid={!valido}
              placeholder="es. 40"
              trailingSlot={<Percent className="size-4 text-ink-subtle" aria-hidden />}
            />
            {!valido && (
              <p className="text-sm text-danger">
                Scrivi una percentuale fra 0 e 100, oppure lascia vuoto.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!valido}
                loading={setDiscount.isPending}
                onClick={() => void handleSalva()}
              >
                Salva
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setValore(discountPercent === null ? "" : String(discountPercent));
                  setEditing(false);
                }}
              >
                Annulla
              </Button>
            </div>
            {setDiscount.isError && (
              <p role="alert" className="text-sm text-danger">
                {setDiscount.error?.message}
              </p>
            )}
          </div>
        ) : (
          <div className={haSconto ? "" : "flex flex-col gap-2"}>
            {!haSconto && (
              <p className="text-sm text-ink-subtle">La distinta è al lordo di listino AGB.</p>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" aria-hidden />
              {haSconto ? "Modifica sconto" : "Applica uno sconto"}
            </Button>
          </div>
        ))}
    </section>
  );
}
