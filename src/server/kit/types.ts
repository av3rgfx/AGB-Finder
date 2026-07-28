import { z } from "zod";

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

/** Ramo ARTECH: la forma storica, invariata (Fasi 1d/1g/1h/1i). */
export const artechInputSchema = z.object({
  ...COMMON,
  series: z.literal("ARTECH"),
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE", "VASISTAS"]),
  airGapMm: z.number().int().min(4).max(20),
  axisOffsetMm: z.number().int().min(9).max(20),
  rebateMm: z.number().int().min(15).max(30),
  // Le sedi telaio che il listino 2026 pubblica davvero sono 18, 20, 24 e 30
  // (per l'alluminio anche 22/35 e 24/37). Il massimo era 22 e tagliava fuori la
  // **sede 30**, che è quella di TUTTI gli schemi di montaggio base ARTECH del
  // 2026: chi ha un serramento sede 30 non riusciva nemmeno a scriverlo, e si
  // prendeva un errore di range invece del messaggio del motore, che spiega
  // quale configurazione è coperta. Il generatore continua a coprire la sola
  // sede 18 (PILOT_GEOMETRY): qui si allarga solo ciò che è *scrivibile*, non
  // ciò che è generabile.
  seatMm: z.number().int().min(12).max(30),
  openingSide: z.enum(["DESTRA", "SINISTRA"]),
  openingDir: z.enum(["TIRARE", "SPINGERE"]),
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
 * NON ha i quattro campi geometria ARTECH — sarebbero privi di significato, e due
 * valori del bilico non ci entrerebbero nemmeno: l'asse dello schema 3 è **17,5**
 * (i campi sono interi) e la battuta dello schema 1 è **11** (sotto il `.min(15)`).
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
