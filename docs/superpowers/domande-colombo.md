# Domande per COLOMBO / Andrea — reparto maniglie

> Il gemello di [`kit-assunzioni/DA-FARE-audit-e-domande-agb.md`](./kit-assunzioni/DA-FARE-audit-e-domande-agb.md),
> per l'altro reparto. Sta qui e **non** in `kit-assunzioni/`, che è il mondo dei
> serramenti: i due reparti restano separati (regola in `CLAUDE.md`).
>
> **Perché un file suo.** Queste domande sono nate misurando il listino Vision 2026
> (sessione 2026-09-15) e vivevano solo in `handoff.md` §RIPRENDI DA QUI — che ogni
> sessione riscrive. Una domanda a un fornitore può restare aperta per settimane:
> non può stare in un blocco effimero.
>
> ⚠️ Il repo è **pubblico**: qui non si trascrivono prezzi di singoli articoli.
> Dove serve un ordine di grandezza, si usa una **percentuale**.

---

## In sintesi

| #   | Domanda                                    | A chi        | Cosa sblocca                              |
| --- | ------------------------------------------ | ------------ | ----------------------------------------- |
| C1  | HPS/1: la sigla è `I1` o `HPS1`?           | COLOMBO      | 🔴 **19 righe** oggi escluse              |
| C2  | La maggiorazione 3,5 % vale sul 05/26?     | COLOMBO      | 🔴 il **significato** di 251 prezzi       |
| C3  | BT13 / BT19 BZG: ribasso o pezzo nuovo?    | COLOMBO      | 🟡 6 codici aggiornati, uno **−24 %**     |
| C4  | Gli EAN dei codici 2026                    | COLOMBO      | 🟡 lettura del codice a barre in magazzino |
| C5  | `BT19 BZG` oromat: due prezzi su due pagine | COLOMBO      | ⚪ un valore su uno                        |
| C6  | MR11/MR15 · LC31/LC41 · LC71/LC81          | COLOMBO      | ⚪ 66 codici senza foto (aperta dal 05/08) |

---

## 🔴 C1 — «zirconium HPS/1»: la sigla nel codice è `I1` o `HPS1`?

**Il fatto misurato.** COLOMBO usa **entrambe le forme dentro la stessa serie
Laconica**, e a listino 02/26 coesistono **cinque grafie** per quella finitura.
La legenda del Vision 2026 stampa `HPS/1`, ma i codici d'ordine non possono
contenere `/` in quella posizione, e le due riduzioni plausibili (`I1`, `HPS1`)
esistono entrambe nel catalogo vecchio.

**Perché non si indovina.** È esattamente il divieto §9 (`A50904.22` non esiste,
ed è il difetto che ha fatto disattivare PVC e battente): un codice inventato per
concatenazione **esiste, ha un prezzo e non produce alcun warning**.

**Conseguenza oggi.** Le **19 righe** zirconium del Vision 2026 **non sono state
importate**. Sono misurate e pronte: la risposta le fa entrare senza altro lavoro.

**Come porla.** *«Per la finitura zirconium HPS/1 dei prodotti 2026, il codice
d'ordine finisce in `I1` o in `HPS1`? Ce ne servono un paio di esempi completi.»*

---

## 🔴 C2 — La maggiorazione temporanea del 3,5 % vale ancora sull'edizione 05/26?

**Il fatto misurato.**

| misura                                                        | esito             |
| ------------------------------------------------------------- | ----------------- |
| prezzi del PDF 05/26 uguali al **netto** del 02/26             | **11 su 11**      |
| prezzi del PDF 05/26 uguali alla **somma** netto + 3,5 %       | **0 su 16**       |
| occorrenze della parola «surcharge»/«maggiorazione» nel PDF    | **0**             |
| righe 02/26 in cui `surcharge` è il 3,5 % esatto di `priceList` | **3.456 su 3.456** |

**Cosa NON sappiamo.** La misura **non discrimina** fra «la maggiorazione è stata
tolta» e «il listino base si pubblica sempre al netto, e la maggiorazione si
aggiunge a parte». Sono due mondi diversi per il cliente finale.

**Cosa abbiamo fatto nel frattempo.** `surcharge = NULL` sui 240 codici nuovi —
mai `0`, mai il 3,5 % calcolato (**verdetto `/llm-council` unanime 4/4**): `NULL`
è l'unico stato **recuperabile con un solo `UPDATE`** il giorno della risposta, e
l'unico che non afferma qualcosa che non sappiamo. La UI **dichiara entrambe le
convenzioni**, così l'agente vede quale prezzo ha davanti.

**Come porla.** *«I prezzi del listino Vision 2026 sono già comprensivi della
maggiorazione temporanea del 3,5 %, oppure la maggiorazione si aggiunge come nel
02/26?»*

---

## 🟡 C3 — BT13 e BT19 BZG: ribasso vero o pezzo ridisegnato?

**Il fatto misurato.** Dei 17 codici già a listino che il Vision 2026 ripubblica,
**6 hanno un prezzo diverso**, e il maggiore scende del **24 %**; un altro del
**7 %**. Entrambi arrivano anche con una **gamma di finiture diversa** da quella
del 02/26.

**Perché è una domanda e non un dato.** Un calo del 24 % può essere un ribasso
commerciale, oppure la sigla riusata per un pezzo **ridisegnato** — nel secondo
caso l'articolo a magazzino e quello a listino non sono la stessa cosa, e la
scheda mostrerebbe il prezzo di un prodotto diverso da quello nello scaffale.

**Come porla.** *«I codici BT13 e BT19 BZG del 2026 sono gli stessi pezzi del
listino 02/26 a un prezzo nuovo, o sono stati ridisegnati mantenendo la sigla?»*

---

## 🟡 C4 — Gli EAN dei codici 2026

**Il fatto.** Il PDF Vision 2026 **non contiene EAN**. I 240 codici importati
nascono quindi **senza codice a barre**, mentre i 3.456 del 02/26 ce l'hanno tutti
(arrivano dall'xlsx).

**Quando diventa un problema.** Solo se in magazzino si legge il codice a barre
per identificare l'articolo. Se si digita il codice, non cambia nulla.

**Da chiedere prima ad Andrea:** *«in magazzino i nuovi li cercate leggendo il
codice a barre o digitando il codice?»* — se sì, allora a COLOMBO: *«ci mandate
gli EAN dei codici 2026, anche in un foglio a parte?»*

---

## ⚪ C5 — `BT19 BZG` in oromat costa due prezzi diversi

**Il fatto misurato.** Il Vision 2026 stampa quel prodotto su **due pagine** con
**due valori diversi** (scarto **0,2 %**). Degli altri prodotti ripetuti su due
pagine, **21 su 22 concordano**: è l'unica incoerenza del documento.

**Cosa abbiamo fatto.** Il parser **non tollera** il disaccordo, lo **dichiara**:
è una deroga scritta per esteso, e il valore scelto è quello della **pagina del
prodotto** (numero di pagina più basso) — una regola, non un numero incollato a
mano, così resta valida anche a prezzi cambiati. Un disaccordo **nuovo** fermerebbe
l'import invece di passare inosservato.

**Come porla.** *«Il prodotto BT19 BZG in oromat compare a pagina 8 e a pagina 13
del Vision 2026 con due prezzi diversi: quale dei due vale?»*

---

## ⚪ C6 — Quale archivio fotografico è MR11 e quale MR15?

**Aperta dal 2026-08-05**, non ancora posta. Tre coppie di modelli hanno **due
archivi fotografici ciascuno** e nessuna fonte di COLOMBO li accoppia ai codici:
**MR11/MR15**, **LC31/LC41**, **LC71/LC81** (SPIDER, MILLA, TRAMA).

**Conseguenza oggi.** **66 codici restano senza foto di riga**, dichiarati con la
ragione: la serie sbagliata darebbe una foto che esiste, si vede benissimo, **ed è
di un altro prodotto**. I tre gruppi mostrano comunque la copertina.

**Come porla.** *«Negli archivi fotografici, quale cartella corrisponde al modello
MR11 e quale a MR15? Idem per LC31/LC41 e LC71/LC81.»*

---

## La tabella dei 270 codici, da far confermare ad Andrea

Codice · descrizione · prezzo · gruppo di sfoglio · grado di certezza:
<https://claude.ai/artifact/TmLQACdckr7c3WDP7GmJjJ>

È **generata dall'output del codice**, non riscritta a mano: la corrispondenza
riga↔articolo è esatta anche dove c'è un'eccezione.
