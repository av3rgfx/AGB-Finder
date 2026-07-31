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
  entrataLabel,
  type ArtechKitInput,
  type Entrata,
  type KitInput,
  type KitLine,
  type RuleModule,
} from "./types";
import { incontriNottolino } from "./artech-legno-shared";
import { geometria, assertSeatConfigSupportata, mm } from "./artech-geometrie";
// Dal file FOGLIA, non da `artech-varianti.ts`: questo import è codice nuovo di
// questo task e può puntare direttamente alla foglia, senza passare per il
// registro (che non aggiunge nulla per `VARIANTE_IDS`, solo un arco in più).
import { VARIANTE_IDS } from "./varianti-schema";
import { incontroDss, formatoIncontro } from "./artech-incontri";
// Task 5: il registro delle varianti componente. `squadraAngolare`,
// `incontroRibaltaVariante` e `incontroNottolinoVariante` sostituiscono le
// funzioni equivalenti di `artech-incontri.ts`/il campo `geo.squadraAngolare`
// come sorgente del CODICE — con `undefined` restituiscono esattamente lo
// stesso codice di prima (default = "lo standard del programma").
// Rilievo 2 (review Task 5): le `*EtichettaSeNonStandard` decidono — dentro il
// registro, dove vivono i default — se la descrizione deve nominare la
// variante. Il modulo le chiama e basta: non confronta scelte con default.
import {
  squadraAngolare,
  squadraAngolareEtichettaSeNonStandard,
  incontroRibaltaVariante,
  incontroRibaltaEtichettaSeNonStandard,
  incontroNottolinoVariante,
  incontroNottolinoEtichettaSeNonStandard,
  movimentoAngolareCodice,
  movimentoAngolareEtichettaSeNonStandard,
  piastrinoCodice,
} from "./artech-varianti";

/**
 * Compone la descrizione base con l'etichetta della variante, SOLO quando
 * `etichetta` non è `undefined` (cioè quando la scelta differisce dallo
 * standard). Con `etichetta` sempre `undefined` — nessuna variante scelta, o
 * scelta uguale allo standard — il risultato è carattere per carattere
 * `base`: è il vincolo che tiene ferme le 16 `ruleDescription` del golden.
 */
function conVariante(base: string, etichetta: string | undefined): string {
  return etichetta === undefined ? base : `${base} · variante: ${etichetta}`;
}

type Side = ArtechKitInput["openingSide"];

// ── Tabelle dati ───────────────────────────────────────────────────────────
// ASSUNZIONE: estremi min/max inclusivi su tutti i range (non verificabile
// senza la distinta cartacea; le bande adiacenti si sovrappongono nel
// catalogo — la risoluzione dei bordi condivisi è nella funzione pick()).

/**
 * Cremonese A/R per entrata × banda di altezza-maniglia. VERIFICATA contro
 * `p0424 (422)`, tabella «Cremonesi · Anta ribalta - altezza maniglia fissa»:
 * le nove bande HBB, i GR e l'altezza maniglia sono **identici** fra le due
 * entrate — cambia il codice e cambia il prezzo (GR07: 16,03 € contro 22,12 €).
 *
 * CODICI INTERI, MAI COMPOSTI. `A50122.${entrata}.${gr}` sarebbe regolarissimo
 * qui e sbagliato altrove: la cremonese vasistas pubblica 6 gruppi per l'entrata
 * 7,5 contro i 9 dell'anta-ribalta, quindi la composizione genererebbe
 * `A50111.08.10`, che non esiste. È la regola della PR #39.
 *
 * Escluse per entrambe le entrate, e per le ragioni già note: `.17` («07bis»,
 * altezza maniglia 1050 che si sovrappone ambiguamente al `.07`) e `.31`/`.41`
 * di `p0425 (423)`, che si selezionano per HBB E per LBB. L'esclusione delle
 * `.31`/`.41` lascia scoperto l'intervallo HBB 357-609 (domanda 7).
 *
 * ASIMMETRIA DICHIARATA (domanda 27): al GR03 l'entrata 7,5 ha `NOT. −` dove la
 * 15 ha `1`, con nota che nelle DUE ANTE serve l'asta a leva `A51504.19.13`.
 * Questo motore genera anta singola, quindi nessun codice cambia.
 */
const CREMONESI: Record<Entrata, readonly { minH: number; maxH: number; code: string }[]> = {
  E15: [
    { minH: 610, maxH: 810, code: "A50122.15.02" },
    { minH: 794, maxH: 1010, code: "A50122.15.03" },
    { minH: 994, maxH: 1210, code: "A50122.15.04" },
    { minH: 1194, maxH: 1410, code: "A50122.15.05" },
    { minH: 1394, maxH: 1610, code: "A50122.15.06" },
    { minH: 1594, maxH: 1810, code: "A50122.15.07" }, // golden
    { minH: 1794, maxH: 2110, code: "A50122.15.08" },
    { minH: 1994, maxH: 2310, code: "A50122.15.09" },
    { minH: 2194, maxH: 2510, code: "A50122.15.10" },
  ],
  E75: [
    { minH: 610, maxH: 810, code: "A50122.08.02" },
    { minH: 794, maxH: 1010, code: "A50122.08.03" },
    { minH: 994, maxH: 1210, code: "A50122.08.04" },
    { minH: 1194, maxH: 1410, code: "A50122.08.05" },
    { minH: 1394, maxH: 1610, code: "A50122.08.06" },
    { minH: 1594, maxH: 1810, code: "A50122.08.07" },
    { minH: 1794, maxH: 2110, code: "A50122.08.08" },
    { minH: 1994, maxH: 2310, code: "A50122.08.09" },
    { minH: 2194, maxH: 2510, code: "A50122.08.10" },
  ],
};

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
 * Componenti davvero indipendenti da geometria, dimensioni, mano E varianti.
 *
 * Ne sono usciti (2026-07-29) supporto forbice, incontro DSS e incontro ribalta:
 * dipendono tutti e tre dalla geometria e stavano qui cablati sui valori del
 * pilota (A50702.05.00 = aria 12 battuta 20; A51400.05.03 e A51400.05.70 = aria
 * 12 asse 9). Ora sono righe esplicite, prese da `artech-geometrie.ts` e
 * `artech-incontri.ts`. Restare in FISSI significava che un serramento aria 4
 * riceveva in silenzio la ferramenta dell'aria 12.
 *
 * Ne è uscito anche (2026-07-31, Task 5) il movimento angolare: non è più
 * fisso, è una VARIANTE (`v.movimentoAngolare`, un nottolino o due). La riga è
 * spinta esplicitamente in `generate()`, nella stessa posizione in cui
 * `linesFromParts(FISSI, …)` la emetteva: l'ordine delle righe è parte della
 * firma della distinta, e non può muoversi.
 */
const FISSI = [
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
  varianti: VARIANTE_IDS,
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
    // Task 5: `undefined` è "lo standard del programma" (registro
    // `artech-varianti.ts`), non "niente" — il default vive nel registro, mai
    // materializzato qui.
    const v = input.variants ?? {};

    const lines: KitLine[] = [];
    const finish = input.finish.toUpperCase();

    const coperture = requireKey(
      COPERTURE_KIT, finish, "artech.coperture",
      `Finitura "${input.finish}" non disponibile per le coperture ARTECH legno.`,
    );

    // ASSUNZIONE (emendamento): hbb = heightMm - 10 (golden: 1820-10=1810,
    // bordo max incluso in A50122.15.07). Vale per entrambe le entrate: le bande
    // sono identiche.
    const cremonese = pick(
      CREMONESI[input.entrata], input.heightMm - 10, "H", "artech.cremonese", "cremonese",
    );
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription:
        `Cremonese A/R entrata ${entrataLabel(input.entrata)} per altezza anta ` +
        `${input.heightMm} mm (hbb ${input.heightMm - 10})`,
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
        code: squadraAngolare(input.geometry, input.openingSide, v.squadraAngolare),
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: conVariante(
          `Squadra angolare legno aria ${geo.airGapMm} interasse ${mm(geo.axisOffsetMm)} battuta ${geo.rebateMm} ${input.openingSide}`,
          squadraAngolareEtichettaSeNonStandard(input.geometry, v.squadraAngolare),
        ),
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

    // ORDINE: spinta qui, esattamente dove `linesFromParts(FISSI, …)` emetteva
    // il movimento angolare quando era ancora il primo elemento di FISSI — la
    // firma della distinta include l'ordine delle righe.
    lines.push({
      position: "movimento-angolare",
      code: movimentoAngolareCodice(v.movimentoAngolare),
      quantity: 2,
      ruleId: "artech.fissi",
      ruleDescription: conVariante(
        "Movimento angolare 125x125",
        movimentoAngolareEtichettaSeNonStandard(v.movimentoAngolare),
      ),
    });
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
        code: incontroRibaltaVariante(input.geometry, input.openingSide, v.incontroRibalta),
        quantity: 1,
        ruleId: "artech.incontri",
        ruleDescription: conVariante(
          `Incontro ribalta aria ${geo.airGapMm} ${formatoIncontro(input.geometry)}`,
          incontroRibaltaEtichettaSeNonStandard(input.geometry, v.incontroRibalta),
        ),
      },
    );

    lines.push({
      position: "incontri-nottolino",
      code: incontroNottolinoVariante(input.geometry, input.openingSide, v.incontroNottolino),
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: conVariante(
        `Incontri nottolino aria ${geo.airGapMm} ${formatoIncontro(input.geometry)}` +
          ` · passo ${PILOT.passoVerticaleMm} mm`,
        incontroNottolinoEtichettaSeNonStandard(v.incontroNottolino),
      ),
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

    // Riga AGGIUNTA, non sostituita: è la ragione per cui l'antieffrazione non
    // è una «variante» nel senso della spec §2. FONTE: p0432 (430).
    if (v.piastrinoAntieffrazione === true)
      lines.push({
        position: "piastrino-antieffrazione",
        code: piastrinoCodice(input.entrata),
        quantity: 1,
        ruleId: "artech.varianti",
        ruleDescription: `Piastrino antieffrazione entrata ${entrataLabel(input.entrata)}`,
      });

    return lines;
  },
};
