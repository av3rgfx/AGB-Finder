# Sfoglio catalogo maniglie — serie, tendine e foto di anteprima

**Data**: 2026-08-05 · **Reparto**: MANIGLIE (COLOMBO) · **Stato**: spec approvata

Quattro cambiamenti allo sfoglio, chiesti dall'utente e passati da `/brainstorming`,
`/llm-council` (5 advisor + 5 peer review, affermazioni verificate nel repo) e
`/impeccable`. Tutte le cifre di questa spec sono **misurate sul listino vero**
(`LP 02-26`, 3.456 codici, importato in locale con `pnpm import:listino`), non stimate.

---

## 1. Il problema, come si presenta oggi

Lo sfoglio ha tre livelli: **gruppo** (la prima parola della descrizione del listino,
post-curatela) → **famiglia** (il token della descrizione che compare anche nel codice) →
**codici**. Funziona, ed è arrivato in produzione. Ma:

1. **Non si vede niente.** 2.118 codici su 3.456 hanno una foto e lo sfoglio non ne mostra
   nessuna finché non si arriva alle righe articolo, cioè al terzo tocco.
2. **Il livello 2 è una navigazione**: si clicca una famiglia e si va a un'altra pagina, che
   mostra *solo quella*. Confrontare due famiglie richiede due viaggi.
3. **753 codici su 3.393 sfogliabili (22,2%) non stanno in nessuna famiglia** e cadono in
   fondo alla pagina sotto «Senza famiglia». (I 3.393 sono i 3.456 del listino meno i 63
   che la curatela esclude dallo sfoglio: viti, dadi, chiavi. Tutte le percentuali di
   copertura di questa spec hanno 3.393 come denominatore.)
4. **Il primo livello ha doppioni**: `PL.` / `PL.OTT.` / `PL.OTT.YALE`, `MANIG.` /
   `MANIG.INCASSO` / `MANIGLIA` / `MANIGLIE`, `MANIGLIONI` / `MANIGLIONE`.

### 1.1 Il caso segnalato dall'utente, e perché la sua diagnosi era sbagliata

L'utente ha segnalato che in `ROBOQUATTRO S` i codici `0ID51RSMY-CM` e `0ID51RSMY-CR`
stanno fuori da ogni famiglia, ipotizzando che la causa fosse **lo zero iniziale** del
codice (un possibile errore di esportazione).

Misurato: **non è lo zero.** `0ID51R-CM` ha lo stesso zero e la famiglia `ID51R` la prende.
La causa vera è che COLOMBO, nella descrizione, **scrive un codice diverso da quello
dell'articolo**:

| codice articolo | descrizione a listino | famiglia trovata |
|---|---|---|
| `0ID51R-CM` | `ROBOQUATTRO S' ID51R CROMAT` | `ID51R` ✅ |
| `0ID51RSMY-CM` | `ROBOQUATTRO S **ID51RY** STRETTA` | — ❌ |

`ID51RY` dentro `0ID51RSMYCM` non c'è, quindi la regola non aggancia. Non è un caso
isolato: la stessa forma (codice `…RSMY`, descrizione `…RY STRETTA C/MOLLA`) ricorre in
**ALATO, AMA, BLAZER, FEDRA, ELLE, DEA, LUND, ALBA, ROBOQUATTRO**.

Nello stesso gruppo c'è una **seconda causa diversa**: `0ID51RSB-NM` è fuori perché la
descrizione scrive `S'ID51RSB` attaccato, e il token incollato non è contenuto nel codice.

La **destinazione** che l'utente ha indicato (`ID51R`) è però esattamente quella che si
ottiene senza indovinare nulla: è l'unica famiglia **già esistente in quel gruppo** il cui
nome è un prefisso del nucleo di quel codice.

---

## 2. Le misure (non rifarle)

| Misura | Valore |
|---|---|
| Articoli COLOMBO a listino | **3.456** |
| Gruppi di primo livello, post-curatela attuale | **102** (63 codici esclusi) |
| Famiglie totali | **533** · mediana 3 codici · massimo 30 |
| Famiglie per gruppo | mediana **5** · massimo **52** (MANIGLIONE) |
| Gruppi senza livello 2 | **12** |
| Codici senza famiglia | **753** su 3.393 sfogliabili (**22,2%**) |
| Gruppo più numeroso | MANIGLIONE **338** codici = **88 KB** di JSON in forma `toSummary` |
| Gruppi che sono un modello (hanno un archivio fotografico proprio) | **63 su 102**, 1.866 codici |
| Codici con foto in produzione | 2.118 (61,3%) |

### 2.1 Le tre strade per i 753 codici senza famiglia, misurate

| Strada | Copertura | Esito |
|---|---|---|
| **A** — solo assorbimento in famiglie esistenti | 77,8% → 86,3% | +289 codici. Restano fuori KIT (140), POMOLINO (41), COPPIA (28), MOSTRINA (24) |
| **B** — famiglia dedotta dal codice, sempre | 100% | **Scartata**: 25,4-35,6% di voci da **un codice solo** (MILLA 28/28, ALBA 21/21, MOVIMENTO 36/37) |
| **C** — ibrida (adottata) | **77,8% → 97,5%** | +289 assorbiti, +379 in 53 voci nuove, 58 restano soli, 27 ambigui |

La strada B è stata provata in due varianti e **falsificata da entrambe**: tagliando la coda
dopo l'ultimo trattino restano 250 voci da un codice solo su 984; tagliando solo le **31
finiture ufficiali** di `finiture.ts` (proposta del council) si peggiora a **380 su 1.066**,
perché le code vere del listino sono 57 e le altre 26 sono bicolori (`CR8`, `GLS`, `OL9`)
che quell'elenco non contiene.

Effetto della strada C sui gruppi che oggi non hanno livello 2 o quasi:

| Gruppo | Oggi | Con C |
|---|---|---|
| ROSETTA | 5 famiglie + **80 sciolti** | +4 voci: `PB01`(22) `PB01Q`(19) `PB01DG`(10) `PB01DGQ`(7) — **0 soli** |
| KIT | **0 famiglie**, 140 sciolti | +14 voci: `ID211`(13) `XKITPS`(13) `CC211`(12)… — 8 soli |
| POMOLINO | 0 famiglie, 41 sciolti | +2 voci: `PB09`(22) `PB09Q`(19) — 0 soli |
| MOSTRINA | 0 famiglie, 24 sciolti | +6 voci da 4 — 0 soli |
| COPPIA | 0 famiglie, 28 sciolti | +4 voci — 0 soli |

---

## 3. Le decisioni, e cosa le sostiene

### 3.1 La classificazione avviene sull'insieme INTERO, il filtro si applica dopo

**È la decisione che regge tutte le altre**, e nasce da un difetto trovato dal council e
poi **confermato sui dati veri**.

Oggi `familyInGroup` (`browse.ts:39`) è **pura per riga**: dipende da `row` e `groupWord` e
da nient'altro. Le regole 2 e 3 della strada C la rendono **dipendente dall'insieme** (la
regola 2 cerca fra le famiglie esistenti; la regola 3 conta quanti codici condividono un
nucleo). Ma sia `browseFamilies` sia `browseSlice` applicano `idsFiltrati` **prima** di
`splitGroup` (`article.ts:209` e `:320`).

Conseguenza misurata, simulando un filtro che tiene il 5% dei codici (la pronta consegna
vera ne tiene 178 su 3.456): **27 articoli cambiano serie** solo perché un filtro è acceso,
e un URL `?tipo=X&fam=Y&pronta=1` punta a una tendina che non esiste più.

Il **filtro finitura è peggio**: il nucleo della regola 3 *è* il codice meno la coda di
finitura, quindi filtrando per colore ogni nucleo diventerebbe un singoletto per
costruzione.

**Contratto nuovo di `splitGroup`**: riceve *tutte* le righe del gruppo **e** l'insieme
degli id visibili. Classifica sulle prime, mostra i secondi.

Una serie che esiste ma non ha righe visibili **si nasconde**: una tendina vuota è rumore, e
oggi il filtro nasconde già le famiglie senza righe. Ciò che NON deve succedere è che si
*ridefinisca*, cioè che un articolo visibile finisca in una serie diversa da quella che ha
sull'insieme intero. Un vecchio `?fam=X` che punta a una serie nascosta dal filtro non apre
nulla e non rompe niente: il gruppo si vede lo stesso.

### 3.2 La regola delle serie: tre gradini, in ordine di forza

1. **Il token della descrizione presente nel codice** (regola attuale, invariata): copre il
   77,8%. È l'intersezione di due campi che COLOMBO ha scritto entrambi.
2. **Assorbimento**: un codice senza serie entra in una serie **già esistente nel suo
   gruppo** se il nucleo del suo codice comincia con quel nome. +289 codici. Non inventa
   niente: la serie di destinazione esiste perché COLOMBO l'ha scritta nella descrizione di
   un'altra riga. Quando le serie candidate sono più di una (**27 casi**, tutti della forma
   `AC11`/`AC11R`/`AC11RSM`) il codice **non si assorbe**: resta senza serie.
3. **Nuclei condivisi**: i codici rimasti che condividono un nucleo formano una serie, **e
   solo da 2 codici in su**. +379 codici in 53 voci.

**Sulla soglia dei 2.** Non è un numero arbitrario travestito: una tendina che contiene una
riga sola è un involucro attorno a una riga, non una categoria. Chi resta solo (58 codici)
sta sotto «Codici senza serie», che è dove sta oggi.

**Sul divieto «non dedurre dal codice»** (spec 2026-08-04 §9): si applica una **deroga
circoscritta e dichiarata**, non si riscrive il divieto. Il divieto vieta di *parsificare*
il codice inventando una grammatica, e il suo controesempio è `0CD63FP-CM` contro
`0CD63GB-CM`: verificato che col taglio all'ultimo trattino danno `CD63FP` e `CD63GB`, cioè
**restano separati**. Due codici si uniscono solo se condividono un prefisso **letterale**
scritto da COLOMBO in entrambi.

**Il nucleo NON riusa `nucleo()` di `foto-archivio.ts`**: quella funzione toglie la coda
*ufficiale* (31 finiture) e ha `MIN_NUCLEO = 5`, perché serve a un'altra domanda (quale
foto ritrae questo codice). Sono due regole diverse per due scopi diversi. Vivono in moduli
diversi con nomi diversi e un commento che dice perché non sono la stessa cosa.

### 3.3 Le fusioni di primo livello

Cercate confrontando **tutte e 102 le etichette a coppie**, non ricordate.

| Da | A | Codici | Motivo |
|---|---|---|---|
| `MANIG.` · `MANIG.INCASSO` · `MANIGLIA` · `MANIGLIE` | **MANIGLIA INCASSO** | 90 | Misurato: 56/57, 4/4, 28/28, 1/1 delle righe dicono «INCASSO» |
| `MANIGLIONI` | `MANIGLIONE` | 8 | Plurale |
| `PL.OTT.` · `PL.OTT.YALE` | `PL.` | 12 | Stesso prodotto (`PB02*`, placca ottone + sottoplacca nylon) |
| `RG` | `DUMMY` | 1 | «RG ADAPTOR PER DUMMY» |
| `RONDELLE` | *(esclusa)* | 2 | `RONDELLA` è già esclusa: oggi la pagina **dichiara il falso** |

**Perché `MANIGLIA INCASSO` e non `MANIGLIA`**: una voce chiamata «MANIGLIA» prometterebbe
tutte le maniglie e ne conterebbe 90, mentre le 129 di ROBOT sono maniglie che stanno in
un'altra voce. Sarebbe un **avanzo con nome di categoria**.

**Cosa NON si fonde, e perché:**

- `MANIG.CD213` (2) e `MANIG.LC413RS` (1): sono «scorrevole complanare», un altro prodotto.
- `PLACCA` (65): è la placca dei maniglioni (`0AM113PL*`), un prodotto diverso dalle placche
  in ottone `PB02*`. Stessa parola, due oggetti.
- `HEIDI/PETER` (2): sta davvero in due gruppi.
- **`LUNDCREM` (1)**: fonderlo in `LUND` gli farebbe **ereditare una foto sbagliata**.
  `abbinaFoto` assegna le foto di modello per etichetta di sfoglio, `LUND` ha un archivio
  fotografico, e quel codice è una **cremonese**: prenderebbe la foto di una maniglia.
  Verificato caso per caso che è **l'unica** delle sette fusioni con questa conseguenza.
- `ELLE`/`ELLESSE`, `ROBOT`/`ROBOTRE`: falsi positivi del confronto per prefisso. Modelli
  diversi.

### 3.4 La curatela diventa per marca

`browseLabel(name)` non ha `brand`, e `FUSIONI`/`ESCLUSE`/`DIVISE` sono globali. Con HOPPE,
OLIVARI, DND e GHIDINI in arrivo, le correzioni di COLOMBO si applicherebbero **in
silenzio** alle loro etichette. Si chiave per marca **ora**: costa tre firme e `abbinaFoto`
oggi, un incidente invisibile alla marca #3.

### 3.5 Gli URL già condivisi non muoiono

Fuso `MANIG.`, un `?tipo=MANIG.` già mandato a un collega aprirebbe un gruppo **vuoto**,
perché `sourceFirstWords` sa scendere dall'etichetta alle parole sorgente ma non risalire.
Il router **risolve `tipo` sull'etichetta corrente** prima di interrogare.
Analogamente `?fam=` diventa l'**insieme** delle tendine aperte, quindi un vecchio link a
una singola famiglia apre quella tendina invece di rompersi.

### 3.6 La curatela non può marcire in silenzio

Il test attuale verifica solo che le etichette storte **non compaiano**: passerebbe identico
se COLOMBO correggesse `BOCCEHTTA` e la voce diventasse morta. Si aggiunge un gate che
verifica che **ogni voce di `FUSIONI`/`ESCLUSE`/`DIVISE` agganci ancora almeno una riga**.
Misurato adesso sul listino vero: **0 voci morte su 16** — il gate nasce verde.

### 3.7 Un lettore solo per lo sfoglio

Con le tendine, `search({tipo,famiglia})` sopravvivrebbe come **seconda definizione** di «le
righe di questo gruppo», libera di divergere. `browseFamilies` diventa l'unico lettore dello
sfoglio; `search` resta la ricerca testuale. Spariscono `browseSlice`, `filterByFamily` e i
campi di `searchInputSchema` che servivano solo allo sfoglio. La paginazione **dentro** un
gruppo muore: la usavano 8 gruppi su 102.

---

## 4. Il disegno delle schermate

Registro **Product**, dentro `DESIGN.md` esistente. Nessuna estetica nuova.

### 4.1 Livello 1 — due tipi di tessera, entrambe piene

- **Gruppo-modello** (63): tessera verticale, **foto grande** sopra, nome, «N codici».
- **Gruppo-tipologia** (39): tessera di **solo testo**, nome più grande, «N codici».
  Nessuna area immagine, quindi **nessun buco grigio**: un riquadro vuoto in una griglia si
  legge come immagine rotta, una tessera di testo si legge come una tessera di testo.

La distinzione **non è un nostro giudizio**: un gruppo è un modello se `ARCHIVI` (la
struttura dell'archivio fotografico ufficiale di COLOMBO) gli assegna un archivio.

Griglia 2 colonne a 375px, 3 da `sm`, 4 da `lg`. Ordine alfabetico. Il campo che filtra le
etichette resta: è ciò che rende sopportabile la lunghezza.

**Costo dichiarato**: con la foto grande i 102 gruppi passano da ~6 a ~12 schermate a 375px.
Scelta consapevole dell'utente, con l'alternativa compatta (miniatura di fianco) misurata e
scartata.

### 4.2 Livello 2 — tendine native

`<details>`/`<summary>` **nativo**, controllato dall'URL.

- **Intestazione**: `[foto 56px] [SERIE in mono] [N codici] [chevron]`, altezza minima 56px.
- **Aperta**: la foto scende a **32px** e le righe articolo compaiono su fondo
  `surface-sunken`. Nessun bordo laterale colorato (vietato dal sistema), nessun rientro (a
  375px lo spazio orizzontale non c'è).
- **Motion**: solo la rotazione del chevron. Nessuna animazione di altezza.

Il tag nativo dà tastiera, `aria-expanded` e lo stato di apertura senza scriverli. E ha un
effetto che nessuna implementazione a mano avrebbe: **una tendina chiusa tiene le sue righe
nel DOM ma con `display:none`, quindi il browser non scarica le loro foto.** Il costo di
rete è quello che si apre, non quello che si manda.

**La foto resta nell'intestazione anche aperta** (56 → 32px): con tre tendine aperte le
intestazioni sono i soli punti di riferimento in una colonna di righe quasi identiche, e
toglierla proprio lì la toglierebbe quando serve. Non è una ripetizione: l'intestazione
ritrae il **modello**, le miniature delle righe le singole **finiture**.

### 4.3 Le parole

- Livello 2 = **«serie»**. È la parola di COLOMBO per esattamente questa cosa (il suo indice
  stampa «130 round ID25», «128 robot CD45») ed è già il nome del campo in
  `foto-archivio.ts`. «Famiglia» non era mai stata introdotta a schermo.
- I codici che una serie non ce l'hanno stanno sotto **«Codici senza serie»**.
- L'URL resta `?fam=` — i link condivisi valgono più della coerenza del nome interno.
- **La frase «come li nomina COLOMBO» va corretta**: è già falsa oggi, prima delle fusioni,
  perché `ROBOCINQUE S` è una stringa che componiamo noi.

### 4.4 Quale foto rappresenta una serie

La prima riga **per codice** che ne ha una, **preferendo il sottoinsieme visibile**: col
filtro colore su Neromat non si mostra il cromo. Dentro una serie tutti i codici sono lo
stesso modello in finiture diverse, quindi l'arbitrio si riduce alla finitura — e la
finitura segue il filtro. Nessuna foto dove nessun membro ne ha una.

---

## 5. Confini dei moduli

| Modulo | Responsabilità | Dipendenze |
|---|---|---|
| `taxonomy.ts` | prima parola, secondo token, famiglia dalla descrizione | `code-norm` |
| `curatela.ts` | etichette di sfoglio **per marca**: fusioni, esclusioni, divisioni | `taxonomy` |
| `browse.ts` | **la regola delle serie a tre gradini** e la scelta della foto di anteprima. TypeScript puro: è una regola di dominio, come la disponibilità | `taxonomy` |
| `search.ts` | raw SQL: ricerca testuale e `GROUP BY` di livello 1 | `taxonomy`, `curatela` |
| `article.ts` (router) | orchestrazione, filtri, proiezione | i precedenti |

La regola di dominio resta **fuori** dal raw SQL: al `$queryRaw` arriva al massimo una lista
di id già decisa, come per la disponibilità e la finitura.

---

## 6. Prove

- **Gate del contratto**: acceso `?pronta=1` (e `?finitura=`), **nessun articolo cambia
  serie** rispetto all'insieme intero. È il test che avrebbe intercettato il difetto di §3.1.
- **Gate della curatela viva**: ogni voce di `FUSIONI`/`ESCLUSE`/`DIVISE` aggancia almeno
  una riga del listino reale (integration, oggi 16 su 16).
- **Golden delle serie** sui gruppi misurati: ROBOQUATTRO S, ROSETTA, KIT, POMOLINO, FEDRA.
  Il caso segnalato dall'utente è un'asserzione nominata: `0ID51RSMY-CM` sta in `ID51R`.
- **Gate dei 27 ambigui**: restano senza serie, non si assorbono a caso.
- **Gate delle fusioni e delle foto**: nessuna fusione sposta l'assegnazione di una foto di
  modello (oggi vero per tutte e sette; `LUNDCREM` è escluso proprio per questo).
- **Gate degli URL**: `?tipo=MANIG.` risolve su `MANIGLIA INCASSO`; `?fam=X` apre la tendina.
- **Browser reale**: Chromium desktop e **375px**, screenshot guardati.

⚠️ **Dipendenza dichiarata**: in locale `articles.image_url` è vuoto (le foto le materializza
lo script ops `foto:colombo`, che richiede la password dell'area download COLOMBO e il token
Blob). Senza, la verifica in browser delle foto si fa **intercettando `/api/article-image`**
come nella sessione precedente, e va dichiarato quale tratto non è provato dal vivo.

---

## 7. Costo, prima di pagarlo

- **Nessuna migrazione del database.** Serie, fusioni e foto di anteprima si calcolano **a
  lettura**: il listino aggiornato si colloca da solo.
- **Nessuna finestra di disservizio**, nessun run ops, nessun re-import.
- **Nessuna dipendenza nuova.**
- L'unica azione è il deploy.

## 8. Fuori scope, dichiarato

- Il livello 1 mescola tipologie (MANIGLIONE) e nomi commerciali (ROBOT): l'Estraneo del
  council l'ha colto ed è vero, ma raddrizzarlo vuol dire una tassonomia a due assi, che
  nessuna fonte di COLOMBO pubblica. Fuori scope, annotato.
- Un tool della chat per il reparto maniglie (`chat/tools.ts` espone solo AGB): è il ponte
  fra i due reparti, ed è la ragione per cui il council tenne un'app sola. Lavoro futuro.
- Mostrare ad Andrea le etichette non curate (`pnpm tassonomia:report`).
- Un diff all'import che avvisi quando il listino nuovo sposta le serie.
