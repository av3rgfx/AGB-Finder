import { z } from "zod";
import type { ArtechGeometryId, PerMano } from "./artech-geometrie";
import { KitGenerationError } from "./types";

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

/**
 * `.strict()` non è decorativo: una chiave sconosciuta — una variante
 * rinominata, il residuo di una versione precedente — deve FALLIRE il parse
 * invece di essere ignorata in silenzio.
 */
export const variantiSchema = z
  .object({
    squadraAngolare: z
      .enum(["BASE", "TRAVERSO_ALU", "COMPENSATORE", "TRAVERSO_ALU_COMPENSATORE"])
      .optional(),
    incontroRibalta: z.enum(["ZAMA", "ACCIAIO_INCLINATE", "ACCIAIO_DRITTE"]).optional(),
    movimentoAngolare: z.enum(["UN_NOTTOLINO", "DUE_NOTTOLINI"]).optional(),
    incontroNottolino: z
      .enum(["NORMALE", "ANTIEFFRAZIONE_INCLINATE", "ANTIEFFRAZIONE_DRITTE"])
      .optional(),
    piastrinoAntieffrazione: z.boolean().optional(),
  })
  .strict();

export type Varianti = z.infer<typeof variantiSchema>;

/**
 * Gli stessi 5 nomi delle chiavi di `variantiSchema`, ma come lista ordinabile
 * (serve per iterarle in UI). Prima erano due elenchi indipendenti — rinominare
 * una chiave dello schema non veniva segnalato dal compilatore qui. Vincolata
 * nei due versi come `GEOMETRY_IDS` in `types.ts`:
 *
 * - `satisfies readonly (keyof Varianti)[]` respinge un id **in più** o storpiato;
 * - `VarianteMancante` sotto è `never` solo se la lista copre **tutte** le
 *   chiavi dello schema. Senza quel secondo controllo, PERDERE una chiave
 *   compilerebbe in silenzio (l'unione più stretta è assegnabile ovunque) e
 *   quella variante diventerebbe muta in UI pur esistendo nello schema.
 */
export const VARIANTE_IDS = [
  "squadraAngolare",
  "incontroRibalta",
  "movimentoAngolare",
  "incontroNottolino",
  "piastrinoAntieffrazione",
] as const satisfies readonly (keyof Varianti)[];

/**
 * Vincolo di esaustività, non un tipo da usare: se una chiave di `Varianti`
 * resta fuori da `VARIANTE_IDS`, `Exclude` non è più `never` e questa riga
 * non compila.
 */
type AssertNever<T extends never> = T;
type VarianteMancante = AssertNever<Exclude<keyof Varianti, (typeof VARIANTE_IDS)[number]>>;

export type VarianteId = (typeof VARIANTE_IDS)[number];

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
