// Regole kit ARTECH anta-ribalta LEGNO — Fase 1d (ADR 2026-07-04 + emendamento
// 2026-07-04-fase1d-emendamento-legno.md).
// FONTE: Distinta Commerciale AGB 16/11/2021 (struttura/quantità, golden storico
// «ad applicare» ALLUMINIO) + pivot su ARTECH LEGNO (listino 2026, la gamma
// applicare 2021 non esiste più a listino). 15/16 codici verificati a DB in
// Task 0; il supporto-cerniera (riga 11) è stato estratto in Task 2 — vedi
// scratchpad/artech-varianti.txt per il dettaglio completo dell'estrazione.
// Le voci marcate ASSUNZIONE non sono derivabili con certezza dai dati/dalla
// distinta e si correggono alla prossima distinta reale o al listino cartaceo.
import { KitGenerationError, PILOT, type KitInput, type KitLine, type RuleModule } from "./types";

type Side = KitInput["openingSide"];

// ── Tabelle dati ───────────────────────────────────────────────────────────
// ASSUNZIONE: estremi min/max inclusivi su tutti i range (non verificabile
// senza la distinta cartacea; le bande adiacenti si sovrappongono nel
// catalogo — la risoluzione dei bordi condivisi è nella funzione pick()).

/**
 * Cremonese A/R per range altezza-maniglia (colonne.hbb di A50122.15.%).
 * Solo la progressione "per schema A" a maniglia 500/1050 coerente col
 * golden (gruppi 02-10); escluse .17 (gr "07bis", variante a maniglia 1050
 * che sovrappone ambiguamente .07) e .31/.41 (schema diverso, selezione per
 * larghezza "lbb" non per altezza "hbb").
 */
const CREMONESI = [
  { minH: 650, maxH: 810, code: "A50122.15.02" },
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

/**
 * Componenti dipendenti da mano, interasse 13/battuta 20 (I13 B20 = golden,
 * unica combinazione validata). Suffissi: .01 = DX, .02 = SX.
 */
const PER_MANO: Record<Side, { squadraAngolare: string; supportoCerniera: string }> = {
  SINISTRA: {
    squadraAngolare: "A50904.36.02", // "INTERASSE 13 SX" (aria 12, battuta 20)
    supportoCerniera: "A50801.01.02", // ASSUNZIONE — vedi commento sotto
  },
  DESTRA: {
    squadraAngolare: "A50904.36.01",
    supportoCerniera: "A50801.01.01",
  },
};

/**
 * ASSUNZIONE (gap di catalogo, riga "supporto-cerniera" dell'emendamento):
 * nel listino 2026 la famiglia "Supporto cerniera ... - Parte telaio"
 * (sottocategoria Artech · Cerniere - Legno) esiste SOLO in due varianti,
 * entrambe "Aria 4": A50801 (interasse 9, battuta 18) e A50803 (interasse
 * 8,5, battuta 15). Nessuna copre aria 12/interasse 13/battuta 20 (i
 * parametri del golden). Si pinna A50801 perché più vicino ai parametri
 * golden su entrambi gli assi di confronto (battuta 18 vs 15, interasse 9 vs
 * 8,5) rispetto ad A50803. Verificare col listino cartaceo/prossima distinta
 * reale: potrebbe mancare a catalogo un codice interasse13/battuta20 dedicato.
 */

/** Coperture kit per finitura + mano (golden: ARGENTO). */
const COPERTURE_KIT: Record<string, Record<Side, string>> = {
  ARGENTO: { SINISTRA: "A51301.02.21", DESTRA: "A51301.01.21" },
};

/** Componenti fissi del sistema (indipendenti da dimensioni e mano). */
const FISSI = [
  {
    position: "movimento-angolare",
    code: "A50302.01.02",
    quantity: 2,
    descr: "Movimento angolare 125x125",
  },
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
  // DX/SX (unica riga in DB, "13x24 viti dritte"), a differenza del vecchio
  // A514SX/DX.05.65 del 2021.
  {
    position: "incontro-ribalta",
    code: "A51400.05.70",
    quantity: 1,
    descr: "Incontro ribalta aria 12 (13x24 viti dritte, ambidestro)",
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

// ── Funzioni pure ─────────────────────────────────────────────────────────

/**
 * Numero incontri nottolino perimetrali (A51400.05.02).
 *
 * L'emendamento propone di verificare PRIMA l'ipotesi data-driven "somma dei
 * colonne.'not.' dei componenti mobili selezionati" (cremonese + movimenti +
 * forbice). Verificata sui dati reali 2026 NON regge: cremonese A50122.15.07
 * ha not.=2, movimento A50302.01.02 ha not.=1 (quantità 2), ma il fusto
 * forbice A50510.00.02 ha not.="-" (nessun valore, non "1" come ipotizzato).
 * Somma pesata per quantità: 2 + (1×2) + 0 = 4 ≠ 5 atteso dal golden.
 * Si usa quindi (per l'esplicita alternativa prevista dall'emendamento) la
 * formula ASSUNZIONE del piano originale, che riproduce esattamente 5:
 * 2 (base) + scatti passo 600 in altezza + scatti passo 600 in larghezza.
 */
function incontriNottolino(widthMm: number, heightMm: number): number {
  return (
    2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm)
  );
}

/**
 * Sceglie la riga di tabella il cui range [min,max] contiene `value`.
 * ASSUNZIONE: le bande del catalogo 2026 si sovrappongono deliberatamente ai
 * bordi (es. forbice gruppo 02 "476-604" e gruppo 03 "594-804" condividono
 * 594-604); a parità di match vince la banda più STRETTA (span minore), cioè
 * la più specifica — es. il gruppo 02 (span 128mm) vince su entrambi i
 * confini condivisi con i gruppi 01 (span 213mm) e 03 (span 210mm).
 */
function pick<T extends { minH?: number; maxH?: number; minL?: number; maxL?: number }>(
  table: readonly T[],
  value: number,
  kind: "H" | "L",
  ruleId: string,
  label: string,
): T {
  let best: T | undefined;
  let bestSpan = Infinity;
  for (const row of table) {
    const min = kind === "H" ? (row.minH ?? 0) : (row.minL ?? 0);
    const max = kind === "H" ? (row.maxH ?? Infinity) : (row.maxL ?? Infinity);
    if (value < min || value > max) continue;
    const span = max - min;
    if (span < bestSpan) {
      best = row;
      bestSpan = span;
    }
  }
  if (!best)
    throw new KitGenerationError(
      `Nessuna variante ${label} per ${kind === "H" ? "altezza" : "larghezza"} ${value} mm: fuori campo di applicazione ARTECH legno.`,
      ruleId,
    );
  return best;
}

// ── Modulo ────────────────────────────────────────────────────────────────

export const artechAntaRibaltaLegno: RuleModule = {
  engineId: "artech-ar-legno",
  generate(input: KitInput): KitLine[] {
    // Guardia materiale (emendamento): kitInputSchema resta con enum a 3
    // materiali (Task 1 invariato), ma questo generatore copre solo LEGNO —
    // il pivot 2026 lascia PVC/ALLUMINIO fuori perimetro finché non esiste
    // una distinta reale validata per quelle serie.
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    const lines: KitLine[] = [];
    const finish = input.finish.toUpperCase();

    const coperture = COPERTURE_KIT[finish];
    if (!coperture)
      throw new KitGenerationError(
        `Finitura "${input.finish}" non disponibile per le coperture ARTECH legno.`,
        "artech.coperture",
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
        ruleDescription: `Supporto cerniera parte telaio ${input.openingSide} (ASSUNZIONE: nessuna variante aria 12/interasse 13/battuta 20 a listino 2026, pinnato il più vicino disponibile)`,
      },
      {
        position: "coperture-kit",
        code: coperture[input.openingSide],
        quantity: 1,
        ruleId: "artech.coperture",
        ruleDescription: `Kit copertura supporto forbice + supporto cerniera ${finish} ${input.openingSide}`,
      },
    );

    for (const part of FISSI)
      lines.push({
        position: part.position,
        code: part.code,
        quantity: part.quantity,
        ruleId: "artech.fissi",
        ruleDescription: part.descr,
      });

    lines.push({
      position: "incontri-nottolino",
      code: "A51400.05.02",
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: `Incontri nottolino sede ${input.seatMm} aria ${input.airGapMm} (passo ${PILOT.passoVerticaleMm} mm)`,
    });

    const verticali = pick(
      CHIUSURE_VERTICALI,
      input.heightMm,
      "H",
      "artech.verticali",
      "chiusure verticali",
    );
    for (const part of verticali.parts)
      lines.push({
        position: part.position,
        code: part.code,
        quantity: part.quantity,
        ruleId: "artech.verticali",
        ruleDescription: part.descr,
      });

    return lines;
  },
};
