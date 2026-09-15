# Listino COLOMBO «Vision 2026» — i prodotti nuovi a catalogo

**Data** 2026-09-15 · **Reparto** MANIGLIE · **Serramenti: non si tocca.**

## 1. Il problema

Andrea ha portato `Vision2026_pricelist.pdf` (16 pagine, edizione **05/26**): contiene
Laconica, Robot6, Robot6 S, Halo, Kubo e i complementi, che oggi **non esistono in app**.
Chi li cerca riceve «non trovato» per prodotti che sono in vendita.

La sessione precedente aveva concluso che il PDF **non contiene codici d'ordine**. La misura
era giusta (zero occorrenze della forma assemblata `0CD41R-CM`) ma rispondeva alla domanda
sbagliata: il PDF pubblica le **due metà** del codice in due punti — il codice del modello
sulla pagina prodotto (`AM41 RSB Ø50`) e la sigla della finitura nella legenda (`OL` Oroplus).

## 2. La regola, e perché non è «inventare per concatenazione»

> `codice = "0" + designazione del modello senza separatori + "-" + sigla della finitura`

§9 vieta di dedurre un codice dalla struttura di un altro (`A50904.22` **non esiste**). Qui è
diverso perché **esiste un insieme di prova**, e la regola è stata **misurata**, non postulata.

### 2.1 La seconda fonte, che il piano non prevedeva

La **pronta consegna** di Andrea contiene già **12 codici d'ordine scritti da COLOMBO per i
prodotti 2026**. Erano i «23 orfani» annotati da due sessioni come codici presenti in magazzino
e assenti dal listino: non erano refusi, era **il listino nuovo arrivato sullo scaffale prima
che a sistema**.

| insieme di prova | la regola riproduce |
|---|---|
| prodotti **NUOVI** 2026 (fonte: pronta consegna) | **10 / 10 — 100 %** |
| componenti condivisi già a listino 02/26 | 2 / 13 — 15 % |
| totale verificabile | 12 / 23 — 52 % |

**Il 52 % nudo è fuorviante: la regola sbaglia esattamente dove la risposta ce l'abbiamo già.**

```
FF13 Y      → 0FF13       la Y sparisce          ← risposta nota dal listino 02/26
BT13 Y      → 0BT13       idem
FF19 BZG    → 0FF19BZG6   compare un 6           ← idem
BT19 BZG    → 0BT19BZG6   idem
DK 35 DF    → XDK35DF     prefisso X, non 0      ← idem
DK 35 DF/8S → XDK35D/8SF  lettere riordinate     ← idem
```

Sono **pezzi vecchi**, codificati anni fa, a cui il 2026 dà una designazione nuova.

I 13 condivisi sono le 6 bocchette/nottolini più i 7 movimenti DK; la regola ne azzecca 2
(`FF13 BB`, `BT13 BB`). I movimenti DK **non entrano nell'import** (prezzo invariato, §3), quindi
la tabella di eccezioni ha **sei voci** — le quattro sbagliate più le due giuste, scritte per
esteso lo stesso: il codice di un pezzo che esiste già si **legge**, non si ricalcola, e una voce
che oggi coincide con la regola non deve dipendere dalla regola per restare giusta domani.

### 2.2 Il «6» di Robot6 — ipotesi refutata

`BZG6` compare su **125 codici in 12 famiglie diverse** (BT, CC, CD, DB, DL, FF, JP, MF, MM, MR,
PT, SE). È parte della designazione del nottolino, **non** la cifra della serie: se lo fosse,
starebbe in una famiglia sola. La designazione stampata sul PDF (`FF19 BZG`) semplicemente **non
è** il nucleo del codice.

### 2.3 L'unica parte non derivabile: «zirconium HPS/1»

La coda di questa finitura ha **cinque grafie** nel listino a DB — `HPS/1` (25 codici) · `I1` (8)
· `HPS` (5) · `HPS1` (4) · `I` (2) — e COLOMBO usa **due code diverse dentro la stessa serie
Laconica**: `0AM41RHPS1` contro `0AM42DKSMI1`. Non c'è regola.

→ **le 19 righe HPS/1 restano FUORI dall'import** (decisione utente). Entrano quando COLOMBO
risponde, con un secondo run: nessun codice si scrive su un'ipotesi.

## 3. Cosa si importa

**251 righe su 270** (270 − 19 HPS/1): **234 codici nuovi** + **17 già a listino**, di cui **6
con prezzo diverso**. Zero collisioni con i 3.456 esistenti, verificato.

I **6 movimenti DK** (`DK 35/40/45/50 DF`, `DK 40/45 DF/8S`) hanno prezzo **invariato** rispetto
al 02/26: non si toccano affatto.

### 3.1 Il prezzo: `priceList`, e `surcharge` **NULL**

**Misurato**: i prezzi del PDF coincidono *esatto* con `priceList` (il netto) su 11 articoli
presenti in entrambi i file; con la somma coincidono **0 volte su 16**. E `surcharge == 3,5 % di
priceList` su **tutte e 3.456** le righe.

`surcharge = NULL`, **mai `0`**, **mai il 3,5 % calcolato**. Verdetto `/llm-council` unanime
(4/4). Le ragioni, in ordine di forza:

- La misura **non discrimina** fra «il surcharge è stato tolto» e «il listino base si pubblica
  sempre al netto e il surcharge è una comunicazione separata». Entrambe prevedono gli stessi 11
  match. Scrivere il 3,5 % sceglie un'ipotesi senza un fatto che la distingua dall'altra: è
  `A50904.22` — un numero che esiste, è plausibile, non produce warning e non ha fonte.
- `NULL` è **recuperabile**: `WHERE surcharge IS NULL` ritrova le 251 righe e un solo `UPDATE` le
  sana. Un 3,5 % fabbricato diventa **indistinguibile** da 3.456 surcharge misurati.
- `0` sarebbe identico a `NULL` in `articleTotal` (`?? 0`) ma **afferma** l'assenza e cancella il
  discriminante in silenzio. È `[]` contro `undefined` dei filtri: valori diversi.

⚠️ **Verificato e scartato**: l'ipotesi che il surcharge sia stato *assorbito* nel listino. I 6
articoli revisionati danno rapporti 0,73–0,93 sul netto vecchio e 0,71–0,90 sul totale — nessuno
vicino a 1,000 o 1,035. È una revisione di prezzo vera (−7 % … −27 %), e **la domanda resta
aperta per Andrea**.

### 3.2 La dichiarazione del prezzo — il difetto lo crea questo import

Oggi `total` è omogeneo: 3.456 righe, tutte con il 3,5 % dentro, sotto l'etichetta costante «IVA
esclusa». Dopo l'import `total` è a **base mista**, e nulla sullo schermo lo dice: un agente
vedrebbe `105,30` accanto a `108,20` senza alcun segno che il primo è netto. `ArticoloRow`
**disegna il prezzo** (verificato, `maniglie-client.tsx:469`), quindi il confronto avviene
davvero, fianco a fianco.

È l'ottava occorrenza della classe di difetto che questo progetto ha chiuso sette volte
(`isAvailable` costante, `openingDir` mai letto, l'entrata cablata a 15, il default
`A12_I13_B20`, `PILOT_GEOMETRY` ignorata): **un valore plausibile che il sistema decide da sé,
che non produce nessun errore e che nessun conteggio rivela.** Con l'aggravante che qui il valore
è denaro detto a un cliente da dieci agenti.

**Non è ereditato: lo crea questo import.** Quindi si chiude in questa PR.

**Modulo foglia puro** `src/server/maniglie/composizione-prezzo.ts`, accanto a `articleTotal`:

```ts
composizionePrezzo(priceList, surcharge)
  → { kind: "conMaggiorazione"; percento: number } | { kind: "netto" }
```

La percentuale si **deriva** da `surcharge / priceList` — mai una seconda costante 3,5 % nel
codice, così l'etichetta resta vera se un listino futuro porta un'aliquota diversa.

**Scheda articolo** — la didascalia sotto il prezzo smette di essere una costante e dichiara
**entrambi i rami** (un'etichetta solo sull'anomalia insegna «niente etichetta = tutto
regolare»):

- `surcharge != null` → «IVA esclusa · include magg. temporanea 3,5 %»
- `surcharge == null` → «IVA esclusa · nessuna maggiorazione dichiarata»

Registro: la riga **constata cosa dice il documento**, non esprime il nostro dubbio. «non
dichiarata dal listino» e non «nessuna maggiorazione», per la stessa precisione di «dichiarato in
anagrafica, mai confrontato con un ordine». La percentuale si scrive **con la virgola** (il «42.5
%» col punto in una UI italiana è già costato uno screenshot).

**Righe d'elenco** — **marcatore condizionale** (decisione utente). Un marcatore sobrio sul
prezzo delle righe senza maggiorazione **+ una riga di legenda**, resi **solo quando l'elenco
visibile contiene entrambe le convenzioni**. Misurato: **94 righe nuove su 251** finiscono in
gruppi che contengono già articoli vecchi (BOCCHETTA, MANIGLIONE, NOTTOLINO); le altre 157 stanno
in gruppi interamente 05/26, dove il marcatore **non compare** perché non c'è nulla con cui
confondersi. Neutro — **mai rosso, mai icona di warning**: quel prezzo non è inaffidabile, è
affidabile quanto il documento. Si autoestingue quando il listino torna omogeneo.

La **forma esatta** del marcatore e della legenda (glifo, collocazione, testo) si decide con
`/impeccable`, con verifica a **375px e desktop** e screenshot guardati. Vincolo duro: **nulla che
allarghi la riga** — a 375px la tabella degli sconti scorreva in orizzontale e i totali finivano
fuori schermo (PR #42). Il marcatore è legato alla legenda con `aria-describedby`, come la hint
«Sede telaio».

### 3.3 Le descrizioni: la prima parola decide il gruppo

Le compone l'import, e `curatela.ts` classifica per **prima parola**. ⚠️ `MANIGLIA` è **fusa in
`MANIGLIA INCASSO`** (`curatela.ts:95`): scrivere «MANIGLIA LACONICA AM41R» farebbe finire 144
righe fra i maniglioni a incasso, **e nessun conteggio andrebbe a zero**.

Si segue la convenzione di COLOMBO, misurata sul listino vero: **nome del modello** per maniglie
e pomoli (`FEDRA AC11R CROMAT`, `ESPRIT BT11R`), **tipo** per i componenti condivisi
(`BOCCHETTA Y FF13 CROMAT`, `NOTTOLINO FF19BZG6 CROMAT`).

```
LACONICA AM41R OROPLUS          BOCCHETTA F.NORM. FF13 OROPLUS
LACONICA AM42DK S/MOV. OROPLUS  BOCCHETTA Y FF13 OROPLUS
ROBOT6 ID81R OROPLUS            NOTTOLINO AM19BZG OROPLUS
ROBOT6 S ID91R OROMAT           MANIGLIONE AM16 OROPLUS
HALO FISSO AM15 OROPLUS         KUBO ID45R CROMO
```

Lunghezza **max 35 caratteri**, esattamente il massimo dei 3.456 esistenti. La finitura resta
**per esteso e ultima**: COLOMBO la tronca (`VIOLA AR22DK SENZA MOV.VINTAGE`) ed è la causa dei
63 disaccordi finitura-codice — non si imita un difetto.

⚠️ **`ROBOT6 S` collassa in `ROBOT6`**: `firstWord` prende il primo token. È lo stesso problema
già risolto per `ROBOCINQUE S` / `ROBOQUATTRO S` → basta aggiungere **`"ROBOT6"` a `divise`**;
`MARCATORE_S` riconosce già la `S` nuda. Nessuna macchina nuova.

**Andrea conferma anche le descrizioni** (decisione utente): sono la parola che decide se un
pezzo è raggiungibile sfogliando.

### 3.4 L'EAN

Tutti e 3.456 gli articoli a listino oggi ne hanno uno; il PDF non ne contiene nessuno. I 251
nuovi nascono **senza**, `ean = null`. Non si inventa per simmetria. Domanda aperta per Andrea:
se in magazzino si legge il codice a barre, servono da COLOMBO.

## 4. L'import è un'AGGIUNTA, non una sostituzione

`import:listino` significa «questo file **È** il listino»: riscrive `lastListingAt` e poi stampa
«N articoli NON erano in questo listino» (`scripts/import-listino.ts:117`). Su un delta direbbe
«3.456 articoli non sono più a listino» — **falso**, ed è proprio la riga che l'operatore legge
per capire se è andata bene.

La differenza è **una sola, ed è una sottrazione**: il percorso d'aggiunta scrive `lastListingAt`
sulle righe che importa (è vero: quelle righe *sono* in un listino) e **non calcola affatto** il
conteggio degli assenti, perché un delta non è in condizione di sapere cosa sia stato ritirato.

Percorso separato, `scripts/import-vision.ts`, così la semantica sbagliata non è raggiungibile
per distrazione.

## 5. Moduli

| file | ruolo | dipendenze |
|---|---|---|
| `src/server/maniglie/vision-decode.ts` | testo cifrato → testo (shift +29, salvo `\n \f \r` e spazio) | nessuna |
| `src/server/maniglie/vision-parse.ts` | testo → blocchi `{modelli[], righe[{finitura, prezzo}]}` | puro |
| `src/server/maniglie/vision-codici.ts` | blocchi → `{code, codeNorm, name, priceList}` + eccezioni + esclusione HPS/1 | `finiture`, `code-norm` |
| `src/server/maniglie/composizione-prezzo.ts` | `(priceList, surcharge)` → ramo netto / con maggiorazione | nessuna |
| `scripts/import-vision.ts` | `pdftotext` + upsert additivo | i sopra + Prisma |

⚠️ **Il repo è PUBBLICO**: i 251 prezzi **non si committano**. Il PDF si scarica a run time da
Drive, come già fa l'xlsx. Le fixture dei test contengono **righe inventate**, mai il listino
vero; i prezzi reali si verificano nel **gate d'integrazione**, che gira sul file scaricato.

### 5.1 Il parser si rifiuta invece di indovinare

Le bande di colonna dei 37 blocchi sono **dichiarate**, perché il layout di *questo* documento è
un fatto, non una regola generale — e un parser generico dedotto da un solo esemplare sarebbe
YAGNI. In cambio il parser **fallisce rumorosamente** se il documento non è quello che crede:

1. **nomi ≠ prezzi** in un blocco → errore, nessuna riga emessa;
2. finitura non fra le 12 della legenda → errore;
3. **verifica incrociata**: i prodotti che compaiono su due pagine devono avere lo stesso prezzo.

La (3) non è teorica: ha già trovato l'unica incoerenza del documento — **`BT19 BZG` oromat costa
53,60 a p7 e 53,70 a p12**, 21 prezzi ripetuti su 22 concordi. Si importa **53,60**, il valore
della pagina del prodotto, e si chiede ad Andrea.

## 6. Il riconoscitore delle finiture

`finituraDiTesto()` aggancia **12 delle 14** grafie del PDF. Fallisce su `zirconium HPS/1`, il cui
nome in tabella è «Zirconium Stainless-Steel». Poiché le righe HPS/1 restano fuori dall'import,
**non serve toccare `finiture.ts` in questa PR** — e non si tocca: aggiungere una grafia sposta il
match dei nomi delle foto, che ha un gate con pavimenti espliciti. Entra con le righe HPS/1,
misurando prima l'effetto sulle foto.

## 7. Ops e migrazioni

🟢 **NESSUNA MIGRAZIONE.** Nessuna colonna nuova: i gruppi si calcolano a lettura, il
discriminante del prezzo esiste già (`surcharge IS NULL`), e una colonna «edizione» nascerebbe
`NULL` su 3.456 righe — la forma esatta della disponibilità falsa già rimossa.

🔴 **Due azioni ops al merge:**

1. **«Ops — Neon»** esteso: nuovo step che scarica il PDF Vision (guardia `%PDF`, non `PK`: la
   pipeline oggi è solo-xlsx e un PDF fallirebbe lì) e lancia `import:vision`. Va **dopo**
   l'import del listino COLOMBO: è un delta e presuppone la base.
2. **«Ops — Foto COLOMBO»**: le foto dei nuovi **ci sono già** — sono i cinque archivi con
   `etichetta: null` annotati «non ancora a listino» (`00a_Laconica`, `00b_Robot6`,
   `00c_Robot6S`, `00d_Halo`, `00e_Kubo`). Tolti i `null`, si agganciano.

Nessuna finestra di disservizio: non c'è migrazione, quindi nessuna lettura fallisce fra deploy e
run.

### 7.1 Esito reale (aggiunto il 2026-09-15, a lavoro finito)

**Il punto 1 va lanciato DOPO il merge, non prima** — e quindi al contrario della pratica adottata
dalla PR #44. Quella regola esiste per le **migrazioni**: lì il DB deve precedere il codice,
altrimenti il codice deployato legge colonne che non ci sono. Qui non c'è migrazione e **la
dipendenza si rovescia**: sono i *dati* a creare l'ambiguità che il *codice* dichiara. Importare le
240 righe prima del merge significherebbe mostrare in produzione due convenzioni di prezzo **e
nessuna che lo dica** — cioè aprire di mano nostra, per la durata della review, il difetto che
questa spec chiude.

**Il punto 2 è BLOCCATO, e l'affermazione «le foto dei nuovi ci sono già» va letta con questa
nota.** Le foto *esistono* — è l'**indice** che non esiste più. Run `34965121210` sul ref del
branch: fallita in 29 secondi, al primo passo, senza toccare Blob né il DB.

| ipotesi                             | verdetto                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| il proxy della sandbox              | ❌ fallisce identico sul runner GitHub, che non ne ha               |
| password errata o scaduta           | ❌ con `mostra.php?lang=en&catalogo=NNN` la POST risponde coi PDF   |
| gli zip sono stati rimossi          | ❌ `206 application/zip` su tutti, **i cinque del 2026 compresi**   |
| **il fornitore ha rifatto il sito** | ✅                                                                  |

`download.colombodesign.com/` non è più un elenco piatto: è un indice di **29 categorie**
(`mostra.php?lang=en&catalogo=NNN`). Interrogate tutte con la password: **29 link, tutti `.pdf`,
zero `.zip`**. L'indice dell'archivio fotografico non è più pubblicato in alcuna pagina, mentre i
file restano serviti e non protetti. `elencaArchivi()` (`scripts/foto-colombo.ts:57-72`) scopriva la
lista raschiando quell'elenco.

**Conseguenza dichiarata**: le etichette dei cinque archivi sono entrate nel codice e sono
**inerti**; i prodotti 2026 nascono con `image_url` NULL. È lo stato onesto — nessuna riga mente,
nessuna foto è sbagliata — ed è reversibile con un run, il giorno in cui la scoperta è sostituita.
Le 1.609 foto già in produzione **non si sono mosse**: il run non è arrivato al punto in cui azzera
`image_url`.

**Perché la sostituzione non è entrata in questa PR**: è una decisione di disegno, non una
riparazione. La lista si può derivare da `ARCHIVI` (i 118 nomi sono già nel repo pubblico, quindi
non si rivela nulla di nuovo) verificando ogni voce con una Range — ma si perde la riga
`⚠️ archivio non in tabella, ignorato`, che oggi è l'unico canale per cui veniamo a sapere che
COLOMBO ha pubblicato un prodotto nuovo: **lo stesso segnale da cui è nata questa sessione**.
Barattarlo per le foto di quei prodotti, senza prima cercare se viva altrove, sarebbe una beffa.

## 8. Sentinelle

- **`no-silent-fields` del prezzo**: l'import scrive `NULL`, **non `0`**, e un test fallisce col
  nome del campo se qualcuno «uniforma».
- **Integrazione sul listino vero**: ogni riga con `surcharge NOT NULL` ha `surcharge ==
  round(priceList × 0,035, 2)` — oggi vero su 3.456, quindi una terza convenzione fa fallire il
  test invece di comparire in silenzio.
- **Render della scheda nei due rami**, su due fixture. Non si asserisce «la frase X esiste»: è
  l'errore già commesso col sottotitolo dello sfoglio, che aveva un test verde su una frase
  diventata falsa.
- **Le due sentinelle della curatela non si allentano**: «ogni accessorio è un'etichetta che la
  curatela produce davvero» e «ogni accessorio dichiarato esiste fra i gruppi del listino». Se
  diventano rosse è perché un'etichetta è sparita, ed è il loro mestiere.
- **`articleTotal` non cambia di un centesimo** sui 3.456: asserito.

## 9. Domande aperte, da porre con la conferma dell'elenco

1. **HPS/1**: `I1` o `HPS1`? COLOMBO usa entrambe nella stessa serie. Blocca 19 righe.
2. **Surcharge 3,5 %**: vale ancora sull'edizione 05/26? La misura non lo dice — spiegare che
   11/11 combaciano col netto, 0/16 con la somma, e che il PDF non nomina mai il surcharge.
3. **BT13 / BT19 BZG**: prezzo giù del 24 % e 7 %, con gamma di finiture diversa. Ribasso vero o
   pezzo ridisegnato che riusa la sigla?
4. **EAN**: i nuovi possono nascere senza?
5. **`BT19 BZG` oromat**: 53,60 o 53,70? Il listino stampa due valori.

## 10. Fuori scope, dichiarato

- Le **19 righe HPS/1** e la grafia in `finiture.ts` (§6).
- Un **parser PDF generico** per listini: un esemplare non è una regola (§5.1).
- La **spaccatura del prezzo in due numeri** sulla scheda: il dato è già sul filo, si aggiunge il
  giorno in cui Andrea riconcilia una fattura.
- `pnpm build` in `ci.yml`: **PR sua**, come deciso.
