import { KitGenerationError, kitInputSchema, type KitInput } from "./types";

/**
 * La forma della riga `kit_requests` per quel che serve a rigenerare. Dichiarata
 * qui e non importata da Prisma per tenere il modulo **puro e testabile senza DB**
 * (stesso criterio dei moduli regole).
 */
export interface PersistedKitRequest {
  windowType: string;
  widthMm: number;
  heightMm: number;
  material: string;
  finish: string;
  series: string;
  // I quattro numerici legacy (`air_gap_mm`, `axis_offset_mm`, `rebate_mm`,
  // `seat_mm`) restano a DB per non perdere lo storico ma NON sono dichiarati
  // qui: nessun modulo li legge più, e tenerli nell'interfaccia inviterebbe a
  // rimetterli nell'input. La geometria è una colonna sola.
  geometry: string | null;
  entrata: string | null;
  seatConfig: string | null;
  openingSide: string | null;
  openingDir: string | null;
  supplementaryClosures: boolean;
  sashWeightKg: number | null;
  tourSchema: number | null;
  notes: string | null;
  variants: unknown;
}

/**
 * Ricostruisce l'input del motore da una richiesta persistita, **per ramo**.
 *
 * Questo modulo esiste perché `kit.generate` non rigenera dall'input originale:
 * rilegge la riga a DB. La riga **è** l'input di ogni rigenerazione, quindi va
 * trattata come input non fidato e **ri-validata** — non spalmata a colpi di
 * `?? undefined`. Una riga incoerente (creata prima di un cambio di schema, o
 * modificata a mano) deve produrre un **rifiuto**, mai una distinta a cui manca
 * in silenzio un pezzo di input.
 */
export function kitInputFromRequest(row: PersistedKitRequest): KitInput {
  const common = {
    windowType: row.windowType,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    material: row.material,
    finish: row.finish,
    ...(row.notes !== null && { notes: row.notes }),
    ...(row.sashWeightKg !== null && { sashWeightKg: row.sashWeightKg }),
  };

  // Si costruisce SOLO ciò che il ramo prevede: i campi dell'altro ramo non
  // vengono nemmeno proposti al parse. (L'unione li scarterebbe comunque, ma
  // così il rifiuto per riga incoerente resta leggibile.)
  const candidate =
    row.series === "TOUR"
      ? { ...common, series: row.series, tourSchema: row.tourSchema }
      : {
          ...common,
          series: row.series,
          geometry: row.geometry,
          // NESSUN `?? "E15"`. `seatConfig` e `openingDir` hanno un default nello
          // schema zod e qui lo si riapplica; l'entrata NON ne ha, di proposito.
          // Il backfill della migrazione ha valorizzato tutte le righe ARTECH
          // esistenti: se ne comparisse una a NULL è un dato rotto e va rifiutata
          // con un messaggio, non tappata con un valore plausibile.
          entrata: row.entrata,
          // Le due colonne hanno un default nello schema **zod** (non a DB: a DB
          // sono nullable senza default, di proposito), e una riga scritta prima
          // della migrazione può averle a NULL: qui si applica lo stesso default
          // zod invece di far fallire il parse su un dato che ha una lettura sola.
          // `geometry`, che di default non ne ha, resta NULL e viene rifiutata —
          // è giusto: nessuno può indovinarla.
          seatConfig: row.seatConfig ?? "STANDARD",
          openingSide: row.openingSide,
          openingDir: row.openingDir ?? "TIRARE",
          supplementaryClosures: row.supplementaryClosures,
          // NESSUN `?? {}`. Un fallback qui renderebbe indistinguibile «non
          // scelto» da «dato rotto», e il default vive nel registro. `null` a
          // DB → `undefined` nell'input, che è ciò che lo schema `.optional()`
          // vuole; qualunque altra cosa passa dal `safeParse` sotto e, se non è
          // valida, la riga viene RIFIUTATA con un messaggio.
          ...(row.variants !== null && row.variants !== undefined && { variants: row.variants }),
        };

  const parsed = kitInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "series"}: ${issue.message}`)
      .join("; ");
    throw new KitGenerationError(
      `Richiesta kit incoerente con la serie "${row.series}" — ${details}`,
      "kit.richiesta",
    );
  }
  return parsed.data;
}
