// Meccanica LEGNO condivisa tra le tipologie ARTECH (anta-ribalta, a battente).
// Estratta da rules-artech-legno.ts (Fase 1h): SOLO ciò che è meccanicamente
// identico tra le tipologie legno — cerniere per mano, movimento angolare,
// formula incontri nottolino. Estrazione BEHAVIOR-PRESERVING: l'output
// anta-ribalta resta byte-identico (golden Fase 1d invariato).
import { KitGenerationError, PILOT, type KitInput } from "./types";

type Side = KitInput["openingSide"];

/**
 * Componenti cerniera dipendenti da mano, per la geometria del pilota
 * (aria 12 / interasse 13 / battuta 20). Suffissi diversi per famiglia:
 * la squadra usa .01=DX / .02=SX, il supporto cerniera usa .DX / .SX.
 *
 * squadraAngolare A50904.36.NN = «Squadra angolare per traverso in alluminio con
 * compensatore 16/12», p0452 (450), 9,83 €. Per la geometria del pilota il listino
 * offre altre TRE varianti, tutte con la stessa coppia di mano: A50902.36.NN (base,
 * «Squadra angolare - Interasse 13», 5,77 €, p0451 (449)), A50903.36.NN («per
 * traverso in alluminio», 7,54 €) e A50901.36.NN («con compensatore», 8,05 €),
 * queste due a p0452 (450); e le legende degli schemi chiedono genericamente
 * «Squadra angolare con compensatore» → suggerirebbero A50901. Si CONSERVA A50904
 * perché è quella prescritta dal certificato ift riga «ARTech Legno» (p0395 (393)
 * / p0013 (11)), che elenca la quaterna A51911.36.04 · A50702.05.00 ·
 * A50904.36.01 · A50805.05 DX. Domanda 2 per l'esperto in
 * docs/superpowers/kit-assunzioni/legno.md.
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

/**
 * L'unica geometria di serramento per cui esiste una distinta verificata: quella
 * del golden (distinta reale AGB 2021 + listino 2026). Tutte le tabelle dei
 * moduli ARTECH sono cablate su questi valori — cremonesi entrata 15, bracci .36
 * (interasse 13), supporti battuta 20, incontri aria 12.
 *
 * NB: gli schemi di montaggio base del listino 2026 sono invece intitolati «sede
 * 30 mm» e chiedono incontri «Sede 30» / «Battuta 30»; per la sede 18 del golden
 * non esiste uno schema stampato. Domanda 4 per l'esperto in
 * docs/superpowers/kit-assunzioni/legno.md.
 */
export const PILOT_GEOMETRY = {
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
} as const;

const GEOMETRY_LABELS: Record<keyof typeof PILOT_GEOMETRY, string> = {
  airGapMm: "aria",
  axisOffsetMm: "interasse",
  rebateMm: "battuta",
  seatMm: "sede",
};

/**
 * Rifiuta le combinazioni per cui il generatore non ha tabelle. Senza questa
 * guardia l'input veniva accettato e ignorato: un'aria 4 riceveva in silenzio i
 * codici dell'aria 12 — distinta dall'aria perfetta, di un'altra configurazione.
 */
export function assertPilotGeometry(input: KitInput): void {
  const keys = Object.keys(PILOT_GEOMETRY) as (keyof typeof PILOT_GEOMETRY)[];
  const wrong = keys
    .filter((key) => input[key] !== PILOT_GEOMETRY[key])
    .map((key) => `${GEOMETRY_LABELS[key]} ${input[key]}`);
  if (wrong.length > 0)
    throw new KitGenerationError(
      `Configurazione non coperta (${wrong.join(", ")}): il generatore ARTECH copre ` +
        `aria ${PILOT_GEOMETRY.airGapMm} / interasse ${PILOT_GEOMETRY.axisOffsetMm} / ` +
        `battuta ${PILOT_GEOMETRY.rebateMm} / sede ${PILOT_GEOMETRY.seatMm}, ` +
        `l'unica combinazione con distinta verificata a listino.`,
      "artech.geometria",
    );
}
