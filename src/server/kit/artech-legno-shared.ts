// Meccanica LEGNO condivisa tra le tipologie ARTECH (anta-ribalta, a battente).
// Estratta da rules-artech-legno.ts (Fase 1h): SOLO ciò che è meccanicamente
// identico tra le tipologie legno — movimento angolare e formula incontri
// nottolino. Estrazione BEHAVIOR-PRESERVING: l'output anta-ribalta resta
// byte-identico (golden Fase 1d invariato).
import { PILOT } from "./types";

// PER_MANO è stata rimossa (2026-07-29): squadra angolare e supporto cerniera
// dipendono dalla GEOMETRIA, e sono dichiarati riga per riga, a codice intero, in
// `artech-geometrie.ts`. Tenerli qui come costanti significava cablare il pilota —
// chi ordinava aria 4 riceveva in silenzio la coppia dell'aria 12.
//
// Con loro se ne sono andate `PILOT_GEOMETRY` e `assertPilotGeometry`: non
// esiste più «una sola geometria coperta» da difendere con una guardia, ma sette
// righe di tabella. La guardia residua è `assertSeatConfigSupportata`, in
// `artech-geometrie.ts`.

/** Movimento angolare 125x125, fisso (indipendente da dimensioni/mano). */
export const MOVIMENTO_ANGOLARE = {
  position: "movimento-angolare",
  code: "A50302.01.02",
  quantity: 2,
  descr: "Movimento angolare 125x125",
} as const;

/**
 * Numero incontri nottolino perimetrali: 2 (base) + scatti passo 600 in altezza
 * + scatti passo 600 in larghezza. Formula ASSUNZIONE del piano Fase 1d
 * (riproduce il golden = 5 a 1820x550). Condivisa col battente (stessi punti di
 * chiusura perimetrali) — ASSUNZIONE, da validare con l'agente.
 *
 * NB: è la QUANTITÀ, non il codice. Il codice dell'incontro dipende dalla
 * geometria e dalla mano — vedi `incontroNottolino` in `artech-incontri.ts`.
 */
export function incontriNottolino(widthMm: number, heightMm: number): number {
  return (
    2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm)
  );
}
