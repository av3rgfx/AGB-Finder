// Regole kit ARTECH «anta a battente» LEGNO — DISATTIVATO 2026-07-25.
//
// ⚠️ NON DISPONIBILE. La verifica sul listino AGB 2026 ha mostrato che la
// distinta generata era STRUTTURALMENTE INCOMPLETA: lo schema di montaggio
// p0416 (414) «Finestra rettangolare legno - anta singola, apertura a battente»
// elenca 21 voci, il modulo ne generava 5. Mancavano in particolare:
//   · voce 5  «Cerniere per seconda anta » Corpo articolazione superiore»
//   · voce 6  «Cerniere per seconda anta » Articolazione superiore anta semifissa»
//   · voci 8-9 «Supporti Forbice» + «Perno per supporto forbice»
// cioè l'intero appoggio della cerniera SUPERIORE: l'anta non aveva alcun punto
// di sospensione in alto. Distinta non montabile né ordinabile.
//
// Non è correggibile dal solo listino: lo schema p0416 (414) è COMPOSITO. Nello stesso
// disegno convivono la cremonese a battente (voce 1, mod. 502), voci
// dell'anta-ribalta (voce 2 cremonese A/R, voce 3 DSS, voce 13 incontro ribalta)
// e TRE alternative di cerniera — «per seconda anta» (5-6), «centrali a
// scomparsa» (15-16), «centrale registrabile portante» (17). Quale terna
// appartenga alla configurazione «anta singola a battente» è la domanda 1 in
// docs/superpowers/kit-assunzioni/battente.md.
//
// CONSERVATO: BATTENTE_CREMONESI è VERIFICATA contro p0429 (427) — le 10 bande
// HBB e i codici coincidono esattamente con il listino, e la famiglia è
// confermata dalla legenda dello schema («Anta a bandiera - mod. 502»). È il
// punto di ripartenza quando arriva la risposta dell'esperto.
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese «anta a battente» Mod. 502 per range altezza HBB.
 * VERIFICATA contro il listino p0429 (427), tabella «Cremonesi · Anta a battente
 * - Mod. 502 per finestra e porta finestra a 1 anta», entrata 15: bande e codici
 * identici. La colonna NOT. del listino vale 2/2/2/3/3/3/3/4/4/4.
 */
export const BATTENTE_CREMONESI = [
  { minH: 360, maxH: 610, code: "A50200.15.01" },
  { minH: 600, maxH: 810, code: "A50200.15.02" },
  { minH: 800, maxH: 1010, code: "A50200.15.03" },
  { minH: 1000, maxH: 1210, code: "A50200.15.04" },
  { minH: 1200, maxH: 1410, code: "A50200.15.05" },
  { minH: 1400, maxH: 1610, code: "A50200.15.06" },
  { minH: 1600, maxH: 1810, code: "A50200.15.07" },
  { minH: 1800, maxH: 2110, code: "A50200.15.08" },
  { minH: 2000, maxH: 2310, code: "A50200.15.09" },
  { minH: 2200, maxH: 2510, code: "A50200.15.10" },
] as const;

export const artechAntaBattenteLegno: RuleModule = {
  engineId: "artech-batt-legno",
  generate(_input: KitInput): KitLine[] {
    throw new KitGenerationError(
      "Kit anta a battente non disponibile: la distinta sarebbe priva del gruppo di sospensione superiore " +
        "(corpo articolazione, articolazione superiore anta semifissa, supporti forbice). " +
        "Lo schema di listino p0416 (414) mostra tre alternative di cerniere e non indica quale valga per l'anta singola a battente: " +
        "in attesa di conferma da AGB.",
      "artech.tipologia",
    );
  },
};
