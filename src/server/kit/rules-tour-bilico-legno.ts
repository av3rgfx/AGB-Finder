// Regole kit «bilico rettangolare» serie TOUR, LEGNO.
//
// Prima serie non-ARTECH del kit engine. Fonte: listino AGB 2026, sezione
// BILICI. Si cita sempre «pagina FISICA (stampata)», fisica = stampata + 2.
//
// LA STRUTTURA, che è ciò che rende questa tipologia deterministica: il bilico
// NON è una distinta di componenti sciolti. Le legende «Componenti» degli schemi
// generici — p0536 (534) per i 4 lati, p0537 (535) per i 3 lati — raggruppano
// tutto in QUATTRO kit ordinabili con un codice ciascuno (A elementi
// orizzontali, B movimenti angolari, C cerniere, D incontri), più le due aste
// verticali sciolte. Quelle legende stanno DENTRO il disegno: nel testo estratto
// non compaiono, vanno lette renderizzando la pagina.
//
// La tabella di p0538 (536) è la **composizione** dei kit, non una lista
// d'ordine. Verificato con l'aritmetica: il kit incontri 3 lati T47701.01.00
// costa 43,95 € e il suo contenuto dichiarato (3+3 nottolini a 4,82 + 1
// limitatore a 15,20) somma 44,12 €; la versione 4 lati costa 68,70 contro 68,96.
// Scarti di 17 e 26 centesimi → il kit È la somma delle sue parti, si ordina una
// riga sola. (La NB «Per Prefinito 300 Kg ordinare incontri singoli» conferma per
// contrasto: gli incontri sciolti servono solo in quel caso, fuori scope.)
//
// LA MANO NON È UN INPUT. Sui 3 lati il listino pubblica la sola configurazione
// SX; sui 4 lati la legenda elenca *entrambe* le mani e si ordinano tutte e due.
// Non c'è nulla da scegliere: `tourInputSchema` non ha openingSide/openingDir.
//
// CAMPO DI APPLICAZIONE: i 5 schemi del bilico RETTANGOLARE, solo LEGNO. Fuori:
// bilico tondo TOUR-R (p0554-0562, prodotto diverso), prefinito (p0540 (538),
// guarnizione propria e una NB non risolvibile), prefinito 300 kg complanare
// (p0545-0546: pagine di sola immagine, zero codici nel testo), dime
// (attrezzatura di bottega), prolunga e chiavetta limitatore (non in legenda).
//
// Assunzioni dichiarate e domande 11-15 per l'esperto AGB:
// docs/superpowers/kit-assunzioni/tour.md
import { pick, requireKey } from "./kit-shared";
import { KitGenerationError, asTour, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * I 5 schemi di montaggio. **Lo schema è l'unica chiave**: implica da solo
 * listello, asse, battuta, modello di cerniera (e quindi portata) e guarnizione.
 * Titoli da p0539/0541/0542/0543/0544 (537/539/540/541/542).
 *
 * `asseMm` dello schema 3 è **17,5**: non è un intero e non è persistito da
 * nessuna parte — vive qui e finisce solo nelle descrizioni delle righe. È la
 * ragione per cui il bilico non poteva riusare i campi geometria ARTECH.
 *
 * `minHbb`: le bande dei kit partono da 600, ma p0549 (547) annota «HBB minimo
 * **580** per SCHEMA 1 e PREFINITO».
 */
export const SCHEMI_TOUR = {
  1: {
    tour: 30, listelloMm: 30, asseMm: 15, battutaMm: 11, portataKg: 200, minHbb: 580,
    guarnizione: "T18002.01.93", guarnizioneDescr: "battuta 11 · kit 12+12 m", spessori: false,
  },
  2: {
    tour: 30, listelloMm: 30, asseMm: 15, battutaMm: 18, portataKg: 200, minHbb: 600,
    guarnizione: "T18001.02.93", guarnizioneDescr: "battuta 11/18 · 12 m", spessori: false,
  },
  3: {
    tour: 35, listelloMm: 35, asseMm: 17.5, battutaMm: 15, portataKg: 200, minHbb: 600,
    guarnizione: "T18001.03.93", guarnizioneDescr: "battuta 15 · 12 m", spessori: true,
  },
  4: {
    tour: 35, listelloMm: 35, asseMm: 20, battutaMm: 18, portataKg: 200, minHbb: 600,
    guarnizione: "T18001.02.93", guarnizioneDescr: "battuta 11/18 · 12 m", spessori: false,
  },
  5: {
    tour: 40, listelloMm: 40, asseMm: 20, battutaMm: 18, portataKg: 300, minHbb: 600,
    guarnizione: "T18001.02.93", guarnizioneDescr: "battuta 11/18 · 12 m", spessori: false,
  },
} as const;

/**
 * A — Kit elementi orizzontali per LBB, p0547 (545). Contiene l'elemento di
 * collegamento orizzontale **e la cremonese** → nessuna riga cremonese separata.
 * NB di listino: entrata 30 mm.
 * ⚠️ GR1 e GR2 si **sovrappongono** fra 640 e 650: `pick()` risolve con lo span
 * più stretto (GR1). Domanda 15.
 */
const ELEMENTI_ORIZZONTALI = [
  { minL: 530, maxL: 650, gr: 1, code: "T47501.00.01" },
  { minL: 640, maxL: 800, gr: 2, code: "T47501.00.02" },
  { minL: 801, maxL: 1200, gr: 3, code: "T47501.00.03" },
  { minL: 1201, maxL: 1600, gr: 4, code: "T47501.00.04" },
  { minL: 1601, maxL: 2000, gr: 5, code: "T47501.00.05" },
  { minL: 2001, maxL: 2400, gr: 6, code: "T47501.00.06" },
] as const;

/** ❹ Asta di collegamento verticale CON braccetto, per HBB × mano. p0548 (546). */
const ASTE_CON_BRACCETTO = [
  { minH: 580, maxH: 1000, gr: 1, dx: "T46001.01.01", sx: "T46001.02.01" },
  { minH: 1001, maxH: 1400, gr: 2, dx: "T46001.01.02", sx: "T46001.02.02" },
  { minH: 1401, maxH: 1800, gr: 3, dx: "T46001.01.03", sx: "T46001.02.03" },
  { minH: 1801, maxH: 2400, gr: 4, dx: "T46001.01.04", sx: "T46001.02.04" },
] as const;

/**
 * ❸ Asta di collegamento verticale SENZA braccetto. p0548 (546): esiste **solo
 * in GR1** (HBB 580-1000, L 770), ma le legende degli schemi generici ne scrivono
 * il suffisso **letterale `.01`** mentre per l'asta con braccetto scrivono `0X`.
 *
 * ASSUNZIONE (domanda 11): il codice vale per **ogni** HBB. La lettura opposta —
 * valido solo fino a HBB 1000 — renderebbe inservibili sia `T48102` (HBB ≥ 1001)
 * sia `T46001` GR2-4 (fino a 2400), cioè si contraddirebbe da sola.
 */
const ASTA_SENZA_BRACCETTO = { dx: "T46000.01.01", sx: "T46000.02.01" } as const;

/** B — Kit movimenti angolari per HBB × numero di lati. p0549 (547). */
const MOVIMENTI_ANGOLARI = [
  { minH: 580, maxH: 800, tre: "T48100.03.00", quattro: "T48100.04.00" },
  { minH: 801, maxH: 1000, tre: "T48101.03.00", quattro: "T48101.04.00" },
  { minH: 1001, maxH: 2400, tre: "T48102.03.00", quattro: "T48102.04.00" },
] as const;

/**
 * C — Kit cerniere per modello × finitura. p0549 (547). **Solo due finiture** a
 * listino: qualunque altra è un rifiuto, non un ripiego silenzioso.
 */
const CERNIERE: Record<number, Record<string, string>> = {
  30: { "CROMATO OPACO": "T17800.30.34", "MARRONE RAL 8019": "T17800.30.94" },
  35: { "CROMATO OPACO": "T17800.35.34", "MARRONE RAL 8019": "T17800.35.94" },
  40: { "CROMATO OPACO": "T17800.40.34", "MARRONE RAL 8019": "T17800.40.94" },
};

/**
 * Le due sole finiture a listino per le cerniere TOUR. **Esportata**: il wizard
 * la importa invece di ridichiararla. Il difetto da non ripetere è
 * `FINISH_OPTIONS` lato client, tenuto in sincrono con la tabella server *da un
 * commento*.
 */
export const FINITURE_TOUR = ["CROMATO OPACO", "MARRONE RAL 8019"] as const;
const FINITURE = FINITURE_TOUR;

/** Kit spessori 4 mm battuta 15, «per cerniera Tour 35 schema 3». p0549 (547). */
const KIT_SPESSORI = "T16635.04.01";

/**
 * Confezione base delle guarnizioni: sono prezzate **al metro** e la colonna
 * confezione dice 12 per tutti i codici. ASSUNZIONE (domanda 13): la quantità è
 * la confezione base, anche per il «12+12 m» dello schema 1.
 */
const GUARNIZIONE_CONFEZIONE_M = 12;

const LBB_MAX = 2400;
const HBB_MAX = 2400;

/** Soglia 3/4 lati, confrontata in **mm² interi**: mai un float su un confine. */
const SOGLIA_4_LATI_MM2 = 2_000_000;

export const tourBilicoLegno: RuleModule = {
  engineId: "tour-bilico-legno",

  generate(rawInput: KitInput): KitLine[] {
    const input = asTour(rawInput);

    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non coperto per il bilico TOUR: il generatore supporta LEGNO.`,
        "tour.materiale",
      );

    const schema = SCHEMI_TOUR[input.tourSchema as keyof typeof SCHEMI_TOUR];
    if (!schema)
      throw new KitGenerationError(
        `Schema di montaggio ${input.tourSchema} inesistente: il bilico TOUR ha gli schemi 1-5.`,
        "tour.schema",
      );

    const lbb = input.widthMm;
    const hbb = input.heightMm;
    const geometria = `listello ${schema.listelloMm}, asse ${formatMm(schema.asseMm)}, battuta ${schema.battutaMm}`;

    if (hbb < schema.minHbb)
      throw new KitGenerationError(
        `Altezza ${hbb} mm sotto il minimo di ${schema.minHbb} mm per lo schema ${input.tourSchema}` +
          (schema.minHbb === 600 ? " (i 580 mm valgono solo per lo schema 1)." : "."),
        "tour.altezza",
      );
    if (lbb > LBB_MAX || hbb > HBB_MAX)
      throw new KitGenerationError(
        `Bilico ${lbb}×${hbb} mm fuori dalle tabelle di listino (massimo ${LBB_MAX}×${HBB_MAX} mm).`,
        "tour.dimensioni",
      );

    // Portata del kit cerniere: Tour 30/35 = 200 kg, Tour 40 = 300 kg (NB «per
    // schema 5»). Verificabile solo se l'agente ha indicato il peso.
    if (input.sashWeightKg !== undefined && input.sashWeightKg > schema.portataKg)
      throw new KitGenerationError(
        `Anta da ${input.sashWeightKg} kg oltre la portata del kit cerniere Tour ${schema.tour}: ` +
          `${schema.portataKg} kg. Per ante più pesanti serve lo schema 5 (Tour 40, 300 kg).`,
        "tour.portata",
      );

    const finitura = input.finish.trim().toUpperCase();
    const cerniera = requireKey(
      CERNIERE[schema.tour]!,
      finitura,
      "tour.finitura",
      `Finitura "${input.finish}" non a listino per le cerniere TOUR: sono previste solo ` +
        `${FINITURE.join(" e ")}.`,
    );

    // ── 3 o 4 lati: derivato dalla superficie, non scelto ──────────────────
    // p0536 (534) «SUPERFICIE > 2 m²» → 4 lati; p0537 (535) «SUPERFICIE < 2 m²»
    // → 3 lati. Il caso ESATTAMENTE 2 m² non è coperto dal listino: si sceglie
    // 4 lati per prudenza (al confine di un componente portante l'errore
    // prudente è quello che tiene l'anta). Domanda 12.
    const quattroLati = lbb * hbb >= SOGLIA_4_LATI_MM2;
    const lati = quattroLati ? "4 lati" : "3 lati";
    const superficie = `${((lbb * hbb) / 1_000_000).toFixed(2)} m²`;

    const orizzontali = pick(
      ELEMENTI_ORIZZONTALI, lbb, "L", "tour.orizzontali", "kit elementi orizzontali",
    );
    const braccetto = pick(
      ASTE_CON_BRACCETTO, hbb, "H", "tour.asta", "asta di collegamento verticale",
    );
    const movimenti = pick(
      MOVIMENTI_ANGOLARI, hbb, "H", "tour.movimenti", "kit movimenti angolari",
    );

    const lines: KitLine[] = [
      {
        position: "kit-elementi-orizzontali",
        code: orizzontali.code,
        quantity: 1,
        ruleId: "tour.orizzontali",
        ruleDescription:
          `Kit elementi orizzontali GR${orizzontali.gr} (LBB ${orizzontali.minL}-${orizzontali.maxL}) ` +
          `— comprende l'elemento di collegamento orizzontale e la cremonese, entrata 30 mm`,
      },
    ];

    // ❸ e ❹: una per mano sui 4 lati, la sola SX sui 3. La mano è DERIVATA dal
    // numero di lati: si dichiara nella riga, non si lascia indovinare.
    const mani: { mano: "sx" | "dx"; label: string }[] = quattroLati
      ? [
          { mano: "dx", label: "destra" },
          { mano: "sx", label: "sinistra" },
        ]
      : [{ mano: "sx", label: "sinistra" }];

    for (const { mano, label } of mani)
      lines.push({
        position: `asta-verticale-${mano}`,
        code: ASTA_SENZA_BRACCETTO[mano],
        quantity: 1,
        ruleId: "tour.asta-senza-braccetto",
        ruleDescription:
          `Asta di collegamento verticale senza braccetto, mano ${label} ` +
          `— ferramenta sui ${lati}: mano imposta dallo schema, non scelta`,
      });

    for (const { mano, label } of mani)
      lines.push({
        position: `asta-braccetto-${mano}`,
        code: braccetto[mano],
        quantity: 1,
        ruleId: "tour.asta-con-braccetto",
        ruleDescription:
          `Asta di collegamento verticale con braccetto GR${braccetto.gr} ` +
          `(HBB ${braccetto.minH}-${braccetto.maxH}), mano ${label}`,
      });

    lines.push(
      {
        position: "kit-movimenti-angolari",
        code: quattroLati ? movimenti.quattro : movimenti.tre,
        quantity: 1,
        ruleId: "tour.movimenti",
        ruleDescription:
          `Kit movimenti angolari, ferramenta sui ${lati} (HBB ${movimenti.minH}-${movimenti.maxH}) ` +
          `— superficie ${superficie}`,
      },
      {
        position: "kit-cerniere",
        code: cerniera,
        quantity: 1,
        ruleId: "tour.cerniere",
        ruleDescription:
          `Kit cerniere Tour ${schema.tour}, portata ${schema.portataKg} kg, ${input.finish.trim()} ` +
          `— schema ${input.tourSchema}: ${geometria}`,
      },
      {
        position: "kit-incontri",
        code: `${quattroLati ? "T47702" : "T47701"}.0${input.tourSchema}.00`,
        quantity: 1,
        ruleId: "tour.incontri",
        ruleDescription:
          `Kit incontri schema ${input.tourSchema}, ferramenta sui ${lati} ` +
          `— comprende incontri superiori, inferiori e limitatori di apertura`,
      },
    );

    if (schema.spessori)
      lines.push({
        position: "kit-spessori",
        code: KIT_SPESSORI,
        quantity: 1,
        ruleId: "tour.spessori",
        ruleDescription:
          `Kit spessori 4 mm per cerniera Tour ${schema.tour}, battuta ${schema.battutaMm} ` +
          `— richiesto dallo schema ${input.tourSchema}`,
      });

    lines.push({
      position: "guarnizione",
      code: schema.guarnizione,
      quantity: GUARNIZIONE_CONFEZIONE_M,
      ruleId: "tour.guarnizione",
      ruleDescription:
        `Guarnizione ${schema.guarnizioneDescr} — prezzata al metro, ` +
        `quantità = confezione base ${GUARNIZIONE_CONFEZIONE_M} m`,
    });

    return lines;
  },
};

/** 17,5 va scritto «17,5» in italiano; 15 resta «15», non «15,0». */
function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}
