// Regole kit ARTECH anta-ribalta LEGNO — Fase 1d (ADR 2026-07-04 + emendamento
// 2026-07-04-fase1d-emendamento-legno.md).
// FONTE: Distinta Commerciale AGB 16/11/2021 (struttura/quantità, golden storico
// «ad applicare» ALLUMINIO) + pivot su ARTECH LEGNO (listino 2026, la gamma
// applicare 2021 non esiste più a listino). 15/16 codici verificati a DB in
// Task 0; il supporto-cerniera (riga 11) è stato estratto in Task 2 — vedi
// scratchpad/artech-varianti.txt per il dettaglio completo dell'estrazione.
// Le voci marcate ASSUNZIONE non sono derivabili con certezza dai dati/dalla
// distinta e si correggono alla prossima distinta reale o al listino cartaceo.
//
// 2026-07-29 — CUTOVER DELLA GEOMETRIA. Il modulo non è più cablato su una sola
// combinazione (aria 12 / interasse 13 / battuta 20): la geometria arriva come
// discriminatore `input.geometry` e i codici che ne dipendono vengono da
// `artech-geometrie.ts` (squadra, supporto cerniera, supporto forbice, mid del
// braccio) e da `artech-incontri.ts` (nottolino, ribalta, DSS). Restano qui solo
// le tabelle che il listino NON pubblica per geometria: cremonesi per HBB, corpo
// forbice e gruppi braccio per LBB (selezione dimensionale) e le coperture kit,
// la cui tabella p0488 (486) ha per sole colonne finitura e mano — non sono
// «cablate sul pilota», sono indipendenti dalla geometria per costruzione del
// listino (vedi COPERTURE_KIT). Il golden del pilota (`A12_I13_B20`) è invariato:
// 12 righe / 17 pezzi, 16 / 21 con le chiusure supplementari.
import { pick, linesFromParts, requireKey } from "./kit-shared";
import {
  KitGenerationError,
  PILOT,
  asArtech,
  type ArtechKitInput,
  type KitInput,
  type KitLine,
  type RuleModule,
} from "./types";
import { MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";
import { geometria, assertSeatConfigSupportata, mm } from "./artech-geometrie";
import {
  incontroNottolino,
  incontroRibalta,
  incontroDss,
  formatoIncontro,
} from "./artech-incontri";

type Side = ArtechKitInput["openingSide"];

// ── Tabelle dati ───────────────────────────────────────────────────────────
// ASSUNZIONE: estremi min/max inclusivi su tutti i range (non verificabile
// senza la distinta cartacea; le bande adiacenti si sovrappongono nel
// catalogo — la risoluzione dei bordi condivisi è nella funzione pick()).

/**
 * Cremonese A/R per range altezza-maniglia. VERIFICATA contro p0424 (422),
 * tabella «Cremonesi · Anta ribalta - altezza maniglia fissa», entrata 15:
 * le 9 bande coincidono con il listino (GR02 parte da 610, non da 650 —
 * corretto il 2026-07-25: le altezze 620-659 venivano rifiutate a torto).
 * Escluse .17 («07bis», HBB 1634-1810 ma altezza maniglia 1050 anziché 500, si
 * sovrappone ambiguamente a .07) e .31/.41 (p0425 (423), GR1: selezione per HBB E per
 * LBB, schema diverso). L'esclusione delle .31/.41 lascia scoperto l'intervallo
 * HBB 357-609: domanda 7 per l'esperto in docs/superpowers/kit-assunzioni/legno.md.
 */
const CREMONESI = [
  { minH: 610, maxH: 810, code: "A50122.15.02" },
  { minH: 794, maxH: 1010, code: "A50122.15.03" },
  { minH: 994, maxH: 1210, code: "A50122.15.04" },
  { minH: 1194, maxH: 1410, code: "A50122.15.05" },
  { minH: 1394, maxH: 1610, code: "A50122.15.06" },
  { minH: 1594, maxH: 1810, code: "A50122.15.07" }, // golden
  { minH: 1794, maxH: 2110, code: "A50122.15.08" },
  { minH: 1994, maxH: 2310, code: "A50122.15.09" },
  { minH: 2194, maxH: 2510, code: "A50122.15.10" },
] as const;

/** Corpo forbice (fusto) per range larghezza anta (colonne.lbb di A50510.00.%). */
const FORBICI = [
  { minL: 277, maxL: 490, code: "A50510.00.01" },
  { minL: 476, maxL: 604, code: "A50510.00.02" }, // golden
  { minL: 594, maxL: 804, code: "A50510.00.03" },
  { minL: 794, maxL: 1004, code: "A50510.00.04" },
  { minL: 994, maxL: 1204, code: "A50510.00.05" },
] as const;

/**
 * Gruppo braccio forbice legno per range larghezza (colonne.lbb della famiglia
 * A5191{1=DX,2=SX}.{mid}.0N). Il `mid` — il 2° segmento, che codifica interasse e
 * battuta — NON è qui: lo dà la riga di geometria (`braccioMid`). Questa tabella
 * dichiara solo il GRUPPO di larghezza, che il listino pubblica identico per
 * tutti i mid. Tabella indipendente da FORBICI: i bracci hanno 4 gruppi
 * (277-1204 senza buchi) contro i 5 di FORBICI.
 */
const BRACCI_GRUPPI = [
  { minL: 277, maxL: 490, gruppo: "01" },
  { minL: 476, maxL: 604, gruppo: "02" }, // golden
  { minL: 594, maxL: 804, gruppo: "03" },
  { minL: 794, maxL: 1204, gruppo: "04" },
] as const;

/**
 * Coperture kit per finitura + mano.
 *
 * PERCHÉ NON C'È LA GEOMETRIA, benché il kit copra due pezzi che la geometria
 * cambia (supporto forbice e supporto cerniera). Non è una svista né un residuo
 * del pilota: **il listino non pubblica un asse di geometria per le coperture**.
 * A p0488 (486) la tabella «Kit supporto forbice + supporto cerniera doppia
 * tazza» ha come sole colonne FINITURA e MANO, e l'intera famiglia A51301 ha due
 * soli secondi segmenti in tutte le 959 pagine — `.01` (dx) e `.02` (sx). La
 * stessa copertura veste quindi i supporti di tutte e 7 le righe di
 * `artech-geometrie.ts`, ed è corretto che esca identica su ognuna.
 *
 * ASSUNZIONE residua (questa sì): sono trascritte le sole finiture **ARGENTO**,
 * quella del golden. Le altre non sono indovinate — `requireKey` le rifiuta.
 */
const COPERTURE_KIT: Record<string, Record<Side, string>> = {
  ARGENTO: { SINISTRA: "A51301.02.21", DESTRA: "A51301.01.21" },
};

/**
 * Componenti davvero indipendenti da geometria, dimensioni e mano.
 *
 * Ne sono usciti (2026-07-29) supporto forbice, incontro DSS e incontro ribalta:
 * dipendono tutti e tre dalla geometria e stavano qui cablati sui valori del
 * pilota (A50702.05.00 = aria 12 battuta 20; A51400.05.03 e A51400.05.70 = aria
 * 12 asse 9). Ora sono righe esplicite, prese da `artech-geometrie.ts` e
 * `artech-incontri.ts`. Restare in FISSI significava che un serramento aria 4
 * riceveva in silenzio la ferramenta dell'aria 12.
 */
const FISSI = [
  MOVIMENTO_ANGOLARE,
  {
    position: "perno-supporto-forbice",
    code: "A50790.00.00",
    quantity: 1,
    descr: "Perno per supporto forbice",
  },
] as const;

/** Chiusure supplementari verticali per range altezza (passo 600). */
const CHIUSURE_VERTICALI = [
  // ASSUNZIONE: unica banda validata dal golden (H=1820 → angolo L185 +
  // prolunga L200 + prolunga L600 + terminale L600). Esistono lunghezze
  // adiacenti a listino (terminali/prolunghe 200/400/600/800) ma la regola
  // di composizione per altre fasce di altezza non è derivabile con
  // certezza dai soli codici — richiede la distinta reale o il tecnico AGB.
  {
    minH: 1520,
    maxH: 2120,
    parts: [
      {
        position: "chiusura-angolo",
        code: "A50330.00.00",
        quantity: 1,
        descr: "Angolare verticale chiusura supplementare",
      },
      {
        position: "chiusura-prolunga-200",
        code: "A51801.00.01",
        quantity: 1,
        descr: "Prolunga 200",
      },
      {
        position: "chiusura-prolunga-600",
        code: "A51803.00.03",
        quantity: 1,
        descr: "Prolunga 600",
      },
      {
        position: "chiusura-terminale",
        code: "A50401.00.03",
        quantity: 1,
        descr: "Terminale non rasabile 600",
      },
    ],
  },
] as const;

// ── Modulo ────────────────────────────────────────────────────────────────

export const artechAntaRibaltaLegno: RuleModule = {
  engineId: "artech-ar-legno",
  generate(rawInput: KitInput): KitLine[] {
    // Restringe al ramo ARTECH dell'unione: senza, il modulo vedrebbe l'unione
    // intera e `input.geometry` non esisterebbe.
    const input = asArtech(rawInput);
    // Guardia materiale (emendamento): kitInputSchema resta con enum a 3
    // materiali (Task 1 invariato), ma questo generatore copre solo LEGNO —
    // il pivot 2026 lascia PVC/ALLUMINIO fuori perimetro finché non esiste
    // una distinta reale validata per quelle serie.
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    // La geometria non è più una guardia ma una TABELLA: `geo` porta i codici
    // interi (squadra, supporto cerniera, supporto forbice, mid del braccio) e le
    // quote da stampare in distinta. L'unica combinazione ancora non coperta è la
    // famiglia di schemi «sede 30 mm», che manca dell'incontro DSS 13x30.
    assertSeatConfigSupportata(input.seatConfig);
    const geo = geometria(input.geometry);

    const lines: KitLine[] = [];
    const finish = input.finish.toUpperCase();

    const coperture = requireKey(
      COPERTURE_KIT, finish, "artech.coperture",
      `Finitura "${input.finish}" non disponibile per le coperture ARTECH legno.`,
    );

    // ASSUNZIONE (emendamento): hbb = heightMm - 10 (golden: 1820-10=1810,
    // bordo max incluso in A50122.15.07).
    const cremonese = pick(CREMONESI, input.heightMm - 10, "H", "artech.cremonese", "cremonese");
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese A/R per altezza anta ${input.heightMm} mm (hbb ${input.heightMm - 10})`,
    });

    const forbice = pick(FORBICI, input.widthMm, "L", "artech.forbice", "corpo forbice");
    lines.push({
      position: "forbice-corpo",
      code: forbice.code,
      quantity: 1,
      ruleId: "artech.forbice",
      ruleDescription: `Corpo forbice legno per larghezza anta ${input.widthMm} mm`,
    });

    const braccioGruppo = pick(
      BRACCI_GRUPPI,
      input.widthMm,
      "L",
      "artech.forbice",
      "braccio forbice",
    );
    // UNICA eccezione ammessa alla regola «nessun codice composto per
    // concatenazione» (Global Constraint del piano): il `mid` non è un suffisso
    // inventato, viene dalla riga di geometria, e il gruppo dalla tabella sopra.
    const braccioPrefix = input.openingSide === "DESTRA" ? "A51911" : "A51912";
    lines.push({
      position: "forbice-braccio",
      code: `${braccioPrefix}.${geo.braccioMid}.${braccioGruppo.gruppo}`,
      quantity: 1,
      ruleId: "artech.mano",
      ruleDescription: `Braccio forbice legno battuta ${geo.rebateMm} interasse ${mm(geo.axisOffsetMm)} ${input.openingSide.toLowerCase()} per larghezza ${input.widthMm} mm`,
    });

    lines.push(
      {
        position: "squadra-angolare",
        code: geo.squadraAngolare[input.openingSide],
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Squadra angolare legno aria ${geo.airGapMm} interasse ${mm(geo.axisOffsetMm)} battuta ${geo.rebateMm} ${input.openingSide}`,
      },
      {
        position: "supporto-cerniera",
        code: geo.supportoCerniera[input.openingSide],
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Supporto cerniera parte telaio aria ${geo.airGapMm} battuta ${geo.rebateMm} ${input.openingSide}`,
      },
      {
        position: "coperture-kit",
        code: coperture[input.openingSide],
        quantity: 1,
        ruleId: "artech.coperture",
        ruleDescription: `Kit copertura supporto forbice + supporto cerniera ${finish} ${input.openingSide}`,
      },
    );

    lines.push(...linesFromParts(FISSI, "artech.fissi"));

    lines.push(
      {
        position: "supporto-forbice",
        code: geo.supportoForbice,
        quantity: 1,
        ruleId: "artech.geometria",
        ruleDescription: `Supporto forbice legno aria ${geo.airGapMm} battuta ${geo.rebateMm}`,
      },
      {
        position: "incontro-dss",
        code: incontroDss(input.geometry, input.openingSide),
        quantity: 1,
        ruleId: "artech.incontri",
        // Il formato viene da formatoIncontro(), cioè dalla STESSA chiave() che
        // sceglie il codice: la riga d'ordine non può dichiarare un formato
        // diverso da quello della famiglia emessa. Vedi artech-incontri.ts.
        ruleDescription: `Incontro DSS aria ${geo.airGapMm} ${formatoIncontro(input.geometry)}`,
      },
      {
        position: "incontro-ribalta",
        code: incontroRibalta(input.geometry, input.openingSide),
        quantity: 1,
        ruleId: "artech.incontri",
        ruleDescription: `Incontro ribalta aria ${geo.airGapMm} ${formatoIncontro(input.geometry)}`,
      },
    );

    lines.push({
      position: "incontri-nottolino",
      code: incontroNottolino(input.geometry, input.openingSide),
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription:
        `Incontri nottolino aria ${geo.airGapMm} ${formatoIncontro(input.geometry)}` +
        ` · passo ${PILOT.passoVerticaleMm} mm`,
    });

    // Task 1 (Fase 1g): chiusure supplementari opzionali, default OFF. Il set
    // obbligatorio (12 righe/17 pezzi) non le richiede; solo il toggle ON
    // riproduce la distinta storica (16 righe/21 pezzi) — e con essa il
    // vincolo di banda 1520-2120mm (pick() lancia fuori banda).
    if (input.supplementaryClosures) {
      const verticali = pick(
        CHIUSURE_VERTICALI,
        input.heightMm,
        "H",
        "artech.verticali",
        "chiusure verticali",
      );
      lines.push(...linesFromParts(verticali.parts, "artech.verticali"));
    }

    return lines;
  },
};
