# Kit ARTECH anta-ribalta PVC — esito della verifica: NON DISPONIBILE

> **Stato: DISATTIVATO il 2026-07-25.** Modulo `src/server/kit/rules-artech-pvc.ts`
> (engine `artech-ar-pvc`) → `generate()` **rifiuta** nominando il dato mancante;
> `KitTemplate` «ARTECH anta-ribalta PVC» seedato **`isActive:false`**; wizard con PVC
> disabilitato e hint che spiega *perché*.
> Si riattiva quando arriva il **«listino PVC e ALLUMINIO»** (domanda 6): ricostruire le
> regole da quel volume, `isActive:true`, bump `version`.

**Pagine**: sempre **fisica (stampata)**, fisica = stampata + 2. Es. `p0395 (393)`.

Questa scheda **era** una lista di domande slot-per-slot. Le domande presupponevano tutte
la stessa cosa — che i codici PVC fossero acquistabili — e la verifica sul listino 2026 ha
dimostrato che non lo sono. Resta **una sola** domanda: la **6**, procurare il volume
giusto.

---

## Cosa ha detto il listino 2026

Grep esaustivo su tutte le **960 pagine** del PDF.

| Codice | Slot | Dove compare | Esito |
|---|---|---|---|
| `A51921.36.04` | braccio forbice | **solo** p0013 (11) e p0395 (393) | pagina-certificato ift, **senza prezzo** → non ordinabile |
| `A50712.00.00` | supporto forbice | **solo** p0013 (11) e p0395 (393) | idem |
| `A50922.07.00` | squadra angolare | **solo** p0013 (11) e p0395 (393) | idem |
| `A50812.07.00` | supporto cerniera | **solo** p0013 (11) e p0395 (393) | idem |
| `A51921.36.01/.02/.03` | braccio forbice dx, altre bande | **nessuna pagina** | **inesistenti**: dedotti per simmetria dal legno |
| `A51922.36.0N` (intera famiglia) | braccio forbice **sx** | **nessuna pagina** | **inesistenti**: dedotti per simmetria. Il vecchio golden asseriva `A51922.36.02`, che non esiste in nessuna pagina del listino |

Le due pagine dove i 4 codici compaiono sono l'allegato del **certificato ift
228-6026531-1-13** rilegato nel capitolo ARTECH: un documento normativo (schemi 8 e 9
etichettati «ARTech PVC»), **non un catalogo di vendita** — nessuna tabella prezzi, nessuna
scheda, nessuna classe di sconto.

Tre conferme indipendenti che il PVC non sta in questo volume:

1. nella sezione ARTECH (p0390-0507 (388-505)) la stringa «PVC» compare in **una sola** pagina,
   p0395 (393), che è appunto il certificato;
2. i capitoli merceologici sono intestati al **materiale** — «Supporti Forbice - Legno»
   (p0449 (447)), «Cerniere - Legno» (p0451 (449)), «Coperture - Legno» (p0488 (486)) — e
   **non esiste il gemello PVC di nessuno di essi**;
3. p0849 (847) rimanda **tre volte** («Nottolino per PVC», «Antieffrazione per PVC», «DSS
   per PVC») al **«listino PVC e ALLUMINIO», sezione FERRAMENTA PER FINESTRE ARTECH**.

## Effetto che aveva in produzione

Il template era `isActive:true`: **ogni distinta PVC usciva con 4 righe su 12 senza
prezzo** e un totale **sistematicamente sottostimato**, senza che nulla lo dichiarasse
all'agente. Le altre 8 righe erano codici **del legno** riusati per assunzione.

## Materiale di ripartenza (NON usare per ordinare)

Mappatura colonne del certificato ift → slot, conservata perché è l'unico indizio sulla
struttura della distinta PVC quando arriverà il listino giusto:

| Colonna DE (certificato) | Slot | PVC (schemi 8/9) | Legno (schema 1) |
|---|---|---|---|
| Winkelband / top stay connecting part | braccio forbice | `A51921.36.04` | `A51911.36.04` |
| Scherenlager / stay arm support | supporto forbice | `A50712.00.00` | `A50702.05.00` |
| Eckband / corner hinge (FRM) | squadra angolare | `A50922.07.00` | `A50904.36.01` |
| Ecklager / corner pivot (MAS) | supporto cerniera | `A50812.07.00` | `A50805.05 DX` |

Il certificato ha altri schemi PVC (2, 3, 4) con supporto forbice / supporto cerniera /
squadra diversi, per classi di peso e profilo diverse: nemmeno quelli sono a prezzo.

---

## Domanda 6 (unica) — il «listino PVC e ALLUMINIO»

Il volume citato a **p0849 (847)**, sezione FERRAMENTA PER FINESTRE ARTECH. Serve
**completo**: composizioni, bande dimensionali, incontri, coperture, mani.

Sblocca **insieme il PVC e l'alluminio** (vedi `alu.md`, dove l'assunzione «alluminio ≈
ARTech PLANA» è già stata falsificata: PLANA è una cerniera **complanare per legno/PVC**).

Alternativa altrettanto buona, e più rapida da verificare: **una distinta reale di esempio**
per il PVC (input dimensioni/mano/finitura → lista componenti attesa), come quella del 2021
che ha permesso di bloccare il golden del legno.
