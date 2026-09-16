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

| #   | Domanda                                     | A chi   | Cosa sblocca                               |
| --- | ------------------------------------------- | ------- | ------------------------------------------ |
| C1  | HPS/1: la sigla è `I1` o `HPS1`?            | COLOMBO | 🔴 **19 righe** oggi escluse               |
| C2  | La maggiorazione 3,5 % vale sul 05/26?      | COLOMBO | 🔴 il **significato** di 251 prezzi        |
| C3  | BT13 / BT19 BZG: ribasso o pezzo nuovo?     | COLOMBO | 🟡 6 codici aggiornati, uno **−24 %**      |
| C4  | Gli EAN dei codici 2026                     | COLOMBO | 🟡 lettura del codice a barre in magazzino |
| C5  | `BT19 BZG` oromat: due prezzi su due pagine | COLOMBO | ⚪ un valore su uno                        |
| C6  | MR11/MR15 · LC31/LC41 · LC71/LC81           | COLOMBO | ⚪ 66 codici senza foto (aperta dal 05/08) |
| C7  | Dov'è l'indice dell'archivio fotografico?   | COLOMBO | 🟡 la scoperta di archivi nuovi            |
| C8  | Come ci fate sapere di un prodotto nuovo?   | COLOMBO | 🔴 il **preavviso** sui prodotti nuovi     |
| C9  | `ER MAN 2026`: quale edizione vale?         | Andrea  | 🟡 le foto vengono da lì                   |

---

## 🔴 C1 — «zirconium HPS/1»: la sigla nel codice è `I1` o `HPS1`?

**Il fatto misurato.** COLOMBO usa **entrambe le forme dentro la stessa serie
Laconica**, e a listino 02/26 coesistono **cinque grafie** per quella finitura.
La legenda del Vision 2026 stampa `HPS/1`, ma i codici d'ordine non possono
contenere `/` in quella posizione, e le due riduzioni plausibili (`I1`, `HPS1`)
esistono entrambe nel catalogo vecchio.

**Una prova in più, 2026-09-16.** Indicizzando gli archivi fotografici dei
prodotti 2026 si vede che COLOMBO nomina i propri file con la forma **`HPS1`**,
in **entrambi** gli archivi interessati (Laconica e Halo). ⚠️ **Non chiude la
domanda**: il nome del file dichiara la **finitura**, non la coda del **codice
d'ordine**, e la pronta consegna di Andrea contiene comunque entrambe le forme
(`0AM41RHPS1` per la Laconica, `0AM15FISSOI1` per la Halo). Sposta il peso
dell'evidenza, non la decide — ed è esattamente la distinzione che il §9
protegge.

**Perché non si indovina.** È esattamente il divieto §9 (`A50904.22` non esiste,
ed è il difetto che ha fatto disattivare PVC e battente): un codice inventato per
concatenazione **esiste, ha un prezzo e non produce alcun warning**.

**Conseguenza oggi.** Le **19 righe** zirconium del Vision 2026 **non sono state
importate**. Sono misurate e pronte: la risposta le fa entrare senza altro lavoro.

**Come porla.** _«Per la finitura zirconium HPS/1 dei prodotti 2026, il codice
d'ordine finisce in `I1` o in `HPS1`? Ce ne servono un paio di esempi completi.»_

---

## 🔴 C2 — La maggiorazione temporanea del 3,5 % vale ancora sull'edizione 05/26?

**Il fatto misurato.**

| misura                                                          | esito              |
| --------------------------------------------------------------- | ------------------ |
| prezzi del PDF 05/26 uguali al **netto** del 02/26              | **11 su 11**       |
| prezzi del PDF 05/26 uguali alla **somma** netto + 3,5 %        | **0 su 16**        |
| occorrenze della parola «surcharge»/«maggiorazione» nel PDF     | **0**              |
| righe 02/26 in cui `surcharge` è il 3,5 % esatto di `priceList` | **3.456 su 3.456** |

**Cosa NON sappiamo.** La misura **non discrimina** fra «la maggiorazione è stata
tolta» e «il listino base si pubblica sempre al netto, e la maggiorazione si
aggiunge a parte». Sono due mondi diversi per il cliente finale.

**Cosa abbiamo fatto nel frattempo.** `surcharge = NULL` sui 240 codici nuovi —
mai `0`, mai il 3,5 % calcolato (**verdetto `/llm-council` unanime 4/4**): `NULL`
è l'unico stato **recuperabile con un solo `UPDATE`** il giorno della risposta, e
l'unico che non afferma qualcosa che non sappiamo. La UI **dichiara entrambe le
convenzioni**, così l'agente vede quale prezzo ha davanti.

**Come porla.** _«I prezzi del listino Vision 2026 sono già comprensivi della
maggiorazione temporanea del 3,5 %, oppure la maggiorazione si aggiunge come nel
02/26?»_

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

**Come porla.** _«I codici BT13 e BT19 BZG del 2026 sono gli stessi pezzi del
listino 02/26 a un prezzo nuovo, o sono stati ridisegnati mantenendo la sigla?»_

---

## 🟡 C4 — Gli EAN dei codici 2026

**Il fatto.** Il PDF Vision 2026 **non contiene EAN**. I 240 codici importati
nascono quindi **senza codice a barre**, mentre i 3.456 del 02/26 ce l'hanno tutti
(arrivano dall'xlsx).

**Quando diventa un problema.** Solo se in magazzino si legge il codice a barre
per identificare l'articolo. Se si digita il codice, non cambia nulla.

**Da chiedere prima ad Andrea:** _«in magazzino i nuovi li cercate leggendo il
codice a barre o digitando il codice?»_ — se sì, allora a COLOMBO: _«ci mandate
gli EAN dei codici 2026, anche in un foglio a parte?»_

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

**Come porla.** _«Il prodotto BT19 BZG in oromat compare a pagina 8 e a pagina 13
del Vision 2026 con due prezzi diversi: quale dei due vale?»_

---

## ⚪ C6 — Quale archivio fotografico è MR11 e quale MR15?

**Aperta dal 2026-08-05**, non ancora posta. Tre coppie di modelli hanno **due
archivi fotografici ciascuno** e nessuna fonte di COLOMBO li accoppia ai codici:
**MR11/MR15**, **LC31/LC41**, **LC71/LC81** (SPIDER, MILLA, TRAMA).

**Conseguenza oggi.** **66 codici restano senza foto di riga**, dichiarati con la
ragione: la serie sbagliata darebbe una foto che esiste, si vede benissimo, **ed è
di un altro prodotto**. I tre gruppi mostrano comunque la copertina.

**Come porla.** _«Negli archivi fotografici, quale cartella corrisponde al modello
MR11 e quale a MR15? Idem per LC31/LC41 e LC71/LC81.»_

---

## 🟡 C7 — Dov'è l'indice dell'archivio fotografico, adesso?

**Il fatto misurato (2026-09-15/16).** L'area download è stata rifatta: non è più
un elenco piatto di file ma un indice di **29 categorie**, che pubblicano **solo
PDF**. Gli zip dell'archivio fotografico **ci sono ancora e rispondono** (79 su
79, e senza password), ma il loro **elenco non è pubblicato in nessuna pagina**,
e la directory risponde `403`.

**Conseguenza oggi.** Le foto continuano ad arrivare, perché la lista dei 79
archivi la teniamo noi. Ma **un archivio nuovo non è più scopribile**: i cinque
modelli del 2026 li avevamo visti mesi prima del listino proprio così.

**E serve anche per il RECUPERO**: il giorno in cui un archivio venisse
rinominato, il run lo direbbe col nome — ma non avremmo alcun modo di scoprire
il nome nuovo.

**Come porla.** _«L'archivio fotografico non compare più fra le categorie
dell'area download: c'è un indice, un feed o un contatto a cui chiederlo?»_

---

## 🔴 C8 — Come ci fate sapere che esce un prodotto nuovo?

**Perché è la più importante delle nove.** Il preavviso sui prodotti nuovi ci
arrivava per **effetto collaterale di uno script di conversione immagini**. È
un'informazione commerciale — chi rifornisce il magazzino la vuole — e non
dovrebbe dipendere da come è fatto l'HTML del sito del fornitore.

**Cosa abbiamo messo al suo posto, nel frattempo.** Un controllo settimanale
dell'indice pubblico dei documenti (`pnpm vigila:colombo`): un catalogo o un
listino nuovo compare lì, ed è di fatto ciò che ha fatto partire le ultime due
sessioni di lavoro. Ma arriva quando COLOMBO **pubblica**, non quando **decide**.

**Come porla.** _«C'è un modo per essere avvisati quando uscite con un prodotto o
una finitura nuova — una mailing list, il vostro agente di zona, un'area
riservata? Oggi ce ne accorgiamo dal sito.»_

---

## 🟡 C9 — `ER MAN 2026`: quale edizione vale, `_100726` o `_140926`?

**Trovata dal guardiano il giorno in cui è nato**, 2026-09-16: l'area download
serve oggi `ER MAN 2026_140926.pdf`, mentre la copia che abbiamo — e che
`CLAUDE.md` registra come «il catalogo giusto» — è `ER MAN 2026_100726.pdf`.
COLOMBO ha pubblicato **un'edizione nuova** del catalogo maniglie e non ce ne
eravamo accorti.

**Perché ci riguarda.** `ER MAN 2026` è la fonte da cui è stata ricavata la
mappa nome-commerciale → pagina, ed è il catalogo che un agente apre davanti al
cliente. Un'edizione nuova può aggiungere modelli, e i modelli sono i gruppi
dello sfoglio.

**Come porla — ad Andrea, non a COLOMBO.** _«Sull'area download c'è un `ER MAN
2026` del 14/09: quella che usiamo è di luglio. Scarichi la nuova e la metti
nella cartella Drive?»_ Poi si misura cosa cambia, prima di toccare qualunque
tabella.

---

## La tabella dei 270 codici, da far confermare ad Andrea

Codice · descrizione · prezzo · gruppo di sfoglio · grado di certezza:
<https://claude.ai/artifact/TmLQACdckr7c3WDP7GmJjJ>

È **generata dall'output del codice**, non riscritta a mano: la corrispondenza
riga↔articolo è esatta anche dove c'è un'eccezione.
