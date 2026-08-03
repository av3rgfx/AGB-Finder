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
| **Assistente AI** | `chat/tools.ts:96,123-124` — `available` e `stock` passati a **Gemini**, che può affermarlo al cliente |
| Kit | `kit.ts:457` — selezionato sulle righe di distinta, **mai mostrato** |

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

### 4.2 I 23 orfani (11%) — cosa sono davvero

Codici che Andrea ha fisicamente a magazzino e che il listino **non conosce**.
Non sono refusi. Verificati uno per uno nel catalogo decodificato:

| Classe | Codici | Prova |
|---|---|---|
| **Esistono a catalogo, non a listino** | `0ID81R*` · `0ID91R*` · `0ID82*` · `0ID92*` · `0AM15*` · `0AM25*` · `0AM41*` · `0AM42*` · `0CB16ZB*` · `0LC45*` · `0LC55*` · `0ID45*` · `0ID55*` | `ID 81` pag. 63 · `ID 91` pag. 65 · `AM 15` pag. 89 · `AM 41` pag. 43 e 112 · `CB 16` pag. 101 · `LC 55` pag. 92 · `ID 45`/`ID 55` pag. 90 |
| **Forme abbreviate dal magazzino** | `0CD63CM`, `0CD63NM` | a listino esistono solo `0CD63FP-CM`, `0CD63GB-CM`… (il segmento centrale manca) |
| **Codici interni UFP** | `XALL` · `XMP` · `XGRATZ7SX` | assenti da **entrambe** le fonti (`XGRATZ-7` e `XGRATZ-SX` esistono separati: il `7SX` è una combinazione che COLOMBO non vende come codice unico) |

**Conseguenza sul modello:** se la pronta consegna è una **tabella di righe datate**
invece di una colonna sul prodotto, gli orfani **esistono per costruzione** — sono
righe di giacenza che non trovano un articolo. Non c'è nulla da «gestire»: c'è solo da
decidere cosa vede l'agente (§7.2).

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

Vincoli: `@@unique([brand, code])` · `@@unique([brand, codeNorm])` (le collisioni sono
verificate assenti: se un giorno ne comparisse una, il vincolo la fa esplodere
all'import invece di far agganciare in silenzio la riga sbagliata) · indice su `brand`.

Il prezzo è spezzato in `priceList` + `surcharge` e **non** salvato già sommato: il
surcharge è temporaneo per definizione, e il giorno che sparisce serve sapere quale
metà toglier via. Il totale è derivato, mai persistito — stessa regola di `totalPrice`
nel kit.

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
dieci agenti il file della marca sbagliata, e ciò che rende gli orfani **visibili** ad
Andrea a ogni giro invece che scartati in silenzio.

**Formato del file.** Il file di oggi è `.xls` (BIFF, vecchio formato). Decisione:
accettare `.xlsx` e `.csv` con una libreria sola, e chiedere ad Andrea il «salva con
nome» se esporta `.xls`. Se risultasse un attrito reale per lui, si aggiunge il
supporto `.xls` — ma non si porta una dipendenza in più per un'ipotesi.

### 7.3 Ricerca

Codice, nome, descrizione. **Solo Postgres** — `tsvector` + trigram, come il ramo
testuale esistente. **Niente embedding, niente RAG**: i 3.456 codici COLOMBO nello
stesso indice semantico farebbero citare maniglie a domande sui serramenti, e
peserebbero su Gemini, provider unico con 429 già ricorrenti.

I tre stati, che devono essere **tre e non due**:

| Stato | Quando | Cosa vede l'agente |
|---|---|---|
| **In pronta consegna** | è nell'ultimo import valido | badge verde + **data dell'ultimo import** |
| **Da ordinare** | è a listino, non nell'import | badge neutro + data |
| **A magazzino, scheda mancante** | è nell'import, **non** a listino (i 23 orfani) | badge verde + avviso **«prezzo non a listino 02/26 — chiedi all'ufficio acquisti»** |

Il terzo stato è la differenza fra battere la telefonata e perderla: rispondere «non
trovato» su una maniglia che è sullo scaffale uccide la fiducia il primo giorno.

### 7.4 La data, sempre accanto alla risposta

**Nessuna disponibilità si mostra senza la data dell'ultimo import.** Un agente che
promette la consegna sulla base di un Excel di due settimane fa non ha un bug: ha un
cliente arrabbiato. E se l'import è più vecchio di una soglia, l'avviso è **visibile
all'agente**, non solo ad Andrea — perché è l'agente a rischiare la promessa, e Andrea
che salta un giro non se ne accorge da solo.

---

## 8. UI

Sezione di navigazione separata. **Mobile-first e verificata a ≤375px** prima di dirsi
conclusa (regola inviolabile di `CLAUDE.md`): l'agente che fa questa domanda è in piedi
davanti a un cliente, col telefono in mano — è il caso d'uso principale, non un
adattamento. Codici in **JetBrains Mono**, UI in italiano, `/impeccable` in fase di
progettazione delle schermate.

Schermate: **ricerca** (campo + risultati con badge e data) · **scheda articolo**
(codice, nome, prezzo listino + surcharge, EAN, stato, foto se c'è, «vedi nel catalogo»
se c'è la pagina) · **import** (ADMIN: carica, riepilogo, conferma, annulla ultimo) ·
**storico import** (ADMIN).

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
- Quantità in giacenza (§10, domanda 1)
- Tabella di alias per i codici interni (`XALL`, `XMP`): tre casi, si guardano quando
  Andrea dice cosa sono
- Qualunque uso dell'assistente AI sul dominio magazzino

---

## 10. Domande aperte

1. **Le quantità.** Il gestionale di Andrea può esportare anche i pezzi? «Ce ne sono 2»
   non è «ce ne sono 200». **Chiesto ad Andrea, in attesa.** Nessuna colonna viene
   aggiunta prima della risposta: un campo che nessuno scrive è il difetto pagato sette
   volte. Aggiungerla poi è un `ALTER TABLE ADD COLUMN`, come `entrata` e `variants`.
2. ✅ **CHIUSA** — il secondo catalogo esiste ed è **`ER MAN 2026`** (§4.3): copre
   l'85% contro il 57% di RR, e il residuo è minuteria senza foto per natura.
   **Resta aperta la coda che ne è nata:** l'area download di COLOMBO ha tre colonne
   — **ARCHIVIO FOTOGRAFICO**, **LISTINO**, **3D** — che nella pagina pubblica sono
   **completamente vuote** (zero link nell'HTML): sono dietro il login rivenditori.
   UFP è rivenditore COLOMBO, quindi le credenziali dovrebbero esistere. Se ci sono, e
   se dietro c'è ciò che i titoli promettono, **due pezzi di questo progetto si
   semplificano**: le foto arriverebbero già ritagliate invece che estratte da un PDF,
   e il listino sarebbe scaricabile alla fonte invece che atteso via mail. **Da
   chiedere ad Andrea.** Non blocca nulla: il design (§6.3) è già indifferente
   all'origine delle foto.
3. **`XALL`, `XMP`, `XGRATZ7SX`**: cosa sono? Assenti da entrambe le fonti COLOMBO.
4. **Ogni quanto Andrea importa?** Determina la soglia oltre cui il dato è «vecchio»
   (§7.4).
5. **Lo storage Neon attuale** (§4.4): se supera i 400 MB, le foto AGB vanno spostate
   prima di aggiungere COLOMBO, non dopo.

---

## 11. Ordine di lavoro

| # | Cosa | Migrazione |
|---|---|---|
| 0 | **Cancellare la disponibilità falsa** (§3) — PR a sé, indipendente | no |
| 1 | Modello dati + import listino da script ops | **sì** |
| 2 | Ricerca e scheda articolo (i tre stati, la data) | no |
| 3 | Upload pronta consegna + riepilogo + conferma + annulla | no |
| 4 | Arricchimento da catalogo: pagina + foto su Blob | no |

Il passo 0 non è igiene: è il prerequisito. E la mano che lo fa passa esattamente per i
punti in cui atterreranno le maniglie.

**Regola ops (lezione della PR #40, venti minuti di produzione rotta):** il run
«Ops — Neon» del passo 1 si lancia **sul ref del branch, prima del merge**.
