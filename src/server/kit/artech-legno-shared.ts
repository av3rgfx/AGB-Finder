// Meccanica LEGNO condivisa tra le tipologie ARTECH (anta-ribalta, a battente).
// Estratta da rules-artech-legno.ts (Fase 1h): SOLO ciò che è meccanicamente
// identico tra le tipologie legno — cerniere per mano, movimento angolare,
// formula incontri nottolino. Estrazione BEHAVIOR-PRESERVING: l'output
// anta-ribalta resta byte-identico (golden Fase 1d invariato).
import { PILOT, type KitInput } from "./types";

type Side = KitInput["openingSide"];

/**
 * Componenti cerniera dipendenti da mano, interasse 13/battuta 20 (I13 B20 =
 * golden anta-ribalta, unica combinazione validata). Suffissi: .01 = DX, .02 = SX.
 * Condivisi col battente (stessa cerniera legno, indipendente dal meccanismo di
 * ribalta) — ASSUNZIONE per il battente, da validare con l'agente.
 * supportoCerniera è a sua volta un'ASSUNZIONE (vedi rules-artech-legno.ts:
 * nessuna variante aria 12/interasse 13/battuta 20 a listino 2026).
 */
export const PER_MANO: Record<Side, { squadraAngolare: string; supportoCerniera: string }> = {
  SINISTRA: { squadraAngolare: "A50904.36.02", supportoCerniera: "A50801.01.02" },
  DESTRA: { squadraAngolare: "A50904.36.01", supportoCerniera: "A50801.01.01" },
};

/** Movimento angolare 125x125, fisso (indipendente da dimensioni/mano). */
export const MOVIMENTO_ANGOLARE = {
  position: "movimento-angolare",
  code: "A50302.01.02",
  quantity: 2,
  descr: "Movimento angolare 125x125",
} as const;

/**
 * Numero incontri nottolino perimetrali (A51400.05.02): 2 (base) + scatti passo
 * 600 in altezza + scatti passo 600 in larghezza. Formula ASSUNZIONE del piano
 * Fase 1d (riproduce il golden = 5 a 1820x550). Condivisa col battente (stessi
 * punti di chiusura perimetrali) — ASSUNZIONE, da validare con l'agente.
 */
export function incontriNottolino(widthMm: number, heightMm: number): number {
  return (
    2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm)
  );
}
