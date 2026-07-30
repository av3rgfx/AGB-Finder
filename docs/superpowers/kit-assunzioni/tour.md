> 📋 Le domande 11-16 citate qui sono raccolte, con priorità e testi pronti da inviare, in
> [`DOMANDE-APERTE.md`](./DOMANDE-APERTE.md). **La numerazione è la stessa**: i commenti nel
> codice rimandano per numero.

# Bilico rettangolare TOUR (legno) — esito della verifica e domande residue

> **Stato: ATTIVO.** Modulo `src/server/kit/rules-tour-bilico-legno.ts`
> (engine `tour-bilico-legno`). Prima serie **non-ARTECH** del kit engine.
> Fonte: listino AGB 2026, sezione BILICI, pagine **fisiche 532-553**.
> Golden: **7 righe** (3 lati) e **9 righe** (4 lati).

**Pagine.** Si cita sempre la **pagina fisica del PDF con la stampata fra parentesi**
(fisica = stampata + 2), es. `p0536 (534)`. `Product.listinoPage` a DB è la fisica.

---

## Perché questa tipologia è attiva e il PVC no

| | PVC ARTECH (spento) | Bilico TOUR (attivo) |
|---|---|---|
| Codici a listino **con prezzo** | 4 su 12 righe senza prezzo; 7 codici inesistenti, dedotti per simmetria | **61 su 61 verificati con prezzo** |
| Origine della distinta | ricostruita da certificati ift | **raggruppamento pubblicato da AGB** (legende «Componenti») |
| Verifica indipendente | nessuna | aritmetica: kit incontri 43,95 € vs contenuto 44,12 € |

La verifica dei 61 codici è stata fatta applicando all'intero PDF la **firma di riga del
parser reale** (`CODICE conf conf prezzo classe`), non un grep: gli stessi criteri con cui
l'import popola il catalogo. Il totale dei codici prezzati nel listino è **7.488**, identico
al conteggio dell'import su Neon → i codici TOUR **sono già a catalogo**, senza re-import.

## La struttura: 4 kit + 2 aste

Le legende «Componenti» di `p0536 (534)` (4 lati) e `p0537 (535)` (3 lati) raggruppano tutto
in **quattro kit ordinabili**: A elementi orizzontali (che contiene anche **la cremonese**),
B movimenti angolari, C cerniere, D incontri. Più le due aste verticali sciolte.

**Quelle legende stanno dentro il disegno**: nel testo estratto con `pdftotext` non compaiono.
Vanno lette renderizzando la pagina. È la ragione per cui la sezione sembrava, da grep, molto
più complicata di com'è.

La tabella di `p0538 (536)` è la **composizione** dei kit, non una lista d'ordine:

| kit | prezzo | somma del contenuto dichiarato | scarto |
|---|---|---|---|
| `T47701.01.00` (3 lati) | 43,95 € | 3+3 nottolini (4,82) + 1 limitatore (15,20) = 44,12 € | 0,17 € |
| `T47702.01.00` (4 lati) | 68,70 € | 4+4 nottolini + 2 limitatori = 68,96 € | 0,26 € |

## Cosa NON è un input

- **Mano e direzione di apertura.** Sui 3 lati il listino pubblica la sola configurazione SX;
  sui 4 lati la legenda elenca *entrambe* le mani (`T46000.01.01 DX` **e** `.02.01 SX`,
  `T46001.01.0X DX` **e** `.02.0X SX`) e si ordinano tutte e due. Non c'è nulla da scegliere.
- **Ferramenta su 3 o 4 lati.** Derivata dalla superficie, non scelta. Il wizard la mostra
  già al passo delle quote, perché cambia quattro codici e ~60 € di distinta.
- **Listello, asse, battuta, modello di cerniera, guarnizione.** Tutti implicati dallo
  **schema 1-5**, che è l'unica chiave. Non sono persistiti: sarebbero una seconda fonte di
  verità (la malattia curata dalla bonifica). Vengono **echeggiati** nelle righe di distinta,
  nel riepilogo del wizard e nella scheda dettaglio.

---

## Domande per l'esperto AGB — numerazione GLOBALE, continua da `legno.md`

| # | Domanda | Cosa cambia |
|---|---|---|
| 11 | Asta verticale **senza** braccetto | codice sbagliato sopra HBB 1000 |
| 12 | Superficie **esattamente** 2 m² | ~60 € e 4 codici |
| 13 | La guarnizione fa parte della distinta? | ~24% del totale |
| 14 | Quantità del kit spessori sullo schema 3 | 5,46 € |
| 15 | Sovrapposizione LBB 640-650 | 3,73 € e un elemento di lunghezza diversa |
| 16 | `openingDir` non è letto da nessun modulo | rilievo interno, non una domanda per AGB |

### Domanda 11 — asta verticale senza braccetto: vale per ogni altezza?

`T46000.01.01` (DX) / `T46000.02.01` (SX), p0548 (546), esiste **solo in GR1**, banda
HBB 580-1000, L 770. Ma le legende degli schemi generici ne scrivono il suffisso
**letterale `.01`**, mentre per l'asta *con* braccetto scrivono `0X` (variabile).

**Assunzione adottata: il codice vale per ogni HBB.** La lettura opposta — valido solo fino a
HBB 1000 — renderebbe inservibili sia `T48102` (kit movimenti angolari HBB ≥ 1001) sia
`T46001` GR2-4 (fino a HBB 2400): si contraddirebbe da sola. La lettura adottata non ha
contraddizioni interne, ma resta un'inferenza.

**Domanda:** su un bilico alto 1600 mm, l'asta senza braccetto è `T46000.02.01`?

### Domanda 12 — superficie esattamente 2 m²

`p0536 (534)` dice «SUPERFICIE **> 2 m²**» (4 lati), `p0537 (535)` «SUPERFICIE **< 2 m²**»
(3 lati). Il caso **= 2 m²** non è coperto da nessuno dei due, ed è una misura plausibile
(2000 × 1000).

**Assunzione adottata: 4 lati**, per prudenza — al confine di un componente portante
l'errore prudente è quello che tiene l'anta. Il confronto è in **mm² interi**
(`larghezza × altezza >= 2_000_000`), mai in virgola mobile.

**Domanda:** a 2,00 m² esatti si monta la ferramenta sui 3 o sui 4 lati?

### Domanda 13 — la guarnizione fa parte della distinta?

La guarnizione **non compare** nella legenda «Componenti» di nessuno dei due schemi generici
(lì ci sono solo i 4 kit e le 2 aste). Compare però su ogni pagina-schema come profilo di
tenuta necessario, prezzata **al metro**, con confezione 12.

**Assunzione adottata:** riga in distinta con **quantità 12** (la confezione base), descrizione
che la marca come consumabile a metro. Nota irrisolta: lo schema 1 dichiara «12+**12** m» pur
avendo confezione 12 — non è chiaro se una confezione contenga 12 o 24 metri di profilo.

**Domanda:** la guarnizione va nella distinta ferramenta? E la confezione dello schema 1 quanti
metri contiene?

### Domanda 14 — quantità del kit spessori (schema 3)

`T16635.04.01`, «Kit spessori per cerniera Tour 35 schema 3», 4 mm, battuta 15, confezione 1/10.
Lo schema 3 è battuta 15 → serve sempre. Ma le cerniere sono **due**.

**Assunzione adottata: quantità 1** (è un *kit*, confezione base 1).

**Domanda:** un kit copre entrambe le cerniere o ne serve uno per cerniera?

### Domanda 15 — sovrapposizione LBB 640-650

Kit elementi orizzontali, p0547 (545): GR1 = **530-650**, GR2 = **640-800**. Le due bande si
sovrappongono fra 640 e 650.

**Assunzione adottata:** vince lo **span più stretto** (GR1, span 120 contro 160) — la regola
già usata da `pick()` su tutte le tabelle ARTECH.

**Domanda:** per LBB 645 si ordina `T47501.00.01` o `T47501.00.02`?

### Domanda 16 — rilievo interno: `openingDir` non è letto da nessuno

Non è una domanda per AGB ma un difetto nostro, trovato scrivendo il test di mutazione
(`no-silent-fields.test.ts`). **`openingDir` (Tirare/Spingere) è raccolto dal wizard, validato
da zod e persistito, e NESSUN modulo regole lo legge.** È la stessa classe di bug della bonifica
2026-07-25 («campi raccolti, validati e ignorati»): è sopravvissuta perché la guardia
`assertPilotGeometry` copriva i soli quattro campi geometria.

Oggi è **dichiarato inerte** nel test, con la ragione. Va risolto togliendolo dall'input
oppure usandolo — ma è una decisione sul ramo ARTECH, fuori dallo scope del bilico.

---

## Assunzioni dichiarate residue (non bloccanti)

- **LBB = larghezza, HBB = altezza**, offset 0. Stessa assunzione del modulo vasistas →
  è la **domanda 10** globale, non una nuova.
- **Estremi delle bande inclusivi** su tutte le tabelle.
- **HBB minimo 600**, con **580** riservato allo schema 1 (`p0549 (547)`: «HBB minimo 580 per
  SCHEMA 1 e PREFINITO»). La nota «per HBB < 800 consultare schemi di montaggio» è un
  avvertimento, non un divieto: il generatore non blocca.
- **Portata**: Tour 30/35 = 200 kg, Tour 40 = 300 kg (NB «per schema 5»). Verificata solo se
  l'agente indica il peso dell'anta, che è facoltativo.

## Fuori dal campo di applicazione, e perché

| Escluso | Ragione |
|---|---|
| **Bilico tondo TOUR-R** (p0554-0562) | prodotto diverso, serie diversa |
| **Prefinito** (p0540 (538)) | guarnizione propria 6+6 m e NB «la guarnizione sopra le cerniere è differente da quella sotto», non risolvibile dal listino |
| **Prefinito 300 kg complanare** (p0545-0546) | **pagine di sola immagine: zero testo, zero codici**. Non trascrivibili. Sono per due serramentisti OEM (TWT, Vivaldi-Fantacci) |
| **Dime** (`T18501.35.00` 334,28 € · `T18502.40.00` 547,31 € · `T18504.01.0N` · `T18506.00.35/.45`) | attrezzatura di bottega: si ordina una volta, non per serramento |
| **Prolunga** (`A40020.00.0N`) e **chiavetta limitatore** (`T46901.00.00`) | non compaiono nella legenda «Componenti» → accessori |
