import type { ArtechGeometryId, PerMano } from "./artech-geometrie";
import { KitGenerationError, type Entrata } from "./types";
import { chiaveIncontri, type ChiaveIncontri } from "./artech-incontri";
// Ri-esportati da qui per compatibilità con gli import esistenti (Task 1-2):
// vivono nel file foglia `varianti-schema.ts` per spezzare un ciclo di VALORI —
// questo file importa `KitGenerationError` da `types.ts`, e se `variantiSchema`
// vivesse qui `types.ts` lo re-importerebbe indietro. Dettagli nel commento di
// testa di `varianti-schema.ts`.
import { variantiSchema, VARIANTE_IDS, type Varianti, type VarianteId } from "./varianti-schema";

export { variantiSchema, VARIANTE_IDS, type Varianti, type VarianteId };

/**
 * REGISTRO DELLE VARIANTI COMPONENTE — ARTECH legno.
 *
 * Una VARIANTE è una scelta che non cambia QUALI righe compone la distinta, ma
 * QUALE codice va su una riga (spec §2). Il piastrino antieffrazione è
 * l'eccezione dichiarata: aggiunge una riga, e sta qui perché l'agente lo
 * sceglie nella stessa schermata.
 *
 * DUE REGOLE CHE QUESTO FILE DEVE RISPETTARE.
 *
 * 1. **Codici INTERI, mai composti.** Le tabelle qui sotto sono regolarissime —
 *    4 famiglie × 5 interassi × 2 mani — ed è esattamente la forma che invita a
 *    scrivere `A509${fam}.${mid}.${mano}`. NON si fa: `A50901.22` e `A50904.22`
 *    **non esistono a listino** e sarebbero la prima cosa che una formula
 *    produrrebbe. È il difetto che ha fatto disattivare PVC e battente.
 * 2. **La disponibilità È la tabella.** Un'opzione è disponibile per una
 *    geometria se e solo se la tabella ha una voce per quella geometria. Nessun
 *    predicato scritto a mano che possa disallinearsi dai codici.
 *
 * DEFAULT = il codice che il motore emette OGGI. `undefined` non significa
 * "niente": significa "lo standard del programma". Non si materializza il
 * default nel dato persistito, così un domani cambiarlo passa dal ricalcolo
 * versionato e non da un valore congelato di cui nessuno sa più l'origine.
 *
 * FONTI: squadra angolare p0451-0452 (449-450).
 */

export type SquadraAngolareId = NonNullable<Varianti["squadraAngolare"]>;

/** Etichette italiane, per la UI. */
export const SQUADRA_ANGOLARE_LABEL: Record<SquadraAngolareId, string> = {
  BASE: "Base",
  TRAVERSO_ALU: "Per traverso in alluminio",
  COMPENSATORE: "Con compensatore",
  TRAVERSO_ALU_COMPENSATORE: "Traverso alluminio + compensatore",
};

/**
 * Codici INTERI. Le due caselle mancanti (`COMPENSATORE` e
 * `TRAVERSO_ALU_COMPENSATORE` per `A4_I85_B15`, cioè l'interasse 8,5) non sono
 * un'omissione: a listino NON esistono, ed è la ragione per cui il cliente MC
 * riceve oggi la squadra base mentre le altre sei geometrie ricevono la
 * versione da 9,83 € (domanda 2).
 */
export const SQUADRA_ANGOLARE: Record<
  SquadraAngolareId,
  Partial<Record<ArtechGeometryId, PerMano>>
> = {
  BASE: {
    A4_I85_B15: { DESTRA: "A50902.22.01", SINISTRA: "A50902.22.02" },
    A4_I9_B18: { DESTRA: "A50902.24.01", SINISTRA: "A50902.24.02" },
    A12_I9_B18: { DESTRA: "A50902.24.01", SINISTRA: "A50902.24.02" },
    A12_I9_B20: { DESTRA: "A50902.26.01", SINISTRA: "A50902.26.02" },
    A4_I13_B18: { DESTRA: "A50902.34.01", SINISTRA: "A50902.34.02" },
    A12_I13_B18: { DESTRA: "A50902.34.01", SINISTRA: "A50902.34.02" },
    A12_I13_B20: { DESTRA: "A50902.36.01", SINISTRA: "A50902.36.02" },
  },
  TRAVERSO_ALU: {
    A4_I85_B15: { DESTRA: "A50903.22.01", SINISTRA: "A50903.22.02" },
    A4_I9_B18: { DESTRA: "A50903.24.01", SINISTRA: "A50903.24.02" },
    A12_I9_B18: { DESTRA: "A50903.24.01", SINISTRA: "A50903.24.02" },
    A12_I9_B20: { DESTRA: "A50903.26.01", SINISTRA: "A50903.26.02" },
    A4_I13_B18: { DESTRA: "A50903.34.01", SINISTRA: "A50903.34.02" },
    A12_I13_B18: { DESTRA: "A50903.34.01", SINISTRA: "A50903.34.02" },
    A12_I13_B20: { DESTRA: "A50903.36.01", SINISTRA: "A50903.36.02" },
  },
  COMPENSATORE: {
    // A4_I85_B15 ASSENTE: `A50901.22` non esiste a listino.
    A4_I9_B18: { DESTRA: "A50901.24.01", SINISTRA: "A50901.24.02" },
    A12_I9_B18: { DESTRA: "A50901.24.01", SINISTRA: "A50901.24.02" },
    A12_I9_B20: { DESTRA: "A50901.26.01", SINISTRA: "A50901.26.02" },
    A4_I13_B18: { DESTRA: "A50901.34.01", SINISTRA: "A50901.34.02" },
    A12_I13_B18: { DESTRA: "A50901.34.01", SINISTRA: "A50901.34.02" },
    A12_I13_B20: { DESTRA: "A50901.36.01", SINISTRA: "A50901.36.02" },
  },
  TRAVERSO_ALU_COMPENSATORE: {
    // A4_I85_B15 ASSENTE: `A50904.22` non esiste a listino.
    A4_I9_B18: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    A12_I9_B18: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    A12_I9_B20: { DESTRA: "A50904.26.01", SINISTRA: "A50904.26.02" },
    A4_I13_B18: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    A12_I13_B18: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    A12_I13_B20: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
  },
};

/**
 * Default per geometria: `A4_I85_B15` → BASE (è l'unica famiglia "ricca" che il
 * listino le pubblichi), tutte le altre → TRAVERSO_ALU_COMPENSATORE. Riproduce
 * ESATTAMENTE `GEOMETRIE[*].squadraAngolare`, ed è la ragione per cui il golden
 * non può muoversi. Un test lo verifica geometria per geometria (Task 1).
 */
export function squadraAngolareDefault(geometry: ArtechGeometryId): SquadraAngolareId {
  return geometry === "A4_I85_B15" ? "BASE" : "TRAVERSO_ALU_COMPENSATORE";
}

/** Opzioni realmente ordinabili per questa geometria, nell'ordine di listino. */
export function opzioniSquadraAngolare(
  geometry: ArtechGeometryId,
): { id: SquadraAngolareId; label: string }[] {
  return (Object.keys(SQUADRA_ANGOLARE) as SquadraAngolareId[])
    .filter((id) => SQUADRA_ANGOLARE[id][geometry] !== undefined)
    .map((id) => ({ id, label: SQUADRA_ANGOLARE_LABEL[id] }));
}

export function squadraAngolare(
  geometry: ArtechGeometryId,
  mano: "DESTRA" | "SINISTRA",
  scelta: SquadraAngolareId | undefined,
): string {
  const id = scelta ?? squadraAngolareDefault(geometry);
  const perGeo = SQUADRA_ANGOLARE[id][geometry];
  if (perGeo === undefined)
    throw new KitGenerationError(
      `Squadra angolare «${SQUADRA_ANGOLARE_LABEL[id]}» non disponibile per la geometria ` +
        `${geometry}: il listino 2026 non la pubblica per questo interasse.`,
      "artech.varianti",
    );
  return perGeo[mano];
}

type Mano = "DESTRA" | "SINISTRA";
const ambidestro = (code: string): PerMano => ({ DESTRA: code, SINISTRA: code });

export type IncontroRibaltaId = NonNullable<Varianti["incontroRibalta"]>;

export const INCONTRO_RIBALTA_LABEL: Record<IncontroRibaltaId, string> = {
  ZAMA: "Zama",
  ACCIAIO_INCLINATE: "Acciaio, viti inclinate",
  ACCIAIO_DRITTE: "Acciaio, viti dritte",
};

/**
 * FONTE: p0471 (469). L'attuale è lo ZAMA per aria 12 e aria 4 asse 13
 * (ASSUNZIONE del 2026-07-25, ora una scelta esplicita); per aria 4 asse 9 lo
 * zama NON esiste e l'attuale è l'acciaio — infatti `A4_ASSE9` ha una sola
 * voce e §opzioniIncontroRibalta non offre nulla.
 */
const INCONTRO_RIBALTA: Record<IncontroRibaltaId, Partial<Record<ChiaveIncontri, PerMano>>> = {
  ZAMA: {
    A4_ASSE13: { DESTRA: "A514DX.DC.70", SINISTRA: "A514SX.DC.70" },
    A12_9x18: ambidestro("A51400.05.70"),
    A12_13x24: ambidestro("A51400.CR.70"),
  },
  ACCIAIO_INCLINATE: {
    A4_ASSE9: { DESTRA: "A514DX.01.64", SINISTRA: "A514SX.01.64" },
    A4_ASSE13: { DESTRA: "A514DX.DC.64", SINISTRA: "A514SX.DC.64" },
    A12_9x18: { DESTRA: "A514DX.05.64", SINISTRA: "A514SX.05.64" },
    A12_13x24: { DESTRA: "A514DX.CR.64", SINISTRA: "A514SX.CR.64" },
  },
  ACCIAIO_DRITTE: {
    // A4_* ASSENTI: in aria 4 il listino pubblica solo le viti inclinate.
    A12_9x18: { DESTRA: "A514DX.05.65", SINISTRA: "A514SX.05.65" },
    A12_13x24: { DESTRA: "A514DX.CR.65", SINISTRA: "A514SX.CR.65" },
  },
};

function ribaltaDefault(chiave: ChiaveIncontri): IncontroRibaltaId {
  return chiave === "A4_ASSE9" ? "ACCIAIO_INCLINATE" : "ZAMA";
}

/** Vuoto quando la scelta non esiste: una variante con una sola opzione non è una scelta. */
export function opzioniIncontroRibalta(
  geometry: ArtechGeometryId,
): { id: IncontroRibaltaId; label: string }[] {
  const k = chiaveIncontri(geometry);
  const ids = (Object.keys(INCONTRO_RIBALTA) as IncontroRibaltaId[]).filter(
    (id) => INCONTRO_RIBALTA[id][k] !== undefined,
  );
  return ids.length < 2 ? [] : ids.map((id) => ({ id, label: INCONTRO_RIBALTA_LABEL[id] }));
}

export function incontroRibaltaVariante(
  geometry: ArtechGeometryId,
  mano: Mano,
  scelta: IncontroRibaltaId | undefined,
): string {
  const k = chiaveIncontri(geometry);
  const id = scelta ?? ribaltaDefault(k);
  const perChiave = INCONTRO_RIBALTA[id][k];
  if (perChiave === undefined)
    throw new KitGenerationError(
      `Incontro ribalta «${INCONTRO_RIBALTA_LABEL[id]}» non disponibile per il formato ${k}: ` +
        "il listino 2026 non lo pubblica.",
      "artech.varianti",
    );
  return perChiave[mano];
}

export type IncontroNottolinoId = NonNullable<Varianti["incontroNottolino"]>;

export const INCONTRO_NOTTOLINO_LABEL: Record<IncontroNottolinoId, string> = {
  NORMALE: "Normale",
  ANTIEFFRAZIONE_INCLINATE: "Antieffrazione, viti inclinate",
  ANTIEFFRAZIONE_DRITTE: "Antieffrazione, viti dritte",
};

/** FONTE: normale p0469 (467) · antieffrazione p0470 (468). */
const INCONTRO_NOTTOLINO: Record<
  IncontroNottolinoId,
  Partial<Record<ChiaveIncontri, PerMano>>
> = {
  NORMALE: {
    A4_ASSE9: { DESTRA: "A514DX.01.02", SINISTRA: "A514SX.01.02" },
    A4_ASSE13: { DESTRA: "A48011.DC.02", SINISTRA: "A48012.DC.02" },
    A12_9x18: ambidestro("A51400.05.02"),
    A12_13x24: ambidestro("A51400.CR.13"),
  },
  ANTIEFFRAZIONE_INCLINATE: {
    A4_ASSE9: { DESTRA: "A514DX.01.67", SINISTRA: "A514SX.01.67" },
    A4_ASSE13: { DESTRA: "A514DX.DC.67", SINISTRA: "A514SX.DC.67" },
    A12_9x18: { DESTRA: "A514DX.05.67", SINISTRA: "A514SX.05.67" },
    A12_13x24: { DESTRA: "A514DX.CR.67", SINISTRA: "A514SX.CR.67" },
  },
  ANTIEFFRAZIONE_DRITTE: {
    // A4_* ASSENTI: in aria 4 il listino pubblica solo le viti inclinate. È il
    // motivo per cui la domanda «inclinate o dritte?» non andava risposta ma
    // mostrata: per MC e Peruzzi le dritte non esistono.
    A12_9x18: { DESTRA: "A514DX.05.68", SINISTRA: "A514SX.05.68" },
    A12_13x24: { DESTRA: "A514DX.CR.68", SINISTRA: "A514SX.CR.68" },
  },
};

export function opzioniIncontroNottolino(
  geometry: ArtechGeometryId,
): { id: IncontroNottolinoId; label: string }[] {
  const k = chiaveIncontri(geometry);
  return (Object.keys(INCONTRO_NOTTOLINO) as IncontroNottolinoId[])
    .filter((id) => INCONTRO_NOTTOLINO[id][k] !== undefined)
    .map((id) => ({ id, label: INCONTRO_NOTTOLINO_LABEL[id] }));
}

export function incontroNottolinoVariante(
  geometry: ArtechGeometryId,
  mano: Mano,
  scelta: IncontroNottolinoId | undefined,
): string {
  const k = chiaveIncontri(geometry);
  const id = scelta ?? "NORMALE";
  const perChiave = INCONTRO_NOTTOLINO[id][k];
  if (perChiave === undefined)
    throw new KitGenerationError(
      `Incontro nottolino «${INCONTRO_NOTTOLINO_LABEL[id]}» non disponibile per il formato ` +
        `${k}: il listino 2026 non lo pubblica.`,
      "artech.varianti",
    );
  return perChiave[mano];
}

export type MovimentoAngolareId = NonNullable<Varianti["movimentoAngolare"]>;

export const MOVIMENTO_ANGOLARE_LABEL: Record<MovimentoAngolareId, string> = {
  UN_NOTTOLINO: "Un nottolino",
  DUE_NOTTOLINI: "Due nottolini (antieffrazione)",
};

/**
 * FONTE: p0435 (433). NB STAMPATA: «mov. angolare A50302.02.02 necessario per
 * tutte le classi antieffrazione» — non era nella richiesta dell'utente, l'ha
 * imposto il listino.
 */
const MOVIMENTO_ANGOLARE_CODICI: Record<MovimentoAngolareId, string> = {
  UN_NOTTOLINO: "A50302.01.02",
  DUE_NOTTOLINI: "A50302.02.02",
};

export function movimentoAngolareCodice(scelta: MovimentoAngolareId | undefined): string {
  return MOVIMENTO_ANGOLARE_CODICI[scelta ?? "UN_NOTTOLINO"];
}

/**
 * Piastrino antieffrazione — riga AGGIUNTA, quantità 1. FONTE: p0432 (430).
 * Dipende dall'ENTRATA, cioè dal campo reso esplicito dalla PR #40: mappa
 * esaustiva `Record<Entrata, string>`, non un ternario (un terzo valore
 * dell'enum non deve poter finire in silenzio su uno dei due).
 */
const PIASTRINO: Record<Entrata, string> = {
  E75: "A50194.00.01",
  E15: "A20050.00.02",
};

export function piastrinoCodice(entrata: Entrata): string {
  return PIASTRINO[entrata];
}

/**
 * Combinazioni che il listino VIETA ma i cui codici esistono tutti.
 *
 * NON è un rifiuto: è il precedente «avviso, mai blocco» dello sconto oltre
 * soglia. Bloccare significherebbe impedire un ordine vero sulla base della
 * NOSTRA lettura di una NB stampata.
 *
 * Pura, e usata in due posti: il motore (dove finisce in `warnings`, quindi
 * persistita in `generatedKit`) e il wizard (dove si vede PRIMA di generare).
 */
export function avvisiVarianti(varianti: Varianti | undefined): string[] {
  if (varianti === undefined) return [];
  const avvisi: string[] = [];
  const antieffrazione = varianti.incontroNottolino?.startsWith("ANTIEFFRAZIONE") === true;
  if (antieffrazione && varianti.movimentoAngolare !== "DUE_NOTTOLINI")
    avvisi.push(
      "Incontro nottolino antieffrazione con movimento angolare a un nottolino: il listino " +
        "2026 (p. stampata 433) richiede il movimento angolare a due nottolini A50302.02.02 " +
        "per tutte le classi antieffrazione.",
    );
  return avvisi;
}
