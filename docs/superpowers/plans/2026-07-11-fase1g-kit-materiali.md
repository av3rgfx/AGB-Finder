# Fase 1g — Kit multi-materiale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere il kit engine anta-ribalta ARTECH da solo-LEGNO a 3 materiali (LEGNO corretto + PVC + ALLUMINIO), rendendo le chiusure supplementari opzionali.

**Architecture:** Opzione C (ibrido, verdetto unanime LLM Council): estrarre la sola meccanica condivisa in `kit-shared.ts` (`pick()`, `linesFromParts()`, `requireKey()`); tenere tabelle-dati e formule per-materiale nei moduli isolati `rules-artech-{legno,pvc,alu}.ts`, ciascuno registrato con il proprio `engineId` e una riga `KitTemplate`. `engine.ts` invariato.

**Tech Stack:** TypeScript strict, Vitest, Zod, Prisma. Motore **deterministico (MAI LLM)**.

## Global Constraints

- Motore kit **sempre deterministico**, mai LLM.
- **TDD**: test prima, un commit per task, gate `pnpm typecheck · lint · test · build` verdi a fine task.
- `kit-shared.ts` — **regola inviolabile**: zero `if (material === …)`, zero tabelle-dati, zero formule di dominio. Solo meccanica material-agnostica. Litmus: «la revisione dell'agente può cambiarlo?» sì⇒modulo materiale, no⇒shared.
- Regole PVC/ALLUMINIO **provvisorie** (solo listino AGB 2026, non validate): ogni scelta non certa marcata `// ASSUNZIONE`; golden PVC/ALU **provvisori**; validazione strutturale (codice esiste + prezzato a catalogo).
- Raw SQL solo in `RAGEngine`; query kit via Prisma. UI in italiano; codici in monospace.
- Listino: `scratchpad/listino.txt` (estratto con `pdftotext -layout` da `listino.pdf`), poppler installato. Capitolo ARTECH ~p398-520.
- Prisma/tsx: `set -a; source .env; set +a` prima dei comandi; pnpm 10 (`packageManager` pin).

---

### Task 1: Fix LEGNO — chiusure supplementari opzionali (default OFF)

Rende opzionale il gruppo `CHIUSURE_VERTICALI` (oggi sempre generato + errore fuori banda 1520-2120). Cambiamento d'output **voluto**: default = set obbligatorio (12 righe/17 pezzi); toggle ON = attuale distinta (16 righe/21 pezzi).

**Files:**
- Modify: `src/server/kit/types.ts` (aggiungi flag a `kitInputSchema`)
- Modify: `src/server/kit/rules-artech.ts:322-336` (gate del blocco)
- Test: `src/server/kit/rules-artech.test.ts`

**Interfaces:**
- Consumes: `kitInputSchema`, `artechAntaRibaltaLegno.generate(input)` (esistenti).
- Produces: `KitInput.supplementaryClosures?: boolean` (default `false`). Comportamento: blocco chiusure generato **solo se** `input.supplementaryClosures === true`.

- [ ] **Step 1: Scrivi i test falliti (default OFF + toggle ON)**

In `src/server/kit/rules-artech.test.ts`, sostituisci il golden test unico con i due casi e ribalta il test fuori-banda. Aggiungi/aggiorna:

```ts
// Default (supplementaryClosures assente/false) = set obbligatorio, senza le 4
// righe "chiusura-*". 12 righe / 17 pezzi.
const GOLDEN_MANDATORY: [code: string, qty: number][] = [
  ["A50122.15.07", 1], ["A50302.01.02", 2], ["A50510.00.02", 1], ["A50702.05.00", 1],
  ["A50790.00.00", 1], ["A50904.36.02", 1], ["A50801.01.02", 1], ["A51301.02.21", 1],
  ["A51400.05.03", 1], ["A51400.05.02", 5], ["A51400.05.70", 1], ["A51912.36.02", 1],
];

describe("artechAntaRibaltaLegno — default (chiusure supplementari OFF)", () => {
  it("genera solo il set obbligatorio: 12 righe / 17 pezzi", () => {
    const lines = artechAntaRibaltaLegno.generate(golden); // golden NON ha il flag
    const byCode = new Map(lines.map((l) => [l.code, l.quantity]));
    expect([...byCode.keys()].sort()).toEqual(GOLDEN_MANDATORY.map(([c]) => c).sort());
    for (const [code, qty] of GOLDEN_MANDATORY) expect(byCode.get(code), code).toBe(qty);
    expect(lines).toHaveLength(12);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(17);
  });

  it.each([1000, 2200])(
    "altezza %d (fuori banda chiusure): default OFF genera senza errore",
    (heightMm) => {
      expect(() => artechAntaRibaltaLegno.generate({ ...golden, heightMm })).not.toThrow();
    },
  );
});

describe("artechAntaRibaltaLegno — toggle chiusure supplementari ON", () => {
  it("aggiunge le 4 righe supplementari: 16 righe / 21 pezzi (distinta storica)", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...golden, supplementaryClosures: true });
    const codes = lines.map((l) => l.code);
    for (const c of ["A50330.00.00", "A50401.00.03", "A51801.00.01", "A51803.00.03"])
      expect(codes).toContain(c);
    expect(lines).toHaveLength(16);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(21);
  });

  it("toggle ON + altezza fuori banda 1520-2120 → KitGenerationError artech.verticali", () => {
    try {
      artechAntaRibaltaLegno.generate({ ...golden, heightMm: 2200, supplementaryClosures: true });
      expect.unreachable("atteso errore chiusure fuori banda");
    } catch (err) {
      expect(err).toBeInstanceOf(KitGenerationError);
      expect((err as KitGenerationError).ruleId).toBe("artech.verticali");
    }
  });
});
```

Aggiorna anche il test nottolino esistente (righe ~137-147): rimuovi il commento sul «restare dentro la banda chiusure» (non più necessario col default OFF). Lascia `qtyAt(1820) === 5` e `qtyAt(1799) === 4` (entrambi validi: `2+floor(h/600)+floor(550/600)`); **aggiungi** `qtyAt(2400) === 6` — altezza ora raggiungibile col default OFF (`2+floor(2400/600)+0`), che col vecchio codice sarebbe fallita sul passo chiusure verticali. Il test "guardia materiale" resta invariato; il test "mano DESTRA" resta ma ora attende `toHaveLength(12)` (default OFF).

- [ ] **Step 2: Esegui i test, verifica il fallimento**

Run: `set -a; source .env; set +a; pnpm test src/server/kit/rules-artech.test.ts`
Expected: FAIL (oggi il generatore produce 16 righe sempre; il flag non esiste).

- [ ] **Step 3: Aggiungi il flag allo schema**

In `src/server/kit/types.ts`, dentro `kitInputSchema` (dopo `notes`):

```ts
  supplementaryClosures: z.boolean().optional().default(false),
```

- [ ] **Step 4: Gate del blocco chiusure**

In `src/server/kit/rules-artech.ts`, avvolgi il blocco finale (attuale `const verticali = pick(...)` + `for (const part of verticali.parts) …`, righe ~322-336) in una guardia:

```ts
    if (input.supplementaryClosures) {
      const verticali = pick(
        CHIUSURE_VERTICALI, input.heightMm, "H", "artech.verticali", "chiusure verticali",
      );
      for (const part of verticali.parts)
        lines.push({
          position: part.position, code: part.code, quantity: part.quantity,
          ruleId: "artech.verticali", ruleDescription: part.descr,
        });
    }
```

- [ ] **Step 5: Esegui i test, verifica il successo**

Run: `set -a; source .env; set +a; pnpm test src/server/kit/rules-artech.test.ts`
Expected: PASS (tutti).

- [ ] **Step 6: Gate completi + commit**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: verdi.

```bash
git add src/server/kit/types.ts src/server/kit/rules-artech.ts src/server/kit/rules-artech.test.ts
git commit -m "fix(kit): chiusure supplementari legno opzionali (default off), via errore >2120mm sul percorso obbligatorio"
```

---

### Task 2: Estrai `kit-shared.ts` + rinomina `rules-artech-legno.ts` (refactor puro)

Estrae la meccanica condivisa. **Refactor puro**: i test di Task 1 restano verdi, output byte-identico.

**Files:**
- Create: `src/server/kit/kit-shared.ts`
- Rename: `src/server/kit/rules-artech.ts` → `src/server/kit/rules-artech-legno.ts`
- Rename: `src/server/kit/rules-artech.test.ts` → `src/server/kit/rules-artech-legno.test.ts`
- Modify: `src/server/kit/registry.ts:3` (path import)

**Interfaces:**
- Produces (`kit-shared.ts`):
  - `pick<T extends { minH?: number; maxH?: number; minL?: number; maxL?: number }>(table: readonly T[], value: number, kind: "H" | "L", ruleId: string, label: string): T`
  - `linesFromParts(parts: readonly { position: string; code: string; quantity: number; descr: string }[], ruleId: string): KitLine[]`
  - `requireKey<T>(map: Record<string, T>, key: string, ruleId: string, message: string): T`
- Consumes: `rules-artech-legno.ts` importa i tre helper da `./kit-shared`.

- [ ] **Step 1: Crea `kit-shared.ts`**

```ts
import { KitGenerationError, type KitLine } from "./types";

/** Sceglie la riga il cui range [min,max] contiene `value`; a parità vince lo span più stretto. */
export function pick<T extends { minH?: number; maxH?: number; minL?: number; maxL?: number }>(
  table: readonly T[], value: number, kind: "H" | "L", ruleId: string, label: string,
): T {
  let best: T | undefined;
  let bestSpan = Infinity;
  for (const row of table) {
    const min = kind === "H" ? (row.minH ?? 0) : (row.minL ?? 0);
    const max = kind === "H" ? (row.maxH ?? Infinity) : (row.maxL ?? Infinity);
    if (value < min || value > max) continue;
    const span = max - min;
    if (span < bestSpan) { best = row; bestSpan = span; }
  }
  if (!best)
    throw new KitGenerationError(
      `Nessuna variante ${label} per ${kind === "H" ? "altezza" : "larghezza"} ${value} mm: fuori campo di applicazione.`,
      ruleId,
    );
  return best;
}

/** Mappa una lista di parti fisse (o di gruppo) in righe KitLine con un ruleId comune. */
export function linesFromParts(
  parts: readonly { position: string; code: string; quantity: number; descr: string }[],
  ruleId: string,
): KitLine[] {
  return parts.map((p) => ({
    position: p.position, code: p.code, quantity: p.quantity, ruleId, ruleDescription: p.descr,
  }));
}

/** Lookup con guardia tipizzata: chiave assente → KitGenerationError (mai kit monco). */
export function requireKey<T>(map: Record<string, T>, key: string, ruleId: string, message: string): T {
  const v = map[key];
  if (v === undefined) throw new KitGenerationError(message, ruleId);
  return v;
}
```

- [ ] **Step 2: Sposta `pick()` fuori da rules-artech.ts e importa dallo shared**

Rinomina il file: `git mv src/server/kit/rules-artech.ts src/server/kit/rules-artech-legno.ts` e `git mv src/server/kit/rules-artech.test.ts src/server/kit/rules-artech-legno.test.ts`.

In `rules-artech-legno.ts`: cancella la definizione locale di `pick()` (righe ~184-217) e aggiungi in cima all'import esistente:

```ts
import { pick, linesFromParts, requireKey } from "./kit-shared";
```

Sostituisci il blocco coperture-guard (`const coperture = COPERTURE_KIT[finish]; if (!coperture) throw …`) con:

```ts
    const coperture = requireKey(
      COPERTURE_KIT, finish, "artech.coperture",
      `Finitura "${input.finish}" non disponibile per le coperture ARTECH legno.`,
    );
```

Sostituisci il loop `for (const part of FISSI) lines.push({…})` con:

```ts
    lines.push(...linesFromParts(FISSI, "artech.fissi"));
```

E dentro `if (input.supplementaryClosures) { … }` sostituisci il loop parts con:

```ts
      lines.push(...linesFromParts(verticali.parts, "artech.verticali"));
```

Aggiorna l'import di test in `rules-artech-legno.test.ts`: `from "./rules-artech-legno"`.

- [ ] **Step 3: Aggiorna il path nel registry**

In `src/server/kit/registry.ts` riga 3: `import { artechAntaRibaltaLegno } from "./rules-artech-legno";`

- [ ] **Step 4: Esegui i test — devono restare verdi (refactor puro)**

Run: `set -a; source .env; set +a; pnpm test src/server/kit`
Expected: PASS identici a Task 1 (nessun cambiamento d'output).

- [ ] **Step 5: Gate + commit**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: verdi.

```bash
git add -A src/server/kit
git commit -m "refactor(kit): estrai meccanica condivisa in kit-shared.ts, rinomina modulo legno (Opzione C)"
```

---

### Task 3: Modulo PVC (`rules-artech-pvc.ts`) — provvisorio da listino

**⚠️ Dati provvisori.** Le tabelle di questo modulo si ricavano dal listino e sono da validare con l'agente. Marcare ogni scelta non ovvia `// ASSUNZIONE`.

**Files:**
- Create: `src/server/kit/rules-artech-pvc.ts`
- Create: `src/server/kit/rules-artech-pvc.test.ts`
- Modify: `src/server/kit/registry.ts` (import + voce `RULE_MODULES`)
- Modify: `prisma/seed-kit.ts` (riga `KitTemplate` material=PVC)
- Create: `scratchpad/kit-pvc-assunzioni.md` (report per l'agente)

**Interfaces:**
- Consumes: `pick`, `linesFromParts`, `requireKey` da `./kit-shared`; `RuleModule`, `KitInput`, `KitLine`, `KitGenerationError` da `./types`.
- Produces: `export const artechAntaRibaltaPvc: RuleModule` con `engineId: "artech-ar-pvc"`.

- [ ] **Step 1: Estrai la composizione PVC dal listino**

Procedura (deliverable = tabella di mappatura in `scratchpad/kit-pvc-assunzioni.md`):
1. In `scratchpad/listino.txt`, individua lo schema anta-ribalta PVC e la **tabella di compatibilità** (righe `ARTech PVC`, ~L625-627 / p~134): codici braccio/supporto-forbice/squadra/supporto-cerniera per PVC (es. `A51921.36.04`, `A50712.00.00`, `A50922.07.00`, `A50812.07.00` — **verifica sul testo, non fidarti di questi a memoria**).
2. Per ogni "slot" del modulo legno (cremonese, corpo forbice, braccio forbice+mano, squadra angolare, supporto cerniera, coperture kit, componenti fissi, incontri nottolino/DSS/ribalta, e la formula relativa), individua l'equivalente PVC e la sua banda dimensionale (LBB/HBB). Dove il PVC condivide col legno (es. cremonese, incontri), riusa gli stessi codici e annota `// ASSUNZIONE: condiviso col legno, da confermare`.
3. Registra ogni codice candidato nel report con: slot, codice, banda, fonte (riga listino), stato (certo/ASSUNZIONE).

- [ ] **Step 2: Valida i codici candidati contro il catalogo**

Ogni codice deve esistere ed essere prezzato. Con Neon raggiungibile (GitHub Actions o `INTEGRATION_DATABASE_URL`): usa una query mirata. In locale (5432 filtrato) usa l'API deployata già verificata:

Run (esempio, sostituisci CODICE e la sessione admin): interroga `product.getByCode` via `/api/trpc` sull'app live, oppure aggiungi i codici a un file e verificali nel test d'integrazione dello Step 4. Segna nel report i codici **non trovati** o **senza prezzo** come warning.

- [ ] **Step 3: Scrivi il test "shape" provvisorio (fallisce)**

`src/server/kit/rules-artech-pvc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { KitInput } from "./types";
import { KitGenerationError } from "./types";
import { artechAntaRibaltaPvc } from "./rules-artech-pvc";

const base: KitInput = {
  windowType: "ANTA_RIBALTA", widthMm: 550, heightMm: 1820, material: "PVC",
  airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18,
  openingSide: "SINISTRA", openingDir: "TIRARE", finish: "ARGENTO", series: "ARTECH",
};

describe("artechAntaRibaltaPvc — shape provvisoria (da validare con agente)", () => {
  it("genera una distinta non vuota, ogni riga tipata e con ruleId artech.*", () => {
    const lines = artechAntaRibaltaPvc.generate(base);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.code).toMatch(/^A\d{5}\./);
      expect(l.quantity).toBeGreaterThan(0);
      expect(l.ruleId).toMatch(/^artech\./);
      expect(l.position.length).toBeGreaterThan(0);
    }
  });
  it("materiale ≠ PVC → KitGenerationError", () => {
    expect(() => artechAntaRibaltaPvc.generate({ ...base, material: "LEGNO" })).toThrow(KitGenerationError);
  });
  it("altezza fuori campo cremonese → KitGenerationError tipato", () => {
    expect(() => artechAntaRibaltaPvc.generate({ ...base, heightMm: 3000 })).toThrow(KitGenerationError);
  });
});
```

- [ ] **Step 4: Implementa il modulo PVC**

Struttura identica a `rules-artech-legno.ts` (tabelle `as const` per gli slot PVC estratti, guardia `if (input.material !== "PVC") throw`, pipeline `generate()` che usa `pick`/`linesFromParts`/`requireKey`). Ogni tabella/valore incerto con `// ASSUNZIONE`. Il blocco chiusure supplementari resta gated su `input.supplementaryClosures` come nel legno.

- [ ] **Step 5: Registra il modulo e il template**

`registry.ts`: `import { artechAntaRibaltaPvc } from "./rules-artech-pvc";` e nella mappa `[artechAntaRibaltaPvc.engineId]: artechAntaRibaltaPvc,`.
`prisma/seed-kit.ts`: aggiungi un upsert `KitTemplate` `{ name: "ARTECH anta-ribalta PVC", windowType: "ANTA_RIBALTA", material: "PVC", rules: { engine: "artech-ar-pvc", version: 1 }, isActive: true }` (idempotente, sul modello di quello legno esistente).

- [ ] **Step 6: Test integrazione strutturale (gated)**

Aggiungi a `src/server/kit/engine.integration.test.ts` (o nuovo `*-pvc.integration.test.ts`, gated `INTEGRATION_DATABASE_URL`): genera la distinta PVC, risolve i prezzi via Prisma, asserisce che i codici **senza** prezzo compaiano come warning (non silenziosi) e conta i risolti. Non richiede zero-warning (provvisorio).

- [ ] **Step 7: Gate + commit**

Run: `set -a; source .env; set +a; pnpm typecheck && pnpm test src/server/kit && pnpm lint`
Expected: verdi (integrazione skippata senza `INTEGRATION_DATABASE_URL`).

```bash
git add src/server/kit/rules-artech-pvc.ts src/server/kit/rules-artech-pvc.test.ts src/server/kit/registry.ts prisma/seed-kit.ts
git commit -m "feat(kit): modulo PVC anta-ribalta ARTECH (provvisorio da listino, da validare con agente)"
```

---

### Task 4: Modulo ALLUMINIO (`rules-artech-alu.ts`) — provvisorio da listino

Identico a Task 3 per struttura. **ASSUNZIONE chiave**: ALLUMINIO ≈ gamma «ARTech PLANA» del listino (righe `ARTech PLANA`, es. `A52911.*`, `A52900.*`, `A52901.*` — verifica sul testo). Possibile **copertura codici incompleta** a catalogo → i mancanti restano warning espliciti.

**Files:**
- Create: `src/server/kit/rules-artech-alu.ts`, `src/server/kit/rules-artech-alu.test.ts`
- Modify: `src/server/kit/registry.ts`, `prisma/seed-kit.ts`
- Create: `scratchpad/kit-alu-assunzioni.md`

**Interfaces:** `export const artechAntaRibaltaAlu: RuleModule` con `engineId: "artech-ar-alu"`.

- [ ] **Step 1-7:** identici a Task 3 sostituendo PVC→ALLUMINIO, `artech-ar-pvc`→`artech-ar-alu`, riga listino `ARTech PVC`→`ARTech PLANA`, `material: "ALLUMINIO"`. Il test shape usa `material: "ALLUMINIO"`. Commit finale:

```bash
git commit -m "feat(kit): modulo ALLUMINIO (PLANA) anta-ribalta ARTECH (provvisorio da listino, da validare con agente)"
```

---

### Task 5: Wizard — abilita PVC/ALLUMINIO + toggle chiusure supplementari

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:** consuma `kit.create` con `material` ∈ {LEGNO,PVC,ALLUMINIO} e `supplementaryClosures: boolean`.

- [ ] **Step 1: Aggiorna i test del wizard (falliti)**

In `nuova-client.test.tsx`: cambia l'atteso «PVC/ALLUMINIO disabilitati» → **abilitati** (`.disabled` `false`); aggiungi un test che il toggle «Chiusure supplementari» esista, sia **off di default**, e che il valore venga incluso nella chiamata `kit.create`.

- [ ] **Step 2: Verifica il fallimento**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Abilita materiali + aggiungi toggle**

In `nuova-client.tsx`: rimuovi `disabled` + hint «Presto disponibile» dalle card PVC/ALLUMINIO; aggiungi allo stato del form `supplementaryClosures: false` e un controllo checkbox/switch (label «Chiusure supplementari», hint esplicativo) nello step Dimensioni o Riepilogo; includi il campo nel payload `kit.create`. `FINISH_OPTIONS`: mantieni l'accoppiamento con le tabelle coperture per materiale (se PVC/ALU coprono solo alcune finiture, filtra di conseguenza — `// ASSUNZIONE` se non certo).

- [ ] **Step 4: Verifica il successo**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate completi + commit**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: verdi.

```bash
git add "src/app/(dashboard)/richieste/nuova"
git commit -m "feat(kit): wizard abilita PVC/ALLUMINIO + toggle chiusure supplementari (default off)"
```

---

## Note di esecuzione
- **Ordine vincolante**: 1 → 2 → 3 → 4 → 5. Task 1 (fix) e Task 2 (refactor) mai fusi.
- Dopo Task 3/4 consegna i report `scratchpad/kit-{pvc,alu}-assunzioni.md`: sono l'input per la revisione dell'agente (lunedì). A validazione avvenuta, bump `version` sui `KitTemplate`.
- **Impeccable**: rifinire il toggle + le card materiale con la skill `/impeccable` (Task 5) — micro-copy, stati, accessibilità.
- La validazione strutturale piena (zero-warning) NON è richiesta su PVC/ALU finché provvisori.

## Self-review (coverage vs spec)
- D1 (validazione B, golden provvisori, report) → Task 3/4 Step 1-2-6 + report. ✓
- D2 (toggle default off, futura regola condizionata fuori scope) → Task 1 + Task 5. ✓
- D3 (Opzione C: kit-shared solo meccanica, moduli per-materiale) → Task 2 + guardrail nei Global Constraints. ✓
- Fix LEGNO (chiusure opzionali, via errore >2120) → Task 1. ✓
- PVC/ALU moduli + registry + seed + engine invariato → Task 3/4. ✓
- Wizard PVC/ALU + toggle → Task 5. ✓
- Assunzioni marcate (coperture kit legno; ALLUMINIO=PLANA) → note Task 1 spec + Task 4. ✓
