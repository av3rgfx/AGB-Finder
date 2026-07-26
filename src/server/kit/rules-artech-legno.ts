// Regole kit ARTECH anta-ribalta LEGNO — Fase 1d (ADR 2026-07-04 + emendamento
// 2026-07-04-fase1d-emendamento-legno.md).
// FONTE: Distinta Commerciale AGB 16/11/2021 (struttura/quantità, golden storico
// «ad applicare» ALLUMINIO) + pivot su ARTECH LEGNO (listino 2026, la gamma
// applicare 2021 non esiste più a listino). 15/16 codici verificati a DB in
// Task 0; il supporto-cerniera (riga 11) è stato estratto in Task 2 — vedi
// scratchpad/artech-varianti.txt per il dettaglio completo dell'estrazione.
// Le voci marcate ASSUNZIONE non sono derivabili con certezza dai dati/dalla
// distinta e si correggono alla prossima distinta reale o al listino cartaceo.
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
import {
  PER_MANO,
  MOVIMENTO_ANGOLARE,
  incontriNottolino,
  assertPilotGeometry,
} from "./artech-legno-shared";

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
 * Gruppo braccio forbice legno per range larghezza (colonne.lbb della
 * famiglia A5191{1=DX,2=SX}.36.0N — interasse 13/battuta 20, l'unica
 * combinazione validata dal golden I13/B20). Tabella indipendente da FORBICI:
 * i bracci hanno 4 gruppi (277-1204 senza buchi) contro i 5 di FORBICI.
 */
const BRACCI_GRUPPI = [
  { minL: 277, maxL: 490, gruppo: "01" },
  { minL: 476, maxL: 604, gruppo: "02" }, // golden
  { minL: 594, maxL: 804, gruppo: "03" },
  { minL: 794, maxL: 1204, gruppo: "04" },
] as const;

// Il supporto cerniera non è più un'ASSUNZIONE: la variante «Aria 12 -
// Interasse 9/13 - Parte telaio» battuta 20 esiste a listino, p0451 (449), ed è
// A50805.05.DX/.SX — vedi il commento di PER_MANO in artech-legno-shared.ts.

/** Coperture kit per finitura + mano (golden: ARGENTO). */
const COPERTURE_KIT: Record<string, Record<Side, string>> = {
  ARGENTO: { SINISTRA: "A51301.02.21", DESTRA: "A51301.01.21" },
};

/** Componenti fissi del sistema (indipendenti da dimensioni e mano). */
const FISSI = [
  MOVIMENTO_ANGOLARE,
  {
    position: "supporto-forbice",
    code: "A50702.05.00",
    quantity: 1,
    descr: "Supporto forbice legno aria 12 - interasse 9/13, battuta 20",
  },
  {
    position: "perno-supporto-forbice",
    code: "A50790.00.00",
    quantity: 1,
    descr: "Perno per supporto forbice",
  },
  { position: "incontro-dss", code: "A51400.05.03", quantity: 1, descr: "Incontro DSS aria 12" },
  // ASSUNZIONE (emendamento): l'incontro ribalta 2026 non ha più varianti
  // DX/SX (unica riga in DB), a differenza del vecchio A514SX/DX.05.65 del 2021.
  // A51400.05.70 = «Incontri Ribalta · Aria 12 · ZAMA · 9x18 viti dritte», p0471
  // (469). La descrizione diceva «13x24»: era il formato di A51400.CR.70, stesso
  // prezzo. Il kit è oggi tutto su asse 9 per gli incontri e interasse 13 per
  // bracci/squadre/cerniere: domanda 3 (punto b) per l'esperto in
  // docs/superpowers/kit-assunzioni/legno.md.
  {
    position: "incontro-ribalta",
    code: "A51400.05.70",
    quantity: 1,
    descr: "Incontro ribalta aria 12 (9x18 viti dritte, ambidestro)",
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
    // Restringe al ramo ARTECH dell'unione: il corpo sotto è invariato.
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

    // Guardia geometria: le tabelle sotto sono cablate su aria 12 / interasse 13
    // / battuta 20 / sede 18. Senza questa riga un'altra combinazione riceveva
    // in silenzio i codici del pilota.
    assertPilotGeometry(input);

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
    const braccioPrefix = input.openingSide === "DESTRA" ? "A51911" : "A51912";
    lines.push({
      position: "forbice-braccio",
      code: `${braccioPrefix}.36.${braccioGruppo.gruppo}`,
      quantity: 1,
      ruleId: "artech.mano",
      ruleDescription: `Braccio forbice legno battuta 20 interasse 13 ${input.openingSide.toLowerCase()} per larghezza ${input.widthMm} mm`,
    });

    const mano = PER_MANO[input.openingSide];
    lines.push(
      {
        position: "squadra-angolare",
        code: mano.squadraAngolare,
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Squadra angolare legno aria ${input.airGapMm} interasse ${input.axisOffsetMm} battuta ${input.rebateMm} ${input.openingSide}`,
      },
      {
        position: "supporto-cerniera",
        code: mano.supportoCerniera,
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Supporto cerniera parte telaio aria ${input.airGapMm} interasse 9/13 battuta ${input.rebateMm} ${input.openingSide}`,
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

    lines.push({
      position: "incontri-nottolino",
      code: "A51400.05.02",
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: `Incontri nottolino sede ${input.seatMm} aria ${input.airGapMm} (passo ${PILOT.passoVerticaleMm} mm)`,
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
