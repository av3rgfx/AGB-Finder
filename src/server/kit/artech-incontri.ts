import { geometria, type ArtechGeometryId, type PerMano } from "./artech-geometrie";
import { KitGenerationError } from "./types";

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

/**
 * Aria 12: la chiave **è** il token «asse × sede telaio» che la colonna ASSE delle
 * tabelle incontri pubblica. A listino i formati sono QUATTRO — `9x18`, `9x20`,
 * `13x24`, `13x30` — e il generatore ne copre due, quindi la mappa è scritta per
 * esteso e ciò che non c'è viene rifiutato.
 *
 * PERCHÉ NON PIÙ UN TERNARIO. Fino al 2026-07-30 la scelta era
 * `sedeMm === 18 ? "9x18" : "13x24"`: un bivio su un dominio di quattro valori.
 * Un serramento asse 9 / **sede 20** (formato `9x20`, famiglia `.12`) sarebbe
 * finito in SILENZIO sul 13x24, cioè sugli incontri di un'altra finestra. Con la
 * mappa esplicita l'ottava geometria non genera: rifiuta.
 *
 * `13x18` NON esiste a listino: è la contraddizione nota del pilota (domanda 3b).
 * La riga resta perché il golden del 16/11/2021 monta la famiglia `.05`, che **è**
 * il 9x18 — si conserva il codice verificato invece di sostituire un'assunzione
 * con un'altra.
 */
const A12_PER_FORMATO: Record<string, Chiave> = {
  "9x18": "A12_9x18",
  "13x18": "A12_9x18", // pilota A12_I13_B20, vedi sopra
  "13x24": "A12_13x24",
};

/** Riduce la geometria alla chiave che governa gli incontri: aria + asse (+ sede). */
function chiave(id: ArtechGeometryId): Chiave {
  const g = geometria(id);
  // Aria 4: il listino non pubblica una sede ma una fresatura (p0469 (467)),
  // quindi decide il solo asse.
  if (g.airGapMm === 4) {
    if (g.asse === 9) return "A4_ASSE9";
    if (g.asse === 13) return "A4_ASSE13";
  } else if (g.airGapMm === 12) {
    const k = A12_PER_FORMATO[`${g.asse}x${g.sedeMm}`];
    if (k !== undefined) return k;
  }
  throw new KitGenerationError(
    `Incontri non coperti per la geometria ${id} (aria ${g.airGapMm} · asse ${g.asse} · ` +
      `sede ${g.sedeMm === null ? "nessuna, fresatura" : `${g.sedeMm} mm`}): il listino 2026 ` +
      "pubblica gli incontri nei formati 9x18, 9x20, 13x24 e 13x30, e il generatore copre " +
      "solo 9x18 e 13x24 per l'aria 12 (l'aria 4 va per asse). Serve la trascrizione della " +
      "tabella incontri di questo formato prima di poter ordinare.",
    "artech.incontri",
  );
}

/**
 * Il formato dell'incontro **come lo legge l'agente sul listino**, da stampare in
 * distinta. Per l'aria 12 la colonna ASSE delle tabelle incontri non porta un
 * numero ma il token «asse × sede telaio» (`9x18`, `13x24`); per l'aria 4 il
 * listino non pubblica una sede ma una fresatura (p0469 (467)).
 *
 * Deriva dalla STESSA `chiave()` che sceglie i codici: descrizione e codice non
 * possono divergere per costruzione. Prima, la descrizione leggeva `asse` e
 * `sedeMm` dalla riga di geometria e il pilota stampava «asse 13 sede 18» mentre
 * emetteva la famiglia `.05`, che **è** il 9x18: cioè il formato `13x18`, che a
 * listino non esiste (contraddizione nota, domanda 3b in
 * docs/superpowers/kit-assunzioni/legno.md).
 */
export function formatoIncontro(id: ArtechGeometryId): string {
  const k = chiave(id);
  if (k === "A4_ASSE9") return "asse 9 (fresatura)";
  if (k === "A4_ASSE13") return "asse 13 (fresatura)";
  return k === "A12_9x18" ? "asse 9x18" : "asse 13x24";
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
