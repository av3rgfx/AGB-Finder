// Regole kit ARTECH «anta a battente» LEGNO — Fase 1h.
// PROVVISORIO (da validare con l'agente): distinta derivata dal listino 2026
// (cremonese Mod. 502 A50200.15.NN, righe ~19659) + le famiglie legno condivise
// con l'anta-ribalta (artech-legno-shared), MENO il meccanismo di ribalta
// (forbice, supporto forbice, perno, incontro ribalta, DSS). Le voci non
// derivabili con certezza sono marcate ASSUNZIONE. Vedi
// docs/superpowers/kit-assunzioni/battente.md.
import { pick, linesFromParts } from "./kit-shared";
import { PER_MANO, MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";
import { KitGenerationError, PILOT, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese «anta a battente» Mod. 502 per range altezza (famiglia A50200.15.NN,
 * listino 2026). Stessa struttura della cremonese anta-ribalta (A50122.15.NN) ma
 * famiglia distinta. ASSUNZIONE: selezione per heightMm sui range di listino
 * (offset da confermare con l'agente; i bordi condivisi si risolvono con lo span
 * più stretto in pick()).
 */
const BATTENTE_CREMONESI = [
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
  generate(input: KitInput): KitLine[] {
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto per l'anta a battente: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    const lines: KitLine[] = [];

    // Cremonese a battente Mod. 502 (ASSUNZIONE: selezione per altezza anta).
    const cremonese = pick(
      BATTENTE_CREMONESI,
      input.heightMm,
      "H",
      "artech.cremonese",
      "cremonese a battente",
    );
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese anta a battente Mod. 502 per altezza anta ${input.heightMm} mm`,
    });

    // Cerniere per mano (condivise col legno anta-ribalta — ASSUNZIONE battente).
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
        ruleDescription: `Supporto cerniera parte telaio ${input.openingSide} (ASSUNZIONE condivisa con anta-ribalta)`,
      },
    );

    // Movimento angolare (fisso, condiviso).
    lines.push(...linesFromParts([MOVIMENTO_ANGOLARE], "artech.fissi"));

    // Incontri nottolino perimetrali (formula condivisa — ASSUNZIONE per battente).
    lines.push({
      position: "incontri-nottolino",
      code: "A51400.05.02",
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: `Incontri nottolino sede ${input.seatMm} aria ${input.airGapMm} (passo ${PILOT.passoVerticaleMm} mm)`,
    });

    return lines;
  },
};
