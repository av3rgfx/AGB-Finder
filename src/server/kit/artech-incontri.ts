import { geometria, type ArtechGeometryId, type PerMano } from "./artech-geometrie";

/**
 * Incontri (nottolino, ribalta, DSS) per geometria e mano.
 *
 * PERCHÉ LA MANO. Per aria 12 gli incontri sono ambidestri: un solo codice. Per aria 4
 * hanno DX/SX, e su famiglie diverse a seconda dell'asse (A514DX/SX per l'asse 9,
 * A48011/A48012 per l'asse 13). Emettere l'ambidestro dell'aria 12 su un serramento
 * aria 4 darebbe una distinta plausibile e inservibile.
 *
 * FONTI: nottolino p0469 (467) · ribalta p0471 (469) · DSS p0473 (471).
 */

type Chiave = "A4_ASSE9" | "A4_ASSE13" | "A12_9x18" | "A12_13x24";

/** Riduce la geometria alla chiave che governa gli incontri: aria + asse. */
function chiave(id: ArtechGeometryId): Chiave {
  const g = geometria(id);
  if (g.airGapMm === 4) return g.asse === 9 ? "A4_ASSE9" : "A4_ASSE13";
  // Aria 12: il pilota (sedeMm 18) resta sul 9x18 verificato dalla distinta 2021;
  // le altre aria-12 asse 13 usano il 13x24 derivato. Vedi domanda 3b.
  return g.sedeMm === 18 ? "A12_9x18" : "A12_13x24";
}

const ambidestro = (code: string): PerMano => ({ DESTRA: code, SINISTRA: code });

const NOTTOLINO: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A514DX.01.02", SINISTRA: "A514SX.01.02" },
  A4_ASSE13: { DESTRA: "A48011.DC.02", SINISTRA: "A48012.DC.02" },
  A12_9x18: ambidestro("A51400.05.02"),
  A12_13x24: ambidestro("A51400.CR.13"),
};

// ASSUNZIONE (aria 4, asse 13): a listino esistono sia l'acciaio (.DC.64) sia lo zama
// (.DC.70). Si adotta lo ZAMA per coerenza col pilota aria 12, che usa lo zama viti
// dritte. Per l'asse 9 la scelta non esiste: c'è solo l'acciaio.
const RIBALTA: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A514DX.01.64", SINISTRA: "A514SX.01.64" },
  A4_ASSE13: { DESTRA: "A514DX.DC.70", SINISTRA: "A514SX.DC.70" },
  A12_9x18: ambidestro("A51400.05.70"),
  A12_13x24: ambidestro("A51400.CR.70"),
};

const DSS: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A48011.01.03", SINISTRA: "A48012.01.03" },
  A4_ASSE13: { DESTRA: "A48011.DC.03", SINISTRA: "A48012.DC.03" },
  A12_9x18: ambidestro("A51400.05.03"),
  A12_13x24: ambidestro("A48010.CR.03"),
};

type Mano = "DESTRA" | "SINISTRA";

export function incontroNottolino(id: ArtechGeometryId, mano: Mano): string {
  return NOTTOLINO[chiave(id)][mano];
}

export function incontroRibalta(id: ArtechGeometryId, mano: Mano): string {
  return RIBALTA[chiave(id)][mano];
}

export function incontroDss(id: ArtechGeometryId, mano: Mano): string {
  return DSS[chiave(id)][mano];
}
