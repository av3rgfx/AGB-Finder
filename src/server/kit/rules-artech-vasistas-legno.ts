// Regole kit ARTECH «vasistas» LEGNO — Fase 1i.
// PROVVISORIO (da validare con l'agente): distinta derivata dallo schema di
// montaggio del listino 2026 (pag.416, «Finestra rettangolare legno - apertura
// vasistas»), anta singola, entrata E.15, variante base. Le voci non derivabili
// con certezza sono marcate ASSUNZIONE. Vedi
// docs/superpowers/kit-assunzioni/vasistas.md.
import { pick } from "./kit-shared";
import { MOVIMENTO_ANGOLARE } from "./artech-legno-shared";
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese vasistas «maniglia variabile/centrale» A50111.15.NN (E.15) per GR,
 * GR scelto per altezza (HBB). Colonne dalla tabella listino (righe 19552-19558):
 * codice + nForbici (NB 19566-19567: GR1-3→1, GR4-6→2) + nNottolini (colonna
 * NOT.). Campo pilota GR01-GR06 (HBB 540-2510); GR00 escluso (n° forbici non
 * definito a listino). ASSUNZIONE: HBB = heightMm (offset 0, come il battente;
 * l'anta-ribalta usa -10). I bordi sovrapposti si risolvono con lo span più
 * stretto in pick() (= GR più basso).
 */
const VASISTAS_CREMONESI = [
  { minH: 540, maxH: 712, gr: 1, code: "A50111.15.11", forbici: 1, nottolini: 0 },
  { minH: 660, maxH: 860, gr: 2, code: "A50111.15.12", forbici: 1, nottolini: 1 },
  { minH: 820, maxH: 1220, gr: 3, code: "A50111.15.13", forbici: 1, nottolini: 1 },
  { minH: 1190, maxH: 1610, gr: 4, code: "A50111.15.14", forbici: 2, nottolini: 2 },
  { minH: 1590, maxH: 2010, gr: 5, code: "A50111.15.15", forbici: 2, nottolini: 2 },
  { minH: 1890, maxH: 2510, gr: 6, code: "A50111.15.16", forbici: 2, nottolini: 4 },
] as const;

/** Movimenti angolari per il vasistas base (ASSUNZIONE: 2, come i moduli gemelli). */
const N_MOVIMENTI = 2;

export const artechVasistasLegno: RuleModule = {
  engineId: "artech-vasistas-legno",
  generate(input: KitInput): KitLine[] {
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto per la vasistas: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    // Guardia superficie ≤ 2 m² (limite stampato sullo schema pag.416).
    const areaM2 = (input.widthMm * input.heightMm) / 1_000_000;
    if (areaM2 > 2)
      throw new KitGenerationError(
        `Superficie ${areaM2.toFixed(2)} m² oltre il massimo di 2 m² per la vasistas.`,
        "artech.superficie",
      );

    const gr = pick(VASISTAS_CREMONESI, input.heightMm, "H", "artech.cremonese", "cremonese vasistas");
    const nForbici = gr.forbici;
    const lines: KitLine[] = [];

    // 1) Cremonese vasistas (maniglia variabile) — per GR/altezza.
    lines.push({
      position: "cremonese",
      code: gr.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese vasistas maniglia variabile GR0${gr.gr} per altezza ${input.heightMm} mm`,
    });

    // 2-3) Catena DSS (ASSUNZIONE): A50111 richiede il DSS ordinato a parte + il suo incontro.
    lines.push(
      {
        position: "dss",
        code: "A50190.00.00",
        quantity: 1,
        ruleId: "artech.dss",
        ruleDescription:
          "DSS ambidestro (ASSUNZIONE: A50111 richiede il DSS ordinato a parte, NB listino 19565)",
      },
      {
        position: "incontro-dss",
        code: "A51400.05.03",
        quantity: 1,
        ruleId: "artech.dss",
        ruleDescription: "Incontro DSS aria 12 (ASSUNZIONE: come anta-ribalta)",
      },
    );

    // 4) Forbici per vasistas (E.15: GR1-3→1, GR4-6→2).
    lines.push({
      position: "forbici-vasistas",
      code: "A50545.00.00",
      quantity: nForbici,
      ruleId: "artech.forbici",
      ruleDescription: `Forbici per vasistas (GR0${gr.gr} → ${nForbici})`,
    });

    // 5-6) Supporto forbice + perno (codici legno condivisi) — uno per forbice.
    lines.push(
      {
        position: "supporto-forbice",
        code: "A50702.05.00",
        quantity: nForbici,
        ruleId: "artech.forbici",
        ruleDescription: "Supporto forbice legno battuta 20 = n. forbici (ASSUNZIONE battuta)",
      },
      {
        position: "perno-supporto-forbice",
        code: "A50790.00.00",
        quantity: nForbici,
        ruleId: "artech.forbici",
        ruleDescription: "Perno per supporto forbice = n. forbici",
      },
    );

    // 7) Terminale per vasistas (ASSUNZIONE: 1 × corsa 18).
    lines.push({
      position: "terminale-vasistas",
      code: "A50193.00.03",
      quantity: 1,
      ruleId: "artech.terminale",
      ruleDescription: "Terminale per vasistas corsa 18 (ASSUNZIONE quantità/corsa)",
    });

    // 8) Movimento angolare (codice condiviso A50302.01.02, quantità propria) +
    // 9) limitatore di corsa 18 mm (= n. movimenti angolari).
    lines.push(
      {
        position: MOVIMENTO_ANGOLARE.position,
        code: MOVIMENTO_ANGOLARE.code,
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: MOVIMENTO_ANGOLARE.descr,
      },
      {
        position: "limitatore-corsa",
        code: "A50196.00.18",
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: "Limitatore di corsa 18 mm = n. movimenti angolari (ASSUNZIONE)",
      },
    );

    // 10) Incontri nottolino — quantità = colonna NOT.(GR) del cremonese (ASSUNZIONE).
    if (gr.nottolini > 0)
      lines.push({
        position: "incontri-nottolino",
        code: "A51400.05.02",
        quantity: gr.nottolini,
        ruleId: "artech.incontri",
        ruleDescription: `Incontri nottolino aria 12 (NOT. GR0${gr.gr} = ${gr.nottolini})`,
      });

    return lines;
  },
};
