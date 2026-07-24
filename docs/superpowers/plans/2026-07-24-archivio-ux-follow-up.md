# Archivio UX follow-up (scorciatoia · copia-link · visti-recente · listino-card) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Quattro miglioramenti UX additivi all'Archivio: scorciatoia `/`, «copia link», «visti di recente» (localStorage), pulsante listino sulle card/righe (stretched-link).

**Architecture:** Logica in moduli puri testabili (`is-editable-target`, `recently-viewed`) + piccoli componenti client; nessun backend nuovo. Il pulsante listino riusa `ListinoButton` + il `listinoPage` già presente nella risposta di `product.search`, con markup stretched-link per non annidare un `<button>` in un'`<a>`.

**Tech Stack:** Next.js 15.5, React 19, TS strict, @tanstack/react-query 5, Vitest + @testing-library/react (jsdom), Tailwind.

## Global Constraints
- TS strict; UI italiano; codici in **mono**; mobile-first verificato **≤375px**.
- **Nessuna migrazione, nessuna dipendenza nuova, NESSUNA AZIONE OPS.**
- Gate verdi: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`. Un commit per task.
- Branch: `claude/archivio-ux-persistence-aj3zvy` (estende PR #29).

---

### Task 1: Scorciatoia tastiera `/`

**Files:**
- Create: `src/lib/is-editable-target.ts` (+ `.test.ts`)
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx`

**Interfaces:**
- Produces: `isEditableTarget(target: EventTarget | null): boolean`.

- [ ] **Step 1: Failing test** — `src/lib/is-editable-target.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { isEditableTarget } from "./is-editable-target";

describe("isEditableTarget", () => {
  it("true per input/textarea/select/contenteditable", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
    const ce = document.createElement("div");
    ce.setAttribute("contenteditable", "true");
    expect(isEditableTarget(ce)).toBe(true);
  });
  it("false per div/button/null", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm test is-editable-target`.

- [ ] **Step 3: Implement** — `src/lib/is-editable-target.ts`

```ts
/** True se il target è un campo editabile (per non intercettare le scorciatoie mentre si scrive). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable || target.getAttribute("contenteditable") === "true";
}
```

- [ ] **Step 4: Run → pass** — `pnpm test is-editable-target`.

- [ ] **Step 5: Wire into `archivio-client.tsx`** — aggiungi l'import e un effetto keydown; il `searchInputRef` esiste già.

Import:
```tsx
import { isEditableTarget } from "@/lib/is-editable-target";
```
Effetto (dopo gli altri hook nel componente):
```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isEditableTarget(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
```
Hint `<kbd>` nel campo: aggiungi al componente `<Input …>` la prop `trailingSlot`:
```tsx
              trailingSlot={
                <kbd className="pointer-events-none hidden select-none rounded border border-line-strong bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle sm:inline-block">
                  /
                </kbd>
              }
```

- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm test is-editable-target
git add src/lib/is-editable-target.ts src/lib/is-editable-target.test.ts "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): scorciatoia tastiera / per focalizzare la ricerca"
```

---

### Task 2: «Copia link»

**Files:**
- Create: `src/components/product/copy-link-button.tsx` (+ `.test.tsx`)
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx`

**Interfaces:**
- Produces: `<CopyLinkButton />` (nessuna prop; copia `window.location.href`).

- [ ] **Step 1: Failing test** — `src/components/product/copy-link-button.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CopyLinkButton } from "./copy-link-button";

afterEach(cleanup);

describe("CopyLinkButton", () => {
  it("copia location.href e mostra feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyLinkButton />);
    fireEvent.click(screen.getByRole("button", { name: "Copia link della ricerca" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(screen.getByText("Copiato")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm test copy-link-button`.

- [ ] **Step 3: Implement** — `src/components/product/copy-link-button.tsx`

```tsx
"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non disponibile (contesto non sicuro): no-op
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Link copiato" : "Copia link della ricerca"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors duration-150",
        copied
          ? "border-success/40 bg-success/10 text-success"
          : "border-line-strong text-ink-subtle hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}
```

- [ ] **Step 4: Run → pass** — `pnpm test copy-link-button`.

- [ ] **Step 5: Integrate** — in `archivio-client.tsx` import e sostituisci la riga del conteggio con un flex che ospita il pulsante.

Import:
```tsx
import { CopyLinkButton } from "@/components/product/copy-link-button";
```
Sostituisci il blocco `<p className="text-sm text-ink-subtle" aria-live="polite"> … </p>` con:
```tsx
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-subtle" aria-live="polite">
                  {total} {total === 1 ? "prodotto trovato" : "prodotti trovati"}
                  {search.data ? ` · ${search.data.queryTimeMs} ms` : null}
                </p>
                <CopyLinkButton />
              </div>
```

- [ ] **Step 6: Gate + commit**

```bash
pnpm typecheck && pnpm test copy-link-button
git add src/components/product/copy-link-button.tsx src/components/product/copy-link-button.test.tsx "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): pulsante «copia link» della ricerca"
```

---

### Task 3: «Visti di recente» (localStorage)

**Files:**
- Create: `src/lib/recently-viewed.ts` (+ `.test.ts`)
- Create: `src/components/product/recently-viewed.tsx` (+ `.test.tsx`)
- Modify: `src/components/product/product-detail.tsx` (registra la visita)
- Modify: `src/app/(dashboard)/archivio/archivio-client.tsx` (empty-state)

**Interfaces:**
- Produces: `interface ViewedProduct { id: string; agbCode: string; name: string }`,
  `pushViewed(p: ViewedProduct): void`, `getViewed(): ViewedProduct[]`, `<RecentlyViewed />`.

- [ ] **Step 1: Failing test** — `src/lib/recently-viewed.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushViewed, getViewed } from "./recently-viewed";

beforeEach(() => window.localStorage.clear());
const p = (id: string) => ({ id, agbCode: `A${id}`, name: `Prodotto ${id}` });

describe("recently-viewed", () => {
  it("push: ultimo in testa, dedup per id, cap 8", () => {
    for (let i = 1; i <= 10; i++) pushViewed(p(String(i)));
    pushViewed(p("3")); // re-view → torna in testa senza duplicare
    const list = getViewed();
    expect(list).toHaveLength(8);
    expect(list[0]!.id).toBe("3");
    expect(list.filter((v) => v.id === "3")).toHaveLength(1);
  });

  it("getViewed: scarta voci malformate e [] su JSON rotto", () => {
    window.localStorage.setItem("archivio:recently-viewed", JSON.stringify([{ id: "x" }, p("1")]));
    expect(getViewed()).toEqual([p("1")]);
    window.localStorage.setItem("archivio:recently-viewed", "{non-json");
    expect(getViewed()).toEqual([]);
  });

  it("fail-soft se setItem lancia", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => pushViewed(p("1"))).not.toThrow();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm test recently-viewed`.

- [ ] **Step 3: Implement** — `src/lib/recently-viewed.ts`

```ts
const KEY = "archivio:recently-viewed";
const CAP = 8;

export interface ViewedProduct {
  id: string;
  agbCode: string;
  name: string;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getViewed(): ViewedProduct[] {
  const s = store();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (v): v is ViewedProduct =>
        !!v &&
        typeof (v as ViewedProduct).id === "string" &&
        typeof (v as ViewedProduct).agbCode === "string" &&
        typeof (v as ViewedProduct).name === "string",
    );
  } catch {
    return [];
  }
}

export function pushViewed(p: ViewedProduct): void {
  const s = store();
  if (!s) return;
  try {
    const list = getViewed().filter((v) => v.id !== p.id);
    list.unshift({ id: p.id, agbCode: p.agbCode, name: p.name });
    s.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    // quota/private mode → no-op
  }
}
```

- [ ] **Step 4: Run → pass** — `pnpm test recently-viewed`.

- [ ] **Step 5: Register the view in `product-detail.tsx`** — importa `useEffect` e `pushViewed`, registra quando il prodotto è caricato.

Aggiorna l'import di React (il file è `"use client"`; aggiungi `useEffect`):
```tsx
import { useEffect } from "react";
```
Import helper:
```tsx
import { pushViewed } from "@/lib/recently-viewed";
```
Dopo le due `useQuery` (`product`, `related`), aggiungi:
```tsx
  useEffect(() => {
    if (product.isSuccess) {
      pushViewed({
        id: product.data.id,
        agbCode: product.data.agbCode,
        name: product.data.name,
      });
    }
  }, [product.isSuccess, product.data?.id, product.data?.agbCode, product.data?.name]);
```

- [ ] **Step 6: Component test** — `src/components/product/recently-viewed.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RecentlyViewed } from "./recently-viewed";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("RecentlyViewed", () => {
  it("mostra i prodotti visti con link e codice mono", async () => {
    window.localStorage.setItem(
      "archivio:recently-viewed",
      JSON.stringify([{ id: "p1", agbCode: "B00590", name: "Cerniera" }]),
    );
    render(<RecentlyViewed />);
    expect(await screen.findByText("Visti di recente")).toBeDefined();
    const code = await screen.findByText("B00590");
    expect(code.className).toContain("font-mono");
    expect(screen.getByRole("link")).toHaveProperty("href", expect.stringContaining("/archivio/p1"));
  });

  it("vuoto → non renderizza nulla", () => {
    const { container } = render(<RecentlyViewed />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 7: Run → fail** — `pnpm test recently-viewed.test` (il componente non esiste).

- [ ] **Step 8: Implement component** — `src/components/product/recently-viewed.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getViewed, type ViewedProduct } from "@/lib/recently-viewed";

export function RecentlyViewed() {
  const [items, setItems] = useState<ViewedProduct[]>([]);
  useEffect(() => setItems(getViewed()), []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="viewed-heading" className="flex w-full max-w-md flex-col gap-2">
      <h3 id="viewed-heading" className="text-xs font-medium text-ink-muted">
        Visti di recente
      </h3>
      <ul className="flex flex-col overflow-hidden rounded-md border border-line">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/archivio/${p.id}`}
              className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
            >
              <span className="shrink-0 font-mono text-xs text-ink-subtle">{p.agbCode}</span>
              <span className="truncate text-sm text-ink">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 9: Run → pass** — `pnpm test recently-viewed.test`.

- [ ] **Step 10: Empty-state integration** — in `archivio-client.tsx` importa e rendi `RecentlyViewed` sopra `RecentSearches`.

Import:
```tsx
import { RecentlyViewed } from "@/components/product/recently-viewed";
```
Nel ramo empty-state, dentro il `<div className="flex flex-col items-center gap-6">`, prima di `<RecentSearches …>`:
```tsx
              <RecentlyViewed />
```

- [ ] **Step 11: Gate + commit**

```bash
pnpm typecheck && pnpm test recently-viewed
git add src/lib/recently-viewed.ts src/lib/recently-viewed.test.ts src/components/product/recently-viewed.tsx src/components/product/recently-viewed.test.tsx src/components/product/product-detail.tsx "src/app/(dashboard)/archivio/archivio-client.tsx"
git commit -m "feat(archivio): prodotti visti di recente (localStorage) nell'empty-state"
```

---

### Task 4: Pulsante listino sulle card/righe (stretched-link)

**Files:**
- Modify: `src/components/product/product-card.tsx` (tipo + markup)
- Modify: `src/components/product/product-row.tsx` (markup)
- Modify: `src/components/product/product-card.test.tsx` (estendi)
- Create: `src/components/product/product-row.test.tsx`

**Interfaces:**
- Produces: `ProductSummary` esteso con `listinoPage?: number | null`.
- Consumes: `ListinoButton` (`@/components/listino/listino-button`), `ProductThumb`.

- [ ] **Step 1: Extend + test `product-card.test.tsx`** — aggiungi in testa il mock del provider e un nuovo caso; NON toccare i 3 test esistenti.

In testa al file (dopo gli import):
```tsx
vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: () => undefined }),
}));
```
Assicurati che `vi` sia importato: `import { describe, it, expect, vi, afterEach } from "vitest";`
Nuovo test:
```tsx
  it("con listinoPage mostra il pulsante listino", () => {
    render(<ProductCard product={{ ...product, listinoPage: 42 }} />);
    expect(screen.getByLabelText("Visualizza B00590.15.03 nel listino")).toBeDefined();
  });
```

- [ ] **Step 2: Run → fail** — `pnpm test product-card` (il pulsante non esiste ancora / import mancante).

- [ ] **Step 3: Rewrite `product-card.tsx`** (stretched-link)

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductThumb } from "./product-thumb";
import { ListinoButton } from "@/components/listino/listino-button";

export interface ProductSummary {
  id: string;
  agbCode: string;
  name: string;
  basePrice: number;
  categoryName: string;
  isAvailable: boolean;
  listinoPage?: number | null;
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
    <div className="group relative flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card transition-shadow duration-150 ease-out-quart hover:shadow-pop">
      <ProductThumb code={product.agbCode} variant="card" />
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
      {/* Stretched link: copre la card per la navigazione al dettaglio. */}
      <Link
        href={`/archivio/${product.id}`}
        aria-label={product.name}
        className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      />
      {product.listinoPage != null && (
        <span className="absolute right-2 top-2 z-10 rounded bg-surface/90">
          <ListinoButton code={product.agbCode} page={product.listinoPage} />
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → pass** — `pnpm test product-card` (4 test: i 3 esistenti + il nuovo).

- [ ] **Step 5: Rewrite `product-row.tsx`** (stretched-link + listino desktop)

```tsx
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { AvailabilityDot, type ProductSummary } from "./product-card";
import { ProductThumb } from "./product-thumb";
import { ListinoButton } from "@/components/listino/listino-button";

export function ProductRow({ product }: { product: ProductSummary }) {
  return (
    <div className="group relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 border-b border-line bg-surface px-3 py-2.5 transition-colors last:border-b-0 hover:bg-surface-sunken sm:grid-cols-[40px_140px_1fr_auto_auto_auto] sm:gap-4 sm:px-4 sm:py-3">
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
      {/* Colonna listino: solo desktop (evita affollamento a 375px); riservata per allineamento. */}
      <span className="z-10 hidden justify-self-end sm:inline-flex">
        {product.listinoPage != null && (
          <ListinoButton code={product.agbCode} page={product.listinoPage} />
        )}
      </span>
      <Link
        href={`/archivio/${product.id}`}
        aria-label={product.name}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40"
      />
    </div>
  );
}
```

- [ ] **Step 6: Test `product-row.test.tsx`**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/listino/listino-viewer-provider", () => ({
  useListinoViewer: () => ({ open: () => undefined }),
}));

import { ProductRow } from "./product-row";

afterEach(cleanup);

const base = {
  id: "p1",
  agbCode: "B00590.15.03",
  name: "Cerniera X",
  basePrice: 1.23,
  categoryName: "Serrature",
  isAvailable: true,
};

describe("ProductRow", () => {
  it("linka al dettaglio, codice mono, senza listinoPage niente pulsante", () => {
    render(<ProductRow product={base} />);
    expect(screen.getByRole("link")).toHaveProperty(
      "href",
      expect.stringContaining("/archivio/p1"),
    );
    expect(screen.getByText("B00590.15.03").className).toContain("font-mono");
    expect(screen.queryByLabelText(/nel listino/)).toBeNull();
  });

  it("con listinoPage mostra il pulsante listino", () => {
    render(<ProductRow product={{ ...base, listinoPage: 42 }} />);
    expect(screen.getByLabelText("Visualizza B00590.15.03 nel listino")).toBeDefined();
  });
});
```

- [ ] **Step 7: Run → pass** — `pnpm test product-row product-card`.

- [ ] **Step 8: Gate + commit**

```bash
pnpm typecheck && pnpm lint && pnpm test product-card product-row
git add src/components/product/product-card.tsx src/components/product/product-row.tsx src/components/product/product-card.test.tsx src/components/product/product-row.test.tsx
git commit -m "feat(archivio): pulsante «visualizza nel listino» su card e righe (stretched-link)"
```

---

### Task 5: Gate finali + verifica browser

- [ ] **Step 1: Gate completi** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → tutti verdi.

- [ ] **Step 2: Verifica browser (Chromium, desktop + ≤375px)** — con lo stack locale (Docker Postgres/Redis, `next start`) e prodotti fittizi di cui **alcuni con `listino_page` valorizzato**:
  - `/` con focus fuori campo → focalizza la barra e NON scrive `/`; `Esc` la sfoca.
  - «Copia link» → clip = URL corrente (con `?q=…`) + «Copiato ✓».
  - «Visti di recente»: apri 2-3 prodotti, svuota la ricerca → compaiono nell'empty-state, in ordine, senza duplicati, cliccabili.
  - Card: clic sulla card → dettaglio; clic sul pulsante listino → apre il viewer **senza** navigare.
  - Riga (desktop): pulsante listino apre il viewer; (mobile 375px): nessun pulsante listino, nessun overflow orizzontale.

- [ ] **Step 3: Commit finale (se fix)** e push del branch.

```bash
git push -u origin claude/archivio-ux-persistence-aj3zvy
```

---

## Self-Review (svolto)
- **Spec coverage:** A (Task 1) · B (Task 2) · C (Task 3) · D (Task 4) · verifica (Task 5). Tutto coperto.
- **Placeholder scan:** nessun TBD/TODO; codice completo in ogni step.
- **Type consistency:** `ViewedProduct`/`pushViewed`/`getViewed` coerenti (Task 3); `ProductSummary.listinoPage?` definito in Task 4 e usato in card+row; `isEditableTarget` firma coerente (Task 1); mock `useListinoViewer` coerente tra card e row test.
