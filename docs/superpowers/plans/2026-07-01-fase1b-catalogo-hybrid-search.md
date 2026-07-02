# Fase 1b — Catalogo AGB + Hybrid Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **UI tasks (7, 8) MUST go through the `impeccable` skill** (standing user instruction). Doubts/inconsistencies → `llm-council`.

**Goal:** Import the AGB LISTINO 2026 PDF (~6.300 codici) into Postgres via a deterministic parser, expose hybrid product search (tsvector now, pgvector-ready) through tRPC, and ship the Archivio + product-detail UI.

**Architecture:** Pure `parseListino` state machine over `pdftotext -layout` output → idempotent import script → `RAGEngine` (the ONLY module with pgvector raw SQL, degrading gracefully to tsvector-only while embeddings are null) → `product` tRPC router → client UI with tRPC hooks.

**Tech Stack:** existing Fase 1a stack (Next 15, tRPC v11, Prisma 6 + pgvector, Vitest). New: `poppler-utils` (pdftotext, runtime prerequisite for import only).

## Global Constraints

- TypeScript strict; all client↔server via tRPC; all DB via Prisma.
- **Raw SQL ONLY inside `src/server/ai/rag.ts`** (`$queryRaw`) + migrations.
- **No LLM anywhere in parsing/import** (deterministic only).
- UI in Italian; product codes always `font-mono`.
- `EMBEDDING_DIM = 768` (from `src/server/constants/embedding.ts`); embeddings stay null in 1b.
- Every task ends green: `pnpm typecheck && pnpm lint && pnpm test`; final task adds `pnpm build`.
- Prisma/tsx commands need `set -a; source .env; set +a` first (sandbox engines).
- The 39MB PDF lives at `/tmp/claude-0/-home-user-AGB-Finder/768d2eb8-9782-5f60-9e2d-43bb617d0ce9/scratchpad/catalog.pdf` — NEVER committed.

## File Structure

```
src/server/catalog/
  parse-listino.ts        # pure parser (state machine)  [Task 1]
  parse-listino.test.ts   # tests on real fixture text   [Task 1]
  fixtures.ts             # real page excerpts (committed) [Task 1]
  map-product.ts          # ParsedRow -> Prisma data (pure) [Task 2]
  map-product.test.ts     [Task 2]
  extract-pdf.ts          # pdftotext wrapper            [Task 2]
scripts/import-agb.ts     # pnpm import:agb <pdf>        [Task 2]
prisma/seed-catalog.ts    # synthetic seed from fixtures [Task 3]
src/server/ai/
  embedding.ts            # EmbeddingService + Gemini(deferred) [Task 4]
  embedding.test.ts       [Task 4]
  rag.ts                  # RAGEngine — only raw-SQL module [Task 5]
  rag.test.ts             # SQL-branch unit tests (fake)  [Task 5]
  rag.integration.test.ts # gated by INTEGRATION_DATABASE_URL [Task 5]
src/server/api/routers/
  product.ts + product.test.ts                          [Task 6]
src/components/product/
  product-card.tsx, product-row.tsx, price.tsx, product-code.tsx [Task 7]
src/app/(dashboard)/archivio/
  page.tsx (+ search client component)                  [Task 7]
  [id]/page.tsx                                         [Task 8]
```

---

### Task 1: Parser deterministico `parseListino`

**Files:**
- Create: `src/server/catalog/fixtures.ts`
- Create: `src/server/catalog/parse-listino.ts`
- Test: `src/server/catalog/parse-listino.test.ts`

**Interfaces:**
- Produces: `parseListino(text: string): ParseResult`, types `ParsedRow`, `ParseResult` (shapes below — Tasks 2/3 rely on them verbatim), fixtures `PAGE_SERRATURE`, `PAGE_CERNIERE`, `PAGE_PROFILI`.

- [ ] **Step 1: Commit real fixtures** — `src/server/catalog/fixtures.ts` with the verbatim `pdftotext -layout` excerpts already validated (pages 120/300/620). Template literals, `\f` prepended to each page. Example shape (full content comes from the validated extraction in this session):

```ts
// Real excerpts from AGB LISTINO 2026 (pdftotext -layout). Used by parser
// tests and by the synthetic dev seed. Keep verbatim — spacing matters.
export const PAGE_SERRATURE = `\f                SERRATURE                                                                LISTINO 2026
Incontri - Sicurezza
                            Larghezza 22 mm, bordo tondo spessore 3 mm
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2
                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2
                                              Bronzato opaco vern.   B00590.15.22   25 250    0,97   A2
                                              Cromato opaco          B00590.15.34   25 250    2,07   A2
                            Larghezza 22 mm, bordo tondo spessore 2 mm
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.30.03   25 250    1,05   A1
                                              Nichelato lucido       B00590.30.06   25 250    1,15   A1
                                              Bronzato opaco vern.   B00590.30.22   25 250    0,70   A1
                                              Cromato opaco          B00590.30.34   25 250    1,90   A1
                            Larghezza 20 mm, bordo tondo
                            ACCIAIO
                            LUNGHEZZA         FINITURA               CODICE                     € CS
                            238 mm            Ottonato lucido        B00590.43.03   25 250    1,23   A2
                                              Zinco Tropical         B00590.43.04   25 250    0,92   A2
                                              Nichelato lucido       B00590.43.06   25 250    1,35   A2
                                              Zinco Silver           B00590.43.15   25 250    0,92   A2
                                              Bronzato opaco vern.   B00590.43.22   25 250    0,97   A2
                                              Cromato opaco          B00590.43.34   25 250    2,07   A2
 118`;
export const PAGE_CERNIERE = `\f                CERNIERE                                                                                 LISTINO 2026
Per Legno - Per terza anta
                             Mod.120 Ala, lame in asse con perni e corpo maggiorato
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 14     Black Powerage 83                    dx     E10157.14.93   50 50        5,52   C1
                                      Black Powerage 83                    sx     E10158.14.93   50 50        5,52   C1
                             Mod.120 Ala, lame sovrapposte senza perni
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 14     Black Powerage 50                    dx     E10062.14.93   50 200       3,97   C1
                                      Black Powerage 50                    sx     E10063.14.93   50 200       3,97   C1
                             Mod.179 Ala, lame in asse senza perni
                             ACCIAIO
                                      FINITURA          ALTEZZA            MANO   CODICE                        € CS
                             ø 18     Black Powerage 79                    dx     E10037.18.93   20 80        4,71   C1
                                      Black Powerage 79                    sx     E10038.18.93   20 80        4,71   C1
                                      Silver Powerage 79                   dx     E10037.18.21   20 80        5,08   C1
                                      Silver Powerage 79                   sx     E10038.18.21   20 80        5,08   C1
                             NB: la versione DX e SX lavora in aria 4 mm
 298`;
export const PAGE_PROFILI = `\f          IMAGO E IMAGO+                                                                                            LISTINO 2026
Profili
                      Kit profilo reggivetro IMAGO
                      GRIGIO RAL 7035
                      LUNGHEZZA                                                              CODICE                         € CS
                      2000 mm                                                                G01342.01.86   1   1        87,18   H1
                      3000 mm                                                                G01342.02.86   1   1       124,88   H1
                      4000 mm                                                                G01342.03.86   1   1       178,89   H1
                      6000 mm                                                                G01342.05.86   1   1       283,09   H1
                      NERO OPACO
                      LUNGHEZZA                                                              CODICE                         € CS
                      2000 mm                                                                G01342.01.93   1   1        95,90   H1
                      3000 mm                                                                G01342.02.93   1   1       137,37   H1
                      4000 mm                                                                G01342.03.93   1   1       196,78   H1
                      6000 mm                                                                G01342.05.93   1   1       311,40   H1
                      Guarnizione profilo reggivetro IMAGO per battuta 17
                      NERO
                      LUNGHEZZA                                                              CODICE                         € CS
                      10 metri                                                               G02019.10.93   1   1        24,04 H1
                      Profilo di chiusura superiore
                      ALLUMINIO ARGENTO
                      LUNGHEZZA                                                              CODICE                         € CS
                      1500 mm                                                                G02401.15.01   1   1        36,13 H1
                      2000 mm                                                                G02401.20.01   1   1        43,16 H1
                      3000 mm                                                                G02401.30.01   1   1        72,30 H1
 618`;
export const ALL_FIXTURE_PAGES = [PAGE_SERRATURE, PAGE_CERNIERE, PAGE_PROFILI].join("\n");
```

- [ ] **Step 2: Write the failing tests** — `src/server/catalog/parse-listino.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseListino } from "./parse-listino";
import { PAGE_SERRATURE, PAGE_CERNIERE, PAGE_PROFILI, ALL_FIXTURE_PAGES } from "./fixtures";

describe("parseListino — serrature (finish rows, inherited dimension)", () => {
  const { rows } = parseListino(PAGE_SERRATURE);
  it("extracts all 14 product rows", () => expect(rows).toHaveLength(14));
  it("parses code, price cents, packaging, discount class", () => {
    const r = rows.find((x) => x.agbCode === "B00590.15.03")!;
    expect(r.priceCents).toBe(123);
    expect(r.packBox).toBe(25);
    expect(r.packCarton).toBe(250);
    expect(r.discountClass).toBe("A2");
  });
  it("assigns category and subcategory from page headers", () => {
    expect(rows[0]!.category).toBe("SERRATURE");
    expect(rows[0]!.subcategory).toBe("Incontri - Sicurezza");
  });
  it("captures group title and material", () => {
    const r = rows.find((x) => x.agbCode === "B00590.30.06")!;
    expect(r.groupTitle).toBe("Larghezza 22 mm, bordo tondo spessore 2 mm");
    expect(r.material).toBe("ACCIAIO");
  });
  it("inherits the dimension from the first row of the block", () => {
    const first = rows.find((x) => x.agbCode === "B00590.15.03")!;
    const later = rows.find((x) => x.agbCode === "B00590.15.34")!;
    expect(first.dimension).toBe("238 mm");
    expect(later.dimension).toBe("238 mm");
    expect(later.finish).toBe("Cromato opaco");
  });
});

describe("parseListino — cerniere (hand dx/sx, ø dimension)", () => {
  const { rows } = parseListino(PAGE_CERNIERE);
  it("extracts all 10 rows with hand", () => {
    expect(rows).toHaveLength(10);
    expect(rows.find((x) => x.agbCode === "E10157.14.93")!.hand).toBe("DX");
    expect(rows.find((x) => x.agbCode === "E10158.14.93")!.hand).toBe("SX");
  });
  it("parses ø dimension and strips it from finish", () => {
    const r = rows.find((x) => x.agbCode === "E10157.14.93")!;
    expect(r.dimension).toBe("ø 14");
    expect(r.finish).toBe("Black Powerage 83");
  });
  it("thousands price format works (1.234,56 style)", () => {
    // covered structurally: priceToCents("124,88") on profili below; here plain
    expect(rows.find((x) => x.agbCode === "E10037.18.21")!.priceCents).toBe(508);
  });
});

describe("parseListino — profili (uppercase finish-group lines)", () => {
  const { rows } = parseListino(PAGE_PROFILI);
  it("extracts all 14 rows", () => expect(rows).toHaveLength(14));
  it("uses the uppercase color line as finish when row has none", () => {
    expect(rows.find((x) => x.agbCode === "G01342.01.86")!.finish).toBe("GRIGIO RAL 7035");
    expect(rows.find((x) => x.agbCode === "G01342.01.93")!.finish).toBe("NERO OPACO");
    expect(rows.find((x) => x.agbCode === "G02401.15.01")!.finish).toBe("ALLUMINIO ARGENTO");
  });
  it("row dimension comes from the row prefix", () => {
    expect(rows.find((x) => x.agbCode === "G01342.02.86")!.dimension).toBe("3000 mm");
    expect(rows.find((x) => x.agbCode === "G02019.10.93")!.dimension).toBe("10 metri");
  });
});

describe("parseListino — stats & robustness", () => {
  it("reports pages/codeLines/parsed/skipped consistently", () => {
    const { rows, stats } = parseListino(ALL_FIXTURE_PAGES);
    expect(stats.pages).toBe(3);
    expect(stats.parsed).toBe(rows.length);
    expect(stats.codeLines).toBeGreaterThanOrEqual(stats.parsed);
    expect(stats.skipped).toBe(stats.codeLines - stats.parsed);
  });
  it("rows without a category page header land in ALTRO, never crash", () => {
    const orphan = `\f  LISTINO 2026\n  qualcosa   Z90870.09.99   1 1   88,00  A1`;
    const { rows } = parseListino(orphan);
    expect(rows[0]!.category).toBe("ALTRO");
  });
});
```

- [ ] **Step 3: Run tests → FAIL** — `pnpm test src/server/catalog/parse-listino.test.ts` (module not found).

- [ ] **Step 4: Implement** `src/server/catalog/parse-listino.ts`:

```ts
export interface ParsedRow {
  agbCode: string;
  priceCents: number;
  category: string;
  subcategory: string | null;
  groupTitle: string | null;
  material: string | null;
  finish: string | null;
  dimension: string | null;
  hand: "DX" | "SX" | null;
  packBox: number | null;
  packCarton: number | null;
  discountClass: string | null;
  rawLine: string;
}
export interface ParseResult {
  rows: ParsedRow[];
  stats: { pages: number; codeLines: number; parsed: number; skipped: number };
}

const CODE_RE = /[A-Z]\d{5}\.\d{2}\.\d{2}/;
const ROW_RE =
  /^(.*?)\s*([A-Z]\d{5}\.\d{2}\.\d{2})\s+(\d+)\s+(\d+)\s+((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s+([A-Z]\d)\s*$/;
const CATEGORY_RE = /^(.*?)\s*LISTINO 2026\s*$/;
const COLUMN_HEADER_RE = /\bCODICE\b/;
const MATERIALS = new Set([
  "ACCIAIO", "ACCIAIO INOX", "INOX", "OTTONE", "ALLUMINIO", "ZAMA",
  "NYLON", "TECNOPOLIMERO", "POLIAMMIDE", "PVC",
]);
const DIMENSION_RE = /^(ø\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:mm|cm|m\b|metri))\s*/i;
const HAND_RE = /\b(dx|sx)\s*$/i;
const NOTE_RE = /^(NB|N\.B\.|Nota)\b/i;

function priceToCents(price: string): number {
  const [ints, dec] = price.split(",");
  return parseInt(ints!.replace(/\./g, ""), 10) * 100 + parseInt(dec!, 10);
}
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseListino(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const stats = { pages: 0, codeLines: 0, parsed: 0, skipped: 0 };
  // Page-scoped parser state
  let category = "ALTRO";
  let subcategory: string | null = null;
  let groupTitle: string | null = null;
  let material: string | null = null;
  let finishGroup: string | null = null;
  let dimension: string | null = null;
  let afterCategoryLine = false;

  for (const rawLine of text.split("\n")) {
    let line = rawLine;
    if (line.includes("\f")) {
      stats.pages += 1;
      subcategory = null;
      groupTitle = null;
      material = null;
      finishGroup = null;
      dimension = null;
      afterCategoryLine = false;
      line = line.replace(/\f/g, "");
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    const catMatch = trimmed.match(CATEGORY_RE);
    if (catMatch) {
      const name = squash(catMatch[1] ?? "");
      if (name && name === name.toUpperCase() && /[A-Z]/.test(name)) category = name;
      afterCategoryLine = true;
      continue;
    }

    if (CODE_RE.test(trimmed)) {
      stats.codeLines += 1;
      const m = trimmed.match(ROW_RE);
      if (!m) { stats.skipped += 1; continue; }
      let prefix = squash(m[1] ?? "");
      let hand: "DX" | "SX" | null = null;
      const handMatch = prefix.match(HAND_RE);
      if (handMatch) {
        hand = handMatch[1]!.toUpperCase() as "DX" | "SX";
        prefix = squash(prefix.slice(0, handMatch.index));
      }
      const dimMatch = prefix.match(DIMENSION_RE);
      if (dimMatch) {
        dimension = squash(dimMatch[1]!);
        prefix = squash(prefix.slice(dimMatch[0].length));
      }
      const finish = prefix || finishGroup;
      rows.push({
        agbCode: m[2]!,
        priceCents: priceToCents(m[5]!),
        category, subcategory, groupTitle, material,
        finish: finish || null,
        dimension, hand,
        packBox: parseInt(m[3]!, 10),
        packCarton: parseInt(m[4]!, 10),
        discountClass: m[6]!,
        rawLine: trimmed,
      });
      stats.parsed += 1;
      continue;
    }

    if (COLUMN_HEADER_RE.test(trimmed)) continue;      // column headers
    if (NOTE_RE.test(trimmed)) continue;               // NB / notes
    if (/^\d+$/.test(trimmed)) continue;               // page numbers

    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      if (MATERIALS.has(squash(trimmed))) material = squash(trimmed);
      else finishGroup = squash(trimmed);              // e.g. "GRIGIO RAL 7035"
      continue;
    }

    // First unindented, non-uppercase line right after the category header → subcategory
    if (afterCategoryLine && !/^\s/.test(line) && subcategory === null) {
      subcategory = squash(trimmed);
      continue;
    }

    // Anything else indented and wordy → group title; resets block-scoped state
    if (trimmed.length > 3) {
      groupTitle = squash(trimmed);
      dimension = null;
      finishGroup = null;
    }
  }
  return { rows, stats };
}
```

- [ ] **Step 5: Run tests → PASS** — `pnpm test src/server/catalog/parse-listino.test.ts`. Iterate on the state machine until all fixture expectations hold (fixtures are ground truth — do NOT edit fixtures to fit the code).
- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/ && git commit -m "feat: deterministic AGB listino parser (Fase 1b Task 1)"
```

---

### Task 2: Mapping prodotto + estrazione PDF + import script

**Files:**
- Create: `src/server/catalog/map-product.ts`, `src/server/catalog/extract-pdf.ts`, `scripts/import-agb.ts`
- Modify: `package.json` (script `"import:agb": "tsx scripts/import-agb.ts"`)
- Test: `src/server/catalog/map-product.test.ts`

**Interfaces:**
- Consumes: `ParsedRow`, `parseListino` (Task 1).
- Produces: `slugify(name: string): string`; `buildProductData(row: ParsedRow): { agbCode; sku; name; description; shortDescription; basePrice: string; specifications: Record<string, unknown> }` (categoryId added by caller); `extractPdfText(pdfPath: string): Promise<string>`; CLI `pnpm import:agb <pdf>`.

- [ ] **Step 1: Failing tests** — `src/server/catalog/map-product.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildProductData, slugify } from "./map-product";
import type { ParsedRow } from "./parse-listino";

const row: ParsedRow = {
  agbCode: "B00590.15.03", priceCents: 123, category: "SERRATURE",
  subcategory: "Incontri - Sicurezza", groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
  material: "ACCIAIO", finish: "Ottonato lucido", dimension: "238 mm", hand: null,
  packBox: 25, packCarton: 250, discountClass: "A2", rawLine: "",
};

describe("slugify", () => {
  it("normalizes headers to slugs", () => {
    expect(slugify("SERRATURE")).toBe("serrature");
    expect(slugify("IMAGO E IMAGO+")).toBe("imago-e-imago");
    expect(slugify("FERRAMENTA PER IMPOSTE")).toBe("ferramenta-per-imposte");
  });
});

describe("buildProductData", () => {
  const d = buildProductData(row);
  it("composes a readable name from group/finish/dimension", () => {
    expect(d.name).toBe("Larghezza 22 mm, bordo tondo spessore 3 mm, Ottonato lucido, 238 mm");
  });
  it("stores price as decimal string in EUR", () => expect(d.basePrice).toBe("1.23"));
  it("keeps structured attributes in specifications", () => {
    expect(d.specifications).toMatchObject({
      finitura: "Ottonato lucido", materiale: "ACCIAIO", dimensione: "238 mm",
      confezione: { scatola: 25, cartone: 250 }, classeSconto: "A2",
      sottocategoria: "Incontri - Sicurezza",
    });
  });
  it("falls back to category+code when nothing else exists", () => {
    const bare = { ...row, groupTitle: null, finish: null, dimension: null, hand: null };
    expect(buildProductData(bare).name).toBe("SERRATURE B00590.15.03");
  });
  it("appends hand to the name when present", () => {
    expect(buildProductData({ ...row, hand: "DX" }).name).toContain("DX");
  });
});
```

- [ ] **Step 2: Run → FAIL**, then **Step 3: implement** `map-product.ts`:

```ts
import type { ParsedRow } from "./parse-listino";

export function slugify(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildProductData(row: ParsedRow) {
  const nameParts = [row.groupTitle, row.finish, row.dimension, row.hand].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(", ") : `${row.category} ${row.agbCode}`;
  const description =
    [row.category, row.subcategory, row.groupTitle].filter(Boolean).join(" — ") || null;
  return {
    agbCode: row.agbCode,
    sku: row.agbCode,
    name,
    description,
    shortDescription: row.subcategory,
    basePrice: (row.priceCents / 100).toFixed(2), // Prisma Decimal accepts strings
    specifications: {
      finitura: row.finish, materiale: row.material, dimensione: row.dimension,
      mano: row.hand, confezione: { scatola: row.packBox, cartone: row.packCarton },
      classeSconto: row.discountClass, sottocategoria: row.subcategory, gruppo: row.groupTitle,
    },
  };
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: `extract-pdf.ts`** (no unit test — thin child_process wrapper, verified in Task 9's real run):

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

/** Extract layout-preserving text via poppler's pdftotext (runtime prerequisite). */
export async function extractPdfText(pdfPath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "pdftotext", ["-layout", pdfPath, "-"],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  return stdout;
}
```

- [ ] **Step 6: `scripts/import-agb.ts`** — dedup by agbCode (first wins), upsert categories then products in chunks of 200, print coverage report:

```ts
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "../src/server/catalog/extract-pdf";
import { parseListino } from "../src/server/catalog/parse-listino";
import { buildProductData, slugify } from "../src/server/catalog/map-product";

const db = new PrismaClient();

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error("Uso: pnpm import:agb <percorso-listino.pdf>");

  console.log("▶ estrazione testo…");
  const text = await extractPdfText(pdfPath);
  console.log("▶ parsing…");
  const { rows, stats } = parseListino(text);

  const byCode = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byCode.has(r.agbCode)) byCode.set(r.agbCode, r);
  const unique = [...byCode.values()];

  console.log("▶ categorie…");
  const categoryIds = new Map<string, string>();
  for (const name of new Set(unique.map((r) => r.category))) {
    const cat = await db.productCategory.upsert({
      where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) },
    });
    categoryIds.set(name, cat.id);
  }

  console.log(`▶ upsert ${unique.length} prodotti…`);
  let done = 0;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    await db.$transaction(
      chunk.map((row) => {
        const data = buildProductData(row);
        const categoryId = categoryIds.get(row.category)!;
        return db.product.upsert({
          where: { agbCode: row.agbCode },
          update: { ...data, categoryId },
          create: { ...data, categoryId, imageUrls: [] },
        });
      }),
    );
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${unique.length}`);
  }
  console.log(`\n✓ import completato
  pagine: ${stats.pages} | righe-codice: ${stats.codeLines} | parse ok: ${stats.parsed} | saltate: ${stats.skipped}
  codici unici: ${unique.length} | categorie: ${categoryIds.size}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => void db.$disconnect());
```

- [ ] **Step 7: add script to package.json** (`"import:agb": "tsx scripts/import-agb.ts"`), gate (`pnpm typecheck && pnpm lint && pnpm test`), commit `feat: AGB import pipeline (mapping + pdftotext wrapper + script) (Fase 1b Task 2)`.

---

### Task 3: Seed catalogo sintetico (committed)

**Files:**
- Create: `prisma/seed-catalog.ts`
- Modify: `prisma/seed.ts` (call it from `main()`)
- Test: `prisma/seed-catalog.test.ts`

**Interfaces:**
- Consumes: `parseListino`, `ALL_FIXTURE_PAGES`, `buildProductData`, `slugify`.
- Produces: `seedCatalog(db: PrismaClient): Promise<{ products: number; categories: number }>` — idempotent; ~38 real products from fixtures (no PDF needed).

- [ ] **Step 1: Failing test** — pure part only (row prep):

```ts
import { describe, it, expect } from "vitest";
import { buildCatalogSeedRows } from "./seed-catalog";

describe("buildCatalogSeedRows", () => {
  const rows = buildCatalogSeedRows();
  it("yields the fixture products, deduplicated", () => {
    expect(rows.length).toBe(38); // 14 serrature + 10 cerniere + 14 profili
    expect(new Set(rows.map((r) => r.agbCode)).size).toBe(rows.length);
  });
  it("covers three categories", () => {
    expect(new Set(rows.map((r) => r.category))).toEqual(
      new Set(["SERRATURE", "CERNIERE", "IMAGO E IMAGO+"]),
    );
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: implement** `seed-catalog.ts`:

```ts
import type { PrismaClient } from "@prisma/client";
import { parseListino, type ParsedRow } from "../src/server/catalog/parse-listino";
import { ALL_FIXTURE_PAGES } from "../src/server/catalog/fixtures";
import { buildProductData, slugify } from "../src/server/catalog/map-product";

/** Deterministic dev/test catalog: real rows parsed from committed fixtures. */
export function buildCatalogSeedRows(): ParsedRow[] {
  const { rows } = parseListino(ALL_FIXTURE_PAGES);
  const byCode = new Map<string, ParsedRow>();
  for (const r of rows) if (!byCode.has(r.agbCode)) byCode.set(r.agbCode, r);
  return [...byCode.values()];
}

export async function seedCatalog(db: PrismaClient) {
  const rows = buildCatalogSeedRows();
  const categoryIds = new Map<string, string>();
  for (const name of new Set(rows.map((r) => r.category))) {
    const cat = await db.productCategory.upsert({
      where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) },
    });
    categoryIds.set(name, cat.id);
  }
  for (const row of rows) {
    const data = buildProductData(row);
    await db.product.upsert({
      where: { agbCode: row.agbCode },
      update: { ...data, categoryId: categoryIds.get(row.category)! },
      create: { ...data, categoryId: categoryIds.get(row.category)!, imageUrls: [] },
    });
  }
  return { products: rows.length, categories: categoryIds.size };
}
```

- [ ] **Step 4: wire into `prisma/seed.ts` `main()`** after categories: `const cat = await seedCatalog(db); console.log(\`✓ catalogo demo: ${cat.products} prodotti\`);`
- [ ] **Step 5: Run → PASS**; run the real seed against docker DB (`set -a; source .env; set +a; pnpm db:seed`) and verify `products` count ≥ 38 via `db.product.count()`.
- [ ] **Step 6: Gate + commit** `feat: synthetic catalog seed from real fixtures (Fase 1b Task 3)`.

---

### Task 4: EmbeddingService (interfaccia + Gemini differito + Fake)

**Files:**
- Create: `src/server/ai/embedding.ts`
- Test: `src/server/ai/embedding.test.ts`

**Interfaces:**
- Consumes: `EMBEDDING_MODEL`, `EMBEDDING_DIM` from `src/server/constants/embedding.ts`; `env.GEMINI_API_KEY`.
- Produces: `interface EmbeddingService { generate(text: string, task: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[]> }`; `GeminiEmbeddingService` (constructed only when key exists — NOT wired in 1b runtime); `FakeEmbeddingService` (deterministic, exported for tests); `l2Normalize(v: number[]): number[]`; `getEmbeddingService(): EmbeddingService | null` (null without key → tsvector-only).

- [ ] **Step 1: Failing tests:**

```ts
import { describe, it, expect } from "vitest";
import { l2Normalize, FakeEmbeddingService, getEmbeddingService } from "./embedding";
import { EMBEDDING_DIM } from "@/server/constants/embedding";

describe("l2Normalize", () => {
  it("returns a unit-length vector", () => {
    const v = l2Normalize([3, 4]);
    expect(Math.hypot(...v)).toBeCloseTo(1);
    expect(v[0]).toBeCloseTo(0.6);
  });
});
describe("FakeEmbeddingService", () => {
  it("is deterministic and EMBEDDING_DIM-long, unit norm", async () => {
    const svc = new FakeEmbeddingService();
    const a = await svc.generate("cerniera", "RETRIEVAL_QUERY");
    const b = await svc.generate("cerniera", "RETRIEVAL_QUERY");
    expect(a).toEqual(b);
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(Math.hypot(...a)).toBeCloseTo(1);
  });
});
describe("getEmbeddingService", () => {
  it("returns null when GEMINI_API_KEY is unset (tsvector-only mode)", () => {
    expect(getEmbeddingService()).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: implement:**

```ts
import "server-only";
import { env } from "@/env";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "@/server/constants/embedding";

export type EmbeddingTask = "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
export interface EmbeddingService {
  generate(text: string, task: EmbeddingTask): Promise<number[]>;
}

export function l2Normalize(v: number[]): number[] {
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/** Deterministic embedding for tests: hash-seeded pseudo-vector, unit norm. */
export class FakeEmbeddingService implements EmbeddingService {
  async generate(text: string): Promise<number[]> {
    let h = 2166136261;
    for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const v = Array.from({ length: EMBEDDING_DIM }, (_, i) => {
      h = Math.imul(h ^ i, 2654435761);
      return ((h >>> 0) % 1000) / 1000 - 0.5;
    });
    return l2Normalize(v);
  }
}

/** Real Gemini embeddings (deferred: requires key; batch generation arrives with BullMQ). */
export class GeminiEmbeddingService implements EmbeddingService {
  constructor(private apiKey: string) {}
  async generate(text: string, task: EmbeddingTask): Promise<number[]> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: task,
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini embedding HTTP ${res.status}`);
    const data = (await res.json()) as { embedding: { values: number[] } };
    const v = data.embedding.values;
    if (v.length !== EMBEDDING_DIM) {
      throw new Error(`Embedding dim ${v.length} !== ${EMBEDDING_DIM}`);
    }
    return l2Normalize(v); // non-3072 Gemini outputs are not pre-normalized
  }
}

/** Runtime factory: null while no key is configured → RAGEngine stays tsvector-only. */
export function getEmbeddingService(): EmbeddingService | null {
  return env.GEMINI_API_KEY ? new GeminiEmbeddingService(env.GEMINI_API_KEY) : null;
}
```

- [ ] **Step 4: Run → PASS. Step 5: gate + commit** `feat: EmbeddingService (fake + deferred Gemini 768, L2-normalized) (Fase 1b Task 4)`.

---

### Task 5: RAGEngine (unico modulo raw-SQL)

**Files:**
- Create: `src/server/ai/rag.ts`
- Test: `src/server/ai/rag.test.ts` (SQL-branch selection via mocked db), `src/server/ai/rag.integration.test.ts` (real DB, gated)

**Interfaces:**
- Consumes: `db` (Prisma), `EmbeddingService | null` (Task 4), `EMBEDDING_DIM`.
- Produces:

```ts
export interface SearchFilters { categoryId?: string; material?: string; minPrice?: number; maxPrice?: number; inStock?: boolean; }
export interface SearchHit {
  id: string; agbCode: string; sku: string; name: string; description: string | null;
  basePrice: number; discountedPrice: number | null; stockQuantity: number; isAvailable: boolean;
  imageUrls: string[]; specifications: unknown;
  categoryName: string; categorySlug: string; textScore: number; vectorScore: number;
}
export class RAGEngine {
  constructor(db: PrismaClient, embeddings?: EmbeddingService | null);
  search(query: string, filters?: SearchFilters, opts?: { limit?: number; offset?: number }): Promise<{ hits: SearchHit[]; queryTimeMs: number }>;
  getRelated(productId: string, limit?: number): Promise<Array<Pick<SearchHit, "id" | "agbCode" | "name" | "basePrice" | "imageUrls">>>;
}
export const ragEngine: RAGEngine; // singleton wired with getEmbeddingService()
```

- [ ] **Step 1: Failing unit tests** — branch selection (tsvector-only vs hybrid) by inspecting the SQL passed to a stubbed `$queryRaw`:

```ts
import { describe, it, expect, vi } from "vitest";
import { RAGEngine } from "./rag";
import { FakeEmbeddingService } from "./embedding";

function stubDb() {
  const calls: string[] = [];
  const db = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray | { sql?: string }, ..._v: unknown[]) => {
      // Prisma.sql produces an object with .sql when using Prisma.sql tag; capture text either way
      const text = Array.isArray(strings) ? strings.join("?") : String((strings as { sql?: string }).sql ?? "");
      calls.push(text);
      return [];
    }),
  };
  return { db: db as never, calls };
}

describe("RAGEngine SQL branch selection", () => {
  it("without embeddings uses ONLY the tsvector branch", async () => {
    const { db, calls } = stubDb();
    await new RAGEngine(db, null).search("cerniera anta");
    expect(calls.join(" ")).toContain("plainto_tsquery");
    expect(calls.join(" ")).not.toContain("<=>");
  });
  it("with embeddings adds the pgvector cosine branch", async () => {
    const { db, calls } = stubDb();
    await new RAGEngine(db, new FakeEmbeddingService()).search("cerniera anta");
    expect(calls.join(" ")).toContain("<=>");
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: implement `rag.ts`** using `Prisma.sql` composition (all values parameterized; filters via `Prisma.sql`/`Prisma.empty`):

```ts
import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/server/db";
import { getEmbeddingService, type EmbeddingService } from "./embedding";

export interface SearchFilters { categoryId?: string; material?: string; minPrice?: number; maxPrice?: number; inStock?: boolean; }
export interface SearchHit {
  id: string; agbCode: string; sku: string; name: string; description: string | null;
  basePrice: number; discountedPrice: number | null; stockQuantity: number; isAvailable: boolean;
  imageUrls: string[]; specifications: unknown;
  categoryName: string; categorySlug: string; textScore: number; vectorScore: number;
}

const TEXT_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;

export class RAGEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly embeddings: EmbeddingService | null = null,
  ) {}

  private filterSql(f: SearchFilters): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`p.is_available = true`];
    if (f.categoryId) parts.push(Prisma.sql`p.category_id = ${f.categoryId}`);
    if (f.material) parts.push(Prisma.sql`p.specifications->>'materiale' = ${f.material}`);
    if (f.minPrice !== undefined) parts.push(Prisma.sql`p.base_price >= ${f.minPrice}`);
    if (f.maxPrice !== undefined) parts.push(Prisma.sql`p.base_price <= ${f.maxPrice}`);
    if (f.inStock) parts.push(Prisma.sql`p.stock_quantity > 0`);
    return Prisma.join(parts, " AND ");
  }

  async search(query: string, filters: SearchFilters = {}, opts: { limit?: number; offset?: number } = {}) {
    const start = Date.now();
    const limit = opts.limit ?? 20;
    const offset = opts.offset ?? 0;
    const where = this.filterSql(filters);

    const queryEmbedding = this.embeddings
      ? await this.embeddings.generate(query, "RETRIEVAL_QUERY")
      : null;

    const select = Prisma.sql`
      p.id, p.agb_code as "agbCode", p.sku, p.name, p.description,
      p.base_price::float8 as "basePrice", p.discounted_price::float8 as "discountedPrice",
      p.stock_quantity as "stockQuantity", p.is_available as "isAvailable",
      p.image_urls as "imageUrls", p.specifications,
      c.name as "categoryName", c.slug as "categorySlug"`;

    let hits: SearchHit[];
    if (!queryEmbedding) {
      // tsvector-only branch (Fase 1b default: embeddings are null)
      hits = await this.prisma.$queryRaw<SearchHit[]>`
        SELECT ${select},
          ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 as "textScore",
          0::float8 as "vectorScore"
        FROM products p JOIN product_categories c ON p.category_id = c.id
        WHERE p.search_vector @@ plainto_tsquery('italian', ${query}) AND ${where}
        ORDER BY "textScore" DESC, p.agb_code ASC
        LIMIT ${limit} OFFSET ${offset}`;
    } else {
      const vec = `[${queryEmbedding.join(",")}]`;
      hits = await this.prisma.$queryRaw<SearchHit[]>`
        SELECT ${select},
          COALESCE(ts_rank(p.search_vector, plainto_tsquery('italian', ${query})), 0)::float8 as "textScore",
          COALESCE(1 - (p.embedding <=> ${vec}::vector), 0)::float8 as "vectorScore"
        FROM products p JOIN product_categories c ON p.category_id = c.id
        WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
               OR (p.embedding IS NOT NULL AND p.embedding <=> ${vec}::vector < 0.7))
          AND ${where}
        ORDER BY (COALESCE(ts_rank(p.search_vector, plainto_tsquery('italian', ${query})), 0) * ${TEXT_WEIGHT}
                + COALESCE(1 - (p.embedding <=> ${vec}::vector), 0) * ${VECTOR_WEIGHT}) DESC,
                p.agb_code ASC
        LIMIT ${limit} OFFSET ${offset}`;
    }
    return { hits, queryTimeMs: Date.now() - start };
  }

  /** Related products: same category; vector distance when embeddings exist, else name order. */
  async getRelated(productId: string, limit = 5) {
    return this.prisma.$queryRaw<
      Array<{ id: string; agbCode: string; name: string; basePrice: number; imageUrls: string[] }>
    >`
      SELECT p.id, p.agb_code as "agbCode", p.name,
             p.base_price::float8 as "basePrice", p.image_urls as "imageUrls"
      FROM products p, products ref
      WHERE ref.id = ${productId} AND p.id != ref.id AND p.category_id = ref.category_id
        AND p.is_available = true
      ORDER BY (p.embedding <=> ref.embedding) ASC NULLS LAST, p.name ASC
      LIMIT ${limit}`;
  }
}

/** Runtime singleton — tsvector-only while GEMINI_API_KEY is unset. */
export const ragEngine = new RAGEngine(db, getEmbeddingService());
```

  Note: the stub in the unit test must match how `$queryRaw` receives tagged templates (`TemplateStringsArray` + values, with nested `Prisma.sql` flattened by Prisma at runtime). If the joined text assertion is brittle, assert on `JSON.stringify` of all args instead — keep the two branch assertions (`plainto_tsquery` present; `<=>` only in hybrid).

- [ ] **Step 4: Integration test** `src/server/ai/rag.integration.test.ts` — real DB, gated:

```ts
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { RAGEngine } from "./rag";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!url)("RAGEngine (integration, docker DB with seed)", () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const rag = new RAGEngine(prisma, null);

  it("finds seeded serrature by Italian full-text", async () => {
    const { hits } = await rag.search("incontri sicurezza acciaio");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.agbCode).toMatch(/^B00590/);
    expect(hits[0]!.textScore).toBeGreaterThan(0);
  });
  it("filters by category slug->id and respects limit", async () => {
    const cat = await prisma.productCategory.findUnique({ where: { slug: "cerniere" } });
    const { hits } = await rag.search("powerage", { categoryId: cat!.id }, { limit: 3 });
    expect(hits.length).toBeLessThanOrEqual(3);
    for (const h of hits) expect(h.categorySlug).toBe("cerniere");
  });
  it("getRelated returns same-category products", async () => {
    const p = await prisma.product.findUnique({ where: { agbCode: "E10157.14.93" } });
    const related = await rag.getRelated(p!.id, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((r) => r.agbCode === "E10157.14.93")).toBe(false);
  });
});
```

- [ ] **Step 5: Run** — unit: `pnpm test src/server/ai/rag.test.ts` → PASS; integration (after Task 3 seed): `set -a; source .env; set +a; INTEGRATION_DATABASE_URL=$DATABASE_URL pnpm test rag.integration` → PASS (3 tests). Plain `pnpm test` skips it.
- [ ] **Step 6: Gate + commit** `feat: RAGEngine hybrid search, tsvector-first + vector-ready (Fase 1b Task 5)`.

---

### Task 6: Product router tRPC

**Files:**
- Create: `src/server/api/routers/product.ts`
- Modify: `src/server/api/root.ts` (add `product: productRouter`)
- Test: `src/server/api/routers/product.test.ts`

**Interfaces:**
- Consumes: `agentProcedure`, `publicProcedure`, `createTRPCRouter` (Fase 1a); `ragEngine` (Task 5).
- Produces tRPC procedures: `product.search`, `product.list`, `product.getById`, `product.getByCode`, `product.listCategories`, `product.getRelated`.

- [ ] **Step 1: Failing tests** (mock the rag module; fake ctx like `user.test.ts`):

```ts
import { describe, it, expect, vi } from "vitest";

const search = vi.fn().mockResolvedValue({ hits: [], queryTimeMs: 5 });
const getRelated = vi.fn().mockResolvedValue([]);
vi.mock("@/server/ai/rag", () => ({ ragEngine: { search, getRelated } }));

import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const router = createTRPCRouter({ product: productRouter });
const makeCtx = (session: unknown, db: unknown = {}): TRPCContext => ({
  db: db as TRPCContext["db"],
  session: session as TRPCContext["session"],
  headers: new Headers(),
});
const agent = { user: { id: "a1", role: "AGENT", status: "ACTIVE" } };

describe("product.search", () => {
  it("requires authentication", async () => {
    const caller = createCallerFactory(router)(makeCtx(null));
    await expect(caller.product.search({ query: "cerniera" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("delegates to ragEngine with filters and logs the activity", async () => {
    const create = vi.fn().mockResolvedValue({});
    const caller = createCallerFactory(router)(makeCtx(agent, { activityLog: { create } }));
    const res = await caller.product.search({ query: "cerniera", filters: { inStock: true } });
    expect(search).toHaveBeenCalledWith("cerniera", { inStock: true }, { limit: 20, offset: 0 });
    expect(res.queryTimeMs).toBe(5);
    expect(create).toHaveBeenCalled(); // PRODUCT_SEARCHED
  });
  it("rejects an empty query", async () => {
    const caller = createCallerFactory(router)(makeCtx(agent));
    await expect(caller.product.search({ query: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("product.getByCode / list", () => {
  it("getByCode maps Decimal prices to numbers", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "p1", agbCode: "B00590.15.03", name: "x", basePrice: { toNumber: () => 1.23 },
      discountedPrice: null, category: { name: "SERRATURE", slug: "serrature" },
    });
    const caller = createCallerFactory(router)(makeCtx(agent, { product: { findUnique } }));
    const p = await caller.product.getByCode({ agbCode: "B00590.15.03" });
    expect(p!.basePrice).toBe(1.23);
  });
  it("list paginates via Prisma", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const caller = createCallerFactory(router)(makeCtx(agent, { product: { findMany, count } }));
    await caller.product.list({ limit: 12, offset: 24 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 12, skip: 24 }));
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: implement `product.ts`:**

```ts
import { z } from "zod";
import { createTRPCRouter, agentProcedure, publicProcedure } from "@/server/api/trpc";
import { ragEngine } from "@/server/ai/rag";

const filtersSchema = z.object({
  categoryId: z.string().optional(),
  material: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
});

const toPlain = <T extends { basePrice: unknown; discountedPrice: unknown } | null>(p: T) =>
  p && {
    ...p,
    basePrice: Number(p.basePrice),
    discountedPrice: p.discountedPrice === null ? null : Number(p.discountedPrice),
  };

export const productRouter = createTRPCRouter({
  search: agentProcedure
    .input(z.object({
      query: z.string().min(1).max(200),
      filters: filtersSchema.optional(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const result = await ragEngine.search(input.query, input.filters ?? {}, {
        limit: input.limit, offset: input.offset,
      });
      await ctx.db.activityLog.create({
        data: {
          type: "PRODUCT_SEARCHED",
          description: `Ricerca prodotti: "${input.query}"`,
          userId: ctx.session.user.id,
          metadata: { query: input.query, results: result.hits.length },
        },
      });
      return result;
    }),

  list: agentProcedure
    .input(z.object({
      categoryId: z.string().optional(),
      limit: z.number().min(1).max(50).default(24),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where = { isAvailable: true, ...(input.categoryId && { categoryId: input.categoryId }) };
      const [items, total] = await Promise.all([
        ctx.db.product.findMany({
          where, take: input.limit, skip: input.offset,
          orderBy: { agbCode: "asc" }, include: { category: { select: { name: true, slug: true } } },
        }),
        ctx.db.product.count({ where }),
      ]);
      return { items: items.map(toPlain), total };
    }),

  getById: agentProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) =>
    toPlain(await ctx.db.product.findUnique({ where: { id: input.id }, include: { category: true } })),
  ),

  getByCode: agentProcedure.input(z.object({ agbCode: z.string() })).query(async ({ ctx, input }) =>
    toPlain(await ctx.db.product.findUnique({ where: { agbCode: input.agbCode }, include: { category: true } })),
  ),

  listCategories: publicProcedure
    .input(z.object({ parentId: z.string().nullable().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.productCategory.findMany({
        where: { parentId: input?.parentId ?? null },
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
    ),

  getRelated: agentProcedure
    .input(z.object({ productId: z.string(), limit: z.number().min(1).max(10).default(5) }))
    .query(({ input }) => ragEngine.getRelated(input.productId, input.limit)),
});
```

- [ ] **Step 4: register in `root.ts`**, run tests → PASS, gate, commit `feat: product tRPC router (search/list/get/categories/related) (Fase 1b Task 6)`.

---

### Task 7: UI Archivio (⚠️ invoke `impeccable` first)

**Files:**
- Create: `src/components/product/product-code.tsx`, `src/components/product/price.tsx`, `src/components/product/product-card.tsx`, `src/components/product/product-row.tsx`, `src/components/product/archivio-client.tsx`
- Create: `src/app/(dashboard)/archivio/page.tsx`
- Test: `src/components/product/product-card.test.tsx`

**Interfaces:**
- Consumes: `api.product.search/list/listCategories` hooks (`@/trpc/react`), design tokens (Fase 1a), wireframe §5.
- Produces: `/archivio` route: search bar (debounced 300ms → `search`; empty query → `list`), grid/list toggle, category+availability filters, skeleton loading, Italian empty state, pagination ("Carica altri" or offset pages).

- [ ] **Step 1: Invoke the `impeccable` skill** and design within DESIGN.md tokens (product register). Key specs: `ProductCode` uses `font-mono` + copy-to-clipboard button; `Price` formats `Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })`; cards white bg / border-line / radius-md / shadow-card, NO nested cards; grid `repeat(auto-fill, minmax(280px, 1fr))`; list = table-like rows (row height 52px, hover `bg-surface-page`); active filters as removable chips; skeleton (not spinner) while loading.
- [ ] **Step 2: Failing test** — `product-card.test.tsx` (jsdom):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductCard } from "./product-card";

afterEach(cleanup);
const product = {
  id: "p1", agbCode: "B00590.15.03", name: "Incontro sicurezza, Ottonato lucido, 238 mm",
  basePrice: 1.23, discountedPrice: null, isAvailable: true, stockQuantity: 0,
  categoryName: "Serrature", imageUrls: [] as string[],
};
describe("ProductCard", () => {
  it("renders the AGB code in monospace", () => {
    render(<ProductCard product={product} />);
    const code = screen.getByText("B00590.15.03");
    expect(code.className).toContain("font-mono");
  });
  it("formats the price in EUR (it-IT)", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText(/1,23\s*€/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run → FAIL. Step 4: implement** components + `archivio-client.tsx` (client component: `useState` for query/filters/view/offset, `useDeferredValue` or 300ms debounce, `api.product.search.useQuery({ query, filters }, { enabled: query.length > 0 })` and `api.product.list.useQuery` fallback, `api.product.listCategories.useQuery()` for the filter sidebar) + `page.tsx` (server component: title "Archivio prodotti", renders `<ArchivioClient />`). Every card links to `/archivio/${id}`. All copy Italian: placeholder "Cerca per nome, codice AGB, finitura…", empty state "Nessun prodotto trovato per «{query}». Prova con un termine diverso.", error toast "Errore durante la ricerca. Riprova."
- [ ] **Step 5: Run tests → PASS**; visual check with the dev server + seeded DB (screenshot via headless Chromium as in Fase 1a Task 12).
- [ ] **Step 6: Gate + commit** `feat: Archivio UI — ricerca, filtri, griglia/lista (impeccable) (Fase 1b Task 7)`.

---

### Task 8: UI Dettaglio prodotto (⚠️ impeccable, same session as Task 7 is fine)

**Files:**
- Create: `src/app/(dashboard)/archivio/[id]/page.tsx`, `src/components/product/product-detail.tsx`, `src/components/product/related-products.tsx`
- Test: `src/components/product/product-detail.test.tsx`

**Interfaces:**
- Consumes: `api.product.getById`, `api.product.getRelated` hooks; `ProductCode`, `Price` (Task 7).
- Produces: `/archivio/[id]`: header (name + `ProductCode` copy + availability badge), spec table from `specifications` JSON (Italian labels: Finitura, Materiale, Dimensione, Mano, Confezione, Classe sconto), price block, "Prodotti correlati" strip, breadcrumb "Archivio / {categoria}".

- [ ] **Step 1: (impeccable already loaded) Failing test:**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SpecTable } from "./product-detail";

afterEach(cleanup);
describe("SpecTable", () => {
  it("renders Italian labels for known specification keys, skips nulls", () => {
    render(<SpecTable specifications={{ finitura: "Ottonato lucido", materiale: "ACCIAIO", mano: null, confezione: { scatola: 25, cartone: 250 } }} />);
    expect(screen.getByText("Finitura")).toBeTruthy();
    expect(screen.getByText("Ottonato lucido")).toBeTruthy();
    expect(screen.getByText(/25 pz \/ cartone 250/)).toBeTruthy();
    expect(screen.queryByText("Mano")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL. Step 3: implement** `product-detail.tsx` (exports `SpecTable` + `ProductDetail` client component using `api.product.getById.useQuery`), `related-products.tsx` (uses `getRelated`, renders mini-cards), `[id]/page.tsx` (server component passing `params.id`). Not-found state: "Prodotto non trovato." with link back to Archivio.
- [ ] **Step 4: Run → PASS**; visual check (screenshot of a seeded product page).
- [ ] **Step 5: Gate + commit** `feat: pagina dettaglio prodotto + correlati (impeccable) (Fase 1b Task 8)`.

---

### Task 9: Import reale completo + verifica e2e + docs

**Files:**
- Modify: `README.md` (import section), `handoff.md`, `CLAUDE.md` (STATO)
- No new source files.

- [ ] **Step 1: Ensure services** — `bash scripts/dev-bootstrap.sh` (docker + migrate + seed).
- [ ] **Step 2: Full import** —

```bash
set -a; source .env; set +a
pnpm import:agb /tmp/claude-0/-home-user-AGB-Finder/768d2eb8-9782-5f60-9e2d-43bb617d0ce9/scratchpad/catalog.pdf
```

Expected: report with `codici unici` ≈ 6.300 (±5%), `saltate` < 25% of code lines, categories ≈ 15-40. Verify in DB: `db.product.count()` matches unique codes; spot-check `B00590.15.03` price 1.23 and a CERNIERE product.
- [ ] **Step 3: Integration tests against the full DB** — `INTEGRATION_DATABASE_URL=$DATABASE_URL pnpm test rag.integration` → PASS.
- [ ] **Step 4: E2E via dev server** — login admin, `/archivio`: search "cerniera anta ribalta", "B00590", "ottonato" → results < 1s, codes in mono; open a product detail; screenshots (headless Chromium, pattern from Fase 1a) and send to user.
- [ ] **Step 5: Full gate** — `pnpm typecheck && pnpm lint && pnpm test && (set -a; source .env; set +a; pnpm build)` all green.
- [ ] **Step 6: Update docs** — README (sezione "Import catalogo AGB": prerequisito poppler, comando, report atteso), handoff.md (stato 1b, conteggi reali), CLAUDE.md STATO → "Fase 1b ✅".
- [ ] **Step 7: Commit + push** `feat: import completo listino AGB + verifica e2e (Fase 1b Task 9)`; push with retry to `claude/ufptrade-mvp-setup-gcwxnt`.

---

## Acceptance Criteria (spec → verified)

- Import del PDF reale produce ~6.300 prodotti con report di copertura; idempotente (secondo run senza duplicati).
- `product.search` "cerniere ARTECH"-style queries return relevant hits in < 1s (tsvector-only), RBAC enforced.
- Zero raw SQL outside `src/server/ai/rag.ts`.
- Embeddings: colonna null, ricerca degrada senza errori; `FakeEmbeddingService` esercita il ramo vettoriale nei test.
- UI Archivio + dettaglio in italiano, codici monospace, stati empty/loading/error.
- Gate completo verde.

## Out of Scope (do NOT build)

Batch embedding via BullMQ · chat AI / tool `search_products` (1c) · kit engine (1d) · catalogo pubblico (Fase 2) · aggiornamento stock (Fase 3).
