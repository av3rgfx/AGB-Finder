# Fase 1i — Kit engine: tipologia «Vasistas» ARTECH legno

**Data:** 2026-07-23 · **Stato:** design approvato dall'utente (approccio «costruisci
provvisorio ora») · **Serie:** ARTECH · **Materiale:** LEGNO (unico) · **Confidenza:**
PROVVISORIA (come battente/PVC — da validare con l'agente AGB)

## Contesto

Il kit engine deterministico copre oggi due **tipologie** ARTECH: `ANTA_RIBALTA` (LEGNO
golden Fase 1d, PVC provvisorio Fase 1g) e `ANTA_BATTENTE` (LEGNO provvisorio Fase 1h).
ALLUMINIO resta gated (il listino 2026 non ha composizione alluminio). L'utente vuole
ampliare le tipologie selezionabili nel wizard, **solo LEGNO** per adesso («è la categoria
più importante»).

**Verifica listino (fatta sul PDF 2026 reale, `pdftotext -layout`):** delle 5 tipologie
mancanti nel wizard, **solo la Vasistas** è sviluppabile col solo listino restando dentro
il sistema ARTECH (classe A). Anta proiettante e finestra da tetto = 0 riscontri;
scorrevole alzante (classe G) e scorrevole/Galileo (classe M) sono sistemi separati, non
ARTECH. La vasistas ha inoltre uno **schema di montaggio dedicato** («Finestra rettangolare
legno - apertura vasistas», pag. 416), a differenza del battente che era derivato per
sottrazione → confidenza di partenza più alta, ma con più assunzioni sulle *quantità*.

## Obiettivo

Aggiungere la tipologia `VASISTAS` (apertura a ribalta pura, bottom-hung, anta singola)
al kit engine, serie ARTECH, materiale LEGNO, come distinta deterministica **provvisoria**
derivata dallo schema di montaggio 2026, esposta nel wizard. Deterministico, **MAI LLM**.

## Fattibilità & dati (verificati su `listino.txt`, pdftotext del listino 2026)

Estrazione + verifica adversarial multi-agente (8 agenti, distinta riconciliata + 3
verifiche + critico) e spot-check manuale delle righe critiche.

### Cuore: cremonese vasistas `A50111.15` (E.15, maniglia variabile/centrale)

Famiglia **diversa** dall'anta-ribalta (che usa la martellina fissa `A50122.15`). Selezione
per GR, GR derivato dall'altezza (HBB). Tabella E.15 verificata (righe 19552-19558), con la
colonna **NOT.** (numero nottolini sul cremonese → numero incontri nottolino):

| GR | range HBB (mm) | codice | NOT. (incontri) | prezzo |
|----|----------------|--------|------|--------|
| 00 | 274–662 | `A50111.15.10` | 0 | 7,74 € |
| 01 | 540–712 | `A50111.15.11` | 0 | 8,27 € |
| 02 | 660–860 | `A50111.15.12` | 1 | 8,27 € |
| 03 | 820–1220 | `A50111.15.13` | 1 | 8,89 € |
| 04 | 1190–1610 | `A50111.15.14` | 2 | 10,42 € |
| 05 | 1590–2010 | `A50111.15.15` | 2 | 13,37 € |
| 06 | 1890–2510 | `A50111.15.16` | 4 | 17,14 € |

**Campo di applicazione pilota: GR01–GR06 (HBB ∈ [540, 2510]).** GR00 (274–662) è escluso:
il listino non definisce il n° forbici per GR00 e sotto 470 mm servono movimenti angolari
speciali (NB 19569) — fuori scope, l'esperto lo sblocca. I range HBB si **sovrappongono**:
disambiguazione = GR più basso il cui range copre l'HBB (coincide con lo span più stretto
di `pick()`).

### Forbici per vasistas `A50545.00.00` (NB 19566-19567, verificato)

- E.15: **GR1-3 → 1 forbice; GR4-6 → 2 forbici.** Prezzo 8,99 €.
- È l'**unico** organo forbice del vasistas base: NON usa il corpo forbice legno `A50510`
  + braccio `A5191x` dell'anta-ribalta.
- Vincolo di sicurezza (pag. 417, non righe di distinta): forbici sui montanti obbligatorie
  per LBB ∈ [861, 2510] con HBB > 500; portata max 40 kg cad.; superficie max 2 m².

### Catena DSS — differenza chiave dall'anta-ribalta (verificato righe 19469 vs 19565)

L'anta-ribalta `A50122` ha «**DSS sempre presente su tutti i GR**» (integrato). La cremonese
vasistas `A50111` invece: «**DSS da ordinare separatamente art. A50190.00.00**». Quindi il
DSS (`A50190.00.00` ambidestro, 4,13 €) + il suo incontro (`A51400.05.03`, come il gemello
anta-ribalta) vanno **aggiunti** alla distinta, altrimenti il kit è meccanicamente
incompleto. Questa è l'unica voce che il generatore aggiunge oltre le posizioni numerate
dello schema pag. 416.

### Componenti condivisi con l'anta-ribalta legno (codici già validati Fase 1d)

- **Movimento angolare** `A50302.01.02` (125×125, costante `MOVIMENTO_ANGOLARE`, qty 2);
- **Supporto forbice** `A50702.05.00` (battuta 20) — qty = n. forbici (non fissa 1);
- **Perno supporto forbice** `A50790.00.00` — qty = n. forbici;
- **Incontro DSS** `A51400.05.03`; **Incontri nottolino** `A51400.05.02` (codice condiviso,
  ma quantità via colonna NOT.(GR), non la formula perimetrale dell'anta-ribalta).

### Specifici vasistas (non nell'anta-ribalta)

- Cremonese `A50111.15`, forbici `A50545.00.00`, DSS `A50190.00.00`;
- **Terminale per vasistas** `A50193.00.03` (corsa 18, 3,18 €) / `A50193.00.02` (corsa
  18+18, 4,38 €);
- **Limitatore di corsa 18 mm** `A50196.00.18` (0,75 €), montato sui movimenti angolari.

### Escluse (fuori scope anta singola / non nello schema base)

Cerniere per seconda anta (pos. 10-12, solo anta doppia/semifissa) · corpo forbice legno
`A50510` + braccio (solo anta-ribalta) · coperture kit `A51301` (lo schema base pag. 416
non le numera → `finish` resta raccolto ma non usato dal vasistas: domanda esperto) ·
incontro ribalta `A51400.05.70` (nell'anta-ribalta è fisso; nel vasistas le forbici +
limitatore governano già la ribalta — non numerato nello schema base: domanda esperto).

## Distinta canonica proposta (anta singola, base, LEGNO)

| # | Posizione | Codice | Q.tà | Confidenza |
|---|-----------|--------|------|------------|
| 1 | `cremonese` | `A50111.15.11…16` (per GR) | 1 | codice ✅ / offset HBB ASSUNZIONE |
| 2 | `dss` | `A50190.00.00` (ambidestro) | 1 | ASSUNZIONE (A50111 lo richiede a parte; variante handed da validare) |
| 3 | `incontro-dss` | `A51400.05.03` | 1 | ASSUNZIONE (come anta-ribalta) |
| 4 | `forbici-vasistas` | `A50545.00.00` | GR1-3→1, GR4-6→2 | ✅ |
| 5 | `supporto-forbice` | `A50702.05.00` (battuta 20) | = n. forbici | ASSUNZIONE battuta · condiviso |
| 6 | `perno-supporto-forbice` | `A50790.00.00` | = n. forbici | ✅ · condiviso |
| 7 | `terminale-vasistas` | `A50193.00.03` (corsa 18) | 1 | ASSUNZIONE q.tà/corsa |
| 8 | `movimento-angolare` | `A50302.01.02` | 2 | ASSUNZIONE · costante condivisa |
| 9 | `limitatore-corsa` | `A50196.00.18` | 2 (= n. mov. angolari) | ASSUNZIONE |
| 10 | `incontri-nottolino` | `A51400.05.02` | NOT.(GR): GR2-3→1, GR4-5→2, GR6→4, GR01→0 | ASSUNZIONE (formula NOT.) |

Chiusure supplementari **fuori scope pilota**: lo schema base pos. 7 è un singolo «terminale»
`A50401.00.NN` con quantità/lunghezza dipendenti dal disegno — non derivabile deterministicamente.
Il toggle resta nascosto per la vasistas (come per il battente); si valuterà con l'esperto.

## Guardie deterministiche (novità rispetto a battente/anta-ribalta)

- **HBB = heightMm** (offset 0, come il battente — ASSUNZIONE; l'anta-ribalta usa −10, i due
  gemelli divergono → da validare con l'esperto). Il limite inferiore/superiore del campo di
  applicazione è imposto **dalla tabella stessa**: `pick()` su `VASISTAS_CREMONESI` (che parte
  da GR01=540 e finisce a GR06=2510) lancia `KitGenerationError` fuori banda → heightMm < 540
  o > 2510 rifiutato con messaggio esplicito.
- **Superficie `widthMm × heightMm ≤ 2 m²`** → `KitGenerationError` (limite stampato sullo
  schema). Oggi `kitInputSchema` ammette fino a 3000×3000 = 9 m². Guardia esplicita nel modulo.
- **Guardia materiale** `!== LEGNO` → `KitGenerationError` (identico pattern battente).

## Architettura — Opzione C (come battente; ADR 2026-07-04, no /llm-council)

`engine.ts` è **già generico su `windowType`**: nessuna modifica. Registry e pipeline
invariati nella forma.

### Nuovi file

- **`src/server/kit/rules-artech-vasistas-legno.ts`** — `RuleModule`, `engineId =
  "artech-vasistas-legno"`. Tabella `VASISTAS_CREMONESI` (GR + codice + nForbici + nNottolini
  per range HBB); calcola nForbici dal GR, supporto/perno/limitatore in funzione di
  nForbici/nMovimenti; DSS + incontro DSS + terminale + movimenti + incontri nottolino
  (NOT.(GR)). Riusa da `kit-shared`: `pick`, `linesFromParts`. Riusa da `artech-legno-shared`
  il **codice** `MOVIMENTO_ANGOLARE` (qty 2). Guardie: materiale, superficie 2 m². Chiusure
  supplementari fuori scope (toggle nascosto). Ogni voce non certa marcata `// ASSUNZIONE`.
- **`src/server/kit/rules-artech-vasistas-legno.test.ts`** — golden **snapshot
  auto-coerente** su config rappresentativa (es. L600 × H1000 → GR03: 1 forbice, 1 nottolino,
  `A50111.15.13`) + un secondo caso a 2 forbici (es. H1800 → GR05) + asserzioni struttura/
  quantità (forbici 1 vs 2, incontri NOT.(GR), DSS presente) + guardie (materiale ≠ LEGNO,
  superficie > 2 m², altezza fuori banda GR).

### File modificati

- **`src/server/kit/types.ts`** — `windowType: z.enum([...,"VASISTAS"])`. Campo
  `supplementaryClosures` resta nello schema ma è ignorato dal vasistas (toggle nascosto,
  come il battente).
- **`src/server/kit/registry.ts`** — registra `artechVasistasLegno`.
- **`prisma/seed-kit.ts`** — nuovo template `windowType: VASISTAS, material: LEGNO,
  engine: "artech-vasistas-legno", isActive: true`, nome/descrizione con nota **PROVVISORIO**.
- **`src/lib/kit-labels.ts`** — etichetta `windowTypeLabel("VASISTAS")` = «Vasistas».
- **`src/app/(dashboard)/richieste/nuova/nuova-client.tsx`** — wizard:
  - spostare `VASISTAS` da `FUTURE_WINDOW_TYPES` ad `ACTIVE_WINDOW_TYPES`;
  - `MATERIAL_AVAILABILITY.VASISTAS` = solo LEGNO abilitato (PVC/ALU gated «non disponibile
    per la vasistas»);
  - il toggle «chiusure supplementari» resta **nascosto** per il vasistas (la condizione
    diventa «mostra solo se `ANTA_RIBALTA`»): la composizione chiusure vasistas non è
    derivabile dallo schema base → fuori scope pilota.

**Nessuna migrazione** (l'enum Postgres `WindowType` ha già `VASISTAS` dalla init 2026-07-01).

## Scope (minimale — YAGNI / ponytail)

- **Solo LEGNO.** PVC/ALLUMINIO vasistas = nessun dato → gated nel wizard.
- **Solo anta singola**, entrata **E.15**, variante **base** «apertura vasistas» (pag. 416).
- **Campo di applicazione GR01–GR06** (HBB 540–2510, superficie ≤ 2 m²).
- Form riusato (larghezza/altezza/mano/finitura/aria/interasse/battuta/sede/direzione).

## Gestione provvisorio & validazione

- Template `isActive: true` marcato **PROVVISORIO** (come battente/PVC): l'app genera kit
  vasistas con codici reali da validare.
- **`docs/superpowers/kit-assunzioni/vasistas.md`** — scheda assunzioni + domande pronte per
  l'agente (vedi «Assunzioni aperte»).

## Testing / gate

- **Non-regressione**: i golden anta-ribalta LEGNO e battente **restano verdi** (nessuna
  modifica ai loro moduli; `artech-legno-shared` invariato).
- **Nuovo golden vasistas**: snapshot auto-coerente su config rappresentativa + asserzioni
  quantità + guardie.
- **Validazione strutturale codici**: ogni codice vasistas verificato presente su
  `listino.txt` (fatto in estrazione); a runtime l'engine segnala con warning i codici non a
  catalogo Neon.
- Gate: `pnpm typecheck · lint · test · build`.

## Non-goals

- Anta doppia / quattro ante (cerniere seconda anta pos. 10-12).
- Entrata E.7,5 (forbici non applicabili GR1-4) e GR00 (n° forbici non definito).
- Varianti pag. 417/418/419 (forbici verticali di sicurezza / nottolini sul traverso /
  cerniere a cuneo) e pag. 519 (cerniere a scomparsa) — usano composizioni diverse.
- Schema «sede 30 mm» (ogni pagina vasistas rimanda a schemi dedicati): il pilota copre solo
  la sede standard (incontri `A51400.05.02` aria 12), coerente con gli altri moduli.
- PVC / ALLUMINIO vasistas · coperture estetiche (`finish` raccolto ma non usato) · motore
  generico data-driven (Opzione B) — YAGNI a 3 tipologie.

## Assunzioni aperte (da validare con l'agente AGB)

1. **Offset altezza→HBB**: pilota assume HBB = heightMm (offset 0, come battente). L'anta-ribalta
   usa −10. Quale vale per la cremonese vasistas `A50111.15`?
2. **DSS**: il vasistas base include `A50190.00.00` (ambidestro) + incontro DSS `A51400.05.03`?
   Variante DSS per mano (`A50190.00.DX/.SX`) vs ambidestro?
3. **Movimento angolare — quantità**: 2 (come anta-ribalta/battente/PVC) o altro? Di conseguenza
   il limitatore `A50196.00.18` (assunto = n. movimenti angolari).
4. **Terminale per vasistas**: quale/quante posizioni — corsa 18 (`A50193.00.03`) vs 18+18
   (`A50193.00.02`)? Pilota: 1 × corsa 18.
5. **Incontri nottolino — formula**: colonna NOT.(GR) della cremonese `A50111.15` (assunta) o la
   formula perimetrale «2 + scatti passo 600» dell'anta-ribalta? Le due divergono.
6. **Forbici — asse LBB**: le bande LBB «Posizionamento forbici» (274-540/541-860/861-1200/
   1201-2510) determinano solo la *posizione* o anche il *numero*? Il conteggio pilota è per GR
   (da HBB). Obbligo montanti per LBB 861-2510/HBB>500 da implementare come warning?
7. **Supporto forbice — battuta**: 18 (`A50701.05.00`) o 20 (`A50702.05.00`)? Pilota: battuta 20
   (come anta-ribalta, stesso prezzo).
8. **Coperture / finitura**: il vasistas base richiede un kit copertura estetico per il supporto
   forbice (come l'anta-ribalta `A51301`)? Oggi `finish` è raccolto ma non usato dal vasistas.
9. **Incontro ribalta `A51400.05.70`**: serve nel vasistas base (l'apertura È a ribalta) o le
   forbici + limitatore bastano? Pilota: non incluso.
