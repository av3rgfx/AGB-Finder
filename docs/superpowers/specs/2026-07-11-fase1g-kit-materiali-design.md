# Fase 1g — Kit multi-materiale (anta-ribalta ARTECH: fix LEGNO + PVC + ALLUMINIO) — Design

> Spec di design. Stato: **approvata dall'utente 2026-07-11**, pronta per il piano
> (`writing-plans`). Fonte autoritativa delle regole: **listino AGB 2026** (959 pagine,
> capitolo ARTECH ~p398-520). Motore **deterministico (MAI LLM)**.

## Contesto e obiettivo

Il kit engine (Fase 1d) copre oggi **una sola famiglia**: `ANTA_RIBALTA` · serie
`ARTECH` · materiale `LEGNO`, con regole in `src/server/kit/rules-artech.ts` (340 righe:
tabelle-dati `as const` + funzioni pure). Questa fase estende la copertura, con tre
obiettivi:

1. **Fix correttezza LEGNO** — il gruppo «chiusure supplementari» (angolare verticale +
   prolunga + terminale) è oggi **generato sempre** e il resolver **va in errore sopra
   2120 mm**. Il listino le classifica come *«Chiusure supplementari»* (opzionali), e un
   agente di dominio ha confermato che **non sono obbligatorie**. Vanno rese opzionali.
2. **Aggiungere PVC** anta-ribalta ARTECH.
3. **Aggiungere ALLUMINIO** anta-ribalta ARTECH.

## Decisioni chiave

### D1 — Validazione: solo listino, golden PVC/ALU provvisori (scelta utente)
Per il LEGNO esiste una **distinta reale** come ground truth (golden esatto 16 righe).
Per PVC/ALLUMINIO **non** c'è ancora un esempio validato: le regole si ricavano **solo dal
listino** e verranno riviste da un agente di dominio (previsto lunedì). Quindi:

- ogni scelta non certa è marcata `// ASSUNZIONE` (come in Fase 1d);
- validazione **strutturale**: ogni codice generato **esiste** a catalogo (Neon) **ed è
  prezzato**, e la distinta è coerente con lo schema del listino;
- i golden PVC/ALU sono **provvisori**;
- si produce un **report «da verificare con l'agente»** (elenco puntato delle assunzioni
  per materiale) per rendere rapida la revisione di lunedì.

### D2 — Chiusure supplementari LEGNO: toggle opzionale, default OFF (scelta utente)
Il set obbligatorio è **sempre** generato. Le chiusure supplementari diventano un
**toggle** (default **OFF**). In futuro (dopo consulto con l'agente) si potrà passare a una
**regola condizionata** (auto-inclusione secondo una soglia del listino) — registrato come
follow-up, **non** in questa fase.

### D3 — Architettura: **Opzione C (ibrido)** — verdetto UNANIME del LLM Council (2026-07-11)
Council a 4 membri (subagent mode), tutti convergenti su C. Estrarre **solo la meccanica
condivisa e già validata**; tenere **tabelle-dati e formule per-materiale** isolate nei
rispettivi moduli.

- **Scartata B** (motore generico a puri dati): astrazione su regole **non validate** =
  wrong-abstraction (monito dell'ADR 2026-07-04); inoltre alcune **formule** — non solo le
  tabelle — differiscono per materiale (`incontriNottolino`, offset `hbb`), quindi «solo
  dati» è falso e B degenererebbe in `if(material)` / mini-DSL **sullo stesso code-path del
  legno funzionante**. Timing peggiore possibile.
- **Scartata A** (tre moduli interamente duplicati): triplicherebbe `pick()` — l'unica
  logica **certa e insidiosa** (bande sovrapposte, tie-break sulla più stretta) — con
  rischio di copie divergenti. Dà isolamento solo dove già ce l'hai (moduli separati per le
  parti volatili), al costo di duplicare il core stabile.
- **Coerenza con l'ADR 2026-07-04**: l'ADR fissava «alla 3ª famiglia si estrae il
  vocabolario comune», ma su regole **reali**. Con PVC/ALU provvisori si estrae ora il
  **vocabolario meccanico** (stabile, già provato), e si rimanda l'eventuale estrazione del
  **vocabolario di dominio** (→ B) a dopo la validazione. C è quindi l'esecuzione
  aggiornata dello staging dell'ADR, ed è **reversibile verso B** senza rilavorazione.

## Architettura

### `src/server/kit/kit-shared.ts` (nuovo) — SOLO meccanica pura
Contenuto (material-agnostico, coperto dai golden):
- `pick()` — resolver a bande `{minH,maxH,minL,maxL}` con tie-break sulla banda più stretta
  (spostato tale e quale da `rules-artech.ts:192-217`).
- un builder di righe `KitLine` per i loop tipo `FISSI`/gruppi (es. `partsToLines(parts, ruleId)`).
- le guardie condivise: finitura (`assertFinish(map, finish) → KitGenerationError`) ed
  eventuale helper d'errore fuori-campo.

> **🔒 Regola inviolabile (litmus test).** `kit-shared.ts` contiene **zero** conoscenza di
> materiale: nessun `if (material === …)`, nessuna tabella, nessuna formula, nessuna
> sequenza di gruppi configurabile. Per ogni riga: **«la revisione dell'agente può
> cambiarla?»** → sì ⇒ resta nel modulo materiale (volatile); no ⇒ può stare in shared
> (invariante). È questa regola che impedisce a C di scivolare in B. Un `if(material)` che
> tenta di entrare in `kit-shared` è il segnale che stai spostando *policy*, non *meccanismo*.

### Moduli per-materiale (policy volatile, isolata)
- `rules-artech-legno.ts` (rinomino dell'attuale `rules-artech.ts`)
- `rules-artech-pvc.ts` (nuovo)
- `rules-artech-alu.ts` (nuovo)

Ciascuno esporta un `RuleModule` con il proprio `engineId` (`artech-ar-legno`,
`artech-ar-pvc`, `artech-ar-alu`) e mantiene **le proprie** tabelle `as const` + **le
proprie** formule + la propria pipeline `generate()`. Importano da `kit-shared`.

### Registry, template, engine — invariati per struttura
- `registry.ts`: `RULE_MODULES` guadagna 2 voci (`artech-ar-pvc`, `artech-ar-alu`); 2 import.
- `prisma/seed-kit.ts`: 2 righe `KitTemplate` (`material=PVC`, `material=ALLUMINIO`),
  `rules={engine, version:1}`.
- `engine.ts`: **nessuna modifica** — seleziona già il template per `material`
  (`OR:[{material:null},{material:input.material}]`, priority) e risolve il modulo via
  registry. La guardia «materiale non coperto» oggi in `rules-artech.ts:228-232` si sposta
  di fatto sul dispatch: un materiale senza template/modulo → errore esplicito esistente.

### `src/server/kit/types.ts` — `kitInputSchema`
- Aggiungere flag opzionale **`supplementaryClosures: z.boolean().optional().default(false)`**
  (D2). Il flag è condiviso (vive nell'input), ma **usato solo dal modulo legno** in questa
  fase.
- `material` resta `z.enum(["LEGNO","PVC","ALLUMINIO"])` (già così). `windowType`/`series`
  restano literal `ANTA_RIBALTA`/`ARTECH`.

## Il fix LEGNO (Task isolato, prima di tutto)

Oggi `generate()` chiude con `pick(CHIUSURE_VERTICALI, heightMm, …)` + loop
**incondizionato** (`rules-artech.ts:322-336`), e `pick()` **lancia** se `heightMm` è fuori
1520-2120. Nuovo comportamento:

- il blocco chiusure supplementari è eseguito **solo se `input.supplementaryClosures === true`**;
- default OFF ⇒ il percorso obbligatorio funziona per **qualsiasi altezza valida** (via
  l'errore sopra 2120 mm sul default);
- toggle ON + altezza fuori banda supplementari ⇒ `KitGenerationError` esplicito
  («chiusure supplementari non disponibili per questa altezza») — solo quando esplicitamente
  richieste.

**Effetto sui golden LEGNO** (cambiamento d'output voluto, TDD prima l'atteso poi verde):
- **golden default (OFF)** = solo set obbligatorio;
- **golden toggle (ON)** = default + le 4 righe supplementari (l'attuale golden 16 righe).

> **ASSUNZIONE da confermare in implementazione**: l'esatto set obbligatorio di default va
> allineato alla lista dell'agente (Cremonese · movimenti angolari · fusto · braccio legno ·
> squadra angolare · supporto forbice · perno supporto forbice · supporto cerniera · inserto
> incontro nottolino · incontro nottolino · incontro ribalta) **e** allo schema listino
> p420. In particolare va deciso se **«coperture kit»** (`A51301.*`) sia obbligatorio (è nel
> golden attuale ma **non** nella lista dell'agente) → marcare `// ASSUNZIONE`, verificare lunedì.

## PVC e ALLUMINIO (moduli provvisori)

- Estrazione dagli schemi ARTECH del listino (tabella compatibilità per materiale: righe
  `ARTech PVC` e `ARTech PLANA`; schemi di composizione numerati + bande LBB).
- **ALLUMINIO ≈ «ARTech PLANA»**: da confermare in estrazione; possibile **caveat copertura
  codici** (come l'alluminio «ad applicare» 2021 in Fase 1d, dove 11/20 codici mancavano) →
  ogni codice generato va verificato presente+prezzato su Neon, altrimenti **warning
  esplicito** (pattern engine esistente), kit comunque generato.
- Golden **provvisorio** per materiale (uno smoke «shape» + i tiri fuori-campo con
  `KitGenerationError`); niente golden esatto blindato finché l'agente non valida.

## Error handling
- Guardia finitura/materiale non coperti → `KitGenerationError` tipato (messaggi italiani).
- Codice non a listino → **warning** esplicito nella distinta, kit generato (pattern 1d).
- Dimensione fuori campo d'applicazione → `KitGenerationError` esplicito con `ruleId`.

## UX / Wizard (`/impostazioni` di dominio, poi rifinito con `/impeccable`)
- `nuova-client.tsx`: abilitare le card **PVC** e **ALLUMINIO** (oggi disabilitate,
  `FUTURE_WINDOW_TYPES`/hint «Presto disponibile»).
- Aggiungere il **toggle «Chiusure supplementari»** (default off) nello step dimensioni o
  riepilogo, con hint che spiega cosa sono.
- `FINISH_OPTIONS`: restano quelle coperte dalle tabelle coperture per materiale (per ora
  ARGENTO su legno; PVC/ALU secondo listino) — mantenere l'accoppiamento tabella↔wizard.

## Testing
- **LEGNO**: due golden esatti (default OFF / toggle ON); mantenere i test di bordo esistenti
  (`pick()` 476/604/605, fuori-campo, scatti nottolino); test del flag.
- **`kit-shared`**: i test di `pick()` (tie-break bande) si spostano qui — unica sede.
- **PVC/ALU**: golden provvisorio (shape) + validazione strutturale (esistenza+prezzo codici
  su catalogo, gated su `INTEGRATION_DATABASE_URL` come `engine.integration.test.ts`) + tiri
  fuori-campo.
- Gate: `pnpm typecheck · lint · test · build`.

## Sequenza di implementazione (sicurezza prima — mai mischiare fix e refactor)
1. **Fix LEGNO** (flag `supplementaryClosures`, gate del blocco, due golden). Isolato nel
   modulo attuale.
2. **Estrai `pick()` + builder + guardie** in `kit-shared.ts` come **refactor puro** sotto
   golden verde (output byte-identico); `rules-artech.ts` → `rules-artech-legno.ts`.
3. **PVC**: `rules-artech-pvc.ts` + registry + `KitTemplate` + golden provvisorio + report.
4. **ALLUMINIO**: `rules-artech-alu.ts` idem.
5. **Wizard**: abilita PVC/ALU + toggle.
6. **Post-validazione agente**: bump `version` sui puntatori DB quando le regole passano
   provvisorie → validate.

## Fuori scope (registrato)
- Regola **condizionata** per le chiusure supplementari (D2, opzione «c» futura) — dopo agente.
- Altre **tipologie** di serramento (proiettante, battente, scorrevoli, vasistas, tetto):
  meccanismi diversi, ognuna una distinta a sé.
- Generalizzazione verso B: **solo** dopo regole validate **e** un asse di variazione nuovo
  (2ª tipologia, non 2° materiale). Ri-eseguire allora questa decisione.

## Riferimenti
- Codice: `src/server/kit/{rules-artech.ts,types.ts,registry.ts,engine.ts,rules-artech.test.ts}`,
  `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`, `prisma/seed-kit.ts`.
- ADR precedente: `docs/superpowers/specs/2026-07-04-fase1d-kit-engine-design.md` (trigger di migrazione 2ª/3ª famiglia).
- Verdetto LLM Council 2026-07-11 (4/4 → Opzione C; regola-guardia meccanismo≠policy; sequenza sicura).
- Listino AGB 2026 (link registrato in `CLAUDE.md`), capitolo ARTECH ~p398-520.
