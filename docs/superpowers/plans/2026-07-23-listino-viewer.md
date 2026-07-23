# «Visualizza nel listino» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un pulsante «visualizza nel listino» su ogni codice (componente kit o prodotto archivio) che apre un viewer PDF in-app alla pagina del listino dove il codice è a prezzo, evidenziandolo.

**Architecture:** Indice deterministico codice→pagina (parser page-aware → `Product.listinoPage`), PDF servito da Vercel Blob dietro auth (`/api/listino` con Range), viewer in-app `react-pdf` (lazy) con evidenziazione, innestato su distinta kit e archivio.

**Tech Stack:** TypeScript strict, Next.js 15 (App Router, route handler), tRPC, Prisma, `react-pdf`/`pdfjs-dist`, Vitest, Vercel Blob.

## Global Constraints

- **Deterministico, MAI LLM.** L'indice codice→pagina deriva dal parser del listino.
- **TypeScript strict** sempre. **UI in italiano**, codici in monospace.
- **Mobile-first (regola inviolabile):** il viewer va progettato e verificato responsive (≤375px); nessuna funzione nascosta/inutilizzabile su mobile.
- **Raw SQL solo in `RAGEngine`** (la modifica alla projection di ricerca sta lì).
- **Calibrazione pagina (verificata):** `pagina fisica = 1 + (conteggio form-feed \f cumulato)`. Confermato sul listino reale: la vasistas (schema pag. stampata «416») è alla **pagina fisica 418** del PDF, ed è quella che `#page=N`/`react-pdf` indirizzano.
- **Gate finali:** `pnpm typecheck · lint · test · build`.
- **Ambiente:** `set -a; source .env; set +a` prima di comandi prisma/tsx (engine locali). Migrazione hand-authored (niente DB in questo container); applicata a Neon via ops.

---

### Task 1: Colonna `Product.listinoPage` + parser page-aware + mapping

Il dato: pagina fisica per ogni codice.

**Files:**
- Modify: `prisma/schema.prisma` (model Product)
- Create: `prisma/migrations/20260723120000_add_listino_page/migration.sql`
- Modify: `src/server/catalog/parse-listino.ts`
- Test: `src/server/catalog/parse-listino.test.ts`
- Modify: `src/server/catalog/map-product.ts`
- Test: `src/server/catalog/map-product.test.ts`

**Interfaces:**
- Produces: `ParsedRow.page: number` (pagina fisica); `ProductUpsertData.listinoPage: number | null`; colonna DB `products.listino_page INTEGER`.

- [ ] **Step 1: Aggiungi la colonna allo schema Prisma**

In `prisma/schema.prisma`, model `Product`, dopo `heightMm Int? @map("height_mm")` (riga ~170) aggiungi:

```prisma
  listinoPage Int? @map("listino_page")
```

- [ ] **Step 2: Crea la migrazione (hand-authored)**

Crea `prisma/migrations/20260723120000_add_listino_page/migration.sql`:

```sql
-- AlterTable: pagina fisica del listino PDF per prodotto (feature «visualizza nel listino»)
ALTER TABLE "products" ADD COLUMN "listino_page" INTEGER;
```

- [ ] **Step 3: Rigenera il client Prisma**

Run: `set -a; source .env; set +a; pnpm prisma generate`
Expected: «Generated Prisma Client» (il tipo `Product.listinoPage: number | null` diventa disponibile).

- [ ] **Step 4: Scrivi il test del parser page-aware (fallisce)**

In `src/server/catalog/parse-listino.test.ts`, aggiungi in fondo:

```typescript
describe("parseListino — pagina fisica per riga", () => {
  it("assegna la pagina = 1 + numero di form-feed cumulati", () => {
    // pagina 1 (nessun \f), poi \f → pagina 2 con una riga prodotto reale.
    const header =
      "\f                   CERNIERE                                                                         LISTINO 2026";
    const cols =
      "  Diametro                                        CODICE                             Confezione   Imballo      €    CS";
    const rowLine = "                 E00119.14.03   20   20        3,20   F3";
    const { rows } = parseListino(["riga di pagina uno", header, cols, rowLine].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.page).toBe(2);
  });

  it("resta a pagina 1 senza form-feed", () => {
    const cols =
      "  Diametro                                        CODICE                             Confezione   Imballo      €    CS";
    const rowLine = "                 E00119.14.03   20   20        3,20   F3";
    const { rows } = parseListino([cols, rowLine].join("\n"));
    expect(rows[0]!.page).toBe(1);
  });
});
```

- [ ] **Step 5: Esegui il test — deve fallire**

Run: `pnpm test -- parse-listino`
Expected: FAIL — `page` non esiste su `ParsedRow`.

- [ ] **Step 6: Implementa il tracking pagina nel parser**

In `src/server/catalog/parse-listino.ts`:

(a) Aggiungi `page: number;` all'interfaccia `ParsedRow` (dopo `rawLine: string;`? No — mettilo dopo `agbCode`): inseriscilo subito dopo `agbCode: string;`:

```typescript
export interface ParsedRow {
  agbCode: string;
  /** Pagina FISICA del PDF (1-based) dove la riga di prezzo appare = deep-link. */
  page: number;
  priceCents: number;
```

(b) In `parseListino`, dopo `const rows: ParsedRow[] = [];` (riga ~113) aggiungi:

```typescript
  let currentPage = 1;
```

(c) All'inizio del `for (const rawLine of text.split("\n")) {` (subito dopo l'apertura del ciclo), aggiungi il conteggio dei form-feed PRIMA di processare la riga:

```typescript
  for (const rawLine of text.split("\n")) {
    const ffOnLine = (rawLine.match(/\f/g) ?? []).length;
    if (ffOnLine > 0) currentPage += ffOnLine;
    const line = rawLine.replaceAll("\f", "");
```

(d) Nell'oggetto `rows.push({ ... })` (riga ~164) aggiungi il campo `page`:

```typescript
      rows.push({
        agbCode: sig[1]!,
        page: currentPage,
        packBox: Number(sig[2]!),
```

- [ ] **Step 7: Esegui il test parser — deve passare (e non-regressione)**

Run: `pnpm test -- parse-listino`
Expected: PASS (nuovi test + tutti gli esistenti verdi; i test attuali non controllano `page`).

- [ ] **Step 8: Scrivi il test del mapping (fallisce)**

In `src/server/catalog/map-product.test.ts`, aggiungi un test che `toProductData` propaga la pagina. Prima individua un helper già usato per costruire una `ParsedRow` nei test esistenti; se non c'è, usa un literal completo. Aggiungi:

```typescript
it("toProductData porta la pagina fisica in listinoPage", () => {
  const row = {
    agbCode: "A50111.15.13", page: 418, priceCents: 889, category: "ARTECH",
    subcategory: null, groupTitle: null, material: null, finish: null, dimension: null,
    hand: null, packBox: 20, packCarton: 20, discountClass: "F3", attributes: {}, rawLine: "",
  };
  expect(toProductData(row).listinoPage).toBe(418);
});
```

(Assicurati che `toProductData` sia importato nel file di test.)

- [ ] **Step 9: Esegui — deve fallire**

Run: `pnpm test -- map-product`
Expected: FAIL — `listinoPage` non è in `ProductUpsertData`.

- [ ] **Step 10: Implementa il mapping**

In `src/server/catalog/map-product.ts`:

(a) Aggiungi a `ProductUpsertData` (dopo `categorySlug: string;`):

```typescript
  categorySlug: string;
  listinoPage: number | null;
```

(b) In `toProductData`, nell'oggetto ritornato (dopo `categorySlug: slugifyCategory(row.category),`):

```typescript
    categorySlug: slugifyCategory(row.category),
    listinoPage: row.page,
  };
```

> `upsertCatalog` (import-catalog.ts) fa `const { categorySlug, specifications, ...fields } = toProductData(row)` e passa `fields` allo `upsert`: `listinoPage` finisce automaticamente in `fields`, quindi negli import futuri il DB si popola senza altre modifiche.

- [ ] **Step 11: Esegui il test — deve passare**

Run: `pnpm test -- map-product`
Expected: PASS.

- [ ] **Step 12: typecheck + commit**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS.

```bash
git add prisma/schema.prisma prisma/migrations/20260723120000_add_listino_page \
  src/server/catalog/parse-listino.ts src/server/catalog/parse-listino.test.ts \
  src/server/catalog/map-product.ts src/server/catalog/map-product.test.ts
git commit -m "feat(listino): Product.listinoPage + parser page-aware + mapping"
```

---

### Task 2: Script di backfill delle pagine

Popola `Product.listinoPage` sui prodotti già a DB (Neon) senza re-import completo.

**Files:**
- Modify: `src/server/catalog/map-product.ts` (helper puro `collectListinoPages`)
- Test: `src/server/catalog/map-product.test.ts`
- Create: `scripts/backfill-listino-pages.ts`
- Modify: `package.json` (script `backfill:pages`)

**Interfaces:**
- Consumes: `ParsedRow.page` (Task 1), `dedupeRows`.
- Produces: `collectListinoPages(rows): { agbCode: string; page: number }[]` (usato dallo script).

- [ ] **Step 1: Test dell'helper (fallisce)**

In `src/server/catalog/map-product.test.ts`:

```typescript
it("collectListinoPages: una coppia {agbCode,page} per codice, ultima occorrenza vince", () => {
  const mk = (agbCode: string, page: number) => ({
    agbCode, page, priceCents: 1, category: "X", subcategory: null, groupTitle: null,
    material: null, finish: null, dimension: null, hand: null, packBox: null,
    packCarton: null, discountClass: null, attributes: {}, rawLine: "",
  });
  const out = collectListinoPages([mk("A00001.00.00", 5), mk("A00001.00.00", 9), mk("B00002.00.00", 12)]);
  expect(out).toEqual([
    { agbCode: "A00001.00.00", page: 9 },
    { agbCode: "B00002.00.00", page: 12 },
  ]);
});
```

(Importa `collectListinoPages` da `./map-product`.)

- [ ] **Step 2: Esegui — deve fallire**

Run: `pnpm test -- map-product`
Expected: FAIL — `collectListinoPages` non esiste.

- [ ] **Step 3: Implementa l'helper**

In `src/server/catalog/map-product.ts`, in fondo:

```typescript
/** Coppie {agbCode, page} per il backfill: dedupe per codice (ultima occorrenza vince). */
export function collectListinoPages(rows: ParsedRow[]): { agbCode: string; page: number }[] {
  return dedupeRows(rows).map((row) => ({ agbCode: row.agbCode, page: row.page }));
}
```

- [ ] **Step 4: Esegui — deve passare**

Run: `pnpm test -- map-product`
Expected: PASS.

- [ ] **Step 5: Scrivi lo script di backfill**

Crea `scripts/backfill-listino-pages.ts` (modellato su `scripts/import-agb.ts`, idempotente):

```typescript
// Backfill Product.listinoPage dai form-feed del listino. Idempotente.
// Uso: set -a; source .env; set +a; pnpm backfill:pages <path/al/listino.pdf>
import { PrismaClient } from "@prisma/client";
import { extractPdfText } from "@/server/catalog/extract-pdf";
import { parseListino } from "@/server/catalog/parse-listino";
import { collectListinoPages } from "@/server/catalog/map-product";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) throw new Error("Percorso del PDF mancante. Uso: pnpm backfill:pages <listino.pdf>");
  const text = await extractPdfText(pdfPath);
  const { rows } = parseListino(text);
  const pages = collectListinoPages(rows);
  const db = new PrismaClient();
  let updated = 0;
  for (const { agbCode, page } of pages) {
    const res = await db.product.updateMany({ where: { agbCode }, data: { listinoPage: page } });
    updated += res.count;
  }
  console.log(`Backfill completato: ${updated}/${pages.length} prodotti aggiornati.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

> Nota: `extractPdfText` invoca `pdftotext -layout <pdf> -` (esiste già, `src/server/catalog/extract-pdf.ts`). L'alias `@/` è configurato per tsx nel progetto (vedi altri script). Se un import `@/` non risolve in tsx, usa i percorsi relativi come in `scripts/import-agb.ts`.

- [ ] **Step 6: Aggiungi lo script npm**

In `package.json`, nella sezione `scripts`, aggiungi (accanto a `embed:products`):

```json
    "backfill:pages": "tsx scripts/backfill-listino-pages.ts",
```

- [ ] **Step 7: typecheck + commit**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS.

```bash
git add src/server/catalog/map-product.ts src/server/catalog/map-product.test.ts \
  scripts/backfill-listino-pages.ts package.json
git commit -m "feat(listino): script backfill listinoPage (idempotente)"
```

---

### Task 3: env + route autenticata `/api/listino`

Serve il PDF da Vercel Blob dietro auth, con Range.

**Files:**
- Modify: `src/env.ts`
- Create: `src/app/api/listino/route.ts`
- Test: `src/app/api/listino/route.test.ts`

**Interfaces:**
- Consumes: `env.LISTINO_PDF_URL` (opzionale), `auth.api.getSession`.
- Produces: `GET /api/listino` → stream PDF (206/200) o 401/503.

- [ ] **Step 1: Aggiungi l'env opzionale**

In `src/env.ts`, dentro `envSchema`, dopo `SETTINGS_ENCRYPTION_KEY: z.string().optional(),`:

```typescript
  // PDF del listino su Vercel Blob (feature «visualizza nel listino»); assente = off.
  LISTINO_PDF_URL: z.string().url().optional(),
```

- [ ] **Step 2: Scrivi il test della route (fallisce)**

Crea `src/app/api/listino/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/env", () => ({ env: { LISTINO_PDF_URL: "https://blob.example/listino.pdf" } }));

import { GET } from "./route";

beforeEach(() => {
  getSession.mockReset();
  vi.restoreAllMocks();
});

it("senza sessione → 401", async () => {
  getSession.mockResolvedValue(null);
  const res = await GET(new Request("http://x/api/listino"));
  expect(res.status).toBe(401);
});

it("con sessione e Range → inoltra e ritorna 206", async () => {
  getSession.mockResolvedValue({ user: { id: "u1" } });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([1, 2, 3]), {
      status: 206,
      headers: { "content-range": "bytes 0-2/100", "content-length": "3" },
    }),
  );
  const res = await GET(new Request("http://x/api/listino", { headers: { range: "bytes=0-2" } }));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 0-2/100");
  expect(res.headers.get("content-type")).toBe("application/pdf");
  expect(fetchMock).toHaveBeenCalledWith(
    "https://blob.example/listino.pdf",
    expect.objectContaining({ headers: { Range: "bytes=0-2" } }),
  );
});
```

- [ ] **Step 3: Esegui — deve fallire**

Run: `pnpm test -- listino/route`
Expected: FAIL — `./route` non esiste.

- [ ] **Step 4: Implementa la route**

Crea `src/app/api/listino/route.ts`:

```typescript
import { headers } from "next/headers";
import { auth } from "@/server/auth/config";
import { env } from "@/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Streamma il listino PDF da Vercel Blob dietro auth, inoltrando le Range-request. */
export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Non autorizzato", { status: 401 });

  const url = env.LISTINO_PDF_URL;
  if (!url) return new Response("Listino non configurato", { status: 503 });

  const range = req.headers.get("range");
  const upstream = await fetch(url, range ? { headers: { Range: range } } : {});

  const out = new Headers();
  out.set("Content-Type", "application/pdf");
  out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", "private, max-age=3600");
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) out.set("Content-Range", contentRange);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) out.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
```

- [ ] **Step 5: Esegui — deve passare**

Run: `pnpm test -- listino/route`
Expected: PASS (401 + 206 con inoltro Range).

- [ ] **Step 6: typecheck + commit**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS.

```bash
git add src/env.ts src/app/api/listino/route.ts src/app/api/listino/route.test.ts
git commit -m "feat(listino): route /api/listino autenticata con Range su Vercel Blob"
```

---

### Task 4: Espone `listinoPage` nei router (ricerca + kit)

**Files:**
- Modify: `src/server/ai/rag.ts` (`SearchHit`, `HIT_PROJECTION`)
- Modify: `src/server/api/routers/kit.ts` (`get`, select componente)
- Test: `src/server/api/routers/kit.test.ts`

**Interfaces:**
- Produces: `SearchHit.listinoPage: number | null`; ogni componente di `kit.get` espone `product.listinoPage`.
- Nota: `product.getById`/`getByCode` includono già l'intero `product` (`serializeProduct` fa spread) → `listinoPage` fluisce senza modifiche.

- [ ] **Step 1: Aggiungi `listinoPage` alla projection e al tipo hit (RAGEngine)**

In `src/server/ai/rag.ts`:

(a) `SearchHit` (riga ~19), dopo `stockQuantity: number;`:

```typescript
  stockQuantity: number;
  listinoPage: number | null;
```

(b) `HIT_PROJECTION` (riga ~59), aggiungi una riga (dopo `p.stock_quantity AS "stockQuantity",`):

```typescript
  p.stock_quantity      AS "stockQuantity",
  p.listino_page        AS "listinoPage",
```

- [ ] **Step 2: Aggiungi `listinoPage` al select componente di `kit.get`**

In `src/server/api/routers/kit.ts`, dentro `get`, nel `product: { select: {...} }` (riga ~121):

```typescript
              select: { id: true, agbCode: true, name: true, isAvailable: true, listinoPage: true },
```

- [ ] **Step 3: Test `kit.get` espone la pagina del componente (fallisce se assente)**

Apri `src/server/api/routers/kit.test.ts`, individua il test di `get` (mock del db che ritorna `components` con `product`). Aggiungi al mock del componente `listinoPage` e asserisci che sia esposto. Se non c'è un test di `get`, aggiungine uno minimale seguendo il pattern del file (mock `ctx.db.kitRequest.findFirst`). Esempio di asserzione da integrare nel test di `get` esistente:

```typescript
// nel componente mockato:
product: { id: "p1", agbCode: "A50111.15.13", name: "Cremonese", isAvailable: true, listinoPage: 418 },
// asserzione:
expect(result.components[0]!.product?.listinoPage).toBe(418);
```

- [ ] **Step 4: Esegui i test — devono passare**

Run: `pnpm test -- kit`
Expected: PASS.

- [ ] **Step 5: typecheck + commit**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS (la projection raw resta in RAGEngine; `p.listino_page` esiste dopo Task 1).

```bash
git add src/server/ai/rag.ts src/server/api/routers/kit.ts src/server/api/routers/kit.test.ts
git commit -m "feat(listino): espone listinoPage negli hit di ricerca e nei componenti kit"
```

---

### Task 5: Viewer in-app (`react-pdf`) + provider + pulsante

**Files:**
- Modify: `package.json` (dipendenza `react-pdf`)
- Create: `src/components/listino/highlight.ts`
- Test: `src/components/listino/highlight.test.ts`
- Create: `src/components/listino/listino-viewer.tsx`
- Create: `src/components/listino/listino-viewer-provider.tsx`
- Create: `src/components/listino/listino-button.tsx`
- Test: `src/components/listino/listino-button.test.tsx`

**Interfaces:**
- Produces: `<ListinoViewerProvider>`, `useListinoViewer(): { open(v: { code: string; page: number }): void }`, `<ListinoButton code page />`, `makeHighlighter(code): ({str}) => string`.

- [ ] **Step 1: Installa `react-pdf`**

Run: `pnpm add react-pdf`
Expected: aggiunge `react-pdf` (e la peer `pdfjs-dist`). Verifica: `node -e "require('react-pdf')" ` non necessario; basta che `pnpm typecheck` più avanti passi.

- [ ] **Step 2: Test dell'evidenziatore (puro, fallisce)**

Crea `src/components/listino/highlight.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { makeHighlighter } from "./highlight";

describe("makeHighlighter", () => {
  const hl = makeHighlighter("A50111.15.13");
  it("avvolge il codice in <mark> (case-insensitive)", () => {
    expect(hl({ str: "cremonese A50111.15.13 argento" })).toContain(
      '<mark class="listino-hl">A50111.15.13</mark>',
    );
  });
  it("ritorna il testo (escapato) se il codice non c'è", () => {
    expect(hl({ str: "nessun codice <qui>" })).toBe("nessun codice &lt;qui&gt;");
  });
  it("stringa vuota → vuota", () => {
    expect(hl({ str: "" })).toBe("");
  });
});
```

- [ ] **Step 3: Esegui — deve fallire**

Run: `pnpm test -- highlight`
Expected: FAIL — `./highlight` non esiste.

- [ ] **Step 4: Implementa l'evidenziatore**

Crea `src/components/listino/highlight.ts`:

```typescript
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * customTextRenderer per react-pdf: ritorna l'HTML del text-item con il codice
 * evidenziato. Match esatto (case-insensitive) all'interno del singolo item.
 */
export function makeHighlighter(code: string): (item: { str: string }) => string {
  const needle = code.toUpperCase();
  return ({ str }) => {
    if (!str) return str;
    const idx = str.toUpperCase().indexOf(needle);
    if (idx === -1) return escapeHtml(str);
    return (
      escapeHtml(str.slice(0, idx)) +
      `<mark class="listino-hl">${escapeHtml(str.slice(idx, idx + needle.length))}</mark>` +
      escapeHtml(str.slice(idx + needle.length))
    );
  };
}
```

- [ ] **Step 5: Esegui — deve passare**

Run: `pnpm test -- highlight`
Expected: PASS.

- [ ] **Step 6: Implementa il viewer**

Crea `src/components/listino/listino-viewer.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { makeHighlighter } from "./highlight";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const PDF_OPTIONS = { disableAutoFetch: true, disableStream: false } as const;

export function ListinoViewer({
  code,
  page,
  onClose,
}: {
  code: string;
  page: number;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [current, setCurrent] = useState(page);
  const highlight = useMemo(() => makeHighlighter(code), [code]);

  useEffect(() => setCurrent(page), [page]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Listino — codice ${code}`}
      className="fixed inset-0 z-50 flex bg-black/70 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <span className="font-mono text-sm text-ink">{code}</span>
          <span className="text-xs text-ink-subtle">
            pag. {current}
            {numPages ? ` / ${numPages}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="listino-doc flex-1 overflow-auto bg-surface-sunken p-2">
          <Document
            file="/api/listino"
            options={PDF_OPTIONS}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<p className="p-6 text-center text-sm text-ink-subtle">Caricamento listino…</p>}
            error={<p className="p-6 text-center text-sm text-danger">Impossibile aprire il listino.</p>}
          >
            <Page
              pageNumber={current}
              width={720}
              customTextRenderer={highlight}
              renderAnnotationLayer={false}
              className="mx-auto max-w-full"
            />
          </Document>
        </div>

        <footer className="flex items-center justify-center gap-4 border-t border-line px-4 py-2">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setCurrent((c) => Math.max(1, c - 1))}
            aria-label="Pagina precedente"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            disabled={numPages != null && current >= numPages}
            onClick={() => setCurrent((c) => c + 1)}
            aria-label="Pagina successiva"
            className="rounded p-1 text-ink-subtle hover:bg-surface-sunken disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implementa provider + hook**

Crea `src/components/listino/listino-viewer-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

const ListinoViewer = dynamic(
  () => import("./listino-viewer").then((m) => m.ListinoViewer),
  { ssr: false },
);

type Target = { code: string; page: number };
const Ctx = createContext<{ open: (t: Target) => void } | null>(null);

export function ListinoViewerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  return (
    <Ctx.Provider value={{ open: setTarget }}>
      {children}
      {target && (
        <ListinoViewer code={target.code} page={target.page} onClose={() => setTarget(null)} />
      )}
    </Ctx.Provider>
  );
}

export function useListinoViewer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useListinoViewer richiede <ListinoViewerProvider>.");
  return ctx;
}
```

- [ ] **Step 8: Test del pulsante (fallisce)**

Crea `src/components/listino/listino-button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const open = vi.fn();
vi.mock("./listino-viewer-provider", () => ({ useListinoViewer: () => ({ open }) }));

import { ListinoButton } from "./listino-button";

afterEach(() => {
  cleanup();
  open.mockReset();
});

describe("ListinoButton", () => {
  it("senza pagina → non renderizza nulla", () => {
    const { container } = render(<ListinoButton code="A50111.15.13" page={null} />);
    expect(container.firstChild).toBeNull();
  });
  it("con pagina → apre il viewer con {code, page}", () => {
    render(<ListinoButton code="A50111.15.13" page={418} />);
    fireEvent.click(screen.getByRole("button", { name: /listino/i }));
    expect(open).toHaveBeenCalledWith({ code: "A50111.15.13", page: 418 });
  });
});
```

- [ ] **Step 9: Esegui — deve fallire**

Run: `pnpm test -- listino-button`
Expected: FAIL — `./listino-button` non esiste.

- [ ] **Step 10: Implementa il pulsante**

Crea `src/components/listino/listino-button.tsx`:

```tsx
"use client";

import { FileSearch } from "lucide-react";
import { useListinoViewer } from "./listino-viewer-provider";

/** Pulsante «visualizza nel listino»; nascosto se il codice non ha pagina nota. */
export function ListinoButton({ code, page }: { code: string; page: number | null }) {
  const { open } = useListinoViewer();
  if (page == null) return null;
  return (
    <button
      type="button"
      onClick={() => open({ code, page })}
      aria-label={`Visualizza ${code} nel listino`}
      title="Visualizza nel listino"
      className="rounded p-1 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <FileSearch className="size-4" aria-hidden />
    </button>
  );
}
```

- [ ] **Step 11: Esegui — deve passare**

Run: `pnpm test -- listino-button`
Expected: PASS.

- [ ] **Step 12: Stile evidenziazione**

In `src/app/globals.css` (o il CSS globale del progetto), aggiungi:

```css
.listino-hl {
  background: rgb(250 204 21 / 0.55); /* amber, leggibile su carta bianca */
  color: inherit;
  border-radius: 2px;
}
```

- [ ] **Step 13: typecheck + commit**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS.

```bash
git add package.json pnpm-lock.yaml src/components/listino src/app/globals.css
git commit -m "feat(listino): viewer PDF in-app react-pdf + provider + pulsante"
```

---

### Task 6: Innesti UI + montaggio provider + gate finali

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` (monta il provider)
- Modify: `src/components/kit/distinta-table.tsx`
- Test: `src/components/kit/distinta-table.test.tsx`
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` (mappa `listinoPage`)
- Modify: `src/components/product/product-card.tsx`
- Modify: (client archivio/ricerca che passa gli hit alle card — vedi Step)

**Interfaces:**
- Consumes: `ListinoViewerProvider`/`ListinoButton` (Task 5), `listinoPage` da kit.get e SearchHit (Task 4).

- [ ] **Step 1: Monta il provider nel layout dashboard**

In `src/app/(dashboard)/layout.tsx`: importa il provider e avvolgi `{children}` del `<main>`:

```tsx
import { ListinoViewerProvider } from "@/components/listino/listino-viewer-provider";
```

```tsx
        <main className="flex-1 bg-surface-page p-4 sm:p-6">
          <ListinoViewerProvider>{children}</ListinoViewerProvider>
        </main>
```

- [ ] **Step 2: Test del pulsante nella distinta (fallisce)**

In `src/components/kit/distinta-table.test.tsx`, mocka il provider e verifica che una riga con `listinoPage` mostri il pulsante. Aggiungi in testa al file il mock:

```tsx
vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: vi.fn() }),
}));
```

e un test (adatta la costruzione di `components` al pattern esistente del file, aggiungendo `listinoPage`):

```tsx
it("mostra «visualizza nel listino» per i componenti con pagina", () => {
  render(
    <DistintaTable
      components={[
        {
          id: "c1", componentCode: "A50111.15.13", componentName: "Cremonese",
          position: "cremonese", quantity: 1, unitPrice: 8.89, totalPrice: 8.89,
          ruleDescription: null, listinoPage: 418,
        },
      ]}
      totalPrice={8.89}
    />,
  );
  expect(screen.getByRole("button", { name: /listino/i })).toBeTruthy();
});
```

(Assicurati che `vi`/`render`/`screen` siano importati come negli altri test del file.)

- [ ] **Step 3: Esegui — deve fallire**

Run: `pnpm test -- distinta-table`
Expected: FAIL — `listinoPage` non è nel tipo / pulsante assente.

- [ ] **Step 4: Aggiungi il pulsante alla `DistintaTable`**

In `src/components/kit/distinta-table.tsx`:

(a) import in testa:

```tsx
import { ListinoButton } from "@/components/listino/listino-button";
```

(b) `DistintaComponent`: aggiungi il campo (dopo `ruleDescription: string | null;`):

```tsx
  ruleDescription: string | null;
  listinoPage: number | null;
```

(c) nella cella del codice, affianca il pulsante:

```tsx
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <CopyCodeButton code={component.componentCode} />
                    <ListinoButton code={component.componentCode} page={component.listinoPage} />
                  </span>
                </td>
```

- [ ] **Step 5: Mappa `listinoPage` nel dettaglio kit**

In `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx`, dove i componenti di `kit.get` vengono mappati in `DistintaComponent` (cerca `componentCode:` o il passaggio a `<DistintaTable components=...>`), aggiungi al mapping:

```tsx
        listinoPage: component.product?.listinoPage ?? null,
```

(Se il dettaglio passa `request.components` direttamente, aggiungi il campo nel punto in cui costruisce ogni oggetto componente.)

- [ ] **Step 6: Esegui il test distinta — deve passare**

Run: `pnpm test -- distinta-table`
Expected: PASS.

- [ ] **Step 7: Pulsante su `ProductCard`**

In `src/components/product/product-card.tsx`:

(a) `ProductSummary`: aggiungi `listinoPage: number | null;` (dopo `isAvailable: boolean;`).

(b) importa `ListinoButton` e mettilo nell'header della card, senza rompere il `<Link>` avvolgente (il pulsante non deve navigare): sostituisci la riga del codice con:

```tsx
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-ink-subtle">{product.agbCode}</span>
          <span onClick={(e) => e.preventDefault()}>
            <ListinoButton code={product.agbCode} page={product.listinoPage} />
          </span>
        </span>
        <AvailabilityDot available={product.isAvailable} />
      </div>
```

> `onClick preventDefault` sullo span evita che il click sul pulsante attivi la navigazione del `<Link>` della card.

- [ ] **Step 8: Passa `listinoPage` dagli hit di ricerca alle card**

Trova il client che renderizza `ProductCard` dagli hit di `product.search` (cerca `ProductCard` in `src/app/(dashboard)/archivio/`). Nel punto in cui costruisce `product={{ ... }}` per la card, aggiungi:

```tsx
              listinoPage: hit.listinoPage,
```

(Se la card riceve direttamente l'hit, il campo `listinoPage` è già presente in `SearchHit` da Task 4 — verifica solo che `ProductSummary` combaci.)

- [ ] **Step 9: Gate — typecheck**

Run: `set -a; source .env; set +a; pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Gate — lint**

Run: `pnpm lint`
Expected: PASS (niente `| tail`).

- [ ] **Step 11: Gate — test (intera suite)**

Run: `pnpm test`
Expected: PASS (tutti i test verdi, nuovi inclusi).

- [ ] **Step 12: Gate — build**

Run: `set -a; source .env; set +a; pnpm build`
Expected: PASS (nuova route `/api/listino`; `react-pdf` lazy non deve rompere il build).

- [ ] **Step 13: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" src/components/kit/distinta-table.tsx \
  src/components/kit/distinta-table.test.tsx \
  "src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx" \
  src/components/product/product-card.tsx "src/app/(dashboard)/archivio"
git commit -m "feat(listino): innesti «visualizza nel listino» su distinta kit e archivio"
```

---

## Verifica end-to-end (browser, dopo il deploy)

Il rendering PDF reale non è unit-testabile in jsdom (canvas/worker). Verifica nel browser (Chromium, mobile ≤375px + desktop) **dopo** gli step ops:
1. Aprire un kit generato → premere «visualizza nel listino» su una riga → si apre la modale alla pagina giusta col codice evidenziato.
2. Ricerca in archivio → pulsante sulla card/dettaglio → idem.

## Note post-piano (ops — fuori dai task di codice)

1. **Migrazione** `20260723120000_add_listino_page` su Neon (`prisma migrate deploy` via GitHub Actions).
2. **PDF su Vercel Blob**: `qpdf --linearize listino.pdf listino-web.pdf`, upload su Vercel Blob, impostare `LISTINO_PDF_URL` (Vercel Production + `.env` locale). Serve un token Blob.
3. **Backfill** pagine su Neon: `pnpm backfill:pages <listino.pdf>` via ops (dopo la migrazione).
4. Ad ogni **nuova edizione** del listino: re-upload su Blob + re-run del backfill.

## Rischi noti (dal design)

- Range-loading PDF.js attraverso il proxy: se desse problemi, puntare `<Document file>` all'URL Blob diretto (mitigazione; PDF già linearizzato).
- Codice spezzato su più text-item del PDF: l'evidenziazione (match per item) potrebbe non coprirlo; la pagina è comunque corretta. Accettabile per l'MVP.
