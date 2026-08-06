# Le copertine dei gruppi — l'ottava tornata di Andrea

**Data:** 2026-08-06 · **Branch:** `claude/ufptrade-andrea-feedback-f0s2re`
**Reparto:** MANIGLIE (COLOMBO) · **La sezione serramenti non si tocca.**

---

## 1. Cosa ha chiesto Andrea

Ha verificato la versione in produzione (PR #60: 90 gruppi, Accessori con 17 voci,
1.609 articoli con foto) e ha mandato tre righe.

1. **BOCCHETTA deve andare in ACCESSORI.**
2. **`MANIG.CD213` e `MANIG.LC413RS` vanno unite.**
3. **Mancano le foto a dodici gruppi:** CUT, GRANO, MANIG., MANIGLIA INCASSO,
   MANIGLIONE, MILLA, POMOLINO, PUSH, ROUND, SPIDER, SQUARE, TRAMA.
   *«L'importante è avere le foto nella copertina della categoria principale.»*

Rispondendo alle domande ha aggiunto la quarta: **GRANO non è una maniglia, va in
Accessori** anche lui.

## 2. La misura che riscrive la terza richiesta

Il listino è **invariato** (foglio `LP 02-26`, 3.456 righe, 0 scartate, 0 mismatch
sulla somma, 0 collisioni di codice normalizzato; 90 gruppi, 3.391 codici
sfogliabili, 65 esclusi). Anche l'archivio è invariato: 79 zip, 707 scatti,
abbinamento 1.609/3.456 (46,6%) — le stesse cifre della PR #60.

I dodici che Andrea elenca **non sono dodici segnalazioni**. Sono, esattamente,
**i gruppi della banda principale che non mostrano una foto sulla tessera**, meno
BOCCHETTA che nello stesso messaggio sta spostando altrove. Non ha segnalato
dodici difetti: ha descritto lo stato della griglia di primo livello.

E sono **due problemi diversi**, non uno:

| | gruppi | cosa vede Andrea | perché |
|---|---|---|---|
| **A** | GRANO · MANIG.CD213 · MANIG.LC413RS · MANIGLIA INCASSO · MANIGLIONE · MILLA · POMOLINO · SPIDER · TRAMA | tessera di **solo testo**, nessun riquadro | sono TIPOLOGIE: per disegno (PR #58) non hanno area immagine |
| **B** | CUT · PUSH · ROUND · SQUARE | riquadro grigio **vuoto** col segnaposto | sono MODELLI, e le loro foto **le abbiamo tolte noi** nella PR #60 |

Dentro il gruppo A ci sono a loro volta due casi: MILLA, SPIDER e TRAMA **sono
modelli veri** e COLOMBO le fotografa (due archivi ciascuno); portano la tessera
di tipologia solo perché l'archivio è ambiguo per i *codici*.

**Gruppi con zero foto oggi: 20** — 4 modelli col riquadro vuoto e 16 tipologie
(9 delle quali già fra gli Accessori).

### 2.1 Perché le quattro tessere-modello sono vuote (dimostrato)

```
CUT: 11 codici, 11 con coda di finitura riconosciuta
  file dell'archivio: cut15_45 (serie MS15) · cut25_45 (serie MS25)
  MS15FISSO  0MS15FISSO-CM[CM]  0MS15FISSO-CR[CR]
  MS15R      0MS15R-CM[CM]      0MS15R-CR[CR]
  MS15RSB    …[CM] …[CR]        MS15RY  …[CM] …[CR]
  MS25FISSO  …[CM] …[CR] …[OM]
```

Otto codici in **due** finiture si contendono `cut15_45`; tre codici in **tre**
finiture si contendono `cut25_45`; i due file non dichiarano alcuna finitura, né
in codice né a parole. Il gradino 4 di `abbinaFoto` — «illeggibile: resta solo se
nessun altro se la contende» — li scarta tutti. Identico per PUSH (5 codici, 5
finiture, **1** file), ROUND (20 e 4, 2 file), SQUARE (23 e 5, 2 file).
**59 codici.** È la regola di Andrea applicata dove morde di più, e nel codice non
c'è niente da correggere.

## 3. Il principio

> **La copertina di un gruppo e la foto di una riga sono due affermazioni diverse.**

- La **riga** dice «*questo codice* è così»: la finitura conta, e la regola severa
  di Andrea («se manca la foto della finitura giusta è meglio togliere la foto»)
  è giusta e **non si tocca**. È quella che ha portato le foto provate sbagliate
  da 350 a 0.
- La **copertina** dice «*questo gruppo* è così»: la finitura è irrilevante,
  purché sia dichiarato.

Da qui discende tutto il resto. In particolare: si possono rimettere le copertine
**senza rimettere una sola foto sbagliata sulle righe**.

## 4. Il verdetto del council (5 advisor + 3 peer review)

Domanda portata: *una tipologia deve mostrare la foto di un suo membro come
esemplare?* Tre advisor su cinque dicevano di sì. **Il chairman è andato con la
minoranza**, e le peer review hanno demolito due argomenti su cui poggiavano i sì.

- **Il no vince su un fatto che viene da Andrea stesso**: ha fatto togliere 509
  foto perché sbagliavano il **colore** dello stesso oggetto; un esemplare sbaglia
  l'**oggetto**, e non può dimostrare niente. Se il primo era intollerabile, il
  secondo lo è di più.
- **Perché non è lo stesso arbitrio ingrandito**: sulla tessera-modello l'arbitrio
  cade sulla **finitura**, un asse che non porta il riconoscimento (chi ha
  l'oggetto in mano lo aggancia per forma); sulla tipologia cade sulla **forma**,
  l'unico asse che l'agente usa.

Affermazioni degli advisor **verificate nel repo, e cadute**:

| affermazione | esito |
|---|---|
| «domani 3 tipologie con foto e 24 senza → difetto strutturale» | **falso**: sono **11 e 11**. L'argomento strutturale crolla; regge quello semantico |
| «mosaico di 4 foto per tessera» | **falso sui dati**: delle 11 tipologie fotografate **9 hanno ≤4 foto e 4 ne hanno UNA** → il mosaico degenera nella foto singola che dichiarava di aver demolito |
| «lancia il run ops, chiude 7 dei 12 gruppi» | **è un no-op**: quelle 7 foto non sono su Blob perché nessun articolo le ha scelte, e lo script carica solo `chiaviScelte` |
| «riga di fatto: N modelli · N codici, il contenuto che una tipologia ha e un modello no» | **falso**: misurato, POMOLINO ha **2** serie e FEDRA (modello) ne ha **8**. Il numero di serie non distingue le due cose, e «N modelli» non è calcolabile dai nostri dati |

**Il punto cieco che nessuno dei cinque aveva visto**, e che vale più della
domanda: il predicato sbagliato è `isModello`. CUT, PUSH, ROUND e SQUARE **hanno**
il riquadro immagine e lo mostrano vuoto, cioè la cosa che la regola della PR #58
esisteva per impedire («in una griglia un buco si legge come immagine rotta») è in
produzione da un mese.

## 5. Il disegno

### 5.1 Tassonomia

- **BOCCHETTA** e **GRANO** entrano in `accessori`.
- **`MANIG.CD213`** e **`MANIG.LC413RS`** si fondono in **`MANIGLIA INCASSO`**,
  che è già la destinazione di `MANIG.`. Non è una lettura fra le altre: è
  l'unica che chiude una spaccatura vera —

  ```
  0LC413RS-CM  «MANIG.LC413RS SCRO.COMPL.CM»    → MANIG.LC413RS
  0LC413RS-CR  «MANIG. LC413RS SCOR.COMPLAN.CR» → MANIGLIA INCASSO
  ```

  lo **stesso prodotto** in due finiture, in due gruppi diversi, per uno spazio
  che COLOMBO ha messo in una riga e non nell'altra. Un gruppo nuovo dei due
  lascerebbe il `-CR` dov'è: sposterebbe la spaccatura invece di chiuderla.

**Conseguenze misurate:** 90 → **88 gruppi** · Accessori 17 → **19** (648 → **969**
codici, 19,1% → **28,6%**; 31,5% → **38,2%** della pronta consegna) · banda
principale **69 gruppi**: 66 con foto e 3 senza (MANIGLIONE, MANIGLIA INCASSO,
POMOLINO) · MANIGLIA INCASSO 90 → 93 codici.

### 5.2 La copertina diventa una proprietà del GRUPPO

`ARCHIVI.etichetta` fa oggi **due mestieri con un campo solo**: «questo archivio
dà il nome al gruppo» e «questo archivio può prestare foto ai suoi codici». Per
MILLA, SPIDER e TRAMA il secondo è falso (due archivi ciascuno, e nessuna fonte di
COLOMBO dice quale sia MR11 e quale MR15), e per negarlo si è dovuto negare anche
il primo — `etichetta: null` — perdendo la copertina insieme alle righe.

Si separano. Nuovo campo `soloCopertina`: l'archivio **nomina** il gruppo ma **non
presta foto ai codici**. I 66 codici di MILLA/SPIDER/TRAMA restano senza foto di
riga, che è la risposta giusta finché COLOMBO non risponde; le tre tessere
riprendono la copertina.

Le copertine sono derivate da `FILE_MODELLO`, che è già la tabella «questo FILE
appartiene a questa etichetta»:

| gruppo | file | provenienza |
|---|---|---|
| CUT | `02_Pomoli/cut15_45` | già in tabella dalla PR #56 |
| PUSH | `02_Pomoli/push_45` | idem |
| ROUND | `02_Pomoli/round25_45` | idem |
| SQUARE | `02_Pomoli/square25_45` | idem |
| MILLA | `01_Milla_1/milla1_2CRCM` | **nuovo** |
| SPIDER | `01_Spider_m/spider1_1CR` | **nuovo** |
| TRAMA | `01_Trama_1/trama 1_1CMCR` | **nuovo** |

I tre nuovi sono stati **guardati**, non scelti dal nome: sono scatti maniglia-sola
in cromo su bianco, la stessa grammatica di `Fedra_2CR` che è già nella griglia.
⚠️ Entrano nel repo (pubblico) tre nomi di file del fornitore; ce n'erano già 14 in
`FILE_MODELLO`. Decisione dell'utente, presa.

### 5.3 Il riquadro vuoto diventa impossibile

L'area immagine della tessera compare **se e solo se una foto esiste**, non se
`isModello`. E se la foto non arriva (404 su Blob), la tessera **non** mostra il
riquadro grigio: diventa una tessera-parola.

`isModello` conserva il suo mestiere — decidere quali gruppi ricevono
un'anteprima derivata dai propri articoli, cioè non conferire un esemplare alle
tipologie — e smette di decidere la **forma** della tessera.

La preview di un gruppo è quindi:
`(foto di un suo articolo, solo per i gruppi-modello) ?? (copertina dichiarata) ?? null`.

Effetto collaterale voluto: fra il deploy e il run ops le sette copertine sono
tessere-parola, che è uno stato coerente. **Nessuna finestra di disservizio.**

### 5.4 La tessera di tipologia si allunga

Nella griglia c'è `items-start`: la tessera senza foto non si allunga, resta
appesa in cima a una riga di tessere alte e lascia il buco sotto di sé. È la
ragione per cui si legge come «immagine mancante», ed è **una parola**:
`items-stretch`. Il `Link` ha già `h-full` e il nome ha già `flex-1 items-center`:
il codice era scritto per questo, e `items-start` lo annullava.

Verificato in browser a 375px e desktop, prima e dopo.

### 5.5 Una dichiarazione, una volta sola

Sopra la griglia, nel paragrafo che già dichiara di cosa sia il numero:

> **Le foto sono del modello, non della finitura del singolo codice.**

Paga il debito che il council ha trovato all'unanimità: le copertine di oggi
mostrano la finitura del **primo codice in ordine alfabetico** (`article.ts:216`)
e non è dichiarato da nessuna parte.

**Dentro il gruppo non si ripete**, perché lì sarebbe falsa: le foto delle righe
la finitura ce l'hanno provata: è tutto il senso della PR #60.

### 5.6 Le righe: spazio vuoto, mai un riquadro grigio

In MANIGLIONE il segnaposto compare su **336 righe su 353**, e — visto in browser
— sotto un'intestazione di serie che la foto **ce l'ha**: non dice «non
l'abbiamo», dice «ce l'abbiamo e non te la mostriamo».

Non è una decisione nuova: è già scritta in `AnteprimaSerie` («con la copertura al
46,5% le assenze sono frequenti, e otto riquadri grigi in colonna si leggono come
*il programma è rotto*») e non era stata applicata alle righe. La colonna da 44px
resta, così l'allineamento non si muove.

**Eccezione dichiarata:** la scheda del singolo articolo tiene il suo segnaposto.
Lì l'oggetto è uno solo, un vuoto grande è peggio di un riquadro neutro, e
l'argomento «N buchi si leggono come guasto» richiede la ripetizione.

### 5.7 «Foto mai esistita» contro «foto tolta da noi»: si dissolve

Era la domanda aperta: oggi le due cose si vedono identiche. Dopo la §5.2 **non
esiste più un gruppo la cui copertina abbiamo tolto** — le sette tornano, e le tre
tipologie non ce l'hanno perché *una foto della categoria non esiste*, non perché
l'abbiamo rimossa. Dentro il gruppo l'assenza torna ad avere **un solo
significato**: «per questo codice non c'è una foto che provi la sua finitura».

Non si costruisce nessun distintivo per riga: sarebbe rumore che non cambia
nessuna decisione — l'agente non può fare niente di diverso sapendo *perché* la
foto manca. Non è un rimedio e non è una feature: era il sintomo di due
affermazioni confuse in una.

## 6. Cosa NON si fa, e perché

- **Nessun esemplare sulle tipologie** (§4). MANIGLIONE, MANIGLIA INCASSO e
  POMOLINO restano tessere-parola.
- **Nessuna riga «N serie»** sulle tessere: misurato che non distingue le
  tipologie dai modelli (POMOLINO 2, FEDRA 8), e costava 210 ms sulla schermata
  d'ingresso (173 di lettura + 37 di calcolo).
- **Nessuna intestazione sulla banda di sopra.** I controesempi passano da 10
  gruppi / 787 codici a **3 / 484**: l'argomento non regge più sui numeri ma sulla
  metà più forte, cioè che un gruppo nuovo mai classificato cade in una banda che
  non afferma nulla. Il commento in `sfoglia.tsx` va **ri-misurato**, non ritoccato.
- **Nessuna copertina scelta a mano fra gli articoli**: sarebbe una tabella per
  marca, cinque marche, manutenzione perpetua.

## 7. Il costo, dichiarato

- 🟢 **Nessuna migrazione. Nessuna dipendenza nuova. Nessuna colonna nuova.**
- 🟢 **Nessuna finestra di disservizio** (§5.3).
- 🔴 **Un run di «Ops — Foto COLOMBO»** (~7 minuti, idempotente): le sette foto di
  copertina **non sono su Blob** — verificato, nessun articolo le aveva scelte, e
  lo script carica solo `chiaviScelte`. Va aggiunto il caricamento delle
  copertine. Prima del run le sette tessere sono tessere-parola.
- ⚠️ Tre nomi di file del fornitore nel repo pubblico (§5.2).

## 8. Test e gate

- I test che asseriscono «17 accessori», «BOCCHETTA non è accessorio» e
  `preview === null` sui non-modello **sono la codifica delle decisioni
  precedenti, non le loro sentinelle**: si girano con la decisione, come nella
  PR #60.
- **Gate d'integrazione sull'archivio vero** (`foto-archivio.integration.test.ts`):
  ogni file dichiarato come copertina deve esistere nell'archivio COLOMBO, e ogni
  gruppo-modello deve avere una preview. Senza, la tabella è un elenco di stringhe
  che nessuno confronta con la realtà.
- **Sentinella sul `soloCopertina`**: i codici di MILLA/SPIDER/TRAMA devono
  restare **senza** foto di riga. È la proprietà che protegge i 66 codici dal
  tornare a mostrare la foto dell'archivio sbagliato.
- **Verifica browser** a 375px e desktop, screenshot guardati.

## 9. Domande che restano aperte

1. **A COLOMBO** (aperta da due sessioni): quale archivio è MR11 e quale MR15,
   quale LC31 e quale LC41, quale LC71 e quale LC81. Con la risposta, 66 codici
   riprendono anche la foto di riga.
2. **A COLOMBO**: esistono foto **per finitura** dei pomoli ROUND, SQUARE, CUT,
   PUSH? Con quelle, 59 codici riprendono la foto di riga.
3. **Ad Andrea**: MANIGLIONE, MANIGLIA INCASSO e POMOLINO restano senza copertina.
   Sapendo che l'unica alternativa è mostrare *un* modello su 56 spacciato per la
   categoria, va bene così?
