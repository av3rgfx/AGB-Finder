# Vasistas ARTECH LEGNO — esito della verifica e domande residue

> **Stato: ATTIVO, PROVVISORIO** (in attesa di validazione dell'esperto AGB). Modulo
> `src/server/kit/rules-artech-vasistas-legno.ts` (engine `artech-vasistas-legno`),
> `KitTemplate` `isActive:true`, solo **LEGNO**.
> **Riscritto il 2026-07-25**: non è più una distinta *derivata per analogia* dall'anta
> ribalta, è la **trascrizione** delle voci dello schema di montaggio del listino.
> Golden: **13 righe / 19 pezzi** (H 1000 / L 600 → GR03).

**Pagine**: sempre **fisica (stampata)**, fisica = stampata + 2.
⚠️ **Trappola già caduta una volta**: la scheda Fase 1i citava «pag. 416» intendendo la
**stampata**, cioè la fisica **p0418**. La fisica 416 è lo schema del **BATTENTE**: due
tipologie diverse a due pagine di distanza. La fonte del vasistas è **p0418 (416)**.

La numerazione delle domande è **globale** su tutte le schede di `kit-assunzioni/`
(i commenti nel codice ci rimandano per numero): l'indice completo è in `legno.md`.

---

## Distinta generata (12 delle 13 voci dello schema p0418 (416))

| Voce | Posizione | Codice | Q.tà | Fonte |
|---|---|---|---|---|
| 1 | cremonese vasistas (maniglia variabile) | `A50111.15.11…16` per GR | 1 | tabella E.15, p0426 (424) |
| 2 | forbici per vasistas | `A50545.00.00` | per banda **LBB** | tabella «Posizionamento forbici» sullo schema; articolo a p0442 (440) |
| 3 | terminale con nottolino corsa 18 | `A50193.00.03` | 1 | p0431 (429) |
| 4 | terminale con nottolino corsa 18+18 | `A50193.00.02` | 1 | p0431 (429) |
| 5 | movimento angolare 125x125 | `A50302.01.02` | 2 | p0435 (433) |
| 6 | limitatore di corsa 18 mm | `A50196.00.18` | = n. movimenti angolari | schema |
| **7** | chiusure supplementari › terminale | — | — | **OMESSA DI PROPOSITO → domanda 8** |
| 8 | supporto forbice | `A50702.05.00` | = n. **cerniere portanti** | p0449 (447) |
| 9 | perno per supporto forbice | `A50790.00.00` | = n. **cerniere portanti** | p0449 (447) |
| 10 | cerniera centrale registrabile portante **e per vasistas** | `A51101.36.01` | 2 (+1 se 70-80 kg) | p0455 (453) |
| 11 | articolazione superiore anta semifissa | `A51001.36.01` **dx** + `A51001.36.02` **sx** | 1 + 1 | p0455 (453) |
| 12 | corpo articolazione superiore | `A51050.16.12` | 2 | p0454 (452) |
| 13 | incontri nottolino | `A51400.05.02` | colonna **NOT.(GR)** | p0469 (467) |

**Campo di applicazione:** solo LEGNO · geometria del pilota (aria 12 / interasse 13 /
battuta 20 / sede 18) · superficie **≤ 2 m²** (limite stampato sullo schema) · **GR01-GR06**
(HBB 540-2510). Fuori campo il modulo **rifiuta**, non arrotonda.

**GR per altezza:** GR01 540-712 · GR02 660-860 · GR03 820-1220 · GR04 1190-1610 ·
GR05 1590-2010 · GR06 1890-2510 (bordi sovrapposti → GR più basso).
**NOT.(GR):** 0 · 1 · 1 · 2 · 2 · 4.

**Forbici per banda di larghezza (LBB)** — tabella «Posizionamento forbici» dello schema:

| LBB | Forbici | Posizione |
|---|---|---|
| 274-540 | 2 | sui montanti |
| 541-860 | 1 | sul traverso |
| 861-1200 | 3 | 1 traverso + 2 montanti |
| 1201-2510 | 4 | 2 traverso + 2 montanti |

NB dello schema: «per ragioni di sicurezza le forbici sui montanti sono obbligatorie per
LBB compresi tra 861 e 2510 (per HBB > 500 mm)» — è la ragione per cui il conteggio sale.

**Peso dell'anta** (`sashWeightKg`, facoltativo). Due NB dello schema:
«con ante di peso compreso tra i 70 e gli 80 Kg (max) aggiungere la cerniera al centro ⑩»
→ terza cerniera portante col suo supporto forbice e perno, oltre gli 80 kg **rifiuto**;
«la portata massima per le forbici di sicurezza è di 40 Kg cadauna» → **rifiuto** se il
peso supera 40 kg × n. forbici. Quando il peso non è indicato, la riga della cerniera
dichiara il limite di **quella** distinta: `min(70, 40 × n. forbici)` — a L 600 c'è una
sola forbice, quindi 40 kg, non 70.

---

## Risolte dal listino (erano domande della Fase 1i)

| Era | Esito |
|---|---|
| **DSS `A50190.00.00` + incontro `A51400.05.03`**: inclusi o no? | **NO — rimossi.** Le legende dei 4 schemi vasistas (p0418-0421 (416-419)) non li contengono; li contengono l'anta-ribalta (p0406 (404), voci 2 e 15) e il battente (p0416 (414), voci 3 e 11). Venivano da una NB della tabella cremonesi p0424 (422)/p0426 (424) scritta per l'uso **anta-ribalta** della famiglia condivisa «Anta ribalta/Vasistas» |
| **Cerniere (voci 10-11-12)**: la Fase 1i le escludeva come «solo anta doppia/semifissa» | **Lettura superata: SONO nella distinta.** La legenda le prefissa «Cerniere per seconda anta › …» perché quello è il **titolo della sezione di listino** (p0453 (451)-p0455 (453)) da cui sono citate, come «Cremonesi › Anta ribalta/Vasistas» alla voce 1. Nel disegno stanno ai due angoli inferiori dell'**unica** anta presente. Senza di esse l'anta non è appesa |
| **Forbici**: le bande LBB determinano solo la posizione o anche il numero? | **Anche il numero** (tabella sopra). Prima il modulo lo derivava dal GR, cioè dall'**altezza**: a 1000 mm di larghezza il listino chiede 3 forbici, il motore ne dava 1 o 2 |
| **Incontri nottolino**: colonna NOT.(GR) o formula perimetrale? | Si usa la **colonna NOT. stampata** per il cremonese scelto. Resta l'incoerenza col modulo anta-ribalta, che usa la formula → **domanda 3** in `legno.md` |
| **Supporto forbice**: battuta 18 (`A50701.05.00`) o 20 (`A50702.05.00`)? | **Battuta 20**: la geometria del pilota è battuta 20, ed è ora una guardia esplicita (`assertPilotGeometry`) |
| **Bande GR del cremonese** | **Verificate** contro p0426 (424) (resta aperto il solo offset altezza→HBB: **domanda 10**) |
| **Mano**: 2 pezzi scelti su `openingSide`? | **No.** Una ribalta pura è incernierata in basso e non ha una mano: i due angoli inferiori sono **speculari** → 1 pezzo DX + 1 SX della voce 11 (l'unica data per mano). Prima si emettevano 2 pezzi della stessa mano scelti su un campo privo di significato per la tipologia, lasciando un angolo senza articolazione |
| **Incontro ribalta `A51400.05.70`**: serve? | **No**: non è fra le 13 voci dello schema vasistas |

---

## Domanda 5 — variante base o alternativa, per le tre cerniere? E i due terminali?

Per ciascuna delle voci 10-11-12 il listino offre una variante «base» e un'alternativa che
lo schema **non discrimina**. Il modulo ha scelto la **base**:

| Voce | Scelta | Alternativa non scelta |
|---|---|---|
| 10 | `A51101.36.01` «regolabile in 2 dimensioni» | `A51102.36.02` «con compensatore 16/12, regolabile in 3 dimensioni», p0455 (453) |
| 11 | `A51001.36.01/.02` | `A51002.36.NN` «con canale 16/12», p0454 (452)-p0455 (453) |
| 12 | `A51050.16.12` | `A51051.16.12` «solo lato traverso superiore» |

*(La **famiglia** della voce 10 è invece certa: è l'unica che il listino chiama
esplicitamente «e **per vasistas**».)*

**Domanda:** quale variante va montata su una vasistas legno aria 12 / interasse 13 /
battuta 20? E, nella stessa risposta: i **due terminali** delle voci 3 e 4 (corsa 18 **e**
corsa 18+18) servono **entrambi**, uno per estremità del traverso, come il disegno lascia
intendere?

Da confermare anche la **⑩ centrale sopra i 70 kg** e il limite di **40 kg per forbice**:
il campo peso è facoltativo nel wizard, quindi la regola morde solo se l'agente lo compila.

## Domanda 8 — voce 7, i terminali delle chiusure supplementari sui montanti

È la **13ª voce**, l'unica che il generatore non emette, e l'omissione è **deliberata**:
lo schema disegna la voce ma **non pubblica né il codice né la lunghezza**, e la lunghezza
è tutto il problema — il terminale si compone con l'altezza del montante (angolare +
prolunghe + terminale) e a listino esistono terminali/prolunghe da 200/400/600/800 mm.
L'unica regola di composizione nota (`CHIUSURE_VERTICALI` in `rules-artech-legno.ts`) copre
una sola banda (H 1520-2120) e la conosciamo perché ricavata da una distinta **anta-ribalta**
reale del 2021: per il vasistas quella distinta non esiste. Sceglierne una per analogia
stamperebbe una **misura inventata** su una distinta d'ordine.

Conseguenza: il modulo **ignora `supplementaryClosures`** per la vasistas (non ha righe da
accendere), coerentemente col wizard, che per VASISTAS non mostra la casella.

*Confronto col battente, che invece è stato spento:* la differenza è **quale** voce manca.
Al battente mancava la **sospensione superiore**, cioè ciò che appende l'anta → distinta non
montabile. Alla vasistas manca una chiusura **supplementare**: l'anta è appesa, apre e
chiude. La distinta è ordinabile, e incompleta **in modo dichiarato**.

**Domanda:** quale codice, e come si sceglie la **lunghezza** in funzione dell'altezza del
montante? Servono su ogni vasistas o solo sopra una certa altezza/superficie?

## Domanda 9 — GR00

GR00 (HBB 274-662) è **fuori** dal campo del pilota: banda e colonna NOT. non sono state
trascritte, e il modulo rifiuta sotto i 540 mm. Sblocca le finestre piccole.

**Domanda:** GR00 va gestito? Con quante forbici e quanti incontri?

---

## Assunzioni dichiarate residue (non bloccanti, nessuna domanda numerata)

- **Entrata maniglia: solo 15.** Le `A50111.08.*` esistono, ma le due NB di
  `p0426 (424)` dichiarano le forbici vasistas `A50545.00.00` «non applicabili» sui
  GR 1-2-3 a entrata 7,5 e limitate ai GR 5-6, senza indicare il sostituto; il GR00
  è pubblicato solo per l'entrata 15. Il modulo **rifiuta** l'entrata 7,5 invece di
  emettere una distinta a cui manca un pezzo. Si riapre con una risposta dell'esperto.
- **Movimenti angolari = 2** e **limitatori di corsa = n. movimenti angolari** (come nei
  moduli gemelli); lo schema non pubblica la quantità.
- **Coperture/finitura**: la vasistas non emette coperture; `finish` non seleziona nulla.
- **Bordi delle bande** inclusivi, sovrapposizioni risolte con lo span più stretto.
