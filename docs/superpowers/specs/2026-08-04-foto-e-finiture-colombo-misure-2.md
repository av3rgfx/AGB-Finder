# Foto e finiture COLOMBO — misure 2

> **Stato**: misure eseguite sul catalogo vero, **zero righe di codice**.
> **Data**: 2026-08-04, sessione «le foto del reparto maniglie».
> **Sostituisce** le conclusioni di `2026-08-04-foto-catalogo-colombo-misure.md`,
> che restano leggibili ma sono **falsificate** ai punti §3.1 e §4 (vedi §0).
> **File**: `ER MAN 2026_100726.pdf`, 7.528.880 byte, dal link registrato nella
> scheda precedente. Byte-identico a quello su cui erano state fatte le misure 1.
> **Perché ora**: il catalogo è scaricabile adesso, il container no.

---

## 0. Cosa correggo della scheda precedente

| Affermazione della scheda 1 | Esito della verifica |
|---|---|
| «167 pagine con foto (≥150px)» | **conflazione di tre cose diverse**: 92 scatti d'ambiente + 441 scatti prodotto + icone e marchietti. La soglia dei 150px non separa una foto da una pastiglia di finitura |
| «le pagine di continuazione sono altre foto dello stesso modello, recuperabili col riporto del titolo» | **falso**. Sono le **pagine tecniche** — quote, codici, finiture — del modello che sta sulla pagina *precedente*, già contato. Riporto del titolo = **+0 modelli** |
| «artefatti di decodifica sugli accentati, da gestire» | reale ma **irrilevante alla scala**: su 92 titoli-foto **uno solo** ha caratteri fuori ASCII (`Alatò`, p26) |
| «le famiglie sono nel catalogo al 52%, coprono il 43,4%» | **quasi certamente un sottoconteggio** (§4): il catalogo scrive `AC 11 R-RY` **con gli spazi**, il listino ha la famiglia `AC11R` attaccata. Una ricerca letterale prende solo i codici già senza spazi (i maniglioni `AM113`) e perde tutte le maniglie |

La conclusione operativa della scheda 1 — «foto → gruppo, 57,4%, e il 57,4% è un
pavimento» — **non ha il rialzo che si aspettava**: le due strade indicate valgono
+0 e +1 modello. Ma la granularità che proponeva non è l'unica disponibile (§4).

---

## 1. Le misure

Tutte riproducibili con i comandi di §7.

| # | Misura | Valore |
|---|---|---|
| a | pagine del PDF | 260 |
| b | immagini totali | 725 |
| c | **scatti d'ambiente** (≥ 1 MP, uno per pagina) | **92** su 92 pagine — **61 modelli distinti** |
| d | **scatti prodotto** puliti su bianco (jpeg, larghezza ≥ 150px, < 1 MP) | **441** su **130 pagine** |
| e | pagine il cui primo testo è **numerico** («continuazioni») | **73** |
| f | …di cui **precedute da una pagina con scatto d'ambiente** | **72 / 73** (l'unica eccezione, p21, non ha foto) |
| g | **modelli nuovi recuperati dal riporto del titolo** | **0** |
| h | titoli-modello con caratteri non-ASCII | **1** (`Alatò`) |
| i | **famiglie-codice distinte stampate nel catalogo** (spazi tolti) | **859** — di cui **820** su pagine con scatti prodotto |
| j | pagine con scatti prodotto e **nessuno scatto d'ambiente** né lì né alla pagina prima | **55** (127 scatti) |
| k | **peso totale delle immagini** | **6,00 MB** (4,24 gli ambiente · 1,76 i prodotto) |
| l | JPEG2000 (`jpx`) | **zero** — confermato |

### 1.1 Le due misure che non ho potuto chiudere

Servono il listino `LP 02-26` (i 3.456 codici), che **non è nel repo**: è passato
come *input* del workflow ops e l'URL non è registrato da nessuna parte.

- **copertura della mappatura per famiglia**: quante delle 3.456 righe cadono
  dentro le 859 famiglie fotografate. È il numero che decide §4.
- **copertura del filtro colori**: quante righe finiscono con una delle 31
  finiture ufficiali di §5.

---

## 2. Com'è fatto il catalogo, davvero

L'alternanza è rigida e vale per tutta la sezione maniglie:

```
p26  «Alatò  Jean-Philippe Nuel»   → 1 scatto d'ambiente 1261×1033 (39 KB)
p27  «50 63 50 144,5 10 JP 11 R-RY Finishes: CR - CM - GL - GM …»
     → 7 scatti prodotto 305×108 (3 KB), disegni quotati, codici, finiture
```

La pagina tecnica stampa **due cose che la scheda 1 non aveva visto**:

1. il **codice modello** (`JP 11 R-RY`, `AC 11 R-RY`, `CD 41 P-PY`, `AM 16`,
   `PB 13/04`) accanto al proprio blocco;
2. **sotto ogni scatto, la finitura** (`CR Cromo`, `GM Grafite Mat`), in bande
   verticali — la stessa forma dell'helper `listino-images.ts` del reparto AGB.

Gli scatti sono **puliti su fondo bianco**, uno per finitura; gli scatti
d'ambiente sono **d'atmosfera** (la maniglia sul muro, ombre lunghe), uno solo
per modello e in una finitura sola.

**Le 55 pagine della misura (j)** — pomoli, maniglioni, maniglie a incasso,
blindate, complementi — **non hanno alcuno scatto d'ambiente**: hanno solo scatti
prodotto. Sono le sezioni che nel listino corrispondono ai gruppi grossi
(MANIGLIONE 338, BOCCHETTA 288, NOTTOLINO 161, KIT 139 = 926 codici, il 27% del
listino). Per nome commerciale sono **strutturalmente irraggiungibili**; per
famiglia no.

---

## 3. Il peso, che è il vincolo dichiarato

**6,00 MB in tutto.** Una griglia da 40 tessere costa ~136 KB — meno di una
singola paginetta del listino AGB che serviamo già oggi.

Il Fast Origin Transfer al 40% non ha qui la causa che aveva lì: il problema AGB
sono **7.082 foto dentro Postgres**, e questa strada non lo ripete. Da **non**
fare: metterle in `public/` — il repo è **pubblico**, e sono foto di un fornitore.

---

## 4. La granularità: gruppo o famiglia

| | scatto d'ambiente → **gruppo** (scheda 1) | scatto prodotto → **famiglia** |
|---|---|---|
| sorgente | titolo di pagina = nome commerciale | codice stampato accanto allo scatto |
| copertura | 57,4% + `Alatò` ≈ **58%** | **da misurare** (serve il listino) |
| granularità | il modello | il modello **e la finitura** |
| qualità | 1261×1033, d'atmosfera | 305×110, pulita su bianco |
| pomoli/maniglioni/incasso/blindate | **irraggiungibili** | raggiungibili |
| foto→codice | no | **sì, e stampata** — non dedotta |

Il tetto della seconda strada è ignoto finché non arriva il listino. Ma non è
«coprire meno ma più preciso» come temeva la scheda 1: è più preciso **e** arriva
dove l'altra non arriva.

---

## 5. Le 31 finiture ufficiali (catalogo, pagina stampata 13 = p14 del file)

Codici e nomi **letti dal PDF**; i colori **campionati dalle pastiglie della
pagina** e verificati a occhio contro la pagina stessa. Sono la fonte del filtro
colori chiesto da Andrea.

| Codice | Nome | Colore | Trattamento |
|---|---|---|---|
| `OL` | Oroplus | `#F8EAB4` | PVD, garanzia 30 |
| `OM` | Oromat | `#E2CE90` | PVD, garanzia 30 |
| `HPS/1` | Zirconium Stainless-Steel | `#BDBBBB` | PVD, garanzia 30 |
| `GL` | Grafite | `#54504F` | PVD, garanzia 30 |
| `GM` | Grafite Mat | `#28201A` | PVD, garanzia 30 |
| `VL` | Vintage | `#CB9864` | PVD, garanzia 30 |
| `VM` | Vintage Mat | `#B98756` | PVD, garanzia 30 |
| `CR` | Cromo | `#EAE7E6` | galvanico, garanzia 10 |
| `CM` | Cromat | `#D6D4D4` | galvanico, garanzia 10 |
| `NI` | Nikelmat | `#A59D8F` | galvanico |
| `BR` | Bronzo | `#895623` | galvanico |
| `BA` | Bronzo Antico | `#61432B` | galvanico |
| `OA` | Ottone Antico | `#B78F44` | galvanico |
| `SM` | Silvermat | `#C6CBCE` | a polvere, garanzia 10 |
| `CH` | Cherry | `#D94349` | a polvere, garanzia 10 |
| `DG` | Dark Green | `#00532D` | a polvere, garanzia 10 |
| `UB` | Umber Bronze | `#514B3E` | a polvere, garanzia 10 |
| `NM` | Neromat | `#060706` | a polvere, garanzia 10 |
| `BI` | Biancomat | `#F3F0F1` | a polvere, garanzia 10 |
| `C01` | White | `#FFFEF2` | a polvere, garanzia 10 |
| `C02` | Bronze (Anodic Brown) | `#3D2110` | a polvere, garanzia 10 |
| `C03` | Black | `#000F17` | a polvere, garanzia 10 |
| `C04` | Silver | `#9C9898` | a polvere, garanzia 10 |
| `C05` | Titan | `#0A1B23` | a polvere, garanzia 10 |
| `C06` | Ocean Blue | `#637893` | a polvere, garanzia 10 |
| `C07` | Strawberry Red | `#E21A52` | a polvere, garanzia 10 |
| `C08` | Sunset Orange | `#F36F31` | a polvere, garanzia 10 |
| `C09` | Lemon Yellow | `#FFD400` | a polvere, garanzia 10 |
| `C10` | Claret Violet | `#5D0035` | a polvere, garanzia 10 |
| `C11` | Lime Green | `#4DB857` | a polvere, garanzia 10 |
| `C12` | Capri Blue | `#005596` | a polvere, garanzia 10 |

⚠️ **Il colore è campionato, non dichiarato.** COLOMBO non pubblica valori RGB:
questi sono i pixel delle sue pastiglie di catalogo. Vanno bene per un pallino in
un filtro, **non** per rappresentare la finitura reale di un prodotto.

Il codice finitura è la **coda del codice articolo** (`0CD41R-`**`CM`**). La misura
(e) della sessione «Sfoglia» aveva contato **133 code distinte** dopo l'ultimo
separatore, contro **31** finiture ufficiali: le altre 102 sono altro (misure,
varianti). Il filtro deve quindi offrire **solo le 31 pubblicate** e non
raccogliere le code in categorie inventate.

---

## 6. Il report di Andrea — lettura

Quattordici punti, che sono **quattro cose diverse**.

**(A) Fusioni di etichette** — `ROBOCINQUEQ`→`ROBOCINQUE` · `ROBOTE`→`ROBOTRE` ·
`ROS.`+`ROSETTA`→`ROSETTA` · `MOV.`→`MOVIMENTO` · `NOTTLIN`→`NOTTOLINO` ·
`BOCCEHTTA`→`BOCCHETTA` · `DUMMY/C`→`DUMMY` · `KIT PORTE`→`KIT`.

**(B) Rimozioni** — `RONDELLA` · `VITE` · `VITI` · `DADO` · `CHIAVE`.

**(C) Divisioni** — `ROBOCINQUE` / `ROBOCINQUE S` e `ROBOQUATTRO` /
`ROBOQUATTRO S` oggi stanno insieme e vanno separate. Il catalogo conferma che
sono **prodotti diversi**, con pagine proprie (p154/p156, p150/p152).

**(D) Funzionalità nuova** — il filtro colori (§5).

### 6.1 Il verdetto del council della sessione precedente è caduto

La decisione **(3)** di quel `/llm-council` diceva: *«abbreviazioni: nessuna riga
di codice, perché in alfabetico `ROS.`/`ROSETTA` sono adiacenti, `BOCCEHTTA` cade
prima di `BOCCHETTA` e `ROBOTE` atterra esattamente fra ROBOT e ROBOTRE — la
fusione la fa l'occhio»*.

Andrea ha usato la cosa vera e ha chiesto la fusione di **otto** etichette, fra
cui **esattamente quelle tre**. L'argomento dell'adiacenza era corretto e
irrilevante: vedere due chip vicine non è la stessa cosa che avere una voce sola,
e chi rifornisce il magazzino conta le voci. Il council aveva ragione sui pixel e
torto sul mestiere.

### 6.2 Dove va la normalizzazione (e dove NON va)

**Non all'import.** Riscrivere `articles.name` distruggerebbe la parola di
COLOMBO e, in particolare, farebbe sparire il refuso `BOCCEHTTA` dall'indice
trigram — cioè la proprietà che la sessione precedente ha blindato con un test:
*cercando «bocchetta» si trova l'articolo che il fornitore ha digitato storto*.
Un pezzo che è sullo scaffale e non si trova è ciò che riporta l'agente al
telefono.

**Non in una tabella a DB.** Quattordici regole che cambiano di rado non valgono
una schermata di amministrazione.

**In un modulo foglia di regole dichiarate**, applicate **a lettura** dentro
`browse.ts` (che è già il posto delle regole di dominio, come la disponibilità),
con un test per riga della tabella. La parola scritta da COLOMBO resta a DB e
resta cercabile; cambia solo **come la si elenca**.

### 6.3 Le tre domande da chiudere prima di scrivere codice

1. **Le rimozioni valgono anche per la ricerca?** Consigliato: **no** — spariscono
   dallo sfoglio, restano trovabili scrivendo. Lo sfoglio serve a guardare, la
   ricerca a rispondere «esiste? è ordinabile?». Nascondere una vite a chi la
   cerca per nome è una perdita secca; nasconderla a chi sfoglia è quello che
   Andrea ha chiesto.
2. **`KIT PORTE` è un'etichetta di livello 1 o di livello 2?** Tutte le altre
   sono prime parole; questa ha due parole, e come prima parola sarebbe già
   `KIT`. Va guardata sul listino vero.
3. **Le divisioni (C): su quale parola?** Se le descrizioni scrivono
   `ROBOCINQUE S …` la divisione è sul secondo token; se scrivono
   `ROBOCINQUES …` sono già due prime parole e il problema è un altro. Anche
   questa si legge solo sul listino.

---

## 7. L'AREA DOWNLOAD COLOMBO — e perché supera tutto il resto

Andrea ha fornito la password dell'area riservata (`download.colombodesign.com`,
form a sola password). Quattro sezioni; per MANIGLIE: 12 cataloghi, 6 listini PDF,
i file 3D e un **archivio fotografico ufficiale**.

### 7.1 L'archivio fotografico

**79 zip, 3,3 GB compressi, 707 foto, 4,15 GB scompattate.** Indice preso per
intero con richieste **Range** sulla central directory dei zip: pochi MB invece di
3,3 GB. Le foto sono **5315×5315 CMYK**, prodotto **pulito su fondo bianco** —
esattamente ciò che serve a un catalogo, e di qualità di stampa.

Questo **supera** l'estrazione dal PDF di §2: quei 441 scatti a 305×110 px erano
il ripiego, questi sono gli originali. Ma **impone** un passo di elaborazione, che
§2 diceva di non fare: un JPEG **CMYK il browser non lo mostra**.

### 7.2 Come sono nominate — misurato sui 707 nomi

| | foto | col **codice** nel nome | con la **finitura** |
|---|---|---|---|
| 73 archivi di **modello** | 552 | **2%** | — |
| 6 archivi **accessori** | 155 | **62%** | — |
| **totale** | **707** | **15%** | **39%** · 52% ha **solo il modello** |

Il codice sta nei nomi degli accessori (`ar14_OL.jpg`, `PB1304.jpg`,
`ID313Q cromo matte.jpg`), cioè **proprio nelle sezioni che per nome commerciale
erano irraggiungibili** (§2). Negli archivi di modello no: `alato cromo.jpg`,
`Alatò_1CR.jpg`, `robot4_45.jpg`.

**La foto è del modello, non del codice, e non è un limite dell'archivio**: è cosa
è una foto. L'Alatò esiste in 4 finiture e 5 varianti (rosetta, yale, RSM, DK/SM)
e COLOMBO fotografa **la maniglia**. Aggancio a tre gradini, tutti scritti da
COLOMBO: **cartella → modello** (707/707, è l'etichetta, non un titolo da
decifrare) · **+ finitura** dove sta nel nome (39%) · **+ codice** dove COLOMBO
l'ha scritto. Chi non arriva a nessuno dei tre resta **senza foto**.

⚠️ I nomi delle cartelle sono **sigle interne**: `Robot1`=Robot, `Robot2`=Robodue,
`Robot4`=Roboquattro, `Robot5S`=Robocinque S. Serve una tabella di ~10 traduzioni,
**da verificare sul listino**, non da indovinare.

🟢 **Riscontro non cercato**: `01_Robot4.zip` e `01_Robot4S.zip` sono archivi
**separati** (idem Robot5/Robot5S), e il listino elenca «roboquattro» e
«roboquattro S» come voci distinte. La divisione chiesta da Andrea è **come il
fornitore stesso organizza la propria merce**.

### 7.3 Il peso, misurato su 45 foto vere (127 MB di originali)

| | miniatura 320px | scheda 900px |
|---|---|---|
| JPEG q82 | 6,2 KB medi | 33,2 KB medi |
| **WebP q80** | **2,8 KB medi** | **15,8 KB medi** |

Su tutte e 707: **2 MB** di miniature + **11 MB** di schede = **13 MB** su Blob,
da 4,15 GB di partenza. Griglia da 40 tessere: **120 KB**. Il vincolo del Fast
Origin Transfer è sciolto.

### 7.4 Il listino dell'area download NON è quello in produzione

`Listino-Price list 0625 rel1.pdf` — 256 pagine, edizione **06/25**, mentre la
produzione ha `LP 02-26`. Testo **in chiaro** (nessuno shift, a differenza del
catalogo). Contiene due cose utili:

- **p16: la matrice modello × finitura** (17 colonne `OL OM HPS/1 CR CM VL VM GL
  GM NI BR BA UB OA NM BI`) — la fonte autorevole di «quali finiture esistono per
  quale modello», dichiarata dal fornitore e non dedotta dalle code dei codici;
- le pagine prodotto danno **codice famiglia + tipologia + finitura + prezzo**
  (`JP11 R Ø50 · MANIGLIA SU ROSETTA · cromo 80,00 · cromat 92,10`).

**Ma l'«indice dei codici» (p241+) è testo convertito in curve**: 36 caratteri
estraibili su una pagina intera, zero immagini. Non c'è modo di ricavarne
l'elenco dei codici senza OCR. **L'xlsx `LP 02-26` resta necessario** per: la
percentuale di copertura · le 14 righe di Andrea sulle stringhe vere · la tabella
di traduzione delle sigle di §7.2.

---

## 8. Riproducibilità

```bash
curl -sSL "https://drive.usercontent.google.com/download?id=1G3ucgkGbVwAMub_74C-mvVs-tvNGq1Hj&export=download&confirm=t" -o ermanm.pdf
pdftotext ermanm.pdf raw.txt          # testo: cifrato da uno shift di +29 per byte
pdfimages -list ermanm.pdf            # 725 immagini, 615 jpeg, zero jpx
pdftohtml -xml ermanm.pdf all         # posizioni di immagini E testo -> bande verticali
pdftoppm -f 14 -l 14 -r 150 -png ermanm.pdf p14   # la pagina delle finiture
```

Decodifica del testo (`\n`, `\f`, `\r` restano):

```python
bytes((x + 29) % 256 if x not in (10, 12, 13) else 32 for x in raw).decode('latin-1')
```

Sulla pagina delle finiture la pastiglia del colore sta a **76 px** (a 150 dpi) a
sinistra dell'etichetta — tranne nella terza colonna, che non ha il cerchio della
garanzia e sta a **38 px**. È l'errore che ho commesso e corretto: le prime quattro
letture della colonna 3 avevano restituito il **fondo pagina**, `#F8CD7D`.
