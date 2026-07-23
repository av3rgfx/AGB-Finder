# Fase 1i — Kit Vasistas ARTECH legno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere la tipologia `VASISTAS` (ARTECH, LEGNO, anta singola, base) al kit engine deterministico come distinta provvisoria derivata dal listino 2026.

**Architecture:** Nuovo `RuleModule` isolato `rules-artech-vasistas-legno.ts` (Opzione C, come il battente), registrato nel registry e seedato come template `isActive:true` PROVVISORIO. Riusa gli helper `pick`/`linesFromParts` (kit-shared) e il codice `MOVIMENTO_ANGOLARE` (artech-legno-shared). Nessuna modifica a `engine.ts` (già generico su `windowType`). Nessuna migrazione (l'enum Postgres ha già `VASISTAS`).

**Tech Stack:** TypeScript strict, Vitest, Prisma, Next.js 15 (wizard client), tRPC (invariato).

## Global Constraints

- **Deterministico, MAI LLM.** Ogni codice/quantità deriva dal listino; ogni voce non certa è marcata `// ASSUNZIONE`.
- **TypeScript strict** sempre.
- **Behavior-preserving:** i golden esistenti (anta-ribalta LEGNO, battente) devono restare **verdi**; `artech-legno-shared.ts` NON va modificato.
- **Nessuna migrazione:** l'enum Postgres `WindowType` contiene già `VASISTAS` (init `20260701064610`).
- **PROVVISORIO:** template `isActive:true` con nota PROVVISORIO nel nome/descrizione; 9 assunzioni aperte per l'esperto (spec §Assunzioni aperte).
- **Scope:** solo LEGNO, anta singola, entrata E.15, variante base pag. 416, campo GR01–GR06 (HBB 540–2510), superficie ≤ 2 m².
- **UI in italiano**, codici prodotto in monospace (già gestito dai componenti esistenti).
- **Gate finali:** `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- **Ambiente:** prima dei comandi tsx/prisma fare `set -a; source .env; set +a` (engine Prisma). Per i soli test Vitest non serve.

---

### Task 1: Modulo regole vasistas + enum + golden test

Il cuore deterministico. Amplia l'enum `windowType` (serve per scrivere la config di test) e crea il modulo regole con la sua suite golden.

**Files:**
- Modify: `src/server/kit/types.ts` (riga 9: enum `windowType`)
- Create: `src/server/kit/rules-artech-vasistas-legno.ts`
- Test: `src/server/kit/rules-artech-vasistas-legno.test.ts`

**Interfaces:**
- Consumes: `pick`, `linesFromParts` da `./kit-shared`; `MOVIMENTO_ANGOLARE` da `./artech-legno-shared`; `KitGenerationError`, `type KitInput`, `type KitLine`, `type RuleModule` da `./types`.
- Produces: `export const artechVasistasLegno: RuleModule` con `engineId = "artech-vasistas-legno"` (usato da Task 2 registry e Task 3 seed).

- [ ] **Step 1: Amplia l'enum `windowType` in `types.ts`**

In `src/server/kit/types.ts`, riga 9, sostituisci:

```typescript
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE"]),
```

con:

```typescript
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE", "VASISTAS"]),
```

- [ ] **Step 2: Aggiorna il commento di contesto sopra lo schema (riga ~5-7)**

Sostituisci il commento `// Fase 1h: windowType = ANTA_RIBALTA + ANTA_BATTENTE ...` con:

```typescript
 * Fase 1i: windowType = ANTA_RIBALTA + ANTA_BATTENTE + VASISTAS (serie ARTECH);
 * i letterali si allargano con le tipologie/serie future.
```

- [ ] **Step 3: Scrivi il test golden (fallisce: modulo inesistente)**

Crea `src/server/kit/rules-artech-vasistas-legno.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechVasistasLegno } from "./rules-artech-vasistas-legno";

/**
 * Golden PROVVISORIO (Fase 1i): distinta vasistas ARTECH legno anta singola,
 * base pag.416, derivata dal listino 2026. NON validata da un esperto — vedi
 * docs/superpowers/kit-assunzioni/vasistas.md. Config GR03 (H1000, non ambigua).
 */
const golden: KitInput = {
  windowType: "VASISTAS",
  widthMm: 600,
  heightMm: 1000, // → GR03 (820-1220): 1 forbice, 1 nottolino
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

// 10 righe / 12 pezzi. Cremonese vasistas + catena DSS + forbici (1) + supporto/
// perno (1) + terminale + movimento angolare (2) + limitatore (2) + incontri (1).
const GOLDEN: [code: string, qty: number][] = [
  ["A50111.15.13", 1], // cremonese vasistas GR03 (altezza 1000)
  ["A50190.00.00", 1], // DSS ambidestro (ASSUNZIONE: A50111 lo richiede a parte)
  ["A51400.05.03", 1], // incontro DSS
  ["A50545.00.00", 1], // forbici per vasistas (GR03 → 1)
  ["A50702.05.00", 1], // supporto forbice battuta 20 (= n. forbici)
  ["A50790.00.00", 1], // perno supporto forbice (= n. forbici)
  ["A50193.00.03", 1], // terminale per vasistas corsa 18 (ASSUNZIONE)
  ["A50302.01.02", 2], // movimento angolare 125x125 (codice condiviso, qty 2)
  ["A50196.00.18", 2], // limitatore di corsa 18 (= n. movimenti angolari)
  ["A51400.05.02", 1], // incontri nottolino — NOT.(GR03) = 1
];

describe("artechVasistasLegno — golden provvisorio (da validare con agente)", () => {
  it("genera la distinta vasistas: 10 righe / 12 pezzi (GR03)", () => {
    const lines = artechVasistasLegno.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(10);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(12);
  });

  it("include la catena DSS (A50190.00.00 + incontro A51400.05.03) — a differenza del battente", () => {
    const codes = artechVasistasLegno.generate(golden).map((l) => l.code);
    expect(codes).toContain("A50190.00.00");
    expect(codes).toContain("A51400.05.03");
  });

  it("NON usa il meccanismo forbice/cerniere dell'anta-ribalta (A50510, A50904, A50801)", () => {
    const codes = artechVasistasLegno.generate(golden).map((l) => l.code);
    for (const c of ["A50510.00.03", "A50904.36.01", "A50801.01.01"])
      expect(codes).not.toContain(c);
  });

  it("forbici/supporto/perno scalano col GR: GR03 → 1, GR05 (H1800) → 2", () => {
    const qty = (input: KitInput, code: string) =>
      artechVasistasLegno.generate(input).find((l) => l.code === code)?.quantity ?? 0;
    for (const code of ["A50545.00.00", "A50702.05.00", "A50790.00.00"]) {
      expect(qty(golden, code)).toBe(1);
      expect(qty({ ...golden, heightMm: 1800 }, code)).toBe(2); // H1800 → GR05
    }
  });

  it("incontri nottolino = colonna NOT.(GR): GR03→1, GR05→2, GR06→4, GR01→assente", () => {
    const incontri = (h: number) =>
      artechVasistasLegno
        .generate({ ...golden, heightMm: h })
        .find((l) => l.code === "A51400.05.02")?.quantity ?? 0;
    expect(incontri(1000)).toBe(1); // GR03
    expect(incontri(1800)).toBe(2); // GR05
    expect(incontri(2400)).toBe(4); // GR06
    expect(incontri(600)).toBe(0); // GR01 (NOT.=0 → nessuna riga incontri)
  });

  it("ogni riga è tipata (position, ruleId artech.*, ruleDescription)", () => {
    for (const line of artechVasistasLegno.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it("materiale ≠ LEGNO → KitGenerationError (solo LEGNO per la vasistas)", () => {
    for (const material of ["PVC", "ALLUMINIO"] as const)
      expect(() => artechVasistasLegno.generate({ ...golden, material })).toThrow(
        KitGenerationError,
      );
  });

  it("superficie > 2 m² → KitGenerationError (artech.superficie)", () => {
    try {
      artechVasistasLegno.generate({ ...golden, widthMm: 1500, heightMm: 1500 }); // 2.25 m²
      expect.unreachable("attesa superficie fuori limite");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.superficie");
    }
  });

  it("altezza fuori campo GR (3000 e 500) → KitGenerationError tipato (artech.cremonese)", () => {
    for (const heightMm of [3000, 500]) {
      try {
        artechVasistasLegno.generate({ ...golden, heightMm });
        expect.unreachable("attesa cremonese fuori campo");
      } catch (err) {
        expect(err).toBeInstanceOf(KitGenerationError);
        expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
      }
    }
  });
});
```

- [ ] **Step 4: Esegui il test — deve fallire (modulo assente)**

Run: `pnpm test -- rules-artech-vasistas-legno`
Expected: FAIL — «Failed to resolve import "./rules-artech-vasistas-legno"» / modulo non trovato.

- [ ] **Step 5: Implementa il modulo regole**

Crea `src/server/kit/rules-artech-vasistas-legno.ts`:

```typescript
// Regole kit ARTECH «vasistas» LEGNO — Fase 1i.
// PROVVISORIO (da validare con l'agente): distinta derivata dallo schema di
// montaggio del listino 2026 (pag.416, «Finestra rettangolare legno - apertura
// vasistas»), anta singola, entrata E.15, variante base. Le voci non derivabili
// con certezza sono marcate ASSUNZIONE. Vedi
// docs/superpowers/kit-assunzioni/vasistas.md.
import { pick } from "./kit-shared";
import { MOVIMENTO_ANGOLARE } from "./artech-legno-shared";
import { KitGenerationError, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese vasistas «maniglia variabile/centrale» A50111.15.NN (E.15) per GR,
 * GR scelto per altezza (HBB). Colonne dalla tabella listino (righe 19552-19558):
 * codice + nForbici (NB 19566-19567: GR1-3→1, GR4-6→2) + nNottolini (colonna
 * NOT.). Campo pilota GR01-GR06 (HBB 540-2510); GR00 escluso (n° forbici non
 * definito a listino). ASSUNZIONE: HBB = heightMm (offset 0, come il battente;
 * l'anta-ribalta usa -10). I bordi sovrapposti si risolvono con lo span più
 * stretto in pick() (= GR più basso).
 */
const VASISTAS_CREMONESI = [
  { minH: 540, maxH: 712, gr: 1, code: "A50111.15.11", forbici: 1, nottolini: 0 },
  { minH: 660, maxH: 860, gr: 2, code: "A50111.15.12", forbici: 1, nottolini: 1 },
  { minH: 820, maxH: 1220, gr: 3, code: "A50111.15.13", forbici: 1, nottolini: 1 },
  { minH: 1190, maxH: 1610, gr: 4, code: "A50111.15.14", forbici: 2, nottolini: 2 },
  { minH: 1590, maxH: 2010, gr: 5, code: "A50111.15.15", forbici: 2, nottolini: 2 },
  { minH: 1890, maxH: 2510, gr: 6, code: "A50111.15.16", forbici: 2, nottolini: 4 },
] as const;

/** Movimenti angolari per il vasistas base (ASSUNZIONE: 2, come i moduli gemelli). */
const N_MOVIMENTI = 2;

export const artechVasistasLegno: RuleModule = {
  engineId: "artech-vasistas-legno",
  generate(input: KitInput): KitLine[] {
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto per la vasistas: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    // Guardia superficie ≤ 2 m² (limite stampato sullo schema pag.416).
    const areaM2 = (input.widthMm * input.heightMm) / 1_000_000;
    if (areaM2 > 2)
      throw new KitGenerationError(
        `Superficie ${areaM2.toFixed(2)} m² oltre il massimo di 2 m² per la vasistas.`,
        "artech.superficie",
      );

    const gr = pick(VASISTAS_CREMONESI, input.heightMm, "H", "artech.cremonese", "cremonese vasistas");
    const nForbici = gr.forbici;
    const lines: KitLine[] = [];

    // 1) Cremonese vasistas (maniglia variabile) — per GR/altezza.
    lines.push({
      position: "cremonese",
      code: gr.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese vasistas maniglia variabile GR0${gr.gr} per altezza ${input.heightMm} mm`,
    });

    // 2-3) Catena DSS (ASSUNZIONE): A50111 richiede il DSS ordinato a parte + il suo incontro.
    lines.push(
      {
        position: "dss",
        code: "A50190.00.00",
        quantity: 1,
        ruleId: "artech.dss",
        ruleDescription: "DSS ambidestro (ASSUNZIONE: A50111 richiede il DSS ordinato a parte, NB listino 19565)",
      },
      {
        position: "incontro-dss",
        code: "A51400.05.03",
        quantity: 1,
        ruleId: "artech.dss",
        ruleDescription: "Incontro DSS aria 12 (ASSUNZIONE: come anta-ribalta)",
      },
    );

    // 4) Forbici per vasistas (E.15: GR1-3→1, GR4-6→2).
    lines.push({
      position: "forbici-vasistas",
      code: "A50545.00.00",
      quantity: nForbici,
      ruleId: "artech.forbici",
      ruleDescription: `Forbici per vasistas (GR0${gr.gr} → ${nForbici})`,
    });

    // 5-6) Supporto forbice + perno (codici legno condivisi) — uno per forbice.
    lines.push(
      {
        position: "supporto-forbice",
        code: "A50702.05.00",
        quantity: nForbici,
        ruleId: "artech.forbici",
        ruleDescription: "Supporto forbice legno battuta 20 = n. forbici (ASSUNZIONE battuta)",
      },
      {
        position: "perno-supporto-forbice",
        code: "A50790.00.00",
        quantity: nForbici,
        ruleId: "artech.forbici",
        ruleDescription: "Perno per supporto forbice = n. forbici",
      },
    );

    // 7) Terminale per vasistas (ASSUNZIONE: 1 × corsa 18).
    lines.push({
      position: "terminale-vasistas",
      code: "A50193.00.03",
      quantity: 1,
      ruleId: "artech.terminale",
      ruleDescription: "Terminale per vasistas corsa 18 (ASSUNZIONE quantità/corsa)",
    });

    // 8) Movimento angolare (codice condiviso A50302.01.02, quantità propria) +
    // 9) limitatore di corsa 18 mm (= n. movimenti angolari).
    lines.push(
      {
        position: MOVIMENTO_ANGOLARE.position,
        code: MOVIMENTO_ANGOLARE.code,
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: MOVIMENTO_ANGOLARE.descr,
      },
      {
        position: "limitatore-corsa",
        code: "A50196.00.18",
        quantity: N_MOVIMENTI,
        ruleId: "artech.fissi",
        ruleDescription: "Limitatore di corsa 18 mm = n. movimenti angolari (ASSUNZIONE)",
      },
    );

    // 10) Incontri nottolino — quantità = colonna NOT.(GR) del cremonese (ASSUNZIONE).
    if (gr.nottolini > 0)
      lines.push({
        position: "incontri-nottolino",
        code: "A51400.05.02",
        quantity: gr.nottolini,
        ruleId: "artech.incontri",
        ruleDescription: `Incontri nottolino aria 12 (NOT. GR0${gr.gr} = ${gr.nottolini})`,
      });

    return lines;
  },
};
```

- [ ] **Step 6: Esegui il test — deve passare**

Run: `pnpm test -- rules-artech-vasistas-legno`
Expected: PASS (9 test verdi).

- [ ] **Step 7: Verifica non-regressione (golden gemelli invariati)**

Run: `pnpm test -- rules-artech`
Expected: PASS — i golden anta-ribalta/battente/PVC/alu restano verdi (nessun modulo gemello toccato).

- [ ] **Step 8: Commit**

```bash
git add src/server/kit/types.ts src/server/kit/rules-artech-vasistas-legno.ts src/server/kit/rules-artech-vasistas-legno.test.ts
git commit -m "feat(kit): modulo regole vasistas ARTECH legno (provvisorio) + enum windowType"
```

---

### Task 2: Registrazione nel registry

Il registry mappa `engineId → RuleModule`. Senza registrazione, l'engine non risolve il template vasistas.

**Files:**
- Modify: `src/server/kit/registry.ts` (import + `RULE_MODULES`)
- Test: `src/server/kit/registry.test.ts`

**Interfaces:**
- Consumes: `artechVasistasLegno` da `./rules-artech-vasistas-legno` (Task 1).
- Produces: entry `"artech-vasistas-legno"` in `RULE_MODULES`, risolvibile via `resolveRuleModule({ engine: "artech-vasistas-legno", version: 1 })`.

- [ ] **Step 1: Aggiungi il test di risoluzione (fallisce)**

In `src/server/kit/registry.test.ts`, dentro il `describe` esistente, aggiungi:

```typescript
  it("risolve il modulo vasistas legno", () => {
    const m = resolveRuleModule({ engine: "artech-vasistas-legno", version: 1 });
    expect(m.engineId).toBe("artech-vasistas-legno");
  });
```

(Se `resolveRuleModule` non è già importato nel file di test, aggiungilo all'import esistente da `./registry`.)

- [ ] **Step 2: Esegui il test — deve fallire**

Run: `pnpm test -- registry`
Expected: FAIL — «Nessun modulo regole registrato per engine "artech-vasistas-legno"».

- [ ] **Step 3: Registra il modulo**

In `src/server/kit/registry.ts`, aggiungi l'import dopo la riga 6:

```typescript
import { artechVasistasLegno } from "./rules-artech-vasistas-legno";
```

e la entry in `RULE_MODULES` (dopo la riga `artechAntaBattenteLegno.engineId`):

```typescript
  [artechVasistasLegno.engineId]: artechVasistasLegno,
```

- [ ] **Step 4: Esegui il test — deve passare**

Run: `pnpm test -- registry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/registry.ts src/server/kit/registry.test.ts
git commit -m "feat(kit): registra il modulo vasistas legno nel registry"
```

---

### Task 3: Template seed vasistas

Il KitEngine seleziona il template da DB per `windowType` + `material`. Serve un template attivo che punti all'engine vasistas.

**Files:**
- Modify: `prisma/seed-kit.ts` (array `TEMPLATES`)

**Interfaces:**
- Consumes: engine id `"artech-vasistas-legno"` (Task 2).
- Produces: `KitTemplate` `{ windowType: "VASISTAS", material: "LEGNO", rules: { engine: "artech-vasistas-legno", version: 1 }, isActive: true }`.

- [ ] **Step 1: Aggiungi il template all'array `TEMPLATES`**

In `prisma/seed-kit.ts`, dopo l'oggetto del template battente (che termina alla riga ~62, prima della `]` di chiusura dell'array), aggiungi:

```typescript
  {
    name: "ARTECH vasistas legno",
    description:
      "Fase 1i — finestra vasistas (apertura a ribalta pura) anta singola legno (PROVVISORIO, da validare con l'agente): cremonese A50111.15 per GR + catena DSS A50190/A51400.05.03 + forbici A50545 + incontri via colonna NOT.(GR), variante base pag.416.",
    windowType: "VASISTAS",
    material: "LEGNO",
    rules: { engine: "artech-vasistas-legno", version: 1 },
    priority: 10,
    isActive: true,
  },
```

- [ ] **Step 2: Verifica typecheck (seed usa i tipi Prisma `WindowType`/`MaterialType`)**

Run: `pnpm typecheck`
Expected: PASS — `"VASISTAS"` è un valore valido di `WindowType` (enum già a schema).

- [ ] **Step 3: Commit**

```bash
git add prisma/seed-kit.ts
git commit -m "feat(kit): seed template vasistas legno (provvisorio, isActive)"
```

> **Nota deploy (non in questo piano):** al deploy va rilanciato `db:seed:kit` su Neon per inserire il template (nessuna migrazione). Senza il seed, il wizard offre VASISTAS ma la generazione dà «Nessun template attivo».

---

### Task 4: Wizard — esporre la tipologia Vasistas

Rendere `VASISTAS` selezionabile nel wizard, solo-LEGNO, con il toggle chiusure nascosto (come il battente).

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: `windowType` enum ampliato (Task 1).
- Produces: nessuna nuova interfaccia esportata; comportamento UI.

- [ ] **Step 1: Scrivi i test wizard (falliscono)**

In `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`, aggiungi in fondo al `describe`:

```typescript
  it("VASISTAS è selezionabile e mostra solo LEGNO (PVC/ALLUMINIO gated)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const vasistas = within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }) as HTMLInputElement;
    expect(vasistas.disabled).toBe(false);
    fireEvent.click(vasistas);
    expect(vasistas.checked).toBe(true);

    const mat = screen.getByRole("group", { name: /materiale/i });
    expect((within(mat).getByRole("radio", { name: /legno/i }) as HTMLInputElement).disabled).toBe(false);
    expect((within(mat).getByRole("radio", { name: /pvc/i }) as HTMLInputElement).disabled).toBe(true);
    expect((within(mat).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement).disabled).toBe(true);
  });

  it("VASISTAS: niente toggle chiusure supplementari (come il battente)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(within(tipo).getByRole("radio", {
      name: new RegExp(windowTypeLabel("VASISTAS"), "i"),
    }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    expect(screen.queryByLabelText(/chiusure supplementari/i)).toBeNull();
  });
```

- [ ] **Step 2: Esegui i test — devono fallire**

Run: `pnpm test -- nuova-client`
Expected: FAIL — VASISTAS è ancora in `FUTURE_WINDOW_TYPES` (radio `disabled`) e il toggle è ancora visibile per non-battente.

- [ ] **Step 3: Sposta VASISTAS tra le tipologie attive**

In `nuova-client.tsx`, riga ~36, sposta `"VASISTAS"`:

```typescript
/** Tipologie coperte dal generatore: radio selezionabili. */
const ACTIVE_WINDOW_TYPES = ["ANTA_RIBALTA", "ANTA_BATTENTE", "VASISTAS"] as const;

/** Tipologie non ancora coperte: radio disabilitate. */
const FUTURE_WINDOW_TYPES = [
  "ANTA_PROIETTANTE",
  "SCORREVOLE_ALZANTE",
  "SCORREVOLE_TRASLANTE",
  "FINESTRA_TETTO",
] as const;
```

- [ ] **Step 4: Aggiungi la disponibilità materiali per VASISTAS**

In `MATERIAL_AVAILABILITY` (riga ~53), aggiungi la voce `VASISTAS` (dopo `ANTA_BATTENTE`):

```typescript
  VASISTAS: [
    { value: "LEGNO", enabled: true, hint: "Provvisorio — in validazione" },
    { value: "PVC", enabled: false, hint: "Non disponibile per la vasistas" },
    { value: "ALLUMINIO", enabled: false, hint: "Non disponibile per la vasistas" },
  ],
```

- [ ] **Step 5: Nascondi il toggle chiusure per il vasistas (solo ANTA_RIBALTA lo mostra)**

In `Step3ManoFinitura` (riga ~485), cambia la condizione:

```typescript
      {form.windowType === "ANTA_RIBALTA" && (
```

e in `Step4Riepilogo` (riga ~529), stessa modifica:

```typescript
      {form.windowType === "ANTA_RIBALTA" && (
```

> Il reset `supplementaryClosures → false` al cambio tipologia è già gestito (riga ~305: `if (wt !== "ANTA_RIBALTA") update("supplementaryClosures", false)`), quindi il valore inviato resta `false` per il vasistas.

- [ ] **Step 6: Esegui i test wizard — devono passare**

Run: `pnpm test -- nuova-client`
Expected: PASS (nuovi test + tutti gli esistenti verdi; il test «ANTA_BATTENTE: niente toggle» resta valido).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/richieste/nuova/nuova-client.tsx" "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"
git commit -m "feat(kit): wizard espone la tipologia vasistas (solo LEGNO, toggle chiusure nascosto)"
```

---

### Task 5: Scheda assunzioni + gate finali

Documenta le assunzioni per l'esperto (come `battente.md`) e verifica tutti i gate.

**Files:**
- Create: `docs/superpowers/kit-assunzioni/vasistas.md`

**Interfaces:** nessuna (documentazione + verifica).

- [ ] **Step 1: Scrivi la scheda assunzioni**

Crea `docs/superpowers/kit-assunzioni/vasistas.md`:

```markdown
# Vasistas ARTECH legno — assunzioni (PROVVISORIO)

**Fase 1i.** Distinta derivata dallo schema di montaggio del listino AGB 2026
(pag. 416, «Finestra rettangolare legno - apertura vasistas»), anta singola,
entrata E.15, variante base. NON validata da un esperto. Golden =
snapshot auto-coerente (`rules-artech-vasistas-legno.test.ts`).

## Distinta pilota (anta singola, E.15, LEGNO)

| Posizione | Codice | Q.tà | Fonte |
|---|---|---|---|
| Cremonese vasistas (maniglia variabile) | `A50111.15.11…16` (per GR) | 1 | Listino E.15, righe ~19552-19558 |
| DSS (ambidestro) | `A50190.00.00` | 1 | NB listino 19565 (A50111 lo richiede a parte) |
| Incontro DSS | `A51400.05.03` | 1 | Condiviso anta-ribalta |
| Forbici per vasistas | `A50545.00.00` | GR1-3→1, GR4-6→2 | NB 19566-19567 |
| Supporto forbice | `A50702.05.00` | = n. forbici | Condiviso anta-ribalta |
| Perno supporto forbice | `A50790.00.00` | = n. forbici | Condiviso anta-ribalta |
| Terminale per vasistas | `A50193.00.03` | 1 | Schema pos.3 (corsa 18) |
| Movimento angolare | `A50302.01.02` | 2 | Condiviso anta-ribalta |
| Limitatore di corsa 18 | `A50196.00.18` | 2 | Schema pos.6 |
| Incontri nottolino | `A51400.05.02` | NOT.(GR) | Colonna NOT. tabella A50111.15 |

**Campo di applicazione:** GR01–GR06 (HBB 540–2510), superficie ≤ 2 m².

## Domande per l'agente (sblocco validazione)

1. **Offset altezza→HBB**: HBB = heightMm (offset 0) o −10 come l'anta-ribalta?
2. **DSS**: incluso `A50190.00.00` + incontro `A51400.05.03`? Variante per mano
   (`A50190.00.DX/.SX`) vs ambidestro?
3. **Movimento angolare**: quantità 2 (come i gemelli)? Di conseguenza il limitatore
   `A50196.00.18` (assunto = n. movimenti).
4. **Terminale per vasistas**: quale/quante posizioni — corsa 18 (`A50193.00.03`) vs
   18+18 (`A50193.00.02`)?
5. **Incontri nottolino**: colonna NOT.(GR) o formula perimetrale «2 + scatti passo 600»?
6. **Forbici**: le bande LBB «Posizionamento forbici» determinano solo la posizione o
   anche il numero? Obbligo montanti per LBB 861-2510/HBB>500 come warning?
7. **Supporto forbice**: battuta 18 (`A50701.05.00`) o 20 (`A50702.05.00`)?
8. **Coperture/finitura**: serve un kit copertura estetico? Oggi `finish` non è usato.
9. **Incontro ribalta `A51400.05.70`**: serve nel vasistas base o bastano forbici +
   limitatore?
10. **GR00** (HBB 274–662, escluso dal pilota): quante forbici? Sblocca le finestre
    piccole.
```

- [ ] **Step 2: Gate — typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Gate — lint**

Run: `pnpm lint`
Expected: PASS (0 errori; NON usare `| tail`, maschera l'exit code).

- [ ] **Step 4: Gate — test (intera suite)**

Run: `pnpm test`
Expected: PASS — tutti i test verdi (golden gemelli invariati + nuovi vasistas + wizard).

- [ ] **Step 5: Gate — build**

Run: `pnpm build`
Expected: PASS (14 route, nessun errore di build).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/kit-assunzioni/vasistas.md
git commit -m "docs(kit): scheda assunzioni vasistas per validazione esperto"
```

---

## Note post-piano (fuori dai task)

- **Deploy:** `db:seed:kit` su Neon (via ops GitHub Actions) per il template vasistas. **Nessuna migrazione.**
- **Integration test (gated `INTEGRATION_DATABASE_URL`):** opzionale, aggiungere in futuro un caso vasistas a `engine.integration.test.ts` per verificare i codici a catalogo Neon (warning attesi = 0). Non incluso qui: richiede DB, non eseguibile in questo ambiente.
- **Handoff / CLAUDE.md:** aggiornare a **fine sessione** (la dichiara l'utente), non nei task.
