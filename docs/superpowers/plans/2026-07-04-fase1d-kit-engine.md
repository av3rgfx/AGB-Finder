# Fase 1d — Kit Deterministic Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generazione deterministica del kit ferramenta ARTECH anta-ribalta «ad applicare» dalle specifiche del serramento, con persistenza su `KitRequest`/`KitComponent` e UI Richieste (lista, form 4 step, dettaglio distinta).

**Architecture:** Regole = dati tipati `as const` + funzioni pure in `src/server/kit/rules-artech.ts` (ADR council: opzione B «a forma di dati»). `KitTemplate` a DB è solo registro/dispatcher col puntatore `{"engine":"artech-ar-applicare","version":1}`. Engine puro senza I/O; risoluzione prodotti/prezzi via Prisma (nessun raw SQL). Golden test = distinta commerciale AGB reale (20 righe / 24 pezzi).

**Tech Stack:** Next.js 15 · tRPC v11 · Prisma 6 · zod · Vitest. Nessuna nuova dipendenza, nessuna migrazione schema.

**Spec:** `docs/superpowers/specs/2026-07-04-fase1d-kit-engine-design.md`

## Global Constraints

- **MAI LLM nei calcoli kit** (regola inviolabile CLAUDE.md). Engine 100% deterministico.
- TS strict; API solo tRPC; query solo Prisma (raw SQL resta SOLO nel RAGEngine).
- UI in italiano; codici prodotto in monospace (JetBrains Mono).
- Errori tipizzati con messaggi italiani; MAI selezione silenziosa «del più vicino»: input fuori range → errore esplicito.
- Assunzioni non derivabili dall'unica distinta (estremi range, ceil/floor nei conteggi) → commento `// ASSUNZIONE:` nel codice.
- Costanti pilota (documentate in `types.ts`): FINESTRA, chiusure verticali STANDARD PASSO 600, orizzontali NESSUNA, coperture KIT. Solo `windowType: ANTA_RIBALTA` e `series: ARTECH`.
- `KitInput` generico: nessun campo ARTECH-specifico (ADR migrazione).
- TDD: test prima, un commit per task. Gates: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` (mai `lint | tail` in catena).
- Golden test di riferimento (input/output esatti): tabella nella spec §«Golden test».

---

### Task 0: Ambiente + verifica codici golden a catalogo

**Files:** nessuno nuovo (bootstrap container).

**Interfaces:**
- Produces: DB Docker con catalogo 6.191 importato; conferma che i 20 part number della distinta esistono come `agbCode` puntati; mapping puntato definitivo per Task 2.

- [ ] **Step 1: Bootstrap (container fresco)**

```bash
cd /home/user/AGB-Finder
pnpm install && bash scripts/setup-prisma-engines.sh
set -a; source .env; set +a; pnpm db:generate   # .env: ricreare da .env.example se assente (key AI dal transcript sessione)
bash scripts/dev-bootstrap.sh
which pdftotext || (apt-get update && apt-get install -y poppler-utils)
SCRATCH=/tmp/claude-0/-home-user-AGB-Finder/788d825d-eb98-53f5-ae2f-34eb1c51af2b/scratchpad
curl -sL "https://drive.usercontent.google.com/download?id=1TugU94aM6OP557ELiLQpH0nUxhxrXMUz&export=download&confirm=t" -o $SCRATCH/listino-agb.pdf
pnpm import:agb $SCRATCH/listino-agb.pdf
```

Expected: `Prodotti unici: 6191 · Categorie: 22`.

- [ ] **Step 2: Verifica i 20 codici della distinta (mapping puntato)**

Ipotesi di mapping: part number `XXXXXXNNMM` → `XXXXXX.NN.MM` (es. `A501221507` → `A50122.15.07`; `A514SX0565` → `A514SX.05.65`).

```bash
docker exec ufptrade-db psql -U postgres -d utpistoia -t -A -c "
SELECT agb_code FROM products WHERE agb_code IN (
'A50122.15.07','A50302.01.02','A50330.00.00','A50401.00.03','A50510.00.02',
'A50711.00.00','A50790.00.00','A50811.07.00','A50911.36.02','A51326.02.21',
'A51328.00.21','A51330.00.21','A51331.00.21','A51332.00.21','A51400.05.03',
'A51401.05.02','A514SX.05.65','A51801.00.01','A51803.00.03','A51922.36.02')
ORDER BY agb_code;" | wc -l
```

Expected: `20`. Se < 20: per ogni assente, cercare la forma reale con
`docker exec ufptrade-db psql -U postgres -d utpistoia -c "SELECT agb_code, name FROM products WHERE agb_code LIKE 'A514%' ORDER BY agb_code LIMIT 30;"`
e correggere la costante `GOLDEN_CODES` del Task 2 (annotare il delta nel commit).

- [ ] **Step 3: Suite esistente verde** — `pnpm test` → 137 passed.

---

### Task 1: Tipi e contratto del modulo regole

**Files:**
- Create: `src/server/kit/types.ts`
- Test: `src/server/kit/types.test.ts`

**Interfaces:**
- Produces:
  - `kitInputSchema` (zod) e `type KitInput = z.infer<...>` — campi: `windowType: "ANTA_RIBALTA"`, `widthMm/heightMm: int 300..3000`, `material: "LEGNO"|"PVC"|"ALLUMINIO"` (pilota), `airGapMm: int 4..20`, `axisOffsetMm: int 9..20`, `rebateMm: int 15..30`, `seatMm: int 12..22`, `openingSide: "DESTRA"|"SINISTRA"`, `openingDir: "TIRARE"|"SPINGERE"`, `finish: string min1 max40`, `series: "ARTECH"`, `notes?: string max2000`.
  - `interface KitLine { position: string; code: string; quantity: number; ruleId: string; ruleDescription: string }`
  - `interface RuleModule { engineId: string; generate(input: KitInput): KitLine[] }`
  - `class KitGenerationError extends Error { constructor(message: string, public readonly ruleId?: string) }` — messaggi italiani.
  - Costanti pilota esportate: `PILOT = { apertura: "FINESTRA", verticali: "STANDARD_PASSO_600", passoVerticaleMm: 600, orizzontali: "NESSUNA", coperture: "KIT" } as const`.

- [ ] **Step 1: Test (falliranno)**

`src/server/kit/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { kitInputSchema } from "./types";

const valid = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "ALLUMINIO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

describe("kitInputSchema", () => {
  it("accetta l'input della distinta golden", () => {
    expect(kitInputSchema.parse(valid)).toMatchObject({ widthMm: 550, heightMm: 1820 });
  });

  it("rifiuta serie non pilota", () => {
    expect(kitInputSchema.safeParse({ ...valid, series: "PLANA" }).success).toBe(false);
  });

  it("rifiuta dimensioni fuori 300-3000 e parametri fuori range", () => {
    expect(kitInputSchema.safeParse({ ...valid, widthMm: 200 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, airGapMm: 3 }).success).toBe(false);
    expect(kitInputSchema.safeParse({ ...valid, seatMm: 25 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: FAIL** — `pnpm vitest run src/server/kit/types.test.ts`

- [ ] **Step 3: Implementa types.ts**

```ts
import "server-only" — NO: il modulo è puro e riusato dai test/seed tsx → niente server-only (pattern catalog).
```

```ts
import { z } from "zod";

/**
 * Input generico del Kit Engine (ADR 2026-07-04: nessun campo serie-specifico).
 * Pilota 1d: solo ANTA_RIBALTA / ARTECH; i letterali si allargano con le serie future.
 */
export const kitInputSchema = z.object({
  windowType: z.literal("ANTA_RIBALTA"),
  widthMm: z.number().int().min(300).max(3000),
  heightMm: z.number().int().min(300).max(3000),
  material: z.enum(["LEGNO", "PVC", "ALLUMINIO"]),
  airGapMm: z.number().int().min(4).max(20),
  axisOffsetMm: z.number().int().min(9).max(20),
  rebateMm: z.number().int().min(15).max(30),
  seatMm: z.number().int().min(12).max(22),
  openingSide: z.enum(["DESTRA", "SINISTRA"]),
  openingDir: z.enum(["TIRARE", "SPINGERE"]),
  finish: z.string().trim().min(1).max(40),
  series: z.literal("ARTECH"),
  notes: z.string().max(2000).optional(),
});

export type KitInput = z.infer<typeof kitInputSchema>;

/** Costanti del pilota 1d (non nel form): documentano il perimetro coperto. */
export const PILOT = {
  apertura: "FINESTRA",
  verticali: "STANDARD_PASSO_600",
  passoVerticaleMm: 600,
  orizzontali: "NESSUNA",
  coperture: "KIT",
} as const;

/** Riga di kit prodotta dalle regole: riempie i campi già presenti in KitComponent. */
export interface KitLine {
  position: string;
  code: string;
  quantity: number;
  ruleId: string;
  ruleDescription: string;
}

/** Modulo regole per una famiglia di kit. Puro: nessun I/O. */
export interface RuleModule {
  engineId: string;
  generate(input: KitInput): KitLine[];
}

/** Errore deterministico di generazione (input fuori campo di applicazione, ecc.). */
export class KitGenerationError extends Error {
  constructor(
    message: string,
    public readonly ruleId?: string,
  ) {
    super(message);
    this.name = "KitGenerationError";
  }
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add src/server/kit/
git commit -m "feat(kit): tipi e contratto RuleModule del Kit Engine (pilota ARTECH)"
```

---

### Task 2: Regole ARTECH anta-ribalta «ad applicare» + golden test

**Files:**
- Create: `src/server/kit/rules-artech.ts`
- Test: `src/server/kit/rules-artech.test.ts`

**Interfaces:**
- Consumes: `KitInput`, `KitLine`, `RuleModule`, `KitGenerationError`, `PILOT` (Task 1).
- Produces: `export const artechAntaRibaltaApplicare: RuleModule` con `engineId = "artech-ar-applicare"`.

**Nota metodologica.** L'unica configurazione VALIDATA è la distinta golden
(L 550 × H 1820, ALLUMINIO, SX, I13/B20, aria 12, sede 18, ARGENTO). Le tabelle
sotto partono dalle righe golden; le varianti adiacenti (altri range H/L, mano
DX, altre finiture, LEGNO) vanno enumerate dal catalogo importato PRIMA di
scrivere il codice, con questi comandi di estrazione (Step 0):

```bash
Q() { docker exec ufptrade-db psql -U postgres -d utpistoia -c "$1"; }
Q "SELECT agb_code, name FROM products WHERE name LIKE 'CREMONESE ARTECH A/R%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE 'CORPO FORBICE ARTECH%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE 'BRACCIO FORB.ARTECH APPL%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE 'CERNIERA FEMMINA ARTECH APPL%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE 'COP.%ARTECH%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE 'INC%A12%' OR name LIKE 'INCONTRO DSS%' ORDER BY name;"
Q "SELECT agb_code, name FROM products WHERE name LIKE '%CHIUSURA SUPPL%ARTECH%' OR name LIKE 'PROLUNGA ARTECH%' ORDER BY name;"
```

Ogni riga estratta con un range nel nome (es. `1594-1810`, `476-604`) diventa
una entry di tabella; i confini si assumono **min inclusivo / max inclusivo**
(`// ASSUNZIONE`). Le tabelle nel codice sotto mostrano la struttura con le
entry golden certe + le adiacenti note dall'estrazione: il worker DEVE
completarle con l'output reale dei comandi (stesso shape, più righe).

- [ ] **Step 0: Estrazione varianti dal catalogo** — eseguire i comandi sopra e salvarne l'output in `$SCRATCH/artech-varianti.txt` come riferimento.

- [ ] **Step 1: Golden test + boundary test (falliranno)**

`src/server/kit/rules-artech.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaApplicare } from "./rules-artech";

/** Input della Distinta Commerciale AGB 16/11/2021 (golden). */
const golden: KitInput = {
  windowType: "ANTA_RIBALTA",
  widthMm: 550,
  heightMm: 1820,
  material: "ALLUMINIO",
  airGapMm: 12,
  axisOffsetMm: 13,
  rebateMm: 20,
  seatMm: 18,
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  series: "ARTECH",
};

/** Attesi dalla distinta reale: 20 righe / 24 pezzi. */
const GOLDEN_EXPECTED: [code: string, qty: number][] = [
  ["A50122.15.07", 1], // CREMONESE A/R E15 1594-1810
  ["A50302.01.02", 2], // MOV.ANGOLARE 125X125 1F
  ["A50330.00.00", 1], // ANGOLO CHIUSURA SUPPL L185
  ["A50401.00.03", 1], // TERMINALE CHIUSURA SUPPL L600
  ["A50510.00.02", 1], // CORPO FORBICE 476-604
  ["A50711.00.00", 1], // SUPPORTO FORBICE PERNI 3X3
  ["A50790.00.00", 1], // PERNO SUPPORTO FORBICE
  ["A50811.07.00", 1], // CERNIERA MASCHIO PERNI 3X3
  ["A50911.36.02", 1], // CERNIERA FEMMINA APPL I13 B20 SX
  ["A51326.02.21", 1], // COP. FEMMINA APPLIC. SX
  ["A51328.00.21", 1], // COP. SUPPORTO FORBICE
  ["A51330.00.21", 1], // COP. ANGOLO FORBICE
  ["A51331.00.21", 1], // COP. INFERIORE MASCHIO
  ["A51332.00.21", 1], // COP. SUPERIORE MASCHIO
  ["A51400.05.03", 1], // INCONTRO DSS A12 I9
  ["A51401.05.02", 5], // INCONTRI NOTTOLINO SEDE 18/22/35
  ["A514SX.05.65", 1], // INCONTRO RIBALTA SX A12 I9
  ["A51801.00.01", 1], // PROLUNGA L200
  ["A51803.00.03", 1], // PROLUNGA L600 1F
  ["A51922.36.02", 1], // BRACCIO FORBICE APPL SX I13 B20 GR2
];

describe("artechAntaRibaltaApplicare — golden test (distinta reale)", () => {
  it("riproduce esattamente le 20 righe / 24 pezzi della distinta", () => {
    const lines = artechAntaRibaltaApplicare.generate(golden);
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN_EXPECTED.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN_EXPECTED) expect(byCode.get(code), code).toBe(qty);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(24);
  });

  it("ogni riga ha position, ruleId e ruleDescription valorizzati", () => {
    for (const line of artechAntaRibaltaApplicare.generate(golden)) {
      expect(line.position.length).toBeGreaterThan(0);
      expect(line.ruleId).toMatch(/^artech\./);
      expect(line.ruleDescription.length).toBeGreaterThan(0);
    }
  });
});

describe("selezioni dipendenti dall'input", () => {
  it("mano DESTRA → cerniera femmina/braccio/incontro ribalta/copertura in variante DX", () => {
    const lines = artechAntaRibaltaApplicare.generate({ ...golden, openingSide: "DESTRA" });
    const codes = lines.map((l) => l.code);
    expect(codes).not.toContain("A514SX.05.65"); // la variante SX sparisce
    expect(codes).not.toContain("A50911.36.02");
    expect(codes).not.toContain("A51922.36.02");
    expect(codes).not.toContain("A51326.02.21");
    expect(lines).toHaveLength(20); // stessa struttura, codici DX
  });

  it("altezza fuori dal range cremonese più alto → KitGenerationError esplicito", () => {
    expect(() => artechAntaRibaltaApplicare.generate({ ...golden, heightMm: 3000 })).toThrow(
      KitGenerationError,
    );
  });

  it("larghezza sotto il primo scaglione forbice → errore tipato, mai kit silenzioso", () => {
    expect(() => artechAntaRibaltaApplicare.generate({ ...golden, widthMm: 300 })).toThrow(
      KitGenerationError,
    );
  });

  it("bordi del range forbice golden: 476 e 604 inclusi, 475 e 605 fuori scaglione", () => {
    const at = (w: number) =>
      artechAntaRibaltaApplicare.generate({ ...golden, widthMm: w }).find((l) => l.position === "forbice-corpo")!.code;
    expect(at(476)).toBe("A50510.00.02");
    expect(at(604)).toBe("A50510.00.02");
    expect(at(605)).not.toBe("A50510.00.02"); // scaglione successivo (o errore se assente)
  });

  it("incontri nottolino: quantità cresce con l'altezza a scatti del passo 600", () => {
    const qtyAt = (h: number) =>
      artechAntaRibaltaApplicare.generate({ ...golden, heightMm: h }).find((l) => l.code === "A51401.05.02")!.quantity;
    expect(qtyAt(1820)).toBe(5); // golden
    expect(qtyAt(1820 - 600)).toBeLessThan(5); // uno scatto in meno
  });
});
```

NB: il test `605` e le soglie degli scatti vanno adeguati alle tabelle reali
estratte allo Step 0 (se lo scaglione successivo inizia a 605 o altrove) — il
principio (bordi inclusivi + scatto al passo) resta.

- [ ] **Step 2: FAIL** — `pnpm vitest run src/server/kit/rules-artech.test.ts`

- [ ] **Step 3: Implementa rules-artech.ts**

Struttura obbligata (dati `as const` in testa, funzioni pure sotto, generate in fondo). Le tabelle mostrate contengono le entry golden certe: **completare ogni tabella con le varianti estratte allo Step 0** (stesse shape).

```ts
// Regole kit ARTECH anta-ribalta «ad applicare» — Fase 1d (ADR 2026-07-04).
// FONTE: Distinta Commerciale AGB 16/11/2021 (golden) + varianti dal listino 2026.
// Le voci marcate ASSUNZIONE non sono derivabili dall'unica distinta e si
// correggono alla prossima distinta reale.
import {
  KitGenerationError,
  PILOT,
  type KitInput,
  type KitLine,
  type RuleModule,
} from "./types";

type Side = KitInput["openingSide"];

// ── Tabelle dati (completare dallo Step 0) ────────────────────────────────
// ASSUNZIONE: estremi min/max inclusivi su tutti i range.

/** Cremonese A/R per range altezza anta (entrata E15). */
const CREMONESI = [
  // { minH: ..., maxH: 1593, code: "..." },  ← dalle varianti estratte
  { minH: 1594, maxH: 1810, code: "A50122.15.07" }, // golden — NB: H golden 1820 > 1810:
  // la scelta AGB reale usa l'altezza MANIGLIA derivata, non H anta pura.
  // ASSUNZIONE: la cremonese si sceglie sul range che contiene (H - 210) ≈ quota maniglia;
  // con H=1820 → 1610 ∈ [1594,1810]. Verificare col listino/prossima distinta.
] as const;

/** Corpo forbice per range larghezza anta. */
const FORBICI = [
  { minL: 476, maxL: 604, code: "A50510.00.02" }, // golden
  // ...varianti estratte (es. 380-475, 605-...)
] as const;

/** Componenti dipendenti da mano + asse/battuta (I13 B20 = golden). */
const PER_MANO: Record<Side, { cernieraFemmina: string; braccio: string; incontroRibalta: string; copFemmina: string }> = {
  SINISTRA: {
    cernieraFemmina: "A50911.36.02",
    braccio: "A51922.36.02",
    incontroRibalta: "A514SX.05.65",
    copFemmina: "A51326.02.21",
  },
  DESTRA: {
    // dallo Step 0 (varianti DX dei medesimi nomi prodotto)
    cernieraFemmina: "A50911.36.01", // ← VERIFICARE codice reale DX
    braccio: "A51922.36.01",         // ← VERIFICARE
    incontroRibalta: "A514DX.05.65", // ← VERIFICARE
    copFemmina: "A51326.01.21",      // ← VERIFICARE
  },
};

/** Componenti fissi del sistema (indipendenti da dimensioni e mano). */
const FISSI = [
  { position: "movimento-angolare", code: "A50302.01.02", quantity: 2, descr: "Movimento angolare 125x125" },
  { position: "supporto-forbice", code: "A50711.00.00", quantity: 1, descr: "Supporto forbice perni 3x3" },
  { position: "perno-supporto-forbice", code: "A50790.00.00", quantity: 1, descr: "Perno supporto forbice" },
  { position: "cerniera-maschio", code: "A50811.07.00", quantity: 1, descr: "Cerniera maschio perni 3x3" },
  { position: "incontro-dss", code: "A51400.05.03", quantity: 1, descr: "Incontro DSS aria 12 interasse 9" },
] as const;

/** Coperture kit per finitura (golden: ARGENTO → suffisso .21). */
const COPERTURE_KIT: Record<string, readonly { position: string; code: string; descr: string }[]> = {
  ARGENTO: [
    { position: "cop-supporto-forbice", code: "A51328.00.21", descr: "Copertura supporto forbice" },
    { position: "cop-angolo-forbice", code: "A51330.00.21", descr: "Copertura angolo forbice" },
    { position: "cop-maschio-inferiore", code: "A51331.00.21", descr: "Copertura inferiore maschio" },
    { position: "cop-maschio-superiore", code: "A51332.00.21", descr: "Copertura superiore maschio" },
  ],
  // ...altre finiture dallo Step 0 (suffissi diversi)
};

/** Chiusure supplementari verticali (passo 600) per range altezza. */
const CHIUSURE_VERTICALI = [
  // ASSUNZIONE: composizione per fascia di H; golden H=1820 → angolo L185 +
  // prolunga L200 + prolunga L600 + terminale L600. Fasce adiacenti da
  // derivare dalle lunghezze disponibili a listino (L185/L200/L600/...).
  {
    minH: 1520, maxH: 2120,
    parts: [
      { position: "chiusura-angolo", code: "A50330.00.00", quantity: 1, descr: "Angolo chiusura supplementare L185" },
      { position: "chiusura-prolunga-200", code: "A51801.00.01", quantity: 1, descr: "Prolunga L200" },
      { position: "chiusura-prolunga-600", code: "A51803.00.03", quantity: 1, descr: "Prolunga L600" },
      { position: "chiusura-terminale", code: "A50401.00.03", quantity: 1, descr: "Terminale chiusura supplementare L600" },
    ],
  },
] as const;

// ── Funzioni pure ─────────────────────────────────────────────────────────

/**
 * Numero incontri nottolino perimetrali.
 * ASSUNZIONE (da golden L550/H1820 → 5): 2 lato cerniere + scatti passo 600
 * sul lato serratura + 1 in traversa: 1 + floor(H/600) + floor(L/600) + 1.
 * Con golden: 1 + 3 + 0 + 1 = 5. ceil vs floor indistinguibile da n=1.
 */
function incontriNottolino(widthMm: number, heightMm: number): number {
  return 2 + Math.floor(heightMm / PILOT.passoVerticaleMm) + Math.floor(widthMm / PILOT.passoVerticaleMm);
}

function pick<T extends { minH?: number; maxH?: number; minL?: number; maxL?: number }>(
  table: readonly T[],
  value: number,
  kind: "H" | "L",
  ruleId: string,
  label: string,
): T {
  const hit = table.find((row) =>
    kind === "H"
      ? value >= (row.minH ?? 0) && value <= (row.maxH ?? Infinity)
      : value >= (row.minL ?? 0) && value <= (row.maxL ?? Infinity),
  );
  if (!hit)
    throw new KitGenerationError(
      `Nessuna variante ${label} per ${kind === "H" ? "altezza" : "larghezza"} ${value} mm: fuori campo di applicazione ARTECH.`,
      ruleId,
    );
  return hit;
}

// ── Modulo ────────────────────────────────────────────────────────────────

export const artechAntaRibaltaApplicare: RuleModule = {
  engineId: "artech-ar-applicare",
  generate(input: KitInput): KitLine[] {
    const lines: KitLine[] = [];
    const finish = input.finish.toUpperCase();

    const coperture = COPERTURE_KIT[finish];
    if (!coperture)
      throw new KitGenerationError(`Finitura "${input.finish}" non disponibile per le coperture ARTECH.`, "artech.coperture");

    // ASSUNZIONE quota maniglia = H - 210 (vedi commento tabella CREMONESI)
    const cremonese = pick(CREMONESI, input.heightMm - 210, "H", "artech.cremonese", "cremonese");
    lines.push({ position: "cremonese", code: cremonese.code, quantity: 1, ruleId: "artech.cremonese", ruleDescription: `Cremonese A/R per altezza anta ${input.heightMm} mm` });

    const forbice = pick(FORBICI, input.widthMm, "L", "artech.forbice", "corpo forbice");
    lines.push({ position: "forbice-corpo", code: forbice.code, quantity: 1, ruleId: "artech.forbice", ruleDescription: `Corpo forbice per larghezza anta ${input.widthMm} mm` });

    const mano = PER_MANO[input.openingSide];
    lines.push(
      { position: "cerniera-femmina", code: mano.cernieraFemmina, quantity: 1, ruleId: "artech.mano", ruleDescription: `Cerniera femmina applicare asse ${input.axisOffsetMm} battuta ${input.rebateMm} ${input.openingSide}` },
      { position: "forbice-braccio", code: mano.braccio, quantity: 1, ruleId: "artech.mano", ruleDescription: `Braccio forbice ${input.openingSide}` },
      { position: "incontro-ribalta", code: mano.incontroRibalta, quantity: 1, ruleId: "artech.mano", ruleDescription: `Incontro ribalta aria ${input.airGapMm} ${input.openingSide}` },
      { position: "cop-femmina", code: mano.copFemmina, quantity: 1, ruleId: "artech.coperture", ruleDescription: `Copertura cerniera femmina ${input.openingSide} ${finish}` },
    );

    for (const part of FISSI)
      lines.push({ position: part.position, code: part.code, quantity: part.quantity, ruleId: "artech.fissi", ruleDescription: part.descr });

    for (const cop of coperture)
      lines.push({ position: cop.position, code: cop.code, quantity: 1, ruleId: "artech.coperture", ruleDescription: `${cop.descr} ${finish}` });

    lines.push({ position: "incontri-nottolino", code: "A51401.05.02", quantity: incontriNottolino(input.widthMm, input.heightMm), ruleId: "artech.incontri", ruleDescription: `Incontri nottolino sede ${input.seatMm} (passo ${PILOT.passoVerticaleMm} mm)` });

    const verticali = pick(CHIUSURE_VERTICALI, input.heightMm, "H", "artech.verticali", "chiusure verticali");
    for (const part of verticali.parts)
      lines.push({ position: part.position, code: part.code, quantity: part.quantity, ruleId: "artech.verticali", ruleDescription: part.descr });

    return lines;
  },
};
```

NB per il worker: (1) i codici `← VERIFICARE` e le tabelle vanno completati con
l'output dello Step 0 PRIMA di far girare i test; (2) la formula
`incontriNottolino` e la quota maniglia `H-210` sono ASSUNZIONI calibrate sul
golden: se lo Step 0 o il listino suggeriscono una regola diversa che spiega
ugualmente il golden, usarla e aggiornare i commenti; (3) l'incontro nottolino
`A51401.05.02` copre sede 18/22/35 — se il catalogo ha varianti per altre sedi,
tabellarle per `seatMm`.

- [ ] **Step 4: PASS golden + boundary** — `pnpm vitest run src/server/kit/rules-artech.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/
git commit -m "feat(kit): regole ARTECH anta-ribalta ad applicare — golden test sulla distinta reale"
```

---

### Task 3: Registry + selezione template + seed

**Files:**
- Create: `src/server/kit/registry.ts`
- Create: `prisma/seed-kit.ts`
- Modify: `package.json` (script `db:seed:kit`)
- Test: `src/server/kit/registry.test.ts`

**Interfaces:**
- Consumes: `RuleModule` (Task 1), `artechAntaRibaltaApplicare` (Task 2).
- Produces:
  - `templateRulesSchema` (zod): SOLO `{ engine: string, version: number }` — shape diversa → errore («fonte di verità = codice», ADR).
  - `resolveRuleModule(rules: unknown): RuleModule` — lancia `KitGenerationError` se puntatore malformato o engine non registrato.
  - `RULE_MODULES: Record<string, RuleModule>` con `"artech-ar-applicare"`.
  - Seed idempotente: `KitTemplate { name: "ARTECH anta-ribalta ad applicare", windowType: ANTA_RIBALTA, series: "ARTECH", material: null (vale per tutti i materiali pilota), rules: {engine:"artech-ar-applicare",version:1}, isActive: true, priority: 10 }` (upsert per nome).

- [ ] **Step 1: Test (falliranno)**

`src/server/kit/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRuleModule, RULE_MODULES } from "./registry";

describe("registry moduli regole", () => {
  it("risolve il puntatore ARTECH al modulo registrato", () => {
    const module_ = resolveRuleModule({ engine: "artech-ar-applicare", version: 1 });
    expect(module_.engineId).toBe("artech-ar-applicare");
  });

  it("engine non registrato → errore esplicito", () => {
    expect(() => resolveRuleModule({ engine: "eclipse-v9", version: 1 })).toThrow(/eclipse-v9/);
  });

  it("shape non-puntatore (regole JSON legacy) → errore, la fonte di verità è il codice", () => {
    expect(() => resolveRuleModule({ positions: [{ code: "X" }] })).toThrow(/puntatore/i);
  });

  it("ogni modulo registrato ha engineId coerente con la chiave", () => {
    for (const [key, module_] of Object.entries(RULE_MODULES)) expect(module_.engineId).toBe(key);
  });
});
```

- [ ] **Step 2: FAIL**, poi **Step 3: implementa registry.ts**

```ts
import { z } from "zod";
import { KitGenerationError, type RuleModule } from "./types";
import { artechAntaRibaltaApplicare } from "./rules-artech";

/**
 * KitTemplate.rules a DB è SOLO un puntatore versionato al modulo regole in
 * codice (ADR 2026-07-04). Qualsiasi altra shape è un errore: la fonte di
 * verità delle regole è git, mai il DB.
 */
export const templateRulesSchema = z.object({
  engine: z.string().min(1),
  version: z.number().int().min(1),
});

export const RULE_MODULES: Record<string, RuleModule> = {
  [artechAntaRibaltaApplicare.engineId]: artechAntaRibaltaApplicare,
};

export function resolveRuleModule(rules: unknown): RuleModule {
  const parsed = templateRulesSchema.safeParse(rules);
  if (!parsed.success)
    throw new KitGenerationError(
      "Template kit non valido: rules deve essere il puntatore {engine, version}.",
    );
  const module_ = RULE_MODULES[parsed.data.engine];
  if (!module_)
    throw new KitGenerationError(
      `Nessun modulo regole registrato per engine "${parsed.data.engine}".`,
    );
  return module_;
}
```

`prisma/seed-kit.ts` (pattern seed-catalog: client proprio, idempotente):

```ts
// Seed template kit: pnpm db:seed:kit
import { PrismaClient } from "@prisma/client";

export async function seedKitTemplates(db: PrismaClient) {
  const existing = await db.kitTemplate.findFirst({
    where: { name: "ARTECH anta-ribalta ad applicare" },
  });
  const data = {
    name: "ARTECH anta-ribalta ad applicare",
    description: "Pilota Fase 1d — finestra, mano SX/DX, verticali passo 600.",
    windowType: "ANTA_RIBALTA" as const,
    series: "ARTECH",
    rules: { engine: "artech-ar-applicare", version: 1 },
    isActive: true,
    priority: 10,
  };
  if (existing) await db.kitTemplate.update({ where: { id: existing.id }, data });
  else await db.kitTemplate.create({ data });
  console.log("✓ KitTemplate ARTECH anta-ribalta (engine artech-ar-applicare)");
}

const isMain = process.argv[1]?.endsWith("seed-kit.ts");
if (isMain) {
  const db = new PrismaClient();
  seedKitTemplates(db)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
```

`package.json`: `"db:seed:kit": "tsx prisma/seed-kit.ts",` sotto `db:seed:catalog`.

- [ ] **Step 4: PASS + seed reale + commit**

```bash
pnpm vitest run src/server/kit/registry.test.ts
set -a; source .env; set +a; pnpm db:seed:kit   # → ✓ KitTemplate ARTECH...
git add src/server/kit/registry.ts src/server/kit/registry.test.ts prisma/seed-kit.ts package.json
git commit -m "feat(kit): registry puntatore→modulo e seed KitTemplate ARTECH"
```

---

### Task 4: Engine (pipeline + risoluzione prodotti/prezzi)

**Files:**
- Create: `src/server/kit/engine.ts`
- Test: `src/server/kit/engine.test.ts`

**Interfaces:**
- Consumes: `kitInputSchema`/`KitInput`/`KitLine`/`KitGenerationError` (Task 1), `resolveRuleModule` (Task 3).
- Produces:
  - `interface PricedKitLine extends KitLine { productId: string | null; name: string | null; unitPrice: number | null; totalPrice: number | null }`
  - `interface KitOutput { lines: PricedKitLine[]; totalPrice: number; totalComponents: number; warnings: string[]; templateId: string; engineVersion: string }`
  - `class KitEngine { constructor(db: Pick<PrismaClient, "kitTemplate" | "product">); generate(rawInput: unknown): Promise<KitOutput> }` — `ENGINE_VERSION = "1d.1"`.
  - Comportamento: input invalido → `KitGenerationError` con dettagli zod; nessun template attivo per (windowType, series, material|null) → `KitGenerationError`; codice non a listino → riga con `productId/unitPrice: null` + warning `Codice X non a listino: verificare con AGB.` (kit comunque generato); `totalPrice` somma solo righe prezzate.

- [ ] **Step 1: Test (falliranno)**

`src/server/kit/engine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KitEngine } from "./engine";

const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const db = {
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
} as never;

const validInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "ALLUMINIO",
  airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
};

const template = { id: "t1", rules: { engine: "artech-ar-applicare", version: 1 } };

beforeEach(() => {
  templateFindFirst.mockReset();
  productFindMany.mockReset();
});

describe("KitEngine.generate", () => {
  it("input invalido → KitGenerationError (messaggio italiano)", async () => {
    const engine = new KitEngine(db);
    await expect(engine.generate({ ...validInput, widthMm: 10 })).rejects.toThrow(/non valid/i);
  });

  it("nessun template attivo → errore esplicito", async () => {
    templateFindFirst.mockResolvedValue(null);
    const engine = new KitEngine(db);
    await expect(engine.generate(validInput)).rejects.toThrow(/template/i);
  });

  it("genera, prezza dal catalogo e somma i totali", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve(
        (where.agbCode.in as string[]).map((code: string) => ({
          id: "p_" + code, agbCode: code, name: "Prodotto " + code,
          basePrice: { toString: () => "2.000" },
        })),
      ),
    );
    const engine = new KitEngine(db);
    const output = await engine.generate(validInput);
    expect(output.lines.length).toBe(20);
    expect(output.totalComponents).toBe(20);
    expect(output.warnings).toEqual([]);
    const incontri = output.lines.find((l) => l.code === "A51401.05.02")!;
    expect(incontri.quantity).toBe(5);
    expect(incontri.totalPrice).toBeCloseTo(10);
    expect(output.totalPrice).toBeCloseTo(2 * 24);
    expect(output.templateId).toBe("t1");
  });

  it("codice mancante a listino → warning, riga senza prezzo, kit comunque generato", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve(
        (where.agbCode.in as string[])
          .filter((code: string) => code !== "A50122.15.07")
          .map((code: string) => ({ id: "p_" + code, agbCode: code, name: code, basePrice: { toString: () => "1" } })),
      ),
    );
    const engine = new KitEngine(db);
    const output = await engine.generate(validInput);
    const missing = output.lines.find((l) => l.code === "A50122.15.07")!;
    expect(missing.productId).toBeNull();
    expect(output.warnings.join(" ")).toContain("A50122.15.07");
  });

  it("seleziona il template per windowType/series/material con priority", async () => {
    templateFindFirst.mockResolvedValue(template);
    productFindMany.mockResolvedValue([]);
    const engine = new KitEngine(db);
    await engine.generate(validInput);
    expect(templateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          windowType: "ANTA_RIBALTA",
          series: "ARTECH",
        }),
        orderBy: { priority: "desc" },
      }),
    );
  });
});
```

- [ ] **Step 2: FAIL**, poi **Step 3: implementa engine.ts**

```ts
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { KitGenerationError, kitInputSchema, type KitLine } from "./types";
import { resolveRuleModule } from "./registry";

export const ENGINE_VERSION = "1d.1";

export interface PricedKitLine extends KitLine {
  productId: string | null;
  name: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface KitOutput {
  lines: PricedKitLine[];
  totalPrice: number;
  totalComponents: number;
  warnings: string[];
  templateId: string;
  engineVersion: string;
}

type KitDb = Pick<PrismaClient, "kitTemplate" | "product">;

/**
 * Pipeline deterministica: VALIDATE → SELECT TEMPLATE → APPLY RULES →
 * risoluzione prodotti/prezzi dal catalogo. MAI LLM. Nessun raw SQL.
 */
export class KitEngine {
  constructor(private readonly db: KitDb) {}

  async generate(rawInput: unknown): Promise<KitOutput> {
    const parsed = kitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new KitGenerationError(`Specifiche non valide — ${details}`);
    }
    const input = parsed.data;

    const template = await this.db.kitTemplate.findFirst({
      where: {
        isActive: true,
        windowType: input.windowType,
        series: input.series,
        OR: [{ material: null }, { material: input.material }],
      },
      orderBy: { priority: "desc" },
    });
    if (!template)
      throw new KitGenerationError(
        `Nessun template kit attivo per ${input.windowType} / ${input.series} / ${input.material}.`,
      );

    const lines = resolveRuleModule(template.rules).generate(input);

    const products = await this.db.product.findMany({
      where: { agbCode: { in: lines.map((line) => line.code) } },
      select: { id: true, agbCode: true, name: true, basePrice: true },
    });
    const byCode = new Map(products.map((p) => [p.agbCode, p]));

    const warnings: string[] = [];
    const priced: PricedKitLine[] = lines.map((line) => {
      const product = byCode.get(line.code);
      if (!product) {
        warnings.push(`Codice ${line.code} non a listino: verificare con AGB.`);
        return { ...line, productId: null, name: null, unitPrice: null, totalPrice: null };
      }
      const unitPrice = Number(product.basePrice);
      return {
        ...line,
        productId: product.id,
        name: product.name,
        unitPrice,
        totalPrice: unitPrice * line.quantity,
      };
    });

    return {
      lines: priced,
      totalPrice: priced.reduce((sum, line) => sum + (line.totalPrice ?? 0), 0),
      totalComponents: priced.length,
      warnings,
      templateId: template.id,
      engineVersion: ENGINE_VERSION,
    };
  }
}
```

- [ ] **Step 4: PASS + commit**

```bash
git add src/server/kit/engine.ts src/server/kit/engine.test.ts
git commit -m "feat(kit): KitEngine — pipeline validate/select/apply + prezzi da catalogo"
```

---

### Task 5: Router tRPC kit + wiring

**Files:**
- Create: `src/server/api/routers/kit.ts`
- Modify: `src/server/api/root.ts` (`kit: kitRouter`)
- Test: `src/server/api/routers/kit.test.ts`

**Interfaces:**
- Consumes: `KitEngine`/`KitOutput` (Task 4), `kitInputSchema` (Task 1), `agentProcedure`.
- Produces (tutte AGENT, ownership su `agentId`):
  - `kit.create(kitInput) → { id, requestNumber }` — `requestNumber` = `KIT-YYYY-NNNN` (progressivo per anno via `count` nell'anno corrente + 1), status DRAFT, ActivityLog `KIT_REQUEST_CREATED`.
  - `kit.generate({ kitRequestId }) → KitOutput` — ownership; engine; su successo transazione: `deleteMany` vecchi componenti → `createMany` righe prezzate (`componentCode/componentName/position/quantity/unitPrice/totalPrice/ruleId/ruleDescription/sortOrder`, solo righe con productId; le righe senza prezzo restano solo nel JSON) → update `KitRequest { generatedKit: output, totalComponents, totalPrice, status: COMPLETED, generatedAt }`; ActivityLog `KIT_GENERATED`. Su `KitGenerationError` → update `status: REJECTED, notes+=errore`? NO — YAGNI: lascia DRAFT e rilancia `TRPCError BAD_REQUEST` col messaggio italiano (il form mostra l'errore, l'agente corregge).
  - `kit.get({ id }) → KitRequest + components (con product) + generatedKit`.
  - `kit.list({ limit?, offset? }) → { items, total }` proprie, `createdAt desc`.

- [ ] **Step 1: Test (falliranno)** — pattern `chat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { kitRouter } from "./kit";

const appRouter = createTRPCRouter({ kit: kitRouter });

const requestCreate = vi.fn();
const requestFindFirst = vi.fn();
const requestFindMany = vi.fn();
const requestUpdate = vi.fn();
const requestCount = vi.fn();
const componentDeleteMany = vi.fn();
const componentCreateMany = vi.fn();
const templateFindFirst = vi.fn();
const productFindMany = vi.fn();
const activityCreate = vi.fn();
const transaction = vi.fn();

const dbStub = {
  kitRequest: { create: requestCreate, findFirst: requestFindFirst, findMany: requestFindMany, update: requestUpdate, count: requestCount },
  kitComponent: { deleteMany: componentDeleteMany, createMany: componentCreateMany },
  kitTemplate: { findFirst: templateFindFirst },
  product: { findMany: productFindMany },
  activityLog: { create: activityCreate },
};

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: { ...dbStub, $transaction: transaction },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

const validInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "ALLUMINIO",
  airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
} as const;

beforeEach(() => {
  for (const fn of [requestCreate, requestFindFirst, requestFindMany, requestUpdate, requestCount, componentDeleteMany, componentCreateMany, templateFindFirst, productFindMany, activityCreate, transaction]) {
    fn.mockReset();
  }
  activityCreate.mockResolvedValue({});
  transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
});

describe("kit.create", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.kit.create(validInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("crea DRAFT con requestNumber KIT-YYYY-NNNN e logga", async () => {
    requestCount.mockResolvedValue(41);
    requestCreate.mockImplementation(({ data }) => Promise.resolve({ id: "k1", ...data }));
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const created = await caller.kit.create(validInput);
    const year = new Date().getFullYear();
    expect(created.requestNumber).toBe(`KIT-${year}-0042`);
    expect(requestCreate.mock.calls[0]![0].data).toMatchObject({
      agentId: "agent1", status: "DRAFT", widthMm: 550, series: "ARTECH",
    });
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "KIT_REQUEST_CREATED" }),
    });
  });

  it("input invalido → BAD_REQUEST", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.create({ ...validInput, widthMm: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("kit.generate", () => {
  it("richiesta altrui → NOT_FOUND", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "altrui" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("errore regole (fuori campo applicazione) → BAD_REQUEST italiano, resta DRAFT", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", agentId: "agent1", ...validInput, heightMm: 3000, status: "DRAFT" });
    templateFindFirst.mockResolvedValue({ id: "t1", rules: { engine: "artech-ar-applicare", version: 1 } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.generate({ kitRequestId: "k1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("successo → persiste componenti + stato COMPLETED + KIT_GENERATED", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", agentId: "agent1", ...validInput, status: "DRAFT" });
    templateFindFirst.mockResolvedValue({ id: "t1", rules: { engine: "artech-ar-applicare", version: 1 } });
    productFindMany.mockImplementation(({ where }) =>
      Promise.resolve((where.agbCode.in as string[]).map((code: string) => ({
        id: "p_" + code, agbCode: code, name: "N " + code, basePrice: { toString: () => "1.5" },
      }))),
    );
    componentDeleteMany.mockResolvedValue({});
    componentCreateMany.mockResolvedValue({});
    requestUpdate.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const output = await caller.kit.generate({ kitRequestId: "k1" });
    expect(output.lines).toHaveLength(20);
    expect(componentCreateMany).toHaveBeenCalled();
    const rows = componentCreateMany.mock.calls[0]![0].data;
    expect(rows[0]).toMatchObject({ kitRequestId: "k1", componentCode: expect.any(String), ruleId: expect.any(String) });
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", totalComponents: 20 }) }),
    );
    expect(activityCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "KIT_GENERATED" }) });
  });
});

describe("kit.list / kit.get", () => {
  it("lista solo le proprie richieste", async () => {
    requestFindMany.mockResolvedValue([]);
    requestCount.mockResolvedValue(0);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.list({});
    expect(requestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agentId: "agent1" }, orderBy: { createdAt: "desc" } }),
    );
  });

  it("get con ownership → NOT_FOUND se altrui", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.get({ id: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 2: FAIL**, poi **Step 3: implementa kit.ts**

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { KitEngine } from "@/server/kit/engine";
import { KitGenerationError, kitInputSchema } from "@/server/kit/types";

function toTRPC(error: unknown): never {
  if (error instanceof KitGenerationError)
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw error;
}

export const kitRouter = createTRPCRouter({
  create: agentProcedure.input(kitInputSchema).mutation(async ({ ctx, input }) => {
    const year = new Date().getFullYear();
    const inYear = await ctx.db.kitRequest.count({
      where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
    });
    const requestNumber = `KIT-${year}-${String(inYear + 1).padStart(4, "0")}`;
    const { notes, ...specs } = input;
    const request = await ctx.db.kitRequest.create({
      data: {
        ...specs,
        notes: notes ?? null,
        requestNumber,
        status: "DRAFT",
        agentId: ctx.session.user.id,
      },
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "KIT_REQUEST_CREATED",
        description: `Richiesta kit ${requestNumber}`,
        resourceType: "kit_request",
        resourceId: request.id,
      },
    });
    return { id: request.id, requestNumber };
  }),

  generate: agentProcedure
    .input(z.object({ kitRequestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.kitRequestId, agentId: ctx.session.user.id },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

      const engine = new KitEngine(ctx.db);
      const output = await engine
        .generate({
          windowType: request.windowType,
          widthMm: request.widthMm,
          heightMm: request.heightMm,
          material: request.material,
          airGapMm: request.airGapMm,
          axisOffsetMm: request.axisOffsetMm,
          rebateMm: request.rebateMm,
          seatMm: request.seatMm,
          openingSide: request.openingSide,
          openingDir: request.openingDir,
          finish: request.finish,
          series: request.series,
          notes: request.notes ?? undefined,
        })
        .catch(toTRPC);

      const rows = output.lines
        .filter((line) => line.productId !== null)
        .map((line, index) => ({
          kitRequestId: request.id,
          productId: line.productId!,
          componentCode: line.code,
          componentName: line.name ?? line.code,
          position: line.position,
          quantity: line.quantity,
          unitPrice: line.unitPrice!,
          totalPrice: line.totalPrice!,
          ruleId: line.ruleId,
          ruleDescription: line.ruleDescription,
          sortOrder: index,
        }));

      await ctx.db.$transaction([
        ctx.db.kitComponent.deleteMany({ where: { kitRequestId: request.id } }),
        ctx.db.kitComponent.createMany({ data: rows }),
        ctx.db.kitRequest.update({
          where: { id: request.id },
          data: {
            generatedKit: JSON.parse(JSON.stringify(output)),
            totalComponents: output.totalComponents,
            totalPrice: output.totalPrice,
            status: "COMPLETED",
            generatedAt: new Date(),
          },
        }),
      ]);
      await ctx.db.activityLog.create({
        data: {
          userId: ctx.session.user.id,
          type: "KIT_GENERATED",
          description: `Kit generato per ${request.requestNumber} (${output.totalComponents} componenti)`,
          resourceType: "kit_request",
          resourceId: request.id,
        },
      });
      return output;
    }),

  get: agentProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const request = await ctx.db.kitRequest.findFirst({
      where: { id: input.id, agentId: ctx.session.user.id },
      include: { components: { orderBy: { sortOrder: "asc" } } },
    });
    if (!request)
      throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });
    return {
      ...request,
      totalPrice: request.totalPrice === null ? null : Number(request.totalPrice),
      components: request.components.map((component) => ({
        ...component,
        unitPrice: Number(component.unitPrice),
        totalPrice: Number(component.totalPrice),
      })),
    };
  }),

  list: agentProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .partial()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        ctx.db.kitRequest.findMany({
          where: { agentId: ctx.session.user.id },
          orderBy: { createdAt: "desc" },
          take: input.limit ?? 20,
          skip: input.offset ?? 0,
          select: {
            id: true, requestNumber: true, windowType: true, series: true, material: true,
            widthMm: true, heightMm: true, status: true, totalComponents: true,
            totalPrice: true, createdAt: true,
          },
        }),
        ctx.db.kitRequest.count({ where: { agentId: ctx.session.user.id } }),
      ]);
      return {
        items: items.map((item) => ({
          ...item,
          totalPrice: item.totalPrice === null ? null : Number(item.totalPrice),
        })),
        total,
      };
    }),
});
```

`src/server/api/root.ts`: aggiungi `import { kitRouter } from "@/server/api/routers/kit";` e `kit: kitRouter,`.

- [ ] **Step 4: PASS suite api + typecheck + commit**

```bash
pnpm vitest run src/server/api && pnpm typecheck
git add src/server/api/
git commit -m "feat(kit): router tRPC kit — create/generate/get/list con persistenza distinta"
```

---

### Task 6: UI — lista richieste + dettaglio distinta

**Files:**
- Create: `src/app/(dashboard)/richieste/page.tsx`, `richieste-client.tsx`
- Create: `src/app/(dashboard)/richieste/[id]/page.tsx`, `dettaglio-client.tsx`
- Create: `src/components/kit/status-badge.tsx`, `src/components/kit/distinta-table.tsx`
- Test: `src/components/kit/distinta-table.test.tsx`, `src/components/kit/status-badge.test.tsx`

**Interfaces:**
- Consumes: `api.kit.list/get/generate`, `CopyCodeButton`, `formatPrice`, `cn`.
- Produces: pagina `/richieste` (tabella: numero mono, data it-IT, tipologia/serie, dimensioni, stato badge, totale; vuoto con CTA «Nuova richiesta»); `/richieste/[id]` (riepilogo specifiche + `DistintaTable` + warnings + bottone «Rigenera»). `StatusBadge({status})` colori: DRAFT grigio, COMPLETED verde, REJECTED rosso, altri brand-light. `DistintaTable({components, totalPrice, warnings?})` — righe: posizione, codice mono+copia, nome, qty, prezzo unit., totale; footer totale kit.

Sviluppo con **/impeccable** (regola utente); pattern esistenti di `archivio` (skeleton, empty state, `role="alert"` per errori).

- [ ] **Step 1: Test componenti (falliranno)**

`src/components/kit/distinta-table.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DistintaTable } from "./distinta-table";

afterEach(cleanup);

const components = [
  { id: "c1", componentCode: "A50122.15.07", componentName: "CREMONESE ARTECH", position: "cremonese", quantity: 1, unitPrice: 13.655, totalPrice: 13.655, ruleDescription: "Cremonese per H 1820" },
  { id: "c2", componentCode: "A51401.05.02", componentName: "INC NOTT", position: "incontri-nottolino", quantity: 5, unitPrice: 0.677, totalPrice: 3.385, ruleDescription: "Incontri nottolino" },
];

describe("DistintaTable", () => {
  it("mostra codici mono, quantità e totale kit", () => {
    render(<DistintaTable components={components} totalPrice={17.04} warnings={[]} />);
    expect(screen.getByText("A50122.15.07")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText(/17,04/)).toBeTruthy();
  });

  it("mostra i warning quando presenti", () => {
    render(<DistintaTable components={components} totalPrice={0} warnings={["Codice X non a listino: verificare con AGB."]} />);
    expect(screen.getByRole("alert").textContent).toContain("non a listino");
  });
});
```

`src/components/kit/status-badge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("etichette italiane per gli stati principali", () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText("Bozza")).toBeTruthy();
    cleanup();
    render(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText("Completato")).toBeTruthy();
  });
});
```

- [ ] **Step 2: FAIL**, poi **Step 3: implementa** (codice conciso, pattern archivio):

`src/components/kit/status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

const LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Bozza", className: "bg-surface-sunken text-ink-subtle" },
  PENDING_GENERATION: { label: "In coda", className: "bg-brand-light text-brand" },
  GENERATING: { label: "In generazione", className: "bg-brand-light text-brand" },
  COMPLETED: { label: "Completato", className: "bg-success/10 text-success" },
  REVIEWED: { label: "Revisionato", className: "bg-success/10 text-success" },
  SENT_TO_CUSTOMER: { label: "Inviato", className: "bg-brand-light text-brand" },
  APPROVED: { label: "Approvato", className: "bg-success/10 text-success" },
  REJECTED: { label: "Rifiutato", className: "bg-error/10 text-error" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = LABELS[status] ?? { label: status, className: "bg-surface-sunken text-ink-subtle" };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", entry.className)}>
      {entry.label}
    </span>
  );
}
```

`src/components/kit/distinta-table.tsx`:

```tsx
import { CopyCodeButton } from "@/components/product/copy-code-button";
import { formatPrice } from "@/lib/format";

export interface DistintaComponent {
  id: string;
  componentCode: string;
  componentName: string;
  position: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  ruleDescription: string | null;
}

export function DistintaTable({
  components,
  totalPrice,
  warnings,
}: {
  components: DistintaComponent[];
  totalPrice: number;
  warnings: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {warnings.length > 0 && (
        <div role="alert" className="rounded border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-sunken text-left text-xs font-semibold uppercase text-ink-subtle">
              <th className="px-4 py-2.5">Posizione</th>
              <th className="px-4 py-2.5">Codice</th>
              <th className="px-4 py-2.5">Componente</th>
              <th className="px-4 py-2.5 text-right">Qtà</th>
              <th className="px-4 py-2.5 text-right">Prezzo</th>
              <th className="px-4 py-2.5 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id} className="border-t border-line hover:bg-surface-sunken/50">
                <td className="px-4 py-2 text-ink-subtle">{component.position}</td>
                <td className="px-4 py-2">
                  <CopyCodeButton code={component.componentCode} />
                </td>
                <td className="px-4 py-2 text-ink" title={component.ruleDescription ?? undefined}>
                  {component.componentName}
                </td>
                <td className="px-4 py-2 text-right font-medium text-ink">{component.quantity}</td>
                <td className="px-4 py-2 text-right text-ink">{formatPrice(component.unitPrice)}</td>
                <td className="px-4 py-2 text-right font-medium text-ink">{formatPrice(component.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong bg-surface-sunken font-semibold text-ink">
              <td colSpan={5} className="px-4 py-2.5 text-right">Totale kit</td>
              <td className="px-4 py-2.5 text-right">{formatPrice(totalPrice)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

(Se il token `warning` non esiste in tailwind.config, usare `error` — verificare i token reali.)

Pagine: `richieste/page.tsx` = wrapper metadata «Richieste Kit — UFPtrade» + client. `richieste-client.tsx`: `api.kit.list.useQuery({})`, tabella con link a `/richieste/[id]`, bottone «Nuova richiesta» → `/richieste/nuova`, empty state. `[id]/page.tsx` + `dettaglio-client.tsx`: `api.kit.get.useQuery`, riepilogo specifiche (dl a due colonne), `DistintaTable` (warnings da `generatedKit.warnings ?? []`), bottone «Rigenera» → `api.kit.generate.useMutation` con invalidate di `kit.get`, errore mutation in banner `role="alert"`. Seguire com'è fatto `archivio/[id]`.

- [ ] **Step 4: PASS + commit**

```bash
pnpm vitest run src/components/kit && pnpm typecheck
git add src/components/kit/ src/app/\(dashboard\)/richieste/
git commit -m "feat(ui): pagine Richieste Kit — lista e dettaglio distinta generata"
```

---

### Task 7: UI — form nuova richiesta (4 step)

**Files:**
- Create: `src/app/(dashboard)/richieste/nuova/page.tsx`, `nuova-client.tsx`
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: `api.kit.create` + `api.kit.generate`, `kitInputSchema` (validazione client via `safeParse` per step), `Button`/`Input`.
- Produces: wizard 4 step: 1) tipologia (ANTA_RIBALTA fisso, radio disabilitate per le future) + serie (ARTECH) + materiale; 2) dimensioni + parametri (aria/asse/battuta/sede) con default della distinta (12/13/20/18) e range visibili nei label; 3) mano (DX/SX) + apertura (TIRARE/SPINGERE) + finitura (select: ARGENTO + altre finiture presenti nelle tabelle coperture); 4) riepilogo → «Genera kit» = `create` poi `generate` → redirect `/richieste/[id]`. Errori: validazione per-step inline; errore generate → banner con messaggio (es. fuori campo applicazione) restando sul riepilogo. Barra passi con `aria-current="step"`.

- [ ] **Step 1: Test (falliranno)** — jsdom, mock `next/navigation` e `@/trpc/react`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const createMutate = vi.fn();
const generateMutate = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    kit: {
      create: { useMutation: () => ({ mutateAsync: createMutate, isPending: false }) },
      generate: { useMutation: () => ({ mutateAsync: generateMutate, isPending: false, error: null }) },
    },
  },
}));

import { NuovaRichiestaClient } from "./nuova-client";

afterEach(() => {
  cleanup();
  push.mockReset();
  createMutate.mockReset();
  generateMutate.mockReset();
});

describe("NuovaRichiestaClient", () => {
  it("parte dallo step 1 con ARTECH/anta-ribalta preselezionati", () => {
    render(<NuovaRichiestaClient />);
    expect(screen.getByText(/anta.?ribalta/i)).toBeTruthy();
    expect(screen.getByText(/artech/i)).toBeTruthy();
  });

  it("blocca lo step dimensioni se fuori range", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // step 2
    fireEvent.change(screen.getByLabelText(/larghezza/i), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("alert").textContent?.length).toBeGreaterThan(0);
  });

  it("al riepilogo genera: create → generate → redirect al dettaglio", async () => {
    createMutate.mockResolvedValue({ id: "k9", requestNumber: "KIT-2026-0001" });
    generateMutate.mockResolvedValue({ totalComponents: 20 });
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // default validi
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    fireEvent.click(screen.getByRole("button", { name: /genera kit/i }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/richieste/k9"));
    expect(createMutate).toHaveBeenCalled();
    expect(generateMutate).toHaveBeenCalledWith({ kitRequestId: "k9" });
  });
});
```

- [ ] **Step 2: FAIL**, poi **Step 3: implementa** `nuova-client.tsx`: stato `form` unico (default = valori distinta: 550/1820/ALLUMINIO/12/13/20/18/SINISTRA/TIRARE/ARGENTO), `step: 1..4`, validazione per-step con `kitInputSchema.pick(...)`, `handleGenera = async () => { const { id } = await create.mutateAsync(form); try { await generate.mutateAsync({ kitRequestId: id }); } finally { router.push("/richieste/" + id); } }` (il dettaglio mostra stato/errore); banner errori `role="alert"`. Rifinire con /impeccable nel browser.

- [ ] **Step 4: PASS + gates + verifica browser + commit**

```bash
pnpm vitest run src/app && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Browser (`pnpm dev` + Playwright): login → /richieste (vuoto) → Nuova → wizard coi default → Genera → dettaglio con 20 righe e prezzi 2026 reali → /richieste mostra la riga COMPLETED. Provare anche: H=3000 → errore italiano nel riepilogo.

```bash
git add src/app/\(dashboard\)/richieste/
git commit -m "feat(ui): wizard nuova richiesta kit in 4 step con generazione"
```

---

### Task 8: Golden integrazione su DB reale + docs + gates finali

**Files:**
- Create: `src/server/kit/engine.integration.test.ts`
- Modify: `handoff.md`, `CLAUDE.md` (STATO)

- [ ] **Step 1: Test integrazione (gated) che valida i 20 codici sul catalogo vero**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedKitTemplates } from "../../../prisma/seed-kit";
import { KitEngine } from "./engine";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("KitEngine — integrazione su catalogo reale", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedKitTemplates(db);
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("la distinta golden risolve 20 codici reali senza warning", async () => {
    const output = await new KitEngine(db).generate({
      windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "ALLUMINIO",
      airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
      openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
    });
    expect(output.warnings).toEqual([]);
    expect(output.lines).toHaveLength(20);
    expect(output.lines.every((line) => line.unitPrice !== null)).toBe(true);
    expect(output.totalPrice).toBeGreaterThan(0);
  });
});
```

Run: `INTEGRATION_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/utpistoia pnpm vitest run src/server/kit/engine.integration.test.ts` → PASS (richiede catalogo importato; NON eseguire rag.integration su questo DB: scriverebbe embedding fake).

- [ ] **Step 2: Aggiorna docs** — `CLAUDE.md` riga STATO (1d completata) + `handoff.md` (stato, componenti 1d, decisione ADR council, assunzioni da validare con prossime distinte).

- [ ] **Step 3: Gates finali + push**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git add -A && git commit -m "docs: Fase 1d completata — kit engine ARTECH con golden test reale"
git push -u origin claude/handoff-review-48kkhi
```

---

## Self-review (fatta in scrittura)

- **Copertura spec:** tipi/contratto (T1) · regole+golden+boundary (T2) · registry/puntatore/seed (T3) · engine pipeline+prezzi+warnings (T4) · router 4 procedure+ownership+ActivityLog+transazione (T5) · UI lista/dettaglio (T6) · wizard 4 step (T7) · integrazione DB reale+docs (T8). ADR e assunzioni marcate. Fuori scope invariato.
- **Placeholder:** i segnaposto `← VERIFICARE` e le tabelle da completare sono deliberati e hanno la procedura esatta di risoluzione (Task 2 Step 0 + Task 0 Step 2) con criterio d'accettazione (golden verde): non sono TBD ciechi.
- **Coerenza tipi:** `KitLine` (T1) usato da T2/T4/T5; `PricedKitLine/KitOutput` (T4) da T5/T6; `kitInputSchema` (T1) da T4/T5/T7; `resolveRuleModule` (T3) da T4; `DistintaComponent` (T6) = shape serializzata di `kit.get().components` (T5).
