// Regole kit ARTECH anta-ribalta ALLUMINIO — Fase 1g, Task 4.
//
// ⚠️ NON DISPONIBILE (decisione utente 2026-07-11, opzione "b" = gate).
// Il listino AGB 2026 disponibile NON contiene una composizione ALLUMINIO per
// anta-ribalta ARTECH. L'unica famiglia "A529xx" del listino è «ARTech PLANA»
// (righe ~616-624, 17204 "PLANA Legno", 17207 "PLANA PVC", 22757+ "Artech Plana
// legno"): è un sistema di CERNIERE COMPLANARI (a filo) per serramenti in
// LEGNO/PVC, NON per alluminio, e con struttura diversa dal pilota (braccio
// A52911 a segmenti .02/.10 anziché .36, squadra A52900, cerniera A52901, e
// NESSUN supporto forbice — colonna "-" in tabella cert). Quindi l'assunzione
// "ALLUMINIO ≈ PLANA" del piano è FALSIFICATA: non ci sono dati alluminio
// affidabili da cui derivare una distinta deterministica.
//
// Finché non arriva il listino PVC/ALLUMINIO dedicato + la validazione
// dell'esperto (domande pronte in docs/superpowers/kit-assunzioni/alu.md),
// questo modulo RIFIUTA esplicitamente, e il KitTemplate ALLUMINIO è seedato
// con isActive=false (il KitEngine non lo seleziona: input ALLUMINIO → "Nessun
// template kit attivo"). Per abilitare: popolare le regole reali qui + flippare
// isActive a true + bump version.
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

export const artechAntaRibaltaAlu: RuleModule = {
  engineId: "artech-ar-alu",
  generate(_input: KitInput): KitLine[] {
    throw new KitGenerationError(
      "Kit ALLUMINIO ARTECH anta-ribalta non ancora disponibile: manca il listino di composizione dedicato " +
        "(la gamma «PLANA» del listino 2026 è per legno/PVC, non alluminio). Sarà attivato con i dati validati dall'esperto.",
      "artech.materiale",
    );
  },
};
