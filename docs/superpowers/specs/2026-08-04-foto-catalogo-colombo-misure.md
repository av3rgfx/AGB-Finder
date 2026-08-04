# Foto COLOMBO — le misure fatte PRIMA di scrivere codice

> 🔴 **SUPERATA IN PARTE.** Le conclusioni di §3.1 e §4 sono state **falsificate**
> rieseguendo le misure sul catalogo: le «pagine di continuazione» sono le pagine
> TECNICHE del modello già contato (riporto del titolo = +0), gli accentati valgono
> **un** titolo su 92, e il conteggio «167 pagine con foto» mescola scatti
> d'ambiente, scatti prodotto e icone. Leggere prima
> `2026-08-04-foto-e-finiture-colombo-misure-2.md`.

> **Stato**: misure eseguite sul catalogo vero, **zero righe di codice**.
> **Data**: 2026-08-04, a chiusura della sessione «Sfoglia».
> **Perché ora**: il catalogo è scaricabile adesso, il container no. Questi numeri
> sopravvivono al container; il file no.
> **File**: `ER MAN 2026_100726.pdf`, dalla cartella Drive registrata dall'utente
> (id `1G3ucgkGbVwAMub_74C-mvVs-tvNGq1Hj`), 7.528.880 byte.

---

## 0. La conclusione, prima dei dettagli

**La foto appartiene al GRUPPO, non al codice.** Il catalogo intitola ogni pagina
prodotto col **nome commerciale** («Roboquattro  Colombo Design»), che è la stessa
parola con cui lo sfoglio raggruppa — la prima parola della descrizione del listino.

Questo ribalta la stima pessimistica della spec precedente («1 foto ogni 4 codici,
tetto assoluto 21%»), che assumeva una mappatura foto→**codice**:

| Granularità | Copertura misurata |
|---|---|
| foto → **codice** (assunzione vecchia) | 725 / 3.456 = **21%** (tetto) |
| foto → **gruppo** (misurato) | **1.984 / 3.456 codici = 57,4%** |

Ed è anche più **onesto**: una foto di catalogo ritrae il modello, non la finitura.
Il problema che la spec temeva — «dodici tessere Mood con la stessa foto» — sparisce
se la foto sta sul gruppo, perché lì è *vero* che è la foto del gruppo.

---

## 1. Il PDF

| Fatto | Valore |
|---|---|
| pagine | **260** |
| immagini | **725** |
| encoding | **615 JPEG · 110 raw/flate** |
| **JPEG2000 (`jpx`)** | **ZERO** |
| risoluzione tipica | 200 ppi |
| cifratura | no |
| produttore | Corel PDF Engine 24.5.0.731 |

🟢 **La trappola AGB NON si ripete.** Le foto del listino AGB erano JPEG2000 e PDF.js
non le decodificava: fu la causa radice del problema «immagini viewer», e costò due
tentativi sbagliati (range-request, poi split in paginette). Qui non c'è un solo
`jpx`: `pdfimages` le estrae, e non serve alcun trattamento speciale.

### 1.1 Distribuzione delle dimensioni

| Taglia | Quante |
|---|---|
| ≥ 400px di lato | 114 |
| 150–400px | 431 |
| < 150px | 180 |

Le < 150px sono icone e pastiglie, non foto prodotto. **Soglia usata nelle misure: 150px.**

---

## 2. Il testo è cifrato da uno shift, ed è decodificabile

`pdftotext` restituisce `75$/$0$1,*/,$(/$3257$`. La regola è **+29 su ogni byte**
(lasciando stare `\n`, `\f`, `\r`):

```
'$' + 29 = 'A'      0x03 + 29 = ' '      "5RVHV" → "Roses"
```

Verificato su più pagine. È lo shift già annotato in `CLAUDE.md`, qui **confermato
sperimentalmente** e non più «una frase in un `.md`».

⚠️ **Artefatti noti**: i caratteri accentati e alcuni legati escono sporchi
(`attivitß¿`, `pißØ`, `dellâµambiente`, e un titolo `ALATSSÑ` dove il listino dice
`ALATO`). Sono multibyte UTF-8 che lo shift byte-per-byte rompe. Non bloccano il
riconoscimento dei nomi ASCII, ma **spiegano una parte dei titoli non agganciati**
(§3) e vanno gestiti prima di dichiarare una copertura definitiva.

---

## 3. La mappatura: il titolo di pagina

La **prima riga di testo** di una pagina prodotto è `<Nome> <Designer>`:

```
p40  → "Dea  Pio e Tito Toso lab"
p90  → "Peak  Patrick Jouin"
p150 → "Roboquattro  Colombo Design"
```

Confrontando la **prima parola del titolo** con i 114 gruppi dello sfoglio:

| Misura | Valore |
|---|---|
| pagine con foto (≥150px) | **167** su 260 |
| titolo = un gruppo del listino | **94** (56%) |
| titolo non riconosciuto | 73 |
| **gruppi distinti con almeno una foto** | **61 / 114** |
| **codici coperti** | **1.984 / 3.456 = 57,4%** |

Agganciate: `ALBA(21)` · `AMA(27)` · `BLAZER(14)` · `BOLD(24)` · `DAYTONA(16)` ·
`DEA(18)` · `DROP(25)` · `EDO(14)` …

### 3.1 Le 73 non agganciate, e perché il 57,4% è un **minimo**

Guardandole una per una si dividono in tre classi:

1. **Pagine di copertina e apertura** (`p4`, `p5 "EVOCATIVE"`, `p22`, `p23 "THE"`):
   non sono pagine prodotto. Vanno escluse, non recuperate.
2. **Pagine di continuazione**, il cui primo testo è un numero (`"52"`, `"55"`,
   `"50"` su p35, p37, p43, p49, p53, p55, p61…): sono altre foto **dello stesso
   modello** della pagina precedente. Una regola di **riporto del titolo** le
   recupererebbe — 🔴 **da misurare, non da assumere**.
3. **Artefatti di decodifica** (`p26 "ALATSSÑ"` per `ALATO`): §2.

Quindi **57,4% è il pavimento**, non il tetto. Quanto salga lo dice la misura (2),
che è il primo lavoro della prossima sessione.

---

## 4. Cosa NON funziona, misurato

| Ipotesi | Esito |
|---|---|
| i **codici ordinabili** sono nel catalogo | **0,2%** — 8 su 3.456. Conferma §3.1 della spec «Sfoglia»: il catalogo non pubblica codici d'ordine |
| le **famiglie** (`AC11R`, `AM113`) sono nel catalogo | 277 su 533 = 52%, ma coprono solo **43,4%** dei codici — **meno** del nome commerciale |
| mappatura **per pagina, sulle famiglie** | fallisce: solo **4** pagine su 167 sono «1 foto ↔ 1 famiglia», e **115** hanno foto senza alcuna famiglia nominata |

La terza riga è l'errore che ho commesso e corretto misurando: cercavo la famiglia
dove il catalogo scrive il **nome**.

---

## 5. Le decisioni che restano all'utente

1. **La foto sul gruppo copre il 57,4% dei codici. Basta?** L'alternativa non è
   «coprire di più»: è coprire *meno* ma più preciso (foto→famiglia, 43,4%) o non
   farlo. Non esiste una fonte che dia foto→codice.
2. **Qualità delle immagini** (vincolo posto dall'utente): le sorgenti sono 200 ppi,
   tipicamente 1583×1976 le grandi. Due formati — miniatura per l'elenco, piena per
   la scheda — o uno solo?
3. **Dove stanno i byte.** Le 7.082 foto AGB dentro Postgres sono la causa unica dei
   tre limiti di piattaforma più caldi. Qui si nasce su **Vercel Blob**, che però è
   **privato**: i byte passano da una route Node e pesano su Fast Origin Transfer,
   già al 40%. **Conta la dimensione, non la collocazione.**
4. **`catalogPage` esiste già a schema e non è mai stato scritto**: la scheda mostra
   «Pagina N» solo se valorizzato. Va riempito insieme alle foto — e serve una
   **colonna di edizione** accanto, o `ER MAN 2027` rinumera le pagine e le righe
   continueranno a dire «Pagina 63» con la stessa sicurezza (è la lezione di
   `lastListingAt` applicata all'altra metà del modello).

---

## 6. Riproducibilità

```bash
curl -sSL "https://drive.usercontent.google.com/download?id=1G3ucgkGbVwAMub_74C-mvVs-tvNGq1Hj&export=download&confirm=t" -o ermanm.pdf
pdfimages -list ermanm.pdf          # 725 immagini, 615 jpeg, zero jpx
pdftotext -f 150 -l 150 ermanm.pdf - | python3 -c \
  "import sys; b=sys.stdin.buffer.read(); print(bytes((x+29)%256 if x not in (10,12,13) else 32 for x in b).decode('latin-1')[:80])"
# → "Roboquattro Colombo Design ..."
```
