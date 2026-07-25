# Bonifica kit ARTECH LEGNO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare i moduli kit ARTECH LEGNO ad aderire al listino AGB 2026, spegnendo quelli che producono distinte non ordinabili (PVC, battente) e riscrivendo il vasistas sullo schema di montaggio reale.

**Architecture:** Nessuna modifica all'architettura. I moduli regole restano funzioni pure `KitInput → KitLine[]` risolte dal registry; le tabelle di listino restano dati letti da `pick()`. Due aggiunte al modulo condiviso `artech-legno-shared.ts`: la costante di geometria del pilota con la sua guardia, e nulla più. Un campo opzionale in `kitInputSchema`.

**Tech Stack:** TypeScript strict · Vitest · Prisma (solo seed) · Next.js App Router (wizard client).

## Global Constraints

- **TypeScript strict** sempre. Nessun `any`, nessun `!` non giustificato.
- **Il kit engine è deterministico: MAI un LLM.** Nessuna chiamata di rete nei moduli regole.
- **Mai dati fabbricati**: se un codice non è a listino, il modulo rifiuta. Le scelte fra varianti *esistenti* si marcano con `// ASSUNZIONE` e finiscono nella scheda di `docs/superpowers/kit-assunzioni/`.
- **UI in italiano**, codici prodotto in monospace, mobile-first (il wizard è già responsive: non peggiorarlo).
- **Pagine di listino**: nei commenti si cita **sempre la pagina fisica** con la stampata fra parentesi, es. `p0418 (416)`. Fisica = stampata + 2.
- **Nessuna migrazione Prisma** in questo piano. Solo `prisma/seed-kit.ts`.
- Gate: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`. Un commit per task.
- Riferimento normativo: `docs/superpowers/specs/2026-07-25-kit-bonifica-artech-legno-design.md`.

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `src/server/kit/rules-artech-pvc.ts` | Da modulo generante a modulo che **rifiuta** e spiega | 1 |
| `src/server/kit/rules-artech-pvc.test.ts` | Sostituito: test di rifiuto | 1 |
| `src/server/kit/rules-artech-battente-legno.ts` | Da modulo generante a modulo che **rifiuta** e spiega; le tabelle verificate restano come materiale di ripartenza | 2 |
| `src/server/kit/rules-artech-battente-legno.test.ts` | Sostituito: test di rifiuto | 2 |
| `prisma/seed-kit.ts` | `isActive:false` sui due template | 1, 2 |
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | Gating wizard + hint che spiegano *perché* | 1, 2 |
| `src/server/kit/artech-legno-shared.ts` | Correzione `supportoCerniera`; nuova `PILOT_GEOMETRY` + `assertPilotGeometry` | 3, 4 |
| `src/server/kit/rules-artech-legno.ts` | Banda cremonese 610; descrizione incontro ribalta; chiamata alla guardia | 3, 4 |
| `src/server/kit/rules-artech-vasistas-legno.ts` | Riscrittura sullo schema p0418 | 5, 6, 7 |
| `src/server/kit/rules-artech-vasistas-legno.test.ts` | Golden nuovo + tabelle + guardie | 5, 6, 7 |
| `src/server/kit/types.ts` | Campo opzionale `sashWeightKg` | 7 |
| `docs/superpowers/kit-assunzioni/*.md` | Riscritte come esito di verifica, non come lista di domande | 8 |

---

### Task 1: Spegnere il PVC

Il modulo genera 4 righe con codici che **non esistono a listino** (verificati: compaiono solo nelle pagine-certificato ift p0013 e p0395, senza prezzo) più 7 codici generati per simmetria che non esistono nemmeno lì. Il template è `isActive:true` in produzione: ogni distinta PVC esce con 4 righe su 12 senza prezzo e totale sottostimato.

**Files:**
- Modify: `src/server/kit/rules-artech-pvc.ts` (sostituzione integrale del corpo)
- Modify: `src/server/kit/rules-artech-pvc.test.ts` (sostituzione integrale)
- Modify: `prisma/seed-kit.ts:29-38`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx:52-56`

**Interfaces:**
- Consumes: `KitGenerationError`, `RuleModule` da `./types`
- Produces: `artechAntaRibaltaPvc` con lo stesso `engineId` `"artech-ar-pvc"` (il registry non cambia)

- [ ] **Step 1: Scrivere il test di rifiuto**

Sostituire **tutto** il contenuto di `src/server/kit/rules-artech-pvc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaPvc } from "./rules-artech-pvc";

const input: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "PVC",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("artechAntaRibaltaPvc — gated (composizione assente dal listino 2026)", () => {
  it("rifiuta sempre, anche con input valido", () => {
    expect(() => artechAntaRibaltaPvc.generate(input)).toThrow(KitGenerationError);
  });

  it("il messaggio nomina il dato mancante e dove cercarlo", () => {
    expect(() => artechAntaRibaltaPvc.generate(input)).toThrow(/listino PVC e ALLUMINIO/);
  });

  it("rifiuta anche per gli altri materiali (nessun percorso genera righe)", () => {
    expect(() => artechAntaRibaltaPvc.generate({ ...input, material: "LEGNO" })).toThrow(
      KitGenerationError,
    );
  });

  it("mantiene l'engineId registrato nel registry", () => {
    expect(artechAntaRibaltaPvc.engineId).toBe("artech-ar-pvc");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test src/server/kit/rules-artech-pvc.test.ts`
Expected: FAIL — il modulo attuale genera righe invece di lanciare.

- [ ] **Step 3: Sostituire il modulo**

Sostituire **tutto** il contenuto di `src/server/kit/rules-artech-pvc.ts`:

```typescript
// Regole kit ARTECH anta-ribalta PVC — DISATTIVATO 2026-07-25.
//
// ⚠️ NON DISPONIBILE. La verifica sul listino AGB 2026 ha dimostrato che la
// composizione ARTECH PVC NON esiste in questo volume:
//   · nella sezione ARTECH (p0390-0507) la stringa «PVC» compare in UNA sola
//     pagina, p0395 (393), che è l'allegato del certificato ift 228-6026531-1-13
//     rilegato nel capitolo — un documento normativo, non un catalogo di vendita;
//   · i 4 codici material-specific su cui il modulo era costruito
//     (A51921.36.04, A50712.00.00, A50922.07.00, A50812.07.00) compaiono SOLO in
//     p0013 (11) e p0395 (393): nessuna tabella prezzi, nessuna scheda, non
//     ordinabili. Grep esaustivo su tutte le 960 pagine;
//   · altri 7 codici che il modulo generava (A51921.36.01/.02/.03 e l'intera
//     famiglia braccio SX A51922.36.0N) non esistono NEMMENO nel certificato:
//     erano dedotti per simmetria dal legno;
//   · i capitoli merceologici sono intestati al materiale — «Supporti Forbice -
//     Legno» (p0449), «Cerniere - Legno» (p0451), «Coperture - Legno» (p0488) —
//     e non esiste il gemello PVC di nessuno di essi.
//
// Il listino dice dove sta davvero il PVC: p0849 (847) rimanda tre volte al
// «listino PVC e ALLUMINIO», sezione FERRAMENTA PER FINESTRE ARTECH. Finché quel
// volume non è disponibile, un kit ARTECH PVC deterministico è impossibile:
// mancano il 100% delle tabelle di composizione e il 100% degli incontri.
//
// Effetto prima di questa modifica: ogni distinta PVC usciva con 4 righe su 12
// senza prezzo e un totale sistematicamente sottostimato.
//
// Per riattivare: ricostruire le regole dal listino PVC e ALLUMINIO, rimettere
// isActive:true in prisma/seed-kit.ts, bump della version.
// Vedi docs/superpowers/kit-assunzioni/pvc.md.
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

export const artechAntaRibaltaPvc: RuleModule = {
  engineId: "artech-ar-pvc",
  generate(_input: KitInput): KitLine[] {
    throw new KitGenerationError(
      "Kit PVC ARTECH non disponibile: il listino 2026 non contiene la composizione PVC per ARTECH " +
        "(rimanda al «listino PVC e ALLUMINIO», sezione FERRAMENTA PER FINESTRE ARTECH). " +
        "Sarà riattivato con i dati di quel volume.",
      "artech.materiale",
    );
  },
};
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm test src/server/kit/rules-artech-pvc.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Disattivare il template nel seed**

In `prisma/seed-kit.ts`, sostituire l'oggetto «ARTECH anta-ribalta PVC» (righe 29-38) con:

```typescript
  {
    // DISATTIVATO 2026-07-25: la composizione ARTECH PVC non esiste nel listino
    // 2026 (i 4 codici material-specific sono solo nelle pagine-certificato ift,
    // senza prezzo). Riattivare con il «listino PVC e ALLUMINIO» — vedi
    // rules-artech-pvc.ts e docs/superpowers/kit-assunzioni/pvc.md.
    name: "ARTECH anta-ribalta PVC",
    description:
      "NON DISPONIBILE — la composizione PVC non è nel listino 2026: serve il «listino PVC e ALLUMINIO» (rimando a p0849).",
    windowType: "ANTA_RIBALTA",
    material: "PVC",
    rules: { engine: "artech-ar-pvc", version: 1 },
    priority: 10,
    isActive: false,
  },
```

- [ ] **Step 6: Allineare il wizard**

In `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`, dentro `MATERIAL_AVAILABILITY.ANTA_RIBALTA`, sostituire la riga del PVC:

```typescript
    { value: "PVC", enabled: false, hint: "Non a listino 2026 — serve il listino PVC e alluminio" },
```

E aggiornare il commento sopra `MATERIAL_AVAILABILITY` (righe 46-50):

```typescript
/**
 * Materiali disponibili per tipologia. Il listino 2026 copre solo il LEGNO per
 * ARTECH: PVC e ALLUMINIO rimandano a un volume separato («listino PVC e
 * ALLUMINIO», p0849) non ancora disponibile → entrambi gated.
 */
```

- [ ] **Step 7: Eseguire l'intera suite**

Run: `pnpm test`
Expected: PASS. Se `engine.test.ts` o `registry.test.ts` fanno riferimento a una generazione PVC riuscita, aggiornarli al nuovo comportamento (il registry deve continuare a **risolvere** `artech-ar-pvc`: è registrato, semplicemente rifiuta).

- [ ] **Step 8: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: puliti.

- [ ] **Step 9: Commit**

```bash
git add src/server/kit/rules-artech-pvc.ts src/server/kit/rules-artech-pvc.test.ts prisma/seed-kit.ts "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "fix(kit): disattiva il PVC, i suoi codici non sono a listino 2026

I 4 codici material-specific (A51921.36.04, A50712.00.00, A50922.07.00,
A50812.07.00) compaiono solo nelle pagine-certificato ift p0013 e p0395,
senza prezzo; altri 7 (A51921.36.01/.02/.03 e la famiglia A51922.36.0N)
non esistono nemmeno lì: erano dedotti per simmetria. Ogni distinta PVC
usciva con 4 righe su 12 senza prezzo e totale sottostimato.

Il modulo ora rifiuta nominando il dato mancante e il template è
isActive:false, come già fatto per l'alluminio in Fase 1g."
```

---

### Task 2: Spegnere il battente

Lo schema p0416 (414) ha 21 voci, il modulo ne genera 5: mancano corpo articolazione superiore, articolazione superiore anta semifissa, supporti forbice e perno. **L'anta non ha punto di sospensione in alto.** Lo schema è composito (tre alternative di cerniera) e non è decidibile dal solo listino.

Le 10 bande della cremonese `A50200.15.NN` sono invece **verificate corrette** contro p0429 (427): restano nel file come materiale di ripartenza.

**Files:**
- Modify: `src/server/kit/rules-artech-battente-legno.ts`
- Modify: `src/server/kit/rules-artech-battente-legno.test.ts` (sostituzione integrale)
- Modify: `prisma/seed-kit.ts:53-62`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx:35-36, 57-61`

**Interfaces:**
- Consumes: `KitGenerationError`, `RuleModule` da `./types`
- Produces: `artechAntaBattenteLegno` con `engineId` `"artech-batt-legno"` invariato; esporta `BATTENTE_CREMONESI` per conservarne la verifica

- [ ] **Step 1: Scrivere il test di rifiuto**

Sostituire **tutto** il contenuto di `src/server/kit/rules-artech-battente-legno.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaBattenteLegno, BATTENTE_CREMONESI } from "./rules-artech-battente-legno";

const input: KitInput = {
  windowType: "ANTA_BATTENTE",
  widthMm: 600,
  heightMm: 1300,
  material: "LEGNO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "DESTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("artechAntaBattenteLegno — gated (distinta incompleta)", () => {
  it("rifiuta: la distinta non ha il gruppo di sospensione superiore", () => {
    expect(() => artechAntaBattenteLegno.generate(input)).toThrow(KitGenerationError);
  });

  it("il messaggio nomina il dato mancante (terna cerniere dello schema)", () => {
    expect(() => artechAntaBattenteLegno.generate(input)).toThrow(/cerniere/i);
  });

  it("mantiene l'engineId registrato nel registry", () => {
    expect(artechAntaBattenteLegno.engineId).toBe("artech-batt-legno");
  });
});

describe("BATTENTE_CREMONESI — verificata contro p0429 (427), conservata per la ripartenza", () => {
  it("ha le 10 bande del listino, dalla GR01 alla GR10", () => {
    expect(BATTENTE_CREMONESI).toHaveLength(10);
    expect(BATTENTE_CREMONESI[0]).toMatchObject({ minH: 360, maxH: 610, code: "A50200.15.01" });
    expect(BATTENTE_CREMONESI[9]).toMatchObject({ minH: 2200, maxH: 2510, code: "A50200.15.10" });
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm test src/server/kit/rules-artech-battente-legno.test.ts`
Expected: FAIL — sia perché `BATTENTE_CREMONESI` non è esportata, sia perché il modulo genera righe.

- [ ] **Step 3: Sostituire il modulo**

Sostituire **tutto** il contenuto di `src/server/kit/rules-artech-battente-legno.ts`:

```typescript
// Regole kit ARTECH «anta a battente» LEGNO — DISATTIVATO 2026-07-25.
//
// ⚠️ NON DISPONIBILE. La verifica sul listino AGB 2026 ha mostrato che la
// distinta generata era STRUTTURALMENTE INCOMPLETA: lo schema di montaggio
// p0416 (414) «Finestra rettangolare legno - anta singola, apertura a battente»
// elenca 21 voci, il modulo ne generava 5. Mancavano in particolare:
//   · voce 5  «Cerniere per seconda anta » Corpo articolazione superiore»
//   · voce 6  «Cerniere per seconda anta » Articolazione superiore anta semifissa»
//   · voci 8-9 «Supporti Forbice» + «Perno per supporto forbice»
// cioè l'intero appoggio della cerniera SUPERIORE: l'anta non aveva alcun punto
// di sospensione in alto. Distinta non montabile né ordinabile.
//
// Non è correggibile dal solo listino: lo schema p0416 è COMPOSITO. Nello stesso
// disegno convivono la cremonese a battente (voce 1, mod. 502), voci
// dell'anta-ribalta (voce 2 cremonese A/R, voce 3 DSS, voce 13 incontro ribalta)
// e TRE alternative di cerniera — «per seconda anta» (5-6), «centrali a
// scomparsa» (15-16), «centrale registrabile portante» (17). Quale terna
// appartenga alla configurazione «anta singola a battente» è la domanda 1 in
// docs/superpowers/kit-assunzioni/battente.md.
//
// CONSERVATO: BATTENTE_CREMONESI è VERIFICATA contro p0429 (427) — le 10 bande
// HBB e i codici coincidono esattamente con il listino, e la famiglia è
// confermata dalla legenda dello schema («Anta a bandiera - mod. 502»). È il
// punto di ripartenza quando arriva la risposta dell'esperto.
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese «anta a battente» Mod. 502 per range altezza HBB.
 * VERIFICATA contro il listino p0429 (427), tabella «Cremonesi · Anta a battente
 * - Mod. 502 per finestra e porta finestra a 1 anta», entrata 15: bande e codici
 * identici. La colonna NOT. del listino vale 2/2/2/3/3/3/3/4/4/4.
 */
export const BATTENTE_CREMONESI = [
  { minH: 360, maxH: 610, code: "A50200.15.01" },
  { minH: 600, maxH: 810, code: "A50200.15.02" },
  { minH: 800, maxH: 1010, code: "A50200.15.03" },
  { minH: 1000, maxH: 1210, code: "A50200.15.04" },
  { minH: 1200, maxH: 1410, code: "A50200.15.05" },
  { minH: 1400, maxH: 1610, code: "A50200.15.06" },
  { minH: 1600, maxH: 1810, code: "A50200.15.07" },
  { minH: 1800, maxH: 2110, code: "A50200.15.08" },
  { minH: 2000, maxH: 2310, code: "A50200.15.09" },
  { minH: 2200, maxH: 2510, code: "A50200.15.10" },
] as const;

export const artechAntaBattenteLegno: RuleModule = {
  engineId: "artech-batt-legno",
  generate(_input: KitInput): KitLine[] {
    throw new KitGenerationError(
      "Kit anta a battente non disponibile: la distinta sarebbe priva del gruppo di sospensione superiore " +
        "(corpo articolazione, articolazione superiore anta semifissa, supporti forbice). " +
        "Lo schema di listino p0416 mostra tre alternative di cerniere e non indica quale valga per l'anta singola a battente: " +
        "in attesa di conferma da AGB.",
      "artech.tipologia",
    );
  },
};
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm test src/server/kit/rules-artech-battente-legno.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Disattivare il template nel seed**

In `prisma/seed-kit.ts`, sostituire l'oggetto «ARTECH anta a battente legno» (righe 53-62) con:

```typescript
  {
    // DISATTIVATO 2026-07-25: la distinta era priva del gruppo di sospensione
    // superiore (schema p0416 ha 21 voci, il modulo ne generava 5) e lo schema è
    // composito → terna cerniere non decidibile. Vedi
    // rules-artech-battente-legno.ts e docs/superpowers/kit-assunzioni/battente.md.
    name: "ARTECH anta a battente legno",
    description:
      "NON DISPONIBILE — distinta incompleta (manca il gruppo di sospensione superiore): in attesa della conferma AGB sulla terna di cerniere dello schema p0416.",
    windowType: "ANTA_BATTENTE",
    material: "LEGNO",
    rules: { engine: "artech-batt-legno", version: 1 },
    priority: 10,
    isActive: false,
  },
```

- [ ] **Step 6: Allineare il wizard**

In `nuova-client.tsx`, togliere `"ANTA_BATTENTE"` da `ACTIVE_WINDOW_TYPES` e aggiungerlo alle tipologie non disponibili:

```typescript
/** Tipologie coperte dal generatore: radio selezionabili. */
const ACTIVE_WINDOW_TYPES = ["ANTA_RIBALTA", "VASISTAS"] as const;

/** Tipologie non ancora coperte: radio disabilitate. */
const FUTURE_WINDOW_TYPES = [
  "ANTA_BATTENTE",
  "ANTA_PROIETTANTE",
  "SCORREVOLE_ALZANTE",
  "SCORREVOLE_TRASLANTE",
  "FINESTRA_TETTO",
] as const;
```

Lasciare invariata la voce `ANTA_BATTENTE` dentro `MATERIAL_AVAILABILITY`: il record è tipizzato su tutte le `windowType` e serve al typecheck.

- [ ] **Step 7: Verificare il wizard a viewport mobile**

Le tipologie disabilitate passano da 4 a 5: controllare che la griglia regga a 375px. Se il progetto ha uno script di verifica browser usarlo; altrimenti ispezionare le classi responsive della griglia tipologie e confermare che sia `grid-cols-1` o `grid-cols-2` a mobile (non una griglia fissa a 3+ colonne).

- [ ] **Step 8: Suite completa + gate**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: tutto verde. Il test del router kit che generava un battente va aggiornato se presente.

- [ ] **Step 9: Commit**

```bash
git add src/server/kit/rules-artech-battente-legno.ts src/server/kit/rules-artech-battente-legno.test.ts prisma/seed-kit.ts "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "fix(kit): disattiva il battente, la distinta non ha la sospensione superiore

Lo schema di montaggio p0416 (414) elenca 21 voci, il modulo ne generava
5: mancavano corpo articolazione superiore, articolazione superiore anta
semifissa e supporti forbice, cioè l'appoggio della cerniera alta. Kit
non montabile.

Non correggibile dal solo listino: lo schema è composito e mostra tre
alternative di cerniera senza dire quale valga per l'anta singola a
battente. BATTENTE_CREMONESI resta nel file, verificata contro p0429."
```

---

### Task 3: Correzioni provate al pilota anta-ribalta

Tre correzioni, tutte con evidenza diretta a listino. **Non** si tocca la squadra angolare (il certificato ift «ARTech Legno» prescrive `A50904.36.01`, cioè quella attuale) né la formula degli incontri.

**Files:**
- Modify: `src/server/kit/artech-legno-shared.ts:10-21`
- Modify: `src/server/kit/rules-artech-legno.ts:21-38, 62-72, 99-103`
- Modify: `src/server/kit/rules-artech-legno.test.ts` (codici attesi)
- Modify: `src/server/kit/artech-legno-shared.test.ts`

**Interfaces:**
- Produces: `PER_MANO[side].supportoCerniera` ora vale `"A50805.05.DX"` / `"A50805.05.SX"`

- [ ] **Step 1: Aggiornare i test con i valori attesi**

In `src/server/kit/rules-artech-legno.test.ts`, dentro `GOLDEN_MANDATORY`, sostituire la riga del supporto cerniera:

```typescript
  ["A50805.05.SX", 1], // supporto-cerniera SX — «Aria 12 - Interasse 9/13, battuta 20» p0451 (449)
```

Nel test della mano DESTRA (cercare `A50904.36.01` o `"DESTRA"` nel file) sostituire l'atteso del supporto cerniera con `"A50805.05.DX"`.

Aggiungere in fondo al file un test per la banda corretta:

```typescript
describe("artechAntaRibaltaLegno — banda cremonese GR02", () => {
  it("copre le altezze da 620 mm (hbb 610), come il listino p0424 (422)", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...golden, heightMm: 620 });
    expect(lines.find((l) => l.position === "cremonese")?.code).toBe("A50122.15.02");
  });

  it("rifiuta sotto la banda del listino (hbb < 610)", () => {
    expect(() => artechAntaRibaltaLegno.generate({ ...golden, heightMm: 615 })).toThrow(
      KitGenerationError,
    );
  });
});
```

In `src/server/kit/artech-legno-shared.test.ts`, aggiornare ogni asserzione su `supportoCerniera` ai nuovi codici.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit`
Expected: FAIL sui codici del supporto cerniera e sulla banda 620.

- [ ] **Step 3: Correggere `PER_MANO`**

In `src/server/kit/artech-legno-shared.ts`, sostituire il blocco di commento + `PER_MANO` (righe 10-21):

```typescript
/**
 * Componenti cerniera dipendenti da mano, per la geometria del pilota
 * (aria 12 / interasse 13 / battuta 20). Suffissi diversi per famiglia:
 * la squadra usa .01=DX / .02=SX, il supporto cerniera usa .DX / .SX.
 *
 * squadraAngolare A50904.36.NN = «Squadra angolare per traverso in alluminio con
 * compensatore 16/12», p0452 (450), 9,83 €. Il listino offre anche A50901.36.NN
 * («con compensatore», 8,05 €) e A50903.36.NN («per traverso in alluminio»,
 * 7,54 €), e le legende degli schemi chiedono genericamente «Squadra angolare con
 * compensatore» → suggerirebbero A50901. Si CONSERVA A50904 perché è quella
 * prescritta dal certificato ift riga «ARTech Legno» (p0395/p0013), che elenca la
 * quaterna A51911.36.04 · A50702.05.00 · A50904.36.01 · A50805.05 DX. Domanda 2
 * per l'esperto in docs/superpowers/kit-assunzioni/legno.md.
 *
 * supportoCerniera A50805.05.DX/.SX = «Supporto cerniera Aria 12 - Interasse 9/13
 * - Parte telaio», battuta 20, p0451 (449), 4,44 €. CORRETTO il 2026-07-25: prima
 * era A50801.01.01/.02, che è la variante «Aria 4 - Interasse 9», battuta 18 —
 * incompatibile con la geometria del pilota. Doppia conferma: la tabella di p0451
 * e il certificato ift «ARTech Legno». Stesso prezzo, quindi il totale del kit non
 * cambia.
 */
export const PER_MANO: Record<Side, { squadraAngolare: string; supportoCerniera: string }> = {
  SINISTRA: { squadraAngolare: "A50904.36.02", supportoCerniera: "A50805.05.SX" },
  DESTRA: { squadraAngolare: "A50904.36.01", supportoCerniera: "A50805.05.DX" },
};
```

- [ ] **Step 4: Correggere la banda cremonese e la descrizione dell'incontro ribalta**

In `src/server/kit/rules-artech-legno.ts`:

Riga 29, `CREMONESI[0]`:

```typescript
  { minH: 610, maxH: 810, code: "A50122.15.02" },
```

Nel commento sopra `CREMONESI` (righe 21-27), sostituire l'ultima frase con:

```typescript
/**
 * Cremonese A/R per range altezza-maniglia. VERIFICATA contro p0424 (422),
 * tabella «Cremonesi · Anta ribalta - altezza maniglia fissa», entrata 15:
 * le 9 bande coincidono con il listino (GR02 parte da 610, non da 650 —
 * corretto il 2026-07-25: le altezze 620-659 venivano rifiutate a torto).
 * Escluse .17 («07bis», HBB 1634-1810 ma altezza maniglia 1050 anziché 500, si
 * sovrappone ambiguamente a .07) e .31/.41 (p0425, GR1: selezione per HBB E per
 * LBB, schema diverso). L'esclusione delle .31/.41 lascia scoperto l'intervallo
 * HBB 357-609: domanda 4 per l'esperto.
 */
```

Riga 102, la `descr` dell'incontro ribalta:

```typescript
    descr: "Incontro ribalta aria 12 (9x18 viti dritte, ambidestro)",
```

Aggiungere subito sopra quell'oggetto il commento:

```typescript
  // A51400.05.70 = «Incontri Ribalta · Aria 12 · ZAMA · 9x18 viti dritte», p0471
  // (469). La descrizione diceva «13x24»: era il formato di A51400.CR.70, stesso
  // prezzo. Il kit è oggi tutto su asse 9 per gli incontri e interasse 13 per
  // bracci/squadre/cerniere: domanda 3 per l'esperto.
```

- [ ] **Step 5: Eseguire i test**

Run: `pnpm test src/server/kit`
Expected: PASS. Il conteggio righe/pezzi del golden (12/17 senza chiusure, 16/21 con) **non deve cambiare**.

- [ ] **Step 6: Verificare che il totale del golden non sia cambiato**

Run: `pnpm test src/server/kit/engine.test.ts`
Expected: PASS senza modifiche al test — `A50801.01.02` e `A50805.05.SX` costano entrambi 4,44 €.

- [ ] **Step 7: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/kit/artech-legno-shared.ts src/server/kit/artech-legno-shared.test.ts src/server/kit/rules-artech-legno.ts src/server/kit/rules-artech-legno.test.ts
git commit -m "fix(kit): supporto cerniera aria 12 e banda cremonese dal listino

- supporto cerniera A50801.01.0N -> A50805.05.DX/.SX: il primo è la
  variante «Aria 4 - Interasse 9» battuta 18, montata su un serramento
  aria 12 / interasse 13 / battuta 20. Doppia conferma: tabella p0451
  (449) e certificato ift riga «ARTech Legno». Stesso prezzo, totale
  del kit invariato.
- banda cremonese GR02: minH 650 -> 610 come p0424 (422); le altezze
  620-659 venivano rifiutate come fuori campo pur essendo a listino.
- descrizione dell'incontro ribalta allineata al codice (9x18, non 13x24).

La squadra angolare A50904.36 NON è stata cambiata: il certificato ift
«ARTech Legno» prescrive proprio quella."
```

---

### Task 4: Guardia sulla geometria del pilota

Oggi `airGapMm`, `axisOffsetMm`, `rebateMm`, `seatMm` sono raccolti e validati ma non selezionano alcun codice: le tabelle sono cablate su aria 12 / interasse 13 / battuta 20 / sede 18. Un agente può inserire aria 4 e ricevere in silenzio i codici dell'aria 12.

**Files:**
- Modify: `src/server/kit/artech-legno-shared.ts` (append)
- Modify: `src/server/kit/artech-legno-shared.test.ts` (append)
- Modify: `src/server/kit/rules-artech-legno.ts` (chiamata)
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts` (chiamata)

**Interfaces:**
- Produces: `PILOT_GEOMETRY` (readonly, 4 chiavi numeriche) e `assertPilotGeometry(input: KitInput): void` — usata da tutti i moduli ARTECH attivi

- [ ] **Step 1: Scrivere i test**

Aggiungere in fondo a `src/server/kit/artech-legno-shared.test.ts`:

```typescript
import { PILOT_GEOMETRY, assertPilotGeometry } from "./artech-legno-shared";
import { KitGenerationError } from "./types";

const pilota: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "LEGNO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("assertPilotGeometry", () => {
  it("accetta la geometria coperta", () => {
    expect(() => assertPilotGeometry(pilota)).not.toThrow();
  });

  it("rifiuta un'aria diversa e la nomina nel messaggio", () => {
    expect(() => assertPilotGeometry({ ...pilota, airGapMm: 4 })).toThrow(/aria 4/);
  });

  it("rifiuta un interasse diverso", () => {
    expect(() => assertPilotGeometry({ ...pilota, axisOffsetMm: 9 })).toThrow(KitGenerationError);
  });

  it("rifiuta una battuta diversa", () => {
    expect(() => assertPilotGeometry({ ...pilota, rebateMm: 18 })).toThrow(KitGenerationError);
  });

  it("rifiuta una sede diversa", () => {
    expect(() => assertPilotGeometry({ ...pilota, seatMm: 30 })).toThrow(/sede 30/);
  });

  it("elenca tutti i parametri fuori campo, non solo il primo", () => {
    expect(() => assertPilotGeometry({ ...pilota, airGapMm: 4, seatMm: 30 })).toThrow(
      /aria 4.*sede 30/s,
    );
  });

  it("la geometria coperta è quella del golden", () => {
    expect(PILOT_GEOMETRY).toEqual({ airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18 });
  });
});
```

Se il file non importa già `KitInput`, aggiungere `import type { KitInput } from "./types";` in testa.

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit/artech-legno-shared.test.ts`
Expected: FAIL — `PILOT_GEOMETRY` e `assertPilotGeometry` non esistono.

- [ ] **Step 3: Implementare**

Aggiungere in fondo a `src/server/kit/artech-legno-shared.ts`:

```typescript
/**
 * L'unica geometria di serramento per cui esiste una distinta verificata: quella
 * del golden (distinta reale AGB 2021 + listino 2026). Tutte le tabelle dei
 * moduli ARTECH sono cablate su questi valori — cremonesi entrata 15, bracci .36
 * (interasse 13), supporti battuta 20, incontri aria 12.
 *
 * NB: gli schemi di montaggio base del listino 2026 sono invece intitolati «sede
 * 30 mm» e chiedono incontri «Sede 30» / «Battuta 30»; per la sede 18 del golden
 * non esiste uno schema stampato. Domanda 4 per l'esperto.
 */
export const PILOT_GEOMETRY = {
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
} as const;

const GEOMETRY_LABELS: Record<keyof typeof PILOT_GEOMETRY, string> = {
  airGapMm: "aria",
  axisOffsetMm: "interasse",
  rebateMm: "battuta",
  seatMm: "sede",
};

/**
 * Rifiuta le combinazioni per cui il generatore non ha tabelle. Senza questa
 * guardia l'input veniva accettato e ignorato: un'aria 4 riceveva in silenzio i
 * codici dell'aria 12 — distinta dall'aria perfetta, di un'altra configurazione.
 */
export function assertPilotGeometry(input: KitInput): void {
  const keys = Object.keys(PILOT_GEOMETRY) as (keyof typeof PILOT_GEOMETRY)[];
  const wrong = keys
    .filter((key) => input[key] !== PILOT_GEOMETRY[key])
    .map((key) => `${GEOMETRY_LABELS[key]} ${input[key]}`);
  if (wrong.length > 0)
    throw new KitGenerationError(
      `Configurazione non coperta (${wrong.join(", ")}): il generatore ARTECH copre ` +
        `aria ${PILOT_GEOMETRY.airGapMm} / interasse ${PILOT_GEOMETRY.axisOffsetMm} / ` +
        `battuta ${PILOT_GEOMETRY.rebateMm} / sede ${PILOT_GEOMETRY.seatMm}, ` +
        `l'unica combinazione con distinta verificata a listino.`,
      "artech.geometria",
    );
}
```

Aggiungere `KitGenerationError` all'import esistente da `./types` in testa al file:

```typescript
import { KitGenerationError, PILOT, type KitInput } from "./types";
```

- [ ] **Step 4: Eseguire i test**

Run: `pnpm test src/server/kit/artech-legno-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Chiamare la guardia dai moduli attivi**

In `src/server/kit/rules-artech-legno.ts`, come **prima istruzione** di `generate()`, dopo il controllo del materiale:

```typescript
    assertPilotGeometry(input);
```

e aggiungerla all'import da `./artech-legno-shared`.

Fare lo stesso in `src/server/kit/rules-artech-vasistas-legno.ts`, subito dopo il controllo del materiale, aggiungendo l'import.

- [ ] **Step 6: Suite completa**

Run: `pnpm test`
Expected: PASS. Se un test esistente usa una geometria diversa dal pilota (probabile in `engine.test.ts` o nei test del router), **non** allentare la guardia: allineare l'input del test alla geometria del pilota, che è l'unica supportata.

- [ ] **Step 7: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/kit/artech-legno-shared.ts src/server/kit/artech-legno-shared.test.ts src/server/kit/rules-artech-legno.ts src/server/kit/rules-artech-vasistas-legno.ts
git commit -m "fix(kit): rifiuta le geometrie per cui non esistono tabelle

aria/interasse/battuta/sede erano raccolti dal wizard e validati, ma non
selezionavano alcun codice: le tabelle sono tutte cablate su aria 12 /
interasse 13 / battuta 20 / sede 18. Un agente poteva inserire aria 4 e
ricevere in silenzio i codici dell'aria 12: una distinta dall'aria
perfetta, di un'altra configurazione.

Ora i moduli ARTECH rifiutano e dicono quale combinazione è coperta."
```

---

### Task 5: Vasistas — forbici indicizzate su LBB

Lo schema p0418 (416) pubblica la tabella «Posizionamento forbici» indicizzata sulla **larghezza**; il modulo sceglieva il numero di forbici per altezza/GR. Sul golden attuale (W 600) le due regole coincidono, quindi questo passo è **behavior-preserving** sul golden: cambia il comportamento su tutte le altre larghezze.

**Files:**
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts`
- Modify: `src/server/kit/rules-artech-vasistas-legno.test.ts`

**Interfaces:**
- Produces: costante `VASISTAS_FORBICI` (tabella per LBB) usata dai task 6 e 7

- [ ] **Step 1: Scrivere i test delle quattro bande e dei bordi**

Aggiungere a `src/server/kit/rules-artech-vasistas-legno.test.ts`:

```typescript
describe("artechVasistasLegno — forbici dalla tabella «Posizionamento forbici» p0418 (416)", () => {
  const forbiciAt = (widthMm: number) =>
    artechVasistasLegno
      .generate({ ...golden, widthMm })
      .find((l) => l.position === "forbici-vasistas")?.quantity;

  it("LBB 274-540 → 2 (sui montanti)", () => {
    expect(forbiciAt(300)).toBe(2);
    expect(forbiciAt(540)).toBe(2);
  });

  it("LBB 541-860 → 1 (sul traverso)", () => {
    expect(forbiciAt(541)).toBe(1);
    expect(forbiciAt(600)).toBe(1); // golden
    expect(forbiciAt(860)).toBe(1);
  });

  it("LBB 861-1200 → 3 (1 traverso + 2 montanti)", () => {
    expect(forbiciAt(861)).toBe(3);
    expect(forbiciAt(1200)).toBe(3);
  });

  it("LBB 1201-2510 → 4 (2 traverso + 2 montanti)", () => {
    expect(forbiciAt(1201)).toBe(4);
  });

  it("non dipende più dall'altezza: stessa larghezza, GR diversi, stesse forbici", () => {
    expect(forbiciAt(600)).toBe(
      artechVasistasLegno
        .generate({ ...golden, widthMm: 600, heightMm: 1300 })
        .find((l) => l.position === "forbici-vasistas")?.quantity,
    );
  });

  it("la descrizione cita la banda LBB, non il GR", () => {
    const riga = artechVasistasLegno
      .generate({ ...golden, widthMm: 900 })
      .find((l) => l.position === "forbici-vasistas");
    expect(riga?.ruleDescription).toMatch(/861/);
  });
});
```

**Nota per l'implementatore:** con `widthMm: 1201` e l'altezza del golden (1000) la superficie è 1,20 m², sotto il limite di 2 m²: la guardia non scatta. Non usare larghezze che superino i 2 m² con H 1000 (cioè oltre 2000 mm).

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: FAIL su tutte le larghezze diverse dal golden.

- [ ] **Step 3: Sostituire la selezione delle forbici**

In `src/server/kit/rules-artech-vasistas-legno.ts`, aggiungere la tabella dopo `VASISTAS_CREMONESI`:

```typescript
/**
 * Numero di forbici per banda di LARGHEZZA (LBB), dalla tabella grafica
 * «Posizionamento forbici» stampata sullo schema p0418 (416). Prima il modulo lo
 * derivava dal GR del cremonese, cioè dall'ALTEZZA: sbagliato su ogni larghezza
 * diversa da quella del golden.
 * NB dello schema: «per ragioni di sicurezza le forbici sui montanti sono
 * obbligatorie per LBB compresi tra 861 e 2510 (per HBB > 500 mm)» — è la ragione
 * per cui il conteggio sale a 3 e 4.
 * Articolo unico A50545.00.00 (p0442, «Per Vasistas › per cremonese maniglia
 * variabile»): il listino non distingue le forbici del traverso da quelle dei
 * montanti, cambia solo la posizione di montaggio.
 */
const VASISTAS_FORBICI = [
  { minL: 274, maxL: 540, forbici: 2, posizione: "2 sui montanti" },
  { minL: 541, maxL: 860, forbici: 1, posizione: "1 sul traverso" },
  { minL: 861, maxL: 1200, forbici: 3, posizione: "1 sul traverso + 2 sui montanti" },
  { minL: 1201, maxL: 2510, forbici: 4, posizione: "2 sul traverso + 2 sui montanti" },
] as const;
```

Nel corpo di `generate()`, sostituire `const nForbici = gr.forbici;` con:

```typescript
    const banda = pick(
      VASISTAS_FORBICI,
      input.widthMm,
      "L",
      "artech.forbici",
      "posizionamento forbici vasistas",
    );
    const nForbici = banda.forbici;
```

e la riga delle forbici con:

```typescript
    lines.push({
      position: "forbici-vasistas",
      code: "A50545.00.00",
      quantity: nForbici,
      ruleId: "artech.forbici",
      ruleDescription: `Forbici per vasistas — LBB ${banda.minL}-${banda.maxL}: ${banda.posizione}`,
    });
```

Rimuovere il campo `forbici` da `VASISTAS_CREMONESI` (non più usato) e, dal commento sopra la tabella, la frase sul numero di forbici per GR.

- [ ] **Step 4: Eseguire i test**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: PASS, golden compreso (W 600 → 1 forbice, come prima).

- [ ] **Step 5: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/kit/rules-artech-vasistas-legno.ts src/server/kit/rules-artech-vasistas-legno.test.ts
git commit -m "fix(kit): forbici vasistas dalla tabella per larghezza, non dal GR

Lo schema p0418 (416) pubblica «Posizionamento forbici» indicizzata su
LBB: 274-540 -> 2 sui montanti, 541-860 -> 1 sul traverso, 861-1200 -> 3,
1201-2510 -> 4. Il modulo sceglieva il numero dall'altezza (GR del
cremonese): a 1000 mm di larghezza il listino chiede 3 forbici, il motore
ne dava 1 o 2.

Sul golden (W 600) le due regole coincidono: distinta invariata."
```

---

### Task 6: Vasistas — struttura della distinta secondo lo schema

Via le due righe che lo schema non prevede, dentro le tre famiglie di cerniere e il secondo terminale, e supporto forbice/perno legati alle cerniere portanti.

**Files:**
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts`
- Modify: `src/server/kit/rules-artech-vasistas-legno.test.ts` (golden nuovo)

**Interfaces:**
- Consumes: `VASISTAS_FORBICI` dal task 5
- Produces: posizioni nuove `cerniera-portante`, `articolazione-superiore`, `corpo-articolazione`, `terminale-vasistas-18-18`

- [ ] **Step 1: Riscrivere il golden dalle 13 voci dello schema**

In `src/server/kit/rules-artech-vasistas-legno.test.ts`, sostituire il blocco `GOLDEN` e il suo commento:

```typescript
/**
 * Golden vasistas — TRASCRIZIONE delle 13 voci dello schema di montaggio p0418
 * (416) «Finestra rettangolare legno - apertura vasistas», per la geometria del
 * pilota (aria 12 / interasse 13 / battuta 20 / sede 18) e H 1000 / L 600.
 * 12 righe / 19 pezzi (1+1+1+1 + 2+2 + 2+2 + 2+2+2 + 1).
 *
 * Voci dello schema e loro resa:
 *  1 cremonese A50111.15.NN per GR ....................... cremonese
 *  2 forbici per vasistas (tabella LBB) .................. forbici-vasistas
 *  3 terminale con nottolino corsa 18 .................... terminale-vasistas-18
 *  4 terminale con nottolino corsa 18+18 ................. terminale-vasistas-18-18
 *  5 movimenti angolari per ante rettangolari ............ movimento-angolare
 *  6 limitatore di corsa 18 mm ........................... limitatore-corsa
 *  7 chiusure supplementari › terminale .................. dietro supplementaryClosures (task 7)
 *  8 supporti forbice .................................... supporto-forbice
 *  9 perno per supporto forbice .......................... perno-supporto-forbice
 * 10 centrale registrabile portante e per vasistas ....... cerniera-portante
 * 11 articolazione superiore anta semifissa .............. articolazione-superiore
 * 12 corpo articolazione superiore ....................... corpo-articolazione
 * 13 incontri nottolino .................................. incontri-nottolino
 *
 * NON compaiono nello schema, quindi NON sono nella distinta: DSS A50190.00.00 e
 * incontro DSS A51400.05.03. Erano stati presi da una NB della tabella cremonesi
 * p0424/p0426 scritta per l'uso ANTA-RIBALTA della famiglia condivisa
 * «Anta ribalta/vasistas» — l'NB di p0424 dice infatti «DSS sempre presente su
 * tutti i GR» a proposito dell'anta ribalta.
 */
const GOLDEN: [code: string, qty: number][] = [
  ["A50111.15.13", 1], // 1 cremonese vasistas GR03 (H 1000), p0426 (424)
  ["A50545.00.00", 1], // 2 forbici — LBB 541-860 → 1 sul traverso, p0442 (440)
  ["A50193.00.03", 1], // 3 terminale corsa 18, p0431 (429)
  ["A50193.00.02", 1], // 4 terminale corsa 18+18, p0431 (429)
  ["A50302.01.02", 2], // 5 movimento angolare 125x125, p0435 (433)
  ["A50196.00.18", 2], // 6 limitatore di corsa 18 = n. movimenti angolari
  ["A50702.05.00", 2], // 8 supporto forbice = n. cerniere portanti, p0449 (447)
  ["A50790.00.00", 2], // 9 perno = n. cerniere portanti, p0449 (447)
  ["A51101.36.01", 2], // 10 centrale registrabile portante e per vasistas, p0455 (453)
  ["A51001.36.01", 2], // 11 articolazione superiore anta semifissa DX, p0455 (453)
  ["A51050.16.12", 2], // 12 corpo articolazione superiore, p0454 (452)
  ["A51400.05.02", 1], // 13 incontri nottolino — NOT.(GR03) = 1, p0469 (467)
];
```

Aggiornare la descrizione del `describe` principale a «12 righe / 19 pezzi» e il conteggio atteso (il vecchio era 10 righe / 12 pezzi).

Aggiungere i test sulle novità:

```typescript
describe("artechVasistasLegno — aderenza allo schema p0418 (416)", () => {
  const lines = artechVasistasLegno.generate(golden);

  it("non genera il DSS: lo schema vasistas non lo prevede", () => {
    expect(lines.map((l) => l.code)).not.toContain("A50190.00.00");
  });

  it("non genera l'incontro DSS", () => {
    expect(lines.map((l) => l.code)).not.toContain("A51400.05.03");
  });

  it("genera le tre famiglie di cerniere (voci 10, 11, 12), 2 pezzi ciascuna", () => {
    for (const position of ["cerniera-portante", "articolazione-superiore", "corpo-articolazione"])
      expect(lines.find((l) => l.position === position)?.quantity).toBe(2);
  });

  it("l'articolazione superiore segue la mano", () => {
    const sx = artechVasistasLegno.generate({ ...golden, openingSide: "SINISTRA" });
    expect(sx.find((l) => l.position === "articolazione-superiore")?.code).toBe("A51001.36.02");
  });

  it("la cerniera portante è ambidestra: stesso codice su entrambe le mani", () => {
    const sx = artechVasistasLegno.generate({ ...golden, openingSide: "SINISTRA" });
    expect(sx.find((l) => l.position === "cerniera-portante")?.code).toBe("A51101.36.01");
  });

  it("supporto forbice e perno seguono le cerniere portanti, non le forbici", () => {
    // LBB 900 → 3 forbici, ma le cerniere portanti restano 2
    const largo = artechVasistasLegno.generate({ ...golden, widthMm: 900 });
    expect(largo.find((l) => l.position === "forbici-vasistas")?.quantity).toBe(3);
    expect(largo.find((l) => l.position === "supporto-forbice")?.quantity).toBe(2);
    expect(largo.find((l) => l.position === "perno-supporto-forbice")?.quantity).toBe(2);
  });

  it("genera entrambi i terminali (voci 3 e 4)", () => {
    expect(lines.find((l) => l.position === "terminale-vasistas-18")?.code).toBe("A50193.00.03");
    expect(lines.find((l) => l.position === "terminale-vasistas-18-18")?.code).toBe(
      "A50193.00.02",
    );
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: FAIL — DSS ancora presente, cerniere assenti.

- [ ] **Step 3: Implementare**

In `src/server/kit/rules-artech-vasistas-legno.ts`:

Aggiungere le costanti dopo `VASISTAS_FORBICI`:

```typescript
/**
 * Cerniere dello schema p0418 (416), voci 10-11-12, per la geometria del pilota
 * (interasse 13 / battuta 20 → suffisso .36). Quantità 2: nel disegno ogni
 * famiglia compare una volta per montante.
 *
 * ASSUNZIONE su tutte e tre: il listino offre per ciascuna una variante «base» e
 * una alternativa che lo schema non discrimina —
 *   · voce 10: A51101.36.01 «regolabile in 2 dimensioni» (scelta) vs A51102.36.02
 *     «con compensatore 16/12, regolabile in 3 dimensioni», p0455 (453);
 *   · voce 11: A51001.36.NN (scelta) vs A51002.36.NN «con canale 16/12», p0454-0455;
 *   · voce 12: A51050.16.12 (scelta) vs A51051.16.12 «solo lato traverso superiore».
 * Domanda 5 per l'esperto in docs/superpowers/kit-assunzioni/vasistas.md.
 *
 * NB: la voce 10 è l'unica famiglia che il listino chiama esplicitamente «e PER
 * VASISTAS» — conferma che la scelta di famiglia è corretta.
 */
const CERNIERA_PORTANTE = "A51101.36.01"; // ambidestra: il listino non dà varianti di mano
const CORPO_ARTICOLAZIONE = "A51050.16.12";
const ARTICOLAZIONE_SUPERIORE: Record<KitInput["openingSide"], string> = {
  DESTRA: "A51001.36.01",
  SINISTRA: "A51001.36.02",
};

/** Cerniere portanti dello schema: 2, una per montante. */
const N_CERNIERE_PORTANTI = 2;
```

Rimuovere il blocco che genera DSS e incontro DSS (le due `lines.push` con `A50190.00.00` e `A51400.05.03`).

Sostituire il blocco supporto forbice/perno perché segua le cerniere:

```typescript
    // 8-9) Supporto forbice + perno: nel disegno stanno sotto le CERNIERE
    // portanti, non sotto le forbici (prima erano legati a n. forbici).
    lines.push(
      {
        position: "supporto-forbice",
        code: "A50702.05.00",
        quantity: N_CERNIERE_PORTANTI,
        ruleId: "artech.cerniere",
        ruleDescription: `Supporto forbice legno battuta ${input.rebateMm} = n. cerniere portanti`,
      },
      {
        position: "perno-supporto-forbice",
        code: "A50790.00.00",
        quantity: N_CERNIERE_PORTANTI,
        ruleId: "artech.cerniere",
        ruleDescription: "Perno per supporto forbice = n. cerniere portanti",
      },
    );
```

Aggiungere le tre cerniere:

```typescript
    // 10-11-12) Cerniere dello schema: portante + articolazione superiore + corpo.
    lines.push(
      {
        position: "cerniera-portante",
        code: CERNIERA_PORTANTE,
        quantity: N_CERNIERE_PORTANTI,
        ruleId: "artech.cerniere",
        ruleDescription: "Cerniera centrale registrabile portante e per vasistas (ambidestra)",
      },
      {
        position: "articolazione-superiore",
        code: ARTICOLAZIONE_SUPERIORE[input.openingSide],
        quantity: N_CERNIERE_PORTANTI,
        ruleId: "artech.cerniere",
        ruleDescription: `Articolazione superiore anta semifissa ${input.openingSide}`,
      },
      {
        position: "corpo-articolazione",
        code: CORPO_ARTICOLAZIONE,
        quantity: N_CERNIERE_PORTANTI,
        ruleId: "artech.cerniere",
        ruleDescription: "Corpo articolazione superiore",
      },
    );
```

Rinominare la posizione del terminale esistente in `terminale-vasistas-18` e aggiungere il secondo:

```typescript
    // 3-4) I due terminali per vasistas alle estremità opposte del traverso.
    lines.push(
      {
        position: "terminale-vasistas-18",
        code: "A50193.00.03",
        quantity: 1,
        ruleId: "artech.terminale",
        ruleDescription: "Terminale per vasistas con nottolino corsa 18",
      },
      {
        position: "terminale-vasistas-18-18",
        code: "A50193.00.02",
        quantity: 1,
        ruleId: "artech.terminale",
        ruleDescription: "Terminale per vasistas con nottolino corsa 18+18",
      },
    );
```

Aggiornare l'intestazione del file: la fonte è lo schema **p0418 (416)**, non «pag.416», ed è una trascrizione. Segnalare la trappola di numerazione (la fisica 416 è il battente).

- [ ] **Step 4: Eseguire i test**

Run: `pnpm test src/server/kit/rules-artech-vasistas-legno.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pnpm typecheck && pnpm lint
git add src/server/kit/rules-artech-vasistas-legno.ts src/server/kit/rules-artech-vasistas-legno.test.ts
git commit -m "fix(kit): vasistas trascritto dallo schema p0418, con le sue cerniere

- via DSS A50190.00.00 e incontro DSS A51400.05.03: le 13 voci dello
  schema vasistas non li contengono. Erano presi da una NB della tabella
  cremonesi scritta per l'uso ANTA-RIBALTA della famiglia condivisa.
- dentro le voci 10-11-12, cioè tutte le cerniere: senza di esse l'anta
  non era appesa. Centrale registrabile portante A51101.36.01 (il listino
  la chiama «e per vasistas»), articolazione superiore A51001.36.0N per
  mano, corpo articolazione A51050.16.12.
- dentro il secondo terminale (voce 4, corsa 18+18).
- supporto forbice e perno legati alle cerniere portanti, non al numero
  di forbici: nel disegno stanno sotto le cerniere."
```

---

### Task 7: Vasistas — peso dell'anta e chiusure sui montanti

Due NB dello schema dipendono dal peso: «con ante di peso compreso tra i 70 e gli 80 kg (max) aggiungere la cerniera al centro ⑩» e «la portata massima per le forbici di sicurezza è di 40 kg cadauna». Il motore non ha il peso: si aggiunge **opzionale**, così nessun `KitInput` esistente si rompe.

**Files:**
- Modify: `src/server/kit/types.ts`
- Modify: `src/server/kit/types.test.ts`
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts`
- Modify: `src/server/kit/rules-artech-vasistas-legno.test.ts`

**Interfaces:**
- Produces: `KitInput.sashWeightKg?: number` (intero, 1-200)

- [ ] **Step 1: Scrivere i test**

In `src/server/kit/types.test.ts` aggiungere:

```typescript
it("sashWeightKg è opzionale e non rompe gli input esistenti", () => {
  const senza = kitInputSchema.safeParse(validInput);
  expect(senza.success).toBe(true);
  const con = kitInputSchema.safeParse({ ...validInput, sashWeightKg: 75 });
  expect(con.success).toBe(true);
});

it("sashWeightKg rifiuta valori fuori scala", () => {
  expect(kitInputSchema.safeParse({ ...validInput, sashWeightKg: 0 }).success).toBe(false);
  expect(kitInputSchema.safeParse({ ...validInput, sashWeightKg: 250 }).success).toBe(false);
});
```

(usare il nome dell'input valido già presente nel file al posto di `validInput` se diverso)

In `rules-artech-vasistas-legno.test.ts` aggiungere:

```typescript
describe("artechVasistasLegno — peso dell'anta (NB dello schema p0418)", () => {
  it("senza peso: 2 cerniere portanti e nessun rifiuto", () => {
    const lines = artechVasistasLegno.generate(golden);
    expect(lines.find((l) => l.position === "cerniera-portante")?.quantity).toBe(2);
  });

  it("fra 70 e 80 kg: terza cerniera al centro, con supporto e perno", () => {
    const lines = artechVasistasLegno.generate({ ...golden, sashWeightKg: 75 });
    expect(lines.find((l) => l.position === "cerniera-portante")?.quantity).toBe(3);
    expect(lines.find((l) => l.position === "supporto-forbice")?.quantity).toBe(3);
    expect(lines.find((l) => l.position === "perno-supporto-forbice")?.quantity).toBe(3);
  });

  it("sotto i 70 kg: restano 2 cerniere", () => {
    const lines = artechVasistasLegno.generate({ ...golden, sashWeightKg: 60 });
    expect(lines.find((l) => l.position === "cerniera-portante")?.quantity).toBe(2);
  });

  it("oltre 80 kg: rifiuta (fuori campo di applicazione)", () => {
    expect(() => artechVasistasLegno.generate({ ...golden, sashWeightKg: 85 })).toThrow(
      KitGenerationError,
    );
  });

  it("rifiuta se il peso supera la portata delle forbici (40 kg cadauna)", () => {
    // L 600 → 1 forbice → portata 40 kg; 50 kg non è sostenibile
    expect(() => artechVasistasLegno.generate({ ...golden, sashWeightKg: 50 })).toThrow(/40 kg/);
  });

  it("con più forbici la stessa anta è ammessa", () => {
    // L 900 → 3 forbici → portata 120 kg
    expect(() =>
      artechVasistasLegno.generate({ ...golden, widthMm: 900, sashWeightKg: 50 }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm test src/server/kit`
Expected: FAIL — `sashWeightKg` non esiste nello schema.

- [ ] **Step 3: Aggiungere il campo allo schema**

In `src/server/kit/types.ts`, dentro `kitInputSchema`, dopo `supplementaryClosures`:

```typescript
  // Peso dell'anta in kg. OPZIONALE come supplementaryClosures (e per lo stesso
  // motivo: con .default() zod renderebbe il campo obbligatorio nel tipo di
  // output e romperebbe ogni KitInput letterale esistente). Serve alle due NB
  // dello schema vasistas p0418 (416): terza cerniera fra 70 e 80 kg, portata
  // massima 40 kg per forbice. Quando è assente il modulo assume «sotto i 70 kg»
  // e lo dichiara nella riga di distinta.
  sashWeightKg: z.number().int().min(1).max(200).optional(),
```

- [ ] **Step 4: Implementare le due regole**

In `rules-artech-vasistas-legno.ts`, dopo il calcolo di `nForbici`:

```typescript
    // NB dello schema: «la portata massima per le forbici di sicurezza è di 40 kg
    // cadauna». Verificabile solo se l'agente ha indicato il peso.
    const PORTATA_FORBICE_KG = 40;
    if (input.sashWeightKg !== undefined && input.sashWeightKg > nForbici * PORTATA_FORBICE_KG)
      throw new KitGenerationError(
        `Anta da ${input.sashWeightKg} kg oltre la portata delle forbici: ${nForbici} × ${PORTATA_FORBICE_KG} kg = ` +
          `${nForbici * PORTATA_FORBICE_KG} kg massimi per una larghezza di ${input.widthMm} mm.`,
        "artech.forbici",
      );

    // NB dello schema: «con ante di peso compreso tra i 70 e gli 80 kg (max)
    // aggiungere la cerniera al centro ⑩». Oltre gli 80 kg si è fuori campo.
    const PESO_MAX_KG = 80;
    const PESO_TERZA_CERNIERA_KG = 70;
    if (input.sashWeightKg !== undefined && input.sashWeightKg > PESO_MAX_KG)
      throw new KitGenerationError(
        `Anta da ${input.sashWeightKg} kg oltre il massimo di ${PESO_MAX_KG} kg previsto dallo schema vasistas.`,
        "artech.peso",
      );
    const nCerniere =
      input.sashWeightKg !== undefined && input.sashWeightKg >= PESO_TERZA_CERNIERA_KG
        ? N_CERNIERE_PORTANTI + 1
        : N_CERNIERE_PORTANTI;
```

Sostituire ogni uso di `N_CERNIERE_PORTANTI` nelle `lines.push` con `nCerniere`, e nella `ruleDescription` della cerniera portante rendere esplicita l'assunzione quando il peso manca:

```typescript
        ruleDescription:
          input.sashWeightKg === undefined
            ? "Cerniera centrale registrabile portante e per vasistas (ambidestra) — 2 pezzi, valido per ante fino a 70 kg"
            : `Cerniera centrale registrabile portante e per vasistas (ambidestra) — ${nCerniere} pezzi per un'anta da ${input.sashWeightKg} kg`,
```

- [ ] **Step 5: Eseguire i test**

Run: `pnpm test src/server/kit`
Expected: PASS.

- [ ] **Step 6: Esporre il peso nel wizard**

In `nuova-client.tsx`, allo step «Dimensioni», aggiungere un campo numerico **facoltativo** «Peso anta (kg)» con testo di aiuto «Facoltativo — serve a verificare la portata delle forbici e a stabilire se occorre la terza cerniera». Seguire il markup e le classi degli input di larghezza/altezza già presenti; il campo deve stare nella stessa griglia responsive (nessuna colonna fissa aggiuntiva a 375px). Aggiungere `sashWeightKg` allo `STEP2_SCHEMA` se lo step valida per `pick`, mantenendolo opzionale, e mappare il campo vuoto a `undefined` (non a `0`, che lo schema rifiuterebbe).

- [ ] **Step 7: Verifica browser a 375px e desktop**

Aprire il wizard, step Dimensioni: il nuovo campo non deve rompere la griglia a 375px, il testo di aiuto deve andare a capo senza overflow orizzontale. Provare un peso di 50 kg su un'anta da 600 mm e verificare che l'errore mostrato sia il messaggio in italiano sulla portata.

- [ ] **Step 8: Gate + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/kit/types.ts src/server/kit/types.test.ts src/server/kit/rules-artech-vasistas-legno.ts src/server/kit/rules-artech-vasistas-legno.test.ts "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "feat(kit): peso anta opzionale per le due NB dello schema vasistas

Lo schema p0418 (416) condiziona al peso la terza cerniera centrale
(70-80 kg) e la portata delle forbici (40 kg cadauna). Il campo è
opzionale: se assente il modulo genera 2 cerniere e lo dichiara nella
riga; se presente applica entrambe le regole e rifiuta fuori campo."
```

---

### Task 8: Documentazione

Le schede di `kit-assunzioni/` sono scritte come liste di domande che **presuppongono** che i codici esistano. Dopo la verifica vanno riscritte come esito, con le domande residue in fondo.

**Files:**
- Modify: `docs/superpowers/kit-assunzioni/pvc.md`
- Modify: `docs/superpowers/kit-assunzioni/battente.md`
- Modify: `docs/superpowers/kit-assunzioni/vasistas.md`
- Create: `docs/superpowers/kit-assunzioni/legno.md`
- Modify: `handoff.md`
- Modify: `CLAUDE.md` (sezione STATO)

- [ ] **Step 1: Riscrivere `pvc.md`**

Sostituire le domande con: l'esito della verifica (la tabella codice → esito della spec), la conclusione che il modulo è disattivato, e **una sola** domanda residua: ottenere il «listino PVC e ALLUMINIO». Le domande 1-6 attuali vanno rimosse: presuppongono che i codici siano acquistabili.

- [ ] **Step 2: Aggiornare `battente.md`**

In testa: stato DISATTIVATO e perché (distinta priva della sospensione superiore, schema composito). Promuovere a domanda 1 la terna di cerniere. Registrare che `BATTENTE_CREMONESI` è verificata contro p0429 (427) e non va rifatta.

- [ ] **Step 3: Aggiornare `vasistas.md`**

Segnare come **risolte dal listino** le domande V1 (offset HBB: bande verificate a p0426), V2 (il DSS non appartiene allo schema), V5 (incontri dalla colonna NOT.), V6 (le forbici dipendono da LBB, tabella trascritta) e V7. Restano aperte: la scelta fra le varianti delle tre cerniere, la lunghezza del terminale sui montanti, il GR00.

- [ ] **Step 4: Creare `legno.md`**

Nuova scheda per l'anta-ribalta, che finora non ne aveva: la correzione del supporto cerniera (fatta), la squadra angolare A50904 vs A50901 (conservata, domanda aperta), la formula degli incontri vs somma NOT. (conservata, domanda aperta), la sede 18 vs 30, l'intervallo HBB 357-609 scoperto.

- [ ] **Step 5: Aggiornare `handoff.md` e `CLAUDE.md`**

In `handoff.md`: sezione della sessione con cosa è stato verificato, cosa disattivato, le azioni ops (`db:seed:kit` su Neon; audit di `kit_requests`) e il difetto collaterale `dedupeRows`.

In `CLAUDE.md`, sezione STATO: aggiornare la copertura del kit engine — da «3 tipologie» a «1 tipologia attiva (anta-ribalta legno) + vasistas riscritto; battente e PVC disattivati in attesa di dati».

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/kit-assunzioni/ handoff.md CLAUDE.md
git commit -m "docs(kit): schede assunzioni riscritte come esito della verifica

Le schede erano liste di domande che presupponevano l'esistenza dei
codici. Ora riportano cosa il listino ha confermato, cosa ha smentito e
le sole domande residue per AGB."
```

---

## Verifica finale

- [ ] `pnpm typecheck` pulito
- [ ] `pnpm lint` pulito
- [ ] `pnpm test` verde (il conteggio sale: ~15 test nuovi)
- [ ] `pnpm build` riuscita
- [ ] Wizard verificato a 375px e desktop: tipologie disponibili = anta-ribalta e vasistas; battente e PVC mostrano *perché* non sono disponibili
- [ ] Nessuna migrazione Prisma creata
- [ ] Azioni ops annotate nella PR: `pnpm db:seed:kit` su Neon (obbligatoria: è ciò che disattiva davvero i template) e audit di `kit_requests`
