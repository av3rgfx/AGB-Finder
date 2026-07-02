# Fase 1b — Catalogo AGB + Hybrid Search — Piano di implementazione

> **Status: ESEGUITO ✅ (2026-07-02)** — tutti i 14 task completati in TDD, un
> commit per task. Delta rilevanti applicati in corso d'opera: ramo fuzzy
> pg_trgm (stemmer italiano asimmetrico), boost prefisso codice 2.0, prodotti
> unici 6.191 / categorie 22, vista lista default in Archivio. Dettagli in
> `handoff.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importare il listino AGB 2026 (~6.300 prodotti) nel DB, esporre ricerca ibrida (tsvector ora, vector-ready) via tRPC e fornire l'UI Archivio + dettaglio prodotto.

**Architecture:** Parser deterministico puro (state machine su righe `pdftotext -layout`, slicing celle per offset colonna) → mapping → upsert Prisma. Ricerca nel solo modulo `RAGEngine` (unico punto raw SQL, degradazione graceful senza embeddings). Router tRPC `product` con RBAC agent. UI client via `api.product.*`.

**Tech Stack:** Next.js 15 (App Router) · TypeScript strict · tRPC v11 · Prisma 6 + PostgreSQL/pgvector · Tailwind 3 · Vitest · poppler-utils (`pdftotext`).

**Branch:** `claude/superpowers-handoff-next-z1wyh7` · **Spec:** `docs/superpowers/specs/2026-07-01-fase1b-catalogo-hybrid-search-design.md`

## Global Constraints

- TypeScript **strict** (`noUncheckedIndexedAccess: true` — servono guard o `!` sugli indici).
- Tutte le API via **tRPC**; tutte le query via **Prisma**. **Raw SQL solo in `src/server/ai/rag.ts`** (`$queryRaw`) e nelle migrazioni.
- **Nessun LLM nel parser** (deterministico al 100%).
- UI **in italiano**; codici prodotto in **`font-mono`** (JetBrains Mono).
- `EMBEDDING_DIM = 768` (`src/server/constants/embedding.ts`) — unica fonte di verità.
- I moduli `src/server/catalog/*` **NON importano `server-only`** (riusati da `scripts/` e `prisma/` via tsx); `src/server/ai/*` sì.
- Il PDF listino **non si committa** (39 MB, vive in scratchpad). Se manca: **chiedere il link all'utente** (regola CLAUDE.md §FILE ESTERNI), mai cercarlo sul web.
- Gates per ogni task: `pnpm typecheck` · `pnpm lint` · `pnpm test`. Un commit per task.
- Comandi prisma/tsx: prima `set -a; source .env; set +a` (engine Prisma custom).

## Numeri attesi (misurati sul PDF reale, 2026-07-02)

| Metrica | Valore |
|---|---|
| Pagine PDF | 959 |
| Righe testo estratto | 41.092 |
| Righe con token codice | 8.491 |
| Righe con firma rigida (→ `parsed`) | **8.217** |
| Righe codice senza firma (→ `skipped`) | **274** |
| Codici AGB distinti sulle righe-firma (→ prodotti) | **6.191** |
| Categorie con prodotti | **22** (23 nel parse; i 3 codici di GALILEO PRO - RICAMBI ricompaiono altrove e la dedupe last-wins li riassegna) |

*(Correzione post-Task 3, misurata col parser reale: i 6.299 codici distinti stimati in planning contavano anche codici presenti SOLO su righe-indice/moduli d'ordine, mai come riga-prodotto; i prodotti importabili sono 6.191. Le categorie sono 23: la regex esplorativa perdeva `IMAGO++`, `IMAGO E IMAGO+`, `CLIMATECH E CLIMATECH+`.)*

Categorie reali: SERRATURE, ARTECH, FERRAMENTA PER IMPOSTE, MULTIPUNTO, i.MOTION-S, CERNIERE, AS A SCOMPARSA, INTERMEDIO, BASE, GALILEO PRO, CILINDRI, ALZANTE CLASSIC, GALILEO PRO - ALLUMINIO, ARTECH PLANA, COMPONENTI MASTERIZZAZIONE CILINDRI, CATENACCI, GALILEO PRO ALLUMINIO - RICAMBI, GALILEO PRO - RICAMBI, AGB 4K, BILICI, IMAGO++, IMAGO E IMAGO+, CLIMATECH E CLIMATECH+. *(Nota: l'header è `i.MOTION-S`, con prefisso minuscolo — la regex header non deve assumere iniziale maiuscola.)*

## Delta rispetto allo spec (decisioni prese in planning, da dati reali)

1. **`ParsedRow.attributes: Record<string,string>`** in più: le colonne variano per blocco (ENTRATA/HBB/GR, X-Y/PISTONCINI, H/GR, PUNTI CHIUSURA…). Le celle si estraggono per **offset carattere dall'header colonna** e confluiscono in `specifications.colonne`.
2. **`composeName` include `hand`** (altrimenti le varianti DX/SX collidono sul nome).
3. **`shortDescription` = `categoria · sottocategoria · materiale`** — senza, il tsvector non matcherebbe "cerniere" (il trigger indicizza name/description/short/code, non la categoria).
4. **Errori di ricerca in UI**: banner inline `role="alert"` invece di toast (niente infra toast in 1a; YAGNI).
5. **MANO** nei dati reali è minuscolo (`dx`/`sx`) → normalizzato a `DX`/`SX`.
6. I Decimal Prisma si convertono a `number` nel router (superjson non serializza `Prisma.Decimal`).

---

### Task 1: Parser — firma riga-prodotto e prezzo

**Files:**
- Create: `src/server/catalog/parse-listino.ts`
- Test: `src/server/catalog/parse-listino.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `parseListino(text: string): ParseResult` · `parsePriceCents(price: string): number` · `CODE_TOKEN: RegExp` · tipi `ParsedRow`, `ParseStats`, `ParseResult` (usati da Task 2–6).

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/server/catalog/parse-listino.test.ts
import { describe, it, expect } from "vitest";
import { parseListino, parsePriceCents } from "./parse-listino";

describe("parsePriceCents", () => {
  it("converte i prezzi in formato italiano in centesimi (aritmetica intera)", () => {
    expect(parsePriceCents("1,23")).toBe(123);
    expect(parsePriceCents("104,52")).toBe(10452);
    expect(parsePriceCents("1.234,56")).toBe(123456);
    expect(parsePriceCents("0,97")).toBe(97);
  });
});

describe("parseListino — firma riga-prodotto", () => {
  // Righe REALI dal listino AGB 2026 (pdftotext -layout).
  const block = [
    "                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2",
    "                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2",
    "NB: utilizzare gli incontri elettrici dedicati alla serratura Opera SL",
    "Ferramenta per finestre - cod. A40457.25.10          Serrature - cod. B00591.50.03",
  ].join("\n");

  it("estrae codice, confezione, prezzo e classe sconto dalle righe con firma rigida", () => {
    const { rows } = parseListino(block);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      agbCode: "B00590.15.03",
      packBox: 25,
      packCarton: 250,
      priceCents: 123,
      discountClass: "A2",
    });
    expect(rows[1]).toMatchObject({ agbCode: "B00590.15.06", priceCents: 135 });
  });

  it("conta le righe-codice senza firma completa come skipped (senza crash)", () => {
    const { stats } = parseListino(block);
    expect(stats.codeLines).toBe(3); // 2 firme + 1 riga indice con 2 codici
    expect(stats.parsed).toBe(2);
    expect(stats.skipped).toBe(1);
  });

  it("conta le pagine dai marker \\f", () => {
    expect(parseListino("a\fb\fc").stats.pages).toBe(2);
    expect(parseListino("senza marker").stats.pages).toBe(1);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: FAIL — `Cannot find module './parse-listino'`

- [ ] **Step 3: Implementazione minima**

```ts
// src/server/catalog/parse-listino.ts
// Parser deterministico del listino AGB (output `pdftotext -layout`). MAI LLM.
// NIENTE `server-only`: modulo puro riusato da scripts/import-agb.ts e prisma/ via tsx.

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
  /** Celle-colonna della riga (chiave = intestazione colonna minuscola). */
  attributes: Record<string, string>;
  rawLine: string;
}

export interface ParseStats {
  pages: number;
  codeLines: number;
  parsed: number;
  skipped: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  stats: ParseStats;
}

/** Codice AGB: lettera + 5 cifre + .NN.NN (es. B00590.15.03). */
export const CODE_TOKEN = /[A-Z]\d{5}\.\d{2}\.\d{2}/;

/** Firma rigida: codice + confezione (2 interi) + prezzo IT + classe sconto. */
const PRODUCT_SIGNATURE =
  /([A-Z]\d{5}\.\d{2}\.\d{2})[ \t]+(\d+)[ \t]+(\d+)[ \t]+(\d{1,3}(?:\.\d{3})*,\d{2})[ \t]+([A-Z]\d)\b/g;

/** "1.234,56" → 123456 (centesimi; niente float). */
export function parsePriceCents(price: string): number {
  const [euros = "0", cents = "0"] = price.replace(/\./g, "").split(",");
  return Number(euros) * 100 + Number(cents);
}

export function parseListino(text: string): ParseResult {
  const pageBreaks = (text.match(/\f/g) ?? []).length;
  const stats: ParseStats = {
    pages: pageBreaks === 0 ? 1 : pageBreaks,
    codeLines: 0,
    parsed: 0,
    skipped: 0,
  };
  const rows: ParsedRow[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replaceAll("\f", "");
    if (CODE_TOKEN.test(line)) stats.codeLines++;
    else continue;

    PRODUCT_SIGNATURE.lastIndex = 0;
    let emitted = 0;
    let sig = PRODUCT_SIGNATURE.exec(line);
    while (sig !== null) {
      rows.push({
        agbCode: sig[1]!,
        packBox: Number(sig[2]!),
        packCarton: Number(sig[3]!),
        priceCents: parsePriceCents(sig[4]!),
        discountClass: sig[5]!,
        category: "",
        subcategory: null,
        groupTitle: null,
        material: null,
        finish: null,
        dimension: null,
        hand: null,
        attributes: {},
        rawLine: line,
      });
      emitted++;
      sig = PRODUCT_SIGNATURE.exec(line);
    }
    if (emitted > 0) stats.parsed += emitted;
    else stats.skipped++;
  }

  return { rows, stats };
}
```

*(Nota: il conteggio pagine con `\f` è verificato sul reale in Task 14; l'`else continue` sul CODE_TOKEN è temporaneo — Task 2 riscrive il loop per gestire le righe di contesto.)*

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/
git commit -m "feat(catalog): parser firma riga-prodotto listino AGB (deterministico)"
```

---

### Task 2: Parser — contesto di pagina (categoria, sottocategoria, gruppo, materiale)

**Files:**
- Modify: `src/server/catalog/parse-listino.ts`
- Test: `src/server/catalog/parse-listino.test.ts` (aggiunte)

**Interfaces:**
- Consumes: Task 1.
- Produces: `ParsedRow` con `category`, `subcategory`, `groupTitle`, `material` popolati.

- [ ] **Step 1: Aggiungi i test che falliscono**

Aggiungi in coda a `parse-listino.test.ts` (fixture REALE — pagina 118 del listino, spaziatura preservata):

```ts
export const FIXTURE_SERRATURE = [
  "\f                SERRATURE                                                                LISTINO 2026",
  "",
  "Incontri - Sicurezza",
  "                            Larghezza 22 mm, bordo tondo spessore 3 mm",
  "                            ACCIAIO",
  "                            LUNGHEZZA         FINITURA               CODICE                     € CS",
  "                            238 mm            Ottonato lucido        B00590.15.03   25 250    1,23   A2",
  "                                              Nichelato lucido       B00590.15.06   25 250    1,35   A2",
  "                                              Bronzato opaco vern.   B00590.15.22   25 250    0,97   A2",
  "                                              Cromato opaco          B00590.15.34   25 250    2,07   A2",
  "",
  "                            Larghezza 22 mm, bordo tondo spessore 2 mm",
  "                            ACCIAIO",
  "                            LUNGHEZZA         FINITURA               CODICE                     € CS",
  "                            238 mm            Ottonato lucido        B00590.30.03   25 250    1,05   A1",
  "",
  "                                                                                                 118",
].join("\n");

describe("parseListino — contesto di pagina", () => {
  it("attribuisce categoria, sottocategoria, gruppo e materiale a ogni riga", () => {
    const { rows, stats } = parseListino(FIXTURE_SERRATURE);
    expect(stats.parsed).toBe(5);
    expect(rows[0]).toMatchObject({
      agbCode: "B00590.15.03",
      category: "SERRATURE",
      subcategory: "Incontri - Sicurezza",
      groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
      material: "ACCIAIO",
    });
    // Il secondo gruppo aggiorna il titolo, la sottocategoria resta.
    expect(rows[4]).toMatchObject({
      agbCode: "B00590.30.03",
      groupTitle: "Larghezza 22 mm, bordo tondo spessore 2 mm",
      material: "ACCIAIO",
      discountClass: "A1",
    });
  });

  it("gestisce header con prefisso minuscolo (i.MOTION-S) e ignora numeri pagina", () => {
    const page = [
      "\f       i.MOTION-S                               LISTINO 2026",
      "Guide",
      "                     Guida singola",
      "                     FINITURA          CODICE               € CS",
      "                     Argento           M02022.01.02   1 1    10,00   C1",
      "                                                                573",
    ].join("\n");
    const { rows } = parseListino(page);
    expect(rows[0]).toMatchObject({ category: "i.MOTION-S", subcategory: "Guide" });
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: FAIL — `category` è `""`, non "SERRATURE"

- [ ] **Step 3: Implementa lo state machine**

Sostituisci `parseListino` (le costanti/tipi di Task 1 restano invariati) e aggiungi le regex di supporto:

```ts
/** Riga materiale: MAIUSCOLA, indentata, che inizia con un materiale noto. */
const MATERIAL_LINE =
  /^[ \t]+((?:ACCIAIO|OTTONE|ALLUMINIO|ZAMA|INOX|NYLON|POLIAMMIDE|TECNOPOLIMERO|PVC)[A-Z .]*)$/;

/** Note, bullet, footnote e righe numero-pagina: mai titoli di gruppo. */
const NOISE_LINE = /^[ \t]*(?:NB|N\.B\.|\(\*|\*|-|•|Contenuto)|^[ \t]*\d{1,4}[ \t]*$/;

/** Header di pagina: riga che termina con "LISTINO 2026"; il prefisso è la categoria. */
const PAGE_HEADER = /^(.*?)\s*LISTINO 2026\s*$/;

export function parseListino(text: string): ParseResult {
  const pageBreaks = (text.match(/\f/g) ?? []).length;
  const stats: ParseStats = {
    pages: pageBreaks === 0 ? 1 : pageBreaks,
    codeLines: 0,
    parsed: 0,
    skipped: 0,
  };
  const rows: ParsedRow[] = [];

  let category = "";
  let subcategory: string | null = null;
  let groupTitle: string | null = null;
  let material: string | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replaceAll("\f", "");
    const trimmed = line.trim();
    const hasCode = CODE_TOKEN.test(line);
    if (hasCode) stats.codeLines++;
    if (!trimmed) continue;

    // 1. Header di pagina → categoria (se il prefisso non è vuoto).
    const header = PAGE_HEADER.exec(trimmed);
    if (header) {
      const name = header[1]!.trim().replace(/[ \t]{2,}/g, " ");
      if (name) category = name;
      continue;
    }

    // 2. Riga materiale (mai contiene codici).
    const materialMatch = MATERIAL_LINE.exec(line);
    if (materialMatch && !hasCode) {
      material = materialMatch[1]!.trim();
      continue;
    }

    // 3. Righe prodotto (firma rigida; il regex globale gestisce più match).
    PRODUCT_SIGNATURE.lastIndex = 0;
    let emitted = 0;
    let sig = PRODUCT_SIGNATURE.exec(line);
    while (sig !== null) {
      rows.push({
        agbCode: sig[1]!,
        packBox: Number(sig[2]!),
        packCarton: Number(sig[3]!),
        priceCents: parsePriceCents(sig[4]!),
        discountClass: sig[5]!,
        category,
        subcategory,
        groupTitle,
        material,
        finish: null,
        dimension: null,
        hand: null,
        attributes: {},
        rawLine: line,
      });
      emitted++;
      sig = PRODUCT_SIGNATURE.exec(line);
    }
    if (emitted > 0) {
      stats.parsed += emitted;
      continue;
    }
    if (hasCode) {
      stats.skipped++;
      continue;
    }

    // 4. Rumore (note, bullet, numeri pagina).
    if (NOISE_LINE.test(line)) continue;

    // 5. Riga a colonna 0 → sottocategoria (reset del contesto blocco).
    if (/^\S/.test(line)) {
      subcategory = trimmed.split(/[ \t]{3,}/)[0]!.trim();
      groupTitle = null;
      material = null;
      continue;
    }

    // 6. Intestazione colonne: gestita in Task 3 (per ora la si salta).
    if (line.includes("CODICE") && line.includes("€")) continue;

    // 7. Riga di testo indentata → titolo gruppo (l'ultima prima dell'header vince);
    //    un nuovo gruppo azzera il materiale (nei dati reali il materiale segue sempre il gruppo).
    groupTitle = trimmed.replace(/[ \t]{2,}/g, " ");
    material = null;
  }

  return { rows, stats };
}
```

- [ ] **Step 4: Verifica che passi (tutti, inclusi Task 1)**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/
git commit -m "feat(catalog): state machine contesto pagina (categoria/sottocategoria/gruppo/materiale)"
```

---

### Task 3: Parser — colonne, celle, ereditarietà, finitura/dimensione/mano

**Files:**
- Modify: `src/server/catalog/parse-listino.ts`
- Test: `src/server/catalog/parse-listino.test.ts` (aggiunte)

**Interfaces:**
- Consumes: Task 2.
- Produces: `ParsedRow` completo (`finish`, `dimension`, `hand`, `attributes` + ereditarietà celle vuote). Il parser è FINITO dopo questo task.

- [ ] **Step 1: Aggiungi i test che falliscono**

Fixture REALI (pagg. 282 e — FERRAMENTA PER IMPOSTE — 490 circa):

```ts
export const FIXTURE_CERNIERE = [
  "\f                   CERNIERE                                                                         LISTINO 2026",
  "",
  "Per porte a filo",
  "                              COMPACT - Confezione per una porta",
  "                              ACCIAIO",
  "                              FINITURA                       MANO            CODICE                         € CS",
  "                              Nichelato opaco                dx              E10073.10.16   1 20         51,59   C1",
  "                                                             sx              E10073.11.16   1 20         51,59   C1",
  "",
  "                              Kit 6 viti per cerniera COMPACT",
  "",
  "                                                                             CODICE                         € CS",
  "                                                                             E09010.10.05   50 50         2,77   C1",
].join("\n");

export const FIXTURE_IMPOSTE = [
  "\f               FERRAMENTA PER IMPOSTE                                             LISTINO 2026",
  "Abaco - Spagnolette",
  "                           Asta di chiusura",
  "                            ACCIAIO",
  "                           FINITURA            H      GR   CODICE                         € CS",
  "                           Black Powerage      1000   1    H00900.01.93   10 10         3,89   E1",
  "                                               1200   2    H00900.02.93   10 10         4,39   E1",
  "                           Silver Powerage     1000   1    H00900.01.21   10 10         4,19   E1",
].join("\n");

describe("parseListino — colonne e attributi", () => {
  it("estrae finitura e mano (normalizzata DX/SX) dalle colonne; le celle vuote ereditano", () => {
    const { rows } = parseListino(FIXTURE_CERNIERE);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ agbCode: "E10073.10.16", finish: "Nichelato opaco", hand: "DX" });
    // Riga successiva: FINITURA vuota → ereditata; MANO cambia.
    expect(rows[1]).toMatchObject({ agbCode: "E10073.11.16", finish: "Nichelato opaco", hand: "SX" });
    // Blocco kit senza colonne-attributo: tutto null, gruppo aggiornato, materiale azzerato.
    expect(rows[2]).toMatchObject({
      agbCode: "E09010.10.05",
      groupTitle: "Kit 6 viti per cerniera COMPACT",
      finish: null,
      hand: null,
      dimension: null,
      material: null,
      priceCents: 277,
    });
  });

  it("mappa le colonne dimensionali (H, LUNGHEZZA, …) su dimension e le altre in attributes", () => {
    const { rows } = parseListino(FIXTURE_IMPOSTE);
    expect(rows[0]).toMatchObject({ finish: "Black Powerage", dimension: "1000" });
    expect(rows[0]!.attributes).toMatchObject({ finitura: "Black Powerage", h: "1000", gr: "1" });
    // Finitura ereditata, dimensione aggiornata dalla cella presente.
    expect(rows[1]).toMatchObject({ finish: "Black Powerage", dimension: "1200" });
    // Nuova finitura esplicita interrompe l'ereditarietà.
    expect(rows[2]).toMatchObject({ finish: "Silver Powerage", dimension: "1000" });
  });

  it("eredita la dimensione nel blocco serrature (LUNGHEZZA ripetuta solo sulla prima riga)", () => {
    const { rows } = parseListino(FIXTURE_SERRATURE);
    expect(rows[0]).toMatchObject({ dimension: "238 mm", finish: "Ottonato lucido" });
    expect(rows[1]).toMatchObject({ dimension: "238 mm", finish: "Nichelato lucido" });
    expect(rows[3]).toMatchObject({ dimension: "238 mm", finish: "Cromato opaco" });
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: FAIL — `finish` è `null`

- [ ] **Step 3: Implementa colonne + slicing + ereditarietà**

Aggiungi prima di `parseListino`:

```ts
interface Column {
  name: string;
  start: number;
}

/** Colonne di un header: gruppi di token separati da 2+ spazi, con offset carattere. */
export function parseColumns(line: string): Column[] {
  const columns: Column[] = [];
  const re = /\S+(?: \S+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    columns.push({ name: m[0].trim(), start: m.index });
  }
  return columns;
}

/** Affetta le celle-attributo (colonne prima di CODICE) per offset, con tolleranza -2. */
function sliceCells(line: string, columns: Column[], codeStart: number): Record<string, string> {
  const cells: Record<string, string> = {};
  const codeIdx = columns.findIndex((c) => c.name === "CODICE");
  const attrCols = codeIdx > 0 ? columns.slice(0, codeIdx) : [];
  for (let i = 0; i < attrCols.length; i++) {
    const col = attrCols[i]!;
    const start = Math.max(0, col.start - 2);
    const nextStart = i + 1 < attrCols.length ? attrCols[i + 1]!.start : codeStart + 2;
    const end = Math.min(Math.max(start, nextStart - 2), codeStart);
    const value = line.slice(start, end).trim().replace(/[ \t]{2,}/g, " ");
    if (value) cells[col.name.toLowerCase()] = value;
  }
  return cells;
}

/** Colonne che rappresentano una dimensione (chiavi minuscole). */
const DIMENSION_COLUMN = /^(lunghezza|altezza|entrata|spessore|misura|h\b|h |x\b|x-|ø)/;

function pickCell(
  cells: Record<string, string>,
  predicate: (key: string) => boolean,
): string | null {
  for (const [key, value] of Object.entries(cells)) {
    if (predicate(key)) return value;
  }
  return null;
}
```

In `parseListino` aggiungi lo stato del blocco-tabella e integra le regole:

```ts
  let columns: Column[] = [];
  let carriedCells: Record<string, string> = {};
```

Sposta il check dell'intestazione colonne PRIMA della regola materiale (regola 2), così ogni header azzera il blocco:

```ts
    // 2. Intestazione colonne → nuovo blocco tabella (azzera l'ereditarietà).
    if (line.includes("CODICE") && line.includes("€") && !hasCode) {
      columns = parseColumns(line);
      carriedCells = {};
      continue;
    }
```

Nel loop di emissione (regola 3), sostituisci il corpo del `while` con:

```ts
    while (sig !== null) {
      const cells = { ...carriedCells, ...sliceCells(line, columns, sig.index) };
      carriedCells = cells;
      const handCell = pickCell(cells, (k) => k.includes("mano"));
      const handMatch = handCell ? /\b(dx|sx)\b/i.exec(handCell) : null;
      const dimensionCell = pickCell(cells, (k) => DIMENSION_COLUMN.test(k));
      const dimension = dimensionCell
        ? dimensionCell.replace(/\b(dx|sx)\b/gi, "").trim() || null
        : null;
      rows.push({
        agbCode: sig[1]!,
        packBox: Number(sig[2]!),
        packCarton: Number(sig[3]!),
        priceCents: parsePriceCents(sig[4]!),
        discountClass: sig[5]!,
        category,
        subcategory,
        groupTitle,
        material,
        finish: pickCell(cells, (k) => k.includes("finitura")),
        dimension,
        hand: handMatch ? (handMatch[1]!.toUpperCase() as "DX" | "SX") : null,
        attributes: cells,
        rawLine: line,
      });
      emitted++;
      sig = PRODUCT_SIGNATURE.exec(line);
    }
```

Infine, la regola 5 (sottocategoria) e la regola 7 (titolo gruppo) azzerano anche `carriedCells`:

```ts
    // 5. …dentro il ramo sottocategoria:
      carriedCells = {};
    // 7. …dentro il ramo titolo gruppo:
      carriedCells = {};
```

*(La vecchia regola 6 placeholder di Task 2 si elimina: ora l'header colonne è la regola 2.)*

- [ ] **Step 4: Verifica che passino tutti**

Run: `pnpm test src/server/catalog/parse-listino.test.ts`
Expected: PASS (10 test)

- [ ] **Step 5: Smoke test sul PDF reale (se presente in scratchpad)**

```bash
set -a; source .env; set +a
pnpm tsx -e "
import { readFileSync } from 'node:fs';
import { parseListino } from './src/server/catalog/parse-listino';
const text = readFileSync(process.env.SCRATCHPAD_CATALOG ?? '/tmp/claude-0/-home-user-AGB-Finder/d9c474f1-0374-53d9-b6c4-38f920fe2664/scratchpad/catalog.txt', 'utf8');
const { rows, stats } = parseListino(text);
console.log(stats, 'codici distinti:', new Set(rows.map(r => r.agbCode)).size);
"
```
Expected: `parsed: 8217, skipped: 274`, codici distinti `6191`, categorie `23` (22 dopo dedupe). Se il file non c'è, salta lo step (la verifica completa è in Task 14). Se i numeri divergono, indaga PRIMA di proseguire (superpowers:systematic-debugging).

- [ ] **Step 6: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/
git commit -m "feat(catalog): slicing celle per colonna, ereditarietà, finitura/dimensione/mano"
```

---

### Task 4: Mapping ParsedRow → Product

**Files:**
- Create: `src/server/catalog/map-product.ts`
- Test: `src/server/catalog/map-product.test.ts`

**Interfaces:**
- Consumes: `ParsedRow` (Task 1–3).
- Produces: `toProductData(row: ParsedRow): ProductUpsertData` · `slugifyCategory(header: string): string` · `categoryDisplayName(header: string): string` · `composeName(row: ParsedRow): string` · `dedupeRows(rows: ParsedRow[]): ParsedRow[]` (usati da Task 5, 6).

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
// src/server/catalog/map-product.test.ts
import { describe, it, expect } from "vitest";
import type { ParsedRow } from "./parse-listino";
import {
  composeName,
  categoryDisplayName,
  dedupeRows,
  slugifyCategory,
  toProductData,
} from "./map-product";

const row = (partial: Partial<ParsedRow>): ParsedRow => ({
  agbCode: "B00590.15.03",
  priceCents: 123,
  category: "SERRATURE",
  subcategory: "Incontri - Sicurezza",
  groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
  material: "ACCIAIO",
  finish: "Ottonato lucido",
  dimension: "238 mm",
  hand: null,
  packBox: 25,
  packCarton: 250,
  discountClass: "A2",
  attributes: { lunghezza: "238 mm", finitura: "Ottonato lucido" },
  rawLine: "…",
  ...partial,
});

describe("slugifyCategory", () => {
  it("produce slug stabili e compatibili con il seed 1a", () => {
    expect(slugifyCategory("SERRATURE")).toBe("serrature");
    expect(slugifyCategory("CERNIERE")).toBe("cerniere");
    expect(slugifyCategory("FERRAMENTA PER IMPOSTE")).toBe("ferramenta-per-imposte");
    expect(slugifyCategory("GALILEO PRO - ALLUMINIO")).toBe("galileo-pro-alluminio");
    expect(slugifyCategory("i.MOTION-S")).toBe("i-motion-s");
    expect(slugifyCategory("AGB 4K")).toBe("agb-4k");
  });
});

describe("categoryDisplayName", () => {
  it("è leggibile (title case, preposizioni minuscole, marchi preservati)", () => {
    expect(categoryDisplayName("SERRATURE")).toBe("Serrature");
    expect(categoryDisplayName("FERRAMENTA PER IMPOSTE")).toBe("Ferramenta per Imposte");
    expect(categoryDisplayName("i.MOTION-S")).toBe("i.MOTION-S");
    expect(categoryDisplayName("AGB 4K")).toBe("AGB 4K");
  });
});

describe("composeName", () => {
  it("compone gruppo + finitura + dimensione + mano", () => {
    expect(composeName(row({ hand: "DX" }))).toBe(
      "Larghezza 22 mm, bordo tondo spessore 3 mm Ottonato lucido 238 mm DX",
    );
  });
  it("fallback categoria + codice quando mancano i componenti", () => {
    expect(
      composeName(row({ groupTitle: null, finish: null, dimension: null, hand: null })),
    ).toBe("Serrature B00590.15.03");
  });
});

describe("toProductData", () => {
  it("mappa prezzo (centesimi → stringa decimale), specifications e shortDescription", () => {
    const data = toProductData(row({}));
    expect(data).toMatchObject({
      agbCode: "B00590.15.03",
      sku: "B00590.15.03",
      basePrice: "1.23",
      priceUnit: "EUR",
      isAvailable: true,
      stockQuantity: 0,
      categorySlug: "serrature",
      shortDescription: "Serrature · Incontri - Sicurezza · ACCIAIO",
    });
    expect(data.specifications).toMatchObject({
      finitura: "Ottonato lucido",
      materiale: "ACCIAIO",
      dimensione: "238 mm",
      confezione: { scatola: 25, cartone: 250 },
      classeSconto: "A2",
      sottocategoria: "Incontri - Sicurezza",
      gruppo: "Larghezza 22 mm, bordo tondo spessore 3 mm",
      colonne: { lunghezza: "238 mm", finitura: "Ottonato lucido" },
    });
    expect(data.specifications).not.toHaveProperty("mano");
  });
});

describe("dedupeRows", () => {
  it("deduplica per agbCode, ultima occorrenza vince", () => {
    const rows = [row({ priceCents: 100 }), row({ agbCode: "X00001.01.01" }), row({ priceCents: 200 })];
    const unique = dedupeRows(rows);
    expect(unique).toHaveLength(2);
    expect(unique.find((r) => r.agbCode === "B00590.15.03")?.priceCents).toBe(200);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/catalog/map-product.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa**

```ts
// src/server/catalog/map-product.ts
// Mapping ParsedRow → dati Product/ProductCategory. Puro, riusato da scripts/ e prisma/.
import type { ParsedRow } from "./parse-listino";

export interface ProductUpsertData {
  agbCode: string;
  sku: string;
  name: string;
  shortDescription: string;
  basePrice: string; // Prisma Decimal accetta stringhe: niente float
  priceUnit: "EUR";
  isAvailable: true;
  stockQuantity: 0;
  specifications: Record<string, unknown>;
  categorySlug: string;
}

export function slugifyCategory(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nomi visualizzati: marchi noti preservati, altrimenti title case con preposizioni minuscole. */
const BRAND_NAMES: Record<string, string> = {
  "i.MOTION-S": "i.MOTION-S",
  "AGB 4K": "AGB 4K",
};

export function categoryDisplayName(header: string): string {
  const brand = BRAND_NAMES[header];
  if (brand) return brand;
  return header
    .toLowerCase()
    .replace(/(^|[\s(-])([a-zà-ù])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b(Di|Del|Della|E|Ed|Per|A|Ad|Da|Con)\b/g, (word) => word.toLowerCase());
}

export function composeName(row: ParsedRow): string {
  const name = [row.groupTitle, row.finish, row.dimension, row.hand]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return name || `${categoryDisplayName(row.category)} ${row.agbCode}`;
}

export function toProductData(row: ParsedRow): ProductUpsertData {
  const specifications: Record<string, unknown> = {};
  if (row.finish) specifications.finitura = row.finish;
  if (row.material) specifications.materiale = row.material;
  if (row.dimension) specifications.dimensione = row.dimension;
  if (row.hand) specifications.mano = row.hand;
  if (row.packBox !== null || row.packCarton !== null) {
    specifications.confezione = { scatola: row.packBox, cartone: row.packCarton };
  }
  if (row.discountClass) specifications.classeSconto = row.discountClass;
  if (row.subcategory) specifications.sottocategoria = row.subcategory;
  if (row.groupTitle) specifications.gruppo = row.groupTitle;
  if (Object.keys(row.attributes).length > 0) specifications.colonne = row.attributes;

  return {
    agbCode: row.agbCode,
    sku: row.agbCode,
    name: composeName(row),
    shortDescription: [categoryDisplayName(row.category), row.subcategory, row.material]
      .filter(Boolean)
      .join(" · "),
    basePrice: (row.priceCents / 100).toFixed(2),
    priceUnit: "EUR",
    isAvailable: true,
    stockQuantity: 0,
    specifications,
    categorySlug: slugifyCategory(row.category),
  };
}

/** Deduplica per agbCode: l'ultima occorrenza nel listino vince (8.217 righe → 6.299 codici). */
export function dedupeRows(rows: ParsedRow[]): ParsedRow[] {
  const byCode = new Map<string, ParsedRow>();
  for (const row of rows) byCode.set(row.agbCode, row);
  return [...byCode.values()];
}
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/catalog/map-product.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/
git commit -m "feat(catalog): mapping ParsedRow -> Product (nome, specifications, slug categoria)"
```

---

### Task 5: Estrazione PDF, upsert catalogo e script `pnpm import:agb`

**Files:**
- Create: `src/server/catalog/extract-pdf.ts`
- Create: `src/server/catalog/import-catalog.ts`
- Create: `scripts/import-agb.ts`
- Modify: `package.json` (script `import:agb`)
- Test: `src/server/catalog/extract-pdf.test.ts`

**Interfaces:**
- Consumes: `parseListino` (Task 3), `dedupeRows`/`toProductData`/`slugifyCategory`/`categoryDisplayName` (Task 4).
- Produces: `extractPdfText(pdfPath: string): Promise<string>` · `upsertCatalog(db: PrismaClient, rows: ParsedRow[], batchSize?: number): Promise<ImportReport>` con `ImportReport = { categories: number; products: number }` (riusato dal seed in Task 6) · comando `pnpm import:agb <pdf>`.

- [ ] **Step 1: Test del wrapper PDF (che fallisce)**

```ts
// src/server/catalog/extract-pdf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import { extractPdfText } from "./extract-pdf";

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

beforeEach(() => execFileMock.mockReset());

describe("extractPdfText", () => {
  it("invoca pdftotext -layout <pdf> - e risolve con lo stdout", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => cb(null, "TESTO", ""),
    );
    await expect(extractPdfText("/tmp/listino.pdf")).resolves.toBe("TESTO");
    expect(execFileMock).toHaveBeenCalledWith(
      "pdftotext",
      ["-layout", "/tmp/listino.pdf", "-"],
      expect.objectContaining({ maxBuffer: expect.any(Number) }),
      expect.any(Function),
    );
  });

  it("rifiuta con un errore parlante se pdftotext fallisce", async () => {
    execFileMock.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) =>
        cb(new Error("ENOENT"), "", ""),
    );
    await expect(extractPdfText("/tmp/x.pdf")).rejects.toThrow(/pdftotext.*\/tmp\/x\.pdf/);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/catalog/extract-pdf.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa i tre moduli**

```ts
// src/server/catalog/extract-pdf.ts
// Thin wrapper su poppler-utils. Isolato dal parser: i test del parser non richiedono il binario.
import { execFile } from "node:child_process";

const MAX_BUFFER = 256 * 1024 * 1024; // il listino estratto è ~4 MB; margine largo

export function extractPdfText(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("pdftotext", ["-layout", pdfPath, "-"], { maxBuffer: MAX_BUFFER }, (error, stdout) => {
      if (error) {
        reject(
          new Error(
            `pdftotext fallito per ${pdfPath}: ${error.message}. Verifica che poppler-utils sia installato.`,
          ),
        );
      } else {
        resolve(stdout);
      }
    });
  });
}
```

```ts
// src/server/catalog/import-catalog.ts
// Upsert idempotente di categorie e prodotti. Condiviso da scripts/import-agb.ts e prisma/seed-catalog.ts.
import type { PrismaClient } from "@prisma/client";
import type { ParsedRow } from "./parse-listino";
import { categoryDisplayName, dedupeRows, slugifyCategory, toProductData } from "./map-product";

export interface ImportReport {
  categories: number;
  products: number;
  failedBatches: number;
}

export async function upsertCatalog(
  db: PrismaClient,
  rows: ParsedRow[],
  batchSize = 500,
): Promise<ImportReport> {
  const unique = dedupeRows(rows).filter((row) => row.category !== "");

  const nameBySlug = new Map<string, string>();
  for (const row of unique) {
    const slug = slugifyCategory(row.category);
    if (!nameBySlug.has(slug)) nameBySlug.set(slug, categoryDisplayName(row.category));
  }
  const idBySlug = new Map<string, string>();
  for (const [slug, name] of nameBySlug) {
    const category = await db.productCategory.upsert({
      where: { slug },
      update: {},
      create: { slug, name },
    });
    idBySlug.set(slug, category.id);
  }

  // Ogni blocco è una transazione; un blocco fallito viene loggato e si prosegue
  // (regola spec §Error handling: mai bloccare l'intero import).
  let imported = 0;
  let failedBatches = 0;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      await db.$transaction(
        batch.map((row) => {
          const { categorySlug, ...fields } = toProductData(row);
          const categoryId = idBySlug.get(categorySlug);
          if (!categoryId) throw new Error(`Categoria mancante per slug '${categorySlug}'`);
          return db.product.upsert({
            where: { agbCode: fields.agbCode },
            update: { ...fields, categoryId },
            create: { ...fields, categoryId },
          });
        }),
      );
      imported += batch.length;
    } catch (error) {
      failedBatches++;
      console.error(
        `✗ Blocco ${i}-${i + batch.length - 1} fallito (${batch[0]?.agbCode}…): ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { categories: idBySlug.size, products: imported, failedBatches };
}
```

```ts
// scripts/import-agb.ts
// Import del listino AGB: pnpm import:agb <listino.pdf>
// Client Prisma proprio (come prisma/seed.ts): gira sotto tsx, fuori dal bundle server.
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "../src/server/catalog/extract-pdf";
import { parseListino } from "../src/server/catalog/parse-listino";
import { upsertCatalog } from "../src/server/catalog/import-catalog";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Uso: pnpm import:agb <listino.pdf>");
    process.exit(1);
  }
  console.log(`Estrazione testo da ${pdfPath}…`);
  const text = await extractPdfText(pdfPath);
  const { rows, stats } = parseListino(text);
  console.log(
    `✓ Pagine: ${stats.pages} · Righe con codice: ${stats.codeLines} · ` +
      `Parsed: ${stats.parsed} · Skipped: ${stats.skipped}`,
  );
  const db = new PrismaClient();
  try {
    const report = await upsertCatalog(db, rows);
    console.log(`✓ Prodotti unici: ${report.products} · Categorie: ${report.categories}`);
    if (report.failedBatches > 0) {
      console.warn(`⚠ Blocchi falliti: ${report.failedBatches} (vedi log sopra)`);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

In `package.json`, dentro `"scripts"`, dopo `"db:studio"`:

```json
    "import:agb": "tsx scripts/import-agb.ts",
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/catalog/extract-pdf.test.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/catalog/ scripts/import-agb.ts package.json
git commit -m "feat(catalog): extract-pdf, upsert idempotente e script pnpm import:agb"
```

---

### Task 6: Seed catalogo sintetico (50 prodotti reali)

**Files:**
- Create: `prisma/seed-catalog.ts`
- Modify: `package.json` (script `db:seed:catalog`)
- Test: `prisma/seed-catalog.test.ts`

**Interfaces:**
- Consumes: `ParsedRow` (Task 1), `upsertCatalog` (Task 5).
- Produces: `SEED_ROWS: ParsedRow[]` (50 righe reali) · `seedCatalog(db: PrismaClient): Promise<ImportReport>` (usati dal test di integrazione in Task 9) · comando `pnpm db:seed:catalog`.

I 50 prodotti sono **reali** (codici/prezzi/contesto trascritti dal listino 2026 durante il planning): 5 SERRATURE, 11 CERNIERE, 10 ARTECH, 8 CILINDRI, 8 FERRAMENTA PER IMPOSTE, 8 MULTIPUNTO.

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
// prisma/seed-catalog.test.ts
import { describe, it, expect } from "vitest";
import { SEED_ROWS } from "./seed-catalog";
import { CODE_TOKEN } from "../src/server/catalog/parse-listino";

describe("SEED_ROWS", () => {
  it("contiene 50 prodotti con codici AGB unici e validi", () => {
    expect(SEED_ROWS).toHaveLength(50);
    const codes = SEED_ROWS.map((r) => r.agbCode);
    expect(new Set(codes).size).toBe(50);
    for (const code of codes) expect(code).toMatch(CODE_TOKEN);
  });

  it("copre 6 categorie e ha prezzi/confezioni plausibili", () => {
    const categories = new Set(SEED_ROWS.map((r) => r.category));
    expect(categories).toEqual(
      new Set([
        "SERRATURE",
        "CERNIERE",
        "ARTECH",
        "CILINDRI",
        "FERRAMENTA PER IMPOSTE",
        "MULTIPUNTO",
      ]),
    );
    for (const row of SEED_ROWS) {
      expect(row.priceCents).toBeGreaterThan(0);
      expect(row.discountClass).toMatch(/^[A-Z]\d$/);
    }
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test prisma/seed-catalog.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa il seed**

```ts
// prisma/seed-catalog.ts
// Catalogo sintetico: 50 prodotti REALI dal listino AGB 2026 (trascritti a mano).
// Per dev/test senza il PDF da 39 MB. Idempotente. Embedding: null (Fase ≥1c).
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import type { ParsedRow } from "../src/server/catalog/parse-listino";
import { upsertCatalog, type ImportReport } from "../src/server/catalog/import-catalog";

type SeedInput = Partial<ParsedRow> & Pick<ParsedRow, "agbCode" | "priceCents" | "category">;

const row = (partial: SeedInput): ParsedRow => ({
  subcategory: null,
  groupTitle: null,
  material: null,
  finish: null,
  dimension: null,
  hand: null,
  packBox: null,
  packCarton: null,
  discountClass: null,
  attributes: {},
  rawLine: "seed",
  ...partial,
});

// ── SERRATURE · Incontri - Sicurezza (pag. 118) ──────────────────────────────
const serrature = (partial: SeedInput): ParsedRow =>
  row({
    category: "SERRATURE",
    subcategory: "Incontri - Sicurezza",
    groupTitle: "Larghezza 22 mm, bordo tondo spessore 3 mm",
    material: "ACCIAIO",
    dimension: "238 mm",
    packBox: 25,
    packCarton: 250,
    discountClass: "A2",
    ...partial,
  });

// ── CERNIERE · Per porte a filo (pag. 282) ───────────────────────────────────
const cerniereCompact = (partial: SeedInput): ParsedRow =>
  row({
    category: "CERNIERE",
    subcategory: "Per porte a filo",
    groupTitle: "COMPACT - Confezione per una porta",
    material: "ACCIAIO",
    finish: "Nichelato opaco",
    packBox: 1,
    packCarton: 20,
    discountClass: "C1",
    ...partial,
  });

const cerniere2R = (partial: SeedInput): ParsedRow =>
  row({
    category: "CERNIERE",
    subcategory: "Per porte a filo",
    groupTitle: "2R - Confezione per una porta",
    material: "ACCIAIO",
    packBox: 1,
    packCarton: 1,
    discountClass: "C1",
    ...partial,
  });

// ── ARTECH · Cremonesi · Anta ribalta (entrata 7,5 / 15) ─────────────────────
const artech = (partial: SeedInput): ParsedRow =>
  row({
    category: "ARTECH",
    subcategory: "Cremonesi",
    groupTitle: "Anta ribalta - altezza maniglia fissa",
    packBox: 10,
    packCarton: 10,
    discountClass: "F3",
    ...partial,
  });

// ── CILINDRI · Modello Scudo DCK ─────────────────────────────────────────────
const cilindri = (partial: SeedInput): ParsedRow =>
  row({
    category: "CILINDRI",
    subcategory: "Modello Scudo DCK - Chiave a duplicazione controllata",
    groupTitle: "Chiave - Chiave",
    material: "OTTONE NICHELATO OPACO",
    packBox: 1,
    packCarton: 5,
    discountClass: "B4",
    ...partial,
  });

// ── FERRAMENTA PER IMPOSTE · Abaco - Spagnolette ─────────────────────────────
const imposte = (partial: SeedInput): ParsedRow =>
  row({
    category: "FERRAMENTA PER IMPOSTE",
    subcategory: "Abaco - Spagnolette",
    groupTitle: "Asta di chiusura",
    material: "ACCIAIO",
    packBox: 10,
    packCarton: 10,
    discountClass: "E1",
    ...partial,
  });

// ── MULTIPUNTO · Sicurtop POSEIDON ───────────────────────────────────────────
const multipunto = (partial: SeedInput): ParsedRow =>
  row({
    category: "MULTIPUNTO",
    subcategory: "Sicurtop POSEIDON - Interasse 85 mm",
    groupTitle: "Frontale 16 mm",
    packBox: 5,
    packCarton: 5,
    discountClass: "G2",
    attributes: { "punti chiusura": "2P" },
    ...partial,
  });

export const SEED_ROWS: ParsedRow[] = [
  // SERRATURE (5)
  serrature({ agbCode: "B00590.15.03", priceCents: 123, finish: "Ottonato lucido", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.06", priceCents: 135, finish: "Nichelato lucido", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.22", priceCents: 97, finish: "Bronzato opaco vern.", category: "SERRATURE" }),
  serrature({ agbCode: "B00590.15.34", priceCents: 207, finish: "Cromato opaco", category: "SERRATURE" }),
  serrature({
    agbCode: "B00590.30.03", priceCents: 105, finish: "Ottonato lucido", category: "SERRATURE",
    groupTitle: "Larghezza 22 mm, bordo tondo spessore 2 mm", discountClass: "A1",
  }),
  // CERNIERE (11)
  cerniereCompact({ agbCode: "E10073.10.16", priceCents: 5159, hand: "DX", category: "CERNIERE" }),
  cerniereCompact({ agbCode: "E10073.11.16", priceCents: 5159, hand: "SX", category: "CERNIERE" }),
  row({
    agbCode: "E09010.10.05", priceCents: 277, category: "CERNIERE",
    subcategory: "Per porte a filo", groupTitle: "Kit 6 viti per cerniera COMPACT",
    packBox: 50, packCarton: 50, discountClass: "C1",
  }),
  cerniere2R({ agbCode: "E10006.41.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.44.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "44 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.45.03", priceCents: 3668, finish: "Ottonato lucido", dimension: "45 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.44.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "44 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.45.06", priceCents: 3838, finish: "Nichelato lucido", dimension: "45 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.34", priceCents: 4175, finish: "Cromato opaco", dimension: "41 mm", category: "CERNIERE" }),
  cerniere2R({ agbCode: "E10006.41.93", priceCents: 4175, finish: "Nero semilucido", dimension: "41 mm", category: "CERNIERE" }),
  // ARTECH (10) — dimensione = campo HBB (altezza battuta) in mm
  artech({ agbCode: "A50122.08.02", priceCents: 1709, dimension: "610-810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.03", priceCents: 1728, dimension: "794-1010", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.04", priceCents: 1795, dimension: "994-1210", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.05", priceCents: 1914, dimension: "1194-1410", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.06", priceCents: 1992, dimension: "1394-1610", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.07", priceCents: 2212, dimension: "1594-1810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.17", priceCents: 2212, dimension: "1634-1810", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.08", priceCents: 2397, dimension: "1794-2110", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.09", priceCents: 2706, dimension: "1994-2310", category: "ARTECH" }),
  artech({ agbCode: "A50122.08.10", priceCents: 2893, dimension: "2194-2510", category: "ARTECH" }),
  // CILINDRI (8) — dimensione = lunghezza totale (X-Y)
  cilindri({ agbCode: "C10016.25.25", priceCents: 10452, dimension: "60 (30-30)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.30", priceCents: 10621, dimension: "65 (30-35)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.35", priceCents: 10621, dimension: "70 (30-40)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.30", priceCents: 10621, dimension: "70 (35-35)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.40", priceCents: 11185, dimension: "75 (30-45)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.35", priceCents: 11185, dimension: "75 (35-40)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.25.45", priceCents: 11185, dimension: "80 (30-50)", category: "CILINDRI" }),
  cilindri({ agbCode: "C10016.30.40", priceCents: 11185, dimension: "80 (35-45)", category: "CILINDRI" }),
  // FERRAMENTA PER IMPOSTE (8)
  imposte({ agbCode: "H00900.01.93", priceCents: 389, finish: "Black Powerage", dimension: "1000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.02.93", priceCents: 439, finish: "Black Powerage", dimension: "1200", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.03.93", priceCents: 503, finish: "Black Powerage", dimension: "1400", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.04.93", priceCents: 551, finish: "Black Powerage", dimension: "1600", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.05.93", priceCents: 604, finish: "Black Powerage", dimension: "1800", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.06.93", priceCents: 673, finish: "Black Powerage", dimension: "2000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.01.21", priceCents: 419, finish: "Silver Powerage", dimension: "1000", category: "FERRAMENTA PER IMPOSTE" }),
  imposte({ agbCode: "H00900.02.21", priceCents: 473, finish: "Silver Powerage", dimension: "1200", category: "FERRAMENTA PER IMPOSTE" }),
  // MULTIPUNTO (8) — dimensione = entrata; altezza in attributes
  multipunto({ agbCode: "W11200.35.12", priceCents: 13357, dimension: "35", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.40.12", priceCents: 13357, dimension: "40", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.45.12", priceCents: 13357, dimension: "45", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.50.12", priceCents: 13357, dimension: "50", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.55.12", priceCents: 13357, dimension: "55", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.60.12", priceCents: 13357, dimension: "60", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.70.12", priceCents: 13357, dimension: "70", attributes: { altezza: "2200 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
  multipunto({ agbCode: "W11200.35.13", priceCents: 13357, dimension: "35", attributes: { altezza: "2400 mm", "punti chiusura": "2P" }, category: "MULTIPUNTO" }),
];

export function seedCatalog(db: PrismaClient): Promise<ImportReport> {
  return upsertCatalog(db, SEED_ROWS);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isDirectRun) {
  const db = new PrismaClient();
  seedCatalog(db)
    .then((report) =>
      console.log(`✓ Seed catalogo: ${report.products} prodotti, ${report.categories} categorie`),
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void db.$disconnect());
}
```

In `package.json`, dopo `"db:seed"`:

```json
    "db:seed:catalog": "tsx prisma/seed-catalog.ts",
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test prisma/seed-catalog.test.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Prova sul DB locale (Docker attivo)**

```bash
bash scripts/dev-bootstrap.sh   # se Postgres non gira già
set -a; source .env; set +a
pnpm db:seed:catalog
```
Expected: `✓ Seed catalogo: 50 prodotti, 6 categorie`
Ripetere il comando: stesso output (idempotente).

- [ ] **Step 6: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add prisma/seed-catalog.ts prisma/seed-catalog.test.ts package.json
git commit -m "feat(catalog): seed sintetico con 50 prodotti reali dal listino 2026"
```

---

### Task 7: EmbeddingService (interfaccia + Gemini differito + Fake)

**Files:**
- Create: `src/server/ai/embedding.ts`
- Test: `src/server/ai/embedding.test.ts`

**Interfaces:**
- Consumes: `EMBEDDING_DIM`, `EMBEDDING_MODEL` da `src/server/constants/embedding.ts`.
- Produces: `interface EmbeddingService { generate(text: string): Promise<number[]> }` · `l2Normalize(vector: number[]): number[]` · `GeminiEmbeddingService` (NON cablata nel runtime) · `FakeEmbeddingService` (per i test del ramo vettoriale, Task 8).

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
// src/server/ai/embedding.test.ts
import { describe, it, expect, vi } from "vitest";
import { EMBEDDING_DIM } from "@/server/constants/embedding";
import { FakeEmbeddingService, GeminiEmbeddingService, l2Normalize } from "./embedding";

describe("l2Normalize", () => {
  it("normalizza a norma unitaria", () => {
    const v = l2Normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
  });
  it("rifiuta il vettore nullo", () => {
    expect(() => l2Normalize([0, 0])).toThrow();
  });
});

describe("FakeEmbeddingService", () => {
  it("genera vettori deterministici a 768 dimensioni, normalizzati", async () => {
    const service = new FakeEmbeddingService();
    const a = await service.generate("cerniere");
    const b = await service.generate("cerniere");
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });
});

describe("GeminiEmbeddingService", () => {
  const values = Array.from({ length: EMBEDDING_DIM }, () => 0.5);

  it("chiama embedContent con taskType/outputDimensionality e normalizza la risposta", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values } }),
    });
    const service = new GeminiEmbeddingService("test-key", "RETRIEVAL_QUERY", fetchMock as never);
    const vector = await service.generate("maniglia");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-embedding-001:embedContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIM,
      content: { parts: [{ text: "maniglia" }] },
    });
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1); // 768 dim NON sono pre-normalizzate da Gemini
  });

  it("rifiuta risposte con dimensione errata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: [1, 2, 3] } }),
    });
    const service = new GeminiEmbeddingService("k", "RETRIEVAL_QUERY", fetchMock as never);
    await expect(service.generate("x")).rejects.toThrow(/768/);
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/ai/embedding.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa**

```ts
// src/server/ai/embedding.ts
import "server-only";
import { EMBEDDING_DIM, EMBEDDING_MODEL } from "@/server/constants/embedding";

/** Contratto unico per gli embedding: vettore L2-normalizzato di EMBEDDING_DIM. */
export interface EmbeddingService {
  generate(text: string): Promise<number[]>;
}

export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) throw new Error("Vettore nullo: impossibile normalizzare");
  return vector.map((value) => value / norm);
}

type GeminiTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Client Gemini embedContent. In Fase 1b NON è cablato nel runtime (manca la
 * GEMINI_API_KEY e la coda BullMQ): il RAGEngine senza EmbeddingService degrada
 * al solo tsvector. Si attiverà in Fase ≥1c dietro coda.
 */
export class GeminiEmbeddingService implements EmbeddingService {
  constructor(
    private readonly apiKey: string,
    private readonly taskType: GeminiTaskType = "RETRIEVAL_QUERY",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(text: string): Promise<number[]> {
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType: this.taskType,
          outputDimensionality: EMBEDDING_DIM,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini embedContent fallito: HTTP ${response.status}`);
    }
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    const values = payload.embedding?.values;
    if (!values || values.length !== EMBEDDING_DIM) {
      throw new Error(
        `Embedding non valido: attese ${EMBEDDING_DIM} dimensioni, ricevute ${values?.length ?? 0}`,
      );
    }
    return l2Normalize(values); // le uscite ≠3072 non sono pre-normalizzate
  }
}

/** Embedding deterministico per i test del ramo vettoriale. MAI in produzione. */
export class FakeEmbeddingService implements EmbeddingService {
  async generate(text: string): Promise<number[]> {
    const vector = Array.from({ length: EMBEDDING_DIM }, (_, i) => {
      let h = i + 1;
      for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1000;
      return (h + 1) / 1000;
    });
    return l2Normalize(vector);
  }
}
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/ai/embedding.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/ai/
git commit -m "feat(ai): EmbeddingService (interfaccia, Gemini differito, fake deterministico)"
```

---

### Task 8: RAGEngine — ricerca ibrida con degradazione graceful (unit)

**Files:**
- Create: `src/server/ai/rag.ts`
- Test: `src/server/ai/rag.test.ts`

**Interfaces:**
- Consumes: `EmbeddingService` (Task 7); tabelle `products`/`product_categories` + trigger tsvector (migration 1a).
- Produces: `class RAGEngine { constructor(db, embeddings?); search(query, filters?, options?): Promise<SearchResult>; getRelated(productId, limit?): Promise<RelatedHit[]> }` · tipi `SearchFilters`, `SearchHit`, `SearchResult`, `RelatedHit` (usati da Task 10–13).

**QUESTO È L'UNICO MODULO CON RAW SQL DELL'INTERA APP.**

- [ ] **Step 1: Scrivi i test che falliscono**

`Prisma.Sql` (sql-template-tag) espone `.sql` (testo con `?`) e `.values` (parametri): i test ispezionano la query catturata dallo stub.

```ts
// src/server/ai/rag.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import { FakeEmbeddingService } from "./embedding";
import { RAGEngine } from "./rag";

const queryRaw = vi.fn();
const db = { $queryRaw: queryRaw } as never;

const hit = {
  id: "p1", agbCode: "E10073.10.16", name: "COMPACT Nichelato opaco DX",
  shortDescription: "Cerniere · Per porte a filo · ACCIAIO", basePrice: 51.59,
  priceUnit: "EUR", isAvailable: true, stockQuantity: 0,
  categoryId: "c1", categoryName: "Cerniere", textScore: 0.6, vectorScore: 0, score: 0.6,
};

beforeEach(() => {
  queryRaw.mockReset();
  queryRaw.mockResolvedValueOnce([hit]).mockResolvedValueOnce([{ total: 1 }]);
});

const sqlOf = (call: unknown[]): Prisma.Sql => call[0] as Prisma.Sql;

describe("RAGEngine.search — degradazione tsvector-only", () => {
  it("senza EmbeddingService usa SOLO il ramo tsvector (mai <=>)", async () => {
    const engine = new RAGEngine(db);
    const result = await engine.search("cerniera");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("plainto_tsquery");
    expect(query.sql).toContain("'italian'");
    expect(query.sql).not.toContain("<=>");
    expect(query.values).toContain("cerniera");
    expect(result.hits).toEqual([hit]);
    expect(result.total).toBe(1);
    expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("boost del match per prefisso codice (ILIKE 'query%')", async () => {
    await new RAGEngine(db).search("B00590");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("ILIKE");
    expect(query.values).toContain("B00590%");
  });

  it("applica i filtri in modo parametrizzato (mai interpolati nella stringa)", async () => {
    await new RAGEngine(db).search("cerniera", {
      categoryId: "c1", priceMin: 10, priceMax: 100, material: "acciaio", inStockOnly: true,
    });
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("category_id");
    expect(query.sql).toContain("base_price");
    expect(query.sql).toContain("specifications");
    expect(query.sql).toContain("is_available");
    expect(query.values).toEqual(expect.arrayContaining(["c1", 10, 100, "%acciaio%"]));
    expect(query.sql).not.toContain("acciaio"); // il valore vive nei parametri
  });

  it("rispetta limit e offset", async () => {
    await new RAGEngine(db).search("x", {}, { limit: 12, offset: 24 });
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.values).toEqual(expect.arrayContaining([12, 24]));
  });
});

describe("RAGEngine.search — ramo ibrido", () => {
  it("con EmbeddingService combina tsvector e vettori (pesi 0.4/0.6)", async () => {
    const engine = new RAGEngine(db, new FakeEmbeddingService());
    await engine.search("maniglia cremonese");
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("<=>");
    expect(query.sql).toContain("FULL OUTER JOIN");
    expect(query.sql).toContain("0.4");
    expect(query.sql).toContain("0.6");
    // Il vettore è passato come parametro '[v1,v2,…]'::vector, mai interpolato.
    expect(query.values.some((v) => typeof v === "string" && v.startsWith("["))).toBe(true);
  });
});

describe("RAGEngine.getRelated", () => {
  it("cerca nella stessa categoria escludendo il prodotto sorgente", async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValueOnce([]);
    await new RAGEngine(db).getRelated("p1", 4);
    const query = sqlOf(queryRaw.mock.calls[0]!);
    expect(query.sql).toContain("category_id");
    expect(query.sql).toContain("<>");
    expect(query.values).toEqual(expect.arrayContaining(["p1", 4]));
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/ai/rag.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa il RAGEngine**

```ts
// src/server/ai/rag.ts
import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { EmbeddingService } from "./embedding";

export interface SearchFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  agbCode: string;
  name: string;
  shortDescription: string | null;
  basePrice: number;
  priceUnit: string;
  isAvailable: boolean;
  stockQuantity: number;
  categoryId: string;
  categoryName: string;
  textScore: number;
  vectorScore: number;
  score: number;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  queryTimeMs: number;
}

export interface RelatedHit {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  categoryName: string;
  isAvailable: boolean;
}

type RagDb = Pick<PrismaClient, "$queryRaw">;

const HIT_PROJECTION = Prisma.sql`
  p.id,
  p.agb_code            AS "agbCode",
  p.name,
  p.short_description   AS "shortDescription",
  p.base_price::float8  AS "basePrice",
  p.price_unit          AS "priceUnit",
  p.is_available        AS "isAvailable",
  p.stock_quantity      AS "stockQuantity",
  p.category_id         AS "categoryId",
  c.name                AS "categoryName"`;

function buildFilterSql(filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.categoryId) conditions.push(Prisma.sql`p.category_id = ${filters.categoryId}`);
  if (filters.priceMin !== undefined) conditions.push(Prisma.sql`p.base_price >= ${filters.priceMin}`);
  if (filters.priceMax !== undefined) conditions.push(Prisma.sql`p.base_price <= ${filters.priceMax}`);
  if (filters.material) {
    conditions.push(Prisma.sql`p.specifications->>'materiale' ILIKE ${"%" + filters.material + "%"}`);
  }
  if (filters.inStockOnly) conditions.push(Prisma.sql`p.is_available = true`);
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`AND ${Prisma.join(conditions, " AND ")}`;
}

/**
 * UNICO modulo dell'app autorizzato al raw SQL (regola di progetto): pgvector e
 * tsvector non sono esprimibili in Prisma Client. Tutto parametrizzato via
 * Prisma.sql — MAI interpolazione di stringhe.
 *
 * Degradazione graceful: senza EmbeddingService la ricerca usa solo il ramo
 * tsvector; con embeddings combina i punteggi (0.4 testo, 0.6 vettore).
 */
export class RAGEngine {
  constructor(
    private readonly db: RagDb,
    private readonly embeddings?: EmbeddingService,
  ) {}

  async search(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    const startedAt = performance.now();
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const filterSql = buildFilterSql(filters);
    const codePrefix = query + "%";

    const embedding = this.embeddings ? await this.embeddings.generate(query) : null;
    const hits = embedding
      ? await this.hybridSearch(query, codePrefix, embedding, filterSql, limit, offset)
      : await this.textSearch(query, codePrefix, filterSql, limit, offset);

    // total = match del ramo testuale (il ramo vettoriale integra solo il ranking).
    const totalRows = await this.db.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS total
      FROM products p
      WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
             OR p.agb_code ILIKE ${codePrefix})
        ${filterSql}`);

    return {
      hits,
      total: totalRows[0]?.total ?? 0,
      queryTimeMs: Math.round(performance.now() - startedAt),
    };
  }

  private textSearch(
    query: string,
    codePrefix: string,
    filterSql: Prisma.Sql,
    limit: number,
    offset: number,
  ): Promise<SearchHit[]> {
    return this.db.$queryRaw<SearchHit[]>(Prisma.sql`
      SELECT ${HIT_PROJECTION},
        ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 AS "textScore",
        0::float8 AS "vectorScore",
        (CASE WHEN p.agb_code ILIKE ${codePrefix} THEN 1.0 ELSE 0.0 END
          + ts_rank(p.search_vector, plainto_tsquery('italian', ${query})))::float8 AS score
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      WHERE (p.search_vector @@ plainto_tsquery('italian', ${query})
             OR p.agb_code ILIKE ${codePrefix})
        ${filterSql}
      ORDER BY score DESC, p.agb_code ASC
      LIMIT ${limit} OFFSET ${offset}`);
  }

  private hybridSearch(
    query: string,
    codePrefix: string,
    embedding: number[],
    filterSql: Prisma.Sql,
    limit: number,
    offset: number,
  ): Promise<SearchHit[]> {
    const vectorParam = `[${embedding.join(",")}]`;
    return this.db.$queryRaw<SearchHit[]>(Prisma.sql`
      WITH text_hits AS (
        SELECT p.id,
               ts_rank(p.search_vector, plainto_tsquery('italian', ${query}))::float8 AS text_score
        FROM products p
        WHERE p.search_vector @@ plainto_tsquery('italian', ${query})
           OR p.agb_code ILIKE ${codePrefix}
      ),
      vector_hits AS (
        SELECT p.id, (1 - (p.embedding <=> ${vectorParam}::vector))::float8 AS vector_score
        FROM products p
        WHERE p.embedding IS NOT NULL
        ORDER BY p.embedding <=> ${vectorParam}::vector
        LIMIT 100
      ),
      combined AS (
        SELECT COALESCE(t.id, v.id)          AS id,
               COALESCE(t.text_score, 0)     AS text_score,
               COALESCE(v.vector_score, 0)   AS vector_score
        FROM text_hits t
        FULL OUTER JOIN vector_hits v ON v.id = t.id
      )
      SELECT ${HIT_PROJECTION},
        combined.text_score   AS "textScore",
        combined.vector_score AS "vectorScore",
        (CASE WHEN p.agb_code ILIKE ${codePrefix} THEN 1.0 ELSE 0.0 END
          + 0.4 * combined.text_score + 0.6 * combined.vector_score)::float8 AS score
      FROM combined
      JOIN products p ON p.id = combined.id
      JOIN product_categories c ON c.id = p.category_id
      WHERE TRUE ${filterSql}
      ORDER BY score DESC, p.agb_code ASC
      LIMIT ${limit} OFFSET ${offset}`);
  }

  /** Prodotti correlati: stessa categoria; ordina per similarità coseno se gli embedding esistono. */
  getRelated(productId: string, limit = 4): Promise<RelatedHit[]> {
    return this.db.$queryRaw<RelatedHit[]>(Prisma.sql`
      SELECT p.id,
             p.agb_code           AS "agbCode",
             p.name,
             p.base_price::float8 AS "basePrice",
             c.name               AS "categoryName",
             p.is_available       AS "isAvailable"
      FROM products src
      JOIN products p ON p.category_id = src.category_id AND p.id <> src.id
      JOIN product_categories c ON c.id = p.category_id
      WHERE src.id = ${productId}
      ORDER BY (CASE WHEN src.embedding IS NOT NULL AND p.embedding IS NOT NULL
                     THEN p.embedding <=> src.embedding END) ASC NULLS LAST,
               p.name ASC
      LIMIT ${limit}`);
  }
}
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/ai/rag.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/ai/
git commit -m "feat(ai): RAGEngine con hybrid search e degradazione tsvector-only"
```

---

### Task 9: RAGEngine — test di integrazione su DB Docker (gated)

**Files:**
- Test: `src/server/ai/rag.integration.test.ts`

**Interfaces:**
- Consumes: `RAGEngine` (Task 8), `seedCatalog`/`SEED_ROWS` (Task 6), DB Postgres+pgvector migrato (Docker).
- Produces: prova end-to-end che la degradazione tsvector funziona su un DB reale.

- [ ] **Step 1: Scrivi il test (gated su env)**

Il test gira SOLO con `INTEGRATION_DATABASE_URL` settata; nel run normale è skippato (vitest imposta un `DATABASE_URL` finto).

```ts
// src/server/ai/rag.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedCatalog } from "../../../prisma/seed-catalog";
import { RAGEngine } from "./rag";

const url = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(url))("RAGEngine — integrazione su Postgres/pgvector", () => {
  let db: PrismaClient;
  let engine: RAGEngine;

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url });
    await seedCatalog(db);
    engine = new RAGEngine(db); // niente embeddings: ramo tsvector
  }, 30_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("trova le cerniere cercando 'cerniera' (stemming italiano su shortDescription)", async () => {
    const result = await engine.search("cerniera");
    expect(result.total).toBeGreaterThan(0);
    expect(result.hits.some((h) => h.categoryName === "Cerniere")).toBe(true);
    expect(result.hits[0]!.vectorScore).toBe(0);
    expect(result.queryTimeMs).toBeLessThan(1000);
  });

  it("trova per prefisso codice AGB", async () => {
    const result = await engine.search("B00590");
    expect(result.total).toBe(5);
    expect(result.hits.every((h) => h.agbCode.startsWith("B00590"))).toBe(true);
  });

  it("filtra per categoria", async () => {
    const all = await engine.search("lucido");
    const cerniereId = all.hits.find((h) => h.categoryName === "Cerniere")?.categoryId;
    expect(cerniereId).toBeDefined();
    const filtered = await engine.search("lucido", { categoryId: cerniereId });
    expect(filtered.hits.length).toBeGreaterThan(0);
    expect(filtered.hits.every((h) => h.categoryId === cerniereId)).toBe(true);
  });

  it("getRelated restituisce prodotti della stessa categoria, escluso il sorgente", async () => {
    const search = await engine.search("B00590.15.03");
    const source = search.hits[0]!;
    const related = await engine.getRelated(source.id, 4);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((r) => r.id !== source.id)).toBe(true);
    expect(related.every((r) => r.categoryName === source.categoryName)).toBe(true);
  });
});
```

- [ ] **Step 2: Verifica lo skip senza env**

Run: `pnpm test src/server/ai/rag.integration.test.ts`
Expected: skipped (0 test eseguiti), exit 0

- [ ] **Step 3: Esegui contro il DB Docker**

```bash
bash scripts/dev-bootstrap.sh          # daemon Docker + Postgres/Redis + migrate + seed
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm test src/server/ai/rag.integration.test.ts
```
Expected: PASS (4 test). Se fallisce lo stemming o il boost, indaga con superpowers:systematic-debugging prima di toccare il codice.

- [ ] **Step 4: Commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/ai/rag.integration.test.ts
git commit -m "test(ai): integrazione RAGEngine su Postgres/pgvector (gated su env)"
```

---

### Task 10: Product router tRPC

**Files:**
- Create: `src/server/api/routers/product.ts`
- Modify: `src/server/api/root.ts`
- Test: `src/server/api/routers/product.test.ts`

**Interfaces:**
- Consumes: `RAGEngine` (Task 8), procedure `agentProcedure`/`publicProcedure` (`src/server/api/trpc.ts`).
- Produces: `productRouter` con `search`, `getById`, `getByCode`, `listCategories`, `getRelated` — client: `api.product.*` (Task 11–13). `search` ritorna `SearchResult`; `getById`/`getByCode` ritornano il prodotto con `category` inclusa e Decimal→number.

- [ ] **Step 1: Scrivi i test che falliscono**

Stesso pattern di `user.test.ts` (caller factory + ctx stub):

```ts
// src/server/api/routers/product.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const appRouter = createTRPCRouter({ product: productRouter });

const queryRaw = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();
const createLog = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      $queryRaw: queryRaw,
      product: { findUnique },
      productCategory: { findMany },
      activityLog: { create: createLog },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  queryRaw.mockReset();
  findUnique.mockReset();
  findMany.mockReset();
  createLog.mockReset();
});

describe("product.search", () => {
  it("richiede autenticazione (UNAUTHORIZED senza sessione)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.product.search({ query: "cerniera" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("valida la query (stringa vuota → BAD_REQUEST)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.product.search({ query: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("ritorna i risultati e logga PRODUCT_SEARCHED", async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    createLog.mockResolvedValue({});
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const result = await caller.product.search({ query: "cerniera" });
    expect(result).toMatchObject({ hits: [], total: 0 });
    expect(createLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "agent1",
        type: "PRODUCT_SEARCHED",
        metadata: expect.objectContaining({ query: "cerniera", results: 0 }),
      }),
    });
  });
});

describe("product.getById / getByCode", () => {
  it("NOT_FOUND per id inesistente", async () => {
    findUnique.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.product.getById({ id: "manca" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("converte i Decimal in number (serializzabile da superjson)", async () => {
    findUnique.mockResolvedValue({
      id: "p1", agbCode: "B00590.15.03", name: "X",
      basePrice: { toString: () => "1.23" }, discountedPrice: null, weightKg: null,
      category: { id: "c1", name: "Serrature", slug: "serrature" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const product = await caller.product.getByCode({ agbCode: "B00590.15.03" });
    expect(product.basePrice).toBe(1.23);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { agbCode: "B00590.15.03" } }),
    );
  });
});

describe("product.listCategories", () => {
  it("è pubblica e di default lista le categorie radice", async () => {
    findMany.mockResolvedValue([{ id: "c1", name: "Cerniere", slug: "cerniere", parentId: null }]);
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    const categories = await caller.product.listCategories();
    expect(categories).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentId: null }, orderBy: { name: "asc" } }),
    );
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/server/api/routers/product.test.ts`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa il router e registralo**

```ts
// src/server/api/routers/product.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { RAGEngine } from "@/server/ai/rag";

const searchFiltersInput = z.object({
  categoryId: z.string().min(1).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  material: z.string().min(1).max(50).optional(),
  inStockOnly: z.boolean().optional(),
});

const searchInput = z.object({
  query: z.string().trim().min(1, "Inserisci un termine di ricerca").max(200),
  filters: searchFiltersInput.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

/** Prisma Decimal → number: superjson non serializza Decimal. */
function serializeProduct<
  T extends { basePrice: unknown; discountedPrice: unknown; weightKg: unknown },
>(product: T) {
  return {
    ...product,
    basePrice: Number(product.basePrice),
    discountedPrice: product.discountedPrice === null ? null : Number(product.discountedPrice),
    weightKg: product.weightKg === null ? null : Number(product.weightKg),
  };
}

export const productRouter = createTRPCRouter({
  /** Ricerca ibrida nel catalogo (Fase 1b: solo tsvector — nessun EmbeddingService). */
  search: agentProcedure.input(searchInput).query(async ({ ctx, input }) => {
    const engine = new RAGEngine(ctx.db);
    const result = await engine.search(input.query, input.filters ?? {}, {
      limit: input.limit,
      offset: input.offset,
    });
    await ctx.db.activityLog.create({
      data: {
        userId: ctx.session.user.id,
        type: "PRODUCT_SEARCHED",
        description: `Ricerca prodotti: "${input.query}"`,
        metadata: {
          query: input.query,
          filters: input.filters ?? {},
          results: result.hits.length,
          queryTimeMs: result.queryTimeMs,
        },
      },
    });
    return result;
  }),

  getById: agentProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.id },
        include: { category: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Prodotto non trovato." });
      return serializeProduct(product);
    }),

  getByCode: agentProcedure
    .input(z.object({ agbCode: z.string().min(1).max(20) }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { agbCode: input.agbCode },
        include: { category: true },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Prodotto non trovato." });
      return serializeProduct(product);
    }),

  listCategories: publicProcedure
    .input(z.object({ parentId: z.string().nullish() }).optional())
    .query(({ ctx, input }) =>
      ctx.db.productCategory.findMany({
        where: { parentId: input?.parentId ?? null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, parentId: true },
      }),
    ),

  getRelated: agentProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        limit: z.number().int().min(1).max(12).default(4),
      }),
    )
    .query(({ ctx, input }) => new RAGEngine(ctx.db).getRelated(input.productId, input.limit)),
});
```

In `src/server/api/root.ts`:

```ts
import { createTRPCRouter } from "@/server/api/trpc";
import { healthRouter } from "@/server/api/routers/health";
import { authRouter } from "@/server/api/routers/auth";
import { userRouter } from "@/server/api/routers/user";
import { productRouter } from "@/server/api/routers/product";

/** Root tRPC router. Add feature routers here as the app grows. */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  user: userRouter,
  product: productRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/server/api/routers/product.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/server/api/
git commit -m "feat(api): product router (search RAG, getById/Code, categorie, correlati)"
```

---

### Task 11: UI — helper e componenti prodotto

**REQUIRED SUB-SKILL all'esecuzione: `impeccable`** (vale anche per Task 12 e 13).

**Files:**
- Create: `src/lib/format.ts` · `src/lib/use-debounced-value.ts`
- Create: `src/components/product/product-card.tsx` · `src/components/product/product-row.tsx`
- Test: `src/lib/format.test.ts` · `src/components/product/product-card.test.tsx`

**Interfaces:**
- Consumes: token di design (tailwind.config.ts), `cn` (`@/lib/utils`).
- Produces: `formatPrice(value: number): string` · `useDebouncedValue<T>(value: T, delayMs?: number): T` · `ProductCard({ product: ProductSummary })` · `ProductRow({ product: ProductSummary })` · `type ProductSummary = { id; agbCode; name; basePrice; categoryName; isAvailable }` (Task 12–13).

- [ ] **Step 1: Scrivi i test che falliscono**

```ts
// src/lib/format.test.ts
import { describe, it, expect } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formatta in EUR it-IT", () => {
    // NBSP/narrow-NBSP normalizzati per stabilità cross-ICU.
    expect(formatPrice(1.23).replace(/[  ]/g, " ")).toBe("1,23 €");
    expect(formatPrice(13357 / 100).replace(/[  ]/g, " ")).toBe("133,57 €");
  });
});
```

```tsx
// src/components/product/product-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductCard } from "./product-card";

afterEach(cleanup);

const product = {
  id: "p1",
  agbCode: "B00590.15.03",
  name: "Larghezza 22 mm Ottonato lucido 238 mm",
  basePrice: 1.23,
  categoryName: "Serrature",
  isAvailable: true,
};

describe("ProductCard", () => {
  it("mostra il codice AGB in monospace (regola di progetto)", () => {
    render(<ProductCard product={product} />);
    const code = screen.getByText("B00590.15.03");
    expect(code.className).toContain("font-mono");
  });

  it("linka al dettaglio e mostra nome, categoria e prezzo", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole("link")).toHaveProperty(
      "href",
      expect.stringContaining("/archivio/p1"),
    );
    expect(screen.getByText(product.name)).toBeDefined();
    expect(screen.getByText("Serrature")).toBeDefined();
    expect(screen.getByText(/1,23/)).toBeDefined();
  });

  it("espone lo stato di disponibilità in modo accessibile", () => {
    render(<ProductCard product={{ ...product, isAvailable: false }} />);
    expect(screen.getByLabelText("Non disponibile")).toBeDefined();
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/lib/format.test.ts src/components/product/product-card.test.tsx`
Expected: FAIL — moduli inesistenti

- [ ] **Step 3: Implementa**

```ts
// src/lib/format.ts
const priceFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}
```

```ts
// src/lib/use-debounced-value.ts
"use client";

import { useEffect, useState } from "react";

/** Ritarda la propagazione di un valore (es. query di ricerca → richieste tRPC). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

```tsx
// src/components/product/product-card.tsx
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ProductSummary {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  categoryName: string;
  isAvailable: boolean;
}

export function AvailabilityDot({ available }: { available: boolean }) {
  return (
    <span
      role="img"
      aria-label={available ? "Disponibile" : "Non disponibile"}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        available ? "bg-success" : "bg-line-strong",
      )}
    />
  );
}

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="group flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card transition-shadow duration-150 ease-out-quart hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
        <AvailabilityDot available={product.isAvailable} />
      </div>
      <h3 className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-brand">
        {product.name}
      </h3>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
          {product.categoryName}
        </span>
        <span className="text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</span>
      </div>
    </Link>
  );
}
```

```tsx
// src/components/product/product-row.tsx
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, type ProductSummary } from "./product-card";

export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line bg-surface px-4 py-3 transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:grid-cols-[140px_1fr_auto_auto_auto]"
    >
      <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
      <span className="truncate text-sm font-medium text-ink">{product.name}</span>
      <span className="hidden rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted sm:inline">
        {product.categoryName}
      </span>
      <AvailabilityDot available={product.isAvailable} />
      <span className="text-sm font-semibold text-ink">{formatPrice(product.basePrice)}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Verifica che passi**

Run: `pnpm test src/lib/format.test.ts src/components/product/product-card.test.tsx`
Expected: PASS (5 test)

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add src/lib/format.ts src/lib/format.test.ts src/lib/use-debounced-value.ts src/components/product/
git commit -m "feat(ui): formatPrice, useDebouncedValue, ProductCard/ProductRow"
```

---

### Task 12: UI — pagina Archivio (ricerca, filtri, griglia/lista, paginazione)

**REQUIRED SUB-SKILL all'esecuzione: `impeccable`.**

**Files:**
- Create: `src/app/(dashboard)/archivio/page.tsx`
- Create: `src/app/(dashboard)/archivio/archivio-client.tsx`
- Create: `src/components/product/product-filters.tsx`

**Interfaces:**
- Consumes: `api.product.search` / `api.product.listCategories` (Task 10), `ProductCard`/`ProductRow`/`useDebouncedValue`/`formatPrice` (Task 11), `Input` (`@/components/ui/input`, supporta `leadingIcon`), `Button`.
- Produces: rotta `/archivio` funzionante (la voce sidebar esiste già da 1a). `type ArchivioFilters = { categoryId?: string; priceMin?: number; priceMax?: number; material?: string; inStockOnly?: boolean }`.

- [ ] **Step 1: Implementa i filtri**

```tsx
// src/components/product/product-filters.tsx
"use client";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";

export interface ArchivioFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

const inputClass =
  "h-9 w-full rounded border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

export function ProductFilters({
  filters,
  onChange,
}: {
  filters: ArchivioFilters;
  onChange: (filters: ArchivioFilters) => void;
}) {
  const categories = api.product.listCategories.useQuery();
  const hasActive = Object.values(filters).some((v) => v !== undefined);

  const set = (patch: Partial<ArchivioFilters>) => onChange({ ...filters, ...patch });
  const numberOrUndefined = (raw: string) => (raw === "" ? undefined : Number(raw));

  return (
    <aside aria-label="Filtri di ricerca" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        Categoria
        <select
          className={inputClass}
          value={filters.categoryId ?? ""}
          onChange={(e) => set({ categoryId: e.target.value || undefined })}
        >
          <option value="">Tutte le categorie</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium text-ink-muted">Prezzo (€)</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Min"
            aria-label="Prezzo minimo"
            className={inputClass}
            value={filters.priceMin ?? ""}
            onChange={(e) => set({ priceMin: numberOrUndefined(e.target.value) })}
          />
          <span className="text-ink-subtle">–</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Max"
            aria-label="Prezzo massimo"
            className={inputClass}
            value={filters.priceMax ?? ""}
            onChange={(e) => set({ priceMax: numberOrUndefined(e.target.value) })}
          />
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-muted">
        Materiale
        <input
          type="text"
          placeholder="es. acciaio"
          className={inputClass}
          value={filters.material ?? ""}
          onChange={(e) => set({ material: e.target.value || undefined })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          checked={filters.inStockOnly ?? false}
          onChange={(e) => set({ inStockOnly: e.target.checked || undefined })}
        />
        Solo disponibili
      </label>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          Azzera filtri
        </Button>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Implementa pagina + client**

```tsx
// src/app/(dashboard)/archivio/page.tsx
import type { Metadata } from "next";
import { ArchivioClient } from "./archivio-client";

export const metadata: Metadata = { title: "Archivio — UFPtrade" };

export default function ArchivioPage() {
  return <ArchivioClient />;
}
```

```tsx
// src/app/(dashboard)/archivio/archivio-client.tsx
"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { LayoutGrid, List, PackageSearch, Search } from "lucide-react";
import { api } from "@/trpc/react";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product/product-card";
import { ProductRow } from "@/components/product/product-row";
import { ProductFilters, type ArchivioFilters } from "@/components/product/product-filters";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export function ArchivioClient() {
  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<ArchivioFilters>({});
  const [view, setView] = useState<"grid" | "list">("grid");
  const [offset, setOffset] = useState(0);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const setFilters = (next: ArchivioFilters) => {
    setFiltersState(next);
    setOffset(0);
  };

  const search = api.product.search.useQuery(
    { query: debouncedQuery, filters, limit: PAGE_SIZE, offset },
    { enabled: debouncedQuery.length > 0, placeholderData: keepPreviousData },
  );

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Archivio prodotti</h1>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="search"
              aria-label="Cerca nel catalogo"
              placeholder="Cerca per nome, categoria o codice AGB…"
              leadingIcon={<Search className="size-4" aria-hidden />}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div className="flex rounded border border-line-strong" role="group" aria-label="Vista">
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Vista griglia"
              onClick={() => setView("grid")}
              className={cn("rounded-l p-2.5", view === "grid" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken")}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="Vista lista"
              onClick={() => setView("list")}
              className={cn("rounded-r p-2.5", view === "list" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken")}
            >
              <List className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <ProductFilters filters={filters} onChange={setFilters} />

        <section aria-label="Risultati" aria-busy={search.isFetching} className="flex flex-col gap-4">
          {debouncedQuery.length === 0 ? (
            <EmptyState
              title="Cerca nel catalogo AGB"
              detail="Digita un termine (es. “cerniera anta ribalta”) o un codice prodotto."
            />
          ) : search.isPending ? (
            <SkeletonGrid />
          ) : search.isError ? (
            <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              Errore durante la ricerca. Riprova tra qualche istante.
            </div>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nessun risultato"
              detail={`Nessun prodotto trovato per “${debouncedQuery}”. Prova con un termine diverso o rimuovi i filtri.`}
            />
          ) : (
            <>
              <p className="text-sm text-ink-subtle" aria-live="polite">
                {total} {total === 1 ? "prodotto trovato" : "prodotti trovati"}
                {search.data ? ` · ${search.data.queryTimeMs} ms` : null}
              </p>
              {view === "grid" ? (
                <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <ProductCard product={hit} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="overflow-hidden rounded-md border border-line">
                  {hits.map((hit) => (
                    <ProductRow key={hit.id} product={hit} />
                  ))}
                </div>
              )}
              <Pagination offset={offset} total={total} onChange={setOffset} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong bg-surface p-10 text-center">
      <PackageSearch className="size-8 text-ink-subtle" aria-hidden />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-subtle">{detail}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="h-32 animate-pulse rounded-md border border-line bg-surface-sunken" />
      ))}
    </ul>
  );
}

function Pagination({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-4">
      <p className="text-sm text-ink-subtle">
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
        >
          Precedente
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={to >= total}
          onClick={() => onChange(offset + PAGE_SIZE)}
        >
          Successiva
        </Button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verifica manuale nel browser (superpowers:verification-before-completion)**

```bash
bash scripts/dev-bootstrap.sh   # DB su + seed
set -a; source .env; set +a
pnpm db:seed:catalog
pnpm dev
```
Login come admin seed → `/archivio` → cerca `cerniera`: compaiono le cerniere COMPACT/2R; cerca `B00590`: 5 serrature; filtro categoria/prezzo restringe; toggle lista funziona; query vuota → stato invito; termine inesistente (`zzzzz`) → stato vuoto. Codici in monospace.

- [ ] **Step 4: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add src/app src/components/product/
git commit -m "feat(ui): pagina Archivio con ricerca, filtri, griglia/lista e paginazione"
```

---

### Task 13: UI — dettaglio prodotto

**REQUIRED SUB-SKILL all'esecuzione: `impeccable`.**

**Files:**
- Create: `src/app/(dashboard)/archivio/[id]/page.tsx`
- Create: `src/components/product/product-detail.tsx`
- Create: `src/components/product/spec-table.tsx`
- Create: `src/components/product/copy-code-button.tsx`
- Test: `src/components/product/spec-table.test.tsx`

**Interfaces:**
- Consumes: `api.product.getById` / `api.product.getRelated` (Task 10), `ProductCard`/`formatPrice`/`AvailabilityDot` (Task 11).
- Produces: rotta `/archivio/[id]`. `SpecTable({ specifications: unknown })` · `CopyCodeButton({ code: string })`.

- [ ] **Step 1: Scrivi il test che fallisce**

```tsx
// src/components/product/spec-table.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SpecTable } from "./spec-table";

afterEach(cleanup);

describe("SpecTable", () => {
  it("rende le specifiche con etichette italiane e formatta la confezione", () => {
    render(
      <SpecTable
        specifications={{
          finitura: "Ottonato lucido",
          materiale: "ACCIAIO",
          confezione: { scatola: 25, cartone: 250 },
          classeSconto: "A2",
          colonne: { lunghezza: "238 mm" }, // grezzo: NON visualizzato
        }}
      />,
    );
    expect(screen.getByText("Finitura")).toBeDefined();
    expect(screen.getByText("Ottonato lucido")).toBeDefined();
    expect(screen.getByText("Confezione")).toBeDefined();
    expect(screen.getByText("25 pz/scatola · 250 pz/cartone")).toBeDefined();
    expect(screen.queryByText("colonne")).toBeNull();
    expect(screen.queryByText("lunghezza")).toBeNull();
  });

  it("non rende nulla senza specifiche", () => {
    const { container } = render(<SpecTable specifications={null} />);
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: Verifica che fallisca**

Run: `pnpm test src/components/product/spec-table.test.tsx`
Expected: FAIL — modulo inesistente

- [ ] **Step 3: Implementa i componenti**

```tsx
// src/components/product/spec-table.tsx
const SPEC_LABELS: Record<string, string> = {
  finitura: "Finitura",
  materiale: "Materiale",
  dimensione: "Dimensione",
  mano: "Mano",
  confezione: "Confezione",
  classeSconto: "Classe sconto",
  sottocategoria: "Sottocategoria",
  gruppo: "Gruppo",
};

interface Confezione {
  scatola: number | null;
  cartone: number | null;
}

function formatValue(key: string, value: unknown): string | null {
  if (key === "confezione" && value && typeof value === "object") {
    const { scatola, cartone } = value as Confezione;
    const parts = [
      scatola !== null ? `${scatola} pz/scatola` : null,
      cartone !== null ? `${cartone} pz/cartone` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  return typeof value === "string" ? value : null;
}

export function SpecTable({ specifications }: { specifications: unknown }) {
  if (!specifications || typeof specifications !== "object") return null;
  const entries = Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => key in SPEC_LABELS)
    .map(([key, value]) => [SPEC_LABELS[key]!, formatValue(key, value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
  if (entries.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-md border border-line sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 border-b border-line bg-surface p-3 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
          <dt className="text-xs font-medium text-ink-subtle">{label}</dt>
          <dd className="text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

```tsx
// src/components/product/copy-code-button.tsx
"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile: nessun feedback, il codice resta selezionabile
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Codice copiato" : `Copia codice ${code}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-line-strong px-2 py-1 font-mono text-sm transition-colors",
        copied ? "border-success/40 bg-success/10 text-success" : "text-ink hover:bg-surface-sunken",
      )}
    >
      {code}
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}
```

```tsx
// src/components/product/product-detail.tsx
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, ProductCard } from "./product-card";
import { CopyCodeButton } from "./copy-code-button";
import { SpecTable } from "./spec-table";

export function ProductDetail({ id }: { id: string }) {
  const product = api.product.getById.useQuery({ id });
  const related = api.product.getRelated.useQuery({ productId: id, limit: 4 }, { enabled: product.isSuccess });

  if (product.isPending) {
    return <div className="h-64 animate-pulse rounded-md border border-line bg-surface-sunken" aria-hidden />;
  }
  if (product.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-danger/30 bg-danger/5 p-6">
        <p className="text-sm text-danger">Prodotto non trovato o errore di caricamento.</p>
        <Link href="/archivio" className="text-sm font-medium text-brand hover:underline">
          ← Torna all&apos;archivio
        </Link>
      </div>
    );
  }

  const p = product.data;
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        href="/archivio"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-subtle transition-colors hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> Archivio
      </Link>

      <header className="flex flex-col gap-3 rounded-md border border-line bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <CopyCodeButton code={p.agbCode} />
          <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted">
            {p.category.name}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
            <AvailabilityDot available={p.isAvailable} />
            {p.isAvailable ? "Disponibile" : "Non disponibile"}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-ink">{p.name}</h1>
        {p.shortDescription && <p className="text-sm text-ink-subtle">{p.shortDescription}</p>}
        <p className="text-2xl font-semibold text-ink">{formatPrice(p.basePrice)}</p>
      </header>

      <section aria-labelledby="spec-heading" className="flex flex-col gap-3">
        <h2 id="spec-heading" className="text-sm font-semibold text-ink">
          Specifiche
        </h2>
        <SpecTable specifications={p.specifications} />
      </section>

      {related.data && related.data.length > 0 && (
        <section aria-labelledby="related-heading" className="flex flex-col gap-3">
          <h2 id="related-heading" className="text-sm font-semibold text-ink">
            Prodotti correlati
          </h2>
          <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.data.map((r) => (
              <li key={r.id}>
                <ProductCard product={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
```

```tsx
// src/app/(dashboard)/archivio/[id]/page.tsx
import type { Metadata } from "next";
import { ProductDetail } from "@/components/product/product-detail";

export const metadata: Metadata = { title: "Dettaglio prodotto — UFPtrade" };

// Next 15: params è una Promise.
export default async function ProdottoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetail id={id} />;
}
```

- [ ] **Step 4: Verifica che passi + verifica manuale**

Run: `pnpm test src/components/product/spec-table.test.tsx`
Expected: PASS (2 test)

Poi nel browser (dev server + seed attivi): da `/archivio` clic su una card → dettaglio con specifiche (Finitura/Materiale/Confezione…), copia codice funziona (icona ✓ per 2s), correlati della stessa categoria, back link. URL inesistente `/archivio/xyz` → stato d'errore con link di ritorno.

- [ ] **Step 5: Gates + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add src/app src/components/product/
git commit -m "feat(ui): pagina dettaglio prodotto (specifiche, copia codice, correlati)"
```

---

### Task 14: Import completo del listino reale + verifica + docs

**Files:**
- Modify: `README.md` (sezione import catalogo)
- Modify: `handoff.md`, `CLAUDE.md` (stato fase)

- [ ] **Step 1: Assicurati di avere il PDF**

Il PDF vive in scratchpad (gitignored, 39 MB). Se `catalog.pdf` non c'è: **chiedi il link all'utente** (regola CLAUDE.md §FILE ESTERNI — mai cercarlo sul web). Con il link Drive:

```bash
SCRATCH=/tmp/claude-0/-home-user-AGB-Finder/d9c474f1-0374-53d9-b6c4-38f920fe2664/scratchpad
curl -sSL "https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download&confirm=t" -o "$SCRATCH/catalog.pdf"
file "$SCRATCH/catalog.pdf"   # atteso: PDF document, version 1.7, 959 page(s)
```

- [ ] **Step 2: Import completo su DB locale**

```bash
bash scripts/dev-bootstrap.sh
set -a; source .env; set +a
pnpm import:agb "$SCRATCH/catalog.pdf"
```
Expected (numeri ESATTI, misurati in planning):
```
✓ Pagine: 959 · Righe con codice: 8491 · Parsed: 8217 · Skipped: 274
✓ Prodotti unici: 6191 · Categorie: 22
```
Se `parsed`/`skipped`/prodotti divergono → superpowers:systematic-debugging (NON aggiustare i numeri attesi).

- [ ] **Step 3: Verifica idempotenza e spot-check**

```bash
pnpm import:agb "$SCRATCH/catalog.pdf"   # secondo run: stessi numeri
pnpm tsx -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const p = await db.product.findUnique({ where: { agbCode: 'B00590.15.03' }, include: { category: true } });
console.log(p?.name, '|', String(p?.basePrice), '|', p?.category.name);
console.log(JSON.stringify(p?.specifications));
const count = await db.product.count();
const cats = await db.productCategory.count();
console.log('prodotti:', count, 'categorie:', cats);
await db.\$disconnect();
"
```
Expected: nome sensato con "Ottonato lucido", prezzo `1.23`, categoria `Serrature`, specifications con finitura/confezione; `prodotti: 6191`.

- [ ] **Step 4: Verifica end-to-end nel browser sul catalogo COMPLETO**

`pnpm dev` → `/archivio`: cerca "cerniere anta ribalta", "cremonese ARTECH", un codice pieno `B00590.15.03` e un prefisso `A50122` — risultati pertinenti in < 1s (`queryTimeMs` mostrato in UI). Dettaglio di un prodotto ARTECH mostra le specifiche.

- [ ] **Step 5: Aggiorna la documentazione**

- `README.md`: sezione "Import catalogo AGB" (prerequisito poppler-utils, comando `pnpm import:agb <pdf>`, regola sul PDF esterno, numeri attesi).
- `handoff.md`: Fase 1b completata (task, numeri, decisioni delta del piano), prossimo passo = Fase 1c.
- `CLAUDE.md`: STATO → "Fase 1b ✅".

- [ ] **Step 6: Gates finali + commit + push**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git add README.md handoff.md CLAUDE.md docs/
git commit -m "docs: Fase 1b completata (import catalogo reale verificato, 6191 prodotti)"
git push -u origin claude/superpowers-handoff-next-z1wyh7
```

---

## Fuori scope (fasi successive)

Generazione batch reale degli embedding via BullMQ (1c/2d) · chat AI + tool `search_products` (1c) · kit engine (1d) · catalogo pubblico (Fase 2). La colonna `embedding` resta `null`; la ricerca degrada a tsvector-only per design.
