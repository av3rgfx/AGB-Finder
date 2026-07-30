"use client";

import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";
import { entrataLabel, type Entrata } from "@/server/kit/types";
import type { CustomerOption } from "./customer-picker";

/**
 * Il profilo serramento del cliente, con un pulsante che lo applica.
 *
 * PERCHÉ UN PULSANTE E NON UNA PRECOMPILAZIONE. Sceglierli è il punto di questi
 * campi: la PR #40 ha tolto il default dell'entrata perché «un default sarebbe
 * lo stesso silenzio in un posto più visibile», e un valore che arriva da un
 * profilo resta un valore che l'agente **non ha scelto in quel momento** — con
 * in più un'etichetta che lo fa sembrare verificato. Col pulsante il riempimento
 * è un **atto esplicito**, e nulla è mai preselezionato: la regola regge alla
 * lettera su entrambi i campi. (Verdetto `/llm-council`, 2026-07-30.)
 *
 * PERCHÉ L'ETICHETTA DICE «MAI CONFRONTATO CON UN ORDINE». Perché è vero: il
 * profilo lo digita l'agente, dalla stessa memoria che è il punto di rottura.
 * Non è una colonna di stato — oggi TUTTI i profili sono in quello stato, e una
 * colonna che vale sempre lo stesso valore è la colonna che non serve. Quando
 * arriveranno le distinte reali di MC, Peruzzi e Fosca, allora sarà uno stato
 * da modellare.
 */
export function ProfiloSerramento({
  cliente,
  onApplica,
}: {
  cliente: CustomerOption | null;
  onApplica: (valori: { geometry?: ArtechGeometryId; entrata?: Entrata }) => void;
}) {
  if (cliente === null) return null;
  const { kitGeometry, kitEntrata } = cliente;
  if (kitGeometry === null && kitEntrata === null) return null;

  return (
    // Mobile-first: in colonna sotto sm, col pulsante a larghezza piena sotto i
    // valori — a 375px un pulsante affiancato a due righe di testo lungo si
    // schiaccia a due caratteri.
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-sunken p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <UserRound className="size-4 shrink-0" aria-hidden />
          Profilo di {cliente.companyName}
        </span>
        <span className="text-sm text-ink-muted">
          {[
            kitGeometry === null ? null : geometriaLabel(kitGeometry),
            kitEntrata === null ? null : `Entrata ${entrataLabel(kitEntrata)}`,
          ]
            .filter((v) => v !== null)
            .join(" · ")}
        </span>
        <span className="text-xs text-ink-subtle">
          Dichiarato in anagrafica, mai confrontato con un ordine.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="w-full shrink-0 sm:w-auto"
        onClick={() =>
          onApplica({
            ...(kitGeometry !== null && { geometry: kitGeometry }),
            ...(kitEntrata !== null && { entrata: kitEntrata }),
          })
        }
      >
        Usa il profilo
      </Button>
    </div>
  );
}
