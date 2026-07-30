# Scontistica cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mostrare su ogni distinta kit **quello che il cliente paga**, non solo il lordo di listino AGB.

**Architecture:** un'anagrafica clienti minima (ragione sociale + sconto %) porta il **default**; la richiesta conserva lo sconto **davvero applicato** in una colonna propria, modificabile anche a distinta generata. Le righe della distinta restano al lordo: lo sconto compare solo nel riepilogo, calcolato da un modulo puro in centesimi interi. Una soglia configurabile da ADMIN produce un **avviso, mai un blocco**.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · tRPC v11 · Prisma 6 + PostgreSQL · Tailwind 3 · Vitest · pnpm 10.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-30-scontistica-cliente-design.md`.

## Global Constraints

- **TypeScript strict** sempre. Nessun `any`, nessun `@ts-expect-error` non motivato.
- **Tutte le API via tRPC**; nessun `fetch` diretto dal client.
- **Tutte le query via Prisma**. Raw SQL solo per pgvector (non tocca questo lavoro).
- **UI in italiano.** Codici prodotto in font monospace.
- **Mobile-first**: ogni schermata nuova o modificata va progettata e **verificata a ≤ 375px**, oltre che desktop. Nessuna funzione nascosta o inutilizzabile su mobile.
- **Il kit engine è deterministico e resta intatto**: lo sconto **non entra** in `kitInputSchema` né in `KitEngine`. È un dato commerciale, non un parametro di distinta.
- **Prezzi in centesimi interi**, mai float. Il catalogo fa già così (`parsePriceCents`).
- **Invarianti da non rompere:** golden anta-ribalta **16 righe / 21 pezzi / 90,20 €** di lordo; gemello entrata 7,5 **96,29 €**.
- **Un commit per task.** Messaggi in italiano, imperativo, senza accenti nei backtick di shell.
- **Gate finali:** `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.
- **Ambiente:** prima di ogni comando `prisma`/`tsx` fare `set -a; source .env; set +a`. Se il DB non risponde: `bash scripts/dev-bootstrap.sh`.

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `src/server/pricing/discount.ts` | **creare** — aritmetica pura dello sconto, in centesimi | 1 |
| `src/server/pricing/discount.test.ts` | **creare** — test puri | 1 |
| `prisma/schema.prisma` | **modificare** — `KitRequest.discountPercent` | 2 |
| `prisma/migrations/<ts>_kit_discount_percent/migration.sql` | **creare** (generata) | 2 |
| `src/server/settings/discount-threshold.ts` | **creare** — lettura/scrittura della soglia in `Settings` | 3 |
| `src/server/settings/discount-threshold.test.ts` | **creare** | 3 |
| `src/server/api/routers/settings.ts` | **modificare** — sotto-router `discountThreshold` | 3 |
| `src/server/api/routers/customer.ts` | **creare** — CRUD minima | 4 |
| `src/server/api/routers/customer.test.ts` | **creare** | 4 |
| `src/server/api/root.ts` | **modificare** — registra `customer` | 4 |
| `src/server/api/routers/kit.ts` | **modificare** — `create` con `customerId`, `get` col netto, `ricalcola` porta lo sconto, `setDiscount` | 5, 6 |
| `src/server/api/routers/kit.test.ts` | **modificare** — 8 call site + casi nuovi | 5, 6 |
| `src/components/kit/customer-picker.tsx` | **creare** — selettore + creazione in linea | 7 |
| `src/components/kit/customer-picker.test.tsx` | **creare** | 7 |
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | **modificare** — cliente nel passo 1 e nel riepilogo | 7 |
| `src/components/kit/riepilogo-sconto.tsx` | **creare** — lordo → sconto → netto + editor | 8 |
| `src/components/kit/riepilogo-sconto.test.tsx` | **creare** | 8 |
| `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx` | **modificare** — monta il riepilogo | 8 |
| `src/app/(dashboard)/impostazioni/impostazioni-client.tsx` | **modificare** — sezione soglia | 9 |
| `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` | **modificare** — domanda 28 | 10 |
| `handoff.md`, `CLAUDE.md` | **modificare** — stato | 10 |

Il wizard è già a 1096 righe: il selettore cliente nasce come **componente proprio**, non come altre 120 righe dentro quel file. Stessa scelta per il riepilogo sconto, che serve al dettaglio ed è testabile da solo.

---

### Task 1: Aritmetica dello sconto (modulo puro)

Nessun I/O, nessun DB, nessuna dipendenza. È dove vivono i test veri.

**Files:**
- Create: `src/server/pricing/discount.ts`
- Test: `src/server/pricing/discount.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `applicaSconto(lordoCent: number, percent: number | null): { nettoCent: number; scontoCent: number }`
  - `superaSoglia(percent: number | null, soglia: number): boolean`
  - `euroToCent(euro: number): number`
  - `centToEuro(cent: number): number`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/server/pricing/discount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applicaSconto, centToEuro, euroToCent, superaSoglia } from "./discount";

describe("applicaSconto", () => {
  it("il caso del golden: 90,20 € meno 40% fa 54,12 €", () => {
    expect(applicaSconto(9020, 40)).toEqual({ nettoCent: 5412, scontoCent: 3608 });
  });

  it("senza sconto il netto è il lordo", () => {
    expect(applicaSconto(9020, null)).toEqual({ nettoCent: 9020, scontoCent: 0 });
  });

  it("sconto zero è come nessuno sconto", () => {
    expect(applicaSconto(9020, 0)).toEqual({ nettoCent: 9020, scontoCent: 0 });
  });

  it("sconto 100% azzera il netto", () => {
    expect(applicaSconto(9020, 100)).toEqual({ nettoCent: 0, scontoCent: 9020 });
  });

  it("arrotonda il mezzo centesimo per eccesso, una volta sola", () => {
    // 101 × 50 / 100 = 50,5 centesimi
    expect(applicaSconto(101, 50)).toEqual({ nettoCent: 50, scontoCent: 51 });
  });

  it("accetta le percentuali con decimali", () => {
    // 45.055 → 45 centesimi di sconto (arrotondato), netto 55
    expect(applicaSconto(100, 45.5)).toEqual({ nettoCent: 55, scontoCent: 46 });
  });

  it("netto + sconto fa sempre il lordo, su cento percentuali diverse", () => {
    for (let p = 0; p <= 100; p += 1) {
      const { nettoCent, scontoCent } = applicaSconto(9020, p);
      expect(nettoCent + scontoCent).toBe(9020);
    }
  });

  it("un lordo a zero resta a zero", () => {
    expect(applicaSconto(0, 40)).toEqual({ nettoCent: 0, scontoCent: 0 });
  });
});

describe("superaSoglia", () => {
  it("nessuno sconto non può essere fuori soglia", () => {
    expect(superaSoglia(null, 40)).toBe(false);
  });

  it("il confronto è stretto: pari alla soglia è dentro", () => {
    expect(superaSoglia(40, 40)).toBe(false);
  });

  it("sopra la soglia è fuori", () => {
    expect(superaSoglia(40.01, 40)).toBe(true);
  });

  it("sotto la soglia è dentro", () => {
    expect(superaSoglia(39.99, 40)).toBe(false);
  });
});

describe("conversione euro/centesimi", () => {
  it("euroToCent non lascia code di virgola mobile", () => {
    expect(euroToCent(90.2)).toBe(9020);
    expect(euroToCent(0.29)).toBe(29);
    expect(euroToCent(1.005)).toBe(101);
  });

  it("centToEuro torna indietro", () => {
    expect(centToEuro(5412)).toBe(54.12);
    expect(centToEuro(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/pricing/discount.test.ts`
Expected: FAIL — `Failed to resolve import "./discount"`.

- [ ] **Step 3: Scrivere l'implementazione minima**

Creare `src/server/pricing/discount.ts`:

```ts
/**
 * Aritmetica dello sconto cliente.
 *
 * PURO DI PROPOSITO: niente Prisma, niente `server-only`. È aritmetica, e la
 * stessa funzione serve al router e al componente che mostra il riepilogo —
 * duplicarla lato client sarebbe il modo più veloce per far divergere il numero
 * mostrato da quello calcolato.
 *
 * TUTTO IN CENTESIMI INTERI, come già fa il catalogo (`parsePriceCents`). Sui
 * prezzi i float accumulano errore, e `0.1 + 0.2 !== 0.3` smette di essere un
 * aneddoto quando il numero finisce su un preventivo.
 */

/**
 * Applica una percentuale a un totale in centesimi.
 *
 * Si arrotonda **lo sconto**, non il netto, e una volta sola: così
 * `netto + sconto === lordo` per costruzione, e le due cifre che l'agente legge
 * sullo schermo tornano sempre. `Math.round` su un valore non negativo è
 * half-up, che è la convenzione commerciale attesa.
 */
export function applicaSconto(
  lordoCent: number,
  percent: number | null,
): { nettoCent: number; scontoCent: number } {
  if (percent === null || percent === 0) return { nettoCent: lordoCent, scontoCent: 0 };
  const scontoCent = Math.round((lordoCent * percent) / 100);
  return { nettoCent: lordoCent - scontoCent, scontoCent };
}

/**
 * Vero se la percentuale supera la soglia di avviso. Il confronto è **stretto**:
 * una percentuale pari alla soglia è ancora dentro.
 */
export function superaSoglia(percent: number | null, soglia: number): boolean {
  if (percent === null) return false;
  return percent > soglia;
}

/** Euro → centesimi. `Math.round` toglie le code di virgola mobile di `× 100`. */
export function euroToCent(euro: number): number {
  return Math.round(euro * 100);
}

/** Centesimi → euro, con due decimali esatti. */
export function centToEuro(cent: number): number {
  return cent / 100;
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm vitest run src/server/pricing/discount.test.ts`
Expected: PASS — 14 test.

- [ ] **Step 5: Commit**

```bash
git add src/server/pricing/discount.ts src/server/pricing/discount.test.ts
git commit -m "feat(sconto): l'aritmetica dello sconto, in centesimi e senza float"
```

---

### Task 2: La colonna `discountPercent` e la sua migrazione

**Files:**
- Modify: `prisma/schema.prisma` (modello `KitRequest`, dopo `entrata`)
- Create: `prisma/migrations/<timestamp>_kit_discount_percent/migration.sql` (generata da Prisma)

**Interfaces:**
- Consumes: niente.
- Produces: `KitRequest.discountPercent: Prisma.Decimal | null` sul client Prisma; colonna `kit_requests.discount_percent DECIMAL(5,2)`.

- [ ] **Step 1: Aggiungere il campo allo schema**

In `prisma/schema.prisma`, nel modello `KitRequest`, subito **dopo** il blocco `entrata Entrata?` e prima di `openingSide`, inserire:

```prisma
  /// Sconto applicato al cliente, in punti percentuali (42.50 = −42,5%).
  /// NULL = nessuno sconto: la distinta resta al lordo di listino, che è il
  /// comportamento di OGNI riga esistente prima del 2026-07-30 — per questo la
  /// migrazione non ha backfill, a differenza di `entrata`.
  ///
  /// Vive QUI e non solo su `Customer` di proposito: se stesse solo sul cliente,
  /// ritoccarne lo sconto cambierebbe in silenzio il totale di ogni distinta già
  /// mandata. È la stessa ragione per cui il ricalcolo è versionato
  /// (`supersededById`). Il cliente porta il default, la richiesta conserva il
  /// valore davvero applicato.
  ///
  /// Nessun `@default` a livello DB, stesso criterio di `seatConfig` ed
  /// `entrata`: un default DB valorizzerebbe anche le righe che non devono
  /// averlo.
  discountPercent Decimal? @map("discount_percent") @db.Decimal(5, 2)
```

- [ ] **Step 2: Generare la migrazione**

```bash
set -a; source .env; set +a
pnpm exec prisma migrate dev --name kit_discount_percent
```

Expected: crea `prisma/migrations/<timestamp>_kit_discount_percent/migration.sql` contenente esattamente:

```sql
-- AlterTable
ALTER TABLE "kit_requests" ADD COLUMN     "discount_percent" DECIMAL(5,2);
```

Se il comando fallisce con errore di connessione, il DB locale è giù: `bash scripts/dev-bootstrap.sh`, poi ripetere.

- [ ] **Step 3: Verificare che il client Prisma conosca il campo**

```bash
pnpm typecheck
```
Expected: PASS (nessun consumatore ancora, serve solo a confermare che il client è rigenerato).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(sconto): la richiesta si ricorda lo sconto che le e` stato applicato"
```

---

### Task 3: La soglia di avviso, configurabile da ADMIN

`SettingCategory.COMPANY_INFO` esiste già nell'enum e `Settings.value` è `Json` con `isEncrypted` di default `false`: **nessuna migrazione**.

**Files:**
- Create: `src/server/settings/discount-threshold.ts`
- Create: `src/server/settings/discount-threshold.test.ts`
- Modify: `src/server/api/routers/settings.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `SOGLIA_SCONTO_DEFAULT: number` (= 40)
  - `getDiscountThreshold(db: ThresholdDb): Promise<number>`
  - `setDiscountThreshold(db: ThresholdDb, soglia: number, adminUserId: string): Promise<number>`
  - rotte tRPC `settings.discountThreshold.get` (AGENT) e `settings.discountThreshold.set` (ADMIN)

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/server/settings/discount-threshold.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDiscountThreshold,
  setDiscountThreshold,
  SOGLIA_SCONTO_DEFAULT,
  type ThresholdDb,
} from "./discount-threshold";

const findUnique = vi.fn();
const upsert = vi.fn();
const activityCreate = vi.fn();

const db = {
  settings: { findUnique, upsert },
  activityLog: { create: activityCreate },
} as unknown as ThresholdDb;

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset().mockResolvedValue({});
  activityCreate.mockReset().mockResolvedValue({});
});

describe("getDiscountThreshold", () => {
  it("legge il valore salvato", async () => {
    findUnique.mockResolvedValue({ value: 55 });
    await expect(getDiscountThreshold(db)).resolves.toBe(55);
  });

  it("senza riga vale il default", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getDiscountThreshold(db)).resolves.toBe(SOGLIA_SCONTO_DEFAULT);
  });

  it("un valore corrotto a DB non diventa una soglia assurda", async () => {
    // `value` è Json: una stringa, un oggetto o un fuori-scala ci finiscono
    // dentro senza che il DB si lamenti. Meglio il default di una soglia che
    // non avvisa mai.
    for (const rotto of ["quaranta", { a: 1 }, -5, 101, null]) {
      findUnique.mockResolvedValue({ value: rotto });
      await expect(getDiscountThreshold(db)).resolves.toBe(SOGLIA_SCONTO_DEFAULT);
    }
  });

  it("legge la chiave giusta nella categoria giusta", async () => {
    findUnique.mockResolvedValue(null);
    await getDiscountThreshold(db);
    expect(findUnique).toHaveBeenCalledWith({
      where: { category_key: { category: "COMPANY_INFO", key: "DISCOUNT_WARN_THRESHOLD" } },
    });
  });
});

describe("setDiscountThreshold", () => {
  it("salva in chiaro, non cifrato", async () => {
    await setDiscountThreshold(db, 55, "admin1");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: 55, isEncrypted: false, updatedBy: "admin1" }),
        update: expect.objectContaining({ value: 55, isEncrypted: false, updatedBy: "admin1" }),
      }),
    );
  });

  it("lascia traccia nel registro attività", async () => {
    await setDiscountThreshold(db, 55, "admin1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "admin1", type: "SETTINGS_CHANGED" }),
      }),
    );
  });

  it("restituisce la soglia salvata", async () => {
    await expect(setDiscountThreshold(db, 55, "admin1")).resolves.toBe(55);
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/settings/discount-threshold.test.ts`
Expected: FAIL — `Failed to resolve import "./discount-threshold"`.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/server/settings/discount-threshold.ts`:

```ts
import "server-only";
import type { PrismaClient } from "@prisma/client";

/**
 * Soglia oltre la quale lo sconto cliente produce un avviso (mai un blocco).
 *
 * Vive in `Settings` e non in una costante di codice perché è una politica
 * commerciale, non una regola tecnica: cambiarla non deve richiedere un
 * rilascio. `COMPANY_INFO` è già nell'enum `SettingCategory` e `value` è `Json`
 * con `isEncrypted` di default `false` → nessuna migrazione.
 */
const CATEGORY = "COMPANY_INFO" as const;
const KEY = "DISCOUNT_WARN_THRESHOLD";

/**
 * Vale finché nessun ADMIN ne salva una. È la **fonte unica** del default: la
 * UI lo legge da qui e non lo ricopia, altrimenti il giorno che cambia il
 * programma avviserebbe a una soglia e ne mostrerebbe un'altra.
 */
export const SOGLIA_SCONTO_DEFAULT = 40;

export type ThresholdDb = Pick<PrismaClient, "settings" | "activityLog">;

export async function getDiscountThreshold(db: ThresholdDb): Promise<number> {
  const row = await db.settings.findUnique({
    where: { category_key: { category: CATEGORY, key: KEY } },
  });
  const value: unknown = row?.value;
  // `value` è Json: il DB accetta una stringa o un oggetto senza lamentarsi.
  // Una soglia fuori scala o del tipo sbagliato non deve diventare una soglia
  // che non avvisa mai — meglio ricadere sul default.
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
    return value;
  }
  return SOGLIA_SCONTO_DEFAULT;
}

export async function setDiscountThreshold(
  db: ThresholdDb,
  soglia: number,
  adminUserId: string,
): Promise<number> {
  await db.settings.upsert({
    where: { category_key: { category: CATEGORY, key: KEY } },
    create: {
      category: CATEGORY,
      key: KEY,
      value: soglia,
      isEncrypted: false,
      description: "Soglia oltre la quale lo sconto cliente genera un avviso.",
      updatedBy: adminUserId,
    },
    update: { value: soglia, isEncrypted: false, updatedBy: adminUserId },
  });
  await db.activityLog.create({
    data: {
      userId: adminUserId,
      type: "SETTINGS_CHANGED",
      description: `Soglia di avviso sullo sconto impostata a ${soglia}%`,
      resourceType: "settings",
      resourceId: KEY,
    },
  });
  return soglia;
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm vitest run src/server/settings/discount-threshold.test.ts`
Expected: PASS — 7 test.

- [ ] **Step 5: Esporre le due rotte tRPC**

In `src/server/api/routers/settings.ts`:

Cambiare la riga 3 da
```ts
import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
```
a
```ts
import { adminProcedure, agentProcedure, createTRPCRouter } from "@/server/api/trpc";
```

Aggiungere dopo la riga 6 (gli altri import da `@/server/settings/...`):
```ts
import {
  getDiscountThreshold,
  setDiscountThreshold,
} from "@/server/settings/discount-threshold";
```

Aggiungere, dentro `settingsRouter` e **dopo** il blocco `aiKeys: createTRPCRouter({ … }),`:

```ts
  /**
   * La soglia la LEGGE anche un agente: gli serve per sapere quando mostrare
   * l'avviso sullo sconto. La SCRIVE solo un ADMIN — è una politica
   * commerciale, non una preferenza personale.
   */
  discountThreshold: createTRPCRouter({
    get: agentProcedure.query(({ ctx }) => getDiscountThreshold(ctx.db)),

    set: adminProcedure
      .input(
        z.object({
          soglia: z
            .number({ invalid_type_error: "La soglia deve essere un numero." })
            .min(0, "La soglia non può essere negativa.")
            .max(100, "La soglia non può superare 100."),
        }),
      )
      .mutation(({ ctx, input }) =>
        setDiscountThreshold(ctx.db, input.soglia, ctx.session.user.id),
      ),
  }),
```

- [ ] **Step 6: Scrivere il test delle due rotte**

Aggiungere in fondo a `src/server/api/routers/settings.test.ts`.

Prima, estendere il mock esistente in cima al file: dopo la riga
```ts
vi.mock("@/server/ai/redis", () => ({ getRedis: () => ({}) }));
```
aggiungere:
```ts
const { getDiscountThreshold, setDiscountThreshold } = vi.hoisted(() => ({
  getDiscountThreshold: vi.fn().mockResolvedValue(40),
  setDiscountThreshold: vi.fn().mockResolvedValue(55),
}));
vi.mock("@/server/settings/discount-threshold", () => ({
  getDiscountThreshold,
  setDiscountThreshold,
  SOGLIA_SCONTO_DEFAULT: 40,
}));
```

Poi aggiungere in fondo al file:

```ts
describe("settings.discountThreshold", () => {
  it("un AGENT può leggere la soglia (gli serve per l'avviso)", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.settings.discountThreshold.get()).resolves.toBe(40);
  });

  it("un AGENT NON può cambiarla", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.settings.discountThreshold.set({ soglia: 90 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(setDiscountThreshold).not.toHaveBeenCalled();
  });

  it("un ADMIN la cambia", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(caller.settings.discountThreshold.set({ soglia: 55 })).resolves.toBe(55);
    expect(setDiscountThreshold).toHaveBeenCalledWith(expect.anything(), 55, "admin1");
  });

  it("rifiuta una soglia fuori da 0-100", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(admin));
    await expect(
      caller.settings.discountThreshold.set({ soglia: 101 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/settings src/server/api/routers/settings.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/settings/discount-threshold.ts src/server/settings/discount-threshold.test.ts src/server/api/routers/settings.ts src/server/api/routers/settings.test.ts
git commit -m "feat(sconto): la soglia di avviso la decide un admin, non il codice"
```

---

### Task 4: Anagrafica clienti minima

L'anagrafica è **condivisa** fra gli agenti: `Customer` non ha un campo proprietario e non glielo si aggiunge — i clienti sono dell'azienda, non dell'agente.

**Files:**
- Create: `src/server/api/routers/customer.ts`
- Create: `src/server/api/routers/customer.test.ts`
- Modify: `src/server/api/root.ts`

**Interfaces:**
- Consumes: niente.
- Produces: rotte tRPC
  - `customer.list({ search?: string }) → Array<{ id, companyName, discount: number | null }>`
  - `customer.create({ companyName, discount? }) → { id, companyName, discount: number | null }`
  - `customer.update({ id, companyName?, discount? }) → { id, companyName, discount: number | null }`
  - `customer.delete({ id }) → { id }`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/server/api/routers/customer.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCallerFactory, createTRPCRouter, type TRPCContext } from "@/server/api/trpc";
import { customerRouter } from "./customer";

const appRouter = createTRPCRouter({ customer: customerRouter });

const customerFindMany = vi.fn();
const customerCreate = vi.fn();
const customerUpdate = vi.fn();
const customerDelete = vi.fn();
const kitRequestCount = vi.fn();

const makeCtx = (session: unknown): TRPCContext =>
  ({
    db: {
      customer: {
        findMany: customerFindMany,
        create: customerCreate,
        update: customerUpdate,
        delete: customerDelete,
      },
      kitRequest: { count: kitRequestCount },
    },
    session,
    headers: new Headers(),
  }) as unknown as TRPCContext;

const agent = { user: { id: "agent1", role: "AGENT", status: "ACTIVE" } };

beforeEach(() => {
  for (const fn of [customerFindMany, customerCreate, customerUpdate, customerDelete, kitRequestCount]) {
    fn.mockReset();
  }
  customerFindMany.mockResolvedValue([]);
  kitRequestCount.mockResolvedValue(0);
});

describe("autorizzazione", () => {
  it("senza sessione nega", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(null));
    await expect(caller.customer.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("customer.list", () => {
  it("restituisce lo sconto come numero, non come Decimal", async () => {
    customerFindMany.mockResolvedValue([
      { id: "c1", companyName: "Fosca", discount: { toString: () => "42.5" } },
    ]);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.list({})).resolves.toEqual([
      { id: "c1", companyName: "Fosca", discount: 42.5 },
    ]);
  });

  it("cerca per ragione sociale, senza distinguere maiuscole", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.customer.list({ search: "per" });
    expect(customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyName: { contains: "per", mode: "insensitive" } },
      }),
    );
  });

  it("senza ricerca non filtra", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.customer.list({});
    expect(customerFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe("customer.create", () => {
  it("crea con ragione sociale e sconto", async () => {
    customerCreate.mockResolvedValue({ id: "c1", companyName: "MC", discount: { toString: () => "40" } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "MC", discount: 40 })).resolves.toEqual({
      id: "c1",
      companyName: "MC",
      discount: 40,
    });
  });

  it("lo sconto è facoltativo", async () => {
    customerCreate.mockResolvedValue({ id: "c1", companyName: "MC", discount: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "MC" })).resolves.toEqual({
      id: "c1",
      companyName: "MC",
      discount: null,
    });
  });

  it("rifiuta una ragione sociale vuota", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.create({ companyName: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(customerCreate).not.toHaveBeenCalled();
  });

  it("rifiuta uno sconto fuori da 0-100", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.customer.create({ companyName: "MC", discount: 120 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rifiuta uno sconto con più di due decimali (la colonna è Decimal(5,2))", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.customer.create({ companyName: "MC", discount: 40.555 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("customer.delete", () => {
  it("rifiuta se il cliente ha richieste collegate", async () => {
    kitRequestCount.mockResolvedValue(3);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.delete({ id: "c1" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(customerDelete).not.toHaveBeenCalled();
  });

  it("elimina se non ne ha", async () => {
    kitRequestCount.mockResolvedValue(0);
    customerDelete.mockResolvedValue({ id: "c1" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.customer.delete({ id: "c1" })).resolves.toEqual({ id: "c1" });
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/api/routers/customer.test.ts`
Expected: FAIL — `Failed to resolve import "./customer"`.

- [ ] **Step 3: Scrivere l'implementazione**

Creare `src/server/api/routers/customer.ts`:

```ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { agentProcedure, createTRPCRouter } from "@/server/api/trpc";

/**
 * Anagrafica cliente **minima**: ragione sociale e sconto, che è tutto ciò che
 * serve alla scontistica. Gli altri campi del modello (P.IVA, indirizzo,
 * referente, `priceList`, `paymentTerms`) restano a schema e inutilizzati: non
 * si finge di gestirli finché nessuno li chiede.
 *
 * L'anagrafica è CONDIVISA fra gli agenti — `Customer` non ha un proprietario e
 * non glielo si aggiunge: i clienti sono dell'azienda.
 */

/** Ragione sociale: obbligatoria e non fatta di soli spazi. */
const companyNameSchema = z
  .string()
  .trim()
  .min(1, "La ragione sociale è obbligatoria.")
  .max(200, "La ragione sociale non può superare 200 caratteri.");

/**
 * Sconto in punti percentuali. Due decimali al massimo: la colonna è
 * `Decimal(5,2)` e troncare in silenzio falsificherebbe i totali.
 */
const discountSchema = z
  .number()
  .min(0, "Lo sconto non può essere negativo.")
  .max(100, "Lo sconto non può superare 100.")
  .refine((v) => Number.isInteger(v * 100), "Lo sconto ammette al massimo due decimali.");

/** Prisma restituisce `Decimal`: al client arriva un numero, o niente. */
function toDto(row: { id: string; companyName: string; discount: unknown }) {
  return {
    id: row.id,
    companyName: row.companyName,
    discount: row.discount === null || row.discount === undefined ? null : Number(row.discount),
  };
}

const SELECT = { id: true, companyName: true, discount: true } as const;

export const customerRouter = createTRPCRouter({
  list: agentProcedure
    .input(z.object({ search: z.string().trim().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.customer.findMany({
        where: input.search
          ? { companyName: { contains: input.search, mode: "insensitive" } }
          : {},
        orderBy: { companyName: "asc" },
        take: 50,
        select: SELECT,
      });
      return rows.map(toDto);
    }),

  create: agentProcedure
    .input(z.object({ companyName: companyNameSchema, discount: discountSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.create({
        data: { companyName: input.companyName, discount: input.discount ?? null },
        select: SELECT,
      });
      return toDto(row);
    }),

  update: agentProcedure
    .input(
      z.object({
        id: z.string().min(1),
        companyName: companyNameSchema.optional(),
        // `nullable` e non solo `optional`: azzerare lo sconto di un cliente
        // deve essere possibile, ed è diverso dal non toccarlo.
        discount: discountSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.update({
        where: { id: input.id },
        data: {
          ...(input.companyName === undefined ? {} : { companyName: input.companyName }),
          ...(input.discount === undefined ? {} : { discount: input.discount }),
        },
        select: SELECT,
      });
      return toDto(row);
    }),

  /**
   * Stesso paletto di `user.delete`: un cliente con richieste collegate non si
   * elimina, perché le distinte già emesse perderebbero l'intestatario. Il
   * vincolo sta QUI e non nella UI — un pulsante nascosto non è una regola.
   */
  delete: agentProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const richieste = await ctx.db.kitRequest.count({ where: { customerId: input.id } });
      if (richieste > 0)
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cliente con ${richieste} richieste collegate: non si può eliminare.`,
        });
      await ctx.db.customer.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
```

- [ ] **Step 4: Registrare il router**

In `src/server/api/root.ts`, aggiungere l'import dopo quello di `kitRouter`:
```ts
import { customerRouter } from "@/server/api/routers/customer";
```
e la voce dentro `appRouter`, dopo `kit: kitRouter,`:
```ts
  customer: customerRouter,
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/api/routers/customer.test.ts`
Expected: PASS — 12 test.

- [ ] **Step 6: Commit**

```bash
git add src/server/api/routers/customer.ts src/server/api/routers/customer.test.ts src/server/api/root.ts
git commit -m "feat(clienti): un'anagrafica minima, perche` senza clienti non c'e` sconto"
```

---

### Task 5: `kit.create` accetta il cliente e timbra lo sconto

**Il cliente NON entra in `kitInputSchema`.** Quello schema è l'input del motore deterministico, e `kit.generate` ricostruisce l'input rileggendo le colonne: infilarci un campo commerciale vorrebbe dire che `kitInputFromRequest` deve decidere se ricostruirlo, cioè esattamente la confusione che l'unione discriminata esiste per impedire. L'input del router diventa quindi un oggetto che *contiene* le specifiche.

**Files:**
- Modify: `src/server/api/routers/kit.ts` (righe 15-63 `create`, 197-223 `ricalcola`, 258-283 `get`)
- Modify: `src/server/api/routers/kit.test.ts` (8 call site + casi nuovi)

**Interfaces:**
- Consumes: `getDiscountThreshold` (Task 3), `applicaSconto`/`euroToCent`/`centToEuro` (Task 1), `KitRequest.discountPercent` (Task 2).
- Produces:
  - `kit.create({ specs: KitInput, customerId?: string }) → { id, requestNumber }`
  - `kit.get` restituisce in più: `discountPercent: number | null`, `netPrice: number | null`, `discountAmount: number | null`, `soglia: number`, `customer: { id, companyName } | null`

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/server/api/routers/kit.test.ts`, **aggiornare le 8 chiamate esistenti** (righe 69, 76, 96, 110, 118, 130, 143, 149) avvolgendo l'argomento in `{ specs: … }`:

```ts
// riga 69
await expect(caller.kit.create({ specs: validInput })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
// riga 76
const created = await caller.kit.create({ specs: validInput });
// riga 96
await caller.kit.create({ specs: { ...validInput, geometry: "A12_I9_B18", seatConfig: "SEDE_30" } });
// riga 110
await caller.kit.create({ specs: { ...validInput, seatConfig: undefined } });
// riga 118
await caller.kit.create({ specs: { ...validInput, supplementaryClosures: true } });
// riga 130
await caller.kit.create({ specs: { ...validInput, sashWeightKg: 75 } });
// riga 143
await caller.kit.create({ specs: { ...validInput, entrata: "E75" } });
// riga 149
await expect(caller.kit.create({ specs: { ...validInput, widthMm: 10 } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
```

Aggiungere `customerFindUnique` allo stub del db. Dopo la riga `const activityCreate = vi.fn();` aggiungere:
```ts
const customerFindUnique = vi.fn();
```
e dentro `dbStub` aggiungere:
```ts
  customer: { findUnique: customerFindUnique },
```
e nel `beforeEach`, dentro l'array dei mock da resettare, aggiungere `customerFindUnique`.

Mockare la soglia in cima al file, subito dopo gli import:
```ts
vi.mock("@/server/settings/discount-threshold", () => ({
  getDiscountThreshold: vi.fn().mockResolvedValue(40),
  SOGLIA_SCONTO_DEFAULT: 40,
}));
```

Poi aggiungere in fondo al file:

```ts
describe("kit.create — il cliente e il suo sconto", () => {
  it("senza cliente la richiesta nasce senza sconto", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockResolvedValue({ id: "k1", requestNumber: "KIT-2026-0001" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput });
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: null, discountPercent: null }),
      }),
    );
  });

  it("col cliente timbra lo sconto del cliente sulla richiesta", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockResolvedValue({ id: "k1", requestNumber: "KIT-2026-0001" });
    customerFindUnique.mockResolvedValue({ id: "c1", discount: { toString: () => "42.5" } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput, customerId: "c1" });
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: "c1", discountPercent: 42.5 }),
      }),
    );
  });

  it("un cliente senza sconto non inventa una percentuale", async () => {
    requestCount.mockResolvedValue(0);
    requestCreate.mockResolvedValue({ id: "k1", requestNumber: "KIT-2026-0001" });
    customerFindUnique.mockResolvedValue({ id: "c1", discount: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await caller.kit.create({ specs: validInput, customerId: "c1" });
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: "c1", discountPercent: null }),
      }),
    );
  });

  it("un cliente inesistente è NOT_FOUND e non crea niente", async () => {
    customerFindUnique.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.create({ specs: validInput, customerId: "fantasma" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requestCreate).not.toHaveBeenCalled();
  });
});

describe("kit.get — il netto", () => {
  const base = {
    id: "k1",
    requestNumber: "KIT-2026-0001",
    totalPrice: { toString: () => "90.20" },
    components: [],
    customer: null,
  };

  it("senza sconto il netto è il lordo e lo sconto è nullo", async () => {
    requestFindFirst.mockResolvedValue({ ...base, discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.totalPrice).toBe(90.2);
    expect(r.discountPercent).toBeNull();
    expect(r.netPrice).toBe(90.2);
    expect(r.discountAmount).toBeNull();
  });

  it("col 40% il netto del golden è 54,12 €", async () => {
    requestFindFirst.mockResolvedValue({
      ...base,
      discountPercent: { toString: () => "40" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.totalPrice).toBe(90.2);
    expect(r.discountPercent).toBe(40);
    expect(r.discountAmount).toBe(36.08);
    expect(r.netPrice).toBe(54.12);
  });

  it("una distinta non ancora generata non ha netto", async () => {
    requestFindFirst.mockResolvedValue({
      ...base,
      totalPrice: null,
      discountPercent: { toString: () => "40" },
    });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    const r = await caller.kit.get({ id: "k1" });
    expect(r.netPrice).toBeNull();
    expect(r.discountAmount).toBeNull();
  });

  it("restituisce la soglia, perché la UI deve sapere quando avvisare", async () => {
    requestFindFirst.mockResolvedValue({ ...base, discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(caller.kit.get({ id: "k1" })).resolves.toMatchObject({ soglia: 40 });
  });
});
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `pnpm vitest run src/server/api/routers/kit.test.ts`
Expected: FAIL — i nuovi `describe` falliscono (`discountPercent` non esiste nell'output, `customerId` non è accettato).

- [ ] **Step 3: Modificare `kit.create`**

In `src/server/api/routers/kit.ts`, aggiungere agli import in cima:
```ts
import { applicaSconto, centToEuro, euroToCent } from "@/server/pricing/discount";
import { getDiscountThreshold } from "@/server/settings/discount-threshold";
```

Sostituire la riga 15 (`create: agentProcedure.input(kitInputSchema).mutation(async ({ ctx, input }) => {`) con:

```ts
  /**
   * L'input NON è `kitInputSchema` nudo: il cliente è un dato commerciale e non
   * deve entrare nell'input del motore. `kit.generate` ricostruisce l'input
   * rileggendo le colonne (`from-request.ts`), quindi ogni campo che finisce
   * nell'unione diventa qualcosa che qualcuno deve decidere se ricostruire.
   * Le specifiche stanno in `specs`, il commerciale fuori.
   */
  create: agentProcedure
    .input(
      z.object({
        specs: kitInputSchema,
        customerId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
```

Poi, subito dopo l'apertura del corpo, **prima** del calcolo di `year`, inserire:

```ts
      // Lo sconto si TIMBRA alla creazione, non si legge dal cliente ogni volta:
      // se vivesse solo su `Customer`, ritoccarlo cambierebbe in silenzio il
      // totale di ogni distinta già mandata. Stessa ragione del ricalcolo
      // versionato.
      const cliente = input.customerId
        ? await ctx.db.customer.findUnique({
            where: { id: input.customerId },
            select: { id: true, discount: true },
          })
        : null;
      if (input.customerId && !cliente)
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente non trovato." });
```

Sostituire la riga 21 (`const { notes, ...specs } = input;`) con:
```ts
      const { notes, ...specs } = input.specs;
```

Nel blocco `data:` della `create` (righe 38-51), aggiungere dopo `sashWeightKg: specs.sashWeightKg ?? null,`:
```ts
        customerId: cliente?.id ?? null,
        discountPercent: cliente?.discount ?? null,
```

- [ ] **Step 4: Portare lo sconto nel ricalcolo versionato**

Nel blocco `tx.kitRequest.create({ data: { … } })` di `ricalcola` (righe 201-223), aggiungere subito dopo `customerId: request.customerId,`:
```ts
            // La nuova versione eredita lo sconto: ricalcolare la distinta non
            // è rinegoziare il prezzo.
            discountPercent: request.discountPercent,
```

- [ ] **Step 5: Restituire il netto da `kit.get`**

Sostituire il blocco `get` (righe 258-283) con:

```ts
  get: agentProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ ctx, input }) => {
    const [request, soglia] = await Promise.all([
      ctx.db.kitRequest.findFirst({
        where: { id: input.id, agentId: ctx.session.user.id },
        include: {
          customer: { select: { id: true, companyName: true } },
          components: {
            orderBy: { sortOrder: "asc" },
            include: {
              product: {
                select: { id: true, agbCode: true, name: true, isAvailable: true, listinoPage: true },
              },
            },
          },
        },
      }),
      getDiscountThreshold(ctx.db),
    ]);
    if (!request)
      throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });

    // Il netto è DERIVATO, mai salvato: due totali a DB divergono al primo bug.
    // `totalPrice` resta il lordo di listino, quindi nessuna riga storica si
    // muove. Vedi la spec §3.3.
    const lordo = request.totalPrice === null ? null : Number(request.totalPrice);
    const percent = request.discountPercent === null ? null : Number(request.discountPercent);
    const conto =
      lordo === null || percent === null ? null : applicaSconto(euroToCent(lordo), percent);

    return {
      ...request,
      totalPrice: lordo,
      discountPercent: percent,
      discountAmount: conto === null ? null : centToEuro(conto.scontoCent),
      netPrice: conto === null ? lordo : centToEuro(conto.nettoCent),
      soglia,
      components: request.components.map((component) => ({
        ...component,
        unitPrice: Number(component.unitPrice),
        totalPrice: Number(component.totalPrice),
      })),
    };
  }),
```

- [ ] **Step 6: Aggiornare la chiamata del wizard**

In `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`, riga ~286, sostituire
```ts
      const created = await create.mutateAsync(result.data);
```
con
```ts
      const created = await create.mutateAsync({ specs: result.data });
```
(il `customerId` arriva nel Task 7 — qui si tiene solo la compilazione verde.)

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/api/routers/kit.test.ts && pnpm typecheck`
Expected: PASS entrambi.

- [ ] **Step 8: Commit**

```bash
git add src/server/api/routers/kit.ts src/server/api/routers/kit.test.ts "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "feat(sconto): la richiesta nasce col cliente e col suo sconto addosso"
```

---

### Task 6: `kit.setDiscount` — modificabile anche a distinta generata

È il requisito esplicito dell'utente. La mutation **non** ha la guardia di stato che ha `generate`: cambiare uno sconto non riscrive nessun componente.

**Files:**
- Modify: `src/server/api/routers/kit.ts` (nuova rotta dopo `ricalcola`)
- Modify: `src/server/api/routers/kit.test.ts`

**Interfaces:**
- Consumes: `KitRequest.discountPercent` (Task 2).
- Produces: `kit.setDiscount({ id: string, discountPercent: number | null }) → { id, discountPercent: number | null }`

- [ ] **Step 1: Scrivere il test che fallisce**

Aggiungere in fondo a `src/server/api/routers/kit.test.ts`:

```ts
describe("kit.setDiscount", () => {
  it("modifica lo sconto anche su una distinta GIÀ generata (è il punto)", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", status: "COMPLETED", supersededById: null });
    requestUpdate.mockResolvedValue({ id: "k1", discountPercent: { toString: () => "42.5" } });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: 42.5 }),
    ).resolves.toEqual({ id: "k1", discountPercent: 42.5 });
  });

  it("azzerare lo sconto è possibile e non è come non averlo mai messo", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", status: "COMPLETED", supersededById: null });
    requestUpdate.mockResolvedValue({ id: "k1", discountPercent: null });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: null }),
    ).resolves.toEqual({ id: "k1", discountPercent: null });
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { discountPercent: null } }),
    );
  });

  it("su una richiesta di un altro agente è NOT_FOUND", async () => {
    requestFindFirst.mockResolvedValue(null);
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "altrui", discountPercent: 40 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("su una riga già superata rifiuta: si sconta la versione più recente", async () => {
    requestFindFirst.mockResolvedValue({ id: "k1", status: "COMPLETED", supersededById: "k2" });
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: 40 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("rifiuta uno sconto fuori da 0-100", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: 101 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rifiuta più di due decimali", async () => {
    const caller = createCallerFactory(appRouter)(makeCtx(agent));
    await expect(
      caller.kit.setDiscount({ id: "k1", discountPercent: 40.555 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/server/api/routers/kit.test.ts -t setDiscount`
Expected: FAIL — `caller.kit.setDiscount is not a function`.

- [ ] **Step 3: Scrivere l'implementazione**

In `src/server/api/routers/kit.ts`, aggiungere **dopo** la chiusura di `ricalcola` (riga 256, `}),`) e prima di `get`:

```ts
  /**
   * Cambia lo sconto applicato a una richiesta. **Ammessa in qualunque stato**,
   * a differenza di `generate`: non riscrive nessun componente e non tocca la
   * distinta: cambia una condizione commerciale, che si rinegozia anche dopo
   * aver mandato il preventivo. È il requisito da cui nasce la colonna.
   *
   * L'unico rifiuto è sulla riga **superata**: lì lo sconto va messo sulla
   * versione più recente, altrimenti si modifica una copia che nessuno guarda.
   */
  setDiscount: agentProcedure
    .input(
      z.object({
        id: z.string().min(1),
        discountPercent: z
          .number()
          .min(0, "Lo sconto non può essere negativo.")
          .max(100, "Lo sconto non può superare 100.")
          .refine((v) => Number.isInteger(v * 100), "Lo sconto ammette al massimo due decimali.")
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.kitRequest.findFirst({
        where: { id: input.id, agentId: ctx.session.user.id },
        select: { id: true, supersededById: true },
      });
      if (!request)
        throw new TRPCError({ code: "NOT_FOUND", message: "Richiesta kit non trovata." });
      if (request.supersededById)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Questa richiesta è stata ricalcolata: applica lo sconto alla versione più recente.",
        });

      const updated = await ctx.db.kitRequest.update({
        where: { id: request.id },
        data: { discountPercent: input.discountPercent },
        select: { id: true, discountPercent: true },
      });
      return {
        id: updated.id,
        discountPercent:
          updated.discountPercent === null ? null : Number(updated.discountPercent),
      };
    }),
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm vitest run src/server/api/routers/kit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/kit.ts src/server/api/routers/kit.test.ts
git commit -m "feat(sconto): lo sconto si ritocca anche a distinta gia` generata"
```

---

### Task 7: Il selettore cliente nel wizard

**Files:**
- Create: `src/components/kit/customer-picker.tsx`
- Create: `src/components/kit/customer-picker.test.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`

**Interfaces:**
- Consumes: `customer.list`, `customer.create` (Task 4).
- Produces: `<CustomerPicker value={string | null} onChange={(c: { id: string; companyName: string; discount: number | null } | null) => void} />`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/components/kit/customer-picker.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerPicker } from "./customer-picker";

const listQuery = vi.fn();
const createMutate = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    customer: {
      list: { useQuery: (...a: unknown[]) => listQuery(...a) },
      create: { useMutation: () => ({ mutateAsync: createMutate, isPending: false }) },
    },
    useUtils: () => ({ customer: { list: { invalidate: vi.fn() } } }),
  },
}));

const clienti = [
  { id: "c1", companyName: "Fosca", discount: 42.5 },
  { id: "c2", companyName: "Peruzzi", discount: null },
];

describe("CustomerPicker", () => {
  it("elenca i clienti e ne restituisce uno con il suo sconto", async () => {
    listQuery.mockReturnValue({ data: clienti, isPending: false });
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /fosca/i }));
    expect(onChange).toHaveBeenCalledWith({ id: "c1", companyName: "Fosca", discount: 42.5 });
  });

  it("si può non scegliere nessun cliente", async () => {
    listQuery.mockReturnValue({ data: clienti, isPending: false });
    const onChange = vi.fn();
    render(<CustomerPicker value="c1" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /nessun cliente/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("crea un cliente nuovo e lo seleziona subito", async () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    createMutate.mockResolvedValue({ id: "c9", companyName: "Nuovo", discount: 30 });
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    await userEvent.type(screen.getByLabelText(/ragione sociale/i), "Nuovo");
    await userEvent.type(screen.getByLabelText(/sconto/i), "30");
    await userEvent.click(screen.getByRole("button", { name: /^crea$/i }));
    expect(createMutate).toHaveBeenCalledWith({ companyName: "Nuovo", discount: 30 });
    expect(onChange).toHaveBeenCalledWith({ id: "c9", companyName: "Nuovo", discount: 30 });
  });

  it("non crea un cliente con ragione sociale vuota", async () => {
    listQuery.mockReturnValue({ data: [], isPending: false });
    render(<CustomerPicker value={null} onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /nuovo cliente/i }));
    expect(screen.getByRole("button", { name: /^crea$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/components/kit/customer-picker.test.tsx`
Expected: FAIL — `Failed to resolve import "./customer-picker"`.

- [ ] **Step 3: Scrivere il componente**

Creare `src/components/kit/customer-picker.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CustomerOption {
  id: string;
  companyName: string;
  discount: number | null;
}

/**
 * Selettore cliente del wizard, con creazione in linea.
 *
 * Vive in un componente proprio e non dentro `nuova-client.tsx`: quel file è
 * già a 1096 righe, e questa parte è testabile da sola.
 *
 * Il cliente è FACOLTATIVO: «Nessun cliente» è una scelta legittima, non uno
 * stato da cui uscire — copre il cliente occasionale, per cui l'agente scriverà
 * lo sconto a mano sulla richiesta.
 */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (customer: CustomerOption | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [sconto, setSconto] = useState("");
  const searchId = useId();
  const nomeId = useId();
  const scontoId = useId();

  const utils = api.useUtils();
  const list = api.customer.list.useQuery({ search: search.trim() || undefined });
  const create = api.customer.create.useMutation();

  async function handleCrea() {
    const companyName = nome.trim();
    if (!companyName) return;
    const parsed = sconto.trim() === "" ? undefined : Number(sconto.replace(",", "."));
    const creato = await create.mutateAsync({
      companyName,
      ...(parsed === undefined || Number.isNaN(parsed) ? {} : { discount: parsed }),
    });
    void utils.customer.list.invalidate();
    setCreating(false);
    setNome("");
    setSconto("");
    onChange(creato);
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={searchId} className="text-sm text-ink-muted">
        Cliente <span className="text-ink-subtle">(facoltativo)</span>
      </label>

      <Input
        id={searchId}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per ragione sociale…"
        leadingIcon={<Search className="size-4" aria-hidden />}
      />

      {/* Mobile-first: una colonna sotto sm, due sopra. La lista scorre invece
          di allungare la pagina all'infinito a 375px. */}
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors",
            value === null
              ? "border-brand bg-brand/5 text-ink"
              : "border-line text-ink-subtle hover:border-line-strong",
          )}
        >
          <UserRound className="size-4 shrink-0" aria-hidden />
          Nessun cliente
        </button>

        {list.isPending && (
          <span className="h-9 animate-pulse rounded bg-surface-sunken" aria-hidden />
        )}

        {list.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "flex items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm transition-colors",
              value === c.id
                ? "border-brand bg-brand/5 text-ink"
                : "border-line text-ink hover:border-line-strong",
            )}
          >
            <span className="truncate">{c.companyName}</span>
            <span className="shrink-0 text-xs text-ink-subtle">
              {c.discount === null ? "nessuno sconto" : `−${c.discount}%`}
            </span>
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex flex-col gap-2 rounded border border-line bg-surface-sunken p-3">
          <label htmlFor={nomeId} className="text-xs text-ink-muted">
            Ragione sociale
          </label>
          <Input id={nomeId} value={nome} onChange={(e) => setNome(e.target.value)} />
          <label htmlFor={scontoId} className="text-xs text-ink-muted">
            Sconto % <span className="text-ink-subtle">(facoltativo)</span>
          </label>
          <Input
            id={scontoId}
            inputMode="decimal"
            value={sconto}
            onChange={(e) => setSconto(e.target.value)}
            placeholder="es. 40"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!nome.trim()}
              loading={create.isPending}
              onClick={() => void handleCrea()}
            >
              Crea
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCreating(false)}>
              Annulla
            </Button>
          </div>
          {create.isError && (
            <p role="alert" className="text-sm text-danger">
              {create.error.message}
            </p>
          )}
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Nuovo cliente
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm vitest run src/components/kit/customer-picker.test.tsx`
Expected: PASS — 4 test.

- [ ] **Step 5: Montare il selettore nel wizard**

In `src/app/(dashboard)/richieste/nuova/nuova-client.tsx`:

Aggiungere l'import:
```ts
import { CustomerPicker, type CustomerOption } from "@/components/kit/customer-picker";
```

Dentro `NuovaRichiestaClient`, dopo `const [form, setForm] = useState<FormValues>(ARTECH_DEFAULT);`:
```ts
  // Il cliente NON è un campo del form: non entra in `kitInputSchema` (che è
  // l'input del motore) e viaggia a parte fino a `kit.create`.
  const [cliente, setCliente] = useState<CustomerOption | null>(null);
```

Nel corpo dello step 1 (riga 368), sostituire:
```tsx
        {step === 1 && <Step1Tipologia form={form} setForm={setForm} />}
```
con:
```tsx
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <Step1Tipologia form={form} setForm={setForm} />
            <CustomerPicker value={cliente?.id ?? null} onChange={setCliente} />
          </div>
        )}
```

In `handleGenera`, sostituire la chiamata modificata nel Task 5:
```ts
      const created = await create.mutateAsync({ specs: result.data });
```
con:
```ts
      const created = await create.mutateAsync({
        specs: result.data,
        ...(cliente ? { customerId: cliente.id } : {}),
      });
```

Nello step 4 (riga 381), passare il cliente al riepilogo:
```tsx
        {step === 4 && <Step4Riepilogo form={form} cliente={cliente} />}
```

E in `Step4Riepilogo` (riga 1026) cambiare la firma:
```tsx
function Step4Riepilogo({ form, cliente }: { form: FormValues; cliente: CustomerOption | null }) {
```

Il riepilogo usa il componente-riga `SummaryItem`, già definito in quel file, e ha **due rami**
(TOUR e ARTECH) che condividono il frammento `comuni`. Il cliente vale per entrambi, quindi va
aggiunto dentro `comuni` — non nei due rami separatamente, altrimenti compare solo su uno.
Sostituire il blocco `comuni` (righe 1027-1034) con:

```tsx
  const comuni = (
    <>
      {/* Il cliente è la prima cosa del riepilogo: è ciò che decide lo sconto,
          e va letto prima delle quote. Vale per entrambe le serie, quindi sta
          in `comuni` e non nei due rami. */}
      <SummaryItem
        label="Cliente"
        value={
          cliente === null
            ? "Nessuno"
            : cliente.discount === null
              ? cliente.companyName
              : `${cliente.companyName} · sconto ${cliente.discount}%`
        }
      />
      <SummaryItem label="Tipologia" value={windowTypeLabel(form.windowType)} />
      <SummaryItem label="Serie" value={form.series} />
      <SummaryItem label="Materiale" value={materialLabel(form.material)} />
      <SummaryItem label="Dimensioni" value={`${form.widthMm} × ${form.heightMm} mm`} />
    </>
  );
```

- [ ] **Step 6: Eseguire i test del wizard**

Run: `pnpm vitest run "src/app/(dashboard)/richieste/nuova" src/components/kit && pnpm typecheck`
Expected: PASS entrambi.

- [ ] **Step 7: Commit**

```bash
git add src/components/kit/customer-picker.tsx src/components/kit/customer-picker.test.tsx "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "feat(sconto): il wizard chiede il cliente, e il cliente porta il suo sconto"
```

---

### Task 8: Il riepilogo sconto sul dettaglio

**Files:**
- Create: `src/components/kit/riepilogo-sconto.tsx`
- Create: `src/components/kit/riepilogo-sconto.test.tsx`
- Modify: `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx`

**Interfaces:**
- Consumes: `applicaSconto`/`euroToCent`/`centToEuro`/`superaSoglia` (Task 1), `kit.setDiscount` (Task 6), i campi nuovi di `kit.get` (Task 5).
- Produces: `<RiepilogoSconto requestId lordo discountPercent netto scontoImporto soglia readOnly />`

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/components/kit/riepilogo-sconto.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiepilogoSconto } from "./riepilogo-sconto";

const setDiscountMutate = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    kit: { setDiscount: { useMutation: () => ({ mutateAsync: setDiscountMutate, isPending: false, isError: false, error: null }) } },
    useUtils: () => ({ kit: { get: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } } }),
  },
}));

const base = {
  requestId: "k1",
  lordo: 90.2,
  soglia: 40,
  readOnly: false,
};

describe("RiepilogoSconto", () => {
  it("senza sconto mostra solo il totale di listino", () => {
    render(<RiepilogoSconto {...base} discountPercent={null} netto={90.2} scontoImporto={null} />);
    expect(screen.getByText(/90,20/)).toBeDefined();
    expect(screen.queryByText(/totale cliente/i)).toBeNull();
  });

  it("con lo sconto mostra lordo, sconto e netto", () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    expect(screen.getByText(/90,20/)).toBeDefined();
    expect(screen.getByText(/36,08/)).toBeDefined();
    expect(screen.getByText(/54,12/)).toBeDefined();
    expect(screen.getByText(/totale cliente/i)).toBeDefined();
  });

  it("oltre soglia avvisa ma non blocca", () => {
    render(<RiepilogoSconto {...base} discountPercent={55} netto={40.59} scontoImporto={49.61} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/soglia/i)).toBeDefined();
  });

  it("pari alla soglia non avvisa", () => {
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("salva la percentuale modificata", async () => {
    setDiscountMutate.mockResolvedValue({ id: "k1", discountPercent: 45 });
    render(<RiepilogoSconto {...base} discountPercent={40} netto={54.12} scontoImporto={36.08} />);
    await userEvent.click(screen.getByRole("button", { name: /modifica sconto/i }));
    const campo = screen.getByLabelText(/sconto/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "45");
    await userEvent.click(screen.getByRole("button", { name: /^salva$/i }));
    expect(setDiscountMutate).toHaveBeenCalledWith({ id: "k1", discountPercent: 45 });
  });

  it("in sola lettura non offre la modifica", () => {
    render(
      <RiepilogoSconto {...base} readOnly discountPercent={40} netto={54.12} scontoImporto={36.08} />,
    );
    expect(screen.queryByRole("button", { name: /modifica sconto/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run src/components/kit/riepilogo-sconto.test.tsx`
Expected: FAIL — `Failed to resolve import "./riepilogo-sconto"`.

- [ ] **Step 3: Scrivere il componente**

Creare `src/components/kit/riepilogo-sconto.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { api } from "@/trpc/react";
import { formatPrice } from "@/lib/format";
import { superaSoglia } from "@/server/pricing/discount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Riepilogo commerciale sotto la distinta: lordo → sconto → netto.
 *
 * Le righe della distinta restano al LORDO di listino AGB (scelta dell'utente):
 * qui compare l'unico posto in cui lo sconto lavora. Il netto arriva già
 * calcolato dal server — non lo si ricalcola qui, altrimenti due aritmetiche
 * diverse finirebbero per mostrare due numeri diversi.
 */
export function RiepilogoSconto({
  requestId,
  lordo,
  discountPercent,
  netto,
  scontoImporto,
  soglia,
  readOnly = false,
}: {
  requestId: string;
  lordo: number;
  discountPercent: number | null;
  netto: number;
  scontoImporto: number | null;
  soglia: number;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [valore, setValore] = useState(discountPercent === null ? "" : String(discountPercent));
  const campoId = useId();
  const utils = api.useUtils();

  const setDiscount = api.kit.setDiscount.useMutation({
    onSuccess: () => {
      void utils.kit.get.invalidate({ id: requestId });
      void utils.kit.list.invalidate();
      setEditing(false);
    },
  });

  const fuoriSoglia = superaSoglia(discountPercent, soglia);

  async function handleSalva() {
    const grezzo = valore.trim().replace(",", ".");
    const parsed = grezzo === "" ? null : Number(grezzo);
    if (parsed !== null && Number.isNaN(parsed)) return;
    await setDiscount.mutateAsync({ id: requestId, discountPercent: parsed });
  }

  return (
    <section
      aria-label="Riepilogo prezzo"
      className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4 text-sm"
    >
      {/* Mobile-first: LISTA verticale, non una tabella. A 375px una tabella a
          due colonne con gli importi a destra si stringe fino a spezzare le
          cifre. */}
      <Riga label="Totale listino AGB" value={formatPrice(lordo)} />

      {discountPercent !== null && scontoImporto !== null && (
        <>
          <Riga
            label={`Sconto cliente −${discountPercent}%`}
            value={`−${formatPrice(scontoImporto)}`}
          />
          <div className="border-t border-line-strong pt-2">
            <Riga label="Totale cliente" value={formatPrice(netto)} strong />
          </div>
        </>
      )}

      {fuoriSoglia && (
        <p
          role="status"
          className="flex items-start gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Sconto oltre la soglia aziendale del {soglia}%. La richiesta resta valida: è solo un
            avviso.
          </span>
        </p>
      )}

      {!readOnly &&
        (editing ? (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <label htmlFor={campoId} className="text-xs text-ink-muted">
              Sconto % <span className="text-ink-subtle">(vuoto = nessuno sconto)</span>
            </label>
            <Input
              id={campoId}
              inputMode="decimal"
              value={valore}
              onChange={(e) => setValore(e.target.value)}
              placeholder="es. 40"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={setDiscount.isPending} onClick={() => void handleSalva()}>
                Salva
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setValore(discountPercent === null ? "" : String(discountPercent));
                  setEditing(false);
                }}
              >
                Annulla
              </Button>
            </div>
            {setDiscount.isError && (
              <p role="alert" className="text-danger">
                {setDiscount.error?.message}
              </p>
            )}
          </div>
        ) : (
          <div className="border-t border-line pt-3">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Modifica sconto
            </Button>
          </div>
        ))}
    </section>
  );
}

function Riga({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? "font-semibold text-ink" : "text-ink-subtle"}>{label}</span>
      <span className={strong ? "font-semibold text-ink" : "text-ink"}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm vitest run src/components/kit/riepilogo-sconto.test.tsx`
Expected: PASS — 6 test.

- [ ] **Step 5: Montare il riepilogo nel dettaglio**

In `src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx`:

Aggiungere l'import:
```ts
import { RiepilogoSconto } from "@/components/kit/riepilogo-sconto";
```

Subito **dopo** il blocco `<DistintaTable … />` (righe 316-323), dentro lo stesso ramo `hasDistinta ? (…)`, avvolgere in un frammento:

```tsx
        {hasDistinta ? (
          <>
            <DistintaTable
              components={r.components.map((c) => ({
                ...c,
                listinoPage: c.product?.listinoPage ?? null,
              }))}
              totalPrice={r.totalPrice ?? 0}
              warnings={warnings}
            />
            {/* Su una riga superata il riepilogo è in sola lettura: lo sconto va
                messo sulla versione più recente, e il router lo rifiuterebbe
                comunque con CONFLICT. */}
            <RiepilogoSconto
              requestId={r.id}
              lordo={r.totalPrice ?? 0}
              discountPercent={r.discountPercent}
              netto={r.netPrice ?? r.totalPrice ?? 0}
              scontoImporto={r.discountAmount}
              soglia={r.soglia}
              readOnly={r.supersededById !== null}
            />
          </>
        ) : (
```

Nell'`header` (riga 147-156), aggiungere il cliente accanto alla tipologia — solo se c'è:
```tsx
        <p className="text-sm text-ink-subtle">
          {windowTypeLabel(r.windowType)} · {r.series}
          {r.customer && <> · {r.customer.companyName}</>}
          {r.totalComponents > 0 && (
```

- [ ] **Step 6: Eseguire i test del dettaglio**

Run: `pnpm vitest run "src/app/(dashboard)/richieste" src/components/kit && pnpm typecheck`
Expected: PASS entrambi.

- [ ] **Step 7: Commit**

```bash
git add src/components/kit/riepilogo-sconto.tsx src/components/kit/riepilogo-sconto.test.tsx "src/app/(dashboard)/richieste/[id]/dettaglio-client.tsx"
git commit -m "feat(sconto): la scheda dice quanto paga il cliente, non solo quanto costa"
```

---

### Task 9: La soglia in `/impostazioni`

**Files:**
- Modify: `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`

**Interfaces:**
- Consumes: `settings.discountThreshold.get` / `.set` (Task 3).
- Produces: niente per altri task.

- [ ] **Step 1: Scrivere il test che fallisce**

Creare `src/app/(dashboard)/impostazioni/impostazioni-client.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SogliaScontoCard } from "./impostazioni-client";

const setMutate = vi.fn();
vi.mock("@/trpc/react", () => ({
  api: {
    settings: {
      aiKeys: { status: { useQuery: () => ({ data: [], isPending: false, isError: false }) } },
      discountThreshold: {
        get: { useQuery: () => ({ data: 40, isPending: false }) },
        set: { useMutation: () => ({ mutate: setMutate, isPending: false, isError: false, error: null }) },
      },
    },
    useUtils: () => ({ settings: { discountThreshold: { get: { invalidate: vi.fn() } } } }),
  },
}));

describe("SogliaScontoCard", () => {
  it("mostra la soglia corrente", () => {
    render(<SogliaScontoCard />);
    expect((screen.getByLabelText(/soglia/i) as HTMLInputElement).value).toBe("40");
  });

  it("salva la nuova soglia", async () => {
    render(<SogliaScontoCard />);
    const campo = screen.getByLabelText(/soglia/i);
    await userEvent.clear(campo);
    await userEvent.type(campo, "55");
    await userEvent.click(screen.getByRole("button", { name: /salva/i }));
    expect(setMutate).toHaveBeenCalledWith({ soglia: 55 });
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `pnpm vitest run "src/app/(dashboard)/impostazioni"`
Expected: FAIL — `SogliaScontoCard` non è esportato.

- [ ] **Step 3: Aggiungere la sezione**

In `src/app/(dashboard)/impostazioni/impostazioni-client.tsx`:

Cambiare l'import di React (riga 3) in:
```ts
import { useEffect, useId, useState } from "react";
```

Nel `return` di `ImpostazioniClient` (righe 36-47), aggiungere la card **dopo** il `.map` dei provider:
```tsx
      <SogliaScontoCard />
```

Aggiungere in fondo al file:

```tsx
/**
 * Soglia oltre la quale lo sconto cliente produce un avviso. È una politica
 * commerciale, quindi vive in `Settings` e non in una costante: cambiarla non
 * deve richiedere un rilascio.
 */
export function SogliaScontoCard() {
  const utils = api.useUtils();
  const corrente = api.settings.discountThreshold.get.useQuery();
  const [valore, setValore] = useState("");
  const campoId = useId();

  // Il campo si idrata dal server una volta arrivato il dato, senza
  // sovrascrivere quello che l'admin sta scrivendo.
  useEffect(() => {
    if (corrente.data !== undefined) setValore((v) => (v === "" ? String(corrente.data) : v));
  }, [corrente.data]);

  const salva = api.settings.discountThreshold.set.useMutation({
    onSuccess: () => void utils.settings.discountThreshold.get.invalidate(),
  });

  const parsed = Number(valore.trim().replace(",", "."));
  const valido = valore.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;

  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-1 font-semibold text-ink">Soglia di avviso sullo sconto</h2>
      <p className="mb-3 text-sm text-ink-subtle">
        Oltre questa percentuale la scheda della richiesta mostra un avviso. Non impedisce mai di
        salvare lo sconto.
      </p>

      <label htmlFor={campoId} className="mb-1.5 block text-sm text-ink-muted">
        Soglia %
      </label>
      {/* Mobile-first: campo a piena larghezza sotto sm, tastierino numerico. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id={campoId}
          inputMode="decimal"
          value={valore}
          onChange={(e) => setValore(e.target.value)}
          className="h-11 w-full rounded border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:w-32"
        />
        <button
          type="button"
          disabled={!valido || salva.isPending}
          onClick={() => salva.mutate({ soglia: parsed })}
          className="h-11 rounded bg-brand px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
        >
          {salva.isPending ? "Salvataggio…" : "Salva"}
        </button>
      </div>

      {salva.isError && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {salva.error.message}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `pnpm vitest run "src/app/(dashboard)/impostazioni" && pnpm typecheck`
Expected: PASS entrambi.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/impostazioni"
git commit -m "feat(sconto): la soglia si cambia dalle impostazioni, senza rilascio"
```

---

### Task 10: Regressione, documentazione e gate

**Files:**
- Modify: `src/server/kit/rules-artech-legno.test.ts` (nuovo `describe` in fondo)
- Modify: `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`
- Modify: `handoff.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: tutto il resto.
- Produces: niente.

- [ ] **Step 1: Blindare l'invariante che conta — lo sconto non può entrare nel motore**

⚠️ **Non aggiungere un test che ricalcola il golden**: `rules-artech-legno.test.ts` lo asserisce
già due volte (righe 78-86 «aggiunge le 4 righe supplementari: 16 righe / 21 pezzi» e 279-284
«il golden storico con chiusure ON»), più il 12/17 senza chiusure. Duplicarlo aggiunge rumore e
non copre niente di nuovo: quei test restano verdi **perché** lo sconto non tocca il motore, ed è
esattamente ciò che si vuole sapere.

Quello che **non** è ancora blindato è che i due campi commerciali non possano infilarsi
nell'input del motore. È una garanzia strutturale, non una promessa nei commenti.

Aggiungere in fondo a `src/server/kit/types.test.ts`:

```ts
/**
 * Lo sconto e il cliente sono dati COMMERCIALI e vivono fuori da `kitInputSchema`:
 * `kit.create` li riceve accanto alle specifiche, non dentro. Se un domani
 * qualcuno li aggiungesse allo schema, `kitInputFromRequest` dovrebbe decidere
 * se ricostruirli — cioè esattamente la confusione che l'unione discriminata
 * esiste per impedire. Questo test rende la cosa impossibile invece che
 * sconsigliata.
 */
describe("i campi commerciali restano fuori dall'input del motore", () => {
  it("kitInputSchema scarta customerId e discountPercent", () => {
    const parsed = kitInputSchema.parse({
      windowType: "ANTA_RIBALTA",
      series: "ARTECH",
      material: "LEGNO",
      widthMm: 550,
      heightMm: 1820,
      geometry: "A12_I13_B20",
      entrata: "E15",
      seatConfig: "STANDARD",
      openingSide: "SINISTRA",
      openingDir: "TIRARE",
      finish: "ARGENTO",
      customerId: "c1",
      discountPercent: 40,
    });
    expect(parsed).not.toHaveProperty("customerId");
    expect(parsed).not.toHaveProperty("discountPercent");
  });

  it("nessuno dei due è un campo dello schema, in nessuno dei due rami", () => {
    for (const ramo of [artechInputSchema, tourInputSchema]) {
      expect(Object.keys(ramo.shape)).not.toContain("customerId");
      expect(Object.keys(ramo.shape)).not.toContain("discountPercent");
    }
  });
});
```

Verificare che gli import in cima a `types.test.ts` includano `artechInputSchema` e
`tourInputSchema` oltre a `kitInputSchema`; aggiungerli se mancano.

- [ ] **Step 2: Eseguire la suite intera**

Run: `pnpm test`
Expected: PASS — nessun test rosso; il conteggio sale rispetto ai 660 di partenza.

- [ ] **Step 3: Registrare la domanda 28**

In `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`:

Nell'intestazione, cambiare
```
> **24-26** dal lavoro sulle sette geometrie del 2026-07-29; la **27** dal lavoro sull'entrata maniglia del 2026-07-30.
```
in
```
> **24-26** dal lavoro sulle sette geometrie del 2026-07-29; la **27** dal lavoro sull'entrata maniglia e la **28** dalla scontistica cliente, entrambe del 2026-07-30.
```

Aggiungere alla tabella «In sintesi», subito dopo la riga della 25:
```
| 28 | Lo sconto è unico o per classe? | AGB o ufficio | 🟡 **il netto di ogni distinta** |
```

Aggiungere nella sezione «🟡 Importanti», dopo la 25:

```markdown
## 28 — Lo sconto è unico per cliente, o cambia per classe di articolo?

**In parole semplici:** il listino AGB stampa una **classe di sconto** accanto a ogni articolo
(la colonna con `A2`, `F3`, `T1`…). Sulle 959 pagine del 2026 ce ne sono **34**. Quando fate lo
sconto a un cliente, applicate **una sola percentuale a tutto**, oppure una percentuale
**diversa per classe**?

**Perché conta:** i codici che il generatore emette non stanno tutti nella stessa classe.

| Distinta | Classe |
|---|---|
| Anta-ribalta e vasistas ARTECH (tutte e sette le geometrie) | **F3** |
| Bilico rettangolare TOUR | **T1** |

Dal 2026-07-30 il programma applica **una percentuale sola** — è la scelta fatta
consapevolmente, non una svista. Ma se lo sconto vero cambia per classe, il totale mostrato su
un **bilico** è sbagliato: quelle distinte stanno fra 433 € e 766 €, quindi cinque punti di
scarto valgono 20-38 € a serramento.

**Cosa cambierebbe la risposta:** se è per classe, `Customer.discount` diventa una tabella
cliente × classe. La percentuale è già su una colonna propria della richiesta e non dentro il
prezzo delle righe, quindi cambierebbe **come si calcola** quel numero, non le distinte già
emesse.

*Riferimento tecnico: colonna classe sconto del listino, catturata dal parser in
`Product.specifications.classeSconto`; conteggio ricavato applicando `PRODUCT_SIGNATURE` di
`parse-listino.ts` a tutte le 959 pagine.*
```

Nel testo pronto «B) Per AGB», aggiungere alla lista delle due che contano:
```
- **domanda 28** — se lo sconto cliente sia unico o per classe di articolo.
```

- [ ] **Step 4: Aggiornare `handoff.md` e `CLAUDE.md`**

In `handoff.md`, sostituire il blocco `§RIPRENDI DA QUI` con lo stato di questa sessione: cosa è stato costruito, i due riscontri intatti, l'azione ops (una migrazione), e i tre fronti rimasti (schemi cliente + composer chiusure · varianti componenti · divario schema `p0406`), oltre alle tre distinte reali ancora attese da MC, Peruzzi e Fosca.

In `CLAUDE.md`, aggiungere in fondo alla sezione **STATO** un paragrafo `+ **SCONTISTICA CLIENTE ✅**` con: anagrafica minima condivisa, sconto timbrato sulla richiesta e modificabile a distinta generata, righe al lordo e riepilogo lordo → sconto → netto, soglia configurabile da ADMIN (avviso mai blocco), scoperta delle 34 classi e domanda 28, **una sola migrazione** `kit_discount_percent` come azione ops.

- [ ] **Step 5: Gate completi**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
Expected: tutti e quattro verdi.

- [ ] **Step 6: Verifica browser (desktop + 375px)**

Avviare l'app (`bash scripts/dev-bootstrap.sh` se i container sono giù, poi `pnpm dev`) e con Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) verificare, **a 1440×900 e a 375×812**:

1. `/richieste/nuova` — il selettore cliente compare al passo 1, si cerca, si crea un cliente nuovo, si sceglie «Nessun cliente»;
2. il riepilogo del passo 4 mostra il cliente e il suo sconto;
3. `/richieste/[id]` — riepilogo `Totale listino AGB` → `Sconto` → `Totale cliente` con i numeri giusti;
4. «Modifica sconto» salva e il netto si aggiorna senza ricaricare;
5. uno sconto sopra la soglia mostra l'avviso e **si salva comunque**;
6. una richiesta senza sconto non mostra il blocco «Totale cliente»;
7. `/impostazioni` — la soglia si cambia e l'avviso al punto 5 cambia di conseguenza;
8. a 375px nessuna tabella esce dallo schermo e nessun pulsante è irraggiungibile.

Salvare gli screenshot in scratchpad e riportarne l'esito.

- [ ] **Step 7: Commit finale**

```bash
git add -A
git commit -m "docs(sconto): la domanda 28, e lo stato di fine sessione"
```

---

## Azioni ops al merge

1. **Una migrazione**: `<timestamp>_kit_discount_percent` (`ALTER TABLE "kit_requests" ADD COLUMN "discount_percent" DECIMAL(5,2);`).

**Nient'altro.** Niente re-import del catalogo, niente `db:seed`, niente `db:seed:kit`, niente `embed:products`. Un run di «Ops — Neon» li eseguirebbe comunque tutti senza danno, ma il minimo necessario è il solo `migrate deploy`.
