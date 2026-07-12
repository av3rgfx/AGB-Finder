# Anta a battente ARTECH legno — assunzioni (PROVVISORIO)

**Fase 1h.** Distinta derivata dal listino AGB 2026 + sottrazione del meccanismo
di ribalta dall'anta-ribalta legno. NON validata da un esperto. Golden =
snapshot auto-coerente (`rules-artech-battente-legno.test.ts`).

## Distinta pilota (anta singola, Mod. 502, LEGNO)

| Posizione | Codice | Q.tà | Fonte |
|---|---|---|---|
| Cremonese a battente | `A50200.15.NN` (per altezza) | 1 | Listino Mod. 502 (righe ~19659) |
| Squadra angolare | `A50904.36.{01 DX, 02 SX}` | 1 | Condivisa anta-ribalta |
| Supporto cerniera | `A50801.01.{01 DX, 02 SX}` | 1 | Condivisa anta-ribalta (già ASSUNZIONE) |
| Movimento angolare | `A50302.01.02` | 2 | Condiviso anta-ribalta |
| Incontri nottolino | `A51400.05.02` | 2 + passo 600 (h+l) | Condiviso anta-ribalta |

**Rimossi (ribalta):** forbice corpo/braccio, supporto forbice, perno, incontro
ribalta, incontro DSS, chiusure verticali.

## Domande per l'agente (sblocco validazione)

1. La distinta a battente si ottiene davvero sottraendo il meccanismo di ribalta
   dall'anta-ribalta, o servono componenti battente-specifici (es. incontri
   cremonese Mod. 502 `A52099.25.NN` — a listino risultano 124–244€: sono strike
   standard o set/dime?)?
2. La cremonese Mod. 502 `A50200.15.NN` si seleziona per altezza con gli stessi
   scaglioni? Va applicato un offset (l'anta-ribalta usa hbb = altezza − 10)?
3. Le coperture (`A51301.*`, kit «supporto forbice + cerniera») vanno incluse nel
   battente (che non ha forbice)? Esiste una copertura solo-cerniera?
4. La formula incontri nottolino (2 + scatti passo 600) vale identica per il
   battente, o cambia il numero di punti di chiusura?
5. Le cerniere `A50904.36.*` / `A50801.01.*` (interasse 13, battuta 20) sono le
   stesse dell'anta-ribalta anche per il battente?
