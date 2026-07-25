# Bonifica dei moduli kit ARTECH LEGNO — design

> Sessione 2026-07-25. Branch `claude/kit-engine-study-wfo2hq`.
> Precede ogni nuova tipologia: i difetti stanno in codice **condiviso**, quindi
> ogni modulo nuovo li moltiplicherebbe.

## Perché

Studio di tutti i moduli kit contro il **listino AGB 2026** (959 pagine, PDF
fornito dall'utente e riletto pagina per pagina, schemi di montaggio inclusi).
Risultato: dei 4 template attivi in produzione, **3 producono distinte che il
cliente non può ordinare**.

Non è un problema di stile: una distinta incompleta fa perdere l'ordine e
riporta l'agente al giro di email che il motore doveva eliminare; una distinta
completa ma sbagliata fa montare la ferramenta sbagliata.

### Nota di metodo: la numerazione delle pagine

**Pagina fisica del PDF = pagina stampata + 2** (verificato su 10+ campioni
indipendenti: p0013→«11», p0395→«393», p0424→«422», p0426→«424», p0451→«449»).
`Product.listinoPage` a DB è la pagina **fisica**. In questo documento e nei
commenti del codice si usa **sempre la fisica**, con la stampata fra parentesi.

⚠️ Trappola già caduta una volta: il commento di `rules-artech-vasistas-legno.ts`
cita «pag. 416» intendendo la stampata, cioè la **fisica 418**; ma la fisica 416
è lo schema del **battente**. Due tipologie diverse a due pagine di distanza.

## Fatti verificati

### Anta-ribalta LEGNO (pilota, golden da distinta reale AGB 2021)

| # | Rilievo | Evidenza | Esito |
|---|---|---|---|
| 1 | Monta `A50801.01.01/.02`, che è **«Supporto cerniera Aria 4 - Interasse 9»**, battuta 18 — su un serramento aria 12 / interasse 13 / battuta 20 | p0451 (449): sotto «Supporto cerniera **Aria 12 - Interasse 9/13** - Parte telaio» la riga battuta 20 è `A50805.05.DX/.SX`, 4,44 € — **stesso prezzo**. Il certificato ift riga «ARTech **Legno**» (p0395/p0013) prescrive la quaterna `A51911.36.04 · A50702.05.00 · A50904.36.01 · A50805.05 DX` | **CORREGGERE** |
| 2 | `CREMONESI[0].minH = 650` | p0424 (422): la banda GR02 è **610**-810 → oggi le altezze 620-659 sono rifiutate come «fuori campo» pur essendo a listino | **CORREGGERE** |
| 3 | `ruleDescription` dell'incontro ribalta dice «13x24 viti dritte», il codice emesso `A51400.05.70` è **9x18** | p0471 (469) | **CORREGGERE la descrizione** |
| 4 | Squadra `A50904.36.NN` = «per traverso in alluminio con compensatore 16/12», 9,83 € | p0452 (450) offre tre varianti per interasse 13 / aria 12 / battuta 20: `A50903.36` (per traverso in alluminio, 7,54 €), `A50901.36` (con compensatore, 8,05 €), `A50904.36` (entrambe, 9,83 €). Le legende degli schemi dicono «Squadra angolare **con compensatore**» → suggerirebbero `A50901.36`. **Ma il certificato ift «ARTech Legno» prescrive `A50904.36.01`** | **NON TOCCARE** → domanda per l'esperto |
| 5 | Quantità incontri nottolino da formula `2 + ⌊H/600⌋ + ⌊L/600⌋` | Alternativa «somma della colonna NOT. dei componenti» verificata: dà **4** (cremonese GR07 = 2, movimenti angolari 1×2, **fusto forbice GR02 = «-»**, p0438). La distinta reale 2021 dice **5**. La regola apparentemente più rigorosa contraddice l'unico dato reale; il `«-»` è un valore stampato (GR01/02/03 = «-», GR04/05 = 1), non un dato mancante | **NON TOCCARE** → domanda per l'esperto |

### Battente LEGNO (PROVVISORIO, attivo)

Lo schema di montaggio **p0416 (414)** «Finestra rettangolare legno - anta
singola, apertura a battente» ha **21 voci**; il modulo ne genera **5**. Mancano
in particolare le voci 5, 6, 8, 9 — corpo articolazione superiore, articolazione
superiore anta semifissa, supporti forbice e perno: **l'anta non ha alcun punto
di sospensione in alto**. Distinta non montabile.

Lo schema però è **composito**: nello stesso disegno convivono la cremonese a
battente (mod. 502, voce 1), voci dell'anta-ribalta (voce 2 cremonese anta
ribalta, voce 3 DSS, voce 13 incontro ribalta) e **tre alternative di cerniera**
(voci 5-6 «per seconda anta», 15-16 «centrali a scomparsa», 17 «centrale
registrabile portante»). Dal solo listino **non è decidibile** quale terna
appartenga alla configurazione «anta singola a battente».

Ciò che invece è verificato e va conservato: le 10 bande della cremonese
`A50200.15.01→.10` coincidono **esattamente** con p0429 (427), e la famiglia è
confermata dalla legenda dello schema («Anta a bandiera - mod. 502»).

### Vasistas LEGNO (PROVVISORIO, attivo)

Lo schema **p0418 (416)** è invece esplicito: **13 voci**, nessuna ambiguità.

| Rilievo | Evidenza |
|---|---|
| Genera 2 righe che lo schema **non prevede**: DSS `A50190.00.00` + incontro DSS `A51400.05.03` | Le legende dei 4 schemi vasistas (p0418-0421) non contengono né DSS né incontri DSS; li contengono invece lo schema anta-ribalta (p0406, voci 2 e 15) e quello del battente (p0416, voci 3 e 11). L'NB della tabella cremonesi p0424 conferma: «DSS sempre presente su tutti i GR» è scritto per l'**anta ribalta**. Il DSS era stato preso da una NB della famiglia cremonese *condivisa* «Anta ribalta/vasistas» |
| **Non genera alcuna cerniera** (voci 10, 11, 12) | Senza di esse l'anta non è appesa |
| Sceglie il numero di forbici per altezza/GR | p0418 pubblica la tabella **«Posizionamento forbici» indicizzata su LBB** (larghezza) |
| Manca il terminale corsa 18+18 (voce 4) e i terminali sui montanti (voce 7) | Nel disegno la voce 4 sta all'estremità opposta del traverso rispetto alla 3 |
| Supporto forbice e perno legati al numero di **forbici** | Nel disegno stanno sotto le **cerniere portanti** (2, +1 centrale) |
| Guardia «≤ 2 m²» | **CONFERMATA**, stampata sullo schema |

### PVC (PROVVISORIO, attivo)

I 4 codici che rendono «PVC» la distinta — `A51921.36.04`, `A50712.00.00`,
`A50922.07.00`, `A50812.07.00` — compaiono **solo** nelle due pagine-certificato
ift (p0013 e p0395), senza prezzo e senza scheda: grep esaustivo su tutte le 960
pagine. Altri 7 codici generati dal motore (l'intera famiglia braccio SX
`A51922.36.0N`, più `A51921.36.01/.02/.03`) **non esistono nemmeno nel
certificato**: sono prodotti per simmetria dal codice. Il test golden asserisce
`A51922.36.02`, che non esiste in nessuna pagina del listino.

Effetto in produzione: ogni kit PVC esce con **4 righe su 12 senza prezzo** e un
totale **sistematicamente sottostimato**, senza che nulla lo dichiari.

Il listino dice dove sta davvero il PVC: p0849 (847) rimanda tre volte al
**«listino PVC e ALLUMINIO»**, sezione FERRAMENTA PER FINESTRE ARTECH. Documento
separato, non in nostro possesso (l'utente lo procurerà).

### Parametri di input che non pilotano nulla

`airGapMm` (4-20), `axisOffsetMm` (9-20), `rebateMm` (15-30), `seatMm` (12-22)
sono raccolti dal wizard e validati, ma **nessuno di essi seleziona un codice**:
tutte le tabelle sono cablate sulla combinazione del pilota — aria 12, interasse
13, battuta 20, sede 18. Un agente può inserire aria 4 / battuta 30 e ricevere in
silenzio i codici dell'aria 12. È la classe di errore più insidiosa: la distinta
sembra perfetta ed è di un'altra configurazione.

Aggravante documentale: **tutti** gli schemi base ARTECH sono intitolati «sede
30 mm» e chiedono incontri «Aria 12 - Battuta 30» / «Sede 30»; per la sede 18
del pilota (che viene dalla distinta reale 2021) **non esiste alcuno schema
stampato** nel listino 2026.

## Decisioni

Prese con `/llm-council` (5 advisor + peer review + chairman) e con l'utente.

| # | Decisione | Motivo |
|---|---|---|
| D1 | **PVC → `isActive:false`** + modulo che rifiuta, sul modello di `rules-artech-alu.ts` | Non è «provvisorio da validare»: è costruito su una fonte che non è un catalogo di vendita. Coerenza col principio già applicato all'alluminio |
| D2 | **Battente → `isActive:false`** + rifiuto che **nomina il dato mancante** | Un warning in calce alla distinta muore appena l'agente incolla i codici in una mail. Si riattiva con un cambio di una riga quando AGB risponde |
| D3 | **Vasistas → riscritto come trascrizione dello schema p0418** | Lo schema è esplicito: non si sostituiscono assunzioni nuove alle vecchie, si cancellano dati fabbricati e si trascrive ciò che è stampato |
| D4 | **Pilota → solo le correzioni provate** (supporto cerniera, banda 610, descrizione incontro) | Le altre due (squadra, formula incontri) hanno una fonte autorevole a favore dello stato attuale |
| D5 | **Combinazioni fuori-pilota → rifiuto esplicito** | Meglio dire «non coperto» che consegnare una distinta plausibile e sbagliata |
| D6 | **Anta doppia → rimandata** | Lo schema p0407 è «sede 30 mm», che il motore non sa rappresentare (`seatMm` max 22). Farla ora significa o inventare la sede 30, o costruirla sede 18 senza uno schema che la documenti. Sono inoltre 31 voci, con catenaccio passante e cerniere per seconda anta |

Deliberatamente **non** fatto, benché suggerito: sostituire la formula degli
incontri con «somma NOT. trattando `-` come ignoto e assumendo fusto = 1». È lo
stesso overfitting della formula, con l'aggravante di contraddire un valore
stampato.

## Design

### Blocco 1 — Stop (PVC e battente)

- `prisma/seed-kit.ts`: `isActive: false` sui template «ARTECH anta-ribalta PVC»
  e «ARTECH anta a battente LEGNO».
- `rules-artech-pvc.ts` e `rules-artech-battente-legno.ts`: `generate()` lancia
  `KitGenerationError` con un messaggio che **nomina il dato mancante** e dove
  cercarlo, sul modello di `rules-artech-alu.ts`. I dati e le tabelle già
  verificati restano nel file (commentati come materiale di ripartenza), non si
  cancellano: le 10 bande della cremonese battente sono corrette.
- `nuova-client.tsx`: `ACTIVE_WINDOW_TYPES` e `MATERIAL_AVAILABILITY` allineati;
  hint in italiano che spiega **perché** non è disponibile, non solo che non lo è.
- Test: ogni modulo disattivato ha un test «rifiuta e spiega»; il registry
  continua a risolverli (restano registrati).

### Blocco 2 — Correzioni al pilota

In `artech-legno-shared.ts`, `PER_MANO.supportoCerniera`:
`DESTRA: "A50805.05.DX"`, `SINISTRA: "A50805.05.SX"` (suffisso mano `.DX/.SX`,
non `.01/.02`). Si propaga al battente via `PER_MANO`, che però è disattivato.

In `rules-artech-legno.ts`: `CREMONESI[0].minH: 650 → 610`; `ruleDescription`
dell'incontro ribalta allineata al codice (9x18).

Il golden **non cambia nei totali** (4,44 € = 4,44 €); cambia una stringa di
codice, quindi `GOLDEN_MANDATORY` va aggiornato con il commento che cita p0451 e
il certificato ift.

### Blocco 3 — Vasistas riscritto

Distinta secondo p0418 (416). Tabelle **come dati**, non come `if`.

**Forbici — tabella «Posizionamento forbici» (per LBB = larghezza):**

| LBB | Forbici | Posizione |
|---|---|---|
| 274-540 | 2 | sui montanti |
| 541-860 | 1 | sul traverso |
| 861-1200 | 3 | 1 traverso + 2 montanti |
| 1201-2510 | 4 | 2 traverso + 2 montanti |

Articolo unico `A50545.00.00` «Per Vasistas › per cremonese maniglia variabile»
(p0442, 8,99 €) — verificato: non esiste un codice distinto per le forbici sui
montanti, cambia solo la posizione di montaggio.

**Cerniere (voci 10-11-12), per interasse × battuta del pilota (13 / 20):**

| Voce | Famiglia | Codice pilota | € | Qty | Mano |
|---|---|---|---|---|---|
| 10 | Centrale registrabile portante **e per vasistas** (p0455) | `A51101.36.01` | 10,23 | 2 (+1) | ambidestra |
| 11 | Articolazione superiore anta semifissa (p0455) | `A51001.36.01` / `.02` | 9,67 | 2 | DX / SX |
| 12 | Corpo articolazione superiore (p0454) | `A51050.16.12` | 2,06 | 2 | — |

ASSUNZIONE su ciascuna delle tre: si sceglie la variante **base** anziché quella
«con compensatore 16/12» / «con canale 16/12» / «solo lato traverso superiore»,
che lo schema non discrimina.

**Peso dell'anta.** Due NB dello schema dipendono dal peso: «con ante di peso fra
70 e 80 kg (max) aggiungere la cerniera al centro ⑩» e «portata massima delle
forbici di sicurezza 40 kg cadauna». Si aggiunge `sashWeightKg` **opzionale**
(stesso pattern di `supplementaryClosures`, quindi nessun `KitInput` esistente si
rompe):

- assente → 2 cerniere portanti + avviso «verificare che il peso dell'anta non
  superi i 70 kg»;
- 70 ≤ peso ≤ 80 → terza cerniera centrale + relativi supporto forbice e perno;
- peso > 80 → rifiuto (fuori campo di applicazione);
- peso / n. forbici > 40 → rifiuto (portata forbice).

**Le altre righe:** via DSS e incontro DSS; supporto forbice `A50702.05.00` e
perno `A50790.00.00` in quantità pari alle **cerniere portanti** (non alle
forbici); terminale corsa 18 `A50193.00.03` **e** corsa 18+18 `A50193.00.02`
(voci 3 e 4); terminali chiusure supplementari sui due montanti (voce 7);
movimento angolare e limitatore invariati. Resta la guardia ≤ 2 m².

Golden nuovo, scritto **a mano dalle 13 voci dello schema** prima del codice.

### Blocco 4 — Guardia sui parametri fuori-pilota

Un solo punto di verità, in `artech-legno-shared.ts`:

```
PILOT_GEOMETRY = { airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18 }
```

I moduli ARTECH la verificano all'ingresso e rifiutano con un messaggio che dice
quale combinazione è coperta e quale è stata richiesta. Lo schema zod **non**
cambia (i range restano): la guardia sta nel dominio, dove sa spiegarsi, non
nella validazione sintattica.

## Test

TDD, un commit per blocco. `pnpm test` deve restare verde su tutto il resto.

- **Golden vasistas** scritto dallo schema **prima** del modulo.
- Tabella forbici: un test per banda + i **bordi** (540/541, 860/861, 1200/1201).
- Peso: assente → 2 cerniere + avviso; 75 → 3 cerniere; 85 → rifiuto; portata
  forbice superata → rifiuto.
- Moduli disattivati: rifiutano e il messaggio nomina il dato mancante.
- Guardia fuori-pilota: un test per parametro.
- Pilota: golden aggiornato, e un test che il totale **non** cambia.
- Il test PVC che asseriva `A51922.36.02` va rimosso con il modulo, non
  «aggiustato».

## Fuori scope

Anta doppia (D6) · ricostruzione del PVC (serve il listino separato) · sede 30 ·
scorrevoli e Galileo Pro · bilici · il bug `dedupeRows` last-wins in
`map-product.ts` (vedi sotto).

## Azioni ops

1. **`pnpm db:seed:kit` su Neon** dopo il merge — è ciò che disattiva davvero PVC
   e battente in produzione. Senza questo passo il codice è a posto ma i template
   restano attivi.
2. **Audit delle distinte già emesse** (richiede accesso al DB, non disponibile in
   questa sessione):
   ```sql
   SELECT window_type, material, COUNT(*), MIN(created_at), MAX(created_at)
   FROM kit_requests GROUP BY 1,2 ORDER BY 3 DESC;
   ```
   Se sono uscite distinte PVC o battente verso clienti reali, la priorità
   diventa avvisare gli agenti, non il codice.

## Difetto collaterale, segnalato e non corretto

`dedupeRows` in `src/server/catalog/map-product.ts:84` tiene l'**ultima**
occorrenza di ogni codice. 921 codici compaiono su più pagine e 609 cambiano
categoria: la cremonese del kit golden `A50122.08.02` è a DB come
*galileo-pro-alluminio, pag. 868* invece che *ARTECH, pag. 424*. Effetto:
«Visualizza nel listino» apre la pagina sbagliata per 113 codici ARTECH e il
filtro categoria in Archivio li classifica male. Fuori dallo scope kit, ma è un
bug reale con un fix piccolo (preferire la prima occorrenza, o quella la cui
categoria è coerente col prefisso di codice).

## Domande per l'esperto AGB

Queste sono le uniche che i dati non risolvono. Vanno poste insieme, e la
risposta a ognuna sblocca codice già scritto.

1. **Battente, schema p0416 (414)** — nella configurazione «anta singola a
   battente», quale terna di cerniere si usa: «per seconda anta» (voci 5-6),
   «centrali a scomparsa» (15-16) o «centrale registrabile portante» (17)? È
   l'unica cosa che manca per riattivare la tipologia.
2. **Squadra angolare** — lo schema dice «con compensatore» (`A50901.36`), il
   certificato ift «ARTech Legno» dice `A50904.36.01` («per traverso in
   alluminio con compensatore»). Quale vale per una finestra tutto-legno?
3. **Incontri nottolino** — come si determina la quantità? La colonna NOT. dei
   componenti selezionati dà 4 per il caso 550×1820, la distinta reale 2021 ne
   dava 5.
4. **Sede 30 vs sede 18** — tutti gli schemi 2026 sono «sede 30 mm»; la distinta
   2021 era sede 18. La sede 18 è ancora una configurazione ordinabile?
5. **Vasistas** — le tre varianti di cerniera (base / con compensatore 16/12 /
   «solo lato traverso superiore») quale va usata? E il terminale: servono
   entrambi, corsa 18 **e** 18+18?
6. **Listino PVC e ALLUMINIO** — il volume citato a p0849 (847). Sblocca insieme
   il PVC e l'alluminio ARTECH.
