# Fase 1d — Kit Deterministic Engine — Design

**Status:** approvato dall'utente (design + verdetto LLM Council 2026-07-04).
**Data:** 2026-07-04

## Goal

Generazione **deterministica** del kit ferramenta AGB a partire dalle specifiche
del serramento inserite dall'agente (form strutturato): lista componenti
(codice, quantità, posizione, prezzo, regola applicata), persistita su
`KitRequest`/`KitComponent`. **MAI LLM nei calcoli** (regola inviolabile).

**Pilota:** anta-ribalta **ARTECH «ad applicare»**, FINESTRA, mano SX/DX,
materiali LEGNO/PVC/ALLUMINIO. Altre serie/tipologie in fasi successive.

## Fonti delle regole (raccolte in brainstorming)

1. **Distinta Commerciale reale AGB** (email UFP↔AGB, 16/11/2021, «GIAMPAOLO
   UFPT RIF SECCO ARAI 12 ASSE 13 B 20»): configurazione
   `ATH_AntaRibalta_ALL | L0:550×H0:1820 | FINESTRA | SX | ARTECH | ALLUMINIO |
   INT:13 | BAT:20 | SEDE:18 | ARIA 12 | COP:KIT | VERTICALI:PASSO 600 |
   ORIZZONTALI:NESSUNA` → 20 righe componente (24 pezzi). È il **golden test**.
2. **Listino AGB 2026** (già importato: 6.191 prodotti): spaccato numerato del
   sistema ARTECH (posizione → famiglia componente, pag. ~404), varianti per
   range dimensionale nei nomi/colonne prodotto (es. cremonese `E15 1594-1810`,
   corpo forbice `476-604`), tabelle certificazione ift (config. per materiale,
   pesi max), campi di applicazione pagg. 399-401 (diagrammi grafici →
   soglie da trascrivere a mano come vincoli di validazione).
3. Il flusso attuale: l'agente UFP inoltra la richiesta ad AGB che risponde con
   la distinta. L'engine sostituisce questo giro di email per i casi coperti.

### Golden test — distinta di riferimento (input → output atteso)

Input: `widthMm:550, heightMm:1820, FINESTRA, openingSide:SINISTRA,
series:ARTECH, material:ALLUMINIO, axisOffsetMm:13, rebateMm:20, seatMm:18,
airGapMm:12, finish:ARGENTO, openingDir:TIRARE` (+ costanti pilota: verticali
passo 600, orizzontali nessuna, coperture kit).

Output atteso (part number AGB → codice catalogo puntato, da verificare a DB
in implementazione):

| Part number | Descrizione | Qty |
|---|---|---|
| A501221507 | CREMONESE ARTECH A/R E15 1594-1810 | 1 |
| A503020102 | MOV.ANGOLARE ARTECH 125X125 1F | 2 |
| A503300000 | ANGOLO CHIUSURA SUPPL ARTECH L185 | 1 |
| A504010003 | TERMINALE CHIUSURA SUPPL. ARTECH L600 | 1 |
| A505100002 | CORPO FORBICE ARTECH 476-604 | 1 |
| A507110000 | SUPPORTO FORB APPL ARTECH PERNI 3X3 | 1 |
| A507900000 | PERNO PER SUPPORTO FORBICE ZSL | 1 |
| A508110700 | CERN.MASCHIO ARTECH PERNI 3X3 | 1 |
| A509113602 | CERNIERA FEMMINA ARTECH APPL I13 B20 SX | 1 |
| A513260221 | COP. FEMM. APPLIC. SX ARTECH | 1 |
| A513280021 | COP. SUPPORTO FORBICE APPLICARE ARTECH | 1 |
| A513300021 | COP. ANGOLO FORBICE APPLICARE ARTECH | 1 |
| A513310021 | COP. INFERIORE MASCHIO APPLICARE ARTECH | 1 |
| A513320021 | COP. SUPERIORE MASCHIO APPLICARE ARTECH | 1 |
| A514000503 | INCONTRO DSS A12 I9 | 1 |
| A514010502 | INC NOTT ARTECH ALL LEGNO SEDE 18/22/35 | 5 |
| A514SX0565 | INC.RIB SX A12I9 ACC ARTECH VITI DIRITTE | 1 |
| A518010001 | PROLUNGA ARTECH L200 | 1 |
| A518030003 | PROLUNGA ARTECH L600 1F | 1 |
| A519223602 | BRACCIO FORB.ARTECH APPL SX I13 B20 GR2 | 1 |

## Decisione architetturale (LLM Council 2026-07-04, unanime — ADR)

**Regole = Opzione B «a forma di dati»: moduli TypeScript tipati, non JSON a DB.**

- Le **tabelle** (range→codice, parametri→codice) sono costanti tipate
  `as const` in `src/server/kit/rules-artech.ts`; le **quantità calcolate**
  sono funzioni pure nominate. Motivo decisivo: i selettori a range sono banali
  in qualsiasi rappresentazione — sono le *formule* a discriminare, e una
  formula in JSON o degenera in un DSL (opzione C, bocciata: inner-platform)
  o si riduce a una funzione TS referenziata per nome («A = B + interprete +
  zod + seed», non la versione semplice).
- Con n=1 distinta reale, progettare oggi lo schema JSON generico =
  wrong abstraction garantita. **Trigger di migrazione ad A registrato**: alla
  2ª serie si valuta, alla 3ª si estrae il vocabolario comune in
  `KitTemplate.rules`. `KitInput` resta generico (nessun campo ARTECH-specifico).
- **`KitTemplate` resta vivo come registro/dispatcher**: selezione per
  `windowType/material/series/isActive/priority`; `rules` contiene SOLO il
  puntatore versionato `{"engine":"artech-ar-applicare","version":1}` validato
  zod. Shape sconosciuta o engine non registrato → errore esplicito; un test
  garantisce che ogni template attivo abbia il modulo registrato.
- Git è l'audit trail delle regole: ogni modifica passa da PR + CI + golden
  test (per un kit di ferramenta un errore è responsabilità, non bug cosmetico).
- Nota per sessioni future: questa decisione **sostituisce** il design
  data-driven di `ufptrade/ARCHITETTURA_COMPLETA.md` §5 (regole in JSON):
  non «correggere» verso A senza il trigger di cui sopra.

## Componenti

### 1. `src/server/kit/types.ts`
- `KitInput` (zod): `windowType` (pilota: solo `ANTA_RIBALTA`), `widthMm`,
  `heightMm`, `material`, `airGapMm`, `axisOffsetMm`, `rebateMm`, `seatMm`,
  `openingSide`, `openingDir`, `finish`, `series` (pilota: solo `ARTECH`),
  `notes?` — speculare ai campi di `KitRequest` (nessuna migrazione schema).
  Costanti pilota documentate nel modulo: FINESTRA, chiusure verticali
  STANDARD PASSO 600, orizzontali NESSUNA, coperture KIT.
- `KitLine { position: string; code: string; quantity: number; ruleId: string;
  ruleDescription: string }` — riempie i campi già presenti in `KitComponent`.
- `RuleModule = { engineId: string; generate(input: KitInput): KitLine[] }` —
  puro, lancia `KitGenerationError` tipato (messaggi italiani) su input fuori
  campo di applicazione. MAI selezione silenziosa «del più vicino».

### 2. `src/server/kit/rules-artech.ts`
Tabelle `as const` per posizione dello spaccato (cremonese per range H,
corpo forbice per range L, cerniere/braccio per asse+battuta+mano, incontri per
aria+interasse+sede, coperture per finitura+mano) + funzioni pure per le
quantità (movimenti angolari, numero incontri nottolino da H/L e passo 600,
composizione chiusure verticali angolo/prolunghe/terminale da H).
**Le assunzioni non derivabili dalla singola distinta (es. `ceil` vs `floor+1`
sui conteggi, estremi inclusivi/esclusivi dei range) vanno marcate con
commento `// ASSUNZIONE:` e verranno corrette alla prossima distinta reale.**
Vincoli dai campi di applicazione (pagg. 399-401) trascritti come soglie di
validazione (peso/dimensioni max → warning o errore).

### 3. `src/server/kit/engine.ts`
Pipeline: valida input (zod + campo di applicazione) → seleziona template
attivo da DB (`windowType/material/series`, priority) → risolve `RuleModule`
dal registry via puntatore `rules` → `generate(input)` → risolve i codici su
`Product` (Prisma `findMany` per `agbCode`; **nessun raw SQL**) → prezzi e
totali. Codice non a listino → riga `warning` esplicita nell'output (kit
comunque generato, prezzo mancante segnalato). Output: `KitOutput { lines
(con productId/prezzi), totalPrice, warnings, templateId, engineVersion }`.

### 4. Seed template — `prisma/seed-kit.ts` (`pnpm db:seed:kit`)
Un `KitTemplate` ARTECH anta-ribalta attivo con puntatore engine. Idempotente.

### 5. Router — `src/server/api/routers/kit.ts` (procedure AGENT)
- `create` (input KitInput → `KitRequest` DRAFT, `requestNumber` formato
  `KIT-YYYY-NNNN` progressivo per anno, ActivityLog `KIT_REQUEST_CREATED`);
- `generate` ({kitRequestId}, ownership) → engine → transazione: sostituisce i
  `KitComponent`, salva `generatedKit` JSON, `totalPrice/totalComponents`,
  status `COMPLETED` (o `REJECTED`+errore su fallimento), ActivityLog
  `KIT_GENERATED`;
- `get` (dettaglio con componenti+prodotti) · `list` (proprie, paginate).
Errori engine → `TRPCError` con messaggio italiano.

### 6. UI — `/richieste` (voce nav esistente; sviluppo con /impeccable)
- Lista richieste: tabella (numero, data, tipologia, dimensioni, stato badge,
  totale), vuota con CTA.
- `/richieste/nuova`: form 4 step (wireframe): 1 tipologia+serie+materiale →
  2 dimensioni+parametri tecnici (aria/asse/battuta/sede) → 3 mano/apertura/
  finitura → 4 riepilogo + «Genera kit». Validazione zod client+server,
  valori della distinta come default sensati.
- Dettaglio `/richieste/[id]`: distinta generata (tabella: posizione, codice
  mono + copia, descrizione, qty, prezzo unitario/totale), totale kit,
  warnings, link ai prodotti in Archivio, «Rigenera».

## Testing (TDD)

- **Golden test** (unit, prodotti fake): input della distinta → esattamente le
  20 righe/24 pezzi attese (codici+quantità).
- **Boundary test** per ogni tabella range (estremi, fuori range → errore
  tipato) e per le formule quantità (salti a H=k+600·n, sotto il primo
  scaglione).
- Test registry (template attivo senza modulo → errore; puntatore malformato →
  errore zod), router (RBAC/ownership, transazione generate), UI (form step,
  tabella distinta).
- **Verifica a DB reale**: golden test integrazione gated
  (`INTEGRATION_DATABASE_URL`) che risolve i 20 codici sul catalogo importato
  (esistenza + prezzi 2026).

## Fuori scope (1d)

Porta-finestra / cat. passante / seconda anta · altre serie (PLANA, alzante…)
· PDF export (1e) · admin UI template · tool `generate_kit` nella chat (1e) ·
migrazione regole a DB (trigger: 2ª-3ª serie).

## Prerequisiti

Catalogo importato a DB (fatto: 6.191). Nessuna nuova dipendenza. Nessuna
migrazione schema.
