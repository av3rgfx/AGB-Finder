# Profilo serramento del cliente — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dare a ogni cliente un profilo serramento (geometria + entrata) che l'agente applica al wizard con un clic esplicito, e togliere il default cablato che oggi fa partire ogni ordine con la geometria di un altro cliente.

**Architecture:** due colonne nullable su `customers` (nessun modello nuovo). Il profilo **non precompila**: al passo 3 un pulsante «Usa il profilo» scrive i due valori, e al passo 4 il riepilogo segnala se la scelta diverge. Lo snapshot sulla richiesta è già garantito da `kit.create`, che scrive geometria ed entrata sulla riga.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · tRPC v11 · Prisma 6 + PostgreSQL · Tailwind 3 · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-30-profilo-serramento-cliente-design.md`

## Global Constraints

- **TypeScript strict sempre.** Nessun `any`, nessun `!` non giustificato da un commento.
- **UI in italiano.** Codici prodotto in `font-mono`.
- **Mobile-first:** ogni schermata toccata va progettata e **verificata a ≤ 375px** oltre che desktop. Nessuna funzionalità nascosta o inutilizzabile su mobile.
- **API via tRPC, query via Prisma.** Nessun `fetch` diretto dal client, nessun raw SQL fuori da `RAGEngine` e dalle migrazioni.
- **Il kit è un engine deterministico TypeScript. MAI un LLM.**
- **Invariante non negoziabile:** il golden resta **16 righe / 21 pezzi / 90,20 €**; il gemello a entrata 7,5 resta **96,29 €**.
- **Il profilo non entra nell'input del motore.** `kitInputSchema`, `PersistedKitRequest` e `from-request.ts` non lo conoscono.
- Comandi: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`. Prima dei comandi prisma/tsx: `set -a; source .env; set +a`.
- **`jest-dom` NON è configurato.** I soli matcher DOM disponibili sono quelli nativi di Vitest: usare `toBeTruthy()` / `toBeNull()` / `.textContent` e **mai** `toBeInTheDocument`, `toHaveTextContent`, `toBeEmptyDOMElement` — non esistono e il test esplode a runtime, non in typecheck.
- **Idiom dei test per file:** `nuova-client.test.tsx` usa `fireEvent`; i test dei componenti (`customer-picker`, nuovi) usano `userEvent`. **Nessuno usa un wrapper**: tRPC è mockata a livello di modulo con `vi.mock("@/trpc/react", …)`.
- **`ArtechGeometryId` (da `artech-geometrie.ts`) e `ArtechGeometry` (enum Prisma) sono la stessa unione di stringhe** e si assegnano l'una all'altra senza cast — è già così in `dettaglio-client.tsx`, che passa `r.geometry` di Prisma a `geometriaLabel(id: ArtechGeometryId)`. Nel router si usa `z.nativeEnum(ArtechGeometry)`; nei componenti `ArtechGeometryId`.
- Un commit per task, messaggio in italiano, con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` | wizard: geometria non più preselezionata; blocco «Usa il profilo»; riga di divergenza | 1, 5, 6 |
| `prisma/schema.prisma` | due colonne su `Customer` | 2 |
| `prisma/migrations/<ts>_customer_kit_profile/migration.sql` | migrazione, nessun backfill | 2 |
| `src/server/api/routers/customer.ts` | i due campi in `list`/`create`/`update` | 3 |
| `src/server/kit/types.test.ts` | asserisce che lo schema del motore **scarti** i due campi | 3 |
| `src/components/kit/customer-picker.tsx` | i due campi nel form inline; `CustomerOption` porta il profilo | 4 |
| `src/components/kit/profilo-serramento.tsx` **(nuovo)** | il blocco riusabile «profilo del cliente» + pulsante, usato dal passo 3 | 5 |
| `src/app/(dashboard)/clienti/page.tsx` **(nuovo)** | pagina server, guardia sessione | 7 |
| `src/app/(dashboard)/clienti/clienti-client.tsx` **(nuovo)** | elenco + modifica + eliminazione | 7 |
| `src/components/layout/sidebar.tsx` | voce «Clienti» | 7 |
| `src/server/kit/codici-a-listino.integration.test.ts` | gate allargato a 5 larghezze | 8 |
| `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md` | domanda 29 (incontro incassato) + domanda 20 circostanziata | 9 |

Il blocco del profilo vive in un **componente proprio** e non dentro `nuova-client.tsx`: quel file è già a 1118 righe, e il blocco è testabile da solo — stesso criterio con cui `CustomerPicker` fu estratto.

---

### Task 1: Togliere il default cablato della geometria

Il difetto **in produzione oggi**, indipendente dal profilo: `ARTECH_DEFAULT.geometry = "A12_I13_B20"` fa partire ogni ordine con la geometria del cliente del golden. Commit isolato, primo della serie.

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` (righe 46, 49-63, 158-163, 738, 1093, 1102)
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `ArtechFormValues.geometry?: ArtechGeometryId` — da qui in poi la geometria del form è **opzionale**. I task 5 e 6 lo assumono.

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`, aggiungere:

**Idiom obbligato di questo file:** `fireEvent`, `render(<NuovaRichiestaClient />)` **senza wrapper** (tRPC è mockata a livello di modulo), `within(...)` per restringere ai gruppi. Non usare `userEvent` qui: `nuova-client.test.tsx` non lo importa.

```tsx
  it("nessuna geometria e` preselezionata, e senza sceglierla il passo non avanza", () => {
    render(<NuovaRichiestaClient />);
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3

    const geometria = screen.getByRole("group", { name: /geometria/i });
    const radio = within(geometria).getAllByRole("radio") as HTMLInputElement[];
    expect(radio).toHaveLength(Object.keys(GEOMETRIE).length);
    expect(radio.some((r) => r.checked)).toBe(false);

    // Si sceglie SOLO l'entrata: manca la geometria, il passo non avanza.
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: /15 mm/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i }));
    expect(screen.getByRole("group", { name: /geometria/i })).toBeTruthy();
    expect(screen.queryByText(/derivata/i)).toBeNull(); // il riepilogo non è comparso
  });
```

- [ ] **Step 2: Eseguirlo e verificare che fallisca**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL — oggi una geometria **è** preselezionata, quindi `geometrie.some(checked)` è `true`.

- [ ] **Step 3: Rendere opzionale la geometria nello stato del form**

Riga 40-46 — estendere il commento esistente e il tipo:

```ts
/**
 * Lo stato del form NON è un `ArtechKitInput`: **entrata e geometria** devono
 * nascere non valorizzate, perché sceglierle è il punto di questi campi.
 *
 * L'entrata lo fa dal 2026-07-30 (PR #40). La geometria si è aggiunta dopo: fino
 * ad allora `ARTECH_DEFAULT` la cablava a `A12_I13_B20`, cioè alla geometria del
 * cliente storico del golden — ogni nuovo ordine partiva con la geometria di un
 * altro cliente, e i codici dell'altra combinazione esistono a listino, hanno un
 * prezzo e non danno warning. È lo stesso difetto della cremonese cablata.
 *
 * È l'unico prezzo della decisione «nessun default», e si paga solo qui — la
 * validazione vera resta quella dello schema, all'avanzamento del passo e al submit.
 */
type ArtechFormValues = Omit<ArtechKitInput, "entrata" | "geometry"> & {
  entrata?: Entrata;
  geometry?: ArtechGeometryId;
};
```

Riga 49-63 — togliere la riga `geometry` e le tre righe di commento che la giustificavano:

```ts
const ARTECH_DEFAULT: ArtechFormValues = {
  windowType: "ANTA_RIBALTA",
  series: "ARTECH",
  material: "LEGNO",
  widthMm: 550,
  heightMm: 1820,
  seatConfig: "STANDARD",
  openingSide: "SINISTRA",
  openingDir: "TIRARE",
  finish: "ARGENTO",
  supplementaryClosures: false,
};
```

- [ ] **Step 4: Aggiornare i tre punti che leggevano `form.geometry` come certo**

Riga 738, in `Step3ManoFinitura` — `sedeMm` serviva a mostrare la sede derivata; senza geometria non esiste ancora:

```ts
  const sedeMm = form.geometry === undefined ? null : GEOMETRIE[form.geometry].sedeMm;
```

Righe 1093 e 1100-1103, in `Step4Riepilogo` — stesso trattamento già riservato a `form.entrata`:

```tsx
      {/* `form.geometry` e `form.entrata` sono opzionali nello stato ma qui sono
          sempre valorizzate: al passo 4 si arriva solo dopo la validazione del
          passo 3, che le richiede entrambe. */}
      {form.geometry && <SummaryItem label="Geometria" value={geometriaLabel(form.geometry)} />}
      {form.entrata && <SummaryItem label="Entrata maniglia" value={entrataLabel(form.entrata)} />}
      {/* La sede è l'unica quota DERIVATA che finisce nella distinta: mostrarla
          qui è ciò che permette all'agente di accorgersi di una geometria scelta
          male, ed è la ragione per cui il campo può sparire dall'input. */}
      {form.geometry && (
        <SummaryItem
          label="Sede incontri"
          value={sedeIncontriLabel(GEOMETRIE[form.geometry].sedeMm)}
        />
      )}
```

Righe 158-163 — il commento di `geometriaAmmessa` cita `ARTECH_DEFAULT.geometry`, che non esiste più. Sostituire la frase finale con:

```
 * Nessuna geometria è preselezionata (vedi `ArtechFormValues`), quindi cambiando
 * tipologia non ne sopravvive una non ammessa: si riparte da «nessuna scelta».
```

Verificare che `sedeMm` sia usato solo dove ora può essere `null`: se il JSX lo stampa, avvolgerlo in `{sedeMm !== null && …}`.

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`

**Attesa: molti test rossi, ed è corretto.** Dieci test navigano fino al passo 4 senza scegliere la geometria, perché fin qui gliela regalava il default: righe **208, 225, 240, 259, 295, 351, 477, 561, 579, 596**. Erano la codifica del difetto, non la sua sentinella.

Correzione meccanica: **prima** del click che porta al riepilogo, aggiungere la scelta esplicita — la stessa geometria che il default forniva, così le asserzioni a valle restano valide:

```tsx
    fireEvent.click(
      within(screen.getByRole("group", { name: /geometria/i })).getByLabelText(
        geometriaLabel("A12_I13_B20"),
      ),
    );
```

Nei test VASISTAS (righe 416, 477) usare `GEOMETRIA_COPERTA` invece di `A12_I13_B20`: è l'unica ammessa da quella tipologia.

Expected dopo la correzione: PASS, con lo stesso numero di test di prima più il nuovo.

Run: `pnpm typecheck`
Expected: nessun errore. Se `form.geometry` è letto altrove senza guardia, il compilatore lo dice ora — è il punto di renderlo opzionale.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/richieste/nuova/"
git commit -m "fix(wizard): ogni ordine partiva con la geometria di un altro cliente

ARTECH_DEFAULT cablava geometry: A12_I13_B20, la geometria del cliente
storico del golden. Sceglierla male non produce un errore — i codici
dell'altra combinazione esistono a listino e hanno un prezzo — quindi il
default non era una comodita' ma un errore silenzioso preconfezionato.

Stesso trattamento gia' dato all'entrata dalla #40: il campo nasce non
valorizzato e il passo 3 non avanza finche' l'agente non sceglie.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Le due colonne su `Customer`

**Files:**
- Modify: `prisma/schema.prisma` (model `Customer`, righe 460-490)
- Create: `prisma/migrations/<timestamp>_customer_kit_profile/migration.sql`

**Interfaces:**
- Produces: `Customer.kitGeometry: ArtechGeometry | null`, `Customer.kitEntrata: Entrata | null` — i task 3, 4, 5, 6, 7 li leggono.

- [ ] **Step 1: Aggiungere i campi allo schema**

In `prisma/schema.prisma`, dentro `model Customer`, subito dopo il blocco `discount`:

```prisma
  /// Profilo serramento del cliente — SOLO serie ARTECH.
  ///
  /// Sono le due quote che NON cambiano da un ordine all'altro dello stesso
  /// cliente: la geometria (aria/interasse/battuta) e l'entrata della maniglia.
  /// Servono a non farle ri-scegliere a memoria fra 14 combinazioni a ogni
  /// richiesta, quando sbagliarle non produce alcun errore visibile.
  ///
  /// NON precompilano il wizard: l'agente le applica con un clic esplicito
  /// («Usa il profilo»). Un valore preselezionato sarebbe lo stesso silenzio in
  /// un posto più visibile — è la decisione della #40, qui rispettata alla lettera.
  ///
  /// NULL = nessun profilo dichiarato, che è lo stato di OGNI cliente prima di
  /// questa migrazione: nessun backfill, a differenza di `kit_requests.entrata`.
  ///
  /// Lo snapshot è altrove e già garantito: `kit.create` scrive geometria ed
  /// entrata sulla riga di `kit_requests`, quindi correggere un profilo domani
  /// non tocca una distinta di ieri. Stessa proprietà per cui `discountPercent`
  /// vive sulla richiesta e non solo sul cliente.
  kitGeometry ArtechGeometry? @map("kit_geometry")
  kitEntrata  Entrata?        @map("kit_entrata")
```

- [ ] **Step 2: Generare la migrazione**

```bash
set -a; source .env; set +a
pnpm exec prisma migrate dev --name customer_kit_profile --create-only
```

Expected: crea `prisma/migrations/<timestamp>_customer_kit_profile/migration.sql` contenente

```sql
-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "kit_entrata" "Entrata",
ADD COLUMN     "kit_geometry" "ArtechGeometry";
```

Gli enum `"ArtechGeometry"` e `"Entrata"` **esistono già** (migrazioni `20260730084816_kit_geometria` e `20260730160444_kit_entrata`): la migrazione non deve contenere `CREATE TYPE`. Se lo contiene, la migrazione precedente non è applicata al DB locale — eseguire `pnpm exec prisma migrate deploy` e rigenerare.

- [ ] **Step 3: Aggiungere il commento in testa alla migrazione**

```sql
-- Profilo serramento del cliente: due colonne NULLABLE, NESSUN BACKFILL.
--
-- NULL = nessun profilo dichiarato, ed è lo stato legittimo di ogni riga
-- esistente: `customers` in produzione è vuota. È il caso opposto al backfill
-- di `kit_requests.entrata`, dove NULL avrebbe significato «dato rotto» perché
-- il motore aveva applicato una costante a tutte le righe.
```

- [ ] **Step 4: Applicare e verificare**

```bash
set -a; source .env; set +a
pnpm exec prisma migrate deploy && pnpm exec prisma generate
docker exec ufptrade-db psql -U postgres -d utpistoia -c "\d customers" | grep kit_
```

Expected: due righe, `kit_geometry | ArtechGeometry` e `kit_entrata | Entrata`, entrambe nullable.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(profilo): due colonne sul cliente, nessun backfill

Geometria ed entrata sono le due quote che non cambiano fra un ordine e
l'altro dello stesso cliente. NULL = nessun profilo, che e' lo stato di
ogni riga esistente: l'anagrafica in produzione e' vuota.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Il router, e il confine col motore

**Files:**
- Modify: `src/server/api/routers/customer.ts`
- Test: `src/server/api/routers/customer.test.ts`
- Test: `src/server/kit/types.test.ts`

**Interfaces:**
- Consumes: `Customer.kitGeometry`, `Customer.kitEntrata` (Task 2)
- Produces: il DTO di `customer.list`/`create`/`update` diventa
  `{ id: string; companyName: string; discount: number | null; kitGeometry: ArtechGeometryId | null; kitEntrata: Entrata | null }`.
  Task 4, 5, 6, 7 lo consumano sotto il nome `CustomerOption`.

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/server/api/routers/customer.test.ts`:

```ts
it("list restituisce il profilo serramento", async () => {
  customerFindMany.mockResolvedValue([
    {
      id: "c1",
      companyName: "Fosca",
      discount: null,
      kitGeometry: "A12_I13_B18",
      kitEntrata: "E15",
    },
  ]);
  await expect(caller.customer.list({})).resolves.toEqual([
    {
      id: "c1",
      companyName: "Fosca",
      discount: null,
      kitGeometry: "A12_I13_B18",
      kitEntrata: "E15",
    },
  ]);
});

it("create accetta il profilo, e senza profilo scrive NULL", async () => {
  customerCreate.mockResolvedValue({
    id: "c1",
    companyName: "Peruzzi",
    discount: null,
    kitGeometry: "A4_I9_B18",
    kitEntrata: null,
  });
  await caller.customer.create({ companyName: "Peruzzi", kitGeometry: "A4_I9_B18" });
  expect(customerCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ kitGeometry: "A4_I9_B18", kitEntrata: null }),
    }),
  );
});

it("update distingue «non toccare» da «azzera»", async () => {
  customerUpdate.mockResolvedValue({
    id: "c1",
    companyName: "MC",
    discount: null,
    kitGeometry: null,
    kitEntrata: null,
  });

  // `undefined` = non toccare: la chiave non deve comparire nel data.
  await caller.customer.update({ id: "c1", companyName: "MC" });
  expect(customerUpdate.mock.calls.at(-1)?.[0].data).not.toHaveProperty("kitGeometry");

  // `null` = azzera: la chiave deve comparire, a null.
  await caller.customer.update({ id: "c1", kitGeometry: null });
  expect(customerUpdate.mock.calls.at(-1)?.[0].data).toHaveProperty("kitGeometry", null);
});

it("rifiuta una geometria che non esiste", async () => {
  await expect(
    caller.customer.create({ companyName: "X", kitGeometry: "A99_I0_B0" as never }),
  ).rejects.toThrow();
});
```

In `src/server/kit/types.test.ts`, accanto al test che prova lo scarto di `customerId`:

```ts
it("kitInputSchema SCARTA il profilo del cliente", () => {
  // Il profilo è un suggerimento al wizard, non un ingresso del motore: se
  // entrasse nell'input, `kit.generate` — che ricostruisce l'input rileggendo le
  // colonne di `kit_requests` — non lo troverebbe, e ogni rigenerazione
  // divergerebbe dalla prima generazione.
  const parsed = kitInputSchema.parse({
    ...ARTECH_VALIDO,
    kitGeometry: "A4_I9_B18",
    kitEntrata: "E75",
  } as never);
  expect(parsed).not.toHaveProperty("kitGeometry");
  expect(parsed).not.toHaveProperty("kitEntrata");
});
```

(`ARTECH_VALIDO` è la fixture già presente nel file; se ha un altro nome, usare quello.)

- [ ] **Step 2: Eseguire e verificare che falliscano**

Run: `pnpm test src/server/api/routers/customer.test.ts src/server/kit/types.test.ts`
Expected: i test del router FAIL (il DTO non ha i campi); il test di `types.test.ts` **potrebbe già passare** se lo schema è `strip` di default — in quel caso è un test di **regressione** ed è corretto che sia verde subito: annotarlo con un commento e proseguire.

- [ ] **Step 3: Implementare nel router**

In `src/server/api/routers/customer.ts`:

```ts
import { ArtechGeometry, Entrata } from "@prisma/client";

/**
 * I due campi del profilo serramento. Enum di Prisma e non `z.string()`: una
 * geometria inventata deve essere rifiutata al confine, non arrivare a DB.
 */
const kitGeometrySchema = z.nativeEnum(ArtechGeometry);
const kitEntrataSchema = z.nativeEnum(Entrata);

const SELECT = {
  id: true,
  companyName: true,
  discount: true,
  kitGeometry: true,
  kitEntrata: true,
} as const;

function toDto(row: {
  id: string;
  companyName: string;
  discount: unknown;
  kitGeometry: ArtechGeometry | null;
  kitEntrata: Entrata | null;
}) {
  return {
    id: row.id,
    companyName: row.companyName,
    discount: row.discount === null || row.discount === undefined ? null : Number(row.discount),
    kitGeometry: row.kitGeometry,
    kitEntrata: row.kitEntrata,
  };
}
```

`create` — input e data:

```ts
  create: agentProcedure
    .input(
      z.object({
        companyName: companyNameSchema,
        discount: scontoPercentSchema.optional(),
        kitGeometry: kitGeometrySchema.optional(),
        kitEntrata: kitEntrataSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.create({
        data: {
          companyName: input.companyName,
          discount: input.discount ?? null,
          kitGeometry: input.kitGeometry ?? null,
          kitEntrata: input.kitEntrata ?? null,
        },
        select: SELECT,
      });
      return toDto(row);
    }),
```

`update` — `nullable().optional()`, stesso criterio di `discount`:

```ts
  update: agentProcedure
    .input(
      z.object({
        id: z.string().min(1),
        companyName: companyNameSchema.optional(),
        // `nullable` e non solo `optional`: azzerare lo sconto di un cliente
        // deve essere possibile, ed è diverso dal non toccarlo. Idem per il
        // profilo: un cliente che cambia linea di serramento deve poterlo
        // svuotare, e «svuotato» non è «non specificato».
        discount: scontoPercentSchema.nullable().optional(),
        kitGeometry: kitGeometrySchema.nullable().optional(),
        kitEntrata: kitEntrataSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.customer.update({
        where: { id: input.id },
        data: {
          ...(input.companyName === undefined ? {} : { companyName: input.companyName }),
          ...(input.discount === undefined ? {} : { discount: input.discount }),
          ...(input.kitGeometry === undefined ? {} : { kitGeometry: input.kitGeometry }),
          ...(input.kitEntrata === undefined ? {} : { kitEntrata: input.kitEntrata }),
        },
        select: SELECT,
      });
      return toDto(row);
    }),
```

Aggiornare anche il commento di testata del file: l'anagrafica non è più «ragione sociale e sconto» soltanto.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm test src/server/api/routers/customer.test.ts src/server/kit/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/api/routers/customer.ts src/server/api/routers/customer.test.ts src/server/kit/types.test.ts
git commit -m "feat(profilo): il router porta il profilo, e il motore non lo vede

I due campi viaggiano in list/create/update con la stessa disciplina dello
sconto: nullable distinto da undefined, perche' azzerare un profilo non e'
lasciarlo stare. Un test prova che kitInputSchema li SCARTA: il profilo e'
un suggerimento al wizard, non un ingresso del motore — se entrasse
nell'input, kit.generate non lo ritroverebbe rileggendo le colonne.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `CustomerPicker` — il profilo alla creazione

**Files:**
- Modify: `src/components/kit/customer-picker.tsx`
- Test: `src/components/kit/customer-picker.test.tsx`

**Interfaces:**
- Consumes: DTO di `customer.create`/`list` (Task 3)
- Produces: `CustomerOption` esteso con `kitGeometry: ArtechGeometryId | null` e `kitEntrata: Entrata | null`. Task 5 e 6 lo leggono da `nuova-client.tsx`.

- [ ] **Step 1: Scrivere il test che fallisce**

**Idiom di questo file:** `userEvent`, `render(<CustomerPicker … />)` **senza wrapper** (tRPC mockata a livello di modulo), `listQuery` valorizzata in `beforeEach`.

Prima di tutto, **estendere le fixture esistenti** — la costante `clienti` in testa al file oggi non ha i due campi, e senza di essi ogni nuovo test è ambiguo:

```tsx
const clienti = [
  { id: "c1", companyName: "Fosca", discount: 42.5, kitGeometry: "A12_I13_B18", kitEntrata: "E15" },
  { id: "c2", companyName: "Peruzzi", discount: null, kitGeometry: null, kitEntrata: null },
];
```

Poi i test nuovi:

```tsx
it("il form inline crea un cliente col suo profilo serramento", async () => {
  const user = userEvent.setup();
  createMutate.mockResolvedValue({
    id: "c3", companyName: "MC", discount: null,
    kitGeometry: "A4_I85_B15", kitEntrata: "E15",
  });
  render(<CustomerPicker value={null} onChange={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: /nuovo cliente/i }));
  await user.type(screen.getByLabelText(/ragione sociale/i), "MC");
  await user.selectOptions(screen.getByLabelText(/geometria/i), "A4_I85_B15");
  await user.selectOptions(screen.getByLabelText(/entrata/i), "E15");
  await user.click(screen.getByRole("button", { name: /^crea$/i }));

  expect(createMutate).toHaveBeenCalledWith({
    companyName: "MC",
    kitGeometry: "A4_I85_B15",
    kitEntrata: "E15",
  });
});

it("senza profilo non manda i due campi", async () => {
  const user = userEvent.setup();
  createMutate.mockResolvedValue({
    id: "c4", companyName: "Occasionale", discount: null,
    kitGeometry: null, kitEntrata: null,
  });
  render(<CustomerPicker value={null} onChange={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: /nuovo cliente/i }));
  await user.type(screen.getByLabelText(/ragione sociale/i), "Occasionale");
  await user.click(screen.getByRole("button", { name: /^crea$/i }));

  expect(createMutate).toHaveBeenCalledWith({ companyName: "Occasionale" });
});

it("il cliente scelto porta il profilo a chi lo consuma", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<CustomerPicker value={null} onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: /Fosca/ }));
  expect(onChange).toHaveBeenCalledWith(
    expect.objectContaining({ kitGeometry: "A12_I13_B18", kitEntrata: "E15" }),
  );
});
```

**Nota:** anche il mock del wizard (`nuova-client.test.tsx`, righe 20-24) restituisce clienti senza i due campi. Va esteso nello stesso modo, altrimenti i task 5 e 6 non hanno un profilo da mostrare.

- [ ] **Step 2: Eseguirlo e verificare che fallisca**

Run: `pnpm test src/components/kit/customer-picker.test.tsx`
Expected: FAIL — `getByLabelText(/geometria/i)` non trova nulla.

- [ ] **Step 3: Implementare**

Estendere il tipo:

```ts
export interface CustomerOption {
  id: string;
  companyName: string;
  discount: number | null;
  kitGeometry: ArtechGeometryId | null;
  kitEntrata: Entrata | null;
}
```

Stato e submit:

```ts
  const [geometria, setGeometria] = useState<ArtechGeometryId | "">("");
  const [entrata, setEntrata] = useState<Entrata | "">("");
  const geometriaId = useId();
  const entrataId = useId();

  async function handleCrea() {
    const companyName = nome.trim();
    if (!companyName || !scontoValido) return;
    const creato = await create.mutateAsync({
      companyName,
      ...(scontoNum === null ? {} : { discount: scontoNum }),
      ...(geometria === "" ? {} : { kitGeometry: geometria }),
      ...(entrata === "" ? {} : { kitEntrata: entrata }),
    });
    void utils.customer.list.invalidate();
    setCreating(false);
    setNome("");
    setSconto("");
    setGeometria("");
    setEntrata("");
    onChange(creato);
  }
```

JSX, dentro il blocco `creating`, sotto lo sconto. **`<select>` e non radio**: il form inline è un riquadro compatto dentro un wizard, e sette radio a 375px lo farebbero esplodere; al passo 3, dove la scelta è il punto della schermata, restano i radio.

```tsx
          <label htmlFor={geometriaId} className="text-sm text-ink-muted">
            Geometria del serramento <span className="text-ink-subtle">(facoltativa)</span>
          </label>
          <select
            id={geometriaId}
            value={geometria}
            onChange={(e) => setGeometria(e.target.value as ArtechGeometryId | "")}
            className="h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="">Non dichiarata</option>
            {(Object.keys(GEOMETRIE) as ArtechGeometryId[]).map((id) => (
              <option key={id} value={id}>
                {geometriaLabel(id)}
              </option>
            ))}
          </select>

          <label htmlFor={entrataId} className="text-sm text-ink-muted">
            Entrata maniglia <span className="text-ink-subtle">(facoltativa)</span>
          </label>
          <select
            id={entrataId}
            value={entrata}
            onChange={(e) => setEntrata(e.target.value as Entrata | "")}
            className="h-11 rounded border border-line-strong bg-surface px-3.5 text-sm text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <option value="">Non dichiarata</option>
            {ENTRATE.map((v) => (
              <option key={v} value={v}>
                Entrata {entrataLabel(v)}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-subtle">
            Sono le due quote che non cambiano fra un ordine e l'altro di questo cliente. Non
            precompilano nulla: al passo della geometria potrai applicarle con un clic.
          </p>
```

Aggiornare il testo introduttivo del picker: oggi dice solo «Sceglierlo applica il suo sconto alla distinta».

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm test src/components/kit/customer-picker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/kit/customer-picker.tsx src/components/kit/customer-picker.test.tsx
git commit -m "feat(profilo): chi crea un cliente al volo puo' gia' dargli il profilo

Due select facoltative nel form inline — select e non radio perche' il
riquadro vive dentro il wizard e sette radio a 375px lo farebbero esplodere.
Al passo 3, dove la scelta e' il punto della schermata, restano i radio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Il blocco «Usa il profilo» al passo 3

**Files:**
- Create: `src/components/kit/profilo-serramento.tsx`
- Create: `src/components/kit/profilo-serramento.test.tsx`
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` (passare `cliente` a `Step3ManoFinitura` e renderizzare il blocco)

**Interfaces:**
- Consumes: `CustomerOption` (Task 4), `ArtechFormValues.geometry?` (Task 1)
- Produces:
  ```ts
  export function ProfiloSerramento(props: {
    cliente: CustomerOption | null;
    onApplica: (p: { geometry?: ArtechGeometryId; entrata?: Entrata }) => void;
  }): JSX.Element | null;
  ```
  Restituisce `null` se il cliente è assente o non ha né geometria né entrata.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
const FOSCA: CustomerOption = {
  id: "c1", companyName: "Fosca", discount: null,
  kitGeometry: "A12_I13_B18", kitEntrata: "E15",
};

it("non mostra nulla senza cliente", () => {
  const { container } = render(<ProfiloSerramento cliente={null} onApplica={vi.fn()} />);
  expect(container.innerHTML).toBe("");
});

it("non mostra nulla se il cliente non ha profilo", () => {
  const { container } = render(
    <ProfiloSerramento
      cliente={{ ...FOSCA, kitGeometry: null, kitEntrata: null }}
      onApplica={vi.fn()}
    />,
  );
  expect(container.innerHTML).toBe("");
});

it("mostra i valori e dichiara che non sono verificati", () => {
  render(<ProfiloSerramento cliente={FOSCA} onApplica={vi.fn()} />);
  expect(screen.getByText(/Aria 12 · interasse 13 · battuta 18/)).toBeTruthy();
  expect(screen.getByText(/Entrata 15/)).toBeTruthy();
  expect(screen.getByText(/mai confrontato con un ordine/i)).toBeTruthy();
});

it("il pulsante applica entrambi i valori in un colpo", async () => {
  const user = userEvent.setup();
  const onApplica = vi.fn();
  render(<ProfiloSerramento cliente={FOSCA} onApplica={onApplica} />);
  await user.click(screen.getByRole("button", { name: /usa il profilo/i }));
  expect(onApplica).toHaveBeenCalledWith({ geometry: "A12_I13_B18", entrata: "E15" });
});

it("applica solo ciò che il profilo contiene", async () => {
  const user = userEvent.setup();
  const onApplica = vi.fn();
  render(
    <ProfiloSerramento cliente={{ ...FOSCA, kitEntrata: null }} onApplica={onApplica} />,
  );
  await user.click(screen.getByRole("button", { name: /usa il profilo/i }));
  expect(onApplica).toHaveBeenCalledWith({ geometry: "A12_I13_B18" });
});
```

- [ ] **Step 2: Eseguirli e verificare che falliscano**

Run: `pnpm test src/components/kit/profilo-serramento.test.tsx`
Expected: FAIL — il modulo non esiste.

- [ ] **Step 3: Implementare il componente**

```tsx
"use client";

import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geometriaLabel, type ArtechGeometryId } from "@/server/kit/artech-geometrie";
import { entrataLabel, type Entrata } from "@/server/kit/types";
import type { CustomerOption } from "./customer-picker";

/**
 * Il profilo serramento del cliente, con un pulsante che lo applica.
 *
 * PERCHÉ UN PULSANTE E NON UNA PRECOMPILAZIONE. Sceglierlo è il punto di questi
 * campi: la #40 ha tolto il default dell'entrata perché «un default sarebbe lo
 * stesso silenzio in un posto più visibile», e un valore che arriva da un
 * profilo resta un valore che l'agente non ha scelto in quel momento — con in
 * più un'etichetta che lo fa sembrare verificato. Col pulsante il riempimento è
 * un **atto esplicito**, e nulla è mai preselezionato.
 *
 * PERCHÉ L'ETICHETTA DICE «MAI CONFRONTATO CON UN ORDINE». Perché è vero: il
 * profilo lo digita l'agente, dalla stessa memoria che è il punto di rottura.
 * Non è una colonna di stato — oggi TUTTI i profili sono in quello stato, e una
 * colonna che vale sempre lo stesso valore è la colonna che non serve. Quando
 * arriveranno le distinte reali, allora sarà uno stato da modellare.
 */
export function ProfiloSerramento({
  cliente,
  onApplica,
}: {
  cliente: CustomerOption | null;
  onApplica: (p: { geometry?: ArtechGeometryId; entrata?: Entrata }) => void;
}) {
  if (cliente === null) return null;
  const { kitGeometry, kitEntrata } = cliente;
  if (kitGeometry === null && kitEntrata === null) return null;

  return (
    // Mobile-first: in colonna sotto sm, il pulsante a larghezza piena sotto i
    // valori — a 375px un pulsante affiancato a due righe di testo lungo si
    // schiaccia a due caratteri.
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-sunken p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <UserRound className="size-4 shrink-0" aria-hidden />
          Profilo di {cliente.companyName}
        </span>
        <span className="text-sm text-ink-muted">
          {kitGeometry !== null && geometriaLabel(kitGeometry)}
          {kitGeometry !== null && kitEntrata !== null && " · "}
          {kitEntrata !== null && `Entrata ${entrataLabel(kitEntrata)}`}
        </span>
        <span className="text-xs text-ink-subtle">
          Dichiarato in anagrafica, mai confrontato con un ordine.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="w-full shrink-0 sm:w-auto"
        onClick={() =>
          onApplica({
            ...(kitGeometry !== null && { geometry: kitGeometry }),
            ...(kitEntrata !== null && { entrata: kitEntrata }),
          })
        }
      >
        Usa il profilo
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Innestarlo nel passo 3**

In `nuova-client.tsx`, passare il cliente allo step 3:

```tsx
        {step === 3 &&
          (form.series === "TOUR" ? (
            <Step3SchemaFinitura form={form} update={makeUpdate<TourKitInput>(setForm)} />
          ) : (
            <Step3ManoFinitura
              form={form}
              update={makeUpdate<ArtechFormValues>(setForm)}
              cliente={cliente}
            />
          ))}
```

e in `Step3ManoFinitura`, come **prima** cosa del blocco (sopra la fieldset «Geometria del serramento»):

```tsx
function Step3ManoFinitura({
  form,
  update,
  cliente,
}: {
  form: ArtechFormValues;
  update: Update<ArtechFormValues>;
  cliente: CustomerOption | null;
}) {
  const sedeMm = form.geometry === undefined ? null : GEOMETRIE[form.geometry].sedeMm;
  return (
    <div className="flex flex-col gap-6">
      <ProfiloSerramento
        cliente={cliente}
        onApplica={(p) => {
          // Si applica SOLO ciò che il profilo contiene, e solo se la geometria è
          // ammessa per questa tipologia: la vasistas copre una geometria sola
          // (GEOMETRIA_COPERTA), e scriverne un'altra darebbe un passo che non
          // avanza con un valore che l'agente non ha scelto.
          if (p.geometry !== undefined && geometriaAmmessa(form.windowType, p.geometry))
            update("geometry", p.geometry);
          if (p.entrata !== undefined && entrataAmmessa(form.windowType, p.entrata))
            update("entrata", p.entrata);
        }}
      />
      {/* Da qui in giù il corpo esistente resta invariato: la fieldset
          «Geometria del serramento», quella «Entrata maniglia», mano,
          apertura, finitura e il toggle chiusure. */}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `pnpm test src/components/kit/profilo-serramento.test.tsx src/app/\(dashboard\)/richieste/nuova/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/kit/profilo-serramento.tsx src/components/kit/profilo-serramento.test.tsx "src/app/(dashboard)/richieste/nuova/nuova-client.tsx"
git commit -m "feat(profilo): un clic esplicito, non un valore che c'e' gia'

Il council ha respinto la precompilazione: un valore che arriva da un
profilo resta un valore che l'agente non ha scelto in quel momento, con in
piu' un'etichetta che lo fa sembrare verificato. Col pulsante il riempimento
e' un atto esplicito e nulla e' mai preselezionato — la regola della #40
regge alla lettera su entrambi i campi.

L'etichetta dice cio' che e' vero: dichiarato in anagrafica, mai confrontato
con un ordine. Applica solo cio' che il profilo contiene, e solo se la
tipologia lo ammette.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: La riga di divergenza al passo 4

**Files:**
- Modify: `src/app/(dashboard)/richieste/nuova/nuova-client.tsx` (`Step4Riepilogo`)
- Test: `src/app/(dashboard)/richieste/nuova/nuova-client.test.tsx`

**Interfaces:**
- Consumes: `CustomerOption` (Task 4), `ArtechFormValues` (Task 1)
- Produces: niente per i task successivi.

- [ ] **Step 1: Scrivere i test che falliscono**

Il mock di `customer.list` del file (esteso nel Task 4) espone **Fosca** con profilo `A12_I13_B18` / `E15`. Helper locale, in testa al `describe`, per non ripetere la navigazione tre volte:

```tsx
  /** Porta al riepilogo scegliendo cliente, geometria ed entrata. */
  function alRiepilogo(opts: {
    cliente?: string;
    geometry: ArtechGeometryId;
    entrata: RegExp;
  }) {
    render(<NuovaRichiestaClient />);
    if (opts.cliente !== undefined)
      fireEvent.click(screen.getByRole("button", { name: new RegExp(opts.cliente) }));
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 2 → 3
    fireEvent.click(
      within(screen.getByRole("group", { name: /geometria/i })).getByLabelText(
        geometriaLabel(opts.geometry),
      ),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: /entrata maniglia/i })).getByRole("radio", {
        name: opts.entrata,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /avanti/i })); // 3 → 4
  }
```

E i tre test:

```tsx
  it("il riepilogo segnala la divergenza dal profilo del cliente", () => {
    // Fosca ha profilo A12_I13_B18 / E15; l'agente sceglie A12_I13_B20 / 7,5.
    alRiepilogo({ cliente: "Fosca", geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.getByText(/diverso dal profilo di Fosca/i)).toBeTruthy();
    // Mostra i valori DEL PROFILO, non quelli scelti: sono ciò con cui confrontarsi.
    expect(screen.getByText(new RegExp(geometriaLabel("A12_I13_B18")))).toBeTruthy();
  });

  it("non segnala nulla se la scelta coincide col profilo", () => {
    alRiepilogo({ cliente: "Fosca", geometry: "A12_I13_B18", entrata: /15 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });

  it("non segnala nulla se il cliente non ha profilo", () => {
    // Peruzzi nel mock ha kitGeometry e kitEntrata a null.
    alRiepilogo({ cliente: "Peruzzi", geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });

  it("non segnala nulla senza cliente", () => {
    alRiepilogo({ geometry: "A12_I13_B20", entrata: /7,5 mm/i });
    expect(screen.queryByText(/diverso dal profilo/i)).toBeNull();
  });
```

Se il mock di `customer.list` in questo file espone un solo cliente, aggiungere **Peruzzi** (profilo a `null`) — serve al terzo test.

- [ ] **Step 2: Eseguirli e verificare che falliscano**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: FAIL — il testo non esiste.

- [ ] **Step 3: Implementare**

Helper puro, sopra `Step4Riepilogo`, così è leggibile e testabile:

```tsx
/**
 * Le voci del profilo su cui la scelta dell'agente diverge.
 *
 * PERCHÉ CONSTATA E NON BLOCCA. È il primo rilevatore d'errore che il sistema
 * possieda — oggi nessuno confronta la richiesta di marzo con quella di
 * settembre — ma non sa QUALE delle due dichiarazioni sia giusta: il profilo lo
 * ha scritto lo stesso agente, a memoria. Segnala che due dichiarazioni sullo
 * stesso cliente non coincidono, il che è informativo in entrambe le direzioni.
 * Un blocco, o una conferma da cliccare, sarebbe teatro del consenso.
 *
 * Le voci a NULL nel profilo non divergono: «non dichiarato» non è «diverso».
 */
function divergenzeDalProfilo(
  form: ArtechFormValues,
  cliente: CustomerOption | null,
): string[] {
  if (cliente === null) return [];
  const out: string[] = [];
  if (cliente.kitGeometry !== null && form.geometry !== cliente.kitGeometry)
    out.push(geometriaLabel(cliente.kitGeometry));
  if (cliente.kitEntrata !== null && form.entrata !== cliente.kitEntrata)
    out.push(`Entrata ${entrataLabel(cliente.kitEntrata)}`);
  return out;
}
```

Nel ramo ARTECH di `Step4Riepilogo`, **sotto** la `<dl>`:

```tsx
      {(() => {
        const divergenze = divergenzeDalProfilo(form, cliente);
        if (divergenze.length === 0) return null;
        return (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-muted">
            <span className="font-medium text-ink">Diverso dal profilo di {cliente!.companyName}:</span>{" "}
            {divergenze.join(" · ")}. Va bene se questo serramento è diverso dal solito; se non lo
            è, controlla la scelta o aggiorna il profilo in Clienti.
          </p>
        );
      })()}
```

`cliente!` è sicuro: `divergenze.length > 0` implica `cliente !== null` per costruzione di `divergenzeDalProfilo`. Se la classe `warning` non esiste in `tailwind.config.ts`, usare `border-line`/`bg-surface-sunken` — **verificare, non assumere**.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `pnpm test src/app/\(dashboard\)/richieste/nuova/nuova-client.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/richieste/nuova/"
git commit -m "feat(profilo): il riepilogo dice se la scelta diverge dal profilo

Constata, non blocca: non sa quale delle due dichiarazioni sia giusta —
il profilo l'ha scritto lo stesso agente, a memoria. Ma e' il primo
rilevatore d'errore che il sistema possieda: oggi nessuno confronta la
richiesta di marzo con quella di settembre.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: La pagina `/clienti`

Chiude anche il buco per cui `customer.update` e `customer.delete` esistono nel router e **non sono raggiungibili da nessuna schermata**: oggi un cliente, una volta creato, non è più correggibile.

**Files:**
- Create: `src/app/(dashboard)/clienti/page.tsx`
- Create: `src/app/(dashboard)/clienti/clienti-client.tsx`
- Create: `src/app/(dashboard)/clienti/clienti-client.test.tsx`
- Modify: `src/components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: `customer.list`/`update`/`delete` (Task 3)
- Produces: niente per i task successivi.

- [ ] **Step 1: Scrivere i test che falliscono**

Stesso impianto di `customer-picker.test.tsx`: `userEvent`, nessun wrapper, mock a livello di modulo con `listQuery` pilotabile per test.

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const listQuery = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const invalidateList = vi.fn();

vi.mock("@/trpc/react", () => ({
  api: {
    customer: {
      list: { useQuery: (...args: unknown[]) => listQuery(...args) },
      update: {
        useMutation: () => ({ mutateAsync: updateMutate, isPending: false, isError: false, error: null }),
      },
      delete: {
        useMutation: () => ({ mutateAsync: deleteMutate, isPending: false, isError: false, error: null }),
      },
    },
    useUtils: () => ({ customer: { list: { invalidate: invalidateList } } }),
  },
}));

import { ClientiClient } from "./clienti-client";
import { geometriaLabel } from "@/server/kit/artech-geometrie";

const clienti = [
  { id: "c1", companyName: "Fosca", discount: 42.5, kitGeometry: "A12_I13_B18", kitEntrata: "E15" },
  { id: "c2", companyName: "Peruzzi", discount: null, kitGeometry: null, kitEntrata: null },
];

beforeEach(() => {
  listQuery.mockReset().mockReturnValue({ data: clienti, isPending: false, isError: false });
  updateMutate.mockReset().mockResolvedValue(clienti[0]);
  deleteMutate.mockReset();
  invalidateList.mockReset();
});

afterEach(cleanup);

describe("ClientiClient", () => {
  it("elenca i clienti col profilo e lo sconto", () => {
    render(<ClientiClient />);
    expect(screen.getByText("Fosca")).toBeTruthy();
    expect(screen.getByText(new RegExp(geometriaLabel("A12_I13_B18")))).toBeTruthy();
    expect(screen.getByText(/42,5/)).toBeTruthy();
  });

  it("dice «nessun profilo» invece di lasciare la cella vuota", () => {
    render(<ClientiClient />);
    expect(screen.getByText(/nessun profilo/i)).toBeTruthy();
  });

  it("la modifica salva il profilo", async () => {
    const user = userEvent.setup();
    render(<ClientiClient />);
    await user.click(screen.getAllByRole("button", { name: /azioni/i })[0]!);
    await user.click(screen.getByRole("button", { name: /modifica/i }));
    await user.selectOptions(screen.getByLabelText(/geometria/i), "A4_I9_B18");
    await user.click(screen.getByRole("button", { name: /salva/i }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", kitGeometry: "A4_I9_B18" }),
    );
  });

  it("azzerare il profilo manda null, non undefined", async () => {
    const user = userEvent.setup();
    render(<ClientiClient />);
    await user.click(screen.getAllByRole("button", { name: /azioni/i })[0]!); // Fosca
    await user.click(screen.getByRole("button", { name: /modifica/i }));
    await user.selectOptions(screen.getByLabelText(/geometria/i), ""); // «Non dichiarata»
    await user.click(screen.getByRole("button", { name: /salva/i }));

    const inviato = updateMutate.mock.calls.at(-1)?.[0];
    expect(inviato).toHaveProperty("kitGeometry", null);
    // `null` e non `undefined`: azzerare non e` «non toccare».
    expect(inviato.kitGeometry).not.toBeUndefined();
  });

  it("l'anagrafica vuota ha un empty-state, non una tabella vuota", () => {
    listQuery.mockReturnValue({ data: [], isPending: false, isError: false });
    render(<ClientiClient />);
    expect(screen.getByText(/nessun cliente in anagrafica/i)).toBeTruthy();
  });

  it("mostra il motivo se il cliente non e` eliminabile", async () => {
    const user = userEvent.setup();
    deleteMutate.mockRejectedValue(new Error("Cliente con 3 richieste collegate: non si può eliminare."));
    render(<ClientiClient />);
    await user.click(screen.getAllByRole("button", { name: /azioni/i })[0]!);
    await user.click(screen.getByRole("button", { name: /elimina/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/3 richieste collegate/);
  });
});
```

- [ ] **Step 2: Eseguirli e verificare che falliscano**

Run: `pnpm test src/app/\(dashboard\)/clienti/`
Expected: FAIL — i file non esistono.

- [ ] **Step 3: Scrivere `page.tsx`**

Sulla forma di `utenti/page.tsx`, **ma senza il gate ADMIN**: l'anagrafica è condivisa fra gli agenti e il router usa `agentProcedure`. Un gate ADMIN qui contraddirebbe il router.

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ClientiClient } from "./clienti-client";

export default async function ClientiPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Clienti</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Lo sconto e il profilo serramento di ciascun cliente. Il profilo non precompila nulla:
          si applica con un clic quando crei una richiesta.
        </p>
      </header>
      <ClientiClient />
    </div>
  );
}
```

- [ ] **Step 4: Scrivere `clienti-client.tsx`**

Ricalcare `utenti-client.tsx`: tabella in `overflow-x-auto`, azioni in menu ⋯ con **dropdown `position: fixed`** (altrimenti l'`overflow-x-auto` lo ritaglia — è il difetto già corretto nella PR #18), riga di modifica inline sotto la tabella. Colonne: **Cliente · Sconto · Profilo serramento · Azioni**.

Punti obbligati:
- `kitGeometry === null && kitEntrata === null` → testo «Nessun profilo», non cella vuota.
- Nel form di modifica, `<option value="">Non dichiarata</option>` deve mandare **`null`**, non `undefined`: è la differenza fra azzerare e non toccare, ed è già distinta nel router.
- Empty-state proprio quando `list.data.length === 0`: l'anagrafica in produzione **è vuota**, quindi non è un caso limite ma il primo giorno.
- Eliminazione: `customer.delete` solleva `CONFLICT` se ci sono richieste collegate — mostrare il messaggio del server, non nasconderlo.

- [ ] **Step 5: Aggiungere la voce di sidebar**

In `src/components/layout/sidebar.tsx`, accanto a `/utenti`:

```tsx
          <NavItem href="/clienti" label="Clienti" icon={Building2} />
```

importando `Building2` da `lucide-react`. **Fuori** dal blocco riservato agli ADMIN: la voce è per tutti gli agenti. Aggiornare `sidebar.test.tsx` se asserisce l'elenco delle voci.

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `pnpm test src/app/\(dashboard\)/clienti/ src/components/layout/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/clienti/" src/components/layout/
git commit -m "feat(clienti): l'anagrafica ha finalmente una casa

customer.update e customer.delete esistevano nel router e non erano
raggiungibili da nessuna schermata: un cliente, una volta creato, non era
piu' correggibile. Elenco, modifica ed eliminazione sulla forma di /utenti,
azioni in menu ⋯ con dropdown fixed per non farsi ritagliare
dall'overflow-x-auto. Nessun gate ADMIN: l'anagrafica e' condivisa fra gli
agenti e il router usa agentProcedure.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Chiudere il debito del gate su catalogo reale

**Files:**
- Modify: `src/server/kit/codici-a-listino.integration.test.ts`

**Interfaces:** nessuna — è un test.

- [ ] **Step 1: Scrivere il test**

Dopo il blocco delle 28 combinazioni, prima di quello delle 9 bande HBB:

```ts
  // Le 28 combinazioni sopra fissano `widthMm: 550`, quindi esercitano UNA
  // banda su 5 di FORBICI e UNA su 4 di BRACCI_GRUPPI. Il codice del braccio è
  // `A5191{1=DX,2=SX}.{mid}.0{gruppo}`: con 5 `mid` distinti fra le 7 geometrie
  // fanno 5×2×4 = 40 codici, di cui il gate ne verificava 10. Qui si spazzano le
  // larghezze.
  //
  // Ogni larghezza cade nell'INTERNO NON SOVRAPPOSTO della sua banda: le bande
  // si accavallano (476-490 sta sia nella prima sia nella seconda), e prendere
  // un valore nella sovrapposizione verificherebbe la banda che `pick()` trova
  // per prima invece di quella voluta.
  //
  // `entrata` resta fissa: cambia SOLO la riga della cremonese, già coperta dal
  // test delle 9 bande HBB qui sotto. Stesso criterio con cui quello fissa la
  // geometria.
  const LARGHEZZE = [400, 550, 700, 900, 1100];

  const perLarghezza = LARGHEZZE.flatMap((widthMm) =>
    (Object.keys(GEOMETRIE) as ArtechGeometryId[]).flatMap((geometry) =>
      (["DESTRA", "SINISTRA"] as const).map((openingSide) => ({
        widthMm,
        geometry,
        openingSide,
      })),
    ),
  );

  it.each(perLarghezza)(
    "larghezza $widthMm / $geometry / $openingSide — forbice e braccio a catalogo",
    async ({ widthMm, geometry, openingSide }) => {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        widthMm,
        geometry,
        openingSide,
        entrata: "E15",
      } as KitInput);

      const codici = [...new Set(lines.map((l) => l.code))];
      expect(
        codici.length,
        "distinta vuota: il gate non avrebbe verificato nulla",
      ).toBeGreaterThanOrEqual(16);

      const trovati = await db.product.findMany({
        where: { agbCode: { in: codici } },
        select: { agbCode: true, basePrice: true },
      });
      const prezzati = new Set(
        trovati
          .filter((p) => p.basePrice !== null && Number(p.basePrice) > 0)
          .map((p) => p.agbCode),
      );
      const orfani = codici.filter((c) => !prezzati.has(c));
      expect(orfani, `codici assenti o senza prezzo: ${orfani.join(", ")}`).toEqual([]);
    },
  );

  it("le 5 larghezze coprono tutti i codici forbice e tutti i gruppi braccio", () => {
    // Guardia del test precedente: se un domani le bande di FORBICI cambiano,
    // LARGHEZZE va rifatta — e questo test lo dice, invece di lasciare il gate
    // a coprire silenziosamente di meno.
    const forbici = new Set<string>();
    const bracci = new Set<string>();
    for (const widthMm of LARGHEZZE) {
      const lines = artechAntaRibaltaLegno.generate({
        ...base,
        widthMm,
        geometry: "A12_I13_B20",
        openingSide: "DESTRA",
        entrata: "E15",
      } as KitInput);
      for (const l of lines) {
        if (l.code.startsWith("A50510.")) forbici.add(l.code);
        if (/^A5191[12]\./.test(l.code)) bracci.add(l.code.slice(-2));
      }
    }
    expect(forbici.size, `forbici coperte: ${[...forbici].sort().join(", ")}`).toBe(5);
    expect(bracci.size, `gruppi braccio coperti: ${[...bracci].sort().join(", ")}`).toBe(4);
  });
```

- [ ] **Step 2: Eseguire il gate sul catalogo reale**

```bash
set -a; source .env; set +a
INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm test src/server/kit/codici-a-listino.integration.test.ts
```

Expected: 70 casi nuovi + 1 guardia, **tutti verdi**. `INTEGRATION_DATABASE_URL` è obbligatoria: **senza, il gate passa a vuoto**.

Se qualche caso è rosso, **è una scoperta, non un test da aggiustare**: significa che il generatore emette un codice che a listino non esiste o non ha prezzo, esattamente come per PVC e battente. Fermarsi, annotare i codici orfani, e riportarli prima di procedere.

- [ ] **Step 3: Commit**

```bash
git add src/server/kit/codici-a-listino.integration.test.ts
git commit -m "test(gate): 40 codici braccio esistevano, il gate ne verificava 10

Il gate fissava widthMm 550, quindi esercitava una banda su 5 di FORBICI e
una su 4 di BRACCI_GRUPPI. Cinque larghezze, ciascuna nell'interno non
sovrapposto della sua banda, incrociate con 7 geometrie e 2 mani. Piu' una
guardia che fallisce se un domani le bande cambiano e la copertura cala in
silenzio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Le domande all'esperto, e i documenti di sessione

**Files:**
- Modify: `docs/superpowers/kit-assunzioni/DOMANDE-APERTE.md`
- Modify: `docs/superpowers/kit-assunzioni/legno.md` (indice delle domande)
- Modify: `handoff.md`, `CLAUDE.md` (§STATO)

**Interfaces:** nessuna.

- [ ] **Step 1: Scrivere la domanda 29**

In `DOMANDE-APERTE.md`, nella sezione «Per l'agente esperto»:

```markdown
## 29 — «Incontro nottolino incassato»: quale delle tre varianti?

**Da chi arriva:** richiesta dell'utente, 2026-07-30 — i clienti esprimono una
preferenza per l'incontro nottolino **incassato**, «sagomato per essere inserito a
filo nel telaio tramite fresatura, con scasso eseguito a fresa o pantografo, viti a
testa ridotta», scelto per mano DX/SX.

**Il problema:** la parola «incassato» compare **due volte in 959 pagine**, entrambe
fuori contesto — p0590 (588) per un binario, p0628 (626) per una serratura. Non è
mappabile a un codice. Il blocco incontri pubblica però **tre assi che il generatore
cabla senza chiederli**:

| # | Asse | Fonte | Codici |
|---|---|---|---|
| a | **Corpo dell'incontro**: stesso formato 9x18, due pezzi diversi | p0469 (467), voci **2** e **4** del disegno | `A51400.05.02` (piastrina stampata) · `A51400.05.13` (corpo pieno con rampa) — stesso prezzo 0,81 € |
| b | **Con perni di posizionamento Ø 8x3** | p0469 (467), p0471 (469), p0473 (471) | famiglia `A52200.*`, stessi formati, stesso prezzo |
| c | **Antieffrazione** | p0470 (468) | `A514DX/SX.05.67` (viti inclinate) · `.68` (viti dritte) · `A522DX/SX.05.67` — 2,04-3,03 € contro 0,81 |

**Due indizi si contraddicono:**
1. La descrizione parla di **mano DX/SX**, ma gli incontri nottolino aria 12 standard
   (asse **a**) sono **ambidestri**. Ad avere DX/SX per aria 12 è l'antieffrazione (**c**).
2. «Fresatura» nel listino è una caratterizzazione della **geometria**, non una
   variante: p0469 (467) scrive «Aria 4 - Asse 13 - **Fresatura** 23 mm» contro
   «Aria 12 - Asse 13 - **Sede** 24 mm». Dime esistono per entrambe.

**Domanda:** quale dei tre? E se è **a**, il `.13` richiede la copertura viti
(`A52102.01.44` o `.87`) che oggi non emettiamo — vedi domanda 20.

**Perché non l'abbiamo indovinato:** perché indovinare qui significa scrivere nel
profilo di un cliente una preferenza che il motore applica alla riga sbagliata.
```

- [ ] **Step 2: Circostanziare la domanda 20**

Nella domanda 20 esistente, aggiungere sotto la voce «22 copertura incontro»:

```markdown
**I codici che la fanno scattare** (verificati 2026-07-30):
- `A51400.CR.13` — nottolino 13x24, cioè la geometria `A12_I13_B18` (**Fosca**);
- `A51400.05.70` **e** `A51400.CR.70` — incontri ribalta, p0471 (469): **entrambi**
  marcati `*` «ordinare coperture separatamente». Il primo è quello del **golden**.

Coperture: `A52102.01.44` (grigio RAL 7040) o `.87` (antracite), 0,39 €.

Il golden è un ordine reale del 16/11/2021 a 16 righe: o la copertura è facoltativa
nella pratica, o il listino 2021 differiva. **Non si tocca il golden** su questa base.

Nota: `A52102.05.44` **non** è una copertura viti nonostante la famiglia — a catalogo
si chiama «Inserto DSS per incontri con copertura».
```

- [ ] **Step 3: Aggiornare l'indice in `legno.md` e i documenti di sessione**

`legno.md`: aggiungere la 29 all'indice globale delle domande.
`handoff.md`: nuova §RIPRENDI DA QUI con lo stato, le azioni ops e il debito residuo.
`CLAUDE.md` §STATO: il paragrafo di questa sessione.

- [ ] **Step 4: Commit**

```bash
git add docs/ handoff.md CLAUDE.md
git commit -m "docs: la domanda 29, e la 20 con i codici che la fanno scattare

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Gate finale (prima della PR)

- [ ] `test -z "$(git status --porcelain)"` — **prima** asserzione: un amend prima dello staging sporca il tree per costruzione
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test` — atteso ≳ 870 (base 843)
- [ ] `pnpm build`
- [ ] `INTEGRATION_DATABASE_URL="$DATABASE_URL" pnpm test src/server/kit/` — gate su catalogo reale
- [ ] **Il golden, verificato esplicitamente sul catalogo importato:** 16 righe / 21 pezzi / **90,20 €**, e il gemello a entrata 7,5 / **96,29 €**
- [ ] **Verifica browser** Chromium desktop 1440×900 **e 375px**, screenshot **aperti e guardati** — non solo asserzioni verdi: il difetto peggiore della sessione scorsa (totale fuori schermo a 375px) era coperto da un'asserzione verde che leggeva `innerText`
- [ ] Chiedere l'ok all'utente **prima** di aprire la PR

## Azioni ops

**Una sola migrazione**, `<timestamp>_customer_kit_profile`: due colonne nullable, nessun backfill.

**Applicarla PRIMA del merge, dal branch della PR** — «Ops — Neon» accetta `workflow_dispatch` su un ref qualunque. Nella direzione inversa `customer.list`, che ha un `SELECT` esplicito, chiederebbe a Postgres colonne inesistenti e fallirebbero **le letture** dell'anagrafica. È la lezione pagata due volte (#40: venti minuti di produzione rotta; #42: qualche minuto).

Import, seed ed embed non servono — nessun codice, nessun template cambia — ma il workflow li esegue comunque e sono idempotenti.
