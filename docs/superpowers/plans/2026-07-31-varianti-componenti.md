# Varianti componente e antieffrazione — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al wizard un passo «Componenti» in cui l'agente sceglie fra le varianti che il listino pubblica per uno stesso pezzo (squadra angolare, incontro ribalta) e attiva l'antieffrazione, invece che il motore le decida da sé senza dirlo.

**Architecture:** Una colonna `variants Json?` sul ramo ARTECH di `kit_requests`; un registro puro (`artech-varianti.ts`) con le tabelle a **codici interi** e la disponibilità derivata dalle tabelle stesse; `RuleModule` dichiara quali varianti consuma e il motore rifiuta quelle non dichiarate. Il default di ogni variante è **il codice che il motore emette oggi**, quindi il golden non può muoversi.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · tRPC v11 · Prisma 6 / PostgreSQL · zod · Vitest · Tailwind · pnpm 10.

## Global Constraints

- **Spec di riferimento:** `docs/superpowers/specs/2026-07-31-varianti-componenti-design.md`. In caso di conflitto vince la spec.
- **Il kit è un motore deterministico TypeScript. MAI un LLM.**
- **TypeScript strict sempre.** API via tRPC, query via Prisma.
- **Nessun codice prodotto composto per concatenazione di stringhe.** Solo codici interi in tabelle. (`A50904.22` non esiste ed è la prima cosa che una formula produrrebbe.)
- **UI in italiano**, codici prodotto in `font-mono`, **mobile-first**: ogni schermata va verificata a **≤375px** *e* desktop.
- **Il golden non si muove:** `550×1820`, `A12_I13_B20`, entrata `E15`, `openingSide: SINISTRA`, `supplementaryClosures: true` → **16 righe / 21 pezzi / 90,20 €**. Gemello entrata `E75` → **96,29 €**.
- **Prima di ogni comando `prisma`/`tsx`:** `set -a; source .env; set +a`.
- **Un commit per task**, messaggio in italiano.
- Gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- `jest-dom` **non è configurato**: nei test React usare `toBeTruthy()` / `toBeNull()` / `.textContent`, **mai** `toBeInTheDocument()`.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `src/server/kit/artech-varianti.ts` **(nuovo)** | Registro: `VarianteId`, `Varianti`, `variantiSchema`, tabelle a codici interi, `variantiDisponibili()`, `opzioneScelta()`. Puro, nessun I/O. |
| `src/server/kit/artech-varianti.test.ts` **(nuovo)** | Test del registro: disponibilità, default, tabelle. |
| `src/server/kit/types.ts` | `variants` nel ramo ARTECH; `varianti` obbligatorio su `RuleModule`. |
| `src/server/kit/engine.ts` | Rifiuto delle varianti non dichiarate dal modulo. |
| `src/server/kit/rules-artech-legno.ts` | Consuma le 5 varianti. |
| `src/server/kit/rules-artech-{pvc,alu,battente-legno,vasistas-legno}.ts`, `rules-tour-bilico-legno.ts` | `varianti: []`. |
| `src/server/kit/from-request.ts` | Rilettura di `variants`, **senza `?? default`**. |
| `src/server/api/routers/kit.ts` | `create` scrive `variants`; `ricalcola` lo ricopia. |
| `prisma/schema.prisma` + migrazione | Colonna `variants Json?`. |
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | Passo 4 «Componenti», riepilogo → passo 5. |
| `src/server/kit/no-silent-fields.test.ts` | `setPath` + casi derivati da `modulo.varianti` + fixture per variante. |
| `src/server/kit/codici-a-listino.integration.test.ts` | Gate esteso alle **tabelle** del registro. |

---

## Task 1: Registro — tipi e squadra angolare

**Files:**
- Create: `src/server/kit/artech-varianti.ts`
- Test: `src/server/kit/artech-varianti.test.ts`

**Interfaces:**
- Consumes: `ArtechGeometryId`, `PerMano` da `./artech-geometrie`.
- Produces: `VarianteId`, `Varianti`, `variantiSchema`, `SQUADRA_ANGOLARE`, `squadraAngolare(geometry, mano, scelta)`, `opzioniSquadraAngolare(geometry)`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/server/kit/artech-varianti.test.ts
import { describe, it, expect } from "vitest";
import { opzioniSquadraAngolare, squadraAngolare, SQUADRA_ANGOLARE } from "./artech-varianti";
import { GEOMETRIE, type ArtechGeometryId } from "./artech-geometrie";

describe("squadra angolare", () => {
  it("il default riproduce ESATTAMENTE il codice che il motore emette oggi", () => {
    for (const [id, geo] of Object.entries(GEOMETRIE)) {
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        expect(squadraAngolare(id as ArtechGeometryId, mano, undefined)).toBe(
          geo.squadraAngolare[mano],
        );
      }
    }
  });

  it("l'interasse 8,5 ha DUE opzioni, le altre geometrie quattro", () => {
    expect(opzioniSquadraAngolare("A4_I85_B15").map((o) => o.id)).toEqual([
      "BASE",
      "TRAVERSO_ALU",
    ]);
    expect(opzioniSquadraAngolare("A12_I13_B20")).toHaveLength(4);
  });

  it("A50901.22 e A50904.22 non compaiono in nessuna tabella (non esistono a listino)", () => {
    const tutti = Object.values(SQUADRA_ANGOLARE).flatMap((perGeo) =>
      Object.values(perGeo).flatMap((perMano) => Object.values(perMano)),
    );
    expect(tutti.filter((c) => c.startsWith("A50901.22") || c.startsWith("A50904.22"))).toEqual([]);
  });

  it("ogni opzione disponibile produce un codice, e sono tutti diversi fra loro", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[]) {
      const codici = opzioniSquadraAngolare(geometry).map((o) =>
        squadraAngolare(geometry, "DESTRA", o.id),
      );
      expect(new Set(codici).size).toBe(codici.length);
    }
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/kit/artech-varianti.test.ts`
Expected: FAIL — `Failed to resolve import "./artech-varianti"`.

- [ ] **Step 3: Scrivere il registro**

```ts
// src/server/kit/artech-varianti.ts
import { z } from "zod";
import type { ArtechGeometryId, PerMano } from "./artech-geometrie";

/**
 * REGISTRO DELLE VARIANTI COMPONENTE — ARTECH legno.
 *
 * Una VARIANTE è una scelta che non cambia QUALI righe compone la distinta, ma
 * QUALE codice va su una riga (spec §2). Il piastrino antieffrazione è
 * l'eccezione dichiarata: aggiunge una riga, e sta qui perché l'agente lo
 * sceglie nella stessa schermata.
 *
 * DUE REGOLE CHE QUESTO FILE DEVE RISPETTARE.
 *
 * 1. **Codici INTERI, mai composti.** Le tabelle qui sotto sono regolarissime —
 *    4 famiglie × 5 interassi × 2 mani — ed è esattamente la forma che invita a
 *    scrivere `A509${fam}.${mid}.${mano}`. NON si fa: `A50901.22` e `A50904.22`
 *    **non esistono a listino** e sarebbero la prima cosa che una formula
 *    produrrebbe. È il difetto che ha fatto disattivare PVC e battente.
 * 2. **La disponibilità È la tabella.** Un'opzione è disponibile per una
 *    geometria se e solo se la tabella ha una voce per quella geometria. Nessun
 *    predicato scritto a mano che possa disallinearsi dai codici.
 *
 * DEFAULT = il codice che il motore emette OGGI. `undefined` non significa
 * "niente": significa "lo standard del programma". Non si materializza il
 * default nel dato persistito, così un domani cambiarlo passa dal ricalcolo
 * versionato e non da un valore congelato di cui nessuno sa più l'origine.
 *
 * FONTI: squadra angolare p0451-0452 (449-450).
 */

export const VARIANTE_IDS = [
  "squadraAngolare",
  "incontroRibalta",
  "movimentoAngolare",
  "incontroNottolino",
  "piastrinoAntieffrazione",
] as const;

export type VarianteId = (typeof VARIANTE_IDS)[number];

/**
 * `.strict()` non è decorativo: una chiave sconosciuta — una variante
 * rinominata, il residuo di una versione precedente — deve FALLIRE il parse
 * invece di essere ignorata in silenzio.
 */
export const variantiSchema = z
  .object({
    squadraAngolare: z
      .enum(["BASE", "TRAVERSO_ALU", "COMPENSATORE", "TRAVERSO_ALU_COMPENSATORE"])
      .optional(),
    incontroRibalta: z.enum(["ZAMA", "ACCIAIO_INCLINATE", "ACCIAIO_DRITTE"]).optional(),
    movimentoAngolare: z.enum(["UN_NOTTOLINO", "DUE_NOTTOLINI"]).optional(),
    incontroNottolino: z
      .enum(["NORMALE", "ANTIEFFRAZIONE_INCLINATE", "ANTIEFFRAZIONE_DRITTE"])
      .optional(),
    piastrinoAntieffrazione: z.boolean().optional(),
  })
  .strict();

export type Varianti = z.infer<typeof variantiSchema>;

export type SquadraAngolareId = NonNullable<Varianti["squadraAngolare"]>;

/** Etichette italiane e prezzo di listino, per la UI. */
export const SQUADRA_ANGOLARE_LABEL: Record<SquadraAngolareId, string> = {
  BASE: "Base",
  TRAVERSO_ALU: "Per traverso in alluminio",
  COMPENSATORE: "Con compensatore",
  TRAVERSO_ALU_COMPENSATORE: "Traverso alluminio + compensatore",
};

/**
 * Codici INTERI. Le due caselle mancanti (`COMPENSATORE` e
 * `TRAVERSO_ALU_COMPENSATORE` per `A4_I85_B15`, cioè l'interasse 8,5) non sono
 * un'omissione: a listino NON esistono, ed è la ragione per cui il cliente MC
 * riceve oggi la squadra base mentre le altre sei geometrie ricevono la
 * versione da 9,83 € (domanda 2).
 */
export const SQUADRA_ANGOLARE: Record<
  SquadraAngolareId,
  Partial<Record<ArtechGeometryId, PerMano>>
> = {
  BASE: {
    A4_I85_B15: { DESTRA: "A50902.22.01", SINISTRA: "A50902.22.02" },
    A4_I9_B18: { DESTRA: "A50902.24.01", SINISTRA: "A50902.24.02" },
    A12_I9_B18: { DESTRA: "A50902.24.01", SINISTRA: "A50902.24.02" },
    A12_I9_B20: { DESTRA: "A50902.26.01", SINISTRA: "A50902.26.02" },
    A4_I13_B18: { DESTRA: "A50902.34.01", SINISTRA: "A50902.34.02" },
    A12_I13_B18: { DESTRA: "A50902.34.01", SINISTRA: "A50902.34.02" },
    A12_I13_B20: { DESTRA: "A50902.36.01", SINISTRA: "A50902.36.02" },
  },
  TRAVERSO_ALU: {
    A4_I85_B15: { DESTRA: "A50903.22.01", SINISTRA: "A50903.22.02" },
    A4_I9_B18: { DESTRA: "A50903.24.01", SINISTRA: "A50903.24.02" },
    A12_I9_B18: { DESTRA: "A50903.24.01", SINISTRA: "A50903.24.02" },
    A12_I9_B20: { DESTRA: "A50903.26.01", SINISTRA: "A50903.26.02" },
    A4_I13_B18: { DESTRA: "A50903.34.01", SINISTRA: "A50903.34.02" },
    A12_I13_B18: { DESTRA: "A50903.34.01", SINISTRA: "A50903.34.02" },
    A12_I13_B20: { DESTRA: "A50903.36.01", SINISTRA: "A50903.36.02" },
  },
  COMPENSATORE: {
    // A4_I85_B15 ASSENTE: `A50901.22` non esiste a listino.
    A4_I9_B18: { DESTRA: "A50901.24.01", SINISTRA: "A50901.24.02" },
    A12_I9_B18: { DESTRA: "A50901.24.01", SINISTRA: "A50901.24.02" },
    A12_I9_B20: { DESTRA: "A50901.26.01", SINISTRA: "A50901.26.02" },
    A4_I13_B18: { DESTRA: "A50901.34.01", SINISTRA: "A50901.34.02" },
    A12_I13_B18: { DESTRA: "A50901.34.01", SINISTRA: "A50901.34.02" },
    A12_I13_B20: { DESTRA: "A50901.36.01", SINISTRA: "A50901.36.02" },
  },
  TRAVERSO_ALU_COMPENSATORE: {
    // A4_I85_B15 ASSENTE: `A50904.22` non esiste a listino.
    A4_I9_B18: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    A12_I9_B18: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    A12_I9_B20: { DESTRA: "A50904.26.01", SINISTRA: "A50904.26.02" },
    A4_I13_B18: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    A12_I13_B18: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    A12_I13_B20: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
  },
};

/**
 * Default per geometria: `A4_I85_B15` → BASE (è l'unica famiglia "ricca" che il
 * listino le pubblichi), tutte le altre → TRAVERSO_ALU_COMPENSATORE. Riproduce
 * ESATTAMENTE `GEOMETRIE[*].squadraAngolare`, ed è la ragione per cui il golden
 * non può muoversi. Un test lo verifica geometria per geometria (Task 1).
 */
export function squadraAngolareDefault(geometry: ArtechGeometryId): SquadraAngolareId {
  return geometry === "A4_I85_B15" ? "BASE" : "TRAVERSO_ALU_COMPENSATORE";
}

/** Opzioni realmente ordinabili per questa geometria, nell'ordine di listino. */
export function opzioniSquadraAngolare(
  geometry: ArtechGeometryId,
): { id: SquadraAngolareId; label: string }[] {
  return (Object.keys(SQUADRA_ANGOLARE) as SquadraAngolareId[])
    .filter((id) => SQUADRA_ANGOLARE[id][geometry] !== undefined)
    .map((id) => ({ id, label: SQUADRA_ANGOLARE_LABEL[id] }));
}

export function squadraAngolare(
  geometry: ArtechGeometryId,
  mano: "DESTRA" | "SINISTRA",
  scelta: SquadraAngolareId | undefined,
): string {
  const id = scelta ?? squadraAngolareDefault(geometry);
  const perGeo = SQUADRA_ANGOLARE[id][geometry];
  if (perGeo === undefined)
    throw new KitGenerationError(
      `Squadra angolare «${SQUADRA_ANGOLARE_LABEL[id]}» non disponibile per la geometria ` +
        `${geometry}: il listino 2026 non la pubblica per questo interasse.`,
      "artech.varianti",
    );
  return perGeo[mano];
}
```

Aggiungere in cima: `import { KitGenerationError } from "./types";`

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/kit/artech-varianti.test.ts`
Expected: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/artech-varianti.ts src/server/kit/artech-varianti.test.ts
git commit -m "feat(kit): registro varianti — squadra angolare, 36 codici interi"
```

---

## Task 2: Registro — incontro ribalta e antieffrazione

**Files:**
- Modify: `src/server/kit/artech-varianti.ts`
- Modify: `src/server/kit/artech-varianti.test.ts`
- Modify: `src/server/kit/artech-incontri.ts` (esportare `chiaveIncontri`)

**Interfaces:**
- Consumes: da Task 1 `Varianti`, `VarianteId`.
- Produces: `chiaveIncontri(geometry)` (esportata da `artech-incontri.ts`), `incontroRibaltaVariante()`, `opzioniIncontroRibalta()`, `incontroNottolinoVariante()`, `opzioniIncontroNottolino()`, `movimentoAngolareCodice()`, `piastrinoCodice(entrata)`.

- [ ] **Step 1: Esportare la chiave incontri**

In `src/server/kit/artech-incontri.ts` cambiare `function chiave(` in:

```ts
export type ChiaveIncontri = Chiave;

/**
 * Esportata dal 2026-07-31: il registro varianti deve indicizzare le proprie
 * tabelle sulla STESSA chiave che sceglie i codici standard, altrimenti la
 * variante e il codice base potrebbero riferirsi a due formati diversi.
 */
export function chiaveIncontri(id: ArtechGeometryId): Chiave {
  return chiave(id);
}
```

- [ ] **Step 2: Scrivere i test che falliscono**

```ts
// in coda a src/server/kit/artech-varianti.test.ts
import {
  opzioniIncontroRibalta, incontroRibaltaVariante,
  opzioniIncontroNottolino, incontroNottolinoVariante,
  movimentoAngolareCodice, piastrinoCodice,
} from "./artech-varianti";
import { incontroRibalta as incontroRibaltaStandard, incontroNottolino as incontroNottolinoStandard } from "./artech-incontri";

describe("incontro ribalta", () => {
  it("il default riproduce il codice standard di oggi, su tutte le geometrie e mani", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[])
      for (const mano of ["DESTRA", "SINISTRA"] as const)
        expect(incontroRibaltaVariante(geometry, mano, undefined)).toBe(
          incontroRibaltaStandard(geometry, mano),
        );
  });

  it("aria 4 asse 9 non offre alcuna scelta: a listino c'è solo l'acciaio", () => {
    expect(opzioniIncontroRibalta("A4_I9_B18")).toEqual([]);
  });

  it("aria 4 asse 13 offre due opzioni, e non le viti dritte (l'aria 4 non le pubblica)", () => {
    expect(opzioniIncontroRibalta("A4_I13_B18").map((o) => o.id)).toEqual([
      "ZAMA",
      "ACCIAIO_INCLINATE",
    ]);
  });

  it("aria 12 offre tre opzioni", () => {
    expect(opzioniIncontroRibalta("A12_I13_B20").map((o) => o.id)).toEqual([
      "ZAMA",
      "ACCIAIO_INCLINATE",
      "ACCIAIO_DRITTE",
    ]);
  });
});

describe("antieffrazione", () => {
  it("il movimento angolare di default è quello di oggi", () => {
    expect(movimentoAngolareCodice(undefined)).toBe("A50302.01.02");
    expect(movimentoAngolareCodice("DUE_NOTTOLINI")).toBe("A50302.02.02");
  });

  it("l'incontro nottolino di default è quello standard di oggi", () => {
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[])
      for (const mano of ["DESTRA", "SINISTRA"] as const)
        expect(incontroNottolinoVariante(geometry, mano, undefined)).toBe(
          incontroNottolinoStandard(geometry, mano),
        );
  });

  it("in aria 4 le viti dritte non sono offerte", () => {
    expect(opzioniIncontroNottolino("A4_I9_B18").map((o) => o.id)).toEqual([
      "NORMALE",
      "ANTIEFFRAZIONE_INCLINATE",
    ]);
  });

  it("il piastrino dipende dall'entrata", () => {
    expect(piastrinoCodice("E75")).toBe("A50194.00.01");
    expect(piastrinoCodice("E15")).toBe("A20050.00.02");
  });
});
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `pnpm vitest run src/server/kit/artech-varianti.test.ts`
Expected: FAIL — funzioni non esportate.

- [ ] **Step 4: Implementare**

```ts
// in coda a src/server/kit/artech-varianti.ts
import { chiaveIncontri, type ChiaveIncontri } from "./artech-incontri";
import type { Entrata } from "./types";

type Mano = "DESTRA" | "SINISTRA";
const ambidestro = (code: string): PerMano => ({ DESTRA: code, SINISTRA: code });

export type IncontroRibaltaId = NonNullable<Varianti["incontroRibalta"]>;

export const INCONTRO_RIBALTA_LABEL: Record<IncontroRibaltaId, string> = {
  ZAMA: "Zama",
  ACCIAIO_INCLINATE: "Acciaio, viti inclinate",
  ACCIAIO_DRITTE: "Acciaio, viti dritte",
};

/**
 * FONTE: p0471 (469). L'attuale è lo ZAMA per aria 12 e aria 4 asse 13
 * (ASSUNZIONE del 2026-07-25, ora una scelta esplicita); per aria 4 asse 9 lo
 * zama NON esiste e l'attuale è l'acciaio — infatti `A4_ASSE9` ha una sola
 * voce e §opzioniIncontroRibalta non offre nulla.
 */
const INCONTRO_RIBALTA: Record<IncontroRibaltaId, Partial<Record<ChiaveIncontri, PerMano>>> = {
  ZAMA: {
    A4_ASSE13: { DESTRA: "A514DX.DC.70", SINISTRA: "A514SX.DC.70" },
    A12_9x18: ambidestro("A51400.05.70"),
    A12_13x24: ambidestro("A51400.CR.70"),
  },
  ACCIAIO_INCLINATE: {
    A4_ASSE9: { DESTRA: "A514DX.01.64", SINISTRA: "A514SX.01.64" },
    A4_ASSE13: { DESTRA: "A514DX.DC.64", SINISTRA: "A514SX.DC.64" },
    A12_9x18: { DESTRA: "A514DX.05.64", SINISTRA: "A514SX.05.64" },
    A12_13x24: { DESTRA: "A514DX.CR.64", SINISTRA: "A514SX.CR.64" },
  },
  ACCIAIO_DRITTE: {
    // A4_* ASSENTI: in aria 4 il listino pubblica solo le viti inclinate.
    A12_9x18: { DESTRA: "A514DX.05.65", SINISTRA: "A514SX.05.65" },
    A12_13x24: { DESTRA: "A514DX.CR.65", SINISTRA: "A514SX.CR.65" },
  },
};

function ribaltaDefault(chiave: ChiaveIncontri): IncontroRibaltaId {
  return chiave === "A4_ASSE9" ? "ACCIAIO_INCLINATE" : "ZAMA";
}

/** Vuoto quando la scelta non esiste: una variante con una sola opzione non è una scelta. */
export function opzioniIncontroRibalta(
  geometry: ArtechGeometryId,
): { id: IncontroRibaltaId; label: string }[] {
  const k = chiaveIncontri(geometry);
  const ids = (Object.keys(INCONTRO_RIBALTA) as IncontroRibaltaId[]).filter(
    (id) => INCONTRO_RIBALTA[id][k] !== undefined,
  );
  return ids.length < 2 ? [] : ids.map((id) => ({ id, label: INCONTRO_RIBALTA_LABEL[id] }));
}

export function incontroRibaltaVariante(
  geometry: ArtechGeometryId,
  mano: Mano,
  scelta: IncontroRibaltaId | undefined,
): string {
  const k = chiaveIncontri(geometry);
  const id = scelta ?? ribaltaDefault(k);
  const perChiave = INCONTRO_RIBALTA[id][k];
  if (perChiave === undefined)
    throw new KitGenerationError(
      `Incontro ribalta «${INCONTRO_RIBALTA_LABEL[id]}» non disponibile per il formato ${k}: ` +
        "il listino 2026 non lo pubblica.",
      "artech.varianti",
    );
  return perChiave[mano];
}

export type IncontroNottolinoId = NonNullable<Varianti["incontroNottolino"]>;

export const INCONTRO_NOTTOLINO_LABEL: Record<IncontroNottolinoId, string> = {
  NORMALE: "Normale",
  ANTIEFFRAZIONE_INCLINATE: "Antieffrazione, viti inclinate",
  ANTIEFFRAZIONE_DRITTE: "Antieffrazione, viti dritte",
};

/** FONTE: normale p0469 (467) · antieffrazione p0470 (468). */
const INCONTRO_NOTTOLINO: Record<
  IncontroNottolinoId,
  Partial<Record<ChiaveIncontri, PerMano>>
> = {
  NORMALE: {
    A4_ASSE9: { DESTRA: "A514DX.01.02", SINISTRA: "A514SX.01.02" },
    A4_ASSE13: { DESTRA: "A48011.DC.02", SINISTRA: "A48012.DC.02" },
    A12_9x18: ambidestro("A51400.05.02"),
    A12_13x24: ambidestro("A51400.CR.13"),
  },
  ANTIEFFRAZIONE_INCLINATE: {
    A4_ASSE9: { DESTRA: "A514DX.01.67", SINISTRA: "A514SX.01.67" },
    A4_ASSE13: { DESTRA: "A514DX.DC.67", SINISTRA: "A514SX.DC.67" },
    A12_9x18: { DESTRA: "A514DX.05.67", SINISTRA: "A514SX.05.67" },
    A12_13x24: { DESTRA: "A514DX.CR.67", SINISTRA: "A514SX.CR.67" },
  },
  ANTIEFFRAZIONE_DRITTE: {
    // A4_* ASSENTI: in aria 4 il listino pubblica solo le viti inclinate. È il
    // motivo per cui la domanda «inclinate o dritte?» non andava risposta ma
    // mostrata: per MC e Peruzzi le dritte non esistono.
    A12_9x18: { DESTRA: "A514DX.05.68", SINISTRA: "A514SX.05.68" },
    A12_13x24: { DESTRA: "A514DX.CR.68", SINISTRA: "A514SX.CR.68" },
  },
};

export function opzioniIncontroNottolino(
  geometry: ArtechGeometryId,
): { id: IncontroNottolinoId; label: string }[] {
  const k = chiaveIncontri(geometry);
  return (Object.keys(INCONTRO_NOTTOLINO) as IncontroNottolinoId[])
    .filter((id) => INCONTRO_NOTTOLINO[id][k] !== undefined)
    .map((id) => ({ id, label: INCONTRO_NOTTOLINO_LABEL[id] }));
}

export function incontroNottolinoVariante(
  geometry: ArtechGeometryId,
  mano: Mano,
  scelta: IncontroNottolinoId | undefined,
): string {
  const k = chiaveIncontri(geometry);
  const id = scelta ?? "NORMALE";
  const perChiave = INCONTRO_NOTTOLINO[id][k];
  if (perChiave === undefined)
    throw new KitGenerationError(
      `Incontro nottolino «${INCONTRO_NOTTOLINO_LABEL[id]}» non disponibile per il formato ` +
        `${k}: il listino 2026 non lo pubblica.`,
      "artech.varianti",
    );
  return perChiave[mano];
}

export type MovimentoAngolareId = NonNullable<Varianti["movimentoAngolare"]>;

export const MOVIMENTO_ANGOLARE_LABEL: Record<MovimentoAngolareId, string> = {
  UN_NOTTOLINO: "Un nottolino",
  DUE_NOTTOLINI: "Due nottolini (antieffrazione)",
};

/**
 * FONTE: p0435 (433). NB STAMPATA: «mov. angolare A50302.02.02 necessario per
 * tutte le classi antieffrazione» — non era nella richiesta dell'utente, l'ha
 * imposto il listino.
 */
const MOVIMENTO_ANGOLARE_CODICI: Record<MovimentoAngolareId, string> = {
  UN_NOTTOLINO: "A50302.01.02",
  DUE_NOTTOLINI: "A50302.02.02",
};

export function movimentoAngolareCodice(scelta: MovimentoAngolareId | undefined): string {
  return MOVIMENTO_ANGOLARE_CODICI[scelta ?? "UN_NOTTOLINO"];
}

/**
 * Piastrino antieffrazione — riga AGGIUNTA, quantità 1. FONTE: p0432 (430).
 * Dipende dall'ENTRATA, cioè dal campo reso esplicito dalla PR #40: mappa
 * esaustiva `Record<Entrata, string>`, non un ternario (un terzo valore
 * dell'enum non deve poter finire in silenzio su uno dei due).
 */
const PIASTRINO: Record<Entrata, string> = {
  E75: "A50194.00.01",
  E15: "A20050.00.02",
};

export function piastrinoCodice(entrata: Entrata): string {
  return PIASTRINO[entrata];
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/kit/artech-varianti.test.ts`
Expected: PASS, 12 test.

- [ ] **Step 6: Commit**

```bash
git add src/server/kit/artech-varianti.ts src/server/kit/artech-varianti.test.ts src/server/kit/artech-incontri.ts
git commit -m "feat(kit): registro varianti — incontro ribalta e antieffrazione"
```

---

## Task 3: `variants` nell'input e `varianti` sui moduli

**Files:**
- Modify: `src/server/kit/types.ts`
- Modify: `src/server/kit/types.test.ts`
- Modify: tutti i 6 moduli regole (una riga ciascuno)

**Interfaces:**
- Consumes: `variantiSchema`, `VarianteId` da Task 1.
- Produces: `artechInputSchema.shape.variants`; `RuleModule.varianti: readonly VarianteId[]`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// in src/server/kit/types.test.ts
import { variantiSchema } from "./artech-varianti";

describe("variants nell'input", () => {
  const artechBase = {
    windowType: "ANTA_RIBALTA", series: "ARTECH", material: "LEGNO",
    widthMm: 550, heightMm: 1820, geometry: "A12_I13_B20", entrata: "E15",
    openingSide: "SINISTRA", finish: "ARGENTO",
  };

  it("accetta le varianti sul ramo ARTECH", () => {
    const r = kitInputSchema.safeParse({ ...artechBase, variants: { squadraAngolare: "BASE" } });
    expect(r.success).toBe(true);
    if (r.success && r.data.series === "ARTECH")
      expect(r.data.variants?.squadraAngolare).toBe("BASE");
  });

  it("RIFIUTA una chiave sconosciuta invece di ignorarla", () => {
    expect(variantiSchema.safeParse({ squadraAngolareX: "BASE" }).success).toBe(false);
  });

  it("il ramo TOUR SCARTA le varianti: non possono raggiungere una riga bilico", () => {
    const r = kitInputSchema.safeParse({
      windowType: "BILICO", series: "TOUR", material: "LEGNO",
      widthMm: 700, heightMm: 900, finish: "MARRONE RAL 8019", tourSchema: 2,
      variants: { squadraAngolare: "BASE" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect("variants" in r.data).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/server/kit/types.test.ts`
Expected: FAIL — `variants` scartato anche sul ramo ARTECH.

- [ ] **Step 3: Implementare**

In `src/server/kit/types.ts`, dentro `artechInputSchema` (dopo `supplementaryClosures`):

```ts
  /**
   * Varianti componente (spec 2026-07-31). SOLO ARTECH: fuori dal ramo, una
   * riga TOUR potrebbe portarsi addosso varianti ARTECH — l'impossibilità
   * strutturale che l'unione discriminata esiste per garantire (PR #35).
   *
   * `.optional()` e non `.default({})`: `undefined` significa «lo standard del
   * programma», e il default vive nel REGISTRO, non nel dato persistito.
   */
  variants: variantiSchema.optional(),
```

Con, in cima al file: `import { variantiSchema, type VarianteId } from "./artech-varianti";`

> **Attenzione al ciclo di import.** `artech-varianti.ts` importa `KitGenerationError` ed `Entrata` da `types.ts`. Se `tsc`/vitest segnalano un ciclo a runtime, spostare `variantiSchema` e `VarianteId` in un file foglia `src/server/kit/varianti-schema.ts` (solo zod, nessun import da `types.ts`) e importarlo da entrambi. Verificare con `pnpm typecheck` **e** `pnpm vitest run src/server/kit`.

Poi, sempre in `types.ts`, su `RuleModule`:

```ts
export interface RuleModule {
  engineId: string;
  /**
   * Varianti che questo modulo CONSUMA. OBBLIGATORIO, non `?`: un modulo nuovo
   * non compila senza averci pensato. Il motore rifiuta una richiesta che porti
   * una variante non dichiarata qui — è lo strato 1 della garanzia contro la
   * variante «raccolta, mostrata, persistita e mai letta» (spec §6).
   */
  varianti: readonly VarianteId[];
  generate(input: KitInput): KitLine[];
}
```

Poi aggiungere a ciascun modulo:
- `rules-artech-legno.ts` → `varianti: VARIANTE_IDS,` (importando `VARIANTE_IDS` dal registro)
- `rules-artech-pvc.ts`, `rules-artech-alu.ts`, `rules-artech-battente-legno.ts`, `rules-artech-vasistas-legno.ts`, `rules-tour-bilico-legno.ts` → `varianti: [],`

- [ ] **Step 4: Eseguire test e typecheck**

Run: `pnpm vitest run src/server/kit/types.test.ts && pnpm typecheck`
Expected: PASS; il typecheck passa solo dopo che tutti e 6 i moduli dichiarano `varianti`.

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/
git commit -m "feat(kit): variants nel ramo ARTECH e dichiarazione obbligatoria sui moduli"
```

---

## Task 4: Il motore rifiuta le varianti non dichiarate

**Files:**
- Modify: `src/server/kit/engine.ts`
- Modify: `src/server/kit/engine.test.ts`

**Interfaces:**
- Consumes: `RuleModule.varianti` da Task 3.
- Produces: rifiuto con `ruleId: "kit.varianti"`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// in src/server/kit/engine.test.ts
it("rifiuta, col nome della variante, una richiesta che porta una variante non dichiarata dal modulo", async () => {
  // Il modulo vasistas dichiara `varianti: []`.
  const input = { ...vasistasInput, variants: { squadraAngolare: "BASE" } } as KitInput;
  await expect(engine.generate(input)).rejects.toThrow(/squadraAngolare/);
});
```

*(Adattare `vasistasInput` e la costruzione di `engine` all'idiom già presente nel file — il template attivo va mockato come negli altri test.)*

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/server/kit/engine.test.ts`
Expected: FAIL — nessun errore sollevato.

- [ ] **Step 3: Implementare** — in `engine.ts`, subito prima di `.generate(input)`:

```ts
    const module_ = resolveRuleModule(template.rules);

    // STRATO 1 della garanzia sulle varianti (spec §6). Una variante persistita
    // che il modulo non dichiara è un dato raccolto e mai letto: il difetto che
    // questo progetto ha già pagato quattro volte. Qui è un rifiuto, col nome
    // della variante — non un silenzio.
    const varianti = "variants" in input ? (input.variants ?? {}) : {};
    const nonDichiarate = Object.entries(varianti)
      .filter(([, v]) => v !== undefined)
      .map(([id]) => id)
      .filter((id) => !module_.varianti.includes(id as VarianteId));
    if (nonDichiarate.length > 0)
      throw new KitGenerationError(
        `Il modulo "${module_.engineId}" non gestisce le varianti: ${nonDichiarate.join(", ")}. ` +
          "La richiesta le porta ma nessuna riga di distinta le userebbe.",
        "kit.varianti",
      );

    const lines = module_.generate(input);
```

- [ ] **Step 4: Eseguire e verificare che passi**

Run: `pnpm vitest run src/server/kit/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/engine.ts src/server/kit/engine.test.ts
git commit -m "feat(kit): il motore rifiuta le varianti che il modulo non dichiara"
```

---

## Task 5: Il modulo anta-ribalta consuma le 5 varianti

**Files:**
- Modify: `src/server/kit/rules-artech-legno.ts`
- Modify: `src/server/kit/rules-artech-legno.test.ts`

**Interfaces:**
- Consumes: tutte le funzioni del registro (Task 1-2).
- Produces: righe `squadra-angolare`, `incontro-ribalta`, `incontri-nottolino`, `movimento-angolare` variabili; nuova posizione `piastrino-antieffrazione`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// in src/server/kit/rules-artech-legno.test.ts
describe("varianti componente", () => {
  const golden = { /* stesso literal del golden già usato nel file */ } as KitInput;

  it("IL GOLDEN NON SI MUOVE senza varianti: 16 righe / 21 pezzi", () => {
    const l = artechAntaRibaltaLegno.generate(golden);
    expect(l).toHaveLength(16);
    expect(l.reduce((s, x) => s + x.quantity, 0)).toBe(21);
  });

  it("la squadra angolare base cambia SOLO la sua riga", () => {
    const base = artechAntaRibaltaLegno.generate(golden);
    const mod = artechAntaRibaltaLegno.generate({
      ...golden, variants: { squadraAngolare: "BASE" },
    } as KitInput);
    expect(mod).toHaveLength(16);
    const diverse = mod.filter((r, i) => r.code !== base[i]!.code);
    expect(diverse.map((r) => r.position)).toEqual(["squadra-angolare"]);
    expect(diverse[0]!.code).toBe("A50902.36.02"); // golden: mano SINISTRA
  });

  it("l'antieffrazione completa: 17 righe / 22 pezzi", () => {
    const l = artechAntaRibaltaLegno.generate({
      ...golden,
      variants: {
        movimentoAngolare: "DUE_NOTTOLINI",
        incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
        piastrinoAntieffrazione: true,
      },
    } as KitInput);
    expect(l).toHaveLength(17);
    expect(l.reduce((s, x) => s + x.quantity, 0)).toBe(22);
    expect(l.find((r) => r.position === "movimento-angolare")!.code).toBe("A50302.02.02");
    expect(l.find((r) => r.position === "incontri-nottolino")!.code).toBe("A514SX.05.67");
    expect(l.find((r) => r.position === "piastrino-antieffrazione")!.code).toBe("A20050.00.02");
  });

  it("il piastrino segue l'entrata", () => {
    const l = artechAntaRibaltaLegno.generate({
      ...golden, entrata: "E75", variants: { piastrinoAntieffrazione: true },
    } as KitInput);
    expect(l.find((r) => r.position === "piastrino-antieffrazione")!.code).toBe("A50194.00.01");
  });

  it("rifiuta una variante che il listino non pubblica per questa geometria", () => {
    expect(() =>
      artechAntaRibaltaLegno.generate({
        ...golden, geometry: "A4_I85_B15", variants: { squadraAngolare: "COMPENSATORE" },
      } as KitInput),
    ).toThrow(/non la pubblica per questo interasse|non disponibile/);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/server/kit/rules-artech-legno.test.ts`
Expected: FAIL sui test delle varianti; il test del golden PASSA già.

- [ ] **Step 3: Implementare**

In `rules-artech-legno.ts`:

1. Import: `import { VARIANTE_IDS, squadraAngolare, incontroRibaltaVariante, incontroNottolinoVariante, movimentoAngolareCodice, piastrinoCodice } from "./artech-varianti";`
2. In cima a `generate`, dopo `const geo = geometria(input.geometry);`:
   `const v = input.variants ?? {};`
3. Riga `squadra-angolare`: `code: squadraAngolare(input.geometry, input.openingSide, v.squadraAngolare),`
4. Riga `incontro-ribalta`: `code: incontroRibaltaVariante(input.geometry, input.openingSide, v.incontroRibalta),`
5. Riga `incontri-nottolino`: `code: incontroNottolinoVariante(input.geometry, input.openingSide, v.incontroNottolino),`
6. **Togliere `MOVIMENTO_ANGOLARE` da `FISSI`** (non è più fisso) e spingerlo esplicitamente:

```ts
    lines.push({
      position: "movimento-angolare",
      code: movimentoAngolareCodice(v.movimentoAngolare),
      quantity: 2,
      ruleId: "artech.fissi",
      ruleDescription: "Movimento angolare 125x125",
    });
```

> `FISSI` resta con il solo `perno-supporto-forbice`. **L'ORDINE DELLE RIGHE VA CONSERVATO**: il movimento angolare va spinto esattamente dove `linesFromParts(FISSI, …)` lo emetteva, altrimenti il golden cambia firma. Verificarlo col test «il golden non si muove».

7. In coda, la riga aggiunta:

```ts
    // Riga AGGIUNTA, non sostituita: è la ragione per cui l'antieffrazione non
    // è una «variante» nel senso della spec §2. FONTE: p0432 (430).
    if (v.piastrinoAntieffrazione === true)
      lines.push({
        position: "piastrino-antieffrazione",
        code: piastrinoCodice(input.entrata),
        quantity: 1,
        ruleId: "artech.varianti",
        ruleDescription: `Piastrino antieffrazione entrata ${entrataLabel(input.entrata)}`,
      });
```

8. `varianti: VARIANTE_IDS,` sul modulo (già fatto in Task 3 — verificare).

- [ ] **Step 4: Eseguire e verificare**

Run: `pnpm vitest run src/server/kit/rules-artech-legno.test.ts`
Expected: PASS, golden invariato incluso.

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/rules-artech-legno.ts src/server/kit/rules-artech-legno.test.ts
git commit -m "feat(kit): l'anta-ribalta legno consuma le cinque varianti"
```

---

## Task 5-bis: Avviso di combinazione incoerente (mai blocco)

**Files:**
- Modify: `src/server/kit/artech-varianti.ts`, `src/server/kit/artech-varianti.test.ts`
- Modify: `src/server/kit/engine.ts`, `src/server/kit/engine.test.ts`

**Interfaces:**
- Produces: `avvisiVarianti(varianti: Varianti | undefined): string[]` — pura, usata **sia** dal motore **sia** dal wizard (Task 9), così l'agente vede l'avviso *prima* di generare.

> **PERCHÉ AVVISO E NON BLOCCO.** È il precedente del progetto per lo sconto oltre soglia: *avviso, mai blocco*. I codici della combinazione esistono tutti e sono ordinabili; impedire un ordine vero sulla base della **nostra lettura** di una NB sarebbe peggio del difetto che stiamo togliendo. E l'avviso non si perde: `engine.generate` restituisce `warnings`, il router salva l'intero output in `generatedKit`, e `dettaglio-client.tsx` lo rilegge già con `getWarnings`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// in src/server/kit/artech-varianti.test.ts
import { avvisiVarianti } from "./artech-varianti";

describe("avvisi", () => {
  it("segnala l'incontro antieffrazione senza il movimento angolare a due nottolini", () => {
    const a = avvisiVarianti({ incontroNottolino: "ANTIEFFRAZIONE_INCLINATE" });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/A50302\.02\.02/);
  });

  it("non segnala nulla quando la combinazione è coerente", () => {
    expect(
      avvisiVarianti({
        incontroNottolino: "ANTIEFFRAZIONE_INCLINATE",
        movimentoAngolare: "DUE_NOTTOLINI",
      }),
    ).toEqual([]);
  });

  it("non segnala nulla senza varianti", () => {
    expect(avvisiVarianti(undefined)).toEqual([]);
  });
});
```

```ts
// in src/server/kit/engine.test.ts
it("la combinazione incoerente PRODUCE una distinta, con un warning — non un errore", async () => {
  const out = await engine.generate({
    ...goldenInput,
    variants: { incontroNottolino: "ANTIEFFRAZIONE_INCLINATE" },
  } as KitInput);
  expect(out.lines.length).toBeGreaterThan(0);
  expect(out.warnings.some((w) => w.includes("A50302.02.02"))).toBe(true);
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/server/kit/artech-varianti.test.ts src/server/kit/engine.test.ts`
Expected: FAIL — `avvisiVarianti` non esportata.

- [ ] **Step 3: Implementare**

```ts
// in coda a src/server/kit/artech-varianti.ts
/**
 * Combinazioni che il listino VIETA ma i cui codici esistono tutti.
 *
 * NON è un rifiuto: è il precedente «avviso, mai blocco» dello sconto oltre
 * soglia. Bloccare significherebbe impedire un ordine vero sulla base della
 * NOSTRA lettura di una NB stampata.
 *
 * Pura, e usata in due posti: il motore (dove finisce in `warnings`, quindi
 * persistita in `generatedKit`) e il wizard (dove si vede PRIMA di generare).
 */
export function avvisiVarianti(varianti: Varianti | undefined): string[] {
  if (varianti === undefined) return [];
  const avvisi: string[] = [];
  const antieffrazione = varianti.incontroNottolino?.startsWith("ANTIEFFRAZIONE") === true;
  if (antieffrazione && varianti.movimentoAngolare !== "DUE_NOTTOLINI")
    avvisi.push(
      "Incontro nottolino antieffrazione con movimento angolare a un nottolino: il listino " +
        "2026 (p. stampata 433) richiede il movimento angolare a due nottolini A50302.02.02 " +
        "per tutte le classi antieffrazione.",
    );
  return avvisi;
}
```

In `engine.ts`, subito dopo il blocco delle varianti non dichiarate (Task 4) e prima di `module_.generate(input)`:

```ts
    const avvisiDaVarianti =
      "variants" in input ? avvisiVarianti(input.variants) : [];
```

e poi, dove `const warnings: string[] = [];` diventa:

```ts
    const warnings: string[] = [...avvisiDaVarianti];
```

- [ ] **Step 4: Eseguire e verificare che passino**

Run: `pnpm vitest run src/server/kit/`
Expected: PASS. Verificare in particolare che il golden **non** produca warning (`warnings` vuoto).

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/artech-varianti.ts src/server/kit/artech-varianti.test.ts src/server/kit/engine.ts src/server/kit/engine.test.ts
git commit -m "feat(kit): avviso sulla combinazione vietata dalla NB, mai un blocco"
```

---

## Task 6: Persistenza — migrazione, create, rilettura, ricalcolo

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_kit_variants/migration.sql` (generata)
- Modify: `src/server/kit/from-request.ts`, `src/server/kit/from-request.test.ts`
- Modify: `src/server/api/routers/kit.ts`

**Interfaces:**
- Consumes: `variantiSchema` (Task 1), `PersistedKitRequest`.
- Produces: `PersistedKitRequest.variants: unknown`.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// in src/server/kit/from-request.test.ts
it("rilegge le varianti dalla riga", () => {
  const input = kitInputFromRequest({ ...rigaArtech, variants: { squadraAngolare: "BASE" } });
  expect(input.series === "ARTECH" && input.variants?.squadraAngolare).toBe("BASE");
});

it("una riga senza varianti resta senza: nessun default materializzato", () => {
  const input = kitInputFromRequest({ ...rigaArtech, variants: null });
  expect(input.series === "ARTECH" && input.variants).toBeUndefined();
});

it("RIFIUTA una riga con varianti corrotte invece di ignorarle", () => {
  expect(() =>
    kitInputFromRequest({ ...rigaArtech, variants: { squadraAngolare: "INESISTENTE" } }),
  ).toThrow(/incoerente/);
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/server/kit/from-request.test.ts`
Expected: FAIL — `variants` non esiste in `PersistedKitRequest`.

- [ ] **Step 3: Schema Prisma e migrazione**

In `prisma/schema.prisma`, dentro `model KitRequest`, dopo `entrata`:

```prisma
  /// Varianti componente scelte dall'agente (spec 2026-07-31). SOLO ARTECH:
  /// NULL sulle righe TOUR e su ogni riga creata prima di questa migrazione.
  /// NULL = «lo standard del programma», cioè i codici che il motore emette da
  /// sempre → NESSUN backfill, e nessuna riga esistente si muove. Nessun
  /// `@default` a livello DB, stesso criterio di `seatConfig`/`entrata`/
  /// `discountPercent`: un default DB valorizzerebbe anche le righe che non
  /// devono averlo.
  variants Json?
```

Poi:

```bash
set -a; source .env; set +a
pnpm prisma migrate dev --name kit_variants
```

Verificare che la migrazione generata contenga **solo** `ALTER TABLE "kit_requests" ADD COLUMN "variants" JSONB;` — nessun backfill, nessun `CREATE TYPE`.

- [ ] **Step 4: Implementare la rilettura**

In `from-request.ts`, aggiungere a `PersistedKitRequest`: `variants: unknown;`

E nel ramo ARTECH del `candidate`, dopo `supplementaryClosures`:

```ts
          // NESSUN `?? {}`. Un fallback qui renderebbe indistinguibile «non
          // scelto» da «dato rotto», e il default vive nel registro. `null` a
          // DB → `undefined` nell'input, che è ciò che lo schema `.optional()`
          // vuole; qualunque altra cosa passa dal `safeParse` sotto e, se non è
          // valida, la riga viene RIFIUTATA con un messaggio.
          ...(row.variants !== null && row.variants !== undefined && { variants: row.variants }),
```

- [ ] **Step 5: Implementare create e ricalcolo**

In `src/server/api/routers/kit.ts`:

1. Nel `branch` ARTECH di `create`, dopo `supplementaryClosures`:
   `variants: specs.variants ?? Prisma.DbNull,`
   *(usare `Prisma.DbNull` per una colonna `Json?`; importare `Prisma` da `@prisma/client` se non già importato.)*
2. In `ricalcola`, nella copia campo per campo, dopo `supplementaryClosures: request.supplementaryClosures,`:

```ts
            // La nuova versione eredita le varianti: ricalcolare non è
            // rinegoziare la configurazione. È LA riga per cui la spec §4 ha
            // scelto una colonna JSON invece di sei colonne tipizzate.
            variants: request.variants ?? Prisma.DbNull,
```

- [ ] **Step 6: Test del giro completo**

```ts
// nel file di test del router kit (stesso idiom degli altri test del router)
it("la variante sopravvive al giro creazione → rilettura → ricalcolo", async () => {
  // create con variants → leggere la riga → kitInputFromRequest → ricalcola →
  // la nuova riga porta le stesse variants.
});
```

- [ ] **Step 7: Eseguire tutto**

Run: `pnpm vitest run src/server/kit src/server/api && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/ src/server/kit/from-request.ts src/server/kit/from-request.test.ts src/server/api/routers/kit.ts
git commit -m "feat(kit): persistenza delle varianti — colonna, create, rilettura, ricalcolo"
```

---

## Task 7: `no-silent-fields` esteso alle varianti

**Files:**
- Modify: `src/server/kit/no-silent-fields.test.ts`

**Interfaces:**
- Consumes: `modulo.varianti` (Task 3), `artechAntaRibaltaLegno`.

- [ ] **Step 1: Aggiungere `setPath` e i casi**

Sostituire le due costruzioni `{ ...caso.base, [campo]: valore }` (righe 215 e 220) con:

```ts
/**
 * Assegna a un percorso di UN livello (`variants.squadraAngolare`). Serve perché
 * le varianti vivono in un oggetto annidato: uno spread piatto le
 * sostituirebbe in blocco invece di mutarne una, e il test passerebbe per il
 * motivo sbagliato.
 */
function setPath(base: KitInput, campo: string, valore: unknown): KitInput {
  const [testa, coda] = campo.split(".");
  if (coda === undefined) return { ...base, [testa!]: valore } as KitInput;
  const annidato = (base as Record<string, unknown>)[testa!] as Record<string, unknown> | undefined;
  return { ...base, [testa!]: { ...(annidato ?? {}), [coda]: valore } } as KitInput;
}
```

E il controllo di esaustività va esteso: `campi` per il caso anta-ribalta diventa

```ts
    campi: [
      ...Object.keys(artechInputSchema.shape).filter((c) => c !== "variants"),
      // DERIVATO dalla dichiarazione del modulo, non scritto a mano: una
      // variante aggiunta al registro e dichiarata dal modulo, ma senza
      // mutazione qui, fa fallire il test COL PROPRIO NOME. È lo strato 2
      // della garanzia (spec §6).
      ...artechAntaRibaltaLegno.varianti.map((id) => `variants.${id}`),
    ],
```

- [ ] **Step 2: Aggiungere le 5 mutazioni con la fixture GIUSTA**

> **PERCHÉ UNA FIXTURE PER VARIANTE.** `artechBase` usa `A12_I13_B20`. Alcune varianti sono disponibili solo su certe geometrie: su una fixture sbagliata risulterebbero «legittimamente inerti» e la garanzia passerebbe **a vuoto**. Ogni mutazione parte da una base in cui la variante è **davvero disponibile**.

```ts
      { campo: "variants.squadraAngolare", valore: "BASE" },
      { campo: "variants.incontroRibalta", valore: "ACCIAIO_INCLINATE" },
      { campo: "variants.movimentoAngolare", valore: "DUE_NOTTOLINI" },
      { campo: "variants.incontroNottolino", valore: "ANTIEFFRAZIONE_INCLINATE" },
      { campo: "variants.piastrinoAntieffrazione", valore: true },
```

Tutte e cinque sono disponibili su `A12_I13_B20` (aria 12 · 9x18): la fixture attuale va bene per l'anta-ribalta. Aggiungere però un test esplicito che lo **dimostri** invece di darlo per scontato:

```ts
it("ogni variante mutata nel caso anta-ribalta è DAVVERO disponibile sulla fixture", () => {
  expect(opzioniSquadraAngolare("A12_I13_B20").length).toBeGreaterThan(1);
  expect(opzioniIncontroRibalta("A12_I13_B20").length).toBeGreaterThan(1);
  expect(opzioniIncontroNottolino("A12_I13_B20").length).toBeGreaterThan(1);
});
```

Per vasistas e TOUR: `campi` resta com'è (i loro moduli dichiarano `varianti: []`, quindi lo spread produce zero voci) e **non** servono inerti nuovi.

- [ ] **Step 3: Eseguire**

Run: `pnpm vitest run src/server/kit/no-silent-fields.test.ts`
Expected: PASS. Se una variante risulta inerte, **è un bug del Task 5**, non del test.

- [ ] **Step 4: Commit**

```bash
git add src/server/kit/no-silent-fields.test.ts
git commit -m "test(kit): no-silent-fields copre le varianti, derivandole dal modulo"
```

---

## Task 8: Gate su catalogo reale esteso alle tabelle

**Files:**
- Modify: `src/server/kit/codici-a-listino.integration.test.ts`

- [ ] **Step 1: Aggiungere il blocco che itera le TABELLE**

> **PERCHÉ LE TABELLE E NON LE DISTINTE.** Le combinazioni del gate esistente emettono solo i codici *di default*. I 74 codici del registro vanno verificati **tutti**: è il test che smascherò PVC e battente.

```ts
  it("ogni codice del registro varianti esiste a catalogo con prezzo", async () => {
    const codici = new Set<string>();
    for (const geometry of Object.keys(GEOMETRIE) as ArtechGeometryId[]) {
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        for (const o of opzioniSquadraAngolare(geometry))
          codici.add(squadraAngolare(geometry, mano, o.id));
        for (const o of opzioniIncontroRibalta(geometry))
          codici.add(incontroRibaltaVariante(geometry, mano, o.id));
        for (const o of opzioniIncontroNottolino(geometry))
          codici.add(incontroNottolinoVariante(geometry, mano, o.id));
      }
    }
    codici.add(movimentoAngolareCodice("UN_NOTTOLINO"));
    codici.add(movimentoAngolareCodice("DUE_NOTTOLINI"));
    for (const e of ENTRATE) codici.add(piastrinoCodice(e));

    // GUARDIA DI COPERTURA: se un domani una tabella si svuota per errore, il
    // test passerebbe verificando zero codici. 74 è il numero verificato sul
    // listino il 2026-07-31.
    expect(codici.size).toBe(74);

    const trovati = await db.product.findMany({
      where: { agbCode: { in: [...codici] }, basePrice: { not: null } },
      select: { agbCode: true },
    });
    const orfani = [...codici].filter((c) => !trovati.some((p) => p.agbCode === c));
    expect(orfani).toEqual([]);
  });
```

- [ ] **Step 2: Eseguire il gate**

```bash
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/kit/codici-a-listino.integration.test.ts
```

Expected: PASS. **Se compaiono orfani**, non correggere il test: verificare il codice sul PDF (`pdftotext -layout -f <pag> -l <pag>`) e, se il codice esiste a listino ma manca a catalogo, l'azione ops diventa migrazione **+ re-import** (§13 della spec).

- [ ] **Step 3: Commit**

```bash
git add src/server/kit/codici-a-listino.integration.test.ts
git commit -m "test(kit): il gate su catalogo reale verifica i 74 codici del registro"
```

---

## Task 9: UI — passo «Componenti»

> **PRIMA DI SCRIVERE CODICE: invocare la skill `/impeccable`** e progettare la schermata **per mobile ≤375px e desktop**, come da regola inviolabile di `CLAUDE.md`.

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` (riga piastrino nel riepilogo)

**Interfaces:**
- Consumes: `opzioni*`, `*_LABEL`, `squadraAngolareDefault` dal registro.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
// in nuova-client.test.tsx — idiom del file: fireEvent, tRPC mockata a livello di modulo
it("il wizard ha cinque passi e il quarto è «Componenti»", () => { /* … */ });

it("per l'interasse 8,5 la squadra angolare mostra DUE opzioni, non quattro", () => { /* … */ });

it("l'antieffrazione accende le tre scelte, e «Modifica» le rende indipendenti", () => { /* … */ });

it("cambiare geometria al passo 3 riporta al default una variante non più disponibile", () => {
  // Scegliere COMPENSATORE su A12_I13_B20, tornare indietro, passare a
  // A4_I85_B15, tornare avanti: la scelta NON deve restare COMPENSATORE.
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `pnpm vitest run src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementare**

1. `stepLabels`: inserire `"Componenti"` fra il terzo e `"Riepilogo"`; il bilico **non** ha varianti → per TOUR la lista resta a 4 voci. Aggiornare `Math.min(4, …)` / `Math.max(1, …)` e `step === 4` di conseguenza, **per ramo**.
2. `STEP_SCHEMAS.ARTECH`: aggiungere un quarto elemento `artechInputSchema.pick({ variants: true })`.
3. Nuovo componente `Step4Componenti`:
   - Sezione **chiusa** di default: `<details>` con summary «Componenti standard · modifica» (o un bottone che alterna `aria-expanded`). A 375px sei scelte aperte sono un muro.
   - Interruttore **Antieffrazione** in cima: acceso, imposta `movimentoAngolare: "DUE_NOTTOLINI"`, `incontroNottolino: opzioniIncontroNottolino(geometry).find(o => o.id.startsWith("ANTIEFFRAZIONE"))!.id`, `piastrinoAntieffrazione: true`. **Non è uno stato salvato**: si deriva dalle tre.
   - `statoAntieffrazione(v)` → `"SPENTO" | "PARZIALE" | "ACCESO"`, funzione pura testata.
   - Tasto **«Modifica»** che rivela le tre scelte separate.
   - Ogni opzione: `label`, codice in **`font-mono`**, prezzo, **Δ rispetto al default** (`+0,49 €` / `−4,06 €`), e il pulsante **«Visualizza nel listino»** (componente già esistente, riusarlo).
   - Etichetta del default: «**standard del programma**», con la nota «*mai confrontato con un ordine vero*».
   - I prezzi si prendono da `product.byCodes` (o dalla query già usata dal dettaglio) — **mai** cablati nella UI: cablarli li farebbe divergere dal catalogo.
4. Al cambio di `geometry` (passo 3), ripulire le varianti non più disponibili — usando **le stesse** `opzioni*` del registro, non una lista parallela.

- [ ] **Step 4: Eseguire**

Run: `pnpm vitest run src/app/\(dashboard\)/richieste/nuova/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/richieste/"
git commit -m "feat(richieste): passo «Componenti» — varianti e antieffrazione"
```

---

## Task 10: Gate, verifica browser e documentazione

- [ ] **Step 1: Gate completi**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: tutti verdi. `pnpm test` deve mostrare **almeno 875 + i nuovi**; il golden e il gemello a 96,29 € devono essere fra i verdi.

- [ ] **Step 2: Gate su catalogo reale**

```bash
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm vitest run src/server/kit/*.integration.test.ts
```

- [ ] **Step 3: Verifica browser — desktop E 375px**

Avviare l'app (`bash scripts/dev-bootstrap.sh` se il DB non gira) e con Chromium:
1. `/richieste/nuova` → cliente **MC** → «Usa il profilo» → passo Componenti: **due** opzioni di squadra.
2. Stessa cosa con **Fosca**: quattro opzioni.
3. Antieffrazione ON → riepilogo → generare → verificare **17 righe / 22 pezzi / 110,13 €**.
4. Senza toccare nulla → **16 righe / 21 pezzi / 90,20 €**.
5. Ripetere a **375px**. **Aprire e GUARDARE gli screenshot**, non fidarsi dei check verdi (lezione dell'handoff: 30 check verdi mentre lo sconto scriveva «42.5» col punto).

- [ ] **Step 4: Documentazione**

- `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`: **domanda 2** e **domanda 30** → chiuse (spiegando *come*: non risposte, ma rese scelte). Domanda 29 resta.
- `docs/superpowers/kit-assunzioni/legno.md`: l'ASSUNZIONE acciaio/zama non è più un'assunzione.
- `handoff.md` + `CLAUDE.md`: stato, azioni ops, debito residuo (incluso il difetto §12 della spec).

- [ ] **Step 5: Commit e push**

```bash
git add -A && git commit -m "docs: chiusura delle domande 2 e 30, e stato di sessione"
git push -u origin claude/antieffrazione-feature-dv8d37
```

- [ ] **Step 6: Azioni ops — NELLA STESSA FINESTRA DEL MERGE**

Lanciare **«Ops — Neon»** `workflow_dispatch` **sul ref del branch, PRIMA del merge** (lezione delle PR #40/#44: `kit.get` fa `findFirst` senza `select`, quindi prima della migrazione fallirebbero le **letture**). Poi mergiare.

---

## Self-review del piano

**Copertura della spec:** §2 → Task 1 (commento) · §3 → Task 1-2 (solo V1, V4, antieffrazione) · §4 → Task 3, 6 · §5 → Task 1, 2 · §5.4 (fungo fuori) → nessun task, è un'esclusione · §6 strato 1 → Task 3, 4; strato 2 → Task 7; i tre punti del percorso dati → Task 6 · §7 → Task 9 (`statoAntieffrazione`, interruttore non salvato) · §8 inesistente → Task 1, 2 (`opzioni*` vuote/ridotte) + Task 9 (ritorno indietro); vietato/avviso → **manca un task**, vedi sotto · §9 → Task 9 · §10 → Task 5, 7, 8, 10 · §11 → esclusioni · §12 → solo documentato · §13 → Task 10 step 6.

**Lacuna trovata e colmata:** la spec §8 prevede un **avviso** (non un blocco) quando l'incontro nottolino è antieffrazione ma il movimento angolare è a un nottolino — la NB stampata a `p0435 (433)`. Nessun task lo implementava. È stato aggiunto come **Task 5-bis**, fra Task 5 e Task 6, con test e codice completi.

**Scansione placeholder:** nessun TBD. I test del Task 9 sono descritti per titolo e non per corpo completo — è deliberato: il corpo dipende dalla schermata che `/impeccable` produrrà al passo 0 del task, e inventarlo qui significherebbe scriverlo due volte.

**Coerenza dei tipi:** `VarianteId`/`VARIANTE_IDS`, `Varianti`, `variantiSchema`, `opzioniSquadraAngolare`/`squadraAngolare`, `opzioniIncontroRibalta`/`incontroRibaltaVariante`, `opzioniIncontroNottolino`/`incontroNottolinoVariante`, `movimentoAngolareCodice`, `piastrinoCodice`, `chiaveIncontri`/`ChiaveIncontri`, `RuleModule.varianti` — usati con gli stessi nomi in Task 1→9. `PerMano` è riusato da `artech-geometrie.ts`, non ridefinito.

**Rischio noto da sorvegliare in Task 3:** il ciclo di import `types.ts` ↔ `artech-varianti.ts`. Mitigazione già scritta nel task (file foglia `varianti-schema.ts`).
