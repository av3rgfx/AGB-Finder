# Fase 1h — Anta a battente ARTECH legno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere la tipologia `ANTA_BATTENTE` (casement, anta singola Mod. 502, solo LEGNO) al kit engine deterministico come distinta provvisoria derivata dal listino 2026, esposta nel wizard.

**Architecture:** Opzione C estesa (ADR 2026-07-04). Si estrae la meccanica legno *identica* in `artech-legno-shared.ts` (behavior-preserving: il golden anta-ribalta resta invariato) e si aggiunge un modulo isolato `rules-artech-battente-legno.ts` registrato per `engineId`. `engine.ts` e `kit-shared.ts` restano invariati (già generici su `windowType`).

**Tech Stack:** Next.js 15 · React 19 · TypeScript strict · tRPC v11 · Prisma 6 (PostgreSQL) · Vitest · Tailwind 3 · pnpm 10.

## Global Constraints

- **Deterministico, MAI LLM.** Nessuna chiamata AI nel kit engine.
- **TypeScript strict** sempre. Tutte le API via **tRPC**; tutte le query via **Prisma** (nessun raw SQL qui).
- **UI in italiano**; codici prodotto in font monospace (già gestito dai componenti esistenti).
- **NESSUNA migrazione DB**: l'enum Postgres `WindowType` include già `ANTA_BATTENTE` (migrazione `20260701064610_init`); `MaterialType.LEGNO` esiste; il label `ANTA_BATTENTE: "Anta battente"` è già in `src/lib/kit-labels.ts`. Fase 1h è **solo codice + una riga di seed**.
- **Confidenza PROVVISORIA** (come PVC): golden = snapshot auto-coerente della derivazione, da validare con l'agente. Ogni voce non certa marcata `// ASSUNZIONE`.
- **pnpm 10** obbligatorio. Test: `set -a; source .env; set +a; pnpm exec vitest run <path>`.

---

## File Structure

**Nuovi:**
- `src/server/kit/artech-legno-shared.ts` — meccanica legno condivisa (cerniere per mano, movimento angolare, formula incontri nottolino).
- `src/server/kit/artech-legno-shared.test.ts` — test unità del modulo condiviso.
- `src/server/kit/rules-artech-battente-legno.ts` — modulo regole battente (`engineId "artech-batt-legno"`).
- `src/server/kit/rules-artech-battente-legno.test.ts` — golden provvisorio + varianti + guardie.
- `docs/superpowers/kit-assunzioni/battente.md` — scheda assunzioni + domande per l'agente.

**Modificati:**
- `src/server/kit/types.ts` — allarga `windowType` (literal → enum).
- `src/server/kit/rules-artech-legno.ts` — importa la meccanica condivisa (nessun cambio di output).
- `src/server/kit/registry.ts` — registra il modulo battente.
- `prisma/seed-kit.ts` — `windowType` per-template + template battente.
- `src/server/kit/engine.test.ts` — caso selezione template ANTA_BATTENTE.
- `src/server/kit/engine.integration.test.ts` — caso battente gated (catalogo reale).
- `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` — wizard abilita ANTA_BATTENTE.
- `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx` — test wizard battente.

---

## Task 1: Estrai `artech-legno-shared.ts` (behavior-preserving)

**Files:**
- Create: `src/server/kit/artech-legno-shared.ts`
- Test: `src/server/kit/artech-legno-shared.test.ts`
- Modify: `src/server/kit/rules-artech-legno.ts` (import dal condiviso; nessun cambio output)

**Interfaces:**
- Produces:
  - `PER_MANO: Record<"DESTRA"|"SINISTRA", { squadraAngolare: string; supportoCerniera: string }>`
  - `MOVIMENTO_ANGOLARE: { position: string; code: string; quantity: number; descr: string }`
  - `incontriNottolino(widthMm: number, heightMm: number): number`
- Consumes: `PILOT`, `KitInput` da `./types`.

- [ ] **Step 1: Scrivi il test del modulo condiviso**

Create `src/server/kit/artech-legno-shared.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PER_MANO, MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";

describe("artech-legno-shared", () => {
  it("PER_MANO ha varianti DX/SX per squadra angolare e supporto cerniera", () => {
    expect(PER_MANO.DESTRA.squadraAngolare).toBe("A50904.36.01");
    expect(PER_MANO.SINISTRA.squadraAngolare).toBe("A50904.36.02");
    expect(PER_MANO.DESTRA.supportoCerniera).toBe("A50801.01.01");
    expect(PER_MANO.SINISTRA.supportoCerniera).toBe("A50801.01.02");
  });

  it("MOVIMENTO_ANGOLARE è il fisso 125x125 in quantità 2", () => {
    expect(MOVIMENTO_ANGOLARE.code).toBe("A50302.01.02");
    expect(MOVIMENTO_ANGOLARE.quantity).toBe(2);
  });

  it("incontriNottolino: 2 base + scatti passo 600 in altezza e larghezza", () => {
    expect(incontriNottolino(550, 1820)).toBe(5); // golden A/R: 2+floor(1820/600)+floor(550/600)
    expect(incontriNottolino(600, 1300)).toBe(5); // golden battente: 2+floor(1300/600)+floor(600/600)
  });
});
```

- [ ] **Step 2: Esegui il test — deve fallire (modulo assente)**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit/artech-legno-shared.test.ts`
Expected: FAIL — `Cannot find module './artech-legno-shared'`.

- [ ] **Step 3: Crea `src/server/kit/artech-legno-shared.ts`**

```ts
// Meccanica LEGNO condivisa tra le tipologie ARTECH (anta-ribalta, a battente).
// Estratta da rules-artech-legno.ts (Fase 1h): SOLO ciò che è meccanicamente
// identico tra le tipologie legno — cerniere per mano, movimento angolare,
// formula incontri nottolino. Estrazione BEHAVIOR-PRESERVING: l'output
// anta-ribalta resta byte-identico (golden Fase 1d invariato).
import { PILOT, type KitInput } from "./types";

type Side = KitInput["openingSide"];

/**
 * Componenti cerniera dipendenti da mano, interasse 13/battuta 20 (I13 B20 =
 * golden anta-ribalta, unica combinazione validata). Suffissi: .01 = DX, .02 = SX.
 * Condivisi col battente (stessa cerniera legno, indipendente dal meccanismo di
 * ribalta) — ASSUNZIONE per il battente, da validare con l'agente.
 * supportoCerniera è a sua volta un'ASSUNZIONE (vedi rules-artech-legno.ts:
 * nessuna variante aria 12/interasse 13/battuta 20 a listino 2026).
 */
export const PER_MANO: Record<Side, { squadraAngolare: string; supportoCerniera: string }> = {
  SINISTRA: { squadraAngolare: "A50904.36.02", supportoCerniera: "A50801.01.02" },
  DESTRA: { squadraAngolare: "A50904.36.01", supportoCerniera: "A50801.01.01" },
};

/** Movimento angolare 125x125, fisso (indipendente da dimensioni/mano). */
export const MOVIMENTO_ANGOLARE = {
  position: "movimento-angolare",
  code: "A50302.01.02",
  quantity: 2,
  descr: "Movimento angolare 125x125",
} as const;

/**
 * Numero incontri nottolino perimetrali (A51400.05.02): 2 (base) + scatti passo
 * 600 in altezza + scatti passo 600 in larghezza. Formula ASSUNZIONE del piano
 * Fase 1d (riproduce il golden = 5 a 1820x550). Condivisa col battente (stessi
 * punti di chiusura perimetrali) — ASSUNZIONE, da validare con l'agente.
 */
export function incontriNottolino(widthMm: number, heightMm: number): number {
  return (
    2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm)
  );
}
```

- [ ] **Step 4: Esegui il test — deve passare**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit/artech-legno-shared.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Riscrivi `rules-artech-legno.ts` per importare dal condiviso**

In `src/server/kit/rules-artech-legno.ts`:

1. Aggiungi l'import (dopo l'import di `kit-shared`):

```ts
import { PER_MANO, MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";
```

2. **Elimina** la definizione locale di `PER_MANO` (il blocco `const PER_MANO: Record<Side, ...> = { SINISTRA: {...}, DESTRA: {...} };`) e il suo commento sovrastante. Mantieni `type Side = KitInput["openingSide"];` (usato ancora da `COPERTURE_KIT`).

3. Nella tabella `FISSI`, sostituisci la **prima** voce inline (quella `position: "movimento-angolare"`) con il riferimento condiviso, lasciando invariate le altre voci ribalta-specifiche:

```ts
const FISSI = [
  MOVIMENTO_ANGOLARE,
  {
    position: "supporto-forbice",
    code: "A50702.05.00",
    quantity: 1,
    descr: "Supporto forbice legno aria 12 - interasse 9/13, battuta 20",
  },
  {
    position: "perno-supporto-forbice",
    code: "A50790.00.00",
    quantity: 1,
    descr: "Perno per supporto forbice",
  },
  { position: "incontro-dss", code: "A51400.05.03", quantity: 1, descr: "Incontro DSS aria 12" },
  {
    position: "incontro-ribalta",
    code: "A51400.05.70",
    quantity: 1,
    descr: "Incontro ribalta aria 12 (13x24 viti dritte, ambidestro)",
  },
] as const;
```

4. **Elimina** la funzione locale `function incontriNottolino(...)` e il suo commento (ora importata dal condiviso). Le chiamate `incontriNottolino(input.widthMm, input.heightMm)` restano invariate.

- [ ] **Step 6: Esegui l'INTERA suite kit — non-regressione (il golden anta-ribalta DEVE restare verde)**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit`
Expected: PASS — inclusi `rules-artech-legno.test.ts` (12 righe/17 pezzi golden invariato) e `artech-legno-shared.test.ts`. Nessun test modificato.

- [ ] **Step 7: typecheck**

Run: `pnpm typecheck`
Expected: nessun errore (il `type Side` inutilizzato romperebbe strict — verificare che sia ancora usato da `COPERTURE_KIT`).

- [ ] **Step 8: Commit**

```bash
git add src/server/kit/artech-legno-shared.ts src/server/kit/artech-legno-shared.test.ts src/server/kit/rules-artech-legno.ts
git commit -m "refactor(kit): estrai meccanica legno condivisa in artech-legno-shared (behavior-preserving)"
```

---

## Task 2: Modulo `rules-artech-battente-legno.ts` + enum + registry + scheda assunzioni

**Files:**
- Modify: `src/server/kit/types.ts` (allarga `windowType`)
- Create: `src/server/kit/rules-artech-battente-legno.ts`
- Create: `src/server/kit/rules-artech-battente-legno.test.ts`
- Modify: `src/server/kit/registry.ts` (registra il modulo)
- Create: `docs/superpowers/kit-assunzioni/battente.md`

**Interfaces:**
- Consumes: `pick`, `linesFromParts` da `./kit-shared`; `PER_MANO`, `MOVIMENTO_ANGOLARE`, `incontriNottolino` da `./artech-legno-shared`; `KitGenerationError`, `PILOT`, `KitInput`, `KitLine`, `RuleModule` da `./types`.
- Produces: `artechAntaBattenteLegno: RuleModule` con `engineId "artech-batt-legno"`.

- [ ] **Step 1: Allarga l'enum `windowType` in `types.ts`**

In `src/server/kit/types.ts`, riga 8, sostituisci:

```ts
  windowType: z.literal("ANTA_RIBALTA"),
```

con:

```ts
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE"]),
```

- [ ] **Step 2: Scrivi il test golden del modulo battente**

Create `src/server/kit/rules-artech-battente-legno.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaBattenteLegno } from "./rules-artech-battente-legno";

/**
 * Golden PROVVISORIO (Fase 1h): distinta anta a battente derivata dal listino
 * 2026 (cremonese Mod. 502 A50200.15.NN) + famiglie legno condivise, MENO il
 * meccanismo di ribalta. NON validata da un esperto — vedi
 * docs/superpowers/kit-assunzioni/battente.md. Altezza 1300 scelta per essere
 * robusta all'offset cremonese (±10 → sempre gruppo .05).
 */
const golden: KitInput = {
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

// 5 righe / 10 pezzi. Cremonese battente + cerniere (condivise) + movimento
// angolare (condiviso) + incontri nottolino (condivisi).
const GOLDEN: [code: string, qty: number][] = [
  ["A50200.15.05", 1], // cremonese Mod. 502 — altezza 1300 (gruppo 1200-1410)
  ["A50904.36.01", 1], // squadra angolare DX (condivisa)
  ["A50801.01.01", 1], // supporto cerniera DX (condivisa)
  ["A50302.01.02", 2], // movimento angolare 125x125 (condiviso)
  ["A51400.05.02", 5], // incontri nottolino — 2+floor(1300/600)+floor(600/600)=2+2+1
];

describe("artechAntaBattenteLegno — golden provvisorio (da validare con agente)", () => {
  it("genera la distinta battente: 5 righe / 10 pezzi", () => {
    const lines = artechAntaBattenteLegno.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(5);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(10);
  });

  it("NON include il meccanismo di ribalta (forbice, supporto forbice, incontro ribalta, DSS)", () => {
    const codes = artechAntaBattenteLegno.generate(golden).map((l) => l.code);
    for (const c of ["A50510.00.02", "A50702.05.00", "A50790.00.00", "A51400.05.70", "A51400.05.03"])
      expect(codes).not.toContain(c);
  });

  it("ogni riga è tipata (position, ruleId artech.*, ruleDescription)", () => {
    for (const line of artechAntaBattenteLegno.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });

  it("mano SINISTRA → cerniere in variante SX, stessa struttura (5 righe)", () => {
    const codes = artechAntaBattenteLegno
      .generate({ ...golden, openingSide: "SINISTRA" })
      .map((l) => l.code);
    expect(codes).toContain("A50904.36.02");
    expect(codes).toContain("A50801.01.02");
    expect(codes).not.toContain("A50904.36.01");
    expect(codes).not.toContain("A50801.01.01");
  });

  it("materiale ≠ LEGNO → KitGenerationError (solo LEGNO per il battente)", () => {
    for (const material of ["PVC", "ALLUMINIO"] as const)
      expect(() => artechAntaBattenteLegno.generate({ ...golden, material })).toThrow(
        KitGenerationError,
      );
  });

  it("altezza fuori campo cremonese (3000) → KitGenerationError tipato", () => {
    try {
      artechAntaBattenteLegno.generate({ ...golden, heightMm: 3000 });
      expect.unreachable("attesa cremonese fuori campo");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.cremonese");
    }
  });

  it("incontri nottolino: quantità cresce a scatti del passo 600", () => {
    const qtyAt = (w: number, h: number) =>
      artechAntaBattenteLegno
        .generate({ ...golden, widthMm: w, heightMm: h })
        .find((l) => l.code === "A51400.05.02")!.quantity;
    expect(qtyAt(600, 1300)).toBe(5); // 2+2+1
    expect(qtyAt(550, 1799)).toBe(4); // 2+2+0
  });
});
```

- [ ] **Step 3: Esegui il test — deve fallire (modulo assente)**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit/rules-artech-battente-legno.test.ts`
Expected: FAIL — `Cannot find module './rules-artech-battente-legno'`.

- [ ] **Step 4: Crea `src/server/kit/rules-artech-battente-legno.ts`**

```ts
// Regole kit ARTECH «anta a battente» LEGNO — Fase 1h.
// PROVVISORIO (da validare con l'agente): distinta derivata dal listino 2026
// (cremonese Mod. 502 A50200.15.NN, righe ~19659) + le famiglie legno condivise
// con l'anta-ribalta (artech-legno-shared), MENO il meccanismo di ribalta
// (forbice, supporto forbice, perno, incontro ribalta, DSS). Le voci non
// derivabili con certezza sono marcate ASSUNZIONE. Vedi
// docs/superpowers/kit-assunzioni/battente.md.
import { pick, linesFromParts } from "./kit-shared";
import { PER_MANO, MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";
import { KitGenerationError, PILOT, type KitInput, type KitLine, type RuleModule } from "./types";

/**
 * Cremonese «anta a battente» Mod. 502 per range altezza (famiglia A50200.15.NN,
 * listino 2026). Stessa struttura della cremonese anta-ribalta (A50122.15.NN) ma
 * famiglia distinta. ASSUNZIONE: selezione per heightMm sui range di listino
 * (offset da confermare con l'agente; i bordi condivisi si risolvono con lo span
 * più stretto in pick()).
 */
const BATTENTE_CREMONESI = [
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
  generate(input: KitInput): KitLine[] {
    if (input.material !== "LEGNO")
      throw new KitGenerationError(
        `Materiale "${input.material}" non ancora coperto per l'anta a battente: il generatore supporta LEGNO.`,
        "artech.materiale",
      );

    const lines: KitLine[] = [];

    // Cremonese a battente Mod. 502 (ASSUNZIONE: selezione per altezza anta).
    const cremonese = pick(
      BATTENTE_CREMONESI,
      input.heightMm,
      "H",
      "artech.cremonese",
      "cremonese a battente",
    );
    lines.push({
      position: "cremonese",
      code: cremonese.code,
      quantity: 1,
      ruleId: "artech.cremonese",
      ruleDescription: `Cremonese anta a battente Mod. 502 per altezza anta ${input.heightMm} mm`,
    });

    // Cerniere per mano (condivise col legno anta-ribalta — ASSUNZIONE battente).
    const mano = PER_MANO[input.openingSide];
    lines.push(
      {
        position: "squadra-angolare",
        code: mano.squadraAngolare,
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Squadra angolare legno aria ${input.airGapMm} interasse ${input.axisOffsetMm} battuta ${input.rebateMm} ${input.openingSide}`,
      },
      {
        position: "supporto-cerniera",
        code: mano.supportoCerniera,
        quantity: 1,
        ruleId: "artech.mano",
        ruleDescription: `Supporto cerniera parte telaio ${input.openingSide} (ASSUNZIONE condivisa con anta-ribalta)`,
      },
    );

    // Movimento angolare (fisso, condiviso).
    lines.push(...linesFromParts([MOVIMENTO_ANGOLARE], "artech.fissi"));

    // Incontri nottolino perimetrali (formula condivisa — ASSUNZIONE per battente).
    lines.push({
      position: "incontri-nottolino",
      code: "A51400.05.02",
      quantity: incontriNottolino(input.widthMm, input.heightMm),
      ruleId: "artech.incontri",
      ruleDescription: `Incontri nottolino sede ${input.seatMm} aria ${input.airGapMm} (passo ${PILOT.passoVerticaleMm} mm)`,
    });

    return lines;
  },
};
```

- [ ] **Step 5: Registra il modulo in `registry.ts`**

In `src/server/kit/registry.ts`, aggiungi l'import e la voce nel record `RULE_MODULES`:

```ts
import { artechAntaBattenteLegno } from "./rules-artech-battente-legno";
```

```ts
export const RULE_MODULES: Record<string, RuleModule> = {
  [artechAntaRibaltaLegno.engineId]: artechAntaRibaltaLegno,
  [artechAntaRibaltaPvc.engineId]: artechAntaRibaltaPvc,
  [artechAntaRibaltaAlu.engineId]: artechAntaRibaltaAlu,
  [artechAntaBattenteLegno.engineId]: artechAntaBattenteLegno,
};
```

- [ ] **Step 6: Esegui i test — modulo + registry devono passare**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit/rules-artech-battente-legno.test.ts src/server/kit/registry.test.ts`
Expected: PASS (golden battente + `registry.test.ts` che itera `RULE_MODULES` verificando `engineId === key`).

- [ ] **Step 7: Crea la scheda assunzioni `docs/superpowers/kit-assunzioni/battente.md`**

```markdown
# Anta a battente ARTECH legno — assunzioni (PROVVISORIO)

**Fase 1h.** Distinta derivata dal listino AGB 2026 + sottrazione del meccanismo
di ribalta dall'anta-ribalta legno. NON validata da un esperto. Golden =
snapshot auto-coerente (`rules-artech-battente-legno.test.ts`).

## Distinta pilota (anta singola, Mod. 502, LEGNO)

| Posizione | Codice | Q.tà | Fonte |
|---|---|---|---|
| Cremonese a battente | `A50200.15.NN` (per altezza) | 1 | Listino Mod. 502 (righe ~19659) |
| Squadra angolare | `A50904.36.{01 DX, 02 SX}` | 1 | Condivisa anta-ribalta |
| Supporto cerniera | `A50801.01.{01 DX, 02 SX}` | 1 | Condivisa anta-ribalta (già ASSUNZIONE) |
| Movimento angolare | `A50302.01.02` | 2 | Condiviso anta-ribalta |
| Incontri nottolino | `A51400.05.02` | 2 + passo 600 (h+l) | Condiviso anta-ribalta |

**Rimossi (ribalta):** forbice corpo/braccio, supporto forbice, perno, incontro
ribalta, incontro DSS, chiusure verticali.

## Domande per l'agente (sblocco validazione)

1. La distinta a battente si ottiene davvero sottraendo il meccanismo di ribalta
   dall'anta-ribalta, o servono componenti battente-specifici (es. incontri
   cremonese Mod. 502 `A52099.25.NN` — a listino risultano 124–244€: sono strike
   standard o set/dime?)?
2. La cremonese Mod. 502 `A50200.15.NN` si seleziona per altezza con gli stessi
   scaglioni? Va applicato un offset (l'anta-ribalta usa hbb = altezza − 10)?
3. Le coperture (`A51301.*`, kit «supporto forbice + cerniera») vanno incluse nel
   battente (che non ha forbice)? Esiste una copertura solo-cerniera?
4. La formula incontri nottolino (2 + scatti passo 600) vale identica per il
   battente, o cambia il numero di punti di chiusura?
5. Le cerniere `A50904.36.*` / `A50801.01.*` (interasse 13, battuta 20) sono le
   stesse dell'anta-ribalta anche per il battente?
```

- [ ] **Step 8: typecheck + commit**

Run: `pnpm typecheck`
Expected: nessun errore.

```bash
git add src/server/kit/types.ts src/server/kit/rules-artech-battente-legno.ts src/server/kit/rules-artech-battente-legno.test.ts src/server/kit/registry.ts docs/superpowers/kit-assunzioni/battente.md
git commit -m "feat(kit): modulo anta a battente ARTECH legno (provvisorio da listino) + enum windowType"
```

---

## Task 3: Seed template battente (windowType per-template) + wiring engine

**Files:**
- Modify: `prisma/seed-kit.ts`
- Modify: `src/server/kit/engine.test.ts` (caso selezione ANTA_BATTENTE)
- Modify: `src/server/kit/engine.integration.test.ts` (caso battente gated)

**Interfaces:**
- Consumes: `artechAntaBattenteLegno.engineId` = `"artech-batt-legno"`.
- Produces: un `KitTemplate` con `windowType: "ANTA_BATTENTE", material: "LEGNO", isActive: true`.

- [ ] **Step 1: Aggiungi il caso di selezione battente in `engine.test.ts`**

In `src/server/kit/engine.test.ts`, dentro `describe("KitEngine.generate", ...)`, aggiungi:

```ts
  it("seleziona il template per ANTA_BATTENTE", async () => {
    templateFindFirst.mockResolvedValue({
      id: "tb",
      rules: { engine: "artech-batt-legno", version: 1 },
    });
    productFindMany.mockResolvedValue([]);
    const engine = new KitEngine(db);
    await engine.generate({ ...validInput, windowType: "ANTA_BATTENTE" });
    expect(templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          windowType: "ANTA_BATTENTE",
          series: "ARTECH",
        }),
      }),
    );
  });
```

- [ ] **Step 2: Esegui — deve fallire (seed non ha ancora il template, ma il test mocka il DB → passa la selezione; verifica che il modulo generi)**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit/engine.test.ts`
Expected: PASS per il nuovo caso (il modulo `artech-batt-legno` è già registrato in Task 2; `productFindMany` vuoto → warning ma nessun throw). Se fallisse per modulo non registrato, Task 2 non è completo.

> Nota: questo test mocka `kitTemplate.findFirst`, quindi non dipende dal seed. Il seed reale è coperto dallo Step 4 (integration, gated).

- [ ] **Step 3: Aggiungi `windowType` al seed e il template battente**

In `prisma/seed-kit.ts`:

1. Importa il tipo `WindowType`:

```ts
import { PrismaClient, type MaterialType, type WindowType } from "@prisma/client";
```

2. Aggiungi `windowType` al tipo `KitTemplateSeed`:

```ts
type KitTemplateSeed = {
  name: string;
  description: string;
  windowType: WindowType;
  material: MaterialType;
  rules: { engine: string; version: number };
  priority: number;
  isActive: boolean;
};
```

3. Aggiungi `windowType: "ANTA_RIBALTA"` a ciascuno dei 3 template esistenti (legno, PVC, alluminio), e aggiungi in coda a `TEMPLATES` il template battente:

```ts
  {
    name: "ARTECH anta a battente legno",
    description:
      "Fase 1h — finestra a battente anta singola Mod. 502 (PROVVISORIO, da validare con l'agente): cremonese A50200.15.NN + cerniere/movimento/incontri condivisi col legno anta-ribalta, meno il meccanismo di ribalta.",
    windowType: "ANTA_BATTENTE",
    material: "LEGNO",
    rules: { engine: "artech-batt-legno", version: 1 },
    priority: 10,
    isActive: true,
  },
```

4. In `seedKitTemplates`, sostituisci l'hardcode `windowType: "ANTA_RIBALTA" as const,` con:

```ts
      windowType: tpl.windowType,
```

- [ ] **Step 4: Aggiungi il caso battente all'integration test (gated)**

In `src/server/kit/engine.integration.test.ts`, dentro il `describe.runIf(...)`, aggiungi:

```ts
  it("la distinta battente provvisoria si genera e segnala i codici non a listino", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_BATTENTE", widthMm: 600, heightMm: 1300, material: "LEGNO",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "DESTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
    });
    expect(output.lines).toHaveLength(5);
    const unpriced = output.lines.filter((line) => line.unitPrice === null);
    expect(output.warnings).toHaveLength(unpriced.length);
    console.log(
      `Battente provvisorio: ${output.lines.length - unpriced.length}/${output.lines.length} codici a listino` +
        (unpriced.length ? `; da validare: ${unpriced.map((l) => l.code).join(", ")}` : ""),
    );
  });
```

- [ ] **Step 5: Esegui la suite kit + typecheck**

Run: `set -a; source .env; set +a; pnpm exec vitest run src/server/kit`
Expected: PASS. L'integration `describe.runIf(Boolean(url))` resta skipped senza `INTEGRATION_DATABASE_URL` (atteso in questo ambiente).

Run: `pnpm typecheck`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed-kit.ts src/server/kit/engine.test.ts src/server/kit/engine.integration.test.ts
git commit -m "feat(kit): seed template anta a battente (windowType per-template) + wiring engine"
```

---

## Task 4: Wizard — abilita ANTA_BATTENTE (solo LEGNO, niente toggle ribalta)

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: `kitInputSchema` (windowType allargato in Task 2), `windowTypeLabel`, `materialLabel`.

- [ ] **Step 1: Scrivi i test del wizard battente**

In `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`, aggiungi dentro `describe("NuovaRichiestaClient", ...)`:

```ts
  it("tipologia: ANTA_RIBALTA e ANTA_BATTENTE selezionabili, altre disabilitate", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    const ribalta = within(tipo).getByRole("radio", { name: /anta.?ribalta/i }) as HTMLInputElement;
    const battente = within(tipo).getByRole("radio", { name: /anta battente/i }) as HTMLInputElement;
    expect(ribalta.checked).toBe(true);
    expect(battente.disabled).toBe(false);
  });

  it("ANTA_BATTENTE: solo LEGNO abilitato, PVC/ALLUMINIO gated", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(within(tipo).getByRole("radio", { name: /anta battente/i }));
    const mat = screen.getByRole("group", { name: /materiale/i });
    expect((within(mat).getByRole("radio", { name: /legno/i }) as HTMLInputElement).disabled).toBe(false);
    expect((within(mat).getByRole("radio", { name: /pvc/i }) as HTMLInputElement).disabled).toBe(true);
    expect((within(mat).getByRole("radio", { name: /alluminio/i }) as HTMLInputElement).disabled).toBe(true);
  });

  it("passando a ANTA_BATTENTE con PVC selezionato → materiale resettato a LEGNO", () => {
    render(<NuovaRichiestaClient />);
    const mat = screen.getByRole("group", { name: /materiale/i });
    fireEvent.click(within(mat).getByRole("radio", { name: /pvc/i })); // ANTA_RIBALTA consente PVC
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(within(tipo).getByRole("radio", { name: /anta battente/i }));
    const mat2 = screen.getByRole("group", { name: /materiale/i });
    expect((within(mat2).getByRole("radio", { name: /legno/i }) as HTMLInputElement).checked).toBe(true);
  });

  it("ANTA_BATTENTE: niente toggle chiusure supplementari (ribalta-only)", () => {
    render(<NuovaRichiestaClient />);
    const tipo = screen.getByRole("group", { name: /tipologia/i });
    fireEvent.click(within(tipo).getByRole("radio", { name: /anta battente/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 3
    expect(screen.queryByLabelText(/chiusure supplementari/i)).toBeNull();
  });
```

- [ ] **Step 2: Esegui i test — devono fallire**

Run: `pnpm exec vitest run "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"`
Expected: FAIL — ANTA_BATTENTE è ancora una radio disabilitata (nessuna selezione possibile).

- [ ] **Step 3: Sostituisci `FUTURE_WINDOW_TYPES` e aggiungi `ACTIVE_WINDOW_TYPES` + `MATERIAL_AVAILABILITY`**

In `nuova-client.tsx`, sostituisci il blocco `const FUTURE_WINDOW_TYPES = [...] as const;` (righe ~35-43) con:

```ts
/** Tipologie coperte dal generatore: radio selezionabili. */
const ACTIVE_WINDOW_TYPES = ["ANTA_RIBALTA", "ANTA_BATTENTE"] as const;

/** Tipologie non ancora coperte: radio disabilitate. */
const FUTURE_WINDOW_TYPES = [
  "ANTA_PROIETTANTE",
  "SCORREVOLE_ALZANTE",
  "SCORREVOLE_TRASLANTE",
  "VASISTAS",
  "FINESTRA_TETTO",
] as const;

/**
 * Materiali disponibili per tipologia. Il battente ha solo il LEGNO (il listino
 * 2026 non ha composizione PVC/ALLUMINIO per il battente); l'anta-ribalta espone
 * anche il PVC (provvisorio). ALLUMINIO sempre gated (manca il listino).
 */
type MaterialChoice = { value: "LEGNO" | "PVC" | "ALLUMINIO"; enabled: boolean; hint?: string };
const MATERIAL_AVAILABILITY: Record<string, MaterialChoice[]> = {
  ANTA_RIBALTA: [
    { value: "LEGNO", enabled: true },
    { value: "PVC", enabled: true, hint: "Provvisorio — in validazione" },
    { value: "ALLUMINIO", enabled: false, hint: "Non ancora disponibile" },
  ],
  ANTA_BATTENTE: [
    { value: "LEGNO", enabled: true, hint: "Provvisorio — in validazione" },
    { value: "PVC", enabled: false, hint: "Non disponibile per l'anta battente" },
    { value: "ALLUMINIO", enabled: false, hint: "Non disponibile per l'anta battente" },
  ],
};
```

- [ ] **Step 4: Riscrivi `Step1Tipologia` (windowType selezionabile + materiali per tipologia)**

Sostituisci l'intera funzione `function Step1Tipologia({ form, update }: StepProps) { ... }` con:

```tsx
function Step1Tipologia({ form, update }: StepProps) {
  const materials = MATERIAL_AVAILABILITY[form.windowType] ?? MATERIAL_AVAILABILITY.ANTA_RIBALTA;

  function selectWindowType(wt: KitInput["windowType"]) {
    update("windowType", wt);
    const allowed = (MATERIAL_AVAILABILITY[wt] ?? [])
      .filter((m) => m.enabled)
      .map((m) => m.value);
    if (!allowed.includes(form.material)) update("material", "LEGNO");
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Tipologia serramento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIVE_WINDOW_TYPES.map((wt) => (
            <RadioOption
              key={wt}
              name="windowType"
              label={windowTypeLabel(wt)}
              checked={form.windowType === wt}
              onChange={() => selectWindowType(wt)}
            />
          ))}
          {FUTURE_WINDOW_TYPES.map((wt) => (
            <RadioOption
              key={wt}
              name="windowType"
              label={windowTypeLabel(wt)}
              checked={false}
              onChange={() => {}}
              disabled
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-subtle">Altre tipologie disponibili prossimamente.</p>
      </fieldset>

      <div>
        <span className="mb-2 block text-sm font-semibold text-ink">Serie</span>
        <p className="w-fit rounded border border-line-strong bg-surface-sunken px-3.5 py-2.5 text-sm font-medium text-ink">
          ARTECH
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Materiale</legend>
        <div className="grid grid-cols-3 gap-2">
          {materials.map((m) => (
            <RadioOption
              key={m.value}
              name="material"
              label={materialLabel(m.value)}
              hint={m.hint}
              checked={form.material === m.value}
              onChange={m.enabled ? () => update("material", m.value) : () => {}}
              disabled={!m.enabled}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 5: Nascondi il toggle chiusure per il battente (in `Step3ManoFinitura`)**

In `Step3ManoFinitura`, avvolgi il blocco del toggle (il `<div className="flex items-start gap-2"> ... </div>` con `id="supplementaryClosures"`) in una condizione sul tipo:

```tsx
      {form.windowType !== "ANTA_BATTENTE" && (
        <div className="flex items-start gap-2">
          <input
            id="supplementaryClosures"
            type="checkbox"
            checked={form.supplementaryClosures ?? false}
            onChange={(e) => update("supplementaryClosures", e.target.checked)}
            className="mt-0.5 accent-brand"
          />
          <label htmlFor="supplementaryClosures" className="text-sm text-ink">
            Chiusure supplementari
            <span className="block text-xs text-ink-subtle">
              Punti di chiusura verticali aggiuntivi (angolare + prolunghe + terminale). Opzionale.
            </span>
          </label>
        </div>
      )}
```

- [ ] **Step 6: Nascondi la voce «Chiusure suppl.» dal riepilogo per il battente (in `Step4Riepilogo`)**

Sostituisci la riga `<SummaryItem label="Chiusure suppl." value={form.supplementaryClosures ? "Sì" : "No"} />` con:

```tsx
      {form.windowType !== "ANTA_BATTENTE" && (
        <SummaryItem label="Chiusure suppl." value={form.supplementaryClosures ? "Sì" : "No"} />
      )}
```

- [ ] **Step 7: Esegui i test del wizard — devono passare (nuovi + esistenti)**

Run: `pnpm exec vitest run "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"`
Expected: PASS — i 4 nuovi test battente + tutti gli 8 esistenti (ANTA_RIBALTA resta default, PVC selezionabile per anta-ribalta, toggle presente per anta-ribalta).

- [ ] **Step 8: Gate completi + commit**

Run: `pnpm typecheck && pnpm lint && set -a; source .env; set +a; pnpm exec vitest run && pnpm build`
Expected: tutto verde.

```bash
git add "src/app/(dashboard)/richieste/nuova/nuova-client.tsx" "src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx"
git commit -m "feat(kit): wizard abilita tipologia anta a battente (solo LEGNO, senza toggle ribalta)"
```

---

## Note di chiusura (post-Task 4)

Non fa parte dei task TDD ma va fatto in `finishing-a-development-branch`:
- Aggiornare `handoff.md` (sezione Fase 1h) e `CLAUDE.md` (STATO).
- Al **deploy**: `db:seed:kit` su Neon (via pipeline ops) per inserire il template battente. **Nessuna `migrate deploy`** (nessuna migrazione in Fase 1h).
- Girare l'integration gated con `INTEGRATION_DATABASE_URL` per verificare i codici battente a catalogo reale (warning attesi = 0 se le famiglie sono a listino; la cremonese `A50200.15.NN` è confermata presente nel listino).

## Self-Review (spec coverage)

- **Cremonese battente `A50200.15.NN` per altezza** → Task 2 (`BATTENTE_CREMONESI`). ✅
- **Famiglie condivise (cerniere/movimento/incontri) − ribalta** → Task 1 (estrazione) + Task 2 (composizione). ✅
- **Behavior-preserving (golden A/R verde)** → Task 1 Step 6. ✅
- **Enum windowType allargato** → Task 2 Step 1; nessuna migrazione (Global Constraints). ✅
- **Template seed per-windowType** → Task 3. ✅
- **Wizard solo-LEGNO + no toggle ribalta + reset materiale** → Task 4. ✅
- **Provvisorio + domande esperto** → Task 2 Step 7 (`battente.md`). ✅
- **Deterministico, MAI LLM; codici reali validati (listino)** → tutte le tabelle usano codici estratti dal listino; incontri cremonese `A52099.25`/coperture volutamente ESCLUSI (assunzioni aperte) per non inventare. ✅
- **Placeholder scan:** nessun TBD/TODO; ogni step ha codice/comando concreti. ✅
- **Type consistency:** `engineId "artech-batt-legno"` coerente in modulo/registry/seed/test; `incontriNottolino`/`PER_MANO`/`MOVIMENTO_ANGOLARE` coerenti tra shared e consumatori. ✅
