import { z } from "zod";
// SOLO IL TIPO: `artech-geometrie.ts` importa da qui `KitGenerationError` (un
// valore), quindi importarne i valori chiuderebbe un ciclo a runtime. Un
// `import type` viene cancellato in compilazione — il ciclo non esiste — e basta
// a vincolare la lista sotto.
import type { ArtechGeometryId } from "./artech-geometrie";

/**
 * Le 7 geometrie di `artech-geometrie.ts`, replicate qui (vedi l'import sopra) e
 * **vincolate nei due versi**, perché una lista scritta a mano si disallinea:
 *
 * - `satisfies readonly ArtechGeometryId[]` respinge un id **in più** o storpiato;
 * - `GeometrieMancanti` sotto è `never` solo se la lista le copre **tutte**.
 *   Senza quel secondo controllo, PERDERE un valore compilerebbe in silenzio
 *   (l'unione più stretta è assegnabile ovunque) e quella geometria diventerebbe
 *   muta: la tabella la conosce e la sa costruire, ma lo schema la rifiuta e
 *   nessun agente potrebbe più ordinarla.
 */
const GEOMETRY_IDS = [
  "A4_I85_B15",
  "A4_I9_B18",
  "A4_I13_B18",
  "A12_I9_B18",
  "A12_I9_B20",
  "A12_I13_B18",
  "A12_I13_B20",
] as const satisfies readonly ArtechGeometryId[];

/**
 * Vincolo di esaustività, non un tipo da usare: se una geometria resta fuori da
 * `GEOMETRY_IDS`, `Exclude` non è più `never` e questa riga non compila.
 */
type AssertNever<T extends never> = T;
type GeometrieMancanti = AssertNever<Exclude<ArtechGeometryId, (typeof GEOMETRY_IDS)[number]>>;

/**
 * Input del Kit Engine. **Unione discriminata su `series`**, non un oggetto piatto.
 *
 * PERCHÉ L'UNIONE (2026-07-26, ingresso della serie TOUR). Il router non è
 * stateless: `kit.create` riversa nella riga ogni campo dell'input *parsato*
 * (`const { notes, ...specs } = input`) e `kit.generate` ricostruisce l'input del
 * motore **rileggendo quelle colonne** (`routers/kit.ts`). La riga a DB non è un
 * registro di audit: **è l'input di ogni rigenerazione**. Rendere i campi
 * geometria semplicemente `.optional()` non sarebbe bastato — il `DEFAULT_FORM`
 * del wizard è un oggetto piatto con `airGapMm: 12` cablato, e un form piatto
 * riempie ogni campo piatto: ogni riga bilico sarebbe nata con la geometria
 * ARTECH addosso, *come input vero*. Cioè il bug «campi raccolti, validati e
 * ignorati» della bonifica 2026-07-25, spostato dal motore alla persistenza.
 *
 * Con l'unione zod **scarta** i campi estranei al ramo, e tRPC consegna
 * all'handler l'output parsato: la geometria ARTECH non può fisicamente
 * raggiungere una riga bilico. Non è una guardia da ricordarsi di chiamare, è
 * un'impossibilità strutturale.
 *
 * I due rami estendono `COMMON` così che ciascuno resti uno `ZodObject`:
 * `z.discriminatedUnion(...)` non espone `.pick()`, ma i singoli rami sì — è ciò
 * che tiene in piedi gli step del wizard.
 */
const COMMON = {
  widthMm: z.number().int().min(300).max(3000),
  heightMm: z.number().int().min(300).max(3000),
  material: z.enum(["LEGNO", "PVC", "ALLUMINIO"]),
  finish: z.string().trim().min(1).max(40),
  notes: z.string().max(2000).optional(),
  // Peso dell'anta in kg. OPZIONALE — NON `.optional().default()`: con
  // `.default()` zod rende il campo obbligatorio nel tipo di output (z.infer) e
  // romperebbe ogni `KitInput` letterale esistente che non lo valorizza (es.
  // `DEFAULT_FORM` nel wizard, i golden nei test). Serve alle due NB dello schema
  // vasistas p0418 (416) e, dal bilico, alla portata dei kit cerniere TOUR
  // (Tour 30/35 = 200 kg, Tour 40 = 300 kg).
  sashWeightKg: z.number().int().min(1).max(200).optional(),
};

/** Ramo ARTECH. La geometria è UN discriminatore, non quattro numeri liberi. */
export const artechInputSchema = z.object({
  ...COMMON,
  series: z.literal("ARTECH"),
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE", "VASISTAS"]),
  /**
   * Geometria del serramento: una delle 7 combinazioni (aria, interasse, battuta)
   * pubblicate dal listino 2026. Sostituisce i quattro campi numerici liberi.
   *
   * PERCHÉ UN DISCRIMINATORE. (a) l'interasse 8,5 non sta in un `Int` e non è una
   * misura su cui si fa aritmetica: è un selettore categoriale, come tutti e tre;
   * (b) le combinazioni valide sono un insieme chiuso di 7 — tre campi liberi ne
   * permettono centinaia di inesistenti; (c) una sola fonte di verità: aria,
   * interasse e battuta si DERIVANO dalla tabella per la UI, quindi non possono
   * divergere dai codici emessi. È lo stesso schema di `tourSchema` per il bilico.
   *
   * I valori replicano `ArtechGeometryId` di `artech-geometrie.ts`: qui non se ne
   * possono importare i VALORI (`types.ts` è la dipendenza di quel modulo, non il
   * contrario), ma il tipo sì — ed è ciò che vincola `GEOMETRY_IDS` sopra nei due
   * versi, id in più e id mancanti.
   */
  geometry: z.enum(GEOMETRY_IDS),
  /**
   * Famiglia di schemi AGB. La NB «per tipologia di serramento con sede incontri da
   * 30 mm riferirsi agli schemi "sede 30 mm"» compare su 22 pagine: è AGB stessa a
   * trattare la sede come discriminante fra famiglie. `SEDE_30` è accettata dallo
   * schema ma RIFIUTATA dai moduli finché manca l'incontro DSS 13x30 a listino.
   */
  seatConfig: z.enum(["STANDARD", "SEDE_30"]).default("STANDARD"),
  openingSide: z.enum(["DESTRA", "SINISTRA"]),
  openingDir: z.enum(["TIRARE", "SPINGERE"]).default("TIRARE"),
  // Gate del blocco «chiusure supplementari» LEGNO (Fase 1g, CHIUSURE_VERTICALI
  // in rules-artech-legno.ts). Solo `.optional()`, per la stessa ragione di
  // sashWeightKg; il gate a valle tratta già `undefined` come "OFF".
  supplementaryClosures: z.boolean().optional(),
});

/**
 * Ramo TOUR: bilico rettangolare. Un solo campo oltre ai comuni, perché lo
 * **schema di montaggio 1-5** implica da solo listello, asse, battuta, modello di
 * cerniera e guarnizione (tabella `SCHEMI` nel modulo regole).
 *
 * NON ha la `geometry` ARTECH — sarebbe priva di significato: le 7 combinazioni
 * sono quelle degli schemi di montaggio ARTECH legno, e la geometria del bilico
 * (asse 17,5 sullo schema 3, battuta 11 sullo schema 1) non è nessuna di quelle.
 *
 * NON ha `openingSide`/`openingDir`: sul bilico la mano è **derivata**, non
 * scelta. La legenda di p0537 (535) pubblica per i 3 lati la sola configurazione
 * SX; quella di p0536 (534) per i 4 lati elenca *entrambe* le mani (`T46000.01.01
 * DX` e `.02.01 SX`, `T46001.01.0X DX` e `.02.0X SX`) — si ordinano tutte e due,
 * non se ne sceglie una.
 */
export const tourInputSchema = z.object({
  ...COMMON,
  series: z.literal("TOUR"),
  windowType: z.literal("BILICO"),
  tourSchema: z.number().int().min(1).max(5),
});

export const kitInputSchema = z.discriminatedUnion("series", [artechInputSchema, tourInputSchema]);

export type KitInput = z.infer<typeof kitInputSchema>;
export type ArtechKitInput = z.infer<typeof artechInputSchema>;
export type TourKitInput = z.infer<typeof tourInputSchema>;

/** Costanti del pilota 1d (non nel form): documentano il perimetro coperto. */
export const PILOT = {
  apertura: "FINESTRA",
  verticali: "STANDARD_PASSO_600",
  passoVerticaleMm: 600,
  orizzontali: "NESSUNA",
  coperture: "KIT",
} as const;

/** Riga di kit prodotta dalle regole: riempie i campi già presenti in KitComponent. */
export interface KitLine {
  position: string;
  code: string;
  quantity: number;
  ruleId: string;
  ruleDescription: string;
}

/** Modulo regole per una famiglia di kit. Puro: nessun I/O. */
export interface RuleModule {
  engineId: string;
  generate(input: KitInput): KitLine[];
}

/** Errore deterministico di generazione (input fuori campo di applicazione, ecc.). */
export class KitGenerationError extends Error {
  constructor(
    message: string,
    public readonly ruleId?: string,
  ) {
    super(message);
    this.name = "KitGenerationError";
  }
}

/**
 * Restringimenti al ramo dell'unione. Un modulo dichiara la serie che sa trattare
 * e riceve il tipo giusto; senza questi ogni modulo vedrebbe l'unione intera.
 * **Sollevano** invece di restituire `undefined`: un modulo non deve mai
 * proseguire su un input di un'altra serie.
 */
export function asArtech(input: KitInput): ArtechKitInput {
  if (input.series !== "ARTECH")
    throw new KitGenerationError(
      `Serie "${input.series}" non trattata da questo modulo (attesa ARTECH).`,
      "kit.serie",
    );
  return input;
}

export function asTour(input: KitInput): TourKitInput {
  if (input.series !== "TOUR")
    throw new KitGenerationError(
      `Serie "${input.series}" non trattata da questo modulo (attesa TOUR).`,
      "kit.serie",
    );
  return input;
}
