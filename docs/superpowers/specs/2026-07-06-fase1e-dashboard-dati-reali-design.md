# Fase 1e — Dashboard dati reali (design)

> Spec di design. Fonte: brainstorming 2026-07-06. Sostituisce la dashboard
> placeholder (`src/app/(dashboard)/dashboard/page.tsx`) con dati reali via tRPC.
> Nessuna modifica a `schema.prisma`: tutti i dati esistono già.

## Obiettivo

Trasformare la home `/dashboard` da mockup statico (4 card a "0", sezione
"Ultime richieste kit" vuota fissa, box AI finto) in una vista che riflette
l'attività reale dell'agente, con vista aggregata di team per l'ADMIN.

## Decisioni (dal brainstorming)

| Tema | Decisione |
|---|---|
| **Scope dati** | Dati propri per tutti; ADMIN ha un **toggle "I miei / Team"** per gli aggregati di tutti gli agenti. Il server è autoritativo: per un non-ADMIN lo scope è **sempre** `mine`. |
| **KPI (4 card)** | Richieste · Kit generati · Conversazioni AI · Prodotti cercati. Ogni card mostra **totale** grande + sottoriga **"+N oggi"**. |
| **"Kit generati"** | Conteggio `KitRequest` con `generatedAt != null` (un kit è "generato" una volta valorizzato `generatedAt`, a prescindere dallo stato successivo). |
| **"Oggi"** | Confine giorno in fuso **`Europe/Rome`** (server Vercel è UTC), coerente con `src/lib/format.ts`. |
| **Corpo** | "Ultime richieste kit" reali (ultime 5: numero, cliente, data, stato, valore — cliccabili verso `/richieste/[id]`) + card **Scorciatoie** con CTA reali. |
| **Scorciatoie** | "Chiedi all'assistente" → `/assistente`; "Nuova richiesta kit" → `/richieste/nuova`; "Cerca a catalogo" → `/archivio`. Rimpiazza il box AI finto. |

## Architettura

### Router tRPC — `dashboard.overview`

Nuovo file `src/server/api/routers/dashboard.ts`, registrato in
`src/server/api/root.ts` come `dashboard`.

- **Procedura**: `overview` — `protectedProcedure` (AGENT+, come gli altri
  router di dominio).
- **Input** (zod): `{ scope: z.enum(["mine", "team"]).default("mine") }`.
- **Scope effettivo** (server autoritativo):
  `const effectiveScope = ctx.session.user.role === "ADMIN" ? input.scope : "mine";`
  Un non-ADMIN che invii `scope: "team"` viene silenziosamente ridotto a `mine`
  (difesa in profondità: il toggle è comunque nascosto lato UI ai non-ADMIN).
- **Filtro utente**:
  - `mine` → `agentId = userId` (KitRequest/Conversation), `userId = userId` (ActivityLog).
  - `team` → nessun filtro utente (tutti gli agenti).

**Output**:

```ts
{
  scope: "mine" | "team";           // scope effettivamente applicato
  isAdmin: boolean;                  // per decidere se mostrare il toggle
  stats: {
    richieste:      { total: number; today: number };
    kitGenerati:    { total: number; today: number };
    conversazioni:  { total: number; today: number };
    prodottiCercati:{ total: number; today: number };
  };
  recentKits: Array<{
    id: string;
    requestNumber: string;
    status: KitRequestStatus;
    createdAt: Date;
    totalPrice: number | null;       // Decimal → number (o null se non generato)
    customerName: string | null;     // Customer.companyName, null se assente
  }>;
}
```

**Query (Prisma, nessun raw SQL)** — tutte con il filtro di scope + (per i
`today`) `createdAt >= startOfTodayRome()`:

- `richieste`: `kitRequest.count` (total) + `kitRequest.count` (createdAt oggi).
- `kitGenerati`: `kitRequest.count` con `generatedAt: { not: null }` (total) +
  quelli con `generatedAt` >= inizio oggi (today).
- `conversazioni`: `conversation.count`.
- `prodottiCercati`: `activityLog.count` con `type: "PRODUCT_SEARCHED"`.
- `recentKits`: `kitRequest.findMany({ take: 5, orderBy: { createdAt: "desc" },
  include: { customer: { select: { companyName: true } } } })`, mappato alla
  forma sopra (Decimal→number con `Number(totalPrice)`).

Le count si possono lanciare in parallelo (`Promise.all`) — sono indipendenti.
Nota indici: `KitRequest` ha già `@@index([agentId])`, `@@index([status])`,
`@@index([createdAt])`; `ActivityLog` ha `@@index([userId])`, `@@index([type])`,
`@@index([createdAt])`; `Conversation` ha `@@index([agentId])`. Nessun nuovo
indice necessario.

### Helper "inizio di oggi" — `startOfTodayRome`

Aggiunto a `src/lib/format.ts` (dove vive già la logica fuso `Europe/Rome`). Firma:

```ts
export function startOfTodayRome(now: Date = new Date()): Date
```

Ritorna l'istante UTC corrispondente alla mezzanotte odierna a Roma (DST
inclusa). Implementazione senza nuove dipendenze: derivare la data-calendario
di Roma con `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" })` e
calcolare l'offset del fuso in quel giorno (trick offset via `toLocaleString`
o `formatToParts`). L'esatta implementazione la fissa il TDD; il contratto è:
per ogni istante, `startOfTodayRome` ≤ now e rappresenta le 00:00 di Roma.

### Pagina e componenti

- **`page.tsx`** resta **server component**: legge la sessione
  (`firstName`, `role`) e monta `<DashboardClient firstName={...}
  isAdmin={role === "ADMIN"} />`. Nessuna query dati qui (la fa il client via
  react-query, coerente con `archivio`/`richieste`).
- **`dashboard-client.tsx`** (nuovo, client component):
  - Stato locale `scope` (default `"mine"`), toggle **visibile solo se
    `isAdmin`**.
  - `api.dashboard.overview.useQuery({ scope })`.
  - Render: intestazione "Ciao, {firstName}" · toggle (se admin) · 4 StatCard ·
    sezione "Ultime richieste kit" · card "Scorciatoie".
  - **Stati**: `isLoading` → skeleton (card + righe grigie); `isError` →
    messaggio inline con **"Riprova"** (`refetch()`); `recentKits` vuoto →
    empty state esistente ("Nessuna richiesta recente").
- **StatCard**: riuso dello stile attuale (icona in badge brand, numero grande
  `tabular-nums`, label sotto) + sottoriga "+N oggi" (`text-xs`, colore
  `ink-subtle`; nascosta se `today === 0`).
- **Riga richiesta recente**: numero (mono), cliente, `formatDate(createdAt)`,
  badge stato, `formatPrice(totalPrice)` (o "—"). Riuso di `formatDate`/
  `formatPrice` e del badge stato già usati in `richieste`.

## Data flow

```
page.tsx (server: sessione → firstName, isAdmin)
   └─ DashboardClient (client)
        └─ api.dashboard.overview.useQuery({ scope })   ← toggle cambia scope
             └─ dashboard.overview (server: effectiveScope, Promise.all count + findMany)
                  └─ Prisma (KitRequest / Conversation / ActivityLog)
```

## Gestione errori

- **Router**: nessuna eccezione attesa oltre a quelle infrastrutturali (DB).
  Lo scope non valido è impossibile (zod enum). Il non-ADMIN che forza `team`
  non è un errore: viene ridotto a `mine`.
- **Client**: errore query → banner inline + "Riprova" (nessun crash). Loading
  → skeleton, mai layout shift brusco.

## Testing (TDD)

- **`dashboard.test.ts`** (unit, `ctx.db` mockato come gli altri router test):
  - scope `mine` → tutte le count filtrano per `userId`/`agentId` di sessione;
  - scope `team` con ADMIN → count senza filtro utente;
  - scope `team` con AGENT → ridotto a `mine` (verifica che i `where` restino filtrati);
  - `kitGenerati` conta `generatedAt not null`;
  - `today` usa il confine `startOfTodayRome`;
  - forma di `recentKits` (mapping Decimal→number, `customerName` null se assente).
- **`format.test.ts`**: `startOfTodayRome` — un istante noto
  in CET e uno in CEST → mezzanotte di Roma corretta; risultato ≤ now.
- **`dashboard-client.test.tsx`** (testing-library, come `richieste-client.test.tsx`):
  - render dei 4 KPI con valori dal mock query;
  - toggle presente se `isAdmin`, assente altrimenti;
  - empty state quando `recentKits` è vuoto;
  - stato loading (skeleton) e stato errore (banner + Riprova).

## File

**Nuovi**
- `src/server/api/routers/dashboard.ts`
- `src/server/api/routers/dashboard.test.ts`
- `src/app/(dashboard)/dashboard/dashboard-client.tsx`
- `src/app/(dashboard)/dashboard/dashboard-client.test.tsx`

**Modificati**
- `src/server/api/root.ts` (registra `dashboard`)
- `src/app/(dashboard)/dashboard/page.tsx` (shell server → monta il client)
- `src/lib/format.ts` (aggiunge `startOfTodayRome`; + `format.test.ts`)

**Nessuna** migrazione / modifica a `schema.prisma`.

## Fuori scope (YAGNI)

- Grafici/trend storici (sparkline, serie temporali): non richiesti; i KPI sono
  numeri singoli + "oggi".
- Filtri per intervallo di date personalizzati.
- Export della dashboard.
- Cache/materializzazione dei conteggi: le count sono indicizzate e poche;
  ottimizzare solo se emergono lentezze reali.
- Metriche inventate (es. "tempo risparmiato"): escluse per non mostrare numeri
  senza dati dietro.
