# Fase 1h — Kit engine: tipologia «Anta a battente» ARTECH legno

**Data:** 2026-07-12 · **Stato:** design approvato dall'utente · **Serie:** ARTECH ·
**Materiale:** LEGNO (unico) · **Confidenza:** PROVVISORIA (come PVC — da validare con l'agente)

## Contesto

Il kit engine deterministico copre finora una sola **tipologia** di serramento:
`ANTA_RIBALTA` serie ARTECH (LEGNO validato golden Fase 1d; PVC provvisorio Fase 1g;
ALLUMINIO gated — il listino 2026 non ha composizione alluminio). L'utente vuole
ampliare le tipologie selezionabili nel wizard, oggi limitato all'anta-ribalta.

Richiesta iniziale: «anta proiettante». **Verifica listino (gate Fase 1g «verificare
prima»):** l'anta proiettante / «a sporgere» **non è nel listino AGB 2026** (0 riscontri
per proiettante/sporgere come tipo apertura; `sporg` = solo «sporgenza cilindro»;
`bilico` = sistema pivot TOUR, prodotto diverso). Stessa situazione dell'alluminio:
dato assente → non costruibile in modo deterministico. Le tipologie con schema ARTECH
legno **completo** nel listino sono: anta/ribalta (fatta), **a battente**, vasistas.
→ **Decisione utente: procedere con «a battente».**

## Obiettivo

Aggiungere la tipologia `ANTA_BATTENTE` (casement, apertura a battente — anta singola,
Mod. 502) al kit engine, serie ARTECH, materiale LEGNO, come distinta deterministica
**provvisoria** derivata dal listino 2026, esposta nel wizard. Deterministico, **MAI LLM**.

## Fattibilità & dati (verificati su `listino.txt`, pdftotext del listino 2026)

- **Cremonese a battente** = famiglia **nuova** `A50200.15.NN` (Mod. 502, «Anta a battente
  per finestra e porta finestra a 1 anta»), selezione **per altezza** — stessa struttura
  della cremonese anta-ribalta `A50122.15.NN`. Tabella pulita ed estraibile:

  | range altezza (mm) | codice |
  |---|---|
  | 360–610 | `A50200.15.01` |
  | 600–810 | `A50200.15.02` |
  | 800–1010 | `A50200.15.03` |
  | 1000–1210 | `A50200.15.04` |
  | 1200–1410 | `A50200.15.05` |
  | 1400–1610 | `A50200.15.06` |
  | 1600–1810 | `A50200.15.07` |
  | 1800–2110 | `A50200.15.08` |
  | 2000–2310 | `A50200.15.09` |
  | 2200–2510 | `A50200.15.10` |

  (La variante `.17`/07bis a maniglia 1050 e la famiglia Mod. 506 a maniglia centrale
  `A50600.15.NN` per larghezza esistono ma sono fuori scope: pilota = Mod. 502 standard.)
- **Incontri cremonese battente**: «Per incontri cremonese Mod. 502 — incontri da 46 mm»
  (famiglia dedicata da estrarre in implementazione).
- **Condivise con anta-ribalta legno (codici GIÀ validati Fase 1d):** squadra angolare
  (`A50904.36.NN` per mano), supporto cerniera (`A50801.01.NN` per mano), movimento
  angolare (`A50302.01.02`), incontri nottolino (`A51400.05.02`, formula passo 600),
  coperture (`A51301.*`).
- **Rimosse (meccanismo di ribalta assente nel battente):** forbice corpo (`A50510.*`) +
  braccio (`A5191{1,2}.36.*`), supporto forbice (`A50702.*`), perno (`A50790.*`),
  incontro ribalta (`A51400.05.70`), chiusure supplementari verticali.

**Confidenza = PROVVISORIA.** Ogni *famiglia* è estraibile dal listino, ma manca una
**distinta commerciale golden** che verifichi la *forma* complessiva (quali componenti,
quantità esatte, correttezza della sottrazione del ribalta). Il golden anta-ribalta di
Fase 1d derivava dalla «Distinta Commerciale AGB 2021»; per l'a battente non esiste un
riferimento equivalente. → distinta marcata provvisoria, validazione agente successiva
(coerente con la strategia utente di Fase 1g: «procedere col solo listino, poi far
testare all'agente»).

## Architettura — Opzione C estesa (scelta utente; ADR 2026-07-04, no /llm-council)

`engine.ts` è **già generico su `windowType`**: nessuna modifica. Registry e pipeline
invariati nella forma. Si estende il pattern a moduli isolati, fattorizzando la meccanica
legno realmente condivisa.

### Nuovi file

- **`src/server/kit/artech-legno-shared.ts`** — tabelle/logica legno *davvero comuni* ad
  anta-ribalta e a battente, estratte da `rules-artech-legno.ts`:
  - `PER_MANO` (squadra angolare + supporto cerniera per mano SX/DX);
  - il fisso movimento angolare (`A50302.01.02` ×2);
  - la formula `incontriNottolino(width, height)` (passo 600).

  **Vincolo: estrazione behavior-preserving.** Il success-path dell'anta-ribalta LEGNO
  deve restare **byte-identico** (verificato dal golden Fase 1d, che NON deve cambiare).
  Solo ciò che è meccanicamente identico va condiviso; coperture, cremonese e le parti
  ribalta-specifiche restano nel modulo anta-ribalta.
- **`src/server/kit/rules-artech-battente-legno.ts`** — `RuleModule`, `engineId =
  "artech-batt-legno"`. Compone:
  - cremonese battente da nuova tabella `BATTENTE_CREMONESI` (`A50200.15.NN`, per altezza);
  - cerniere per mano (da `artech-legno-shared`);
  - movimento angolare (da shared);
  - incontri nottolino (formula da shared);
  - incontri cremonese battente (Mod. 502, da estrarre);
  - coperture legno per finitura+mano (riuso struttura `A51301.*`, ASSUNZIONE se differisce);
  - **niente** forbice / supporto forbice / perno / incontro ribalta / chiusure verticali.

  Guardia materiale: `input.material !== "LEGNO"` → `KitGenerationError` esplicito
  (identico pattern al modulo legno anta-ribalta). Le voci non derivabili con certezza
  marcate `// ASSUNZIONE`.
- **`src/server/kit/rules-artech-battente-legno.test.ts`** — golden **snapshot
  auto-coerente** su una config rappresentativa + asserzioni struttura/quantità +
  guardia materiale.

### File modificati

- **`src/server/kit/types.ts`** — `windowType: z.literal("ANTA_RIBALTA")` →
  `z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE"])`. Il campo `supplementaryClosures` resta
  (inutilizzato dal battente).
- **`src/server/kit/rules-artech-legno.ts`** — importa `PER_MANO`, il fisso movimento
  angolare e `incontriNottolino` da `artech-legno-shared`. Nessun cambiamento di output.
- **`src/server/kit/registry.ts`** — registra `artechAntaBattenteLegno`.
- **`prisma/seed-kit.ts`** — aggiungere `windowType` a `KitTemplateSeed` (rimuovere
  l'hardcode `windowType: "ANTA_RIBALTA"` a riga ~56); nuovo template
  `windowType: ANTA_BATTENTE, material: LEGNO, engine: "artech-batt-legno", isActive: true`,
  nome/descrizione con nota **PROVVISORIO**.
- **`src/app/(dashboard)/richieste/nuova/nuova-client.tsx`** — wizard:
  - rimuovere `ANTA_BATTENTE` da `FUTURE_WINDOW_TYPES`; rendere `windowType`
    effettivamente selezionabile (ANTA_RIBALTA + ANTA_BATTENTE), aggiornando `form.windowType`;
  - **disponibilità materiali per tipologia**: ANTA_BATTENTE → solo LEGNO abilitato,
    PVC+ALLUMINIO gated («non disponibile per a battente»); ANTA_RIBALTA → comportamento
    attuale (LEGNO+PVC, ALLUMINIO gated);
  - al passaggio a ANTA_BATTENTE con materiale PVC/ALU selezionato → reset a LEGNO;
  - **nascondere** il toggle «chiusure supplementari» quando `windowType === "ANTA_BATTENTE"`
    (è ribalta-only).

## Scope (minimale — YAGNI / ponytail)

- **Solo LEGNO.** PVC/ALLUMINIO a battente = nessun dato → gated nel wizard (niente
  template attivi). I 4 swap PVC di Fase 1g erano anta-ribalta-specifici (braccio/forbice)
  e non trasferibili al battente.
- **Solo anta singola** (Mod. 502). Anta doppia/quattro ante rimandate (richiedono un
  parametro n°ante + composizione diversa: cerniere seconda anta, ecc.).
- Form riusato: larghezza/altezza/mano/finitura/aria/interasse/battuta/sede/direzione
  valgono anche per il battente (selezionano cremonese e cerniere). Solo il toggle
  chiusure è nascosto.

## Gestione provvisorio & validazione

- Template `isActive: true` ma marcato **PROVVISORIO** (come PVC): l'app genera kit
  battente con codici da validare.
- **`docs/superpowers/kit-assunzioni/battente.md`** — scheda assunzioni + **domande pronte
  per l'agente**: conferma selezione cremonese Mod. 502 per altezza; conferma parti
  ribalta rimosse (nessun forbice/supporto forbice/incontro ribalta nel battente);
  conferma formula incontri nottolino per battente; conferma coperture; conferma quantità.

## Testing / gate

- **Non-regressione**: il golden anta-ribalta LEGNO esistente **deve restare verde**
  dopo l'estrazione in `artech-legno-shared` (garanzia behavior-preserving).
- **Nuovo golden battente**: snapshot auto-coerente su config rappresentativa
  (es. L600 × H1400, LEGNO, DESTRA, ARGENTO) — documenta la derivazione, cattura regressioni.
- **Validazione strutturale codici**: ogni codice battente verificato presente nel
  listino/catalogo (grep su `listino.txt`; a runtime l'engine già segnala con warning i
  codici non a catalogo).
- **Wizard**: ANTA_BATTENTE selezionabile; solo-LEGNO (PVC/ALU gated); nessun toggle
  ribalta per battente; reset materiale al cambio tipologia.
- Gate: `pnpm typecheck · lint · test · build`.

## Non-goals

- Anta doppia / quattro ante (rimandate).
- PVC / ALLUMINIO per a battente (nessun dato).
- Cremonese a maniglia centrale Mod. 506 (`A50600.15.*`).
- Anta proiettante / vasistas / bilico / scorrevoli (altre tipologie, altre fasi).
- Motore generico data-driven (Opzione B) — YAGNI a 2 tipologie.

## Assunzioni aperte (da validare con l'agente)

1. La sottrazione del meccanismo ribalta produce la distinta battente corretta (nessun
   componente battente-specifico oltre a cremonese + incontri Mod. 502).
2. La formula `incontriNottolino` (passo 600) vale identica per il battente.
3. Le coperture legno (`A51301.*`) sono le stesse (o quale variante per il battente).
4. Selezione cremonese Mod. 502 per altezza con gli stessi offset dell'anta-ribalta
   (`hbb = heightMm − 10`) — da confermare sui range reali della famiglia `A50200.15`.
