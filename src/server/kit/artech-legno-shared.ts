// Meccanica LEGNO condivisa tra le tipologie ARTECH (anta-ribalta, a battente).
// Estratta da rules-artech-legno.ts (Fase 1h): SOLO ciò che è meccanicamente
// identico tra le tipologie legno — cerniere per mano, movimento angolare,
// formula incontri nottolino. Estrazione BEHAVIOR-PRESERVING: l'output
// anta-ribalta resta byte-identico (golden Fase 1d invariato).
import { PILOT, type KitInput } from "./types";

type Side = KitInput["openingSide"];

/**
 * Componenti cerniera dipendenti da mano, per la geometria del pilota
 * (aria 12 / interasse 13 / battuta 20). Suffissi diversi per famiglia:
 * la squadra usa .01=DX / .02=SX, il supporto cerniera usa .DX / .SX.
 *
 * squadraAngolare A50904.36.NN = «Squadra angolare per traverso in alluminio con
 * compensatore 16/12», p0452 (450), 9,83 €. Il listino offre anche A50901.36.NN
 * («con compensatore», 8,05 €) e A50903.36.NN («per traverso in alluminio»,
 * 7,54 €), e le legende degli schemi chiedono genericamente «Squadra angolare con
 * compensatore» → suggerirebbero A50901. Si CONSERVA A50904 perché è quella
 * prescritta dal certificato ift riga «ARTech Legno» (p0395/p0013), che elenca la
 * quaterna A51911.36.04 · A50702.05.00 · A50904.36.01 · A50805.05 DX. Domanda 2
 * per l'esperto in docs/superpowers/kit-assunzioni/legno.md.
 *
 * supportoCerniera A50805.05.DX/.SX = «Supporto cerniera Aria 12 - Interasse 9/13
 * - Parte telaio», battuta 20, p0451 (449), 4,44 €. CORRETTO il 2026-07-25: prima
 * era A50801.01.01/.02, che è la variante «Aria 4 - Interasse 9», battuta 18 —
 * incompatibile con la geometria del pilota. Doppia conferma: la tabella di p0451
 * e il certificato ift «ARTech Legno». Stesso prezzo, quindi il totale del kit non
 * cambia.
 */
export const PER_MANO: Record<Side, { squadraAngolare: string; supportoCerniera: string }> = {
  SINISTRA: { squadraAngolare: "A50904.36.02", supportoCerniera: "A50805.05.SX" },
  DESTRA: { squadraAngolare: "A50904.36.01", supportoCerniera: "A50805.05.DX" },
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
