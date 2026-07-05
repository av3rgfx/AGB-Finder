import { z } from "zod";

/**
 * Input generico del Kit Engine (ADR 2026-07-04: nessun campo serie-specifico).
 * Pilota 1d: solo ANTA_RIBALTA / ARTECH; i letterali si allargano con le serie future.
 */
export const kitInputSchema = z.object({
  windowType: z.literal("ANTA_RIBALTA"),
  widthMm: z.number().int().min(300).max(3000),
  heightMm: z.number().int().min(300).max(3000),
  material: z.enum(["LEGNO", "PVC", "ALLUMINIO"]),
  airGapMm: z.number().int().min(4).max(20),
  axisOffsetMm: z.number().int().min(9).max(20),
  rebateMm: z.number().int().min(15).max(30),
  seatMm: z.number().int().min(12).max(22),
  openingSide: z.enum(["DESTRA", "SINISTRA"]),
  openingDir: z.enum(["TIRARE", "SPINGERE"]),
  finish: z.string().trim().min(1).max(40),
  series: z.literal("ARTECH"),
  notes: z.string().max(2000).optional(),
});

export type KitInput = z.infer<typeof kitInputSchema>;

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
