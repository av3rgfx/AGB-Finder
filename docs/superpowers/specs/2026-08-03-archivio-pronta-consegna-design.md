# Archivio pronta consegna (COLOMBO) — design

**Data:** 2026-08-03 · **Stato:** spec approvata dall'utente, da implementare
**Richiedente:** Andrea, addetto al rifornimento magazzino (acquisti/riordino)
**Decisione architetturale:** verdetto `/llm-council` del 2026-08-03 (5 advisor + 5 peer review + chairman)

---

## 1. Il problema

Andrea acquista e riordina la merce di magazzino. Gli agenti, dal cliente, hanno
bisogno di sapere una cosa sola: **questa maniglia ce l'abbiamo o va ordinata?**
Oggi la risposta è una telefonata ad Andrea.

Quella telefonata è il metro di paragone, non un ostacolo da rimuovere: risponde in
venti secondi, senza password e senza rete. Qualunque cosa costruiamo deve batterla,
e ogni attrito — un secondo login, un dato di ieri, un «codice non trovato» su una
maniglia che è sullo scaffale — riporta gli agenti al telefono, definitivamente.

Andrea ha fornito tre file. Si parte da **COLOMBO**; seguiranno **almeno altre tre
marche**, con cataloghi «probabilmente più complessi».

---

## 2. La decisione: A′ — stesso repository, dominio affiancato, identità intatta

Portata al council la domanda «aggiungere a UFPtrade o software separato?». Tre
advisor su cinque per l'integrazione, uno per il repo separato, uno che si rifiuta di
votare e demolisce entrambe le versioni ingenue. Il monorepo con pacchetti condivisi è
scartato all'unanimità (pnpm workspace su un ambiente con il pin fragile a pnpm 10 per
gli override di `better-call`: attrito immediato per condividere codice congelato).

**Il criterio che decide** non è «utenti in comune», né «riuso di codice», né «rischio
di deploy» — sono costi, non discriminanti. È: **esiste una domanda che l'agente farà
davanti al cliente e che attraversa i due domini, con una risposta sola?** Sì:
*questo è ordinabile oggi?* La disponibilità è un'entità unica, e in due repository
diventa una chiamata cross-app che non verrà mai scritta.

L'argomento del dissenziente («in un repo solo ogni `ALTER TABLE` mette a rischio il
generatore di distinte») è stato respinto su due fatti verificati: (a) la premessa
«entità condivise: zero» è smentita dal repo — vedi §3; (b) la finestra di disservizio
è un problema **già chiuso** dalla PR #44, lanciando «Ops — Neon» sul ref del branch
prima del merge. E la causa dell'incidente della PR #40 (`findFirst` senza `select`)
**si copia con la copia**: un repo nuovo nascerebbe col difetto dentro.

### Cosa condivide e cosa no

| | |
|---|---|
| **Condivide** | repository, deploy, ambienti e segreti, workflow ops, **un solo Better Auth** (chi lascia l'azienda si disattiva in un posto solo), layout e componenti UI, **stesso database fisico** |
| **NON condivide** | **la tabella `Product`**. Tabelle proprie, ricerca propria, namespace Blob proprio. Nella prima release gli articoli COLOMBO **non entrano** né in `product.search` né nei tool della chat AI |
| **Rimandato** | la migrazione dell'identità del prodotto (modello `Supplier`, sciogliere `agbCode @unique`, `ProductImage.agbCode @id`, `LISTINO_TOTAL_PAGES` scalare, namespace delle paginette Blob). Si farà **quando arriva la marca #3**, con quattro cataloghi sul tavolo che dicano che forma deve avere — non oggi, indovinandola su uno |

Il riuso della pipeline listino→catalogo avviene **copiando il pattern**, non estraendo
un'astrazione multi-fornitore. `agbCode` compare **128 volte in 22 file** non-test:
non è una colonna `supplierId`, è una migrazione dell'identità, e va fatta quando ci
sono i dati per deciderne la forma.

---

## 3. Prerequisito bloccante: la disponibilità falsa già in produzione

Trovato dal council e **verificato**: `src/server/catalog/map-product.ts:11,75` scrive
`isAvailable: true` e `stockQuantity: 0` come **tipi letterali costanti** per ognuno dei
7.488 prodotti AGB. Il valore non è inerte, esce da quattro canali:

| Canale | Dove |
|---|---|
| UI | `product-card.tsx:36` · `product-row.tsx:12` · `product-detail.tsx:80-81` · `inline-products.tsx:60-63` — pallino verde «Disponibile» |
| Semantico | `rag.ts:67-68`, `rag.ts:230` — trasportato nelle due proiezioni raw SQL |
| **Assistente AI** | `chat/tools.ts:96,123-124` — `available` e `stock` passati a **Gemini**, che può affermarlo al cliente. E `tools.ts:41,64` **offre al modello** il filtro `inStockOnly` |
| **Filtro «Solo disponibili»** | `product-filters.tsx:83-91` (la casella) · `active-filter-chips.tsx:46-48` (il chip attivo) · `archivio-search-params.ts:6,31,48` (il param URL `stock=1`) · `product.ts:13` · `rag.ts:11,85` (`p.is_available = true`) |
| Kit | `kit.ts:457` — selezionato sulle righe di distinta, **mai mostrato** |

**Il quinto canale è il peggiore, ed è stato trovato scrivendo il piano, non la spec:** l'agente può **spuntare una casella** che dice «Solo disponibili», vedere comparire il chip del filtro attivo, e ricevere tutti e 7.488 i prodotti. Un pallino che mente lo si può ignorare; un filtro che si è scelti di applicare, no.

C'è pure `@@index([isAvailable])` in `schema.prisma`: un indice su una costante.

**Non si può introdurre la parola «pronta consegna» in un'app che dice già
«Disponibile» su tutti e 7.488 i codici**: l'agente si troverebbe due parole in
contraddizione e crederebbe alla più vecchia. È l'ottavo caso della classe «valore
deciso dal programma e mai dichiarato» che questo progetto ha già chiuso sette volte.

**Prima PR, indipendente e senza migrazione:** rimuovere i due campi dai quattro
canali. `stockQuantity` e `isAvailable` restano a schema (rimuoverli è una migrazione
distruttiva senza guadagno), ma nessuno li legge più finché non esiste una fonte di
disponibilità AGB vera.

---

## 4. I dati reali (misurati, non assunti)

### 4.1 Tre fonti, tre popolazioni, tre formati dello stesso codice

| Fonte | Che cos'è | Consistenza |
|---|---|---|
| **Listino `LP 02-26`** (xlsx) | ciò che è **ordinabile** | 3.456 codici unici · prezzo, surcharge 3,5%, somma, EAN · **zero prezzi mancanti, zero EAN mancanti** · descrizioni troncate a 35 caratteri |
| **Pronta consegna** (xls) | ciò che è **sullo scaffale** | 201 codici, una sola colonna |
| **Catalogo `ER MAN 2026`** (pdf) | ciò che COLOMBO **mostra** | 261 pagine · 725 immagini **JPEG** · testo recuperabile con **shift costante di +29 byte** (font CorelDRAW senza ToUnicode) · scelto fra i quattro cataloghi maniglie pubblicati, vedi §4.3 |

**Nessuna delle tre è contenuta nelle altre.** È il fatto strutturale su cui poggia
tutto il modello.

**Lo stesso codice è scritto in tre modi:**

| Fonte | Forma | Esempio |
|---|---|---|
| Listino | con separatori | `0CD41R-CM` · `PB01/Q-CM` |
| Pronta consegna | senza separatori | `0CD41RCM` · `PB01QCM` |
| Catalogo | spaziata | `SE 11 R-RY` · `ID 36` |

**Normalizzazione** = soli caratteri `[A-Z0-9]`, maiuscoli. Sul listino produce
**zero collisioni** (verificato su tutti e 3.456 i codici): è quindi una chiave sicura.
Applicata alla pronta consegna: **178 match su 201**.

### 4.2 I 23 orfani (11%) — cosa sono, secondo Andrea

Codici che Andrea ha fisicamente a magazzino e che il listino **non conosce**.
Verificati uno per uno nel catalogo decodificato, e **poi confermati da Andrea**
(risposte del 2026-08-03):

| Classe | Codici | Cosa sono |
|---|---|---|
| **Il listino è vecchio** (18 codici) | `0ID81R*` · `0ID91R*` · `0ID82*` · `0ID92*` · `0AM15*` · `0AM25*` · `0AM41*` · `0AM42*` · `0CB16ZB*` · `0LC45*` · `0LC55*` · `0ID45*` · `0ID55*` · `0CD81RSYCB*` · `0CD42IM*` · `0CD42M*` | prodotti **veri**: esistono nel catalogo (`ID 81` pag. 63 · `AM 15` pag. 89 · `CB 16` pag. 101 · `LC 55` pag. 92…). Andrea: *«il listino che ti ho fornito è un vecchio modello, proverò a procurarmi quello aggiornato»* → **problema transitorio**, si riagganciano da soli al prossimo import di listino |
| **Refusi del magazzino** (2) | `0CD63CM`, `0CD63NM` | Andrea conferma: i codici giusti sono `0CD63FP-CM` **e** `0CD63GB-CM`. **Due** codici giusti per uno sbagliato → **non correggibile automaticamente**: sono due bocchette diverse e solo chi guarda lo scaffale sa quale c'è. Si corregge a monte, nel gestionale |
| **Spazzatura** (3) | `XALL` · `XMP` · `XGRATZ7SX` | Andrea: *«totalmente sbagliati, non saprei dirti il perché della loro presenza. Ignorali»* |

**Il programma non può distinguere le tre classi**: per il codice sono tutte
«non trovato a listino». Solo Andrea lo sa.

**Conseguenza sul modello:** se la pronta consegna è una **tabella di righe datate**
invece di una colonna sul prodotto, gli orfani **esistono per costruzione** — sono
righe di giacenza che non trovano un articolo (`articleId = null`). Non c'è nulla da
«gestire»: c'è solo da decidere chi li vede, ed è deciso (§7.3).

### 4.3 Copertura del catalogo — usare **ER MAN 2026**, non RR

Il `RR MAN 2026` fornito all'inizio copriva solo il 57% dei codici. Cercando la
differenza (47 linee commerciali assenti in blocco: PETER, LARA, MILLA, PEGASO,
CAMEO, SIRIO…) è emerso che l'area download di COLOMBO
(`download.colombodesign.com/?lang=it`) pubblica **quattro cataloghi maniglie**.
Scaricati e misurati tutti e quattro:

| Catalogo | Pagine | Immagini | Codici del listino con pagina tecnica |
|---|---|---|---|
| `RR MAN 2026` | 133 | 437 | 1.962 — **57%** |
| **`ER MAN 2026`** | **261** | **725** | **2.943 — 85%** |
| `Vision2026_maniglie` | 16 | — | 415 codici per nome |
| `MOOD_brochure_2025` | 36 | — | 403 codici per nome |

**ER è un sovrainsieme**: da solo copre tutti i nomi commerciali coperti dagli altri tre
messi insieme (71 su 96), e l'unione `ER ∪ RR` non aggiunge **nulla** (2.943 = 2.943).
Solo 4 famiglie compaiono in RR e non in ER (`BL22`, `RS120`, `RS121`, `YQ115`),
probabilmente rumore d'estrazione.

→ **Il catalogo di riferimento è `ER MAN 2026_100726.pdf`.** RR non serve.
Stessa codifica: testo con shift **+29**, codici in forma spaziata.

**Il 15% che resta fuori non è un catalogo mancante:** 513 codici, e sono
bocchette (281), rosette (47), movimenti (33), kit (28), placche (27), viti (21),
quadri (14), molle, rondelle, bussole. Minuteria e ricambi, che nessun catalogo
fotografa uno per uno. **La ricerca di ulteriori cataloghi è chiusa.**

**Difetto del listino, scoperto per strada:** le descrizioni sono digitate a mano e
contengono refusi — `BOCCEHTTA` (2 codici), `ROBOCINQUQ` (1). Conta per la ricerca per
nome: la sola ricerca full-text non li trova. Il ramo **trigram** (`pg_trgm`), che il
progetto usa già, li recupera — motivo in più per non fare a meno di quel ramo (§7.3).

### 4.4 Vincoli di piattaforma (verificati sulle fonti ufficiali, 2026-08-03)

**Vercel Hobby è vietato per uso commerciale.** Fair Use Guidelines: *«Hobby teams are
restricted to non-commercial personal use only»*, dove commerciale è *«any Deployment
used for the purpose of financial gain of anyone involved in any part of the
production of the project, including a paid employee»*. Un gestionale interno usato da
15-20 dipendenti ricade lì dentro. **Decisione dell'utente: passaggio a Pro entro
sabato 2026-08-08.** Pro si paga per membro del *team di sviluppo*, non per utente
dell'app: gli agenti non costano nulla in più, e si sbloccano anche le preview delle PR,
rotte da otto sessioni.

**Capacità a 20 utenti** (15 sulle maniglie, 20 giorni lavorativi, 80 immagini distinte
al giorno per utente, immagine media 40 KB — misurata sul catalogo COLOMBO: mediana
13 KB, foto prodotto vere 115 KB):

| Risorsa | Limite Free | Stima | Margine |
|---|---|---|---|
| Invocazioni | 1.000.000 | ~120.000 | ✅ 12% |
| Active CPU | 4 CPU-h | ~1 h | ✅ 25% |
| Fast Data Transfer | 100 GB | ~5 GB | ✅ 5% |
| **Fast Origin Transfer** | **10 GB** | ~4 GB | ⚠️ 40% |
| **Neon — storage** | **0,5 GB** | ~360-400 MB (stimato) | 🔴 72-80% |
| Neon — compute | 100 CU-h | ~40 CU-h | ✅ 40% |
| **Neon — egress** | **5 GB** | ~2 GB | ⚠️ 40% |
| Upstash Redis | 500K comandi | ~10K (solo chiamate AI) | ✅ 2% |

I tre punti caldi hanno **una sola causa**: le foto AGB stanno *dentro* Postgres
(`ProductImage.data Bytes`, 7.082 righe) e ogni miniatura fa il giro
Neon → funzione Node → browser, pesando su tre voci insieme. Da qui la decisione §6.4.
Sul piano Free l'autosospensione di Neon dopo **5 minuti** non è disattivabile: la prima
query dopo una pausa paga il risveglio — rilevante contro il metro dei venti secondi.

> **Da misurare, non stimare:** lo storage Neon attuale (dashboard Neon → progetto →
> Storage). È l'unico numero dedotto della tabella, ed è il messo peggio.

---

## 5. Utenti e permessi

| Ruolo | Vede |
|---|---|
| **ADMIN** (Andrea) | tutto il dominio magazzino + import + report + annullamento ultimo import |
| **AGENT** | ricerca e schede: codice, nome, descrizione, prezzo, stato di disponibilità, foto |
| Utenti «solo magazzino» | esistono: alcuni non entreranno mai nella parte AGB |

I prezzi sono **visibili a tutti** (decisione dell'utente).

**Navigazione separata dal primo giorno.** Chi entra solo per il magazzino e vede sei
sezioni che non lo riguardano ha già deciso che il software non è per lui. Il ruolo
dedicato (`MAGAZZINO`) è **fuori scope della prima release** — si ottiene lo stesso
risultato con la navigazione filtrata, e un ruolo nuovo tocca l'access-control di
Better Auth, che oggi regge auth, kit e utenti. Da riaprire se entrano utenti che non
devono vedere l'area AGB.

---

## 6. Modello dei dati

Tre tabelle nuove. **Nessuna tocca `Product`.**

### 6.1 `Article` — l'articolo a listino

Una riga per (marca, codice). Sorgente: il listino xlsx.

| Campo | Tipo | Note |
|---|---|---|
| `id` | cuid | |
| `brand` | String | `COLOMBO` oggi; le altre tre marche arrivano qui, non in tabelle nuove |
| `code` | String | come scritto a listino: `0CD41R-CM` |
| `codeNorm` | String | soli `[A-Z0-9]` maiuscoli: `0CD41RCM` — **la chiave di aggancio** |
| `name` | String | descrizione del listino (≤35 caratteri) |
| `priceList` | Decimal(12,2) | prezzo di listino |
| `surcharge` | Decimal(12,2) | il *temporary surcharge* (3,5%), **colonna a sé** |
| `ean` | String? | |
| `catalogPage` | Int? | pagina **fisica** del catalogo, se esiste |
| `imageUrl` | String? | URL Blob della foto, se esiste |
| `lastListingAt` | DateTime | data dell'ultimo import di listino che conteneva il codice |

Vincoli: `@@unique([brand, code])` · `@@unique([brand, codeNorm])` (le collisioni sono
verificate assenti: se un giorno ne comparisse una, il vincolo la fa esplodere
all'import invece di far agganciare in silenzio la riga sbagliata) · indice su `brand`.

**Il prezzo.** Andrea: *«nel listino è presente il prezzo già sommato e l'agente deve
vedere quello»*. Si mostra il totale, ma **si salvano le due metà**: il surcharge è
*temporary* per definizione, e il giorno che sparisce serve sapere quale metà togliere.
Verificato che le due cose coincidono: su **tutte e 3.456 le righe**, arrotondare le due
metà e sommarle dà lo stesso risultato della colonna `SOMMA` arrotondata (zero
differenze). Il totale resta **derivato, mai persistito** — stessa regola di
`totalPrice` nel kit.

**L'arrotondamento va dichiarato, perché il file non è mostrabile così com'è:** il
**96%** delle righe della colonna `SOMMA` ha più di due decimali (`104,535`), e il 36%
ne ha 13-16 per errori di virgola mobile di Excel (`99,25649999999999`). Si mostra a
**due decimali, arrotondamento standard** (104,535 → 104,54). Il calcolo si fa in
`Decimal`, mai in `float`.

**`lastListingAt` esiste per il listino nuovo, che sta arrivando.** L'import è
idempotente e fa `upsert`: quando arriverà il listino aggiornato, i codici che COLOMBO
ha tolto **non verrebbero cancellati** e resterebbero a schermo identici agli altri,
senza che nulla dica che non sono più ordinabili — la stessa forma del difetto trovato
in produzione al §3. Con questa colonna, «non più a listino» è una cosa che si vede:
`lastListingAt` < `MAX(lastListingAt)` della marca. Nessuna cancellazione, nessuna
tabella in più, e costa zero perché entra nella stessa migrazione.

### 6.2 `StockImport` e `StockLine` — la pronta consegna

**Non una colonna booleana su `Article`: una tabella di righe datate.** Le ragioni sono
tre, e nessuna è teorica: (a) i 23 orfani sono fatti **senza articolo** — una colonna li
cancellerebbe; (b) lo storico risponde a «cosa è sempre esaurito?» e «cosa non gira
mai?», domande che valgono per chi acquista e che **non sono retrofittabili**;
(c) `Product.stockQuantity`/`isAvailable` insegnano cosa succede a un flag che il
programma decide da sé.

**`StockImport`** — un caricamento: `id` · `brand` · `fileName` · `importedAt` ·
`importedById` (FK utente) · `rowCount` · `matchedCount` · `orphanCount` ·
`cancelledAt` (DateTime?, annullamento — l'import resta a DB, smette di valere).
**`StockLine`** — una riga: `id` · `importId` (FK, `onDelete: Cascade`) · `rawCode`
(come scritto nel file) · `codeNorm` · `articleId` (FK **nullable** — `null` = orfano).

Si conserva `rawCode` accanto a `codeNorm` perché il giorno che una normalizzazione va
rivista serve il dato d'origine, e perché è ciò che Andrea rilegge nel suo gestionale.

**«In pronta consegna» è derivato, mai salvato:** l'articolo compare in una `StockLine`
dell'**ultimo import non annullato** per quella marca. Un solo posto dove la verità è
scritta; nessun aggiornamento di massa a ogni caricamento.

**Annullamento (decisione dell'utente):** si può eliminare **solo l'ultimo** import di
una marca, e l'effetto è che il precedente torna a valere. Non si cancella un import
qualunque della storia — sarebbe riscrivere il passato, ed è la stessa ragione per cui
nel kit una distinta emessa non si riscrive ma genera una versione.

### 6.3 Il catalogo è uno strato facoltativo

`catalogPage` e `imageUrl` sono **nullable e arricchiti dopo**, da uno script che legge
un PDF di catalogo e aggancia per codice. Conseguenze volute:

- il giorno che arriva un altro catalogo è **un altro giro dello stesso script**, non
  una modifica al modello — è già successo in questa sessione, passando da RR a ER;
- una marca che non ha catalogo con foto funziona lo stesso — avrà articoli senza foto;
- l'archivio **non dipende** dal catalogo per essere utile: la fonte di verità è
  listino + pronta consegna, che sono completi;
- **se COLOMBO fornisce le credenziali rivenditore** (§10, domanda 2) e l'archivio
  fotografico ufficiale risulta utilizzabile, cambia solo **da dove arrivano i byte**:
  `imageUrl` e la tabella restano identici, e lo script di estrazione dal PDF diventa
  il ripiego invece che la strada maestra.

### 6.4 Le foto stanno su Vercel Blob, non in Postgres

Decisione dell'utente, motivata in §4.4: le foto AGB in `ProductImage` sono la voce che
consuma di più su tre limiti insieme. Le foto COLOMBO nascono su Blob con chiave
`colombo/<codeNorm>.jpg`, e su `Article` resta un `imageUrl`.

**Pubbliche o private?** Il catalogo COLOMBO è scaricabile da chiunque dal sito del
produttore: **pubbliche**, così il browser le prende direttamente dal Blob senza passare
da una funzione (la documentazione Vercel è esplicita sul fatto che la consegna privata
paga il transfer due volte). Il **listino AGB resta privato**, com'è oggi: è un
documento nostro.

Le foto AGB **restano dove sono** finché non danno fastidio: spostarle è un lavoro a sé,
segnato nel debito.

---

## 7. I flussi

### 7.1 Import del listino — script ops (non in app)

Come `pnpm import:agb`: `pnpm import:listino <marca> <file.xlsx>`, idempotente
(`upsert` per `(brand, code)`), lanciato dal workflow «Ops — Neon». È un'operazione
rara e da sviluppatore; non merita una schermata.

### 7.2 Import della pronta consegna — in app, lo fa Andrea

**È la capacità che oggi non esiste in nessuna forma:** non c'è **alcuna route di
upload** in `src/` (verificato: zero `formData`/`multipart`/`upload`), ogni ingestione è
un workflow GitHub Actions lanciato a mano dallo sviluppatore. È il pezzo di lavoro
nuovo più grosso della release.

1. Andrea carica il file (route handler `POST`: sessione Better Auth + **ruolo ADMIN**
   verificati nella route, come fa già `/api/listino` con la sessione. È l'unica deroga
   ammessa a «tutte le API via tRPC», per la stessa ragione dello streaming SSE: un
   upload multipart non è esprimibile su `httpBatchLink`. Tutto il resto del dominio
   resta tRPC)
2. il server legge la colonna dei codici, normalizza, aggancia per `(brand, codeNorm)`
3. **mostra un riepilogo prima di confermare**: righe lette · riconosciute · **orfane,
   elencate una per una** · variazioni rispetto all'import precedente (entrate/uscite)
4. Andrea conferma → nascono `StockImport` + `StockLine`
5. può **annullare l'ultimo import** se ha sbagliato file

Il riepilogo prima della conferma non è un vezzo: è ciò che impedisce di pubblicare a
dieci agenti il file della marca sbagliata, ed è **esattamente ciò che Andrea ha
chiesto** (*«ogni volta che viene importato un file con codici inesistenti, devono
essere ignorati, magari con un avviso prima di importare»*).

**Formato del file: `.xls`, e non è negoziabile.** Andrea: *«il formato del file è
soltanto .xls»*. È il vecchio binario BIFF, e in JavaScript lo legge una libreria sola:
**SheetJS**. Con un dettaglio che va saputo prima e non scoperto dopo:

> Sul registry npm `xlsx` è fermo alla **0.18.5 (2022)**, con vulnerabilità note e mai
> corrette lì (prototype pollution, ReDoS). Le versioni sane esistono **solo** sul CDN
> di SheetJS. Verificato il 2026-08-03: `cdn.sheetjs.com` risponde 200 e la **0.20.3**
> è disponibile (la 0.21 non esiste).
>
> Si installa così, pinnata:
> `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
>
> **Va scritto in `CLAUDE.md` §AMBIENTE**, accanto al pin di pnpm 10: è la stessa classe
> di trappola — un `pnpm add xlsx` distratto reinstalla la versione vulnerabile.

Mitigazione del rischio residuo: il file lo carica un **ADMIN autenticato**, non
internet, e pesa 35 KB. Si parsa **solo la prima colonna**, ignorando fogli, formule e
tutto il resto.

### 7.3 Ricerca

Codice, nome, descrizione. **Solo Postgres** — `tsvector` + trigram, come il ramo
testuale esistente. **Niente embedding, niente RAG**: i 3.456 codici COLOMBO nello
stesso indice semantico farebbero citare maniglie a domande sui serramenti, e
peserebbero su Gemini, provider unico con 429 già ricorrenti.

**Due stati per l'agente, un terzo che vede solo Andrea:**

| Stato | Quando | Chi lo vede |
|---|---|---|
| **In pronta consegna** | è nell'ultimo import valido | agente — badge verde + **data dell'ultimo import** |
| **Da ordinare** | è a listino, non nell'import | agente — badge neutro + data |
| **Orfano** | è nell'import, **non** a listino | **solo Andrea**, nel riepilogo pre-conferma e nella scheda dell'import |

**Perché gli orfani non li vede l'agente** (decisione dell'utente del 2026-08-03, dopo
le risposte di Andrea): la spec nasceva con tre stati visibili, per non rispondere «non
trovato» su una maniglia che è sullo scaffale. Andrea però ha chiarito che dei 23 solo
5 sono errori veri e i restanti 18 mancano **perché il listino è vecchio** — cioè il
problema scade da solo al prossimo import di listino. Mostrare all'agente un prodotto
senza prezzo, quando nella maggioranza dei casi il prezzo esiste e arriverà, è peggio
che non mostrarlo: lo mette in condizione di promettere una cosa che non sa quotare.

**Ma le righe orfane si conservano, e non è un ripiego.** `StockLine` le tiene con
`articleId = null` e il loro `codeNorm`. Conseguenza: quando arriverà il listino
aggiornato e l'articolo nascerà, **l'aggancio avviene da solo** — nessun file da
ricaricare, nessuna storia da ricostruire. Buttarle all'import significherebbe
ricaricare a mano ogni pronta consegna passata.

### 7.4 La data, sempre accanto alla risposta — e nessuna soglia

**Nessuna disponibilità si mostra senza la data dell'ultimo import.** Un agente che
promette la consegna sulla base di un file di due settimane fa non ha un bug: ha un
cliente arrabbiato.

**Ma nessun avviso a soglia.** La spec nasceva con «se l'import è più vecchio di N
giorni, avvisa». La risposta di Andrea la smonta: *«la frequenza sarà molto varia e non
frequente. Potrà capitare che venga aggiornato un paio di volte all'anno, come potrebbe
essere aggiornato tutti i giorni»* — perché si aggiorna **quando si decide di tenere a
magazzino qualcosa che di solito non si tiene**. Non esiste un ritmo, quindi non esiste
una soglia: un allarme che scatta legittimamente per sei mesi diventa rumore, e il
giorno che conterebbe davvero nessuno lo guarda più.

Si mostra **la data, che è un fatto**; il giudizio lo dà l'agente, che sa se quella
maniglia gira o no. *(Il rovescio della stessa risposta: se ogni import è la traccia di
una decisione di magazzino, allora lo **storico** — §6.2 — non è archeologia, è il dato
più interessante che questo sistema accumulerà.)*

---

## 8. UI

### 8.0 Il selettore di programma — decisione dell'utente del 2026-08-03

**La prima schermata dopo il login diventa un selettore**: oggi due voci, **FINESTRE**
(tutto ciò che esiste: catalogo AGB, assistente, kit, clienti) e **MANIGLIE** (il nuovo
dominio); domani probabilmente altre. Volontà esplicita dell'utente, e la ragione è di
prodotto, non tecnica: **rendere visibile il distacco**. Chi entra per il magazzino non
deve attraversare il mondo dei serramenti, e chi entra per i serramenti non deve vedere
comparire voci che non lo riguardano.

Corollario dichiarato dall'utente: **la sezione finestre non si tocca**, deve restare
com'è.

> ✅ **Tensione sciolta — verdetto `/llm-council` del 2026-08-04** (5 advisor + 5 peer
> review + chairman, con un reviewer che ha *eseguito* i comandi e riprodotto i build).
>
> **Nessuna delle tre strade come scritte.** Si prende la **(a)** — selettore a `/`,
> percorsi attuali intatti — **più** un'opzione che non era in elenco: il reparto nuovo
> vive su un **segmento URL vero**, `src/app/(dashboard)/maniglie/…`.
>
> La **(b) cade su un fatto riprodotto**: con il Next 15.5.20 installato, due route group
> fratelli che risolvono lo stesso path fanno fallire la build
> (*«You cannot have two parallel pages that resolve to the same path»*, `E28`). Il punto
> che il council ha isolato e che la spec non sapeva: **i route group separano il layout,
> non il namespace** — l'URL resta identico, quindi la (b) non dà l'isolamento per cui la
> si sceglieva. E `/utenti`, `/impostazioni` e soprattutto **l'assistente** sono già
> trasversali ai due reparti: sotto la (b) andrebbero collocati fisicamente in uno o
> duplicati. La (b) non è né fatale né gratis: è **inerte**.
>
> Corollario verificato: la seconda metà dell'affermazione «(b) tocca più file esistenti»
> era **falsa** (i route group non entrano nell'URL, quindi le 26 occorrenze di path
> restavano valide) — ma è ininfluente, perché la (b) esce comunque.
>
> **Le decisioni operative:**
>
> | | |
> |---|---|
> | **Rotte** | `/` = scelta reparto · nessun prefisso = SERRAMENTI (intatto) · `/maniglie/*` = MANIGLIE. Zero rinomine, bookmark degli agenti vivi |
> | **Attraversato o raggiungibile** | **attraversato** a ogni login: è l'unica risposta onesta quando l'app non sa dove vuoi andare |
> | **Memoria del reparto** | **nessuna. Zero cookie.** Sarebbe l'ottava istanza della classe «valore deciso dal programma e mai dichiarato»; il rimedio non è «scriverlo a schermo», è non ricordare. Il reparto si deduce dall'**URL**, che è derivato e condivisibile |
> | **Atterraggio** | `login-form.tsx:66` e `decideRedirect` puntano a `/`; `/` entra nel matcher conservando il redirect a `/login` |
> | **Ritorno** | l'header `h-16` della sidebar da wordmark statico a **nome reparto + «Cambia reparto»**. Gratis a 375px: `topbar.tsx:141` rimonta la stessa Sidebar nel drawer |
> | **«Dove sono» a 375px** | la TopBar mobile non ha né wordmark né nome sezione → **l'hamburger porta scritto il reparto** (`☰ MANIGLIE`): zero spazio nuovo, bersaglio più grande, e vale su entrambi i reparti |
> | **Ordine** | **due PR: maniglie prima, selettore per ultimo.** Il selettore è l'unico pezzo che tocca il guscio di un'app viva, ha zero migrazioni e si annulla con un revert; e la seconda tessera è onesta solo dopo che `/maniglie` esiste |
>
> **Chi ha accesso a un solo reparto: nessuno, oggi** (`MAGAZZINO` è fuori scope, §5). Il
> selettore va comunque **derivato da una lista**, così che il giorno in cui la lista ha un
> elemento solo si salti da sé — e il «clic in più» si dissolva senza codice nuovo.
>
> ### 8.0.1 Le parole (decisione dell'utente, 2026-08-04)
>
> **«Reparto», mai «programma»**: in un gestionale italiano «il programma» *è* il software,
> e un selettore di programmi dentro un programma legge come un menù d'avvio. Compare in un
> punto solo: **«Cambia reparto»**.
>
> **Le tessere si chiamano SERRAMENTI e MANIGLIE**, e il **marchio sta nel sottotitolo**:
> *SERRAMENTI — Ferramenta per serramenti · AGB* e *MANIGLIE — Maniglie per porte e
> finestre · COLOMBO*. Il council proponeva i marchi nudi (`AGB`/`COLOMBO`) perché una
> maniglia si monta su una finestra e «MANIGLIE» è ambiguo — e l'ambiguità è **reale e
> verificata**: `recent-searches.tsx:5` suggerisce letteralmente «maniglia» fra le ricerche
> **dell'archivio AGB**, «entrata maniglia» è un campo del wizard kit, e la cremonese *è* la
> maniglia della finestra (69 occorrenze in `src/`).
>
> Ma un dato nuovo dell'utente **capovolge l'argomento**: il reparto maniglie ospiterà
> **almeno cinque marche** (COLOMBO, poi HOPPE, OLIVARI, DND, GHIDINI…). Quindi COLOMBO non
> è il *nome* del reparto, è un suo **contenuto**: chiamare la tessera COLOMBO sarebbe
> sbagliato il giorno che entra la seconda marca, e andrebbe rinominata — cioè esattamente
> il difetto che si voleva evitare. La divisione è per **categoria di merce e mestiere**, le
> marche stanno dentro. Il modello lo regge già: `Article.brand` è una colonna proprio
> perché «le altre marche arrivano qui, non in tabelle nuove» (§6.1).
>
> L'ambiguità si risolve quindi **altrove, non nel nome della tessera**: (a) il marchio nel
> sottotitolo fa la disambiguazione e cresce senza rinomine; (b) **le due sezioni di ricerca
> non si chiamano tutt'e due «Archivio»** — quella AGB resta `Archivio`, quella maniglie è
> **`Disponibilità`**, che è la domanda letterale di Andrea e non un sinonimo di «cerca».
>
> ### 8.0.2 Il difetto che il council ha trovato di passaggio
>
> Il `matcher` del middleware è un **allowlist cablato**: `/archivio`, `/richieste`,
> `/clienti`, `/utenti`, `/impostazioni` **non ci sono già oggi** — sono protetti solo dal
> `redirect("/login")` del layout server. Quindi `/maniglie/*` nascerebbe con la stessa
> lacuna. Non è una falla di autorizzazione (il layout server e le procedure tRPC reggono),
> ma è una protezione dichiarata che copre meno di quanto sembri: **va allargata**, non
> replicata così com'è.

### 8.1 Le schermate del dominio maniglie

Sezione di navigazione separata. **Mobile-first e verificata a ≤375px** prima di dirsi
conclusa (regola inviolabile di `CLAUDE.md`): l'agente che fa questa domanda è in piedi
davanti a un cliente, col telefono in mano — è il caso d'uso principale, non un
adattamento. Codici in **JetBrains Mono**, UI in italiano, `/impeccable` in fase di
progettazione delle schermate.

**Carta bianca sul disegno** (utente, 2026-08-03), a un vincolo: **stesso stile del
software esistente** — token, tipografia, componenti e densità di `DESIGN.md`. Il
dominio è nuovo, il linguaggio visivo no.

Schermate: **ricerca** (campo + risultati con badge e data) · **scheda articolo**
(codice, nome, **prezzo totale arrotondato a 2 decimali**, EAN, stato, foto se c'è,
«vedi nel catalogo» se c'è la pagina) · **import** (ADMIN: carica, riepilogo con gli
orfani elencati, conferma, annulla ultimo) · **storico import** (ADMIN).

Foto assenti (**513 codici, il 15%** — bocchette, rosette, viti, molle: minuteria che
nessun catalogo fotografa): **segnaposto neutro**, nessun messaggio d'errore. Il dato
che conta — codice, nome, prezzo, disponibilità — c'è tutto lo stesso, e per una vite
la foto non è ciò che l'agente sta cercando.

---

## 9. Fuori scope (dichiarato)

- Ruolo `MAGAZZINO` in Better Auth (§5)
- Le altre tre marche: il modello le regge (`brand`), le **pipeline di import no** —
  ogni marca avrà il suo formato e il suo lavoro
- La migrazione multi-fornitore di `Product` (§2)
- Spostare le 7.082 foto AGB da Postgres a Blob
- **Quantità in giacenza** — chiusa da Andrea: *«non serve segnarle, all'agente basta
  sapere che è in pronta consegna, poi va a cercare le quantità sul gestionale
  aziendale»*. Nessuna colonna, e non si aggiunge «per il futuro»: un campo che nessuno
  scrive è il difetto pagato sette volte da questo progetto
- **Correzione automatica dei refusi** (`0CD63CM` → `0CD63FP-CM`): impossibile, sono
  **due** codici giusti per uno sbagliato (§4.2). Si corregge nel gestionale
- Tabella di alias per i codici interni (`XALL`, `XMP`, `XGRATZ7SX`): Andrea dice di
  ignorarli, e non sa da dove vengano
- Qualunque uso dell'assistente AI sul dominio magazzino

---

## 10. Domande aperte

**Chiuse dalle risposte di Andrea (2026-08-03):** quantità (no, §9) · frequenza degli
import (nessuna soglia, §7.4) · formato del file (solo `.xls`, §7.2) · credenziali area
download (*«per adesso non c'è modo di averle, dovremmo estrarre le foto dal
catalogo»* → §6.3 invariato) · i 23 orfani (§4.2) · il prezzo (§6.1) · cadenza del
listino (*«per adesso non è rilevante»*).

Restano:

1. **Il listino aggiornato.** Quello fornito è *«un vecchio modello»* e Andrea sta
   provando a procurarsi quello nuovo. Non blocca: l'import è idempotente, e
   `lastListingAt` (§6.1) fa sì che il ricambio non lasci zombie. **Quando arriva, 18
   dei 23 orfani spariscono da soli.**
2. **Lo storage Neon attuale** (§4.4): se supera i 400 MB, le foto AGB vanno spostate
   su Blob **prima** di aggiungere COLOMBO, non dopo. Dieci secondi sulla dashboard
   Neon; è l'unico numero della §4.4 che è stimato e non misurato.
3. **Le credenziali COLOMBO, in futuro.** Oggi non ci sono, ma se un giorno saltano
   fuori, l'archivio fotografico ufficiale rimpiazzerebbe l'estrazione dal PDF — che
   resta il pezzo più fragile del piano. Riaprire la domanda, non il design.

---

## 11. Ordine di lavoro

| # | Cosa | Migrazione |
|---|---|---|
| 0 | **Cancellare la disponibilità falsa** (§3) — PR a sé, indipendente | no |
| 1 | Modello dati + import listino da script ops | **sì** |
| 2 | Ricerca e scheda articolo (i due stati dell'agente, la data, il prezzo arrotondato) | no |
| 3 | Upload pronta consegna + riepilogo + conferma + annulla | no |
| 4 | Arricchimento da catalogo: pagina + foto su Blob | no |
| 5 | **Il selettore di reparto** (§8.0) — PR a sé, **mergiata per ultima** | no |

**Il selettore è ultimo, non primo** (decisione dell'utente del 2026-08-04, dopo il
council). Le ragioni sono due e nessuna è di comodo: (a) un bivio con un ramo che non
porta da nessuna parte **sembra un guasto**, e la seconda tessera è onesta solo dopo che
`/maniglie` esiste; (b) è l'unico pezzo che tocca il **guscio di navigazione di un'app
viva** — zero migrazioni, quindi si annulla con un revert, il che lo rende il candidato
giusto all'ultimo posto e non al primo.

Il passo 0 non è igiene: è il prerequisito. E la mano che lo fa passa esattamente per i
punti in cui atterreranno le maniglie.

**Regola ops (lezione della PR #40, venti minuti di produzione rotta):** il run
«Ops — Neon» del passo 1 si lancia **sul ref del branch, prima del merge**.
