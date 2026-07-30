> 📋 Le domande 1-10 citate qui sono raccolte, con priorità e testi pronti da inviare, in
> [`DOMANDE-APERTE.md`](./DOMANDE-APERTE.md). **La numerazione è la stessa**: i commenti nel
> codice rimandano per numero.

# Anta-ribalta ARTECH LEGNO — esito della verifica e domande residue

> **Stato: ATTIVO.** È il pilota del kit engine: modulo `src/server/kit/rules-artech-legno.ts`
> (engine `artech-ar-legno`) + meccanica condivisa `artech-legno-shared.ts`.
> Golden = **distinta reale AGB del 16/11/2021** riportata su ARTECH LEGNO, riverificata
> riga per riga contro il **listino AGB 2026** il 2026-07-25.
> Distinta: **12 righe / 17 pezzi** senza chiusure supplementari, **16 righe / 21 pezzi /
> 90,20 €** con (la distinta storica).

**Pagine.** Si cita sempre la **pagina fisica del PDF con la stampata fra parentesi**
(fisica = stampata + 2), es. `p0451 (449)`. `Product.listinoPage` a DB è la fisica.

---

## Numerazione delle domande — leggere prima

Le domande per l'esperto AGB hanno una **numerazione GLOBALE**, unica per tutte le schede
di `kit-assunzioni/`: i commenti nel codice rimandano **per numero** («domanda 2 per
l'esperto in …/legno.md»), quindi il numero deve identificare la domanda ovunque, non la
sua posizione dentro una scheda.

| # | Domanda | Scheda | Sblocca |
|---|---|---|---|
| 1 | Battente: quale terna di cerniere nello schema p0416 (414)? | `battente.md` | riattivazione della tipologia |
| 2 | Squadra angolare: quale delle **quattro** varianti a listino? | qui | codice già scritto (`PER_MANO`) |
| 3 | Incontri: quantità (formula vs somma colonna NOT.) e formato (asse 9 vs 13) | qui | quantità e codice degli incontri |
| 4 | Sede 30 (schemi 2026) vs sede 18 (distinta 2021) | qui | campo di applicazione del generatore |
| 5 | Vasistas: variante base o alternativa per le tre cerniere? Servono entrambi i terminali? | `vasistas.md` | codice già scritto |
| 6 | Il «listino PVC e ALLUMINIO» citato a p0849 (847) | `pvc.md` (e `alu.md`) | PVC **e** alluminio insieme |
| 7 | Anta-ribalta: l'intervallo **HBB 357-609** resta scoperto | qui | finestre basse |
| 8 | Vasistas: voce 7, terminali delle chiusure supplementari sui montanti | `vasistas.md` | 13ª voce dello schema |
| 9 | Vasistas: GR00 (HBB 274-662) | `vasistas.md` | finestre piccole |
| 10 | Offset altezza → HBB: −10 (anta-ribalta) o 0 (vasistas)? | qui | scelta del cremonese in entrambi i moduli |

⚠️ `alu.md` conserva una propria lista numerata 1-13 della Fase 1g: quella è **locale a
quella scheda** e non va confusa con questa. Nella numerazione globale l'alluminio è
interamente dentro la **domanda 6**.

---

## Cosa è stato corretto il 2026-07-25 (tutto con evidenza diretta a listino)

| Rilievo | Evidenza | Correzione |
|---|---|---|
| Il modulo montava `A50801.01.01/.02`, che è la variante **«Supporto cerniera Aria 4 - Interasse 9»**, **battuta 18** — su un serramento aria 12 / interasse 13 / battuta 20 | p0451 (449): sotto «Supporto cerniera **Aria 12 - Interasse 9/13** - Parte telaio» la riga battuta 20 è `A50805.05.DX` / `.SX`, **4,44 €** — stesso prezzo. Conferma indipendente: il certificato ift riga «ARTech **Legno**» (p0395 (393) / p0013 (11)) prescrive la quaterna `A51911.36.04 · A50702.05.00 · A50904.36.01 · A50805.05 DX` | `PER_MANO.supportoCerniera` = `A50805.05.DX` / `.SX` |
| `CREMONESI[0].minH` era 650 | p0424 (422), «Cremonesi · Anta ribalta - altezza maniglia fissa», entrata 15: la banda GR02 parte da **610** → le altezze 620-659 venivano **rifiutate a torto** come fuori campo | banda GR02 = 610-810 |
| La `ruleDescription` dell'incontro ribalta diceva «13x24 viti dritte», ma il codice emesso `A51400.05.70` è **9x18** (il 13x24 è `A51400.CR.70`, stesso prezzo) | p0471 (469) | descrizione allineata al codice |
| `airGapMm` / `axisOffsetMm` / `rebateMm` / `seatMm` erano raccolti dal wizard, validati… e **ignorati**: tutte le tabelle sono cablate sulla geometria del pilota. Un agente poteva chiedere aria 4 e ricevere in silenzio i codici dell'aria 12 | — | `PILOT_GEOMETRY` + `assertPilotGeometry()` in `artech-legno-shared.ts`: i moduli ARTECH attivi **rifiutano** e dicono quale combinazione è coperta |

### Effetto collaterale: il parser del catalogo

`A50805.05.DX/.SX` ha **segmenti alfanumerici**, e il parser del listino accettava solo
`[A-Z]\d{5}\.\d{2}\.\d{2}`: **scartava in silenzio 1.297 codici a prezzo** (6.191 → 7.488),
fra cui proprio il supporto cerniera del kit, i suffissi di mano/finitura/variante
(`.DX/.SX/.FM/.CR/.DC/.XX`) e i cilindri (`CG0016.24.24`). Allargato in
`src/server/catalog/parse-listino.ts` (e negli altri due punti che avevano la stessa
regexp: `listino-images.ts`, route `/api/product-image`).

> **⚠️ AZIONE OPS OBBLIGATORIA: re-import del catalogo su Neon** («Ops — Neon»:
> `migrate deploy` + `import:agb` + `db:seed:kit` + `embed:products`). Finché il DB non è
> re-importato, `A50805.05.DX/.SX` **non esiste a catalogo**: la riga del supporto cerniera
> esce **senza prezzo** (con warning) e il totale del golden scende da **90,20 €** a
> **85,76 €** (−4,44 €).

---

## Cosa NON è stato toccato, e perché

Due rilievi avevano una fonte autorevole **a favore dello stato attuale**: cambiarli
sarebbe stato sostituire un'assunzione con un'altra. Sono le domande 2 e 3.

---

## Domanda 2 — squadra angolare: quale delle quattro varianti?

Il modulo usa `A50904.36.01` (dx) / `.02` (sx). Per la geometria del pilota
(**interasse 13 · aria 12 · battuta 20**) il listino 2026 offre **quattro** varianti, tutte
con la stessa coppia di mano `.01`/`.02`:

| Codice | Denominazione a listino | € | Pagina |
|---|---|---|---|
| `A50902.36.01/.02` | «Squadra angolare - Interasse 13» (base) | **5,77** | p0451 (449) |
| `A50903.36.01/.02` | «Squadra angolare **per traverso in alluminio** - Interasse 13» | 7,54 | p0452 (450) |
| `A50901.36.01/.02` | «Squadra angolare **con compensatore 16/12** - Interasse 13» | 8,05 | p0452 (450) |
| `A50904.36.01/.02` | «Squadra angolare **per traverso in alluminio con compensatore 16/12**» — **in uso** | 9,83 | p0452 (450) |

- Le **legende degli schemi di montaggio** chiedono genericamente «Squadra angolare con
  compensatore» → suggerirebbero `A50901.36`.
- Il **certificato ift** riga «ARTech Legno» prescrive invece **`A50904.36.01`**.
- La variante **base `A50902.36`** (la più economica, 5,77 €) è quella che il nome
  descrive senza aggiunte: su una finestra tutto-legno, senza traverso in alluminio,
  potrebbe essere la corretta.

**Domanda:** per una finestra **tutto-legno** aria 12 / interasse 13 / battuta 20, quale
delle quattro va montata? Fra la più economica e quella in uso ballano **4,06 € a pezzo**.

*(Fino alla risposta si conserva `A50904.36`: è l'unica prescritta da un documento
tecnico intestato «ARTech Legno».)*

---

## Domanda 3 — incontri: quantità e formato

**(a) Quantità.** Il modulo usa la formula `2 + ⌊H/600⌋ + ⌊L/600⌋` (ASSUNZIONE della Fase
1d, tarata sul golden: 5 incontri a 1820×550). L'alternativa «somma della colonna **NOT.**
dei componenti selezionati» è stata verificata e dà **4**: cremonese GR07 = 2, movimenti
angolari 1×2, **fusto forbice GR02 = «-»** (p0438 (436)). L'unica distinta reale in nostro
possesso (2021) dice **5**. Il `«-»` è un valore *stampato* (GR01/02/03 = «-», GR04/05 = 1),
non un dato mancante: la regola apparentemente più rigorosa contraddice l'unico dato reale,
quindi la formula **resta**.

Da notare: il modulo **vasistas** usa invece la colonna NOT. del suo cremonese. Due
tipologie, due regole diverse — una delle due è sbagliata.

**(b) Formato — e qui c'è una CONTRADDIZIONE DIMOSTRABILE, non più solo un dubbio.**

Il kit emette `A51400.05.70` («Incontri Ribalta · Aria 12 · ZAMA · **9x18** viti dritte»,
p0471 (469)) e `A51400.05.02` per i nottolini: tutta la famiglia `.05`, cioè **asse 9**.
Ma il wizard fa dichiarare all'agente **interasse 13**, e bracci, squadre e cerniere sono
effettivamente interasse 13.

Il numero dopo la `x` nella colonna **ASSE** delle tabelle incontri **è la sede**: il listino
scrive `9x18`, `13x24`, `13x30` come token unico, mentre chiama lo stesso numero «sede telaio»
nei titoli degli schemi e nella tabella microventilazione (p0474 (472)) e «SEDE TELAIO» nel
Galileo Pro alluminio (p0877 (875)). Sono due nomi per la stessa quota.

**Estraendo tutti i formati dalle 959 pagine esistono solo questi quattro:**

| formato | occorrenze |
|---|---|
| `13x24` | 19 |
| `9x18` | 15 |
| `13x30` | 10 |
| `9x20` | 4 |

**`13x18` non esiste.** Zero occorrenze. Quindi la coppia dichiarata dal pilota
(**interasse 13 + sede 18**) non è una configurazione del listino 2026: o l'interasse vero è
**9** (e i codici emessi sono giusti), oppure la sede vera è **24 o 30** (e i codici emessi
sono sbagliati). Una delle due etichette è errata dalla Fase 1d. Non cambia i codici né il
totale di 90,20 €, ma è un dato falso scritto sulla richiesta.

**Domanda:** come si determina il numero di incontri nottolino? E soprattutto: la distinta
reale del 16/11/2021, che dichiara interasse 13 e monta incontri `9x18`, ha l'interasse
sbagliato o gli incontri sbagliati?

---

## Domanda 4 — sede 30 vs sede 18

Il generatore copre **solo** la geometria del pilota: aria 12 / interasse 13 / battuta 20 /
**sede 18**, che viene dalla distinta reale 2021. **Tutti** gli schemi di montaggio base
ARTECH del listino 2026 sono però intitolati «**sede 30 mm**» e chiedono incontri «Sede 30»
/ «Battuta 30»: per la sede 18 **non esiste alcuno schema stampato** nel volume 2026.

Rilievo aggiunto il 2026-07-27: la NB «*per tipologia di serramento con sede incontri da
30 mm riferirsi agli schemi "sede 30 mm"*» compare su **22 pagine** (fisiche 409-421 in ARTECH,
513-519 in ARTECH PLANA). È AGB stessa a trattare la **sede come discriminante fra famiglie di
schemi**, non come un dettaglio d'ordine. E per la sede 18 nel volume 2026 non esiste alcuna
pagina-schema.

**Domanda:** la sede 18 è ancora una configurazione ordinabile, o il 2026 l'ha sostituita
con la sede 30? Se è sostituita, il pilota va rifatto sulla sede 30 (e con esso il golden).

---

## Domanda 7 — l'intervallo HBB 357-609 resta scoperto

La tabella `CREMONESI` copre HBB 610-2510 (9 bande, entrata 15 di p0424 (422)). Sono
**escluse di proposito**:

- `A50122.15.17` («07bis», HBB 1634-1810 ma **altezza maniglia 1050** anziché 500: si
  sovrappone in modo ambiguo alla `.07`);
- `A50122.15.31` / `.41` (p0425 (423), GR1: si selezionano per HBB **e** per LBB, schema
  di tabella diverso) — e sono proprio queste a coprire le finestre basse.

Conseguenza: una finestra con HBB fra 357 e 609 viene **rifiutata** come fuori campo pur
essendo a listino.

**Domanda:** per le finestre basse si usa la famiglia `.31/.41`? Con quale regola di
selezione combinata HBB × LBB? E la `.17` quando si usa?

---

## Domanda 10 — offset altezza → HBB

Il cremonese si sceglie sull'**altezza maniglia/battuta (HBB)**, che il wizard non chiede:
si deriva dall'altezza dell'anta. I due moduli attivi assumono cose diverse —
**anta-ribalta: HBB = altezza − 10** (ASSUNZIONE dell'emendamento Fase 1d, riproduce il
golden: 1820 − 10 = 1810 → `.07`); **vasistas: HBB = altezza** (offset 0).

**Domanda:** qual è la relazione corretta fra la quota che l'agente misura e l'HBB delle
tabelle? Vale la stessa per tutte le tipologie?

---

## Assunzioni dichiarate residue (non bloccanti, nessuna domanda numerata)

- **Estremi delle bande inclusivi** su tutte le tabelle; i bordi sovrapposti si risolvono
  con lo span più stretto (`pick()`).
- **Coperture solo ARGENTO** (`COPERTURE_KIT`): le altre finiture non sono state
  trascritte, e il wizard offre solo ARGENTO.
- **Chiusure supplementari** (`CHIUSURE_VERTICALI`): una sola banda, **H 1520-2120**,
  ricavata dalla distinta 2021; fuori banda il modulo rifiuta con `artech.verticali`.
- **`A50904.36.02` (sx)** non compare nel certificato ift (che elenca solo la mano dx):
  è la mano speculare presa dalla stessa tabella di listino.
