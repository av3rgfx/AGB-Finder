# Kit bilico rettangolare TOUR (legno) — design

> **Stato: spec.** Terza serie del kit engine e **prima serie non-ARTECH**.
> Fonte: listino AGB 2026, sezione BILICI, pagine **fisiche 532-553** (stampate 530-551).
> Convenzione di citazione: `p0536 (534)` = fisica 536, stampata 534.

## 1. Perché questa tipologia

Dopo la bonifica del 2026-07-25 restano attive due tipologie, entrambe ARTECH LEGNO. Il bilico
TOUR è il candidato con il **determinismo più alto del listino**, e la verifica lo conferma:

- **61 codici su 61 esistono a listino con prezzo** (verificato applicando al PDF intero la firma
  di riga del parser reale). Il totale dei codici a prezzo è **7.488**, identico al conteggio
  dell'import su Neon (ops run `30198585201`) → i codici TOUR **sono già a catalogo**. È l'opposto
  del PVC, dove 4 righe su 12 uscivano senza prezzo.
- La distinta è **4 kit + 2 aste**, non una lista di componenti sciolti.

## 2. La scoperta: il bilico è 4 kit + 2 aste

Le legende «Componenti» degli schemi generici — `p0536 (534)` per i 4 lati, `p0537 (535)` per i
3 lati — raggruppano **tutto** in quattro kit ordinabili con un codice ciascuno. Le legende sono
**dentro il disegno**: nel testo estratto non compaiono, vanno lette renderizzando la pagina.

| | Kit | Codice | Contiene |
|---|---|---|---|
| **A** | Kit elementi orizzontali | `T47501.00.0{GR}` | ❷ elemento di collegamento orizzontale + ❽ **cremonese** |
| **B** | Kit movimenti angolari | `T4810{0,1,2}.{03,04}.00` | movimenti angolari sup./inf., microventilazione, ridotti; sui 3 lati anche ⑫ terminale superiore e ⑬ terminale inferiore |
| **C** | Kit cerniere | `T17800.{30,35,40}.{34,94}` | ❺ cerniera Sx + spessore, ❺ₐ cerniera Dx + spessore |
| **D** | Kit incontri | `T4770{1,2}.0{schema}.00` | ❾ incontro superiore, ❿ inferiore, ⑪ limitatore |

Più le due aste verticali sciolte: **❸ senza braccetto** e **❹ con braccetto**.

**La tabella di `p0538 (536)` NON è una lista d'ordine: è la *composizione* dei kit.** Prova
aritmetica, che è ciò che rende la lettura sicura:

| kit | prezzo di listino | somma del contenuto dichiarato | scarto |
|---|---|---|---|
| `T47701.01.00` (3 lati) | **43,95 €** | 3+3 nottolini (4,82) + 1 limitatore Sx (15,20) = **44,12 €** | 0,17 € |
| `T47702.01.00` (4 lati) | **68,70 €** | 4+4 nottolini + 2 limitatori (Sx+Dx) = **68,96 €** | 0,26 € |

Il kit *è* la somma delle sue parti → si ordina **una riga**, non sette. (La NB di `p0538 (536)`
«Per Prefinito 300 Kg ordinare incontri singoli» conferma per contrasto: gli incontri singoli si
ordinano solo in quel caso, che è fuori scope.)

## 3. Campo di applicazione

**Dentro:** i **5 schemi** del bilico **rettangolare**, solo **LEGNO**, serie **TOUR**.

**Fuori, e perché:**
- **Bilico tondo TOUR-R** (`p0554-0562`): prodotto diverso, serie diversa.
- **Prefinito** (`p0540 (538)`): guarnizione propria 6+6 m e una NB («la guarnizione sopra le
  cerniere è differente da quella sotto») non risolvibile dal listino.
- **Prefinito 300 kg complanare** (`p0545-0546`): **pagine di sola immagine, zero testo, zero
  codici** — non trascrivibili; e sono per due serramentisti OEM (TWT, Vivaldi-Fantacci).
- **Dime** (`T18501.35.00`, `T18502.40.00`, `T18504.01.0N`, `T18506.00.35/.45`): attrezzatura di
  bottega, si ordina una volta, non per serramento.
- **Prolunga** (`A40020.00.0N`) e **chiavetta limitatore** (`T46901.00.00`): non sono nella
  legenda Componenti → accessori.

## 4. I 5 schemi: l'unica chiave

Lo schema implica **tutto** il resto della geometria e il modello di cerniera.

| schema | TOUR | listello | asse | battuta | portata | guarnizione |
|---|---|---|---|---|---|---|
| 1 | 30 | 30 | 15 | **11** | 200 kg | `T18002.01.93` (12+12 m) |
| 2 | 30 | 30 | 15 | 18 | 200 kg | `T18001.02.93` (12 m) |
| 3 | 35 | 35 | **17,5** | 15 | 200 kg | `T18001.03.93` (12 m) + **`T16635.04.01`** |
| 4 | 35 | 35 | 20 | 18 | 200 kg | `T18001.02.93` |
| 5 | 40 | 40 | 20 | 18 | **300 kg** | `T18001.02.93` |

Due valori qui **non sono rappresentabili** nel modello di input attuale: l'**asse 17,5** (i campi
sono `Int`) e la **battuta 11** (sotto il `.min(15)` della validazione). È la prova che la geometria
ARTECH non va riusata, va sostituita dallo schema.

## 5. Modello di input — la decisione architetturale

### Il problema vero, trovato verificando il router

`kit.create` fa `const { notes, ...specs } = input` e riversa **ogni** campo nella riga
(`kit.ts:20-29`). Poi `kit.generate` **rilegge la riga e ricostruisce l'input del motore dalle
colonne persistite** (`kit.ts:53-69`, che elenca `airGapMm: request.airGapMm` e i suoi tre
fratelli).

**Quindi la riga a DB non è un registro di audit: è l'input di ogni rigenerazione.** Rendere i
4 campi solo `.optional()` non basterebbe: il `DEFAULT_FORM` del wizard (`nuova-client.tsx:19-33`)
ha `airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18` cablati e un form piatto riempie
ogni campo piatto — ogni riga BILICO nascerebbe con la geometria ARTECH addosso, **come input
vero**, non come rumore. Sarebbe la bonifica riaperta, spostata dal motore alla persistenza.

### La soluzione: unione discriminata su `series`

`kitInputSchema` diventa `z.discriminatedUnion("series", [ARTECH, TOUR])`, con entrambi i rami
costruiti estendendo un oggetto **comune** (`windowType`, `widthMm`, `heightMm`, `material`,
`finish`, `series`, `notes`).

Proprietà **verificata empiricamente** su zod 3.25.76, ed è la ragione della scelta:

```
parse({ series:"TOUR", tourSchema:2, widthMm:700, airGapMm:12 })
  →  { series:"TOUR", tourSchema:2, widthMm:700 }
```

L'unione **scarta da sola** i campi estranei al ramo, e tRPC passa all'handler l'output *parsato*.
La geometria ARTECH **non può fisicamente finire in una riga BILICO**: non è una guardia da
ricordarsi di chiamare, è un'impossibilità strutturale. È la proprietà che l'unione compra e che
il campo opzionale non può comprare.

**Costo, misurato:** `z.discriminatedUnion` **non ha `.pick()`** (verificato: `union.pick` è
`undefined`), e il wizard costruisce i suoi tre step con `kitInputSchema.pick({...})`. Ma
`union.options[i].pick()` **è una funzione** (verificato), e costruendo i rami come estensioni di
un oggetto comune ogni ramo resta uno `ZodObject`: gli step si compongono per ramo. Il costo è
reale ma circoscritto.

**Cosa NON si fa** (esplicitamente fuori scope, per non toccare l'unico pilota che funziona):
non si trasforma la geometria ARTECH in un `configId`, non si cancella `assertPilotGeometry`, non
si introducono CHECK constraint per-serie. `kit.generate` ricostruisce **per ramo**: ARTECH legge
le sue colonne esattamente come oggi → **golden byte-identico**.

### Asse 17,5 e geometria implicata: non si rappresentano

Non entrano in zod, non entrano in una colonna, non entrano in un confronto `===` (dove un float
sarebbe il prossimo bug di divergenza silenziosa). Vivono come letterali nella tabella dei 5 schemi
dentro il modulo TOUR, e **compaiono nelle descrizioni delle righe di distinta** — echeggiate
all'agente, non nascoste.

### Persistenza

Una sola colonna nuova: **`tour_schema Int?`**. Le 4 colonne geometria e `opening_side` /
`opening_direction` diventano **nullable** (il bilico non le ha). Nessuna colonna per listello,
asse, battuta, portata, lati: tutto derivato dallo schema in codice.

## 6. Regole di generazione

Input del ramo TOUR: `tourSchema` (1-5), `widthMm`, `heightMm`, `finish`, `material` (solo LEGNO),
più i comuni. **Niente mano, niente direzione di apertura.**

Derivati:
- **LBB = widthMm**, **HBB = heightMm** (offset 0). Stessa assunzione già dichiarata dal modulo
  vasistas → **domanda 10** globale, non nuova.
- **superficie** = `widthMm × heightMm / 1.000.000`; **> 2 m² → 4 lati**, **≤ 2 m² → 3 lati**.
  Il listino scrive «< 2 m²» e «> 2 m²» e lascia scoperto il caso **= 2**: si sceglie **4 lati**
  per prudenza (al confine di un componente portante l'errore prudente è quello che tiene l'anta).
  Confronto in **mm² interi** (`w*h > 2_000_000`), mai in float. → domanda AGB.
- **mano**: derivata, non scelta. 3 lati → solo SX; 4 lati → DX **e** SX. Dichiarato nelle righe.

### Distinta

| # | voce | codice | qtà 3 lati | qtà 4 lati | fonte |
|---|---|---|---|---|---|
| 1 | Kit elementi orizzontali | `T47501.00.0{GR(LBB)}` | 1 | 1 | p0547 (545) |
| 2 | Asta verticale senza braccetto | `T46000.0{1=DX,2=SX}.01` | 1 (SX) | 1 DX + 1 SX | p0548 (546) |
| 3 | Asta verticale con braccetto | `T46001.0{1,2}.0{GR(HBB)}` | 1 (SX) | 1 DX + 1 SX | p0548 (546) |
| 4 | Kit movimenti angolari | `T4810{0,1,2}.{03,04}.00` | 1 | 1 | p0549 (547) |
| 5 | Kit cerniere | `T17800.{30,35,40}.{34,94}` | 1 | 1 | p0549 (547) |
| 6 | Kit incontri | `T4770{1,2}.0{schema}.00` | 1 | 1 | p0552 (550) |
| 7 | Kit spessori — **solo schema 3** | `T16635.04.01` | 1 | 1 | p0549 (547) |
| 8 | Guarnizione | per schema (§4) | 12 | 12 | p0550-0551 |

**Bande.** Kit elementi orizzontali per LBB: 530-650 / 640-800 / 801-1200 / 1201-1600 / 1601-2000
/ 2001-2400 — con **sovrapposizione 640-650** risolta dallo span più stretto, cioè da `pick()`
già esistente. Asta con braccetto per HBB: 580-1000 / 1001-1400 / 1401-1800 / 1801-2400. Kit
movimenti angolari per HBB: 600-800 / 801-1000 / ≥1001.

**Finiture: solo due.** Cromato opaco → `.34`, Marrone RAL 8019 → `.94`. Qualunque altra →
rifiuto esplicito (stesso schema di `requireKey`, che già solleva per le coperture ARTECH).

**Guardia di portata.** Kit cerniere Tour 30/35 = **200 kg**, Tour 40 = **300 kg** (NB «per schema
5»). Se `sashWeightKg` è valorizzato e supera la portata dello schema scelto → rifiuto. Riusa il
campo opzionale già esistente, come la portata forbici della vasistas.

**Guardie di campo.** HBB < 600 rifiutato salvo schema 1 (che scende a **580**, da
`p0549 (547)`: «HBB minimo 580 per SCHEMA 1 e PREFINITO»); LBB fuori 530-2400 e HBB oltre 2400
rifiutati; materiale ≠ LEGNO rifiutato.

## 7. Test

- **Golden** per i due rami principali (3 lati e 4 lati) con codici e quantità attesi.
- Una banda per ogni tabella, **estremi inclusi**, e i punti di sovrapposizione (LBB 640-650).
- Ogni rifiuto: materiale, finitura, portata, fuori banda, superficie al confine.
- **Test di mutazione** (l'idea migliore uscita dal council, adottata a prescindere
  dall'opzione): per ogni modulo attivo e ogni campo del suo input, muta il campo — il modulo
  deve **cambiare output o sollevare**. Output identico in silenzio = test fallito. È la classe di
  bug della bonifica catturata **strutturalmente**, non a memoria.
- Integration gated (`INTEGRATION_DATABASE_URL`): ogni codice emettibile risolve a una riga di
  catalogo **con prezzo**.

## 8. Assunzioni dichiarate e domande per AGB

Vanno in `docs/superpowers/kit-assunzioni/tour.md`, con numerazione **globale** (continua dalla 10).

| # | Domanda | Effetto se sbagliata |
|---|---|---|
| 11 | `T46000` senza braccetto esiste solo in GR1 (HBB 580-1000) ma la legenda ne scrive il suffisso **letterale `.01`** mentre per l'asta con braccetto scrive `0X`: vale per ogni HBB? | Si adotta la lettura «vale sempre», perché l'altra renderebbe inservibili `T48102` (HBB ≥1001) e `T46001` GR2-4 (fino a 2400) — contraddizione interna. Se sbagliata: asta errata sopra HBB 1000 |
| 12 | Superficie **esattamente 2 m²**: 3 o 4 lati? | Differenza reale: incontri 68,70 vs 43,95 €, movimenti 104,36 vs 66,42 € |
| 13 | La guarnizione fa parte della distinta ferramenta? Quantità = confezione base 12 anche per il «12+12 m» dello schema 1? | Voce di peso: ~24% del totale |
| 14 | Quantità del kit spessori `T16635.04.01` sullo schema 3: 1 kit o 1 per cerniera? | ±5,46 € |
| 15 | LBB **640-650**: GR1 o GR2? | 3,73 € e un elemento orizzontale di lunghezza diversa |

## 9. Fuori scope, annotato

- Fix `dedupeRows` last-wins in `map-product.ts` (opzione F). Tocca anche il bilico:
  `T18001.02.93` compare su `p0551` e `p0561` (bilico tondo) e il DB tiene la seconda → il viewer
  aprirebbe la pagina sbagliata. **Prezzo identico, totale non affetto.**
- Gate CI «ogni codice emettibile è prezzato», con `isActive` **derivato** da quel gate invece che
  dichiarato nel seed.
- Stampa dello **schema di montaggio** nel wizard invece del solo numero 1-5 (il rischio residuo
  dominante: uno schema scelto male dà una distinta completa, plausibile e sbagliata). La
  ferramenta esiste già — viewer del listino a pagina singola + estrazione immagini.
- Stamp dell'edizione di catalogo accanto a `engineVersion` in `generatedKit`.
