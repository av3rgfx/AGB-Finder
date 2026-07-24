# Archivio UX (persistenza + ritorno-lista + cronologia) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere persistente lo stato di ricerca dell'Archivio (query/filtri/vista/pagina) su refresh e sul ritorno dal dettaglio (con posizione di scroll), e aggiungere cronologia ricerche settimanale + thumbnail + chip filtri + empty-state con suggerimenti.

**Architecture:** Stato committato in **URL searchParams** (`useSearchParams` sotto `<Suspense>`, scrittura `router.replace(url,{scroll:false})`); **vista** in `localStorage` (idratata post-mount); **scroll** in `sessionStorage` per-chiave, ripristinato una volta dopo il passaggio nativo (rAF); **cronologia** derivata read-side da `ActivityLog.PRODUCT_SEARCHED`. Logica non-banale in moduli puri testabili; l'hook `useArchivioSearch` è cablaggio.

**Tech Stack:** Next.js 15.5.20 (App Router), React 19, TypeScript strict, tRPC v11, @tanstack/react-query 5.66, Prisma 6, Vitest 3 + @testing-library/react 16.2 (jsdom), Tailwind.

## Global Constraints

- TypeScript **strict** sempre. Tutte le API via **tRPC**; tutte le query via **Prisma** (raw SQL solo pgvector).
- UI **in italiano**; codici prodotto in **font monospace**.
- **Mobile-first**: ogni componente responsive, verificato a **≤375px** e desktop; nessun overflow orizzontale.
- **Nessuna dipendenza nuova. Nessuna migrazione DB. Nessuna AZIONE OPS.**
- Minimalismo/YAGNI. Gate finali verdi: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- Ambiente: prima dei comandi che toccano Prisma/env fare `set -a; source .env; set +a` se necessario (i test hanno env fittizie in `vitest.config.ts`, non serve).
- `PAGE_SIZE = 24`.

---

### Task 1: Modulo puro `archivio-search-params` (URL ⇄ stato)

**Files:**
- Create: `src/lib/archivio-search-params.ts`
- Test: `src/lib/archivio-search-params.test.ts`
- Modify: `src/components/product/product-filters.tsx` (import del tipo)

**Interfaces:**
- Produces: `interface ArchivioFilters`, `interface ArchivioSearchState { query: string; filters: ArchivioFilters; page: number }`, `parseSearchState(sp: URLSearchParams): ArchivioSearchState`, `buildSearchQueryString(state: ArchivioSearchState): string`, `searchScrollKey(state: ArchivioSearchState): string`.

- [ ] **Step 1: Write the failing test** — `src/lib/archivio-search-params.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  parseSearchState,
  buildSearchQueryString,
  searchScrollKey,
} from "./archivio-search-params";

describe("parseSearchState", () => {
  it("legge query, filtri e pagina", () => {
    const s = parseSearchState(new URLSearchParams("q=cerniera&cat=c1&pmin=10&pmax=50&mat=acciaio&stock=1&p=3"));
    expect(s).toEqual({
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, priceMax: 50, material: "acciaio", inStockOnly: true },
      page: 3,
    });
  });

  it("default sicuri su input assente/ostile", () => {
    expect(parseSearchState(new URLSearchParams(""))).toEqual({ query: "", filters: {}, page: 1 });
    const s = parseSearchState(new URLSearchParams("p=abc&pmin=-5&pmax=&stock=0"));
    expect(s.page).toBe(1);
    expect(s.filters.priceMin).toBeUndefined();
    expect(s.filters.priceMax).toBeUndefined();
    expect(s.filters.inStockOnly).toBeUndefined();
  });
});

describe("buildSearchQueryString", () => {
  it("omette i default (URL pulito) e fa round-trip", () => {
    expect(buildSearchQueryString({ query: "", filters: {}, page: 1 })).toBe("");
    const state = {
      query: "cerniera",
      filters: { categoryId: "c1", priceMin: 10, material: "acciaio", inStockOnly: true },
      page: 2,
    };
    const round = parseSearchState(new URLSearchParams(buildSearchQueryString(state)));
    expect(round).toEqual(state);
  });

  it("trim della query", () => {
    expect(buildSearchQueryString({ query: "  x  ", filters: {}, page: 1 })).toBe("q=x");
  });
});

describe("searchScrollKey", () => {
  it("distingue query/filtri/pagina, ignora la vista (non è nello stato)", () => {
    const a = searchScrollKey({ query: "x", filters: {}, page: 1 });
    const b = searchScrollKey({ query: "x", filters: {}, page: 2 });
    const c = searchScrollKey({ query: "y", filters: {}, page: 1 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe(searchScrollKey({ query: "x", filters: {}, page: 1 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test archivio-search-params` → FAIL (module not found).

- [ ] **Step 3: Write minimal implementation** — `src/lib/archivio-search-params.ts`

```ts
export interface ArchivioFilters {
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  material?: string;
  inStockOnly?: boolean;
}

export interface ArchivioSearchState {
  query: string;
  filters: ArchivioFilters;
  page: number; // 1-based
}

function nonNegNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseSearchState(sp: URLSearchParams): ArchivioSearchState {
  const filters: ArchivioFilters = {};
  const cat = sp.get("cat");
  if (cat) filters.categoryId = cat;
  const pmin = nonNegNumber(sp.get("pmin"));
  if (pmin !== undefined) filters.priceMin = pmin;
  const pmax = nonNegNumber(sp.get("pmax"));
  if (pmax !== undefined) filters.priceMax = pmax;
  const mat = sp.get("mat");
  if (mat) filters.material = mat;
  if (sp.get("stock") === "1") filters.inStockOnly = true;

  const pRaw = Number(sp.get("p"));
  const page = Number.isInteger(pRaw) && pRaw >= 1 ? pRaw : 1;

  return { query: sp.get("q") ?? "", filters, page };
}

export function buildSearchQueryString(state: ArchivioSearchState): string {
  const sp = new URLSearchParams();
  const q = state.query.trim();
  if (q) sp.set("q", q);
  const f = state.filters;
  if (f.categoryId) sp.set("cat", f.categoryId);
  if (f.priceMin !== undefined) sp.set("pmin", String(f.priceMin));
  if (f.priceMax !== undefined) sp.set("pmax", String(f.priceMax));
  if (f.material) sp.set("mat", f.material);
  if (f.inStockOnly) sp.set("stock", "1");
  if (state.page > 1) sp.set("p", String(state.page));
  return sp.toString();
}

/** Chiave di ripristino scroll: NON include la vista (default al primo render dopo il Back). */
export function searchScrollKey(state: ArchivioSearchState): string {
  return buildSearchQueryString(state);
}
```

- [ ] **Step 4: Point `product-filters.tsx` at the shared type** — sostituisci l'`interface ArchivioFilters` locale (righe 6-12) con un re-export:

```ts
import { type ArchivioFilters } from "@/lib/archivio-search-params";
export type { ArchivioFilters };
```

(Il resto di `product-filters.tsx` resta identico: usa `ArchivioFilters`, `filters`, `onChange`.)

- [ ] **Step 5: Run tests & typecheck** — `pnpm test archivio-search-params` → PASS; `pnpm typecheck` → nessun errore su product-filters.

- [ ] **Step 6: Commit**

```bash
git add src/lib/archivio-search-params.ts src/lib/archivio-search-params.test.ts src/components/product/product-filters.tsx
git commit -m "feat(archivio): modulo puro URL<->stato ricerca (parse/build/scrollKey)"
```

---

### Task 2: Modulo puro `archivio-scroll` (snapshot + gate)

**Files:**
- Create: `src/lib/archivio-scroll.ts`
- Test: `src/lib/archivio-scroll.test.ts`

**Interfaces:**
- Produces: `saveScroll(key: string, y: number): void`, `loadScroll(key: string): number | null`, `clearScroll(key: string): void`, `shouldRestoreScroll(g: RestoreGate): boolean` con `interface RestoreGate { hasData: boolean; isPlaceholder: boolean; viewLoaded: boolean; categoriesReady: boolean; alreadyRestored: boolean; savedY: number | null }`.

- [ ] **Step 1: Write the failing test** — `src/lib/archivio-scroll.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveScroll, loadScroll, clearScroll, shouldRestoreScroll } from "./archivio-scroll";

beforeEach(() => window.sessionStorage.clear());

describe("save/load/clear per chiave", () => {
  it("roundtrip e clear", () => {
    saveScroll("k1", 320.7);
    expect(loadScroll("k1")).toBe(321); // arrotondato
    clearScroll("k1");
    expect(loadScroll("k1")).toBeNull();
  });

  it("null su chiave assente o vuota", () => {
    expect(loadScroll("nope")).toBeNull();
    expect(loadScroll("")).toBeNull();
    saveScroll("", 10);
    expect(loadScroll("")).toBeNull();
  });

  it("fail-soft se sessionStorage lancia (quota/private)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveScroll("k", 1)).not.toThrow();
    spy.mockRestore();
  });
});

describe("shouldRestoreScroll", () => {
  const ok = {
    hasData: true, isPlaceholder: false, viewLoaded: true,
    categoriesReady: true, alreadyRestored: false, savedY: 100,
  };
  it("true solo con tutte le condizioni", () => {
    expect(shouldRestoreScroll(ok)).toBe(true);
    expect(shouldRestoreScroll({ ...ok, hasData: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, isPlaceholder: true })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, viewLoaded: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, categoriesReady: false })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, alreadyRestored: true })).toBe(false);
    expect(shouldRestoreScroll({ ...ok, savedY: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test archivio-scroll` → FAIL.

- [ ] **Step 3: Write minimal implementation** — `src/lib/archivio-scroll.ts`

```ts
const PREFIX = "archivio:scroll:";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveScroll(key: string, y: number): void {
  if (!key) return;
  try {
    store()?.setItem(PREFIX + key, String(Math.round(y)));
  } catch {
    /* quota/private mode → no-op */
  }
}

export function loadScroll(key: string): number | null {
  if (!key) return null;
  try {
    const raw = store()?.getItem(PREFIX + key) ?? null;
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function clearScroll(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    /* no-op */
  }
}

export interface RestoreGate {
  hasData: boolean;
  isPlaceholder: boolean;
  viewLoaded: boolean;
  categoriesReady: boolean;
  alreadyRestored: boolean;
  savedY: number | null;
}

export function shouldRestoreScroll(g: RestoreGate): boolean {
  return (
    g.hasData &&
    !g.isPlaceholder &&
    g.viewLoaded &&
    g.categoriesReady &&
    !g.alreadyRestored &&
    g.savedY !== null
  );
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test archivio-scroll` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/archivio-scroll.ts src/lib/archivio-scroll.test.ts
git commit -m "feat(archivio): snapshot scroll per-chiave (sessionStorage) + gate ripristino"
```

---

### Task 3: Modulo puro `recent-searches` (derivazione cronologia)

**Files:**
- Create: `src/lib/recent-searches.ts`
- Test: `src/lib/recent-searches.test.ts`

**Interfaces:**
- Produces: `deriveRecentSearches(rows: { metadata: unknown }[], opts?: { limit?: number }): string[]`.

- [ ] **Step 1: Write the failing test** — `src/lib/recent-searches.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { deriveRecentSearches } from "./recent-searches";

const row = (query: unknown, results?: unknown) => ({ metadata: { query, results } });

describe("deriveRecentSearches", () => {
  it("scarta 0-risultati, query vuote e metadata malformato", () => {
    const out = deriveRecentSearches([
      row("cerniera", 5),
      row("vuota", 0),
      row("   ", 3),
      row(123, 3),
      { metadata: null },
    ]);
    expect(out).toEqual(["cerniera"]);
  });

  it("dedup case/spazi tenendo la più recente", () => {
    expect(deriveRecentSearches([row("Cerniera", 2), row("cerniera ", 2)])).toEqual(["Cerniera"]);
  });

  it("collassa i prefissi", () => {
    // ordine = più recente prima
    expect(deriveRecentSearches([row("cerniera", 4), row("cer", 4)])).toEqual(["cerniera"]);
    expect(deriveRecentSearches([row("cerniera argento", 4), row("cerniera", 4)])).toEqual([
      "cerniera argento",
    ]);
  });

  it("rispetta il limite", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`q${i}`, 1));
    expect(deriveRecentSearches(rows, { limit: 8 })).toHaveLength(8);
  });

  it("tiene le ricerche con results sconosciuto (undefined)", () => {
    expect(deriveRecentSearches([row("maniglia")])).toEqual(["maniglia"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test recent-searches` → FAIL.

- [ ] **Step 3: Write minimal implementation** — `src/lib/recent-searches.ts`

```ts
// Rimedio READ-SIDE al logging as-you-type (prefissi, ri-log su refresh): dedup +
// collasso prefissi. RIMUOVIBILE quando il ticket "log solo ricerche committate"
// (spec §6) sarà fatto e il log conterrà solo query intenzionali.
interface SearchMeta {
  query?: unknown;
  results?: unknown;
}

export function deriveRecentSearches(
  rows: { metadata: unknown }[],
  opts: { limit?: number } = {},
): string[] {
  const limit = opts.limit ?? 8;
  const kept: string[] = []; // forma display, più recente prima
  const seen = new Set<string>(); // dedup lowercase

  for (const r of rows) {
    const meta = (r.metadata ?? {}) as SearchMeta;
    if (typeof meta.query !== "string") continue;
    const q = meta.query.trim().replace(/\s+/g, " ");
    if (!q) continue;
    if (typeof meta.results === "number" && meta.results === 0) continue;
    const lower = q.toLowerCase();
    if (seen.has(lower)) continue;
    // scarta q se prefisso stretto di una già tenuta (più recente)
    if (kept.some((k) => k.length > q.length && k.toLowerCase().startsWith(lower))) continue;
    seen.add(lower);
    kept.push(q);
    if (kept.length >= limit) break;
  }
  return kept;
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test recent-searches` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recent-searches.ts src/lib/recent-searches.test.ts
git commit -m "feat(archivio): derivazione read-side ricerche recenti (dedup + prefissi)"
```

---

### Task 4: tRPC `product.recentSearches`

**Files:**
- Modify: `src/server/api/routers/product.ts`
- Test: `src/server/api/routers/product.recent-searches.test.ts`

**Interfaces:**
- Consumes: `deriveRecentSearches` (Task 3), `agentProcedure`.
- Produces: `product.recentSearches({ limit? }): Promise<string[]>`.

- [ ] **Step 1: Write the failing test** — `src/server/api/routers/product.recent-searches.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { productRouter } from "./product";

const findMany = vi.fn();
const dbStub = { activityLog: { findMany } };
const appRouter = createTRPCRouter({ product: productRouter });
const makeCtx = (session: unknown): TRPCContext =>
  ({ db: dbStub, session, headers: new Headers() }) as unknown as TRPCContext;
const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("product.recentSearches", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.product.recentSearches()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("filtra per utente, tipo, 7 giorni; take 100; desc; deriva la lista", async () => {
    findMany.mockResolvedValue([
      { metadata: { query: "cerniera", results: 3 } },
      { metadata: { query: "cer", results: 3 } },
      { metadata: { query: "vuota", results: 0 } },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.product.recentSearches();
    expect(out).toEqual(["cerniera"]);
    const arg = findMany.mock.calls[0]![0];
    expect(arg.where).toMatchObject({ userId: "agent1", type: "PRODUCT_SEARCHED" });
    expect((arg.where.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
    expect(arg.take).toBe(100);
    expect(arg.orderBy).toMatchObject({ createdAt: "desc" });
    expect(arg.select).toMatchObject({ metadata: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test product.recent-searches` → FAIL (procedura assente).

- [ ] **Step 3: Add the procedure** — in `src/server/api/routers/product.ts`, aggiungi l'import in testa e la procedura nel router.

Import (dopo gli altri import):

```ts
import { deriveRecentSearches } from "@/lib/recent-searches";
```

Procedura (dentro `createTRPCRouter({ ... })`, es. dopo `getRelated`):

```ts
  recentSearches: agentProcedure
    .input(z.object({ limit: z.number().int().min(1).max(20).default(8) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rows = await ctx.db.activityLog.findMany({
        where: { userId: ctx.session.user.id, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { metadata: true },
      });
      return deriveRecentSearches(rows, { limit: input?.limit ?? 8 });
    }),
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test product.recent-searches` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/product.ts src/server/api/routers/product.recent-searches.test.ts
git commit -m "feat(archivio): product.recentSearches (read-side, ultimi 7 giorni)"
```

---

### Task 5: Hook `useArchivioSearch` (cablaggio URL + vista + salvataggio scroll)

**Files:**
- Create: `src/lib/use-archivio-search.ts`
- Test: `src/lib/use-archivio-search.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`parseSearchState`/`buildSearchQueryString`/`searchScrollKey`/`ArchivioFilters`/`ArchivioSearchState`), Task 2 (`saveScroll`), `useDebouncedValue`.
- Produces: `useArchivioSearch(pageSize: number)` che ritorna `{ queryInput, setQueryInput, committed, offset, setFilters, clearFilter, clearAllFilters, setPage, view, setView, viewLoaded, scrollKey }`. Firma di `clearFilter`: `(...keys: (keyof ArchivioFilters)[]) => void`.

- [ ] **Step 1: Write the failing test** — `src/lib/use-archivio-search.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

let sp = new URLSearchParams("");
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp,
  useRouter: () => ({ replace }),
  usePathname: () => "/archivio",
}));

import { useArchivioSearch } from "./use-archivio-search";

beforeEach(() => {
  sp = new URLSearchParams("");
  replace.mockReset();
  window.localStorage.clear();
  vi.useRealTimers();
});

describe("useArchivioSearch", () => {
  it("committa la query dopo il debounce e azzera la pagina (p omesso)", () => {
    vi.useFakeTimers();
    sp = new URLSearchParams("q=old&p=3");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.setQueryInput("nuovo"));
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledTimes(1);
    const url = replace.mock.calls[0]![0] as string;
    expect(url).toContain("q=nuovo");
    expect(url).not.toContain("p=");
    expect(replace.mock.calls[0]![1]).toMatchObject({ scroll: false });
  });

  it("setFilters scrive il filtro e azzera la pagina", () => {
    sp = new URLSearchParams("q=x&p=2");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.setFilters({ categoryId: "c1" }));
    const url = replace.mock.calls[0]![0] as string;
    expect(url).toContain("cat=c1");
    expect(url).toContain("q=x");
    expect(url).not.toContain("p=");
  });

  it("clearFilter rimuove più chiavi in una sola scrittura (prezzo)", () => {
    sp = new URLSearchParams("pmin=10&pmax=50&p=2");
    const { result } = renderHook(() => useArchivioSearch(24));
    act(() => result.current.clearFilter("priceMin", "priceMax"));
    const url = replace.mock.calls[0]![0] as string;
    expect(url).not.toContain("pmin");
    expect(url).not.toContain("pmax");
    expect(url).not.toContain("p=");
  });

  it("view: default list, persiste in localStorage, viewLoaded true dopo mount", () => {
    const { result } = renderHook(() => useArchivioSearch(24));
    expect(result.current.viewLoaded).toBe(true);
    expect(result.current.view).toBe("list");
    act(() => result.current.setView("grid"));
    expect(result.current.view).toBe("grid");
    expect(window.localStorage.getItem("archivio:view")).toBe("grid");
  });

  it("offset derivato dalla pagina", () => {
    sp = new URLSearchParams("q=x&p=3");
    const { result } = renderHook(() => useArchivioSearch(24));
    expect(result.current.offset).toBe(48);
    expect(result.current.committed.query).toBe("x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test use-archivio-search` → FAIL.

- [ ] **Step 3: Write minimal implementation** — `src/lib/use-archivio-search.ts`

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  type ArchivioFilters,
  type ArchivioSearchState,
  buildSearchQueryString,
  parseSearchState,
  searchScrollKey,
} from "@/lib/archivio-search-params";
import { saveScroll } from "@/lib/archivio-scroll";

const VIEW_KEY = "archivio:view";
type View = "list" | "grid";

export function useArchivioSearch(pageSize: number) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const committed = useMemo<ArchivioSearchState>(
    () => parseSearchState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const offset = (committed.page - 1) * pageSize;
  const scrollKey = useMemo(() => searchScrollKey(committed), [committed]);

  const write = useCallback(
    (next: ArchivioSearchState) => {
      const qs = buildSearchQueryString(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // Query: mirror locale (seed dall'URL una volta) + debounce → commit atomico (reset pagina).
  const [queryInput, setQueryInput] = useState(committed.query);
  const debounced = useDebouncedValue(queryInput.trim(), 300);
  useEffect(() => {
    if (debounced === committed.query) return;
    write({ query: debounced, filters: committed.filters, page: 1 });
    // Solo su `debounced`: le altre modifiche URL non devono ri-scrivere la query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const setFilters = useCallback(
    (filters: ArchivioFilters) => write({ query: committed.query, filters, page: 1 }),
    [write, committed.query],
  );
  const clearFilter = useCallback(
    (...keys: (keyof ArchivioFilters)[]) => {
      const filters = { ...committed.filters };
      for (const k of keys) delete filters[k];
      write({ query: committed.query, filters, page: 1 });
    },
    [write, committed.query, committed.filters],
  );
  const clearAllFilters = useCallback(
    () => write({ query: committed.query, filters: {}, page: 1 }),
    [write, committed.query],
  );
  const setPage = useCallback(
    (page: number) => write({ query: committed.query, filters: committed.filters, page }),
    [write, committed.query, committed.filters],
  );

  // Vista: default SSR deterministico, idratata da localStorage post-mount (no flash/mismatch).
  const [view, setViewState] = useState<View>("list");
  const [viewLoaded, setViewLoaded] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "list") setViewState(v);
    } catch {
      /* no-op */
    }
    setViewLoaded(true);
  }, []);
  const setView = useCallback((v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* no-op */
    }
  }, []);

  // Salvataggio scroll: throttled + pagehide + cleanup all'unmount (Back verso il dettaglio).
  const scrollKeyRef = useRef(scrollKey);
  scrollKeyRef.current = scrollKey;
  useEffect(() => {
    const save = () => saveScroll(scrollKeyRef.current, window.scrollY);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        save();
        timer = null;
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (timer) clearTimeout(timer);
      save();
    };
  }, []);

  return {
    queryInput,
    setQueryInput,
    committed,
    offset,
    setFilters,
    clearFilter,
    clearAllFilters,
    setPage,
    view,
    setView,
    viewLoaded,
    scrollKey,
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test use-archivio-search` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-archivio-search.ts src/lib/use-archivio-search.test.tsx
git commit -m "feat(archivio): hook useArchivioSearch (URL + vista + salvataggio scroll)"
```

---

### Task 6: `<Suspense>` + refactor `archivio-client` (core #1/#2 — persistenza + ripristino scroll)

**Files:**
- Modify: `src/app/(dashboard)/archivio/page.tsx`
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx`

**Interfaces:**
- Consumes: Task 5 (`useArchivioSearch`), Task 2 (`loadScroll`/`clearScroll`/`shouldRestoreScroll`).
- Nota: in questo task l'empty-state e i risultati restano come oggi (chip + ricerche recenti + thumbnail arrivano nei Task 7-10). Le `RecentSearches`/`ActiveFilterChips` NON sono ancora importate.

- [ ] **Step 1: Wrap in `<Suspense>`** — `src/app/(dashboard)/archivio/page.tsx`

```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArchivioClient } from "./archivio-client";

export const metadata: Metadata = { title: "Archivio — UFPtrade" };

export default function ArchivioPage() {
  return (
    <Suspense fallback={<div className="h-screen" aria-hidden />}>
      <ArchivioClient />
    </Suspense>
  );
}
```

- [ ] **Step 2: Refactor `archivio-client.tsx`** — sostituisci l'intero file mantenendo `EmptyState`, `SkeletonList`, `Pagination` (adattati a `page`/`setPage`):

```tsx
"use client";

import { useEffect, useRef } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { LayoutGrid, List, PackageSearch, Search } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product/product-card";
import { ProductRow } from "@/components/product/product-row";
import { ProductFilters } from "@/components/product/product-filters";
import { useArchivioSearch } from "@/lib/use-archivio-search";
import { clearScroll, loadScroll, shouldRestoreScroll } from "@/lib/archivio-scroll";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

export function ArchivioClient() {
  const {
    queryInput,
    setQueryInput,
    committed,
    offset,
    setFilters,
    setPage,
    view,
    setView,
    viewLoaded,
    scrollKey,
  } = useArchivioSearch(PAGE_SIZE);

  const categories = api.product.listCategories.useQuery();
  const categoriesReady = !committed.filters.categoryId || categories.isSuccess;

  const search = api.product.search.useQuery(
    { query: committed.query, filters: committed.filters, limit: PAGE_SIZE, offset },
    {
      enabled: committed.query.length > 0,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    },
  );

  const hits = search.data?.hits ?? [];
  const total = search.data?.total ?? 0;

  // p fuori range (URL condiviso / drift): 0 hit ma offset>0 → torna a pagina 1.
  useEffect(() => {
    if (search.isSuccess && hits.length === 0 && offset > 0) setPage(1);
  }, [search.isSuccess, hits.length, offset, setPage]);

  // Ripristino scroll: una volta, dopo il passaggio nativo (doppio rAF).
  const restored = useRef(false);
  useEffect(() => {
    const savedY = loadScroll(scrollKey);
    const go = shouldRestoreScroll({
      hasData: Boolean(search.data),
      isPlaceholder: search.isPlaceholderData,
      viewLoaded,
      categoriesReady,
      alreadyRestored: restored.current,
      savedY,
    });
    if (!go || savedY === null) return;
    restored.current = true;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo(0, savedY);
        clearScroll(scrollKey);
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, [search.data, search.isPlaceholderData, viewLoaded, categoriesReady, scrollKey]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-ink">Archivio prodotti</h1>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              id="archivio-search"
              type="search"
              aria-label="Cerca nel catalogo"
              placeholder="Cerca per nome, categoria o codice AGB…"
              leadingIcon={<Search className="size-4" aria-hidden />}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>
          <div
            className="flex rounded border border-line-strong bg-surface"
            role="group"
            aria-label="Vista risultati"
          >
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="Vista lista"
              onClick={() => setView("list")}
              className={cn(
                "rounded-l p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                view === "list" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken",
              )}
            >
              <List className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Vista griglia"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-r p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                view === "grid" ? "bg-brand-light text-brand" : "text-ink-subtle hover:bg-surface-sunken",
              )}
            >
              <LayoutGrid className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[220px_1fr]">
        <ProductFilters filters={committed.filters} onChange={setFilters} />

        <section
          aria-label="Risultati"
          aria-busy={search.isFetching}
          className="flex min-w-0 flex-col gap-4"
        >
          {committed.query.length === 0 ? (
            <EmptyState
              title="Cerca nel catalogo AGB"
              detail="Digita un termine (es. “cerniera anta ribalta”) o un codice prodotto (es. B00590)."
            />
          ) : search.isPending ? (
            <SkeletonList />
          ) : search.isError ? (
            <div
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
            >
              Errore durante la ricerca. Riprova tra qualche istante.
            </div>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nessun risultato"
              detail={`Nessun prodotto trovato per “${committed.query}”. Prova con un termine diverso o rimuovi i filtri.`}
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
              <Pagination page={committed.page} total={total} onChange={setPage} />
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

function SkeletonList() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-md border border-line" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0">
          <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
          <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const offset = (page - 1) * PAGE_SIZE;
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-4">
      <p className="text-sm tabular-nums text-ink-subtle">
        {from}–{to} di {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Precedente
        </Button>
        <Button variant="secondary" size="sm" disabled={to >= total} onClick={() => onChange(page + 1)}>
          Successiva
        </Button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck + full test + build**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: verde. Il `<Suspense>` evita l'errore *missing-suspense-with-csr-bailout* al build.

- [ ] **Step 4: Browser verification (core #1/#2)** — vedi Task 11 (scroll su Back + refresh). Se in questa fase vuoi già verificare: `pnpm dev`, cerca, scrolla, apri un prodotto, torna indietro → stessa posizione; refresh → query/filtri/pagina/vista mantenuti.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/archivio/page.tsx" "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): stato ricerca in URL + vista in localStorage + ripristino scroll su Back"
```

---

### Task 7: `ActiveFilterChips` + integrazione (extra #5)

**Files:**
- Create: `src/components/product/active-filter-chips.tsx`
- Test: `src/components/product/active-filter-chips.test.tsx`
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx`

**Interfaces:**
- Consumes: `ArchivioFilters` (Task 1), `formatPrice` (`@/lib/format`).
- Produces: `ActiveFilterChips({ filters, categoryName, onRemove, onClearAll })` con `onRemove: (keys: (keyof ArchivioFilters)[]) => void`, `categoryName: (id: string) => string | undefined`.

- [ ] **Step 1: Write the failing test** — `src/components/product/active-filter-chips.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ActiveFilterChips } from "./active-filter-chips";

afterEach(cleanup);

const noop = () => undefined;

describe("ActiveFilterChips", () => {
  it("nessun chip → non renderizza nulla", () => {
    const { container } = render(
      <ActiveFilterChips filters={{}} categoryName={() => undefined} onRemove={noop} onClearAll={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("mostra i chip attivi con nome categoria risolto", () => {
    render(
      <ActiveFilterChips
        filters={{ categoryId: "c1", inStockOnly: true }}
        categoryName={(id) => (id === "c1" ? "Cerniere" : undefined)}
        onRemove={noop}
        onClearAll={noop}
      />,
    );
    expect(screen.getByText(/Categoria: Cerniere/)).toBeDefined();
    expect(screen.getByText(/Solo disponibili/)).toBeDefined();
  });

  it("il ✕ del prezzo rimuove entrambe le chiavi; 'Azzera tutto' chiama onClearAll", () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(
      <ActiveFilterChips
        filters={{ priceMin: 10, priceMax: 50 }}
        categoryName={() => undefined}
        onRemove={onRemove}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Rimuovi filtro Prezzo/));
    expect(onRemove).toHaveBeenCalledWith(["priceMin", "priceMax"]);
    fireEvent.click(screen.getByText("Azzera tutto"));
    expect(onClearAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test active-filter-chips` → FAIL.

- [ ] **Step 3: Write minimal implementation** — `src/components/product/active-filter-chips.tsx`

```tsx
"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { ArchivioFilters } from "@/lib/archivio-search-params";

interface ChipDef {
  keys: (keyof ArchivioFilters)[];
  label: string;
  aria: string;
}

export function ActiveFilterChips({
  filters,
  categoryName,
  onRemove,
  onClearAll,
}: {
  filters: ArchivioFilters;
  categoryName: (id: string) => string | undefined;
  onRemove: (keys: (keyof ArchivioFilters)[]) => void;
  onClearAll: () => void;
}) {
  const chips: ChipDef[] = [];
  if (filters.categoryId) {
    const name = categoryName(filters.categoryId) ?? "…";
    chips.push({ keys: ["categoryId"], label: `Categoria: ${name}`, aria: `Categoria ${name}` });
  }
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const min = filters.priceMin !== undefined ? formatPrice(filters.priceMin) : "…";
    const max = filters.priceMax !== undefined ? formatPrice(filters.priceMax) : "…";
    chips.push({ keys: ["priceMin", "priceMax"], label: `Prezzo: ${min}–${max}`, aria: `Prezzo ${min}-${max}` });
  }
  if (filters.material) {
    chips.push({ keys: ["material"], label: `Materiale: ${filters.material}`, aria: `Materiale ${filters.material}` });
  }
  if (filters.inStockOnly) {
    chips.push({ keys: ["inStockOnly"], label: "Solo disponibili", aria: "Solo disponibili" });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.keys.join(",")}
          className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-xs text-ink-muted"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.keys)}
            aria-label={`Rimuovi filtro ${chip.aria}`}
            className="grid size-4 place-items-center rounded text-ink-subtle transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Azzera tutto
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test active-filter-chips` → PASS.

- [ ] **Step 5: Integrate in `archivio-client.tsx`** — aggiungi l'import, ricava `clearFilter`/`clearAllFilters` dall'hook, e renderizza i chip sopra i risultati.

Import:

```tsx
import { ActiveFilterChips } from "@/components/product/active-filter-chips";
```

Destrutturazione hook (aggiungi `clearFilter, clearAllFilters`):

```tsx
  const {
    queryInput, setQueryInput, committed, offset,
    setFilters, clearFilter, clearAllFilters, setPage,
    view, setView, viewLoaded, scrollKey,
  } = useArchivioSearch(PAGE_SIZE);
```

Renderizza i chip dentro il ramo risultati, subito prima del `<p aria-live>` conteggio (dentro il `<>...</>`):

```tsx
              <ActiveFilterChips
                filters={committed.filters}
                categoryName={(id) => categories.data?.find((c) => c.id === id)?.name}
                onRemove={(keys) => clearFilter(...keys)}
                onClearAll={clearAllFilters}
              />
```

- [ ] **Step 6: Typecheck + test + build** — `pnpm typecheck && pnpm test && pnpm build` → verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/product/active-filter-chips.tsx src/components/product/active-filter-chips.test.tsx "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): chip dei filtri attivi + azzera (URL-autoritativo, a11y)"
```

---

### Task 8: `RecentSearches` + integrazione empty-state (core #3 + extra #6)

**Files:**
- Create: `src/components/product/recent-searches.tsx`
- Test: `src/components/product/recent-searches.test.tsx`
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx`

**Interfaces:**
- Consumes: `product.recentSearches` (Task 4).
- Produces: `RecentSearches({ recent, onPick })` con `recent: string[]`, `onPick: (q: string) => void`.

- [ ] **Step 1: Write the failing test** — `src/components/product/recent-searches.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RecentSearches } from "./recent-searches";

afterEach(cleanup);

describe("RecentSearches", () => {
  it("mostra recenti + suggerimenti; il click chiama onPick", () => {
    const onPick = vi.fn();
    render(<RecentSearches recent={["cerniera", "maniglia"]} onPick={onPick} />);
    expect(screen.getByText("Ricerche recenti")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "cerniera" }));
    expect(onPick).toHaveBeenCalledWith("cerniera");
    // un suggerimento statico
    expect(screen.getByText("Prova a cercare")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "maniglia" }));
    expect(onPick).toHaveBeenCalledWith("maniglia");
  });

  it("senza recenti mostra solo i suggerimenti", () => {
    render(<RecentSearches recent={[]} onPick={() => undefined} />);
    expect(screen.queryByText("Ricerche recenti")).toBeNull();
    expect(screen.getByText("Prova a cercare")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `pnpm test recent-searches.test` → FAIL.

- [ ] **Step 3: Write minimal implementation** — `src/components/product/recent-searches.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";

const SUGGESTIONS = ["cerniera anta ribalta", "maniglia", "B00590"];
const chipClass =
  "rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

function isCode(q: string) {
  return /^[A-Z]\d/.test(q);
}

export function RecentSearches({
  recent,
  onPick,
}: {
  recent: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
          <h3 id="recent-heading" className="text-xs font-medium text-ink-muted">
            Ricerche recenti
          </h3>
          <ul className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onPick(q)}
                  className={cn(chipClass, isCode(q) && "font-mono")}
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="suggestions-heading" className="flex flex-col gap-2">
        <h3 id="suggestions-heading" className="text-xs font-medium text-ink-muted">
          Prova a cercare
        </h3>
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => onPick(q)}
                className={cn(chipClass, isCode(q) && "font-mono")}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes** — `pnpm test recent-searches.test` → PASS.

- [ ] **Step 5: Integrate in `archivio-client.tsx`** — query recenti + focus management + render nell'empty-state (solo quando la query è vuota).

Import:

```tsx
import { RecentSearches } from "@/components/product/recent-searches";
```

Ref al campo di ricerca + query recenti (dentro il componente, dopo `useArchivioSearch`):

```tsx
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recent = api.product.recentSearches.useQuery(undefined, {
    enabled: committed.query.length === 0,
    staleTime: 0,
  });

  const pickQuery = (q: string) => {
    setQueryInput(q);
    searchInputRef.current?.focus();
  };
```

Collega il ref all'`Input`: aggiungi `ref={searchInputRef}` all'`<Input id="archivio-search" … />`.

Nel ramo empty-state (query vuota), sostituisci il singolo `<EmptyState … />` con l'empty-state + le ricerche recenti:

```tsx
          {committed.query.length === 0 ? (
            <div className="flex flex-col items-center gap-6">
              <EmptyState
                title="Cerca nel catalogo AGB"
                detail="Digita un termine (es. “cerniera anta ribalta”) o un codice prodotto (es. B00590)."
              />
              <RecentSearches recent={recent.data ?? []} onPick={pickQuery} />
            </div>
          ) : search.isPending ? (
```

- [ ] **Step 6: Typecheck + test + build** — `pnpm typecheck && pnpm test && pnpm build` → verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/product/recent-searches.tsx src/components/product/recent-searches.test.tsx "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): ricerche recenti + suggerimenti nell'empty-state"
```

---

### Task 9: `ProductImage` con `fallback` + `ProductThumb`

**Files:**
- Modify: `src/components/product/product-image.tsx`
- Create: `src/components/product/product-thumb.tsx`
- Test: `src/components/product/product-thumb.test.tsx`
- Modify: `src/components/product/product-image.test.tsx` (aggiungi il caso `fallback`)

**Interfaces:**
- Produces: `ProductImage({ code, className, alt?, fallback? })`; `ProductThumb({ code, variant: "row" | "card" })`.

- [ ] **Step 1: Extend `ProductImage`** — `src/components/product/product-image.tsx`

```tsx
"use client";

import { useState, type ReactNode } from "react";

/**
 * Foto prodotto estratta dal listino, servita da /api/product-image (dietro auth).
 * `<img>` nativo (i JPEG2000 del listino sono estratti in PNG). Su 404/errore mostra
 * `fallback` (se fornito), altrimenti si nasconde.
 */
export function ProductImage({
  code,
  className,
  alt,
  fallback,
}: {
  code: string;
  className?: string;
  alt?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sorgente dinamica dietro auth, non da ottimizzare
    <img
      src={`/api/product-image?code=${encodeURIComponent(code)}`}
      alt={alt ?? `Foto del prodotto ${code}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
```

- [ ] **Step 2: Add a `fallback` test to `product-image.test.tsx`** — aggiungi questo caso (mantieni gli esistenti):

```tsx
  it("mostra il fallback su errore quando fornito", () => {
    render(<ProductImage code="X" fallback={<span data-testid="ph">ph</span>} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByTestId("ph")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });
```

Assicurati che l'header del file importi `fireEvent`:

```tsx
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
```

- [ ] **Step 3: Write `ProductThumb` failing test** — `src/components/product/product-thumb.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProductThumb } from "./product-thumb";

afterEach(cleanup);

describe("ProductThumb", () => {
  it("mostra un placeholder (box riservato) su errore, non null", () => {
    const { container } = render(<ProductThumb code="B00590" variant="row" />);
    fireEvent.error(screen.getByRole("img"));
    // il box resta: il placeholder è un elemento, non null
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail** — `pnpm test product-thumb product-image` → FAIL (ProductThumb assente).

- [ ] **Step 5: Write `ProductThumb`** — `src/components/product/product-thumb.tsx`

```tsx
"use client";

import { Package } from "lucide-react";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/utils";

/** Thumbnail a dimensioni FISSE (riserva il box → niente layout-shift → protegge lo scroll restore). */
export function ProductThumb({ code, variant }: { code: string; variant: "row" | "card" }) {
  const box = variant === "row" ? "size-10 shrink-0" : "h-28 w-full";
  return (
    <ProductImage
      code={code}
      alt=""
      className={cn("rounded border border-line bg-white object-contain", box)}
      fallback={
        <span className={cn("grid place-items-center rounded border border-line bg-surface-sunken", box)}>
          <Package className="size-4 text-ink-subtle" aria-hidden />
        </span>
      }
    />
  );
}
```

- [ ] **Step 6: Run tests to verify they pass** — `pnpm test product-thumb product-image` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/product/product-image.tsx src/components/product/product-image.test.tsx src/components/product/product-thumb.tsx src/components/product/product-thumb.test.tsx
git commit -m "feat(archivio): ProductImage con fallback + ProductThumb (box riservato)"
```

---

### Task 10: Thumbnail su card e righe (extra #4)

**Files:**
- Modify: `src/components/product/product-card.tsx`
- Modify: `src/components/product/product-row.tsx`

**Interfaces:**
- Consumes: `ProductThumb` (Task 9).

- [ ] **Step 1: Add thumbnail to `ProductCard`** — inserisci `<ProductThumb code={product.agbCode} variant="card" />` come primo figlio del `<Link>`.

Import in testa:

```tsx
import { ProductThumb } from "./product-thumb";
```

Primo figlio del `<Link>` (prima del `<div>` con codice/dot):

```tsx
      <ProductThumb code={product.agbCode} variant="card" />
```

- [ ] **Step 2: Rework `ProductRow`** — sostituisci l'intero file (thumbnail + griglia ridefinita; dot inline col codice):

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, type ProductSummary } from "./product-card";
import { ProductThumb } from "./product-thumb";

export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/archivio/${product.id}`}
      className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b border-line bg-surface px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40 sm:grid-cols-[40px_140px_1fr_auto_auto] sm:gap-4 sm:px-4 sm:py-3"
    >
      <ProductThumb code={product.agbCode} variant="row" />
      <span className="flex items-center gap-1.5 font-mono text-xs text-ink-subtle">
        <AvailabilityDot available={product.isAvailable} />
        <span className="truncate">{product.agbCode}</span>
      </span>
      <span className="truncate text-sm font-medium text-ink">{product.name}</span>
      <span className="hidden rounded bg-surface-sunken px-2 py-0.5 text-xs text-ink-muted sm:inline">
        {product.categoryName}
      </span>
      <span className="text-sm font-semibold tabular-nums text-ink">
        {formatPrice(product.basePrice)}
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: Run the existing card test + typecheck** — `pnpm test product-card && pnpm typecheck` → PASS (il test card verifica codice mono/link/nome/categoria/prezzo/disponibilità, tutti ancora presenti).

- [ ] **Step 4: Build** — `pnpm build` → verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/product/product-card.tsx src/components/product/product-row.tsx
git commit -m "feat(archivio): thumbnail prodotto su card e righe (griglia ridefinita)"
```

---

### Task 11: Verifica browser (≤375px + desktop) + gate finali

**Files:** nessuna modifica salvo eventuali fix emersi.

- [ ] **Step 1: Avvia l'app** — assicurati che DB/Redis siano su (`bash scripts/dev-bootstrap.sh` se serve), poi `pnpm dev`. Login con l'admin seed.

- [ ] **Step 2: Verifica desktop** — su `/archivio`:
  - Cerca «cerniera» → lista lunga; scrolla a metà; apri un prodotto; **Back** → **stessa lista, stessa posizione di scroll**.
  - Passa a **griglia**, scrolla, apri prodotto, Back → posizione ripristinata anche in griglia.
  - **Refresh** con una ricerca attiva + filtri + pagina 2 → tutto mantenuto (query, filtri, vista, pagina, scroll).
  - Chip filtri: aggiungi categoria/prezzo, verifica i chip; rimuovi un chip → URL e risultati aggiornati; **Back non resuscita** il filtro rimosso.
  - Empty-state (svuota la ricerca): compaiono «Ricerche recenti» (dopo qualche ricerca) + «Prova a cercare»; click su un chip → popola e cerca.
  - Thumbnail visibili, lazy, senza scatti; codici senza foto → placeholder.

- [ ] **Step 3: Verifica mobile ≤375px** — DevTools responsive a 375px:
  - Nessun overflow orizzontale; `ProductRow`: thumb + codice + nome troncato + prezzo su una riga; categoria nascosta.
  - Chip filtri vanno a capo; empty-state leggibile.
  - Il ripristino scroll su Back funziona anche a 375px.
  - *(Se lo scroll non si trova su `window` ma su un contenitore interno, adegua `saveScroll`/`window.scrollTo` all'elemento corretto — vedi §4.2 della spec; poi ri-verifica.)*

- [ ] **Step 4: Gate finali**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: tutto verde.

- [ ] **Step 5: Commit finale (se emersi fix)**

```bash
git add -A
git commit -m "test(archivio): verifica browser mobile/desktop + fix scroll container"
```

---

## Self-Review (svolto)

**Spec coverage:** #1 persistenza (Task 1/5/6) · #2 ritorno-lista+scroll (Task 2/5/6, verifica Task 11) · #3 cronologia (Task 3/4/8) · thumbnail (Task 9/10) · chip filtri (Task 7) · empty-state suggerimenti (Task 8). Tutti coperti.

**Placeholder scan:** nessun TBD/TODO; ogni step ha codice completo.

**Type consistency:** `ArchivioFilters`/`ArchivioSearchState` definiti in Task 1 e usati identici in Task 5/7; `clearFilter(...keys)` variadico coerente tra hook (Task 5) e chip (Task 7); `shouldRestoreScroll`/`RestoreGate` coerenti tra Task 2 e Task 6; `recentSearches`/`deriveRecentSearches` coerenti tra Task 3/4/8; `ProductThumb({code,variant})` coerente tra Task 9 e Task 10.
