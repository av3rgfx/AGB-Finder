# Fase 1e — Dashboard dati reali — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la dashboard placeholder con dati reali via tRPC (KPI, ultime richieste kit, scorciatoie, toggle team per ADMIN).

**Architecture:** Nuovo router `dashboard.overview` (Prisma count/findMany, scope mine|team) → client component `DashboardClient` con react-query, toggle admin e stati loading/empty/error. `page.tsx` resta shell server che passa `firstName`/`isAdmin`. Nessuna modifica a `schema.prisma`.

**Tech Stack:** Next.js 15 App Router, tRPC v11, `@tanstack/react-query` v5, Prisma 6, Vitest + testing-library, Tailwind.

## Global Constraints

- TypeScript strict sempre.
- Tutte le API via tRPC; tutte le query via Prisma (niente raw SQL qui).
- UI in italiano; codici prodotto in font mono (`font-mono`).
- Procedura AGENT+: `agentProcedure` da `@/server/api/trpc`.
- Date/valuta sempre via `src/lib/format.ts` (fuso `Europe/Rome`, `it-IT`).
- Un commit per task; gate finali: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- Ambiente: prima di comandi prisma/tsx `set -a; source .env; set +a` (non serve per typecheck/test/lint).

## File Structure

**Nuovi**
- `src/server/api/routers/dashboard.ts` — router `overview` (unica query).
- `src/server/api/routers/dashboard.test.ts` — unit test router.
- `src/app/(dashboard)/dashboard/dashboard-client.tsx` — client component.
- `src/app/(dashboard)/dashboard/dashboard-client.test.tsx` — test componente.

**Modificati**
- `src/lib/format.ts` — aggiunge `startOfTodayRome`.
- `src/lib/format.test.ts` — test dell'helper.
- `src/server/api/root.ts` — registra `dashboard`.
- `src/app/(dashboard)/dashboard/page.tsx` — shell server → monta il client.

---

### Task 1: Helper `startOfTodayRome`

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces: `startOfTodayRome(now?: Date): Date` — istante UTC della mezzanotte odierna a Roma (DST inclusa). Usato dal router per i conteggi "oggi".

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/lib/format.test.ts` (adegua l'`import` in cima al file per includere `startOfTodayRome`):

```ts
import { startOfTodayRome } from "./format";

describe("startOfTodayRome", () => {
  it("inverno (CET, +1) → mezzanotte Roma = 23:00Z del giorno prima", () => {
    const r = startOfTodayRome(new Date("2026-01-15T10:00:00Z"));
    expect(r.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("estate (CEST, +2) → mezzanotte Roma = 22:00Z del giorno prima", () => {
    const r = startOfTodayRome(new Date("2026-07-06T10:00:00Z"));
    expect(r.toISOString()).toBe("2026-07-05T22:00:00.000Z");
  });

  it("subito dopo mezzanotte Roma (ancora giorno UTC precedente) → confine ≤ now e cattura il giorno di Roma", () => {
    const now = new Date("2026-07-05T22:30:00Z"); // Roma 2026-07-06 00:30 CEST
    const r = startOfTodayRome(now);
    expect(r.toISOString()).toBe("2026-07-05T22:00:00.000Z");
    expect(r.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
```

- [ ] **Step 2: Esegui il test → deve fallire**

Run: `pnpm test -- src/lib/format.test.ts`
Expected: FAIL (`startOfTodayRome is not a function` / export mancante).

- [ ] **Step 3: Implementa l'helper**

Aggiungi in fondo a `src/lib/format.ts`:

```ts
/**
 * Istante UTC corrispondente alla mezzanotte odierna a Roma (DST inclusa).
 * Il server (Vercel) è in UTC, ma "oggi" per l'utente è il giorno di calendario
 * italiano: serve ai conteggi "oggi" della dashboard.
 */
export function startOfTodayRome(now: Date = new Date()): Date {
  // Data-calendario di Roma per `now`, es. "2026-07-06".
  const romeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  // Mezzanotte di quella data interpretata come UTC, poi corretta dell'offset di Roma.
  const asUtc = new Date(`${romeDate}T00:00:00Z`);
  const romeShown = new Date(asUtc.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  const utcShown = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = romeShown.getTime() - utcShown.getTime();
  return new Date(asUtc.getTime() - offsetMs);
}
```

- [ ] **Step 4: Esegui il test → deve passare**

Run: `pnpm test -- src/lib/format.test.ts`
Expected: PASS (tutti i test, inclusi quelli preesistenti di `formatPrice`/`formatDate`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat(fase1e): helper startOfTodayRome per confine giorno Europe/Rome"
```

---

### Task 2: Router `dashboard.overview`

**Files:**
- Create: `src/server/api/routers/dashboard.ts`
- Create: `src/server/api/routers/dashboard.test.ts`
- Modify: `src/server/api/root.ts`

**Interfaces:**
- Consumes: `startOfTodayRome` (Task 1); `agentProcedure`, `createTRPCRouter` da `@/server/api/trpc`.
- Produces: `dashboardRouter` con `overview` — input `{ scope: "mine" | "team" }` (default `"mine"`). Output:
  ```ts
  {
    scope: "mine" | "team";
    isAdmin: boolean;
    stats: {
      richieste:       { total: number; today: number };
      kitGenerati:     { total: number; today: number };
      conversazioni:   { total: number; today: number };
      prodottiCercati: { total: number; today: number };
    };
    recentKits: Array<{
      id: string; requestNumber: string; status: string;
      createdAt: Date; totalPrice: number | null; customerName: string | null;
    }>;
  }
  ```

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `src/server/api/routers/dashboard.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCRouter, createCallerFactory, type TRPCContext } from "@/server/api/trpc";
import { dashboardRouter } from "./dashboard";

const appRouter = createTRPCRouter({ dashboard: dashboardRouter });

const kitCount = vi.fn();
const convCount = vi.fn();
const logCount = vi.fn();
const kitFindMany = vi.fn();

const dbStub = {
  kitRequest: { count: kitCount, findMany: kitFindMany },
  conversation: { count: convCount },
  activityLog: { count: logCount },
};

const makeCtx = (session: unknown): TRPCContext =>
  ({ db: dbStub, session, headers: new Headers() }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };
const admin = { user: { id: "admin1", role: "ADMIN", status: "ACTIVE" } };

beforeEach(() => {
  for (const fn of [kitCount, convCount, logCount, kitFindMany]) fn.mockReset();
  kitCount.mockResolvedValue(0);
  convCount.mockResolvedValue(0);
  logCount.mockResolvedValue(0);
  kitFindMany.mockResolvedValue([]);
});

describe("dashboard.overview", () => {
  it("senza sessione → UNAUTHORIZED", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.dashboard.overview({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("scope mine → tutte le count filtrano per l'utente", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.scope).toBe("mine");
    expect(kitCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
    expect(convCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
    expect(logCount.mock.calls[0]![0].where).toMatchObject({ userId: "agent1", type: "PRODUCT_SEARCHED" });
    expect(kitFindMany.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
  });

  it("ADMIN scope team → count senza filtro utente", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    const out = await caller.dashboard.overview({ scope: "team" });
    expect(out.scope).toBe("team");
    expect(kitCount.mock.calls[0]![0].where).not.toHaveProperty("agentId");
    expect(convCount.mock.calls[0]![0].where).not.toHaveProperty("agentId");
    expect(logCount.mock.calls[0]![0].where).not.toHaveProperty("userId");
    expect(logCount.mock.calls[0]![0].where).toMatchObject({ type: "PRODUCT_SEARCHED" });
  });

  it("AGENT che forza scope team → ridotto a mine", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "team" });
    expect(out.scope).toBe("mine");
    expect(kitCount.mock.calls[0]![0].where).toMatchObject({ agentId: "agent1" });
  });

  it("kitGenerati conta generatedAt not null", async () => {
    kitCount.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      const gen = where.generatedAt as { not?: unknown } | undefined;
      if (gen && "not" in gen) return Promise.resolve(7);
      return Promise.resolve(20);
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.stats.kitGenerati.total).toBe(7);
    expect(out.stats.richieste.total).toBe(20);
  });

  it("i conteggi 'oggi' filtrano per createdAt >= inizio giornata", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.dashboard.overview({ scope: "mine" });
    const todayCall = kitCount.mock.calls.find(
      ([arg]) => (arg.where as { createdAt?: unknown }).createdAt,
    );
    expect((todayCall![0].where.createdAt as { gte: Date }).gte).toBeInstanceOf(Date);
  });

  it("recentKits mappa Decimal→number e customerName", async () => {
    kitFindMany.mockResolvedValue([
      {
        id: "k1", requestNumber: "KIT-2026-0001", status: "COMPLETED",
        createdAt: new Date("2026-07-06T08:00:00Z"),
        totalPrice: { toString: () => "90.2" }, customer: { companyName: "ACME Srl" },
      },
      {
        id: "k2", requestNumber: "KIT-2026-0002", status: "DRAFT",
        createdAt: new Date("2026-07-06T09:00:00Z"), totalPrice: null, customer: null,
      },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const out = await caller.dashboard.overview({ scope: "mine" });
    expect(out.recentKits[0]).toMatchObject({
      requestNumber: "KIT-2026-0001", totalPrice: 90.2, customerName: "ACME Srl",
    });
    expect(out.recentKits[1]).toMatchObject({ totalPrice: null, customerName: null });
  });
});
```

- [ ] **Step 2: Esegui il test → deve fallire**

Run: `pnpm test -- src/server/api/routers/dashboard.test.ts`
Expected: FAIL (`Cannot find module './dashboard'`).

- [ ] **Step 3: Implementa il router**

Crea `src/server/api/routers/dashboard.ts`:

```ts
import { z } from "zod";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";
import { startOfTodayRome } from "@/lib/format";

export const dashboardRouter = createTRPCRouter({
  overview: agentProcedure
    .input(z.object({ scope: z.enum(["mine", "team"]).default("mine") }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isAdmin = ctx.session.user.role === "ADMIN";
      const scope: "mine" | "team" = isAdmin ? input.scope : "mine";
      const since = startOfTodayRome();

      // Filtri di scope: mine = solo i propri record; team = tutti gli agenti.
      const kitWhere = scope === "mine" ? { agentId: userId } : {};
      const convWhere = scope === "mine" ? { agentId: userId } : {};
      const logWhere = scope === "mine" ? { userId } : {};

      const [
        richiesteTotal,
        richiesteToday,
        kitGenTotal,
        kitGenToday,
        convTotal,
        convToday,
        searchTotal,
        searchToday,
        recent,
      ] = await Promise.all([
        ctx.db.kitRequest.count({ where: kitWhere }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, createdAt: { gte: since } } }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, generatedAt: { not: null } } }),
        ctx.db.kitRequest.count({ where: { ...kitWhere, generatedAt: { gte: since } } }),
        ctx.db.conversation.count({ where: convWhere }),
        ctx.db.conversation.count({ where: { ...convWhere, createdAt: { gte: since } } }),
        ctx.db.activityLog.count({ where: { ...logWhere, type: "PRODUCT_SEARCHED" } }),
        ctx.db.activityLog.count({
          where: { ...logWhere, type: "PRODUCT_SEARCHED", createdAt: { gte: since } },
        }),
        ctx.db.kitRequest.findMany({
          where: kitWhere,
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { customer: { select: { companyName: true } } },
        }),
      ]);

      return {
        scope,
        isAdmin,
        stats: {
          richieste: { total: richiesteTotal, today: richiesteToday },
          kitGenerati: { total: kitGenTotal, today: kitGenToday },
          conversazioni: { total: convTotal, today: convToday },
          prodottiCercati: { total: searchTotal, today: searchToday },
        },
        recentKits: recent.map((k) => ({
          id: k.id,
          requestNumber: k.requestNumber,
          status: k.status,
          createdAt: k.createdAt,
          totalPrice: k.totalPrice === null ? null : Number(k.totalPrice),
          customerName: k.customer?.companyName ?? null,
        })),
      };
    }),
});
```

Registra il router in `src/server/api/root.ts`: aggiungi l'import
`import { dashboardRouter } from "@/server/api/routers/dashboard";` e la riga
`dashboard: dashboardRouter,` dentro `createTRPCRouter({ ... })`.

- [ ] **Step 4: Esegui il test → deve passare**

Run: `pnpm test -- src/server/api/routers/dashboard.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: nessun errore (il router è ora nel tipo `AppRouter`).

- [ ] **Step 6: Commit**

```bash
git add src/server/api/routers/dashboard.ts src/server/api/routers/dashboard.test.ts src/server/api/root.ts
git commit -m "feat(fase1e): router dashboard.overview (KPI + ultime richieste, scope mine/team)"
```

---

### Task 3: `DashboardClient` + shell `page.tsx`

**Files:**
- Create: `src/app/(dashboard)/dashboard/dashboard-client.tsx`
- Create: `src/app/(dashboard)/dashboard/dashboard-client.test.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `api.dashboard.overview.useQuery` (Task 2); `formatDate`/`formatPrice` (`@/lib/format`); `StatusBadge` (`@/components/kit/status-badge`).
- Produces: `DashboardClient({ firstName: string; isAdmin: boolean })`.

- [ ] **Step 1: Scrivi il test che fallisce**

Crea `src/app/(dashboard)/dashboard/dashboard-client.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const overviewQuery = vi.fn();
const refetch = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: { dashboard: { overview: { useQuery: () => overviewQuery() } } },
}));

import { DashboardClient } from "./dashboard-client";

const data = {
  scope: "mine",
  isAdmin: false,
  stats: {
    richieste: { total: 12, today: 3 },
    kitGenerati: { total: 5, today: 0 },
    conversazioni: { total: 8, today: 1 },
    prodottiCercati: { total: 40, today: 2 },
  },
  recentKits: [
    {
      id: "k1", requestNumber: "KIT-2026-0001", status: "COMPLETED",
      createdAt: "2026-07-06T08:00:00Z", totalPrice: 90.2, customerName: "ACME Srl",
    },
  ],
};

afterEach(() => {
  cleanup();
  overviewQuery.mockReset();
  refetch.mockReset();
});

describe("DashboardClient", () => {
  it("mostra i KPI con totale e '+N oggi', omette '+0 oggi'", () => {
    overviewQuery.mockReturnValue({ data, isPending: false, isError: false, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Richieste")).toBeTruthy();
    expect(screen.getByText("+3 oggi")).toBeTruthy();
    expect(screen.queryByText("+0 oggi")).toBeNull();
  });

  it("il toggle 'Ambito dati' è visibile solo per ADMIN", () => {
    overviewQuery.mockReturnValue({ data, isPending: false, isError: false, refetch });
    const r1 = render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.queryByRole("group", { name: "Ambito dati" })).toBeNull();
    r1.unmount();
    render(<DashboardClient firstName="Marco" isAdmin={true} />);
    expect(screen.getByRole("group", { name: "Ambito dati" })).toBeTruthy();
  });

  it("stato vuoto: nessuna richiesta recente", () => {
    overviewQuery.mockReturnValue({
      data: { ...data, recentKits: [] }, isPending: false, isError: false, refetch,
    });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("Nessuna richiesta recente")).toBeTruthy();
  });

  it("stato errore mostra 'Riprova' e richiama refetch", () => {
    overviewQuery.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("stato loading: label presenti ma nessun valore numerico", () => {
    overviewQuery.mockReturnValue({ data: undefined, isPending: true, isError: false, refetch });
    render(<DashboardClient firstName="Marco" isAdmin={false} />);
    expect(screen.getByText("Richieste")).toBeTruthy();
    expect(screen.queryByText("12")).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui il test → deve fallire**

Run: `pnpm test -- src/app/(dashboard)/dashboard/dashboard-client.test.tsx`
Expected: FAIL (`Cannot find module './dashboard-client'`).

- [ ] **Step 3: Implementa il componente**

Crea `src/app/(dashboard)/dashboard/dashboard-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  PackageCheck,
  MessageSquare,
  Search,
  Bot,
  Plus,
  Package,
  Inbox,
} from "lucide-react";
import { api } from "@/trpc/react";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/kit/status-badge";

type Scope = "mine" | "team";
type StatKey = "richieste" | "kitGenerati" | "conversazioni" | "prodottiCercati";
interface Stat {
  total: number;
  today: number;
}

const KPI_META: { key: StatKey; label: string; icon: LucideIcon }[] = [
  { key: "richieste", label: "Richieste", icon: ClipboardList },
  { key: "kitGenerati", label: "Kit generati", icon: PackageCheck },
  { key: "conversazioni", label: "Conversazioni AI", icon: MessageSquare },
  { key: "prodottiCercati", label: "Prodotti cercati", icon: Search },
];

export function DashboardClient({ firstName, isAdmin }: { firstName: string; isAdmin: boolean }) {
  const [scope, setScope] = useState<Scope>("mine");
  const overview = api.dashboard.overview.useQuery({ scope: isAdmin ? scope : "mine" });

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Ciao{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">Ecco una panoramica della tua attività.</p>
        </div>
        {isAdmin ? <ScopeToggle scope={scope} onChange={setScope} /> : null}
      </div>

      {overview.isError ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Errore nel caricamento della dashboard.{" "}
          <button
            type="button"
            onClick={() => void overview.refetch()}
            className="font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
          >
            Riprova
          </button>
        </div>
      ) : null}

      <section aria-label="Statistiche" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPI_META.map((k) => (
          <StatCard
            key={k.key}
            label={k.label}
            icon={k.icon}
            stat={overview.data?.stats[k.key]}
            loading={overview.isPending}
          />
        ))}
      </section>

      <RecentKits items={overview.data?.recentKits ?? []} loading={overview.isPending} />

      <Shortcuts />
    </div>
  );
}

function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <div
      role="group"
      aria-label="Ambito dati"
      className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm"
    >
      {(["mine", "team"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={scope === s}
          onClick={() => onChange(s)}
          className={
            scope === s
              ? "rounded px-3 py-1.5 font-medium bg-brand text-white"
              : "rounded px-3 py-1.5 font-medium text-ink-subtle hover:text-ink"
          }
        >
          {s === "mine" ? "I miei" : "Team"}
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  icon: Icon,
  stat,
  loading,
}: {
  label: string;
  icon: LucideIcon;
  stat?: Stat;
  loading: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-5 shadow-card">
      <span className="grid size-8 place-items-center rounded-md bg-brand/[0.08] text-brand">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      {loading ? (
        <span className="mt-3 block h-9 w-16 animate-pulse rounded bg-surface-sunken" aria-hidden />
      ) : (
        <p className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">
          {stat?.total ?? "—"}
        </p>
      )}
      <p className="mt-0.5 text-sm text-ink-subtle">{label}</p>
      {!loading && stat && stat.today > 0 ? (
        <p className="mt-1 text-xs font-medium text-brand tabular-nums">+{stat.today} oggi</p>
      ) : null}
    </div>
  );
}

interface RecentKit {
  id: string;
  requestNumber: string;
  status: string;
  createdAt: Date | string;
  totalPrice: number | null;
  customerName: string | null;
}

function RecentKits({ items, loading }: { items: RecentKit[]; loading: boolean }) {
  return (
    <section className="rounded-md border border-line bg-surface shadow-card">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-ink">Ultime richieste kit</h2>
        <Link href="/richieste" className="text-sm font-medium text-brand hover:underline">
          Vedi tutte
        </Link>
      </header>
      {loading ? (
        <div className="flex flex-col" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
              <span className="h-3 w-28 animate-pulse rounded bg-surface-sunken" />
              <span className="h-3 flex-1 animate-pulse rounded bg-surface-sunken" />
              <span className="h-3 w-16 animate-pulse rounded bg-surface-sunken" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-subtle">
            <Inbox className="size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-ink">Nessuna richiesta recente</p>
          <p className="max-w-xs text-sm text-ink-subtle">
            I kit che genererai appariranno qui, con cliente, data e stato.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((k) => (
            <li key={k.id}>
              <Link
                href={`/richieste/${k.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-sunken/50 focus-visible:outline-none focus-visible:bg-surface-sunken/50"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm text-ink">{k.requestNumber}</span>
                  <span className="ml-2 text-sm text-ink-subtle">
                    {k.customerName ?? "Cliente non assegnato"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden text-sm text-ink-subtle sm:inline">{formatDate(k.createdAt)}</span>
                  <StatusBadge status={k.status} />
                  <span className="w-20 text-right text-sm font-medium tabular-nums text-ink">
                    {k.totalPrice === null ? "—" : formatPrice(k.totalPrice)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Shortcuts() {
  const links: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
    { href: "/assistente", label: "Chiedi all'assistente", desc: "Cerca prodotti e genera risposte con l'AI", icon: Bot },
    { href: "/richieste/nuova", label: "Nuova richiesta kit", desc: "Genera la distinta componenti", icon: Plus },
    { href: "/archivio", label: "Cerca a catalogo", desc: "Sfoglia il catalogo prodotti AGB", icon: Package },
  ];
  return (
    <section aria-label="Scorciatoie" className="grid gap-4 sm:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group flex flex-col gap-2 rounded-md border border-line bg-surface p-5 shadow-card transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="grid size-9 place-items-center rounded-md bg-brand/[0.08] text-brand">
            <l.icon className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-ink group-hover:text-brand">{l.label}</span>
          <span className="text-sm text-ink-subtle">{l.desc}</span>
        </Link>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test → deve passare**

Run: `pnpm test -- src/app/(dashboard)/dashboard/dashboard-client.test.tsx`
Expected: PASS (5 test).

- [ ] **Step 5: Collega la shell `page.tsx`**

Sostituisci l'intero contenuto di `src/app/(dashboard)/dashboard/page.tsx` con:

```tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/server/auth/config";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "Dashboard — UFPtrade" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const firstName = session?.user.firstName ?? "";
  const isAdmin = session?.user.role === "ADMIN";
  return <DashboardClient firstName={firstName} isAdmin={isAdmin} />;
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/dashboard/dashboard-client.tsx" "src/app/(dashboard)/dashboard/dashboard-client.test.tsx" "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(fase1e): dashboard dati reali (KPI, ultime richieste, scorciatoie, toggle team)"
```

---

### Task 4: Verifica finale (4 gate)

**Files:** nessuna modifica di codice (solo esecuzione gate). Correggi inline eventuali fallimenti nel task pertinente.

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: nessun errore.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: nessun errore/warning (NB: non incanalare con `| tail` — maschera l'exit code).

- [ ] **Step 3: Test suite completa**

Run: `pnpm test`
Expected: PASS, incluso il conteggio precedente (183) + i nuovi test di Task 1–3.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build ok. (Se `next dev` sta girando, riavviarlo dopo: il build invalida `.next`.)

- [ ] **Step 5: (Consigliato) verifica browser**

Login → `/dashboard`: card con valori reali, "+N oggi" dove presente, "Ultime richieste kit" cliccabili verso il dettaglio, scorciatoie funzionanti (Assistente/Nuova richiesta/Archivio). Con utente ADMIN: toggle "I miei / Team" che ricarica i dati.

---

## Note di verifica del piano (self-review)

- **Copertura spec**: helper `startOfTodayRome` (T1) · router scope mine/team + coercizione non-admin + `generatedAt not null` + recentKits mapping (T2) · client con 4 KPI, "+N oggi", toggle solo admin, RecentKits (empty/loading/rows), Shortcuts, stati loading/error, shell page (T3) · gate (T4). Nessuna modifica a `schema.prisma` (confermato: tutti i dati esistono).
- **Fuori scope (YAGNI)**: grafici/trend, filtri data custom, export, cache dei conteggi, metriche inventate — esclusi come da spec.
- **Coerenza tipi**: chiavi `stats` (`richieste`/`kitGenerati`/`conversazioni`/`prodottiCercati`) identiche tra output router, `StatKey`/`KPI_META` e mock di test; `recentKits` shape identica tra router e `RecentKit`.
