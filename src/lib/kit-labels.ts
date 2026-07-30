/** Etichette italiane per gli enum delle specifiche kit (UI in italiano — regola di progetto). */

export const WINDOW_TYPE_LABELS: Record<string, string> = {
  ANTA_RIBALTA: "Anta-ribalta",
  ANTA_PROIETTANTE: "Anta proiettante",
  ANTA_BATTENTE: "Anta battente",
  SCORREVOLE_ALZANTE: "Scorrevole alzante",
  SCORREVOLE_TRASLANTE: "Scorrevole traslante",
  VASISTAS: "Vasistas",
  FINESTRA_TETTO: "Finestra da tetto",
  BILICO: "Bilico",
};

export const MATERIAL_LABELS: Record<string, string> = {
  LEGNO: "Legno",
  PVC: "PVC",
  ALLUMINIO: "Alluminio",
  LEGNO_ALLUMINIO: "Legno-alluminio",
  PVC_ALLUMINIO: "PVC-alluminio",
};

export const HINGE_SIDE_LABELS: Record<string, string> = {
  DESTRA: "Destra",
  SINISTRA: "Sinistra",
};

export const OPENING_DIR_LABELS: Record<string, string> = {
  TIRARE: "Tirare",
  SPINGERE: "Spingere",
};

export function windowTypeLabel(value: string): string {
  return WINDOW_TYPE_LABELS[value] ?? value;
}

export function materialLabel(value: string): string {
  return MATERIAL_LABELS[value] ?? value;
}

export function hingeSideLabel(value: string): string {
  return HINGE_SIDE_LABELS[value] ?? value;
}

export function openingDirLabel(value: string): string {
  return OPENING_DIR_LABELS[value] ?? value;
}

/**
 * Sede degli incontri, **derivata** dalla geometria (`Geometria.sedeMm`) e non più
 * chiesta all'agente. Vive qui perché la leggono in due — il riepilogo del wizard
 * e la scheda dettaglio — e devono dire la stessa cosa: la sede è l'unica quota
 * derivata che finisce nei codici della distinta.
 *
 * `null` non è «sconosciuta»: per l'aria 4 il listino non parla di sede ma di
 * **fresatura** (p0469 (467)), e scrivere «— mm» lascerebbe credere a un dato
 * mancante.
 */
export function sedeIncontriLabel(sedeMm: number | null): string {
  return sedeMm === null ? "Fresatura (aria 4)" : `${sedeMm} mm — derivata`;
}
