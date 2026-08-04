# Foto degli articoli COLOMBO — design

> **Data**: 2026-08-05 · **Reparto**: maniglie · **Branch**: `claude/ufptrade-foto-maniglie-a6bc3s`
> **Presupposto**: le misure di `2026-08-04-foto-e-finiture-colombo-misure-2.md`.
> Questa scheda le **verifica eseguendo** e ne **corregge tre** (§1), poi disegna.

---

## 0. Il problema, in una riga

Il reparto maniglie mostra 3.456 articoli senza una sola immagine, e `ArticoloRow`
ha **già** il posto della miniatura — 44px, disegnato la sessione scorsa, sempre
vuoto perché `articles.image_url` è NULL su tutte le righe.

---

## 1. Cosa ho verificato, e cosa ho trovato di diverso

Tutto rifatto sull'archivio vero (79 zip, **3,50 GB**, indice preso con richieste
Range sulle central directory) e sul listino vero (`LP 02-26`, 3.456 codici,
importato in locale).

| Affermazione della scheda misure | Esito |
|---|---|
| 79 zip · 707 foto · zero JPEG2000 | ✅ **confermato alla lettera** — 707 `.jpg`, tutte **CMYK Adobe** a 4 componenti |
| «5315×5315, prodotto pulito su fondo bianco» | ⚠️ **vero per una parte**. Le 5315² sono gli scatti `_45`, **69**. Ci sono anche **64 file `_def`** che sono **scatti d'ambiente su fondo colorato** (`Robo4_def.jpg`: 8268×7087, **34 MB**) e 4 `Mood/IMG`. Il resto va da 241×555 a 4128×1794 |
| «+ finitura dove sta nel nome (39%)» | ⚠️ il **39%** include le parole per esteso, in **due lingue** (`cromo` 106, `bronze` 18, `oroplus` 11…). Il **codice ufficiale** di finitura in coda numerata (`Fedra_1OL`, `roboquattroS_4VL`) sta in **143 file**; coi bicolori, 155 |
| «+ codice dove COLOMBO l'ha scritto (62% degli accessori)» | ⚠️ il codice **intero** sta in **29 file**. Il codice **senza la coda di finitura** (`ID313RS`, `PB1304`) aggancia **322 codici di listino**: è quello il numero utile |
| «cartella → modello, vale per tutte e 707» | ⚠️ vero come *etichetta*, **falso come chiave**: **4 etichette di sfoglio hanno DUE archivi** (BOLD, MILLA, SPIDER, TRAMA) e altre 3 li avrebbero (ROBOT, DUE, ONE). La cartella da sola non sceglie |
| — (non vista) | 🔴 **«ZERO» è un prodotto a listino**: **156 codici** (`ROBOQUATTRO ID41RSB ZERO`), e l'archivio lo nomina in **71 file**. La foto liscia su un articolo ZERO è **la foto sbagliata**, non una foto approssimata |

### 1.1 Il peso, rimisurato con la libreria vera (`sharp`, libvips 8.18.3)

| | miniatura 320px | scheda 900px |
|---|---|---|
| WebP q80, misurato su 21 file veri | **0,9 – 3,9 KB** | **3,1 – 11,4 KB** |

Meglio delle stime (2,8 / 15,8 KB). E la conversione **non è un'ottimizzazione**:
un JPEG CMYK il browser non lo disegna. `sharp` applica il profilo ICC incorporato
— verificato a occhio: l'oroplus esce oro, non verde.

---

## 2. Il vincolo che decide tutto

> «niente foto→codice inventate — se un articolo non arriva a nessuno dei tre
> gradini, resta senza foto» (utente, 2026-08-05)

Da qui discende il resto: **preferire la copertura alla verità è escluso**, e
un'ambiguità non risolta si dichiara invece di risolverla a caso.

---

## 3. Il disegno

### 3.1 L'unità è l'ARCHIVIO, non il gruppo

Un archivio è un **modello** (`01_Fedra/` *è* l'etichetta, non un titolo da
decifrare). Un gruppo di sfoglio a volte ne ospita due. Quindi la tabella è
`archivio → { etichetta, serie? }`, **79 righe**, per lo più identità, e ogni riga
è verificabile: l'etichetta esiste fra le 102 dello sfoglio, la serie aggancia
almeno un codice a catalogo. Un test lo prova su tutte e 79.

**Le sette righe che non sono identità**, e su cosa si appoggiano:

| Archivi | Etichetta | Come si separa | Fonte |
|---|---|---|---|
| `01_Robot1_m` · `01_Robot1_p` | ROBOT | serie **CD41** · **CD75** | i nomi dei file dicono `robot41_*` e `robot75_*`; l'indice del listino COLOMBO stampa «robot CD41» e «robot CD75» |
| `01_One` · `01_One Q` | ONE | serie **CC11** · **CC21** | i file dicono `one …` e `oneq …`; le pagine prodotto del listino stampano CC11 sotto «One» e CC21 sotto «OneQ» |
| `01_Due` · `01_Due Q` | DUE | serie **CC31** · **CC41** | idem |
| `01_Bold_m` · `01_Bold_p` | BOLD · **nessuna** | `_p` è il **pomolo**, e il pomolo bold **non è a listino 2026** (la sua foto in `02_Pomoli` resta orfana) | confronto delle due immagini + assenza della famiglia |
| `01_Spider_m/_p` | **nessuna** | MR11 e MR15 sono **due maniglie diverse**, l'accoppiamento archivio↔serie non è scritto | — |
| `01_Milla_1/_2` · `01_Trama_1/_2` | **nessuna** | LC31/LC41 e LC71/LC81: l'ordinale del nome cartella **non è** la serie | — |

Le ultime tre righe costano **66 codici senza foto** (1,9%) e diventano una
**domanda per COLOMBO** (§7). Il motivo per cui non si indovina è quello di sempre:
la serie sbagliata produce una foto che *esiste*, *si vede bene* e *è di un altro
prodotto* — nessun errore, nessun warning, nessuno se ne accorge.

I **5 archivi di prodotti nuovi** (`Laconica`, `Robot6`, `Robot6S`, `Halo`, `Kubo`)
non hanno etichetta perché non hanno articoli: quando COLOMBO li metterà a listino
si aggancieranno da soli.

### 3.2 I tre gradini, in ordine di forza

1. **Codice** — il codice dell'articolo (senza la coda di finitura) è scritto nel
   nome del file: `ID313RS_45.jpg` → `0ID313RS-*`. **Vince su tutto**: è l'unica
   affermazione che COLOMBO fa su un codice d'ordine. A parità, il match più lungo.
   È ciò che raggiunge maniglioni, pomoli, bocchette e complementi, che per nome
   di modello sarebbero **irraggiungibili**.
2. **Finitura** — la foto porta in coda un codice fra le **31 ufficiali**
   (`Fedra_1OL`), e l'articolo ha la stessa coda: l'agente vede il colore che il
   cliente comprerà.
3. **Modello** — nessuna delle due: la foto del modello, in una finitura qualunque.

Su tutti e tre pesa un **filtro di variante**: la parola `zero` nel nome del file e
la parola `ZERO` nella descrizione devono **combaciare**. Sono due parole scritte
da COLOMBO in due posti; non è una deduzione.

### 3.3 Gli scatti d'ambiente si scartano

`_def`, `Mood*`, `*IMG_*` → **68 file** che ritraggono la maniglia su fondo
colorato, con ombre lunghe. In una griglia di miniature su fondo bianco stonano, e
uno di essi pesa 34 MB. Sono l'unica esclusione, ed è per contenuto, non per peso.

### 3.4 Dove finiscono i byte

**Vercel Blob privato**, dietro una route Node autenticata — la stessa forma di
`/api/listino`, e **mai** `public/`: il repo è pubblico e sono foto di un fornitore.

- chiave: `maniglie/colombo/<archivio>/<nome-file-slug>` (+ `-320.webp` / `-900.webp`)
- la chiave è **derivata dalla sorgente**, quindi due articoli che condividono la
  foto condividono il file: si carica una volta sola
- `articles.image_url` conserva **la chiave**, non un URL pubblico. È la correzione
  del commento a schema che oggi dice «Blob **PUBBLICO** (`colombo/<codeNorm>.jpg`)»
  — una frase falsa in tutte e tre le sue affermazioni
- il router costruisce `/api/article-image?k=<chiave>&size=320|900`; la route valida
  `k` con una regexp ancorata al nostro prefisso (anti-SSRF, come `parsePageParam`)

**Nessuna migrazione** (decisione utente, 2026-08-05): `catalog_edition` sarebbe
nata accanto a `catalog_page`, che è NULL su tutte e 3.456 le righe perché nessuno
script l'ha mai scritta — la stessa forma della «disponibilità falsa» cancellata
il 03/08.

### 3.5 Lo script ops

`pnpm foto:colombo` — un solo comando, idempotente, e **non scarica i 3,5 GB**:

1. login all'area download (password da env, **mai** in un file)
2. indice dei 79 zip via **Range** sulle central directory (pochi MB)
3. abbinamento (modulo puro) → **228 foto** scelte su 639 non-ambiente
4. per ognuna **non già su Blob**: estrazione della singola voce via Range →
   `sharp` → due WebP → upload
5. scrittura di `articles.image_url`

Rilanciarlo dopo un listino nuovo costa la sola rilettura degli indici e le poche
foto mancanti. Il passo 3 legge sempre da COLOMBO «quali foto esistono»: nessun
manifest da tenere allineato, nessun elenco di nomi del fornitore nel repo pubblico.

### 3.6 Dove si vedono (decisione utente sull'anteprima)

- **righe articolo** (dentro un gruppo, risultati di ricerca, codici sciolti):
  miniatura **320px** nel posto che esiste già
- **scheda articolo**: **900px**
- **livello 2 escluso**: le famiglie di un gruppo sono lo stesso modello con
  rosetta / bocchetta / cremonese diverse, quindi le sette tessere di FEDRA
  mostrerebbero **sette volte la stessa immagine**, allungando lo schermo da 1 a
  2,4 schermate a 375px
- **livello 1 escluso**: le chip alfabetiche le ha decise il council su una misura
  (da ~14 schermate a 5,8 a 375px)

---

## 4. La copertura, misurata sul listino vero

| Gradino | Codici |
|---|---|
| 3 — il codice scritto da COLOMBO nel nome del file | **322** |
| 2 — la finitura esatta dell'articolo | **994** |
| 1 — la foto del modello | **679** |
| **coperti** | **1.995 / 3.456 = 57,7%** |
| senza foto | 1.461 (42,3%) |

I gruppi che restano scoperti sono la minuteria e l'accessoristica che nessun
catalogo fotografa una per una — BOCCHETTA 290, MANIGLIONE 240 (dei 338: 98 sono
coperti dal gradino 3), NOTTOLINO 148, KIT 104, ROSETTA 86 — più i 66 codici di
SPIDER, MILLA e TRAMA che §3.1 dichiara.

**Foto caricate: 228** (≈ 0,5 MB di miniature + 1,6 MB di schede).

---

## 5. Le 31 finiture come modulo — e il filtro colori (fatto)

`src/server/maniglie/finiture.ts`: codice, nome, colore esadecimale — dalla pagina
13 del catalogo `ER MAN 2026`. Foglia, senza dipendenze. Due consumatori:

1. il parser dei nomi file (riconosce la coda `_1OL`);
2. il **filtro colori** chiesto da Andrea — **fatto in questa sessione**: 3.065
   codici su 3.456 (88,7%) hanno come coda una delle 31.

Il filtro offre le finiture **presenti nel contesto**, non le 31 sempre: nel
catalogo intero sono **28**, dentro FEDRA sono **cinque**. Una scelta che dà uno
schermo vuoto non è un filtro. E l'elenco **non si restringe** con la finitura già
scelta: un filtro che cancella le proprie alternative è un vicolo cieco.

Sta in un `<details>` nativo (46px chiuso, misurati) accanto a «solo pronta
consegna», la regola resta in TypeScript come la disponibilità, e i due filtri si
intersecano prima di arrivare al raw SQL.

⚠️ Il colore è **campionato dalle pastiglie di catalogo**, non dichiarato da
COLOMBO: va bene per un pallino in un filtro, non per rappresentare la finitura
reale. Il modulo lo scrive.

---

## 6. Come si prova che non mente

- **tabella dei 79 archivi**: un test per riga — l'etichetta esiste fra quelle
  dello sfoglio, la serie aggancia ≥1 codice, il `null` è dichiarato con la ragione
- **parser dei nomi**: banco di prova i **707 nomi veri**
- **guardia di copertura** (integrazione, sul catalogo vero): il numero di articoli
  coperti non può **calare in silenzio**. È la lezione del `widthMm: 550` del kit —
  una copertura che si restringe non fa fallire nulla, e nessun conteggio va a zero
- **nessuna foto senza gradino**: un test prova che un articolo il cui gruppo ha
  due archivi non riceve nulla

---

## 7. Aperto

1. **SPIDER / MILLA / TRAMA** (66 codici): quale archivio è MR11 e quale MR15?
   LC31/LC41? LC71/LC81? Domanda per COLOMBO.
2. Le 2 domande per Andrea già in coda (`MANIG.*`, `PL.*`, `RONDELLE`).
3. `articles.image_url` conserva una **chiave**, non un URL: il nome della colonna
   resta ereditato. Rinominarla è una migrazione, e l'utente ne ha appena escluso
   una che non serviva.
