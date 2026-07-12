// Regole kit ARTECH anta-ribalta PVC — Fase 1g, Task 3. ⚠️ PROVVISORIO.
//
// FONTE UNICA: listino AGB 2026, tabella di certificazione ift EN 13126-8
// ("Product families ... covered by certification", righe ~604-627 e ~17187-17209).
// Gli schemi 8/9 sono etichettati "ARTech PVC" e forniscono i 4 componenti
// material-specific (colonne DE → slot):
//   Winkelband (top stay connecting part) = braccio forbice → A51921.36.04
//   Scherenlager (stay arm support)       = supporto forbice → A50712.00.00
//   Eckband (corner hinge / FRM)          = squadra angolare → A50922.07.00
//   Ecklager (corner pivot / MAS)         = supporto cerniera → A50812.07.00
//
// NON validato da esperto (revisione prevista). Il resto della distinta NON ha
// uno schema PVC dedicato in questo listino (i capitoli di composizione ARTECH
// sono tutti "legno"; gli incontri PVC rimandano a un "listino PVC e ALLUMINIO"
// separato non disponibile, cfr. listino righe ~36583-36610). Quindi la
// STRUTTURA è ricavata dal modulo LEGNO (rules-artech-legno.ts) e i codici
// condivisi sono riusati con marca ASSUNZIONE. Dettaglio slot-per-slot,
// bande e righe di listino: scratchpad/kit-pvc-assunzioni.md.
import { pick, linesFromParts, requireKey } from "./kit-shared";
import { KitGenerationError, PILOT, type KitInput, type KitLine, type RuleModule } from "./types";

type Side = KitInput["openingSide"];

// ── Tabelle dati ───────────────────────────────────────────────────────────

/**
 * Cremonese A/R per range altezza-maniglia (A50122.15.%).
 * ASSUNZIONE: condiviso col legno — la cremonese è pilotata dall'altezza
 * maniglia, indipendente dal profilo. Bande da listino righe 19452-19461
 * (identiche al modulo legno). Da confermare col listino PVC.
 */
const CREMONESI = [
  { minH: 650, maxH: 810, code: "A50122.15.02" },
  { minH: 794, maxH: 1010, code: "A50122.15.03" },
  { minH: 994, maxH: 1210, code: "A50122.15.04" },
  { minH: 1194, maxH: 1410, code: "A50122.15.05" },
  { minH: 1394, maxH: 1610, code: "A50122.15.06" },
  { minH: 1594, maxH: 1810, code: "A50122.15.07" },
  { minH: 1794, maxH: 2110, code: "A50122.15.08" },
  { minH: 1994, maxH: 2310, code: "A50122.15.09" },
  { minH: 2194, maxH: 2510, code: "A50122.15.10" },
] as const;

/**
 * Corpo forbice (fusto) per range larghezza anta (A50510.00.%).
 * CONDIVISO col legno: il listino lo dichiara "fusto forbice standard
 * A50510.00.xx" (righe 20036-20040 + nota 20134), non profilo-specifico.
 */
const FORBICI = [
  { minL: 277, maxL: 490, code: "A50510.00.01" },
  { minL: 476, maxL: 604, code: "A50510.00.02" },
  { minL: 594, maxL: 804, code: "A50510.00.03" },
  { minL: 794, maxL: 1004, code: "A50510.00.04" },
  { minL: 994, maxL: 1204, code: "A50510.00.05" },
] as const;

/**
 * Gruppo braccio forbice per range larghezza (suffisso .0N).
 * ASSUNZIONE: le bande larghezza→gruppo sono quelle del braccio LEGNO
 * (A5191x, listino righe 20054-20083: 277-490=01 … 794-1204=04). La tabella
 * ift mostra il braccio PVC solo al gruppo .04 (max test size); l'esistenza a
 * catalogo dei gruppi 01-03 PVC è assunta per analogia col legno.
 */
const BRACCI_GRUPPI = [
  { minL: 277, maxL: 490, gruppo: "01" },
  { minL: 476, maxL: 604, gruppo: "02" },
  { minL: 594, maxL: 804, gruppo: "03" },
  { minL: 794, maxL: 1204, gruppo: "04" },
] as const;

/**
 * Prefisso braccio forbice PVC per mano (interasse 13 / battuta 20 = segmento
 * .36, l'unica combinazione della cert ift per il pilota I13/B20).
 * Il braccio LEGNO è A5191{1=DX,2=SX}.36.0N (catalogo). La cert PVC mostra
 * A519**2**1.36.04 (riga 625): la 5ª cifra 1→2 = legno→PVC, mantenendo la 6ª
 * come mano. Da qui DX=A51921, SX=A51922.
 * ASSUNZIONE (moderata): a catalogo compare solo A51921 (DX); A51922 (SX) è
 * dedotto per simmetria col legno — verificare col listino PVC.
 */
const BRACCIO_PREFIX: Record<Side, string> = {
  DESTRA: "A51921", // cert ift schema 8/9, riga 625 (Winkelband)
  SINISTRA: "A51922", // ASSUNZIONE: variante SX per simmetria col legno A51912
};

/** Coperture kit per finitura + mano (A51301.%.21 Argento, righe 22107-22108).
 * ASSUNZIONE: condiviso col legno — nessun kit copertura PVC dedicato a
 * listino; il coperchio (plastica) è verosimilmente profilo-agnostico. */
const COPERTURE_KIT: Record<string, Record<Side, string>> = {
  ARGENTO: { SINISTRA: "A51301.02.21", DESTRA: "A51301.01.21" },
};

/**
 * Componenti material-specific PVC + fissi condivisi (quantità/righe dal
 * modulo legno). I 4 codici PVC vengono dalla cert ift schemi 8/9 (riga 625).
 * Le voci ASSUNZIONE-condiviso riusano i codici legno finché il "listino PVC e
 * ALLUMINIO" (non disponibile) non fornisce gli equivalenti.
 */
const FISSI = [
  {
    position: "movimento-angolare",
    code: "A50302.01.02", // ASSUNZIONE: condiviso col legno (riga 19908, 362-1204 / 440-2510)
    quantity: 2,
    descr: "Movimento angolare 125x125 (ASSUNZIONE: condiviso col legno)",
  },
  {
    position: "supporto-forbice",
    code: "A50712.00.00", // cert ift PVC schema 8/9, riga 625 (Scherenlager)
    quantity: 1,
    descr: "Supporto forbice PVC (cert ift EN 13126-8 schema 8/9)",
  },
  {
    position: "perno-supporto-forbice",
    code: "A50790.00.00", // ASSUNZIONE: condiviso col legno (riga 20462)
    quantity: 1,
    descr: "Perno per supporto forbice (ASSUNZIONE: condiviso col legno)",
  },
  {
    position: "squadra-angolare",
    code: "A50922.07.00", // cert ift PVC schema 8/9, riga 625 (Eckband)
    quantity: 1,
    // ASSUNZIONE: la cert mostra un unico codice .00 (ambidestro?), mentre la
    // squadra LEGNO (A50904.36.01/.02) è mano-dipendente. Handedness PVC non
    // risolvibile dal solo listino: pinnato il .00 della cert, da confermare.
    descr: "Squadra angolare PVC (cert ift schema 8/9; ASSUNZIONE ambidestra)",
  },
  {
    position: "supporto-cerniera",
    code: "A50812.07.00", // cert ift PVC schema 8/9, riga 625 (Ecklager)
    quantity: 1,
    // ASSUNZIONE: come la squadra, la cert dà un unico codice .00; l'equivalente
    // LEGNO (A50801.01.01/.02 / A50805.05) è mano-dipendente. Da confermare.
    descr: "Supporto cerniera PVC (cert ift schema 8/9; ASSUNZIONE ambidestro)",
  },
  {
    position: "incontro-dss",
    code: "A51400.05.03", // ASSUNZIONE: condiviso col legno (riga 21476, "ambidestro")
    quantity: 1,
    descr: "Incontro DSS aria 12 (ASSUNZIONE: condiviso col legno; DSS PVC su listino separato)",
  },
  {
    position: "incontro-ribalta",
    code: "A51400.05.70", // ASSUNZIONE: condiviso col legno (riga 36561)
    quantity: 1,
    descr: "Incontro ribalta aria 12 (ASSUNZIONE: condiviso col legno; ribalta PVC su listino separato)",
  },
] as const;

/**
 * Chiusure supplementari verticali per range altezza (gated su flag).
 * ASSUNZIONE: condivise col legno (stessi codici/banda). Nel listino la banda
 * obbligatoria è "LBB 861÷2510 per HBB>500" (righe 19111 / 23746); qui si
 * riusa la banda altezza 1520-2120 del modulo legno finché la distinta PVC
 * reale non definisce la composizione per fascia.
 */
const CHIUSURE_VERTICALI = [
  {
    minH: 1520,
    maxH: 2120,
    parts: [
      {
        position: "chiusura-angolo",
        code: "A50330.00.00",
        quantity: 1,
        descr: "Angolare verticale chiusura supplementare (ASSUNZIONE: condiviso col legno)",
      },
      {
        position: "chiusura-prolunga-200",
        code: "A51801.00.01",
        quantity: 1,
        descr: "Prolunga 200 (ASSUNZIONE: condiviso col legno)",
      },
      {
        position: "chiusura-prolunga-600",
        code: "A51803.00.03",
        quantity: 1,
        descr: "Prolunga 600 (ASSUNZIONE: condiviso col legno)",
      },
      {
        position: "chiusura-terminale",
        code: "A50401.00.03",
        quantity: 1,
        descr: "Terminale non rasabile 600 (ASSUNZIONE: condiviso col legno)",
      },
    ],
  },
] as const;

// ── Funzioni pure ─────────────────────────────────────────────────────────

/**
 * Numero incontri nottolino perimetrali (A51400.05.02).
 * ASSUNZIONE: stessa formula del legno (2 base + scatti passo 600 in altezza e
 * larghezza). L'incontro nottolino PVC è su listino separato; qui si riusa il
 * codice legno e la formula del pilota. Da validare.
 */
function incontriNottolino(widthMm: number, heightMm: number): number {
  return (
    2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm)
  );
}

// ── Modulo ────────────────────────────────────────────────────────────────

export const artechAntaRibaltaPvc: RuleModule = {
  engineId: "artech-ar-pvc",
  generate(input: KitInput): KitLine[] {
    // Guardia materiale: questo generatore copre solo PVC (dati provvisori da
    // cert ift). LEGNO ha il suo modulo; ALLUMINIO resta fuori perimetro.
    if (input.material !== "PVC")
      throw new KitGenerationError(
        `Materiale "${input.material}" non coperto: il generatore PVC supporta solo PVC.`,
        "artech.materiale",
      );

    const lines: KitLine[] = [];
    const finish = input.finish.toUpperCase();

    const coperture = requireKey(
      COPERTURE_KIT, finish, "artech.coperture",
      `Finitura "${input.finish}" non disponibile per le coperture ARTECH PVC.`,
    );

    // ASSUNZIONE: hbb = heightMm - 10 (come nel modulo legno).
    const cremonese = pick(CREMONESI, input.heightMm - 10, "H", "artech.cremonese", "cremonese");
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese A/R per altezza anta ${input.heightMm} mm (hbb ${input.heightMm - 10}, ASSUNZIONE: condiviso col legno)`,
    });

    const forbice = pick(FORBICI, input.widthMm, "L", "artech.forbice", "corpo forbice");
    lines.push({
      position: "forbice-corpo",
      code: forbice.code,
      quantity: 1,
      ruleId: "artech.forbice",
      ruleDescription: `Corpo forbice standard per larghezza anta ${input.widthMm} mm (condiviso col legno)`,
    });

    const braccioGruppo = pick(BRACCI_GRUPPI, input.widthMm, "L", "artech.forbice", "braccio forbice");
    lines.push({
      position: "forbice-braccio",
      code: `${BRACCIO_PREFIX[input.openingSide]}.36.${braccioGruppo.gruppo}`,
      quantity: 1,
      ruleId: "artech.mano",
      ruleDescription: `Braccio forbice PVC battuta 20 interasse 13 ${input.openingSide.toLowerCase()} per larghezza ${input.widthMm} mm (cert ift; SX per simmetria)`,
    });

    lines.push(...linesFromParts(FISSI, "artech.fissi"));

    lines.push({
      position: "coperture-kit",
      code: coperture[input.openingSide],
      quantity: 1,
      ruleId: "artech.coperture",
      ruleDescription: `Kit copertura supporto forbice + supporto cerniera ${finish} ${input.openingSide} (ASSUNZIONE: condiviso col legno)`,
    });

    lines.push({
      position: "incontri-nottolino",
      code: "A51400.05.02", // ASSUNZIONE: condiviso col legno (riga 21291)
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: `Incontri nottolino sede ${input.seatMm} aria ${input.airGapMm} (passo ${PILOT.passoVerticaleMm} mm, ASSUNZIONE: condiviso col legno)`,
    });

    // Chiusure supplementari opzionali (default OFF), come nel modulo legno.
    if (input.supplementaryClosures) {
      const verticali = pick(
        CHIUSURE_VERTICALI, input.heightMm, "H", "artech.verticali", "chiusure verticali",
      );
      lines.push(...linesFromParts(verticali.parts, "artech.verticali"));
    }

    return lines;
  },
};
