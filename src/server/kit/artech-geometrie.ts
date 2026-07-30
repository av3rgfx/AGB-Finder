import { KitGenerationError } from "./types";

/**
 * Le 7 geometrie ARTECH legno del listino 2026, con i CODICI INTERI dei componenti
 * che dipendono dalla geometria.
 *
 * PERCHÉ CODICI INTERI E NON SUFFISSI DA CONCATENARE. Il 2° segmento del codice
 * codifica (aria, interasse, battuta) in modo regolarissimo — .22/.24/.26/.34/.36 —
 * e la tentazione di comporre `A50904.${suffisso}` è forte. Ma `A50904.22` **non
 * esiste**: la squadra «per traverso in alluminio con compensatore» è pubblicata solo
 * per interasse 9 e 13 (p0452 (450)). Per l'interasse 8,5 esistono solo A50902.22
 * (base) e A50903.22. Comporre avrebbe prodotto un codice plausibile e inesistente —
 * il difetto che ha fatto disattivare i moduli PVC e battente.
 *
 * FONTI: squadre p0451-0452 (449-450) · supporti forbice p0449 (447) ·
 * supporti cerniera p0451 (449) · bracci forbice p0439 (437).
 */
export type ArtechGeometryId =
  | "A4_I85_B15"
  | "A4_I9_B18"
  | "A4_I13_B18"
  | "A12_I9_B18"
  | "A12_I9_B20"
  | "A12_I13_B18"
  | "A12_I13_B20";

export type PerMano = { DESTRA: string; SINISTRA: string };

export interface Geometria {
  airGapMm: number;
  axisOffsetMm: number;
  rebateMm: number;
  /** Asse degli incontri. L'interasse 8,5 delle cerniere usa gli incontri asse 9
   *  (a listino non esiste un asse 8,5) — ASSUNZIONE, domanda 24. */
  asse: 9 | 13;
  /** Sede telaio derivata. `null` per aria 4: lì il listino parla di «Fresatura», non
   *  di sede (p0469 (467)). */
  sedeMm: number | null;
  squadraAngolare: PerMano;
  supportoCerniera: PerMano;
  supportoForbice: string;
  /** 2° segmento del braccio forbice A51911(dx)/A51912(sx).{mid}.{GR}. */
  braccioMid: string;
}

export const GEOMETRIE: Record<ArtechGeometryId, Geometria> = {
  // MC. ASSUNZIONE (domanda 2): A50904 non ha il .22 → si adotta la variante base
  // A50902.22, il cui nome non porta qualifiche («Squadra angolare - Interasse 8,5»),
  // appropriata a una finestra tutto-legno. L'alternativa è A50903.22 (+1,77 €).
  A4_I85_B15: {
    airGapMm: 4, axisOffsetMm: 8.5, rebateMm: 15, asse: 9, sedeMm: null,
    squadraAngolare: { DESTRA: "A50902.22.01", SINISTRA: "A50902.22.02" },
    supportoCerniera: { DESTRA: "A50803.01.01", SINISTRA: "A50803.01.02" },
    supportoForbice: "A50703.01.00",
    braccioMid: "22",
  },
  // Peruzzi.
  A4_I9_B18: {
    airGapMm: 4, axisOffsetMm: 9, rebateMm: 18, asse: 9, sedeMm: null,
    squadraAngolare: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    supportoCerniera: { DESTRA: "A50801.01.01", SINISTRA: "A50801.01.02" },
    supportoForbice: "A50701.01.00",
    braccioMid: "24",
  },
  A4_I13_B18: {
    airGapMm: 4, axisOffsetMm: 13, rebateMm: 18, asse: 13, sedeMm: null,
    squadraAngolare: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    supportoCerniera: { DESTRA: "A50801.DC.01", SINISTRA: "A50801.DC.02" },
    supportoForbice: "A50701.DC.00",
    braccioMid: "34",
  },
  A12_I9_B18: {
    airGapMm: 12, axisOffsetMm: 9, rebateMm: 18, asse: 9, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    supportoCerniera: { DESTRA: "A50804.05.DX", SINISTRA: "A50804.05.SX" },
    supportoForbice: "A50701.05.00",
    braccioMid: "24",
  },
  A12_I9_B20: {
    airGapMm: 12, axisOffsetMm: 9, rebateMm: 20, asse: 9, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.26.01", SINISTRA: "A50904.26.02" },
    supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
    supportoForbice: "A50702.05.00",
    braccioMid: "26",
  },
  // Fosca.
  A12_I13_B18: {
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 18, asse: 13, sedeMm: 24,
    squadraAngolare: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    supportoCerniera: { DESTRA: "A50804.05.DX", SINISTRA: "A50804.05.SX" },
    supportoForbice: "A50701.05.00",
    braccioMid: "34",
  },
  // PILOTA STORICO (distinta reale AGB 16/11/2021). `sedeMm` è dichiarata 18 dal
  // golden benché l'asse sia 13: la coppia 13x18 non esiste a listino ed è la
  // CONTRADDIZIONE NOTA (domanda 3b). Si conservano i codici verificati invece di
  // sostituire un'assunzione con un'altra — il totale resta 90,20 €.
  A12_I13_B20: {
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, asse: 13, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
    supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
    supportoForbice: "A50702.05.00",
    braccioMid: "36",
  },
};

export function geometria(id: ArtechGeometryId): Geometria {
  return GEOMETRIE[id];
}

/**
 * Quota in millimetri all'italiana: «8,5» con la virgola, «15» senza decimali.
 * Esportata perché l'interasse 8,5 finisce anche nelle `ruleDescription` delle
 * righe di distinta (`rules-artech-legno.ts`), e la UI del progetto è in
 * italiano: interpolare il numero grezzo ci stampava «8.5».
 */
export function mm(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function geometriaLabel(id: ArtechGeometryId): string {
  const g = GEOMETRIE[id];
  return `Aria ${g.airGapMm} · interasse ${mm(g.axisOffsetMm)} · battuta ${g.rebateMm}`;
}

/**
 * SEDE_30 è fuori perimetro nel Piano 1: p0473 (471) pubblica gli incontri DSS aria 12
 * solo per 9x18 e 13x24 — per 13x30 non ne esiste uno. Generare una sede 30 significherebbe
 * emettere una distinta a cui manca un pezzo, o inventarlo.
 */
export function assertSeatConfigSupportata(seatConfig: "STANDARD" | "SEDE_30"): void {
  if (seatConfig === "SEDE_30")
    throw new KitGenerationError(
      "Configurazione «sede 30» non ancora coperta: il listino 2026 non pubblica un " +
        "incontro DSS per il formato 13x30. Usare la configurazione standard.",
      "artech.sede",
    );
}
