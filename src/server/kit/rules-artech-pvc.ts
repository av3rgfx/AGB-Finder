// Regole kit ARTECH anta-ribalta PVC — DISATTIVATO 2026-07-25.
//
// ⚠️ NON DISPONIBILE. La verifica sul listino AGB 2026 ha dimostrato che la
// composizione ARTECH PVC NON esiste in questo volume:
//   · nella sezione ARTECH (p0390-0507) la stringa «PVC» compare in UNA sola
//     pagina, p0395 (393), che è l'allegato del certificato ift 228-6026531-1-13
//     rilegato nel capitolo — un documento normativo, non un catalogo di vendita;
//   · i 4 codici material-specific su cui il modulo era costruito
//     (A51921.36.04, A50712.00.00, A50922.07.00, A50812.07.00) compaiono SOLO in
//     p0013 (11) e p0395 (393): nessuna tabella prezzi, nessuna scheda, non
//     ordinabili. Grep esaustivo su tutte le 960 pagine;
//   · altri 7 codici che il modulo generava (A51921.36.01/.02/.03 e l'intera
//     famiglia braccio SX A51922.36.0N) non esistono NEMMENO nel certificato:
//     erano dedotti per simmetria dal legno;
//   · i capitoli merceologici sono intestati al materiale — «Supporti Forbice -
//     Legno» p0449 (447), «Cerniere - Legno» p0451 (449), «Coperture - Legno»
//     p0488 (486) — e non esiste il gemello PVC di nessuno di essi.
//
// Il listino dice dove sta davvero il PVC: p0849 (847) rimanda tre volte al
// «listino PVC e ALLUMINIO», sezione FERRAMENTA PER FINESTRE ARTECH. Finché quel
// volume non è disponibile, un kit ARTECH PVC deterministico è impossibile:
// mancano il 100% delle tabelle di composizione e il 100% degli incontri.
//
// Effetto prima di questa modifica: ogni distinta PVC usciva con 4 righe su 12
// senza prezzo e un totale sistematicamente sottostimato.
//
// Per riattivare: ricostruire le regole dal listino PVC e ALLUMINIO, rimettere
// isActive:true in prisma/seed-kit.ts, bump della version.
// Vedi docs/superpowers/kit-assunzioni/pvc.md.
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

export const artechAntaRibaltaPvc: RuleModule = {
  engineId: "artech-ar-pvc",
  varianti: [],
  generate(_input: KitInput): KitLine[] {
    throw new KitGenerationError(
      "Kit PVC ARTECH non disponibile: il listino 2026 non contiene la composizione PVC per ARTECH " +
        "(rimanda al «listino PVC e ALLUMINIO», sezione FERRAMENTA PER FINESTRE ARTECH). " +
        "Sarà riattivato con i dati di quel volume.",
      "artech.materiale",
    );
  },
};
