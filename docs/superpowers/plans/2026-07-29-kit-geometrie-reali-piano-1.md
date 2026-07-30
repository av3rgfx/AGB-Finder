# Piano 1 — Geometrie reali ARTECH legno, sede derivata, ricalcolo versionato

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far generare al kit engine le distinte per le **geometrie che i clienti reali
ordinano davvero** (oggi ne copre una che nessuno usa), sostituendo la guardia
`assertPilotGeometry()` con una tabella di geometrie a **codici interi verificati**.

**Architecture:** La geometria smette di essere quattro numeri liberi e diventa **un
discriminatore unico** (`ArtechGeometry`, 7 valori), esattamente come `tourSchema` fa già
per il bilico. Ogni riga della tabella dichiara i **codici completi** dei componenti che
dipendono dalla geometria — **mai** un suffisso da concatenare. La sede telaio smette di
essere un input e diventa un valore **derivato e mostrato**.

**Tech Stack:** TypeScript strict · zod (unione discriminata) · Prisma 6 + PostgreSQL ·
tRPC v11 · Vitest · Next.js 15 App Router · Tailwind.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-29-kit-geometrie-e-schemi-cliente-design.md`

---

## Global Constraints

- **TypeScript strict sempre.** Nessun `any`, nessun `@ts-ignore`.
- **Il kit engine è deterministico. MAI un LLM.**
- **Nessun codice AGB viene composto per concatenazione.** Le tabelle dichiarano codici
  interi. Unica eccezione ammessa: il braccio forbice, `{prefissoMano}.{mid}.{GR}`, dove
  `prefissoMano` e `mid` vengono dalla tabella e `GR` da una tabella di range — ed è coperto
  dal gate del Task 7.
  *Motivo:* `A50904.22` **non esiste** (verificato: zero occorrenze in 959 pagine). Comporre
  `A50904.{suffisso}` per l'interasse 8,5 produrrebbe un codice plausibile e inesistente. È
  il difetto che ha fatto disattivare i moduli PVC e battente.
- **Il golden dell'anta-ribalta non si muove: 16 righe / 21 pezzi / 90,20 €** con chiusure
  supplementari ON (12 righe / 17 pezzi OFF).
- **UI in italiano**, codici prodotto in font monospace.
- **Mobile-first**: ogni schermata verificata a **≤ 375px** oltre che desktop.
- Tutte le API via **tRPC**; tutte le query via **Prisma**.
- Un commit per task, messaggio in italiano.
- Gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.

## Scostamenti dalla spec — da approvare

1. **`SEDE_30` è fuori dal Piano 1.** La spec (§3.3) la prevede come asse esplicito, ma la
   trascrizione mostra che il dato è **incompleto**: `p0473 (471)` pubblica gli incontri DSS
   aria 12 solo per `9x18` e `13x24` — per `13x30` **non c'è un incontro DSS**. L'enum
   `SeatConfig` viene creato (STANDARD, SEDE_30) ma `SEDE_30` **viene rifiutato** dal motore
   con messaggio esplicito. Si riapre quando il dato è completo.
2. **Squadra angolare per l'interasse 8,5.** `A50904` (in uso oggi, prescritta dal
   certificato ift) **non esiste** per il `.22`. Le uniche disponibili sono `A50902.22`
   (base, 5,77 €) e `A50903.22` (per traverso in alluminio, 7,54 €). Il piano adotta
   **`A50902.22`** — la variante il cui nome non porta qualifiche, appropriata a una finestra
   tutto-legno — dichiarata come assunzione legata alla **domanda 2**.

---

## File Structure

**Nuovi**
- `src/server/kit/artech-geometrie.ts` — tabella delle 7 geometrie con codici interi;
  derivazione della sede; label per la UI. Puro, nessun I/O.
- `src/server/kit/artech-geometrie.test.ts`
- `src/server/kit/artech-incontri.ts` — scelta degli incontri (nottolino, ribalta, DSS) per
  geometria e mano. Puro.
- `src/server/kit/artech-incontri.test.ts`
- `src/server/kit/codici-a-listino.integration.test.ts` — gate: ogni codice emettibile esiste
  a catalogo con prezzo.
- `prisma/migrations/<timestamp>_kit_geometria/migration.sql`

**Modificati**
- `src/server/kit/types.ts` — ramo ARTECH: `geometry` + `seatConfig` al posto dei 4 numerici.
- `src/server/kit/artech-legno-shared.ts` — via `PILOT_GEOMETRY`/`assertPilotGeometry`.
- `src/server/kit/rules-artech-legno.ts` · `rules-artech-vasistas-legno.ts`
- `src/server/kit/from-request.ts` · `no-silent-fields.test.ts`
- `src/server/api/routers/kit.ts` — create/generate + `ricalcola`
- `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` — passi 2/3/5
- `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` — sede derivata + «Ricalcola»
- `src/lib/kit-labels.ts` — label geometria
- `prisma/schema.prisma`

---

## Task 1: Tabella delle geometrie

**Files:**
- Create: `src/server/kit/artech-geometrie.ts`
- Test: `src/server/kit/artech-geometrie.test.ts`

**Interfaces:**
- Consumes: `KitGenerationError` da `./types`
- Produces:
  - `type ArtechGeometryId = "A4_I85_B15" | "A4_I9_B18" | "A4_I13_B18" | "A12_I9_B18" | "A12_I9_B20" | "A12_I13_B18" | "A12_I13_B20"`
  - `const GEOMETRIE: Record<ArtechGeometryId, Geometria>`
  - `interface Geometria { airGapMm, axisOffsetMm, rebateMm, asse, sedeMm, squadraAngolare: PerMano, supportoCerniera: PerMano, supportoForbice: string, braccioMid: string }`
  - `type PerMano = { DESTRA: string; SINISTRA: string }`
  - `function geometria(id: ArtechGeometryId): Geometria`
  - `function geometriaLabel(id: ArtechGeometryId): string`
  - `function assertSeatConfigSupportata(seatConfig: "STANDARD" | "SEDE_30"): void`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/kit/artech-geometrie.test.ts
import { describe, it, expect } from "vitest";
import { GEOMETRIE, geometria, geometriaLabel, assertSeatConfigSupportata } from "./artech-geometrie";
import { KitGenerationError } from "./types";

describe("GEOMETRIE — le 7 combinazioni del listino 2026", () => {
  it("copre le tre configurazioni dei clienti reali", () => {
    expect(GEOMETRIE.A4_I85_B15).toMatchObject({ airGapMm: 4, axisOffsetMm: 8.5, rebateMm: 15 });
    expect(GEOMETRIE.A4_I9_B18).toMatchObject({ airGapMm: 4, axisOffsetMm: 9, rebateMm: 18 });
    expect(GEOMETRIE.A12_I13_B18).toMatchObject({ airGapMm: 12, axisOffsetMm: 13, rebateMm: 18 });
  });

  it("l'interasse 8,5 NON usa A50904, che a listino non ha il .22", () => {
    expect(GEOMETRIE.A4_I85_B15.squadraAngolare.DESTRA).toBe("A50902.22.01");
    expect(GEOMETRIE.A4_I85_B15.squadraAngolare.SINISTRA).toBe("A50902.22.02");
  });

  it("il pilota storico conserva i codici verificati della distinta 2021", () => {
    expect(GEOMETRIE.A12_I13_B20).toMatchObject({
      squadraAngolare: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
      supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
      supportoForbice: "A50702.05.00",
      braccioMid: "36",
    });
  });

  it("per aria 4 la sede non esiste (fresatura), per aria 12 è derivata", () => {
    expect(GEOMETRIE.A4_I9_B18.sedeMm).toBeNull();
    expect(GEOMETRIE.A12_I9_B18.sedeMm).toBe(18);
    expect(GEOMETRIE.A12_I13_B18.sedeMm).toBe(24);
  });

  it("nessun codice dichiarato è vuoto o malformato", () => {
    const re = /^[A-Z]\d{5}\.[0-9A-Z]{2}\.[0-9A-Z]{2}$|^[A-Z]\d{5}\.\d{2}\.\d{2}$/;
    for (const g of Object.values(GEOMETRIE)) {
      expect(g.supportoForbice).toMatch(re);
      for (const mano of ["DESTRA", "SINISTRA"] as const) {
        expect(g.squadraAngolare[mano]).toMatch(re);
        expect(g.supportoCerniera[mano]).toMatch(re);
      }
    }
  });
});

describe("geometria()", () => {
  it("restituisce la riga richiesta", () => {
    expect(geometria("A12_I13_B20").braccioMid).toBe("36");
  });
});

describe("geometriaLabel()", () => {
  it("è leggibile da un serramentista, con la virgola decimale italiana", () => {
    expect(geometriaLabel("A4_I85_B15")).toBe("Aria 4 · interasse 8,5 · battuta 15");
    expect(geometriaLabel("A12_I13_B18")).toBe("Aria 12 · interasse 13 · battuta 18");
  });
});

describe("assertSeatConfigSupportata()", () => {
  it("STANDARD passa", () => {
    expect(() => assertSeatConfigSupportata("STANDARD")).not.toThrow();
  });

  it("SEDE_30 viene rifiutata: manca l'incontro DSS 13x30 a listino", () => {
    expect(() => assertSeatConfigSupportata("SEDE_30")).toThrow(KitGenerationError);
    expect(() => assertSeatConfigSupportata("SEDE_30")).toThrow(/sede 30/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/kit/artech-geometrie.test.ts`
Expected: FAIL — «Failed to resolve import "./artech-geometrie"»

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/kit/artech-geometrie.ts
import { KitGenerationError } from "./types";

/**
 * Le 7 geometrie ARTECH legno del listino 2026, con i CODICI INTERI dei componenti
 * che dipendono dalla geometria.
 *
 * PERCHÉ CODICI INTERI E NON SUFFISSI DA CONCATENARE. Il 2° segmento del codice
 * codifica (aria, interasse, battuta) in modo regolarissimo — .22/.24/.26/.34/.36 —
 * e la tentazione di comporre `A50904.${suffisso}` è forte. Ma `A50904.22` **non
 * esiste**: la squadra «per traverso in alluminio con compensatore» è pubblicata solo
 * per interasse 9 e 13 (p0452 (450)). Per l'interasse 8,5 esistono solo A50902.22
 * (base) e A50903.22. Comporre avrebbe prodotto un codice plausibile e inesistente —
 * il difetto che ha fatto disattivare i moduli PVC e battente.
 *
 * FONTI: squadre p0451-0452 (449-450) · supporti forbice p0449 (447) ·
 * supporti cerniera p0451 (449) · bracci forbice p0439 (437).
 */
export type ArtechGeometryId =
  | "A4_I85_B15"
  | "A4_I9_B18"
  | "A4_I13_B18"
  | "A12_I9_B18"
  | "A12_I9_B20"
  | "A12_I13_B18"
  | "A12_I13_B20";

export type PerMano = { DESTRA: string; SINISTRA: string };

export interface Geometria {
  airGapMm: number;
  axisOffsetMm: number;
  rebateMm: number;
  /** Asse degli incontri. L'interasse 8,5 delle cerniere usa gli incontri asse 9
   *  (a listino non esiste un asse 8,5) — ASSUNZIONE, domanda 17. */
  asse: 9 | 13;
  /** Sede telaio derivata. `null` per aria 4: lì il listino parla di «Fresatura», non
   *  di sede (p0469 (467)). */
  sedeMm: number | null;
  squadraAngolare: PerMano;
  supportoCerniera: PerMano;
  supportoForbice: string;
  /** 2° segmento del braccio forbice A51911(dx)/A51912(sx).{mid}.{GR}. */
  braccioMid: string;
}

export const GEOMETRIE: Record<ArtechGeometryId, Geometria> = {
  // MC. ASSUNZIONE (domanda 2): A50904 non ha il .22 → si adotta la variante base
  // A50902.22, il cui nome non porta qualifiche («Squadra angolare - Interasse 8,5»),
  // appropriata a una finestra tutto-legno. L'alternativa è A50903.22 (+1,77 €).
  A4_I85_B15: {
    airGapMm: 4, axisOffsetMm: 8.5, rebateMm: 15, asse: 9, sedeMm: null,
    squadraAngolare: { DESTRA: "A50902.22.01", SINISTRA: "A50902.22.02" },
    supportoCerniera: { DESTRA: "A50803.01.01", SINISTRA: "A50803.01.02" },
    supportoForbice: "A50703.01.00",
    braccioMid: "22",
  },
  // Peruzzi.
  A4_I9_B18: {
    airGapMm: 4, axisOffsetMm: 9, rebateMm: 18, asse: 9, sedeMm: null,
    squadraAngolare: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    supportoCerniera: { DESTRA: "A50801.01.01", SINISTRA: "A50801.01.02" },
    supportoForbice: "A50701.01.00",
    braccioMid: "24",
  },
  A4_I13_B18: {
    airGapMm: 4, axisOffsetMm: 13, rebateMm: 18, asse: 13, sedeMm: null,
    squadraAngolare: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    supportoCerniera: { DESTRA: "A50801.DC.01", SINISTRA: "A50801.DC.02" },
    supportoForbice: "A50701.DC.00",
    braccioMid: "34",
  },
  A12_I9_B18: {
    airGapMm: 12, axisOffsetMm: 9, rebateMm: 18, asse: 9, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.24.01", SINISTRA: "A50904.24.02" },
    supportoCerniera: { DESTRA: "A50804.05.DX", SINISTRA: "A50804.05.SX" },
    supportoForbice: "A50701.05.00",
    braccioMid: "24",
  },
  A12_I9_B20: {
    airGapMm: 12, axisOffsetMm: 9, rebateMm: 20, asse: 9, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.26.01", SINISTRA: "A50904.26.02" },
    supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
    supportoForbice: "A50702.05.00",
    braccioMid: "26",
  },
  // Fosca.
  A12_I13_B18: {
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 18, asse: 13, sedeMm: 24,
    squadraAngolare: { DESTRA: "A50904.34.01", SINISTRA: "A50904.34.02" },
    supportoCerniera: { DESTRA: "A50804.05.DX", SINISTRA: "A50804.05.SX" },
    supportoForbice: "A50701.05.00",
    braccioMid: "34",
  },
  // PILOTA STORICO (distinta reale AGB 16/11/2021). `sedeMm` è dichiarata 18 dal
  // golden benché l'asse sia 13: la coppia 13x18 non esiste a listino ed è la
  // CONTRADDIZIONE NOTA (domanda 3b). Si conservano i codici verificati invece di
  // sostituire un'assunzione con un'altra — il totale resta 90,20 €.
  A12_I13_B20: {
    airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, asse: 13, sedeMm: 18,
    squadraAngolare: { DESTRA: "A50904.36.01", SINISTRA: "A50904.36.02" },
    supportoCerniera: { DESTRA: "A50805.05.DX", SINISTRA: "A50805.05.SX" },
    supportoForbice: "A50702.05.00",
    braccioMid: "36",
  },
};

export function geometria(id: ArtechGeometryId): Geometria {
  return GEOMETRIE[id];
}

/** «17,5» all'italiana; 15 resta «15». */
function mm(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function geometriaLabel(id: ArtechGeometryId): string {
  const g = GEOMETRIE[id];
  return `Aria ${g.airGapMm} · interasse ${mm(g.axisOffsetMm)} · battuta ${g.rebateMm}`;
}

/**
 * SEDE_30 è fuori perimetro nel Piano 1: p0473 (471) pubblica gli incontri DSS aria 12
 * solo per 9x18 e 13x24 — per 13x30 non ne esiste uno. Generare una sede 30 significherebbe
 * emettere una distinta a cui manca un pezzo, o inventarlo.
 */
export function assertSeatConfigSupportata(seatConfig: "STANDARD" | "SEDE_30"): void {
  if (seatConfig === "SEDE_30")
    throw new KitGenerationError(
      "Configurazione «sede 30» non ancora coperta: il listino 2026 non pubblica un " +
        "incontro DSS per il formato 13x30. Usare la configurazione standard.",
      "artech.sede",
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/kit/artech-geometrie.test.ts`
Expected: PASS — 8 test

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/artech-geometrie.ts src/server/kit/artech-geometrie.test.ts
git commit -m "feat(kit): tabella delle 7 geometrie ARTECH legno con codici interi

Sostituisce la geometria unica del pilota. I codici sono dichiarati interi e
mai composti: A50904.22 non esiste (zero occorrenze in 959 pagine), quindi
comporre A50904.<suffisso> per l'interasse 8,5 avrebbe prodotto un codice
plausibile e inesistente."
```

---

## Task 2: Incontri per geometria e mano

**Files:**
- Create: `src/server/kit/artech-incontri.ts`
- Test: `src/server/kit/artech-incontri.test.ts`

**Interfaces:**
- Consumes: `ArtechGeometryId`, `geometria` da `./artech-geometrie`
- Produces:
  - `function incontroNottolino(id: ArtechGeometryId, mano: "DESTRA" | "SINISTRA"): string`
  - `function incontroRibalta(id: ArtechGeometryId, mano: "DESTRA" | "SINISTRA"): string`
  - `function incontroDss(id: ArtechGeometryId, mano: "DESTRA" | "SINISTRA"): string`

**Perché serve la mano.** Per aria 12 gli incontri sono **ambidestri** (un solo codice);
per **aria 4** hanno DX/SX e perfino un prefisso di famiglia diverso (`A514DX.01.02` contro
`A48011.DC.02`). Il modulo oggi emette un unico codice ambidestro: aprire l'aria 4 senza
questo passaggio produrrebbe la mano sbagliata in silenzio.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/kit/artech-incontri.test.ts
import { describe, it, expect } from "vitest";
import { incontroNottolino, incontroRibalta, incontroDss } from "./artech-incontri";

describe("incontroNottolino", () => {
  it("aria 12 è ambidestro: la mano non cambia il codice", () => {
    expect(incontroNottolino("A12_I13_B20", "DESTRA")).toBe("A51400.05.02");
    expect(incontroNottolino("A12_I13_B20", "SINISTRA")).toBe("A51400.05.02");
  });

  it("aria 12 interasse 13 standard usa il 13x24", () => {
    expect(incontroNottolino("A12_I13_B18", "DESTRA")).toBe("A51400.CR.13");
  });

  it("aria 4 asse 9 ha la mano (famiglia A514DX/SX)", () => {
    expect(incontroNottolino("A4_I85_B15", "DESTRA")).toBe("A514DX.01.02");
    expect(incontroNottolino("A4_I85_B15", "SINISTRA")).toBe("A514SX.01.02");
  });

  it("aria 4 asse 13 ha la mano su una famiglia DIVERSA (A48011/A48012)", () => {
    expect(incontroNottolino("A4_I13_B18", "DESTRA")).toBe("A48011.DC.02");
    expect(incontroNottolino("A4_I13_B18", "SINISTRA")).toBe("A48012.DC.02");
  });
});

describe("incontroRibalta", () => {
  it("il pilota conserva lo zama viti dritte ambidestro", () => {
    expect(incontroRibalta("A12_I13_B20", "SINISTRA")).toBe("A51400.05.70");
  });

  it("aria 4 asse 9: a listino esiste solo l'acciaio, con la mano", () => {
    expect(incontroRibalta("A4_I9_B18", "DESTRA")).toBe("A514DX.01.64");
    expect(incontroRibalta("A4_I9_B18", "SINISTRA")).toBe("A514SX.01.64");
  });

  it("aria 4 asse 13: zama con la mano", () => {
    expect(incontroRibalta("A4_I13_B18", "DESTRA")).toBe("A514DX.DC.70");
  });
});

describe("incontroDss", () => {
  it("aria 12 9x18 ambidestro", () => {
    expect(incontroDss("A12_I13_B20", "DESTRA")).toBe("A51400.05.03");
  });

  it("aria 12 13x24 ambidestro, su famiglia A48010", () => {
    expect(incontroDss("A12_I13_B18", "DESTRA")).toBe("A48010.CR.03");
  });

  it("aria 4 ha la mano", () => {
    expect(incontroDss("A4_I9_B18", "DESTRA")).toBe("A48011.01.03");
    expect(incontroDss("A4_I9_B18", "SINISTRA")).toBe("A48012.01.03");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/kit/artech-incontri.test.ts`
Expected: FAIL — «Failed to resolve import "./artech-incontri"»

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/kit/artech-incontri.ts
import { geometria, type ArtechGeometryId, type PerMano } from "./artech-geometrie";

/**
 * Incontri (nottolino, ribalta, DSS) per geometria e mano.
 *
 * PERCHÉ LA MANO. Per aria 12 gli incontri sono ambidestri: un solo codice. Per aria 4
 * hanno DX/SX, e su famiglie diverse a seconda dell'asse (A514DX/SX per l'asse 9,
 * A48011/A48012 per l'asse 13). Emettere l'ambidestro dell'aria 12 su un serramento
 * aria 4 darebbe una distinta plausibile e inservibile.
 *
 * FONTI: nottolino p0469 (467) · ribalta p0471 (469) · DSS p0473 (471).
 */

type Chiave = "A4_ASSE9" | "A4_ASSE13" | "A12_9x18" | "A12_13x24";

/** Riduce la geometria alla chiave che governa gli incontri: aria + asse. */
function chiave(id: ArtechGeometryId): Chiave {
  const g = geometria(id);
  if (g.airGapMm === 4) return g.asse === 9 ? "A4_ASSE9" : "A4_ASSE13";
  // Aria 12: il pilota (sedeMm 18) resta sul 9x18 verificato dalla distinta 2021;
  // le altre aria-12 asse 13 usano il 13x24 derivato. Vedi domanda 3b.
  return g.sedeMm === 18 ? "A12_9x18" : "A12_13x24";
}

const ambidestro = (code: string): PerMano => ({ DESTRA: code, SINISTRA: code });

const NOTTOLINO: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A514DX.01.02", SINISTRA: "A514SX.01.02" },
  A4_ASSE13: { DESTRA: "A48011.DC.02", SINISTRA: "A48012.DC.02" },
  A12_9x18: ambidestro("A51400.05.02"),
  A12_13x24: ambidestro("A51400.CR.13"),
};

// ASSUNZIONE (aria 4, asse 13): a listino esistono sia l'acciaio (.DC.64) sia lo zama
// (.DC.70). Si adotta lo ZAMA per coerenza col pilota aria 12, che usa lo zama viti
// dritte. Per l'asse 9 la scelta non esiste: c'è solo l'acciaio.
const RIBALTA: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A514DX.01.64", SINISTRA: "A514SX.01.64" },
  A4_ASSE13: { DESTRA: "A514DX.DC.70", SINISTRA: "A514SX.DC.70" },
  A12_9x18: ambidestro("A51400.05.70"),
  A12_13x24: ambidestro("A51400.CR.70"),
};

const DSS: Record<Chiave, PerMano> = {
  A4_ASSE9: { DESTRA: "A48011.01.03", SINISTRA: "A48012.01.03" },
  A4_ASSE13: { DESTRA: "A48011.DC.03", SINISTRA: "A48012.DC.03" },
  A12_9x18: ambidestro("A51400.05.03"),
  A12_13x24: ambidestro("A48010.CR.03"),
};

type Mano = "DESTRA" | "SINISTRA";

export function incontroNottolino(id: ArtechGeometryId, mano: Mano): string {
  return NOTTOLINO[chiave(id)][mano];
}

export function incontroRibalta(id: ArtechGeometryId, mano: Mano): string {
  return RIBALTA[chiave(id)][mano];
}

export function incontroDss(id: ArtechGeometryId, mano: Mano): string {
  return DSS[chiave(id)][mano];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/kit/artech-incontri.test.ts`
Expected: PASS — 10 test

- [ ] **Step 5: Commit**

```bash
git add src/server/kit/artech-incontri.ts src/server/kit/artech-incontri.test.ts
git commit -m "feat(kit): incontri per geometria e mano

Per aria 12 gli incontri sono ambidestri; per aria 4 hanno DX/SX e su
famiglie diverse a seconda dell'asse. Il modulo emetteva un solo codice
ambidestro: aprire l'aria 4 senza questo passaggio avrebbe dato la mano
sbagliata in silenzio."
```

---

## Task 3: Cutover del modello di input

**Files:**
- Modify: `src/server/kit/types.ts` (righe 42-64)
- Modify: `src/server/kit/artech-legno-shared.ts` (righe 59-102: via `PILOT_GEOMETRY` e `assertPilotGeometry`)
- Modify: `src/server/kit/rules-artech-legno.ts`
- Modify: `src/server/kit/rules-artech-vasistas-legno.ts`
- Modify: `src/server/kit/from-request.ts`
- Modify: `src/server/kit/no-silent-fields.test.ts`
- Modify: `src/server/kit/artech-legno-shared.test.ts` · `rules-artech-legno.test.ts` · `rules-artech-vasistas-legno.test.ts` · `types.test.ts`

**Interfaces:**
- Consumes: `ArtechGeometryId`, `geometria`, `assertSeatConfigSupportata` (Task 1); `incontroNottolino`, `incontroRibalta`, `incontroDss` (Task 2)
- Produces: `ArtechKitInput` con `geometry: ArtechGeometryId` e `seatConfig: "STANDARD" | "SEDE_30"`; **senza** `airGapMm`/`axisOffsetMm`/`rebateMm`/`seatMm`

> È un cutover di tipo: TypeScript strict rompe ogni consumatore nell'istante in cui
> `types.ts` cambia. Sta tutto in un task perché il build deve tornare verde in **un solo
> commit**; i passi sotto lo attraversano file per file.

- [ ] **Step 1: Write the failing test — il golden deve reggere il nuovo input**

Sostituire in `src/server/kit/rules-artech-legno.test.ts` l'oggetto base (righe ~10-25,
quello con `airGapMm: 12, axisOffsetMm: 13, rebateMm: 20, seatMm: 18`) con:

```ts
const base = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  geometry: "A12_I13_B20",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
} as const satisfies ArtechKitInput;
```

E aggiungere in coda al file:

```ts
describe("le tre geometrie dei clienti reali", () => {
  it.each([
    ["MC", "A4_I85_B15", "A50902.22.02", "A514SX.01.02"],
    ["Peruzzi", "A4_I9_B18", "A50904.24.02", "A514SX.01.02"],
    ["Fosca", "A12_I13_B18", "A50904.34.02", "A51400.CR.13"],
  ] as const)("%s genera una distinta completa", (_nome, geometry, squadra, nottolino) => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, geometry });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.find((l) => l.position === "squadra-angolare")?.code).toBe(squadra);
    expect(lines.find((l) => l.position === "incontri-nottolino")?.code).toBe(nottolino);
  });

  it("il golden del pilota non si muove: 12 righe / 17 pezzi senza chiusure", () => {
    const lines = artechAntaRibaltaLegno.generate(base);
    expect(lines).toHaveLength(12);
    expect(lines.reduce((n, l) => n + l.quantity, 0)).toBe(17);
  });

  it("il golden storico con chiusure ON: 16 righe / 21 pezzi", () => {
    const lines = artechAntaRibaltaLegno.generate({ ...base, supplementaryClosures: true });
    expect(lines).toHaveLength(16);
    expect(lines.reduce((n, l) => n + l.quantity, 0)).toBe(21);
  });

  it("SEDE_30 viene rifiutata finché manca l'incontro DSS 13x30", () => {
    expect(() => artechAntaRibaltaLegno.generate({ ...base, seatConfig: "SEDE_30" })).toThrow(
      /sede 30/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/kit/rules-artech-legno.test.ts`
Expected: FAIL — errori di tipo su `geometry`/`seatConfig` sconosciuti in `ArtechKitInput`

- [ ] **Step 3: Cambiare il ramo ARTECH in `types.ts`**

Sostituire in `src/server/kit/types.ts` le righe 42-64 con:

```ts
/** Ramo ARTECH. La geometria è UN discriminatore, non quattro numeri liberi. */
export const artechInputSchema = z.object({
  ...COMMON,
  series: z.literal("ARTECH"),
  windowType: z.enum(["ANTA_RIBALTA", "ANTA_BATTENTE", "VASISTAS"]),
  /**
   * Geometria del serramento: una delle 7 combinazioni (aria, interasse, battuta)
   * pubblicate dal listino 2026. Sostituisce i quattro campi numerici liberi.
   *
   * PERCHÉ UN DISCRIMINATORE. (a) l'interasse 8,5 non sta in un `Int` e non è una
   * misura su cui si fa aritmetica: è un selettore categoriale, come tutti e tre;
   * (b) le combinazioni valide sono un insieme chiuso di 7 — tre campi liberi ne
   * permettono centinaia di inesistenti; (c) una sola fonte di verità: aria,
   * interasse e battuta si DERIVANO dalla tabella per la UI, quindi non possono
   * divergere dai codici emessi. È lo stesso schema di `tourSchema` per il bilico.
   */
  geometry: z.enum([
    "A4_I85_B15",
    "A4_I9_B18",
    "A4_I13_B18",
    "A12_I9_B18",
    "A12_I9_B20",
    "A12_I13_B18",
    "A12_I13_B20",
  ]),
  /**
   * Famiglia di schemi AGB. La NB «per tipologia di serramento con sede incontri da
   * 30 mm riferirsi agli schemi "sede 30 mm"» compare su 22 pagine: è AGB stessa a
   * trattare la sede come discriminante fra famiglie. `SEDE_30` è accettata dallo
   * schema ma RIFIUTATA dai moduli finché manca l'incontro DSS 13x30 a listino.
   */
  seatConfig: z.enum(["STANDARD", "SEDE_30"]).default("STANDARD"),
  openingSide: z.enum(["DESTRA", "SINISTRA"]),
  openingDir: z.enum(["TIRARE", "SPINGERE"]).default("TIRARE"),
  supplementaryClosures: z.boolean().optional(),
});
```

- [ ] **Step 4: Svuotare `artech-legno-shared.ts` della vecchia guardia**

Cancellare da `src/server/kit/artech-legno-shared.ts` le righe 59-102 (`PILOT_GEOMETRY`,
`GEOMETRY_LABELS`, `assertPilotGeometry`) e la riga 6 diventa:

```ts
import type { ArtechKitInput } from "./types";
```

Sostituire `PER_MANO` (righe 34-37) — la coppia cerniera non è più una costante del pilota,
la fornisce la tabella delle geometrie:

```ts
// PER_MANO è stata rimossa: squadra angolare e supporto cerniera dipendono dalla
// geometria e sono dichiarati riga per riga in `artech-geometrie.ts`. Tenerli qui
// come costanti significava cablare il pilota.
```

`PER_MANO` è usata **solo** da `rules-artech-legno.ts` e dal proprio test (verificato):
nessun altro modulo si rompe. In `src/server/kit/artech-legno-shared.test.ts` **cancellare**
il blocco `describe("assertPilotGeometry", …)` (righe ~45-74) e il test
`"PER_MANO ha varianti DX/SX…"` (righe ~12-17), e togliere `PER_MANO`,
`PILOT_GEOMETRY`, `assertPilotGeometry` dagli import di testa. Restano i test di
`MOVIMENTO_ANGOLARE` e `incontriNottolino`, che non cambiano.

I moduli disattivati `rules-artech-battente-legno.ts`, `rules-artech-pvc.ts` e
`rules-artech-alu.ts` **non** leggono i campi geometria (verificato): compilano senza
modifiche.

- [ ] **Step 5: Riscrivere le selezioni in `rules-artech-legno.ts`**

In `src/server/kit/rules-artech-legno.ts`:

Import (righe 20-25) →
```ts
import { MOVIMENTO_ANGOLARE, incontriNottolino } from "./artech-legno-shared";
import { geometria, assertSeatConfigSupportata } from "./artech-geometrie";
import { incontroNottolino, incontroRibalta, incontroDss } from "./artech-incontri";
```

Sostituire `assertPilotGeometry(input);` (riga 177) con:
```ts
assertSeatConfigSupportata(input.seatConfig);
const geo = geometria(input.geometry);
```

Sostituire il blocco `const mano = PER_MANO[input.openingSide]` e le tre righe che lo usano
(righe 223-246) con:
```ts
lines.push(
  {
    position: "squadra-angolare",
    code: geo.squadraAngolare[input.openingSide],
    quantity: 1,
    ruleId: "artech.mano",
    ruleDescription: `Squadra angolare legno aria ${geo.airGapMm} interasse ${geo.axisOffsetMm} battuta ${geo.rebateMm} ${input.openingSide}`,
  },
  {
    position: "supporto-cerniera",
    code: geo.supportoCerniera[input.openingSide],
    quantity: 1,
    ruleId: "artech.mano",
    ruleDescription: `Supporto cerniera parte telaio aria ${geo.airGapMm} battuta ${geo.rebateMm} ${input.openingSide}`,
  },
  {
    position: "coperture-kit",
    code: coperture[input.openingSide],
    quantity: 1,
    ruleId: "artech.coperture",
    ruleDescription: `Kit copertura supporto forbice + supporto cerniera ${finish} ${input.openingSide}`,
  },
);
```

Sostituire il braccio forbice (righe 214-221) — il `mid` viene dalla geometria:
```ts
const braccioPrefix = input.openingSide === "DESTRA" ? "A51911" : "A51912";
lines.push({
  position: "forbice-braccio",
  code: `${braccioPrefix}.${geo.braccioMid}.${braccioGruppo.gruppo}`,
  quantity: 1,
  ruleId: "artech.mano",
  ruleDescription: `Braccio forbice legno battuta ${geo.rebateMm} interasse ${geo.axisOffsetMm} ${input.openingSide.toLowerCase()} per larghezza ${input.widthMm} mm`,
});
```

Sostituire il blocco `FISSI` (righe 88-116) — supporto forbice, incontro DSS e incontro
ribalta ora dipendono dalla geometria, quindi escono da `FISSI` e diventano righe esplicite.
`FISSI` si riduce a:
```ts
/** Componenti davvero indipendenti da geometria, dimensioni e mano. */
const FISSI = [
  MOVIMENTO_ANGOLARE,
  {
    position: "perno-supporto-forbice",
    code: "A50790.00.00",
    quantity: 1,
    descr: "Perno per supporto forbice",
  },
] as const;
```

E dopo `lines.push(...linesFromParts(FISSI, "artech.fissi"));` aggiungere:
```ts
lines.push(
  {
    position: "supporto-forbice",
    code: geo.supportoForbice,
    quantity: 1,
    ruleId: "artech.geometria",
    ruleDescription: `Supporto forbice legno aria ${geo.airGapMm} battuta ${geo.rebateMm}`,
  },
  {
    position: "incontro-dss",
    code: incontroDss(input.geometry, input.openingSide),
    quantity: 1,
    ruleId: "artech.incontri",
    ruleDescription: `Incontro DSS aria ${geo.airGapMm} asse ${geo.asse}`,
  },
  {
    position: "incontro-ribalta",
    code: incontroRibalta(input.geometry, input.openingSide),
    quantity: 1,
    ruleId: "artech.incontri",
    ruleDescription: `Incontro ribalta aria ${geo.airGapMm} asse ${geo.asse}`,
  },
);
```

Sostituire gli incontri nottolino (righe 250-256):
```ts
lines.push({
  position: "incontri-nottolino",
  code: incontroNottolino(input.geometry, input.openingSide),
  quantity: incontriNottolino(input.widthMm, input.heightMm),
  ruleId: "artech.incontri",
  ruleDescription:
    `Incontri nottolino aria ${geo.airGapMm} asse ${geo.asse}` +
    (geo.sedeMm === null ? " (fresatura)" : ` sede ${geo.sedeMm}`) +
    ` (passo ${PILOT.passoVerticaleMm} mm)`,
});
```

E il cremonese (riga 189-196) usa `geo` solo nella descrizione: lasciare invariata la
selezione, sostituire `input.airGapMm` con `geo.airGapMm` ovunque compaia.

> **L'ordine delle righe cambia** rispetto a prima (supporto forbice, DSS e ribalta si
> spostano dopo i fissi). Il conteggio resta 12/16 e i pezzi 17/21, quindi il golden regge;
> se un test confronta l'ordine posizione-per-posizione, aggiornarlo.

- [ ] **Step 6: Stessa sostituzione in `rules-artech-vasistas-legno.ts`**

Sostituire l'import di riga 27 e la chiamata di riga 167:
```ts
import { MOVIMENTO_ANGOLARE } from "./artech-legno-shared";
import { geometria, assertSeatConfigSupportata } from "./artech-geometrie";
```
```ts
assertSeatConfigSupportata(input.seatConfig);
const geo = geometria(input.geometry);
```
e sostituire ogni uso di `input.airGapMm` / `input.axisOffsetMm` / `input.rebateMm` /
`input.seatMm` con il corrispondente `geo.*`.

> La vasistas **non** apre le nuove geometrie in questo piano: il suo schema `p0418 (416)`
> è trascritto sull'aria 12. Aggiungere subito dopo `const geo = …`:
> ```ts
> if (geo.airGapMm !== 12)
>   throw new KitGenerationError(
>     `Vasistas: lo schema p0418 (416) è trascritto per l'aria 12; aria ${geo.airGapMm} non è coperta.`,
>     "artech.vasistas.geometria",
>   );
> ```

- [ ] **Step 7: Aggiornare `from-request.ts`**

In `PersistedKitRequest` (righe 15-18) sostituire i quattro numerici con:
```ts
  geometry: string | null;
  seatConfig: string | null;
```
(lasciare `airGapMm`/`axisOffsetMm`/`rebateMm`/`seatMm` **fuori** dall'interfaccia: sono
colonne legacy che nessun modulo legge.)

E nel ramo ARTECH del `candidate` (righe 54-64):
```ts
      : {
          ...common,
          series: row.series,
          geometry: row.geometry,
          seatConfig: row.seatConfig ?? "STANDARD",
          openingSide: row.openingSide,
          openingDir: row.openingDir ?? "TIRARE",
          supplementaryClosures: row.supplementaryClosures,
        };
```

- [ ] **Step 8: Aggiornare `no-silent-fields.test.ts`**

In `artechBase` e `vasistasBase` sostituire i quattro numerici con
`geometry: "A12_I13_B20", seatConfig: "STANDARD"`.

Nelle `mutazioni` dell'**anta-ribalta** sostituire le quattro righe `airGapMm`/
`axisOffsetMm`/`rebateMm`/`seatMm` con:
```ts
      { campo: "geometry", valore: "A4_I9_B18" },
      { campo: "seatConfig", valore: "SEDE_30" },
```

Nelle `mutazioni` della **vasistas** sostituire le stesse quattro righe con:
```ts
      { campo: "geometry", valore: "A4_I9_B18" },
      { campo: "seatConfig", valore: "SEDE_30" },
```
(entrambe producono un **rifiuto** — la vasistas rifiuta l'aria 4 per la guardia dello
Step 6, e `SEDE_30` per `assertSeatConfigSupportata` — e il test accetta il rifiuto come
«cambio di esito».)

Infine, nel blocco `inerti` dell'anta-ribalta, **aggiornare la ragione di `openingDir`**:
resta inerte, ma il riferimento al file di assunzioni cambia:
```ts
      {
        campo: "openingDir",
        valore: "SPINGERE",
        perche:
          "RILIEVO APERTO (domanda 16): `openingDir` è raccolto, validato e persistito, ma " +
          "NESSUN modulo lo legge. L'agente dice che l'apertura è quasi sempre «a tirare», " +
          "ora è il default dello schema. Va risolto togliendolo dall'input o usandolo — " +
          "vedi docs/superpowers/kit-assunzioni/legno.md.",
      },
```

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run src/server/kit/`
Expected: PASS. In particolare `rules-artech-legno.test.ts` verde con i tre clienti reali e
il golden a 12/17 e 16/21.

- [ ] **Step 10: Typecheck**

Run: `pnpm typecheck`
Expected: errori residui solo in `src/server/api/routers/kit.ts` e
`src/app/(dashboard)/richieste/**` — sono i Task 4 e 6. **Non correggerli qui.**

> Se si vuole un commit verde anche sul typecheck, eseguire i Task 4 e 6 prima di
> committare questo. Altrimenti committare e proseguire: il ramo resta rosso per due task.

- [ ] **Step 11: Commit**

```bash
git add src/server/kit/
git commit -m "refactor(kit)!: la geometria diventa un discriminatore unico

I quattro campi numerici liberi (aria, interasse, battuta, sede) lasciano
il posto a geometry: ArtechGeometryId, come tourSchema fa per il bilico.
L'interasse 8,5 non stava in un Int e i tre clienti reali venivano tutti
rifiutati. La sede non è più un input: è derivata dalla geometria e
mostrata. assertPilotGeometry e PILOT_GEOMETRY sono rimosse.

Golden invariato: 12 righe / 17 pezzi senza chiusure, 16 / 21 con."
```

---

## Task 4: Migrazione Prisma e router

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_kit_geometria/migration.sql`
- Modify: `src/server/api/routers/kit.ts` (righe 27-40 e 84-95)

**Interfaces:**
- Consumes: `kitInputSchema` (Task 3), `kitInputFromRequest` (Task 3)
- Produces: colonne `kit_requests.geometry`, `.seat_config`, `.engine_version`

- [ ] **Step 1: Aggiungere gli enum e le colonne a `prisma/schema.prisma`**

Dopo `enum HingeSide` aggiungere:
```prisma
enum ArtechGeometry {
  A4_I85_B15
  A4_I9_B18
  A4_I13_B18
  A12_I9_B18
  A12_I9_B20
  A12_I13_B18
  A12_I13_B20
}

enum SeatConfig {
  STANDARD
  SEDE_30
}
```

In `model KitRequest`, sostituire il blocco geometria (le sei righe `airGapMm` … `openingDir`)
con:
```prisma
  // ── Geometria: SOLO serie ARTECH ─────────────────────────────────────────
  // Un discriminatore unico al posto dei quattro numerici. Le vecchie colonne
  // restano nullable come LEGACY: nessun modulo le legge (dichiarato in
  // no-silent-fields.test.ts), servono solo a non perdere lo storico.
  geometry   ArtechGeometry? 
  seatConfig SeatConfig?     @default(STANDARD) @map("seat_config")

  openingSide HingeSide?        @map("opening_side")
  openingDir  OpeningDirection? @map("opening_direction")

  /// LEGACY — non letto da alcun modulo dal 2026-07-29.
  airGapMm     Int? @map("air_gap_mm")
  /// LEGACY
  axisOffsetMm Int? @map("axis_offset_mm")
  /// LEGACY
  rebateMm     Int? @map("rebate_mm")
  /// LEGACY
  seatMm       Int? @map("seat_mm")

  /// Versione del motore che ha prodotto la distinta.
  engineVersion String? @map("engine_version")
  /// Ricalcolo versionato: la nuova versione punta a quella che sostituisce.
  supersededById String?      @unique @map("superseded_by_id")
  supersededBy   KitRequest?  @relation("KitRequestVersione", fields: [supersededById], references: [id])
  supersedes     KitRequest?  @relation("KitRequestVersione")
```

- [ ] **Step 2: Generare la migrazione**

```bash
set -a; source .env; set +a
npx prisma migrate dev --name kit_geometria --create-only
```

Aprire il file generato e **aggiungere in coda** il backfill (senza, le righe esistenti
diventano non rigenerabili):

```sql
-- Le righe esistenti sono tutte del pilota: aria 12 / interasse 13 / battuta 20.
UPDATE "kit_requests"
SET "geometry" = 'A12_I13_B20', "seat_config" = 'STANDARD'
WHERE "series" = 'ARTECH' AND "geometry" IS NULL;

-- Le righe TOUR non hanno geometria ARTECH: restano NULL per costruzione.
```

- [ ] **Step 3: Applicare e rigenerare il client**

```bash
set -a; source .env; set +a
npx prisma migrate dev
npx prisma generate
```
Expected: «Your database is now in sync with your schema.»

- [ ] **Step 4: Aggiornare il router**

In `src/server/api/routers/kit.ts`, sostituire il `branch` (righe 27-40) con:
```ts
    const branch =
      specs.series === "TOUR"
        ? { tourSchema: specs.tourSchema }
        : {
            geometry: specs.geometry,
            seatConfig: specs.seatConfig,
            openingSide: specs.openingSide,
            openingDir: specs.openingDir,
            supplementaryClosures: specs.supplementaryClosures ?? false,
          };
```

E nella `update` di `generate` (righe 84-95) aggiungere `engineVersion: output.engineVersion`
accanto a `generatedKit`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/server/ && pnpm typecheck`
Expected: test verdi; typecheck con errori residui solo in `richieste/**` (Task 6).

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/server/api/routers/kit.ts
git commit -m "feat(kit): migrazione geometria + engineVersion sulla riga

geometry e seat_config sostituiscono i quattro numerici, che restano
nullable come legacy per non perdere lo storico. Backfill delle righe
esistenti a A12_I13_B20 (sono tutte del pilota). engine_version passa dal
JSON a colonna."
```

---

## Task 5: Ricalcolo versionato

**Files:**
- Modify: `src/server/api/routers/kit.ts`
- Test: `src/server/api/routers/kit.test.ts`

**Interfaces:**
- Consumes: `kitInputFromRequest`, `KitEngine`
- Produces: `kit.ricalcola({ kitRequestId }) → { id, requestNumber }` (la **nuova** riga)

**Perché versionare invece di bloccare.** Rigenerare riesegue il codice-regole *corrente* e
riscrive `kit_components`: una distinta già mandata al cliente cambierebbe sotto i piedi. Ma
il ricalcolo serve (AGB 4K gli dedica un modulo). Sintesi: su una richiesta non più `DRAFT`,
«Ricalcola» **crea una nuova versione** e lascia intatta quella emessa.

- [ ] **Step 1: Write the failing test**

> `kit.test.ts` usa **Prisma mockato** (`vi.fn()`), non un DB reale: gli stub disponibili in
> testa al file sono `requestCreate`, `requestFindFirst`, `requestUpdate`, `requestCount`, e
> il caller si costruisce con `createCallerFactory(appRouter)(makeCtx(agent))`. I test sotto
> seguono quello stile — **non** inventare helper.

```ts
// src/server/api/routers/kit.test.ts — aggiungere in coda
describe("kit.ricalcola", () => {
  beforeEach(() => {
    requestCount.mockResolvedValue(7);
  });

  it("su una richiesta COMPLETED crea una NUOVA riga e marca l'originale", async () => {
    requestFindFirst.mockResolvedValue({
      ...validInput,
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: null,
      customerId: null,
      tourSchema: null,
      sashWeightKg: null,
      notes: null,
    });
    requestCreate.mockResolvedValue({ id: "req2", requestNumber: "KIT-2026-0008" });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const nuova = await caller.kit.ricalcola({ kitRequestId: "req1" });

    expect(nuova.id).toBe("req2");
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", geometry: validInput.geometry }),
      }),
    );
    expect(requestUpdate).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: { supersededById: "req2" },
    });
  });

  it("su una richiesta DRAFT rigenera in loco: nessuna riga nuova", async () => {
    requestFindFirst.mockResolvedValue({
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "DRAFT",
      supersededById: null,
    });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const esito = await caller.kit.ricalcola({ kitRequestId: "req1" });

    expect(esito.id).toBe("req1");
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("una richiesta già ricalcolata rifiuta con CONFLICT", async () => {
    requestFindFirst.mockResolvedValue({
      id: "req1",
      requestNumber: "KIT-2026-0001",
      status: "COMPLETED",
      supersededById: "req2",
    });

    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.ricalcola({ kitRequestId: "req1" })).rejects.toThrow(/già.*ricalcolata/i);
  });
});
```

> `validInput` (riga 38 del file) va aggiornato nel Task 3/4: sostituire i quattro campi
> numerici con `geometry: "A12_I13_B20", seatConfig: "STANDARD"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/api/routers/kit.test.ts -t ricalcola`
Expected: FAIL — `caller.kit.ricalcola is not a function`

- [ ] **Step 3: Implementare la route**

Aggiungere in `src/server/api/routers/kit.ts`, dopo `generate`:

```ts
  /**
   * Ricalcolo. Su `DRAFT` rigenera in loco; su qualunque altro stato **crea una nuova
   * versione** e lascia intatta quella già emessa — una distinta mandata al cliente non
   * può cambiare perché il motore o i prezzi sono cambiati nel frattempo.
   */
  ricalcola: agentProcedure
    .input(z.object({ kitRequestId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.kitRequestId, agentId: ctx.session.user.id },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

      if (request.status === "DRAFT")
        return { id: request.id, requestNumber: request.requestNumber };

      if (request.supersededById)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Questa richiesta è già stata ricalcolata: aprire la versione più recente.",
        });

      const year = new Date().getFullYear();
      const inYear = await ctx.db.kitRequest.count({
        where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
      });
      const requestNumber = `KIT-${year}-${String(inYear + 1).padStart(4, "0")}`;

      const nuova = await ctx.db.kitRequest.create({
        data: {
          windowType: request.windowType,
          widthMm: request.widthMm,
          heightMm: request.heightMm,
          material: request.material,
          finish: request.finish,
          series: request.series,
          sashWeightKg: request.sashWeightKg,
          geometry: request.geometry,
          seatConfig: request.seatConfig,
          openingSide: request.openingSide,
          openingDir: request.openingDir,
          supplementaryClosures: request.supplementaryClosures,
          tourSchema: request.tourSchema,
          notes: request.notes,
          customerId: request.customerId,
          requestNumber,
          status: "DRAFT",
          agentId: ctx.session.user.id,
        },
      });
      await ctx.db.kitRequest.update({
        where: { id: request.id },
        data: { supersededById: nuova.id },
      });
      return { id: nuova.id, requestNumber };
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/api/routers/kit.test.ts -t ricalcola`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/kit.ts src/server/api/routers/kit.test.ts
git commit -m "feat(kit): ricalcolo versionato al posto della rigenerazione in loco

Su DRAFT rigenera in loco; su una richiesta già emessa crea una nuova
versione e lascia intatta quella mandata al cliente. Rigenerare riesegue
il codice-regole corrente e riscrive kit_components: senza versioning una
distinta già inviata cambierebbe sotto i piedi."
```

---

## Task 6: Wizard e scheda dettaglio

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx`
- Modify: `src/lib/kit-labels.ts`
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: `GEOMETRIE`, `geometriaLabel`, `ArtechGeometryId` (Task 1); `kit.ricalcola` (Task 5)

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx — aggiungere
it("il passo geometria offre le 7 combinazioni con aria/interasse/battuta in chiaro", () => {
  render(<NuovaRichiestaClient />);
  fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
  fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
  expect(screen.getByLabelText(/aria 4 · interasse 8,5 · battuta 15/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/aria 12 · interasse 13 · battuta 18/i)).toBeInTheDocument();
});

it("non chiede più la sede telaio", () => {
  render(<NuovaRichiestaClient />);
  expect(screen.queryByLabelText(/sede telaio/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL — «Unable to find a label with the text of: /aria 4 · interasse 8,5/»

- [ ] **Step 3: Aggiornare il wizard**

In `nuova-client.tsx`:

`ARTECH_DEFAULT` (righe 22-36) →
```ts
const ARTECH_DEFAULT: ArtechKitInput = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  geometry: "A12_I13_B20",
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
};
```

`DIMENSION_FIELDS` (righe 490-515) si riduce alle due quote:
```ts
const DIMENSION_FIELDS: Array<{ key: "widthMm" | "heightMm"; label: string; min: number; max: number }> = [
  { key: "widthMm", label: "Larghezza", min: 300, max: 3000 },
  { key: "heightMm", label: "Altezza", min: 300, max: 3000 },
];
```

`STEP_SCHEMAS.ARTECH` (righe 150-162) →
```ts
  ARTECH: [
    artechInputSchema.pick({ windowType: true, series: true, material: true }),
    artechInputSchema.pick({ widthMm: true, heightMm: true, sashWeightKg: true }),
    artechInputSchema.pick({ geometry: true, openingSide: true, openingDir: true, finish: true }),
  ],
```

Aggiungere in `Step3ManoFinitura`, **prima** del fieldset «Mano»:
```tsx
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Geometria del serramento</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          Aria, interasse e battuta si leggono sul disegno del serramento. La sede degli
          incontri la determina questa scelta: non va indicata.
        </p>
        {/* Mobile-first: una colonna sotto sm — le etichette sono lunghe e a 375px
            devono avere la riga intera. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(GEOMETRIE) as ArtechGeometryId[]).map((id) => (
            <RadioOption
              key={id}
              name="geometry"
              label={geometriaLabel(id)}
              checked={form.geometry === id}
              onChange={() => update("geometry", id)}
            />
          ))}
        </div>
      </fieldset>
```

In `Step4Riepilogo`, ramo ARTECH, sostituire i quattro `SummaryItem` di aria/asse/battuta/sede
con:
```tsx
      <SummaryItem label="Geometria" value={geometriaLabel(form.geometry)} />
      <SummaryItem
        label="Sede incontri"
        value={
          GEOMETRIE[form.geometry].sedeMm === null
            ? "Fresatura (aria 4)"
            : `${GEOMETRIE[form.geometry].sedeMm} mm — derivata`
        }
      />
```

Import in testa al file:
```ts
import { GEOMETRIE, geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";
```

- [ ] **Step 4: Aggiungere «Ricalcola» alla scheda dettaglio**

In `dettaglio-client.tsx`, accanto al pulsante «Rigenera» esistente:
```tsx
      {richiesta.status !== "DRAFT" && !richiesta.supersededById && (
        <Button
          variant="secondary"
          onClick={() => void ricalcola.mutateAsync({ kitRequestId: richiesta.id })
            .then((r) => router.push(`/richieste/${r.id}`))}
          loading={ricalcola.isPending}
        >
          Ricalcola
        </Button>
      )}
      {richiesta.supersededById && (
        <p className="text-xs text-ink-subtle">
          Questa distinta è stata ricalcolata.{" "}
          <Link href={`/richieste/${richiesta.supersededById}`} className="text-brand underline">
            Apri la versione più recente
          </Link>
        </p>
      )}
```
con `const ricalcola = api.kit.ricalcola.useMutation();` fra gli hook.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/app/ && pnpm typecheck && pnpm lint`
Expected: tutto verde.

- [ ] **Step 6: Verifica browser (desktop + 375px)**

```bash
bash scripts/dev-bootstrap.sh
pnpm dev
```
Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
Controllare a **1440×900** e a **375×667**: i 7 preset leggibili e cliccabili, nessun
overflow orizzontale, «Sede incontri» presente nel riepilogo, il campo «Sede telaio» sparito.

- [ ] **Step 7: Commit**

```bash
git add src/app/ src/lib/kit-labels.ts
git commit -m "feat(kit): il wizard chiede la geometria, non quattro numeri

Sette preset con aria/interasse/battuta in chiaro al posto di quattro campi
numerici da indovinare. La sede telaio sparisce dall'input e compare nel
riepilogo come valore derivato. Aggiunto «Ricalcola» sulla scheda."
```

---

## Task 7: Gate «ogni codice emesso è a listino con prezzo»

**Files:**
- Create: `src/server/kit/codici-a-listino.integration.test.ts`

**Interfaces:**
- Consumes: `GEOMETRIE`, `artechAntaRibaltaLegno`, `PrismaClient`

**Perché.** È il controllo che mancava a PVC e battente, e la regola non negoziabile del
consiglio: nessun codice viene emesso se non esiste a catalogo **con prezzo**. Il test
unitario mocka `product.findMany` e quindi un codice inesistente gli sfugge.

- [ ] **Step 1: Write the test**

```ts
// src/server/kit/codici-a-listino.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GEOMETRIE } from "./artech-geometrie";
import { artechAntaRibaltaLegno } from "./rules-artech-legno";
import type { ArtechGeometryId } from "./artech-geometrie";
import type { KitInput } from "./types";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("ogni codice emettibile esiste a catalogo con prezzo", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  const base = {
    windowType: "ANTA_RIBALTA",
    series: "ARTECH",
    material: "LEGNO",
    widthMm: 550,
    heightMm: 1820,
    seatConfig: "STANDARD",
    openingDir: "TIRARE",
    finish: "ARGENTO",
    supplementaryClosures: true,
  } as const;

  const combinazioni = (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
    (["DESTRA", "SINISTRA"] as const).map((openingSide) => ({ geometry, openingSide })),
  );

  it.each(combinazioni)(
    "$geometry / $openingSide — nessun codice orfano",
    async ({ geometry, openingSide }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        geometry,
        openingSide,
      } as KitInput);

      const codici = [...new Set(lines.map((l) => l.code))];
      const trovati = await db.product.findMany({
        where: { agbCode: { in: codici } },
        select: { agbCode: true, basePrice: true },
      });
      const prezzati = new Set(
        trovati.filter((p) => p.basePrice !== null && Number(p.basePrice) > 0).map((p) => p.agbCode),
      );
      const orfani = codici.filter((c) => !prezzati.has(c));
      expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
    },
  );
});
```

- [ ] **Step 2: Run it against the real catalogue**

```bash
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" npx vitest run src/server/kit/codici-a-listino.integration.test.ts
```
Expected: **14 test PASS** (7 geometrie × 2 mani).

> Se qualcuno fallisce, il codice orfano è stampato nel messaggio. **Non aggirare il test**:
> o il codice è sbagliato nella tabella, o il catalogo va re-importato (`pnpm import:agb`).

- [ ] **Step 3: Commit**

```bash
git add src/server/kit/codici-a-listino.integration.test.ts
git commit -m "test(kit): gate — ogni codice emettibile è a listino con prezzo

Percorre le 7 geometrie per entrambe le mani e verifica ogni codice contro
il catalogo reale. È il controllo che mancava a PVC e battente: il test
unitario mocka product.findMany, quindi un codice inesistente gli sfugge."
```

---

## Gate finale

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" npx vitest run src/server/kit/ --coverage=false
```

Attesi: typecheck/lint puliti · suite verde con il golden a **16 righe / 21 pezzi / 90,20 €**
· build 17 route · integration 14/14 sul gate codici + i test esistenti.

## Azioni ops al merge

1. **`migrate deploy`** → `<timestamp>_kit_geometria` (enum + colonne + backfill).
2. **Nessun re-import del catalogo** e **nessun `db:seed:kit`**: i template non cambiano e
   tutti i codici delle 7 geometrie sono già a listino (garantito dal Task 7).
3. Verifica funzionale: anta-ribalta 550×1820 SX argento chiusure ON → **16 righe / 21 pezzi
   / 90,20 €**; poi una geometria nuova (Fosca: `A12_I13_B18`) → distinta completa, zero
   warning.
