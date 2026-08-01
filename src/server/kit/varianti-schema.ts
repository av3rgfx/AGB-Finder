import { z } from "zod";

/**
 * FILE FOGLIA — solo zod, NESSUN import da altri file del kit.
 *
 * `variantiSchema` (e i tipi che ne derivano) devono essere raggiungibili sia da
 * `artech-varianti.ts` (il registro) sia da `types.ts` (l'input del motore), e i
 * due si importano già a vicenda (`artech-varianti.ts` usa `KitGenerationError`
 * ed `Entrata` da `types.ts`). Se lo schema vivesse in uno dei due, l'altro lo
 * importerebbe chiudendo un ciclo di VALORI: alla prima esecuzione in cui il modulo
 * "sbagliato" viene caricato per primo, il modulo che dipende dall'altro esegue il
 * proprio codice di livello superiore (qui `variantiSchema.optional()` dentro
 * `artechInputSchema`) mentre l'altro è ancora a metà valutazione — `variantiSchema`
 * risulta `undefined` e il modulo crasha a runtime (non è un'ipotesi: si è
 * riprodotto eseguendo la suite intera del kit, vedi task-3-report.md).
 *
 * Questo file, isolato, spezza il ciclo: sia `artech-varianti.ts` sia `types.ts`
 * importano da qui, mai l'uno dall'altro per questo schema.
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

/**
 * Blocco varianti senza le chiavi vuote — e `undefined` se non ne resta nessuna.
 * `{}` non deve raggiungere il DB: `undefined` significa «lo standard del
 * programma», e il default vive nel REGISTRO, non nel dato persistito
 * (`artech-varianti.ts`). Senza questa normalizzazione, spegnere l'interruttore
 * lascerebbe una colonna `{}` indistinguibile da una scelta.
 *
 * `false` si pota come `undefined`, e non è una simmetria estetica: per il
 * piastrino — l'unica variante booleana — lo standard è «nessun piastrino», che
 * il motore legge da `=== true`. `{ piastrinoAntieffrazione: false }` sarebbe
 * quindi **uno standard materializzato**, cioè esattamente ciò che la potatura
 * esiste per impedire alle altre quattro.
 *
 * Vive QUI, e non nel wizard dove è nata, perché dal 2026-08-01 la usano in due:
 * il form e `kit.ricalcola`, che deve scrivere `NULL` e non `{}`. Due copie
 * della stessa regola divergono, e la divergenza sarebbe **invisibile**: una
 * riga con `{}` e una con `NULL` sono indistinguibili sul serramento e diverse
 * a DB, e il giorno in cui il default cambia si comportano diversamente. È il
 * difetto che la #47 ha già corretto una volta (la potatura al cambio
 * geometria), rimesso in circolo da un copia-incolla.
 */
export function componiVarianti(v: Varianti): Varianti | undefined {
  const pulite = Object.fromEntries(
    Object.entries(v).filter(([, valore]) => valore !== undefined && valore !== false),
  ) as Varianti;
  return Object.keys(pulite).length === 0 ? undefined : pulite;
}
