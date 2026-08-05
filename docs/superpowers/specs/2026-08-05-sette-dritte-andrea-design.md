# Le sette dritte di Andrea — design

> 2026-08-05 · reparto MANIGLIE · branch `claude/uftrade-handles-catalog-fixes-q5mc0o`
> Workflow: `/brainstorming` → misure sul listino e sull'archivio veri → `/llm-council`
> (5 advisor + 3 peer review, affermazioni **verificate nel repo**) → `/impeccable` →
> questa spec.

Andrea, addetto al rifornimento magazzino, ha verificato lo sfoglio nuovo (PR #58) e ha
mandato **cinque** correzioni; rispondendo alle domande ne ha aggiunte **due**. Sono sette.

---

## 0. Verifica preliminare: le fonti non sono cambiate

Prima di ogni cosa, rimisurato ciò su cui poggiano le decisioni della sessione scorsa:

| fonte | atteso | misurato |
|---|---|---|
| listino `LP 02-26` | 3.456 righe | **3.456** ✅ |
| prime parole distinte | 114 | **114** ✅ |
| gruppi dopo curatela | 94 | **94** ✅ |
| archivio foto (79 zip) | 707 foto | **707** ✅ |
| abbinamento attuale | 2.118 (61,3%), 240 file | **2.118 / 240** ✅ |

Le misure di `handoff.md` reggono. Non sono state rifatte.

---

## 1. Copiare un codice lo copia senza separatori

**Il difetto.** Premendo sul codice si copia `0ID41R-CR`; Andrea lo vuole `0ID41RCR`,
che è la forma con cui il gestionale e il file di magazzino nominano lo stesso pezzo.
**La preview a schermo non cambia**: si vede col trattino, si copia senza.

**Il vincolo.** `CopyCodeButton` (`src/components/product/copy-code-button.tsx`) è
condiviso col reparto serramenti, dove i codici sono `A50122.08.07`: togliere i punti
**lì sarebbe sbagliato**.

**La soluzione.** Una prop separata per «cosa copiare», che di default è ciò che si vede:

```ts
export function CopyCodeButton({ code, copyAs }: { code: string; copyAs?: string })
// copia `copyAs ?? code`
```

Il default preserva il reparto serramenti **senza toccarlo**: nessuna chiamata esistente
cambia comportamento, e il tipo non permette di dimenticare il caso normale.

**Il valore da passare esiste già** ed è `articles.code_norm`, prodotto da
`normalizeArticleCode` (`src/server/maniglie/code-norm.ts`): non si calcola in UI e non
nasce una colonna. L'unico chiamante che lo passa è la scheda articolo
(`maniglie/[id]/articolo-client.tsx`).

**Perché non normalizzare in UI**: sarebbe una *seconda* implementazione della stessa
regola, libera di divergere da quella che ha scritto la chiave a DB — e la chiave a DB è
ciò con cui si aggancia la pronta consegna.

---

## 2-7. La curatela: sei correzioni alle etichette

Tutte a **lettura**, in `src/server/maniglie/curatela.ts`, **per marca**. Nessuna tocca
`articles.name`: riscrivere il nome cancellerebbe la parola di COLOMBO e farebbe sparire
`BOCCEHTTA` dall'indice trigram.

### 2. `PL.` → `PLACCA`

La sessione scorsa le teneva separate perché misurate come due prodotti (placche in
ottone `PB02*` contro placche dei maniglioni `0AM113PL*`). **Andrea è la fonte di verità
sulla sua tassonomia.** Misurato che la fusione non perde nulla: 87 codici che il livello 2
divide in **14 serie** (`PB02` 8, `PB02Y` 8, `PB02Q` 3, `PB02YQ` 3 da una parte;
`AM113` 9, `CD02PL` 9, `PLY85` 9, `PL70` 8, `PL90` 8, `LC113` 5… dall'altra).

### 6. `HEIDI/PETER` → `HEIDI` e `LUNDCREM` → `LUND`

Misurate: sono **3 codici in tutto** — `0CD32-OL`, `0CD32-UB` («HEIDI/PETER CREM CD32») e
`0SE12-GM` («LUNDCREM SE12»). Sono **cremonesi**; HEIDI e LUND sono maniglie **con
archivio fotografico**.

⚠️ **La fusione da sola produrrebbe una foto sbagliata**, e la regola sulle finiture del
punto 3 **non** la intercetta: `0CD32-UB` prenderebbe `Heidi_R_UB`, cioè finitura
*provata giusta* e **prodotto sbagliato**.

**Rimedio (scelta dell'utente): la `serie` dichiarata sugli archivi.** `01_Heidi` →
`serie: "CD31"`, `01_Lund` → `serie: "SE11"`. Riusa il meccanismo che già esiste per
ROBOT (`CD41`/`CD75`) e per MOOD (`CC11`/`CC21`/`CC31`/`CC41`).

**Dichiarato onestamente**: la fonte qui è il **listino** («HEIDI CD31R» contro
«HEIDI/PETER CREM CD32»), non i nomi dei file. Il commento della `VoceArchivio` dice
«solo dove COLOMBO l'ha scritta»: COLOMBO l'ha scritta, in un altro suo documento. Va
detto nel codice, non lasciato intendere.

### 7. `COPPIA` si scioglie

Andrea: *«la categoria COPPIA secondo me non ha senso. Per esempio al suo interno c'è
COPPIA BOCCHETTE YALE, ma tutta quella sottocategoria dovrebbe stare dentro BOCCHETTE.
Vale lo stesso per tutto il resto che c'è dentro COPPIA.»*

Misurato: 35 codici, e sono **puliti** — `COPPIA MANIGLIONI` **7**, `COPPIA BOCCHETTE`
**28**, nient'altro.

**Regola nuova: le prime parole TRASPARENTI.** `COPPIA` non è il prodotto, è la
confezione: l'etichetta viene dal **secondo** token, che poi passa **dalla stessa tabella
di fusioni** di tutti gli altri.

⚠️ **Trovato misurando, non leggendo**: `COPPIA BOCCHETTE` produce `BOCCHETTE`, un
plurale che la tabella non conosceva → sarebbe **nato un gruppo nuovo da 28 codici**
invece di confluire. Serve la riga `BOCCHETTE: "BOCCHETTA"`. (`MANIGLIONI → MANIGLIONE`
c'era già.) Senza la misura, il difetto non sarebbe andato a zero da nessuna parte.

Nessuna delle due destinazioni ha archivio fotografico → **nessun rischio foto**.

### L'esito: 94 → 90 gruppi

`BOCCHETTA` 290 → **318** · `MANIGLIONE` 346 → **353** · `PLACCA` 65 → **87** ·
`HEIDI` 20 → **22** · `LUND` 27 → **28**. Codici sfogliabili: 3.391.

---

## 3. Le foto della finitura sbagliata

Andrea: *«alcune categorie hanno la foto corretta per ogni prodotto, altre la stessa foto
per finiture diverse. Per esempio la DUE CC31R hanno tutte la foto della maniglia blu. Se
mancano le foto delle giuste finiture è meglio togliere direttamente le foto per quel
prodotto, perché confondono e sono fuorvianti.»*

### 3.1 Il match ingenuo sarebbe stato un generatore di errori

`FINITURE` ha già il campo `nome` per tutte e 31. Cercarlo come **sottostringa** dà
risposte sbagliate, e sono dimostrate:

| nome file | match ingenuo | verità |
|---|---|---|
| `lund cromo matte` | Cromo (CR) | **Cromat (CM)** |
| `Laconica_still_04 Umber bronze` | Bronze (C02) | **Umber Bronze (UB)** |
| `R6_still_04 Silvermat` | Silver (C04) | **Silvermat (SM)** |
| `963 verticale cromo-cromo matte` | Cromo | **bicolore, nessuna delle 31** |

La prova per «cromo matte»: **nello stesso archivio `01_Ama`** COLOMBO scrive
`ama zero frontale cromat` sulla variante zero e `ama cromo matte` su quella liscia.
Stessa finitura, due generazioni di nomi.

### 3.2 Il vocabolario chiuso

Dai 707 file, **638 sono scatti di prodotto**; togliendo il nome del modello (ricavato
dalla cartella, non da un elenco a mano), le parole di inquadratura e i numeri restano
**195 code distinte**, tutte guardate. Il riconoscitore che ne esce:

1. **match più lungo** fra i 31 nomi normalizzati (`matte`→`mat`, separatori via);
2. **6 alias ricavati dal vocabolario**: `cromo mat`→CM · `oro mat`→OM · `nero mat`→NM ·
   `bianco mat`→BI · `matte white`→BI (ordine invertito) · `nickel mat`→NI;
3. **rifiuto dei bicolori**: se il nome contiene due finiture distinte, la risposta è
   `null`. Mai una delle due.

**Cosa resta fuori di proposito**: i codici che COLOMBO non pubblica — `OP` (19 file),
`NK`, `GR`, `SS`. Dedurre `OP` = Oroplus sarebbe indovinare, ed è la classe di errore che
ha fatto disattivare i moduli kit PVC e battente. Restano `null` → domanda aperta per
COLOMBO.

### 3.3 Riconoscere i nomi non serve a misurare: serve a SCEGLIERE

`abbinaFoto` al gradino 1 fa già `esatta ?? candidate[0]`, dove `esatta` cerca la foto
della finitura giusta. Insegnandogli a leggere anche i nomi a parole, **quella ricerca
inizia a trovare**:

| | foto | provate esatte | provate sbagliate |
|---|---|---|---|
| oggi, misurato onestamente | 2.118 | 1.033 | **350** |
| **col solo riconoscitore, zero foto tolte** | 2.118 | **1.298** | **149** |

**Il caso di Andrea si chiude qui**: DUE e ONE (Mood, C01–C12) passano da 88 sbagliate su
96 a **zero**. L'archivio *ha* la foto di ogni colore (`due frontale capri blue`,
`…lemon yellow`); non sapevamo leggerne il nome.

### 3.4 Il gradino 3 non era «esatto per costruzione»

L'handoff lo dava per esatto. È vero sul **modello**, **falso sulla finitura**: il
gradino 3 aggancia il codice **senza** la sua coda, quindi i 12 colori di
`MANIGLIONE CC113/Q` cadono tutti sull'unico file `CC113Q ocean blue`.

| gradino | foto | esatte | sbagliate | ignote | senza coda |
|---|---|---|---|---|---|
| 1 (modello) | 1.796 | 1.281 | 55 | 332 | 128 |
| 3 (codice nel nome) | 322 | 17 | **94** | 207 | 4 |

Misurato anche che far preferire al gradino 3 la finitura giusta **non recupera quasi
nulla** (13 → 17): l'archivio, per quegli accessori, ha **una** foto e basta.

### 3.5 I «non decidibili» non sono un'incognita

Delle 539 foto la cui finitura non si legge, **441 stanno su un file conteso da finiture
diverse**. In tutto: **667 articoli si contendono 72 file** → al più 72 mostrano la
finitura giusta, gli altri **almeno 595 no**. Questo si dimostra **senza** saper leggere
la finitura della foto: se *n* articoli di finiture diverse ricevono lo stesso file, al
più uno è giusto.

### 3.6 La regola scelta (opzione **b**)

> **Una foto contesa resta solo a chi può dimostrare che è sua.**

Un articolo tiene la sua foto se e solo se:

- **non ha coda di finitura** (132 articoli: non affermano nulla, non possono sbagliare); o
- la finitura della foto è **provata uguale** alla sua (1.298); o
- il file **non è conteso** — nessun altro articolo di finitura diversa lo riceve (98).

Copertura: **2.118 (61,3%) → 1.528 (44,2%)**.

Le alternative misurate e scartate: (a) togliere le sole provate sbagliate → 1.969
(57,0%) ma lascia a schermo 441 articoli su file contesi; (c) prova o niente → 1.430
(41,4%), che costa 98 foto in più per zero disonestà provata in meno.

È la stessa regola già applicata a SPIDER, MILLA e TRAMA: **non si indovina**.

### 3.7 Dove vive la regola

Nel modulo puro `foto-archivio.ts`, non nello script: `abbinaFoto` deve **restituire già
la mappa giusta**, così il gate d'integrazione sul catalogo vero la misura, e lo script
`foto:colombo` resta un trasportatore di byte.

✅ **Verificato**: `scripts/foto-colombo.ts:207` azzera `imageUrl` su **tutti** gli
articoli della marca prima di riscrivere quelli abbinati, nella stessa transazione.
Quindi le 590 foto tolte spariscono da sole al run: la regola non può restare scritta e
inerte. (Era il rischio da controllare: uno script che scrivesse solo i nuovi avrebbe
lasciato a schermo esattamente le foto che la regola dichiara sbagliate.)

---

## 4. La sezione «Accessori»

### 4.1 La lista è di Andrea, non dei dati

**17 gruppi**: BATTIPORTA(4) BLOCCAPORTA(2) BUSSOLA(4) COPRIAVVOLG.(6) DISPOSITIVO(10)
DUMMY(10) FERMAPORTA(24) INSERTO(6) KIT(140) MOLLA(9) MOSTRINA(24) MOVIMENTO(39)
NOTTOLINO(162) PLACCA(87) PROLUNGA(2) QUADRO(14) ROSETTA(105) — **648 codici, 19,1%**.

Non è deducibile: i cinque gruppi di pomoli (POMOLO, PUSH, ROUND, SQUARE, CUT) hanno
l'archivio fotografico e non sono maniglie; MILLA, SPIDER e TRAMA sono maniglie e
l'archivio non ce l'hanno. **POMOLINO non è nella lista** e resta prodotto principale.

⚠️ **Collisione di nomi da dichiarare nel codice**: `foto-archivio.ts` chiama già
«accessori» le sezioni d'archivio COLOMBO (`02_Pomoli`, `03_Maniglioni_Pulls`), e POMOLO
e MANIGLIONE **non** sono negli ACCESSORI di Andrea. Due sensi della stessa parola nello
stesso reparto.

### 4.2 Il verdetto del council: sezione, non livello e non filtro

`/llm-council`, 5 advisor + 3 peer review. **4 su 5 per la sezione.** (A) quarto livello
scartata all'unanimità: farebbe della nostra unica parola non-COLOMBO la prima domanda
posta a ogni utente.

**Il dissenziente** (Primi Principi) voleva un filtro, con l'argomento più elegante — «le
proprietà del *compito* vanno nelle lenti, quelle dell'*oggetto* nella struttura;
ACCESSORI è un fatto su Andrea» — e il suo argomento decisivo **si rovescia sul codice**:
sostiene che il filtro «sparisce entrando in un gruppo, quindi il gruppo pieno che sembra
vuoto è impossibile», ma `codaFiltri()` (`sfoglia.tsx:56`) incolla i filtri a **ogni link
di gruppo** proprio perché un filtro non si spenga in silenzio scendendo. Un terzo
controllo che fa il contrario dei due accanto è un'incoerenza nuova. E il suo
`?cat=maniglie` conierebbe una **seconda** parola nostra, per giunta falsa.

Cade anche la sua obiezione alla sezione («rompe l'alfabeto in modo invisibile»): il
filtro etichette lavora sull'array intero **prima** della partizione (`:105`).

### 4.3 Il disegno

```
Sfoglia il catalogo                      Accessori (17) ↓
90 gruppi in ordine alfabetico. Il numero è quanti codici…
Viti, dadi, chiavi e rondelle non si sfogliano…
[ Filtra i gruppi…                                       ]

[963] [ALATO] [ALBA] …  73 tessere, NESSUNA intestazione …
──────────────────────────────────────────────────────────
Accessori
«Accessori» è un raggruppamento nostro: le altre etichette
sono parole del listino COLOMBO.
[BATTIPORTA] [BLOCCAPORTA] …  17 tessere …
```

**La banda di sopra non ha titolo, e non è una svista.** Qualunque nome sarebbe falso —
«Maniglie» starebbe sopra BOCCHETTA (318), MANIGLIONE (353), POMOLINO (41), GRANO (3) —
oppure sarebbe una seconda parola nostra. **Misurato**: dei 27 gruppi di solo testo, 17
sono accessori e **10 no** (BOCCHETTA, GRANO, MANIG.CD213, MANIG.LC413RS, MANIGLIA
INCASSO, MANIGLIONE, MILLA, POMOLINO, SPIDER, TRAMA).

Effetto collaterale prezioso: il giorno che COLOMBO aggiunge un gruppo e nessuno lo
classifica, quel gruppo cade in una banda che **non afferma nulla**. L'obiezione del
Contrarian («la classificazione si degrada in silenzio») **si scioglie nel disegno**
invece che in un test impossibile. Resta la sentinella già usata per la curatela: se un
nome dichiarato accessorio non esiste più a listino, il test fallisce col proprio nome.

**Le tessere accessorio sono identiche a quelle di sopra**, stessa griglia e stessa
densità. Un accessorio e un MANIGLIONE sono **lo stesso oggetto** a schermo (entrambi
tessere di solo testo): renderli diversi affermerebbe una differenza che non c'è.

**Il collegamento** sta sulla riga dell'`<h2>`, allineato a destra, `<a href="#accessori">`:
nessun JS, il tasto indietro funziona da sé. **Sparisce quando il filtro svuota la banda.**

**Il campo filtro impara la parola.** Oggi `g.word.includes(cerca)`: digitando «accessori»
non si troverebbe nulla *mentre la parola è a schermo*. Da **≥3 caratteri** che siano
prefisso di `ACCESSORI`, i 17 compaiono tutti.

### 4.4 Cosa NON si fa

- **Niente `?cat=` nell'URL.** Non è stato, è l'ordine della pagina. Un terzo filtro che
  si interseca con «pronta» e «finitura» darebbe **sette** modi diversi di avere un
  elenco vuoto.
- **Niente riordino col filtro «Solo pronta consegna» acceso**, benché lì gli accessori
  pesino il **31,5%** invece del 19,1% (misurato: 56 accessori pronti su 178; 8,6% degli
  accessori è pronto contro il 4,4% del resto). La griglia si sposterebbe fra un tocco e
  l'altro.
- **Niente fondo colorato né bordo laterale** fra le bande: i bordi laterali sono vietati
  dal sistema, e un fondo diverso si legge come «disattivato».
- **Niente chip più fitti** per gli accessori: sarebbe una terza forma di tessera dopo che
  la sessione scorsa ne ha stabilite due.

---

## 5. L'anteprima della tendina

Andrea: *«la foto della tendina che si rimpicciolisce quando si apre confonde e non serve
a nulla quando è piccola perché non si vede.»* La scelta era dell'utente fra tre opzioni:
**non è una regressione, è una prova sul campo che ha battuto una preferenza.**

**La regola è una sola, ed è già scritta al livello 1: la foto compare dove distingue, non
dove ripete.**

| | oggi | nuovo |
|---|---|---|
| dentro un **gruppo-modello** (63) | 56px → 32px all'apertura | **nessuna area immagine** |
| dentro una **tipologia** (27) | 56px → 32px | **56px, fissa, sempre** |

Dentro FEDRA le anteprime delle serie sono la stessa maniglia in varianti: la foto non era
piccola, era **ripetuta**. Toglierla lì è il rimedio vero. Dentro BOCCHETTA (22 modelli) e
MANIGLIONE (52) distingue davvero, e lì resta — **ferma**: rimpicciolirla è un'animazione
di layout su una proprietà di layout, cioè la cosa vietata dal sistema **e** quella di cui
Andrea si lamenta.

⚠️ **Sembra una contraddizione e non lo è**, e va scritto nel codice perché qualcuno la
«correggerà»: al livello 1 `isModello` **accende** la foto, al livello 2 la **spegne**.
Stesso principio, unità diversa — la tessera ritrae *il modello intero* (informativa), la
riga ritrae *una serie dentro quel modello* (identica alle sorelle).

**Il segnaposto sparisce.** Con la copertura che scende al 44,2% le anteprime mancanti
diventano frequenti: otto riquadri `<Package>` grigi in colonna si leggono come «il
programma è rotto». Al loro posto uno spazio della stessa misura, senza bordo e senza
fondo: l'allineamento regge e l'assenza si dice tacendo.

**Cosa NON si fa**: niente foto solo-da-chiusa (con tre tendine aperte le intestazioni
sono i soli punti di riferimento, e una che cambia forma aprendosi è la stessa lamentela
in altra veste) · niente pastiglia del colore al posto della foto (una serie contiene molte
finiture: sarebbe la stessa bugia della foto unica per una categoria).

---

## Il costo

| | migrazione | run ops | finestra di disservizio |
|---|---|---|---|
| 1 copia senza separatori | no | no | no |
| 2-7 curatela (etichette) | no | no | no — si calcola a lettura |
| 3 foto | **no** (`image_url` esiste già) | **sì: «Ops — Foto COLOMBO»** | no |
| 4 sezione Accessori | no | no | no |
| 5 anteprima tendina | no | no | no |

**Un solo run ops**, ~7 minuti, idempotente, e **nessuna migrazione in tutta la sessione**.
Il run non carica foto nuove: ricalcola gli abbinamenti e **azzera** quelli che la regola
toglie. Nessuna finestra di disservizio: fra il deploy e il run, le foto restano quelle
vecchie — cioè lo stato di oggi, non uno stato rotto.

## Le sentinelle

- `abbinaFoto` non deve mai restituire un articolo la cui finitura è **provata diversa**
  da quella della foto (gate d'integrazione sul catalogo vero).
- Ogni nome dichiarato accessorio esiste fra le etichette del listino (come `vociCuratela`).
- `CopyCodeButton` senza `copyAs` copia ciò che mostra (protegge i serramenti).
- La banda di sopra **non ha** intestazione, e il test lo asserisce dopo aver dimostrato
  di guardare nel posto giusto.

## Fuori scope, dichiarato

- **POMOLINO, BOCCHETTA, MANIGLIONE, GRANO** non sono accessori: è la lista di Andrea.
- I codici finitura non pubblicati (`OP`, `NK`, `GR`, `SS`) restano illeggibili → domanda
  aperta per COLOMBO, insieme a quale archivio sia MR11/MR15, LC31/LC41, LC71/LC81.
- Le fusioni non ancora decise: `MANIG.CD213`, `MANIG.LC413RS`.
