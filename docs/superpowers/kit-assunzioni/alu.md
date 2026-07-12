# ALLUMINIO anta-ribalta ARTECH — stato e domande per l'esperto

> Fase 1g, Task 4. **Stato: NON DISPONIBILE (gated)** — modulo `rules-artech-alu.ts`
> rifiuta esplicitamente; `KitTemplate` ALLUMINIO seedato `isActive:false`.
> Si attiva quando l'esperto fornisce i dati (risposte sotto) → popolare il modulo,
> `isActive:true`, bump `version`.

## Perché è gated (finding dall'estrazione del listino 2026)

Il listino AGB 2026 disponibile **non contiene una composizione ALLUMINIO** per
anta-ribalta ARTECH. L'assunzione del piano/spec «ALLUMINIO ≈ ARTech PLANA» è
**falsificata**:

- **«ARTech PLANA» è un sistema di cerniere COMPLANARI (a filo), per LEGNO/PVC**,
  non per alluminio. Evidenze nel listino: righe ~616-624 (tabella cert), 17204
  «PLANA Legno», 17207 «PLANA PVC», 22757+ «Artech Plana legno».
- Struttura diversa dal pilota: braccio `A52911` a segmenti `.02/.10` (non `.36`),
  squadra `A52900.02.01`, supporto cerniera `A52901.*`, e **nessun supporto forbice**
  (colonna "-" nella tabella cert ift schemi 5-7).
- I capitoli di composizione ARTECH del listino sono tutti «legno»; gli incontri
  PVC/alluminio rimandano a un **«listino PVC e ALLUMINIO» separato non disponibile**
  (cfr. righe ~36583-36610).

Costruire ora un modulo alluminio significherebbe **inventare** una distinta →
contro il principio "motore deterministico, mai dati fabbricati". Quindi: gate.

## ✅ DOMANDE PRONTE PER L'ESPERTO (da inoltrare)

### A. ALLUMINIO (sblocco Task 4)
1. Esiste una gamma **ARTECH anta-ribalta per serramenti in ALLUMINIO**? Se sì, qual
   è il **listino/documento di riferimento** (il "listino PVC e ALLUMINIO" separato)?
   Puoi fornirlo?
2. «ARTech PLANA» è la soluzione per l'alluminio, oppure è (come sembra) una cerniera
   complanare per legno/PVC?
3. La distinta anta-ribalta alluminio usa gli **stessi slot** del legno (cremonese,
   corpo forbice, braccio, squadra angolare, supporto cerniera, supporto forbice,
   perno, incontri nottolino/DSS/ribalta, coperture)? Quali **cambiano** e con quali
   **codici**?
4. L'alluminio ha un **supporto forbice separato** o è integrato (la cert PLANA mostra "-")?
5. Le **bande dimensionali** (altezza→cremonese, larghezza→forbice/braccio) per
   l'alluminio sono identiche al legno o diverse?
6. **Handedness** (DX/SX) dei componenti alluminio: servono varianti DX/SX o sono
   ambidestri (codice unico)?
7. **Chiusure supplementari** (angolare verticale + prolunga + terminale): valgono per
   l'alluminio? Con quali codici/bande? Sono obbligatorie sopra una certa altezza?
8. **Finiture** disponibili per l'alluminio (oltre ARGENTO)?

### B. Validazione PVC (il modulo PVC è provvisorio — Task 3)
Dettaglio slot-per-slot in `docs/superpowers/kit-assunzioni/pvc.md`. In sintesi:
9. I 4 codici material-specific PVC dalla cert ift (braccio `A51921.36.04`, supporto
   forbice `A50712.00.00`, squadra `A50922.07.00`, supporto cerniera `A50812.07.00`)
   sono corretti per il pilota **aria 12 / interasse 13 / battuta 20**?
10. **Handedness PVC**: la cert dà codici unici `.00` per squadra e supporto cerniera →
    ambidestri o servono DX/SX?
11. **Braccio PVC SX**: esiste `A51922.36.0N` (dedotto per simmetria dal legno
    `A51912`) o è un codice diverso?
12. Gli slot "condivisi col legno" per il PVC (cremonese, corpo forbice, perno, incontri
    nottolino/DSS/ribalta, coperture, chiusure supplementari, movimento angolare, e la
    **formula** incontri-nottolino) sono davvero identici al legno, o il PVC ha
    codici/quantità propri?

### C. Trasversale
13. Puoi fornire **una distinta reale di esempio** (input dimensioni/mano/finitura →
    lista componenti attesa) per PVC e per ALLUMINIO? È il modo più rapido per bloccare
    i golden test con certezza (come fatto per il legno in Fase 1d).
